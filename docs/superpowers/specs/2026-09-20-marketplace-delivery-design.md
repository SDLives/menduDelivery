# Mendu Delivery — Design do MVP

**Data:** 2026-09-20
**Status:** Aprovado para planejamento de implementação
**Marca:** Mendu Delivery (definido em 2026-09-21 — ver Seção 10)

## 1. Contexto e objetivo

Marketplace de delivery multi-loja (modelo iFood), com cobrança SaaS por comissão + mensalidade sobre os estabelecimentos. Uso real, em escala controlada (poucas lojas, validação de modelo de negócio), não um projeto de portfólio nem uma operação de escala nacional desde o dia 1.

**Princípio de arquitetura adotado ao longo de todo o design:** o MVP deve ser funcional e enxuto, mas a modelagem de dados, relacionamentos e eventos devem ser criados desde já para que os módulos futuros (entregador, GPS/roteirização, IA operacional, cupons/fidelidade, WhatsApp, dashboard avançado) sejam adicionados sem refatoração estrutural. Onde uma decisão exigiria *adivinhar* regras de negócio ainda não definidas (ex: regras de cupom, perfil de entregador, disputas), optou-se por **não** modelar agora — o risco de errar o formato supera o benefício de "já ter a tabela".

## 2. Escopo do MVP

**Dentro do MVP:**
- Cliente: navega lojas ativas, monta carrinho, finaliza pedido (endereço + forma de pagamento), acompanha status.
- Lojista: cadastra loja (fica pendente até aprovação), gerencia cardápio, recebe e avança pedidos, abre/fecha a loja.
- Admin mínimo: aprova/reprova/suspende loja, gerencia migração de plano.
- Pagamento: Asaas — online (split automático comissão/loja) ou na entrega.
- Feedback simples do cliente pós-entrega (nota 1–5 + comentário).

**Fora do MVP (preparado no schema, não implementado agora):**
- App/painel de entregador, GPS em tempo real, roteirização, otimização de múltiplas entregas.
- Cupons/descontos promocionais, programa de fidelidade.
- Notificações WhatsApp, dashboard administrativo avançado.
- Camada de Inteligência Operacional / IA sobre os dados operacionais.
- Disputas/mediação de entrega, devoluções formais.
- Perfil detalhado de entregador (veículo, disponibilidade).

## 3. Papéis, autenticação e multi-tenancy

**Papéis** (`users.role`): `customer`, `store_owner`, `platform_admin`, `courier` (reservado, sem uso funcional no MVP).

**Multi-tenancy:** banco único, `store_id` como chave de particionamento lógico em toda tabela dependente de loja. Suficiente para a escala do MVP; não impede migrar para isolamento físico por tenant no futuro.

**Isolamento em duas camadas:**
1. **Aplicação (proteção principal):** toda função de acesso a dado store-scoped exige `store_id` vindo do contexto da sessão autenticada no servidor — nunca de parâmetro livre do cliente.
2. **RLS no Postgres (defesa em profundidade):** políticas usando variáveis de sessão (`app.current_store_id`, `app.current_customer_id`, `app.current_role`), setadas via `SET LOCAL` dentro de uma transação explícita por operação (necessário por causa do connection pooling). `platform_admin` entra como exceção `OR` nas políticas, enxergando todas as lojas.

`store_users` modela o vínculo usuário↔loja como relação (não "1 usuário = 1 loja" fixo), permitindo múltiplos atendentes por loja no futuro sem redesenho.

## 4. Modelo de dados

### 4.1 Núcleo

**`users`** — perfil de aplicação vinculado à identidade de autenticação única da plataforma.
| campo | tipo |
|---|---|
| id | uuid — mesmo id do usuário em `auth.users` (Supabase Auth) |
| email | text, unique |
| role | enum: customer, store_owner, platform_admin, courier |
| phone | text, nullable |
| created_at | timestamp |

Sem `password_hash` aqui: credencial (senha, hash, recuperação de senha) é responsabilidade do Supabase Auth (`auth.users`), não da aplicação — evita reimplementar hashing de senha, área clássica de vulnerabilidade quando feita à mão.

**`customers`** — perfil global de cliente (1:1 com `users` quando `role=customer`).
| campo | tipo |
|---|---|
| id | uuid |
| user_id | FK único → users |
| marketing_opt_in | bool, default false |
| asaas_customer_id | text, nullable — criado na primeira compra online |
| created_at | timestamp |

**`customer_stores`** — relação cliente↔loja, base para fidelidade/segmentação futura.
| campo | tipo |
|---|---|
| id | uuid |
| customer_id | FK → customers |
| store_id | FK → stores |
| first_order_at, last_order_at | timestamp, nullable |
| total_orders | int, default 0 |
| is_favorite | bool, default false |

Unique (`customer_id`, `store_id`).

**`store_users`**
| campo | tipo |
|---|---|
| id | uuid |
| store_id | FK → stores |
| user_id | FK → users |
| role_in_store | enum: owner, staff |

Unique (`store_id`, `user_id`).

**`stores`**
| campo | tipo |
|---|---|
| id | uuid |
| name, slug (unique) | text |
| custom_domain | text, nullable — não usado no MVP, roteamento por `slug` via path (`/loja/slug`) |
| primary_color, secondary_color | text (hex) |
| status | enum: pending_approval, active, rejected, suspended |
| approved_by | FK → users, nullable |
| approved_at | timestamp, nullable |
| is_open | bool |
| opening_hours | jsonb |
| address_id | FK → addresses |
| created_at | timestamp |

`logo_url`/`banner_url` não são colunas — vêm de `media_assets` (`role=logo`/`role=banner`). A comissão da loja **não** é um campo aqui — vive em `store_subscriptions` (seção 4.2), evitando duas fontes de verdade para a mesma taxa.

**`products`**
| campo | tipo |
|---|---|
| id | uuid |
| store_id | FK |
| name, description, price | |
| is_available | bool |
| created_at, updated_at | timestamp |

**`addresses`** — endereços de cliente e de loja.
| campo | tipo |
|---|---|
| id | uuid |
| customer_id | FK, nullable |
| store_id | FK, nullable |
| — | CHECK: exatamente um dos dois preenchido |
| cep | text |
| rua | text |
| numero | text |
| complemento | text, nullable |
| loteamento | text, nullable |
| bairro | text |
| municipio | text |
| uf | text |
| ativo | bool, default true — desativação lógica (endereço "removido" pelo cliente continua existindo para pedidos antigos que já referenciam `delivery_address_id`) |
| lat, lng | numeric, nullable — não usado no MVP, preparado para roteirização/tracking futuro |

**`media_assets`**
| campo | tipo |
|---|---|
| id | uuid |
| store_id | FK |
| product_id | FK, nullable — nulo quando é logo/banner da loja |
| role | enum: logo, banner, gallery |
| media_type | enum: image, video — MVP só usa `image` |
| url | text |
| thumbnail_url | text, nullable |
| width, height | int, nullable |
| duration_seconds | int, nullable |
| status | enum: ready, processing, failed — MVP sempre `ready` |
| position | int |
| created_at | timestamp |

### 4.2 Financeiro e planos

**`store_payment_accounts`** — abstrai o provedor de pagamento (mesmo princípio do `StorageService`/`RoutingService`: `stores` não conhece detalhe de gateway).
| campo | tipo |
|---|---|
| id | uuid |
| store_id | FK, unique |
| provider | enum: asaas |
| external_account_id | text — id da subconta no Asaas |
| status | enum: pending, active, restricted |

Uma loja só habilita pagamento **online** no checkout quando `status = active`. Pagamento na entrega funciona independente disso.

**`subscription_plans`** — catálogo configurável (não hardcoded).
| campo | tipo |
|---|---|
| id | uuid |
| code | text (START, PRO, BUSINESS, ENTERPRISE) |
| name | text |
| revenue_min, revenue_max | numeric, nullable |
| commission_rate | numeric, nullable (nulo = negociável, caso ENTERPRISE) |
| monthly_fee | numeric, nullable |
| is_custom | bool |
| is_active | bool |
| created_at | timestamp |

**`store_subscriptions`** — plano vigente **e** histórico de cada loja numa única tabela (registro sem `ended_at` = vigente). Substitui a necessidade de duas tabelas separadas (atual + histórico), evitando dessincronia.
| campo | tipo |
|---|---|
| id | uuid |
| store_id | FK |
| plan_id | FK → subscription_plans |
| commission_rate_snapshot | numeric — valor real aplicado, pode divergir do catálogo em planos negociados |
| monthly_fee_snapshot | numeric |
| asaas_subscription_id | text, nullable — assinatura recorrente no Asaas para a mensalidade fixa |
| started_at | timestamp |
| ended_at | timestamp, nullable |
| changed_by | FK → users (admin) |

**`platform_fees`** — catálogo genérico de taxas futuras (adesão, saque antecipado etc.). Existe no schema, **sem uso no MVP**.
| campo | tipo |
|---|---|
| id | uuid |
| code, name | text |
| amount_type | enum: percentage, fixed |
| amount_value | numeric |
| is_active | bool |

**`billing_periods`** — um registro por loja por mês.
| campo | tipo |
|---|---|
| id | uuid |
| store_id | FK |
| period_start, period_end | date |
| plan_code_snapshot | text |
| total_gross_revenue | numeric — soma de `orders.gross_amount` no período, usado para detectar excedente de faixa |
| total_commission_amount | numeric — agregado para relatório/reconciliação (a comissão em si já foi coletada por pedido via split, não é cobrada aqui) |
| monthly_fee_amount | numeric |
| exceeded_tier | bool, default false |
| status | enum: open, closed | período ainda acumulando pedidos vs. fechado |
| gateway_charge_id | text, nullable — cobrança da mensalidade no Asaas |
| fee_payment_status | enum: pending, paid, overdue, failed |
| created_at, closed_at | timestamp, nullable |

Regra de negócio: exceder a faixa **não bloqueia pedidos** — apenas marca `exceeded_tier = true`, loja é notificada, e a migração de plano é uma ação manual do admin (não automática).

**`financial_transactions`** — livro-razão de todo movimento financeiro.
| campo | tipo |
|---|---|
| id | uuid |
| store_id | FK |
| type | enum: order_commission, subscription_fee, refund, adjustment |
| related_order_id | FK, nullable |
| related_billing_period_id | FK, nullable |
| amount | numeric |
| direction | enum: credit, debit (perspectiva da loja) |
| created_at | timestamp |

### 4.3 Pedido e operação

**`orders`**
| campo | tipo |
|---|---|
| id | uuid |
| store_id | FK |
| customer_id | FK |
| status | enum: pending_payment, confirmed, preparing, out_for_delivery, delivered, cancelled |
| payment_method | enum: online, cash_on_delivery |
| payment_status | enum: pending, paid, failed, refunded, chargeback |
| delivery_address_id | FK → addresses |
| gross_amount | numeric — valor bruto dos produtos |
| discount_amount | numeric, default 0 |
| commission_base_amount | numeric — `gross_amount - discount_amount`, armazenado (não só calculado) para auditoria |
| commission_rate_applied | numeric — snapshot da taxa vigente no momento |
| commission_amount | numeric — `commission_base_amount × commission_rate_applied` |
| gateway_fee_amount | numeric |
| delivery_fee | numeric — fora da base de comissão |
| delivery_fee_recipient | enum: store, courier, platform — MVP sempre `store` |
| net_amount_to_store | numeric — `gross_amount - discount_amount - commission_amount - gateway_fee_amount` |
| plan_code_at_order | text — snapshot legível do plano |
| gateway_provider | enum: asaas |
| gateway_charge_id | text |
| created_at | timestamp |

Nenhum timestamp de etapa (`confirmed_at`, `delivered_at` etc.) é coluna própria — todos vêm de `order_events`, evitando duas fontes de verdade para o tempo de cada fase.

**`order_events`** — log genérico, base para KPIs e futura camada de IA.
| campo | tipo |
|---|---|
| id | uuid |
| order_id | FK |
| event_type | text — created, payment_confirmed, payment_failed, status_changed, cancelled, feedback_submitted, delivery_assigned, delivery_picked_up, delivery_started, delivery_completed, delivery_failed |
| payload | jsonb |
| actor_type | enum: customer, store_user, system, admin, courier |
| actor_id | uuid, nullable |
| created_at | timestamp |

**`order_feedback`** — versão mínima, base para o módulo avançado de reviews depois.
| campo | tipo |
|---|---|
| id | uuid |
| order_id | FK, unique |
| customer_id, store_id | FK |
| rating | int (1–5) |
| comment | text, nullable |
| created_at | timestamp |

### 4.4 Entrega e rastreamento (preparado, não implementado)

**`deliveries`**
| campo | tipo |
|---|---|
| id | uuid |
| order_id | FK, unique |
| store_id | FK |
| delivery_type | enum: store_self_delivery, platform_courier — MVP só usa o primeiro |
| courier_id | FK → users, nullable |
| status | enum: pending, out_for_delivery, delivered, failed |
| current_lat, current_lng | numeric, nullable — cache da posição mais recente, não histórico |
| current_accuracy, current_speed, current_heading | numeric, nullable |
| current_location_at | timestamp, nullable |
| tracking_active | bool, default false |

**`delivery_tracking`** — histórico de posições GPS, tabela vazia até o app do entregador existir.
| campo | tipo |
|---|---|
| id | uuid |
| delivery_id | FK |
| store_id | FK |
| lat, lng | numeric |
| accuracy, speed, heading | numeric, nullable |
| recorded_at | timestamp |

Suporte a múltiplas entregas simultâneas por entregador já funciona sem mudança (várias linhas de `deliveries` podem referenciar o mesmo `courier_id`). Roteirização/otimização de paradas fica para uma camada de código futura (`RoutingService`), sem tabela própria no MVP.

### 4.5 Administração e integridade

**`audit_log`** — ações administrativas e sensíveis.
| campo | tipo |
|---|---|
| id | uuid |
| actor_type | enum: admin, system |
| actor_id | FK, nullable |
| action | text — store.approved, store.rejected, store.suspended, subscription.plan_changed |
| target_type | text |
| target_id | uuid |
| metadata | jsonb |
| created_at | timestamp |

**`webhook_events`** — todo evento recebido do Asaas, com estado de processamento (garante idempotência e auditabilidade).
| campo | tipo |
|---|---|
| id | uuid |
| provider | enum: asaas |
| external_event_id | text |
| event_type | text |
| payload | jsonb |
| status | enum: received, processed, failed, ignored_duplicate |
| processed_at | timestamp, nullable |
| created_at | timestamp |

Unique (`provider`, `external_event_id`) — é essa restrição que impede processar o mesmo evento duas vezes se o Asaas reenviar. Tabela interna, sem RLS (nunca acessada por lojista/cliente).

## 5. Fluxo do pedido e pagamento (Asaas)

1. **Checkout:** backend calcula os valores financeiros (busca `store_subscriptions` vigente da loja, calcula `commission_base_amount`, `commission_amount`, soma `delivery_fee`) antes de gravar qualquer coisa.
2. **Criação do pedido:**
   - `cash_on_delivery`: `orders.status = confirmed` direto, `payment_status = pending`.
   - `online`: só grava o pedido depois de criar a cobrança no Asaas com sucesso (evita pedido "fantasma"); `status = pending_payment`. A cobrança já é criada com o **split configurado** (parte para a subconta da loja = `net_amount_to_store`, parte para a conta da plataforma = `commission_amount`) — o repasse é automático no pagamento, não uma transferência manual depois.
3. **Confirmação via webhook:** Asaas notifica o backend. Todo evento é gravado primeiro em `webhook_events`; se `external_event_id` já existe, é marcado `ignored_duplicate` e nada mais acontece (idempotência). Se novo: processa, atualiza `payment_status`, grava `gateway_fee_amount`, muda `orders.status = confirmed`, grava evento em `order_events`. Nunca se confia no retorno do frontend para confirmar pagamento.
4. **Operação da loja:** lojista avança manualmente `preparing → out_for_delivery → delivered`, cada transição vira `order_events`.
5. **Pós-entrega:** atualiza `customer_stores`, soma o pedido ao `billing_periods` do mês corrente (recalcula `exceeded_tier`), gera `financial_transactions`. Cliente é convidado a deixar `order_feedback`.
6. **Cancelamento:** permitido até `preparing`. Se já havia pagamento `online` aprovado, dispara estorno via Asaas e `payment_status = refunded` (ou `chargeback`, se a reversão vier do banco emissor do cliente, não da plataforma).

A mensalidade fixa do plano é cobrada separadamente via assinatura recorrente nativa do Asaas (`store_subscriptions.asaas_subscription_id`), independente do fluxo de comissão por pedido.

## 6. Painel administrativo mínimo

Protegido por `role = platform_admin`, conta criada por processo interno (nunca self-signup):
1. Aprovar/reprovar lojas com `status = pending_approval`.
2. Ver lojas com `billing_periods.exceeded_tier = true` e migrar o plano (fecha a `store_subscriptions` vigente, abre uma nova).
3. Suspender/reativar loja.

Toda ação grava uma linha em `audit_log`.

## 7. Stack técnica

| Camada | Escolha |
|---|---|
| Frontend + Backend | Next.js (React) full-stack, deploy na Vercel |
| Banco de dados / Auth | Postgres via Supabase (RLS nativo, Realtime) |
| Mídia | Bunny.net (Storage + CDN), acessado via camada `StorageService` — resto da aplicação não conhece o provedor específico |
| Pagamento | Asaas (split de pagamento por pedido, assinatura recorrente para mensalidade) |
| Automação futura | n8n — consumirá `order_events`/`webhook_events` para automações (WhatsApp, relatórios) sem exigir infraestrutura de fila própria no MVP |

**Diretrizes de arquitetura:**
- Supabase Realtime só para o que exige atualização ao vivo (status de pedido, futura localização do entregador) — não substitui consulta normal ao banco.
- Responsabilidades de tarefas potencialmente assíncronas (webhook, notificação, relatório, IA) ficam isoladas em funções/serviços próprios desde o MVP, para permitir migrar para fila/worker depois sem reescrever a lógica de negócio.
- Cache dedicado (Redis) não é necessário no MVP — usar cache nativo do Next.js (ISR/revalidação) nas páginas públicas de loja/cardápio; a camada de acesso a dado é centralizada para permitir inserir um cache depois sem redesenho.
- Observabilidade: Sentry para error tracking, logs/analytics nativos da Vercel para métricas de API, monitor de queries lentas do Supabase. Rastreabilidade de operações financeiras já é coberta pelas tabelas `order_events`, `financial_transactions`, `audit_log` e `webhook_events` — não exige ferramenta adicional no MVP.

## 8. Estratégia de testes

- **Unitários:** cálculo financeiro (`commission_base_amount`, `commission_amount`, `net_amount_to_store`), incluindo casos com desconto e taxa negociada (ENTERPRISE).
- **Integração:** fluxo de pedido ponta a ponta contra banco de teste — criação, webhook simulado, mudança de status, geração de `order_events`.
- **RLS:** teste automatizado dedicado garantindo que uma sessão de uma loja não acessa dado de outra loja (não basta confiar na política escrita).
- **Idempotência de webhook:** reenvio do mesmo `external_event_id` não deve duplicar efeito.
- **E2E mínimo automatizado** (não cobertura completa):
  - Cliente: produto → carrinho → checkout → pedido.
  - Lojista: pedido recebido → preparo → pronto → entrega.
  - Pagamento: checkout → pagamento (sandbox Asaas) → webhook → confirmação do pedido.
  - RLS: usuário/loja A não acessa dado da loja B.
- **Manual antes de cada release:** fluxo completo no navegador (E2E automatizado mais amplo fica para quando houver mais de um desenvolvedor ou o fluxo estabilizar).

## 9. Princípio geral

Priorizar simplicidade de implementação no MVP, mas manter dados, eventos e interfaces (RoutingService, StorageService, camada de acesso a dado) separados o suficiente para que cache, filas, workers, entregador, GPS, roteirização e IA operacional sejam adicionados depois sem reescrever o núcleo da aplicação.

## 10. Identidade de marca

**Nome escolhido:** Mendu Delivery. "Mendu" vem do esperanto (*mendi* = pedir/encomendar; *mendu* = "peça!", forma imperativa) — carrega significado real ligado ao ato de pedir, mas soa distintivo ao ouvido brasileiro.

**Diligência de nome realizada em 2026-09-21** (antes de "Mendu", os candidatos "TôAqui" e "Vinkoo" foram descartados por colisão real com marcas/negócios já ativos no setor de delivery/marketplace — ver histórico da conversa de brainstorming para detalhes):
- INPI: sem resultado para "MENDU" (exata e radical) e sem resultado ao filtrar pelas classes de Nice 35 (comércio/marketplace), 39 (transporte/logística), 42 (tecnologia) e 43 (serviços de alimentação) — as quatro classes relevantes para o negócio.
- Sem concorrente ativo identificado no Brasil ou no exterior no setor de delivery com esse nome.
- Domínio `mendudelivery.com.br` registrado (HostGator).
- Pendente: busca formal com agente de propriedade industrial antes do depósito oficial da marca no INPI (a autobusca não garante deferimento); registro de handles em redes sociais.

**Tagline oficial:** "Peça. Receba. Aproveite."

**Identidade visual:** ver `brand/README.md` — logo em variações full-color, mono preto/branco, escala de cinza e símbolo "U" isolado. Vetorização e exportação de ícone de app/favicon ainda pendentes.
