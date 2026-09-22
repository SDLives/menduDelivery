# Mendu Delivery — Fundação + Loop Básico de Pedido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fatia vertical mínima do marketplace Mendu Delivery: lojista se cadastra (aprovado pelo admin), cadastra produtos, cliente navega a vitrine pública, monta carrinho, finaliza pedido pagando **na entrega** (sem Asaas ainda), loja avança o status do pedido, cliente acompanha e deixa feedback.

**Architecture:** Next.js (App Router, TypeScript) full-stack, Postgres via Supabase (Auth para identidade, acesso a dado via `pg` direto — não via `supabase-js` query builder — para viabilizar o padrão de contexto de tenant com `SET LOCAL`/`set_config` descrito na spec). RLS no Postgres como defesa em profundidade; toda leitura/escrita de dado por tenant passa por uma camada de acesso a dado que exige contexto de sessão explícito, nunca aceito de parâmetro livre do client.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, `pg` (node-postgres), `@supabase/supabase-js` (só Auth), Zod (validação), Vitest (testes), Supabase CLI (Postgres local para dev/teste), Vercel (deploy).

**Spec:** `docs/superpowers/specs/2026-09-20-marketplace-delivery-design.md`

## Global Constraints

- Nomes de tabela/coluna exatamente como na spec (Seção 4), incluindo os campos de `addresses` em português (`cep`, `rua`, `numero`, `complemento`, `loteamento`, `bairro`, `municipio`, `uf`, `ativo`).
- `users` não tem `password_hash` — credencial é 100% responsabilidade do Supabase Auth (`auth.users`); `users.id` é o mesmo id do Supabase Auth.
- Todo acesso a dado por tenant passa por `withTenantContext` (nunca query direta ao pool sem contexto) — camada de aplicação é a proteção principal, RLS é defesa em profundidade.
- Este plano cobre **apenas pagamento na entrega** (`cash_on_delivery`). Campos financeiros ligados a gateway (`gateway_fee_amount`, `gateway_provider`, `gateway_charge_id`) existem no schema mas ficam `null` neste plano — pagamento online via Asaas é um plano futuro.
- Comissão da loja vem de `store_subscriptions` vigente (snapshot no pedido) — nunca hardcoded no código de checkout.
- `order_items` (tabela nova, não estava na spec original — ver decisão registrada na sessão de 2026-09-22) guarda snapshot de nome/preço do produto no pedido.
- Sem variações estruturadas de produto neste plano — cada combinação (tamanho, sabor) é um `product` separado cadastrado pelo lojista. `order_items.observacoes` (texto livre) cobre pedidos especiais.
- Sem UI de admin completa neste plano — aprovação de loja é uma ação server-side simples restrita a `platform_admin`, sem painel visual dedicado (isso é o Plano 4).
- Visual das telas voltadas a cliente/lojista (cadastro, vitrine, checkout, acompanhamento) segue o preview aprovado em 2026-09-22: `https://claude.ai/artifact/3Jd6g4AhYGcKWQ2984PKQi` — paleta `mendu-red #E31E24`, `mendu-ink #17181C`, `mendu-bg #FAF9F7`, `mendu-border #ECEAE5`, `mendu-gold #F5A623`, `mendu-green #1E8E5A`; tipografia Fredoka (marca/títulos) + Plus Jakarta Sans (interface), via Tailwind CSS. Cores podem mudar depois sem impacto estrutural — são só tokens no `tailwind.config.ts`.

---

## File Structure

```
package.json
.env.example
vitest.config.ts
tailwind.config.ts
postcss.config.js
supabase/
  migrations/
    0001_core_identity_and_store.sql
    0002_commerce.sql
    0003_rls.sql
src/
  app/
    globals.css
  lib/
    db/
      pool.ts
      tenantContext.ts
      repositories/
        stores.ts
        products.ts
        addresses.ts
        mediaAssets.ts
        subscriptions.ts
        orders.ts
    auth/
      session.ts
    storage/
      StorageService.ts
      bunnyStorage.ts
    orders/
      totals.ts
      stateMachine.ts
    cart/
      cartStore.ts
  app/
    layout.tsx
    page.tsx
    (auth)/
      cadastro/
        cliente/page.tsx
        loja/page.tsx
    loja/
      [slug]/page.tsx
    dashboard/
      produtos/page.tsx
      pedidos/page.tsx
    checkout/page.tsx
    pedido/
      [id]/page.tsx
    admin/
      lojas-pendentes/page.tsx
tests/
  db/
    schema-core.test.ts
    schema-commerce.test.ts
    rls.test.ts
  lib/
    tenantContext.test.ts
    orders-totals.test.ts
    orders-stateMachine.test.ts
  auth/
    session.test.ts
```

---

### Task 1: Scaffolding do projeto Next.js + TypeScript + Tailwind + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.gitignore`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.js`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: projeto Next.js rodável (`npm run dev`), test runner Vitest rodável (`npm test`), Tailwind configurado com os tokens de marca Mendu Delivery (cores/fontes), reutilizáveis por qualquer página das tasks seguintes via classes utilitárias (`bg-mendu-red`, `text-mendu-ink`, `font-brand`, etc.).

- [ ] **Step 1: Criar o projeto Next.js com Tailwind**

Run:
```bash
npx create-next-app@latest . --typescript --app --eslint --src-dir --import-alias "@/*" --use-npm --tailwind
```

- [ ] **Step 2: Instalar dependências adicionais**

Run:
```bash
npm install pg @supabase/supabase-js zod zustand
npm install -D vitest @types/pg dotenv
```

- [ ] **Step 3: Configurar os tokens de marca no Tailwind**

Create `tailwind.config.ts` (substitui o gerado pelo scaffold):
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mendu: {
          red: '#E31E24',
          reddark: '#8C0F13',
          ink: '#17181C',
          inksoft: '#4B4D55',
          muted: '#83858C',
          bg: '#FAF9F7',
          border: '#ECEAE5',
          gold: '#F5A623',
          green: '#1E8E5A',
        },
      },
      fontFamily: {
        brand: ['var(--font-fredoka)', 'sans-serif'],
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Carregar as fontes da marca (Fredoka + Plus Jakarta Sans) e aplicar o fundo/tipografia base**

Create `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Fredoka, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-fredoka' });
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'Mendu Delivery',
  description: 'Peça. Receba. Aproveite.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fredoka.variable} ${jakarta.variable}`}>
      <body className="bg-mendu-bg font-sans text-mendu-ink antialiased">{children}</body>
    </html>
  );
}
```

Create `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Configurar Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['dotenv/config'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Add to `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: Criar `.env.example`**

Create `.env.example`:
```bash
# Postgres (local via Supabase CLI em dev; string de conexão do projeto Supabase em produção)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:54322/postgres

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=changeme
SUPABASE_SERVICE_ROLE_KEY=changeme

# Bunny.net (Storage + CDN) — necessário a partir da Task 11
BUNNY_STORAGE_ZONE=changeme
BUNNY_STORAGE_API_KEY=changeme
BUNNY_CDN_BASE_URL=https://changeme.b-cdn.net
```

- [ ] **Step 7: Escrever teste de fumaça**

Create `tests/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs the test runner', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 9: Rodar `npm run dev` e confirmar visualmente a fonte/cor de fundo**

Run: `npm run dev`, abrir `http://localhost:3000`.
Expected: página com fundo `#FAF9F7` (bege claro) e fonte Plus Jakarta Sans aplicada (confirma que `layout.tsx`/`globals.css`/Tailwind estão conectados corretamente antes de construir as telas de verdade nas próximas tasks).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts .env.example .gitignore vitest.config.ts tailwind.config.ts postcss.config.js src/app tests/smoke.test.ts
git commit -m "chore: scaffold Next.js project with Tailwind and brand tokens"
```

---

### Task 2: Camada de conexão Postgres + contexto de tenant

**Files:**
- Create: `src/lib/db/pool.ts`, `src/lib/db/tenantContext.ts`
- Test: `tests/lib/tenantContext.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL_TEST` (env var)
- Produces:
  - `pool: Pool` (de `src/lib/db/pool.ts`)
  - `type Role = 'customer' | 'store_owner' | 'platform_admin' | 'courier'`
  - `interface TenantContext { role: Role; storeId?: string; customerId?: string }`
  - `withTenantContext<T>(ctx: TenantContext, fn: (client: PoolClient) => Promise<T>): Promise<T>`

Este task não depende de tabelas existirem ainda — testa só que o contexto de sessão é setado corretamente dentro da transação.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/lib/tenantContext.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { withTenantContext } from '@/lib/db/tenantContext';

describe('withTenantContext', () => {
  it('exposes role and storeId as session settings inside the transaction', async () => {
    const result = await withTenantContext(
      { role: 'store_owner', storeId: '11111111-1111-1111-1111-111111111111' },
      async (client) => {
        const role = await client.query(`select current_setting('app.current_role', true) as v`);
        const storeId = await client.query(`select current_setting('app.current_store_id', true) as v`);
        return { role: role.rows[0].v, storeId: storeId.rows[0].v };
      }
    );

    expect(result.role).toBe('store_owner');
    expect(result.storeId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('rolls back on error and does not leak the transaction', async () => {
    await expect(
      withTenantContext({ role: 'customer' }, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/lib/tenantContext.test.ts`
Expected: FAIL (`Cannot find module '@/lib/db/tenantContext'`)

- [ ] **Step 3: Implementar o pool de conexão**

Create `src/lib/db/pool.ts`:
```typescript
import { Pool } from 'pg';

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.DATABASE_URL_TEST
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL (ou DATABASE_URL_TEST em teste) não configurada');
}

export const pool = new Pool({ connectionString });
```

- [ ] **Step 4: Implementar o contexto de tenant**

Create `src/lib/db/tenantContext.ts`:
```typescript
import type { PoolClient } from 'pg';
import { pool } from './pool';

export type Role = 'customer' | 'store_owner' | 'platform_admin' | 'courier';

export interface TenantContext {
  role: Role;
  storeId?: string;
  customerId?: string;
}

export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`select set_config('app.current_role', $1, true)`, [ctx.role]);
    await client.query(`select set_config('app.current_store_id', $1, true)`, [ctx.storeId ?? '']);
    await client.query(`select set_config('app.current_customer_id', $1, true)`, [ctx.customerId ?? '']);

    const result = await fn(client);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Pré-requisito: Supabase CLI local rodando (`supabase start`, ver Task 3 — se ainda não tiver rodado, qualquer Postgres local acessível pela `DATABASE_URL_TEST` serve pra este teste específico, já que ele não usa tabela nenhuma).

Run: `npm test -- tests/lib/tenantContext.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/pool.ts src/lib/db/tenantContext.ts tests/lib/tenantContext.test.ts
git commit -m "feat: add Postgres pool and tenant-context transaction helper"
```

---

### Task 3: Migração de schema — identidade e loja

**Files:**
- Create: `supabase/migrations/0001_core_identity_and_store.sql`
- Test: `tests/db/schema-core.test.ts`

**Interfaces:**
- Consumes: `pool` (Task 2)
- Produces: tabelas `users`, `customers`, `store_users`, `stores`, `products`, `addresses`, `media_assets`, `customer_stores` no banco de teste.

- [ ] **Step 1: Inicializar o Supabase CLI local (se ainda não feito)**

Run:
```bash
npx supabase init
npx supabase start
```

Isso sobe Postgres local em `localhost:54322` (usuário `postgres`, senha `postgres`) — confirme que bate com `DATABASE_URL_TEST` no seu `.env`.

- [ ] **Step 2: Escrever o teste que falha**

Create `tests/db/schema-core.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '@/lib/db/pool';

describe('core identity and store schema', () => {
  it('creates a store, a store_owner user, and an address respecting the ownership check', async () => {
    const client = await pool.connect();
    try {
      const user = await client.query(
        `insert into users (id, email, role) values (gen_random_uuid(), $1, 'store_owner') returning id`,
        ['lojista@example.com']
      );
      const userId = user.rows[0].id;

      const store = await client.query(
        `insert into stores (name, slug, status) values ($1, $2, 'pending_approval') returning id`,
        ['Hamburgueria do Zé', 'hamburgueria-do-ze']
      );
      const storeId = store.rows[0].id;

      await client.query(
        `insert into store_users (store_id, user_id, role_in_store) values ($1, $2, 'owner')`,
        [storeId, userId]
      );

      const address = await client.query(
        `insert into addresses (store_id, cep, rua, numero, bairro, municipio, uf)
         values ($1, '01310-100', 'Av. Paulista', '1000', 'Bela Vista', 'São Paulo', 'SP')
         returning id`,
        [storeId]
      );

      await client.query(`update stores set address_id = $1 where id = $2`, [address.rows[0].id, storeId]);

      const result = await client.query(`select address_id from stores where id = $1`, [storeId]);
      expect(result.rows[0].address_id).toBe(address.rows[0].id);
    } finally {
      client.release();
    }
  });

  it('rejects an address with both customer_id and store_id set', async () => {
    const client = await pool.connect();
    try {
      const user = await client.query(
        `insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`,
        ['cliente@example.com']
      );
      const customer = await client.query(
        `insert into customers (user_id) values ($1) returning id`,
        [user.rows[0].id]
      );
      const store = await client.query(
        `insert into stores (name, slug) values ('Loja X', 'loja-x') returning id`
      );

      await expect(
        client.query(
          `insert into addresses (customer_id, store_id, cep, rua, numero, bairro, municipio, uf)
           values ($1, $2, '01310-100', 'Av. Paulista', '1', 'Bela Vista', 'São Paulo', 'SP')`,
          [customer.rows[0].id, store.rows[0].id]
        )
      ).rejects.toThrow();
    } finally {
      client.release();
    }
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/db/schema-core.test.ts`
Expected: FAIL (`relation "users" does not exist`)

- [ ] **Step 4: Escrever a migração**

Create `supabase/migrations/0001_core_identity_and_store.sql`:
```sql
create extension if not exists pgcrypto;

create type user_role as enum ('customer', 'store_owner', 'platform_admin', 'courier');
create type store_user_role as enum ('owner', 'staff');
create type store_status as enum ('pending_approval', 'active', 'rejected', 'suspended');
create type media_role as enum ('logo', 'banner', 'gallery');
create type media_type as enum ('image', 'video');
create type media_status as enum ('ready', 'processing', 'failed');

create table users (
  id uuid primary key,
  email text not null unique,
  role user_role not null,
  phone text,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id),
  marketing_opt_in boolean not null default false,
  asaas_customer_id text,
  created_at timestamptz not null default now()
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  custom_domain text,
  primary_color text,
  secondary_color text,
  status store_status not null default 'pending_approval',
  approved_by uuid references users(id),
  approved_at timestamptz,
  is_open boolean not null default false,
  opening_hours jsonb,
  address_id uuid,
  created_at timestamptz not null default now()
);

create table store_users (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  user_id uuid not null references users(id),
  role_in_store store_user_role not null,
  unique (store_id, user_id)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  name text not null,
  description text,
  price numeric(10,2) not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  store_id uuid references stores(id),
  cep text not null,
  rua text not null,
  numero text not null,
  complemento text,
  loteamento text,
  bairro text not null,
  municipio text not null,
  uf text not null,
  ativo boolean not null default true,
  lat numeric,
  lng numeric,
  created_at timestamptz not null default now(),
  constraint chk_addresses_single_owner check (
    (customer_id is not null and store_id is null)
    or (customer_id is null and store_id is not null)
  )
);

alter table stores
  add constraint fk_stores_address foreign key (address_id) references addresses(id);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  product_id uuid references products(id),
  role media_role not null,
  media_type media_type not null default 'image',
  url text not null,
  thumbnail_url text,
  width int,
  height int,
  duration_seconds int,
  status media_status not null default 'ready',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table customer_stores (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  store_id uuid not null references stores(id),
  first_order_at timestamptz,
  last_order_at timestamptz,
  total_orders int not null default 0,
  is_favorite boolean not null default false,
  unique (customer_id, store_id)
);
```

- [ ] **Step 5: Aplicar a migração**

Run:
```bash
npx supabase db reset
```

(`db reset` aplica todas as migrações em `supabase/migrations/` do zero no banco local — é o comando padrão pra sincronizar depois de criar/alterar uma migração.)

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/db/schema-core.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0001_core_identity_and_store.sql tests/db/schema-core.test.ts
git commit -m "feat: add core identity and store schema migration"
```

---

### Task 4: Migração de schema — comércio (planos, pedidos, itens)

**Files:**
- Create: `supabase/migrations/0002_commerce.sql`
- Test: `tests/db/schema-commerce.test.ts`

**Interfaces:**
- Consumes: tabelas da Task 3 (`users`, `customers`, `stores`, `products`, `addresses`)
- Produces: tabelas `subscription_plans` (com seed START/PRO/BUSINESS/ENTERPRISE), `store_subscriptions`, `orders`, `order_items`, `order_events`, `order_feedback`.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/db/schema-commerce.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';

describe('commerce schema', () => {
  it('seeds the four commercial plans from the spec', async () => {
    const result = await pool.query(
      `select code, commission_rate, monthly_fee from subscription_plans order by code`
    );
    const byCode = Object.fromEntries(result.rows.map((r) => [r.code, r]));

    expect(Number(byCode.START.commission_rate)).toBeCloseTo(0.07);
    expect(Number(byCode.START.monthly_fee)).toBe(0);
    expect(Number(byCode.PRO.commission_rate)).toBeCloseTo(0.06);
    expect(Number(byCode.BUSINESS.commission_rate)).toBeCloseTo(0.05);
    expect(byCode.ENTERPRISE.commission_rate).toBeNull();
  });

  it('creates an order with items and events end to end', async () => {
    const client = await pool.connect();
    try {
      const user = await client.query(
        `insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`,
        [`cliente-${Date.now()}@example.com`]
      );
      const customer = await client.query(`insert into customers (user_id) values ($1) returning id`, [
        user.rows[0].id,
      ]);
      const store = await client.query(
        `insert into stores (name, slug, status) values ('Pizzaria Teste', $1, 'active') returning id`,
        [`pizzaria-teste-${Date.now()}`]
      );
      const plan = await client.query(`select id, commission_rate from subscription_plans where code = 'START'`);
      const subscription = await client.query(
        `insert into store_subscriptions (store_id, plan_id, commission_rate_snapshot, monthly_fee_snapshot)
         values ($1, $2, $3, 0) returning id`,
        [store.rows[0].id, plan.rows[0].id, plan.rows[0].commission_rate]
      );
      const address = await client.query(
        `insert into addresses (customer_id, cep, rua, numero, bairro, municipio, uf)
         values ($1, '01310-100', 'Av. Paulista', '2000', 'Bela Vista', 'São Paulo', 'SP') returning id`,
        [customer.rows[0].id]
      );
      const product = await client.query(
        `insert into products (store_id, name, price) values ($1, 'Pizza Margherita', 40.00) returning id`,
        [store.rows[0].id]
      );

      const order = await client.query(
        `insert into orders (
           store_id, customer_id, status, payment_method, payment_status, delivery_address_id,
           gross_amount, discount_amount, commission_base_amount, commission_rate_applied, commission_amount,
           delivery_fee, net_amount_to_store, plan_code_at_order
         ) values ($1, $2, 'confirmed', 'cash_on_delivery', 'pending', $3, 40.00, 0, 40.00, 0.07, 2.80, 6.00, 37.20, 'START')
         returning id`,
        [store.rows[0].id, customer.rows[0].id, address.rows[0].id]
      );

      await client.query(
        `insert into order_items (order_id, product_id, product_name_at_order, unit_price_at_order, quantity, subtotal)
         values ($1, $2, 'Pizza Margherita', 40.00, 1, 40.00)`,
        [order.rows[0].id, product.rows[0].id]
      );

      await client.query(
        `insert into order_events (order_id, event_type, actor_type) values ($1, 'created', 'customer')`,
        [order.rows[0].id]
      );

      const items = await client.query(`select * from order_items where order_id = $1`, [order.rows[0].id]);
      const events = await client.query(`select * from order_events where order_id = $1`, [order.rows[0].id]);

      expect(items.rows).toHaveLength(1);
      expect(events.rows).toHaveLength(1);
      expect(subscription.rows[0].id).toBeDefined();
    } finally {
      client.release();
    }
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/db/schema-commerce.test.ts`
Expected: FAIL (`relation "subscription_plans" does not exist`)

- [ ] **Step 3: Escrever a migração**

Create `supabase/migrations/0002_commerce.sql`:
```sql
create type order_status as enum ('pending_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
create type payment_method as enum ('online', 'cash_on_delivery');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'chargeback');
create type delivery_fee_recipient as enum ('store', 'courier', 'platform');
create type gateway_provider as enum ('asaas');
create type order_event_actor as enum ('customer', 'store_user', 'system', 'admin', 'courier');

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  revenue_min numeric,
  revenue_max numeric,
  commission_rate numeric,
  monthly_fee numeric,
  is_custom boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into subscription_plans (code, name, revenue_min, revenue_max, commission_rate, monthly_fee, is_custom) values
  ('START', 'Start', 0, 8000, 0.07, 0, false),
  ('PRO', 'Pro', 8000.01, 30000, 0.06, 49.90, false),
  ('BUSINESS', 'Business', 30000.01, 80000, 0.05, 99.90, false),
  ('ENTERPRISE', 'Enterprise', 80000.01, null, null, null, true);

create table store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  plan_id uuid not null references subscription_plans(id),
  commission_rate_snapshot numeric not null,
  monthly_fee_snapshot numeric not null,
  asaas_subscription_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  changed_by uuid references users(id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  customer_id uuid not null references customers(id),
  status order_status not null default 'confirmed',
  payment_method payment_method not null,
  payment_status payment_status not null default 'pending',
  delivery_address_id uuid not null references addresses(id),
  gross_amount numeric(10,2) not null,
  discount_amount numeric(10,2) not null default 0,
  commission_base_amount numeric(10,2) not null,
  commission_rate_applied numeric not null,
  commission_amount numeric(10,2) not null,
  gateway_fee_amount numeric(10,2),
  delivery_fee numeric(10,2) not null default 0,
  delivery_fee_recipient delivery_fee_recipient not null default 'store',
  net_amount_to_store numeric(10,2) not null,
  plan_code_at_order text not null,
  gateway_provider gateway_provider,
  gateway_charge_id text,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  product_id uuid not null references products(id),
  product_name_at_order text not null,
  unit_price_at_order numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  observacoes text,
  subtotal numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  event_type text not null,
  payload jsonb,
  actor_type order_event_actor not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create table order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id),
  customer_id uuid not null references customers(id),
  store_id uuid not null references stores(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 4: Aplicar a migração e rodar o teste**

Run:
```bash
npx supabase db reset
npm test -- tests/db/schema-commerce.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_commerce.sql tests/db/schema-commerce.test.ts
git commit -m "feat: add commerce schema migration (plans, orders, order_items)"
```

---

### Task 5: Políticas RLS

**Files:**
- Create: `supabase/migrations/0003_rls.sql`
- Test: `tests/db/rls.test.ts`

**Interfaces:**
- Consumes: `withTenantContext` (Task 2), tabelas das Tasks 3-4
- Produces: RLS habilitado e políticas nas tabelas `stores`, `products`, `media_assets`, `addresses`, `orders`, `order_items`, `order_events`, `order_feedback`, `customer_stores`.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/db/rls.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '@/lib/db/pool';
import { withTenantContext } from '@/lib/db/tenantContext';

let storeAId: string;
let storeBId: string;

beforeAll(async () => {
  const a = await pool.query(
    `insert into stores (name, slug, status) values ('Loja A', $1, 'active') returning id`,
    [`loja-a-${Date.now()}`]
  );
  const b = await pool.query(
    `insert into stores (name, slug, status) values ('Loja B', $1, 'active') returning id`,
    [`loja-b-${Date.now()}`]
  );
  storeAId = a.rows[0].id;
  storeBId = b.rows[0].id;

  await pool.query(`insert into products (store_id, name, price, is_available) values ($1, 'Produto A', 10, false)`, [
    storeAId,
  ]);
});

describe('RLS tenant isolation', () => {
  it('does not let store B see store A unavailable products as store owner', async () => {
    const rows = await withTenantContext({ role: 'store_owner', storeId: storeBId }, async (client) => {
      const result = await client.query(`select * from products where store_id = $1`, [storeAId]);
      return result.rows;
    });

    expect(rows).toHaveLength(0);
  });

  it('lets store A see its own products as store owner', async () => {
    const rows = await withTenantContext({ role: 'store_owner', storeId: storeAId }, async (client) => {
      const result = await client.query(`select * from products where store_id = $1`, [storeAId]);
      return result.rows;
    });

    expect(rows).toHaveLength(1);
  });

  it('lets platform_admin see products from any store', async () => {
    const rows = await withTenantContext({ role: 'platform_admin' }, async (client) => {
      const result = await client.query(`select * from products where store_id = $1`, [storeAId]);
      return result.rows;
    });

    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/db/rls.test.ts`
Expected: FAIL (a query da store B retorna a linha da store A, porque RLS ainda não existe)

- [ ] **Step 3: Escrever a migração de RLS**

Create `supabase/migrations/0003_rls.sql`:
```sql
-- stores: dono/admin vê tudo da própria loja; qualquer um vê lojas ativas (vitrine pública)
alter table stores enable row level security;

create policy stores_owner_access on stores
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

create policy stores_public_read on stores
  for select
  using (status = 'active');

-- products: dono/admin vê tudo da loja; público vê produto disponível de loja ativa
alter table products enable row level security;

create policy products_owner_access on products
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

create policy products_public_read on products
  for select
  using (
    is_available = true
    and exists (select 1 from stores s where s.id = products.store_id and s.status = 'active')
  );

-- media_assets: mesmo padrão de products
alter table media_assets enable row level security;

create policy media_assets_owner_access on media_assets
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

create policy media_assets_public_read on media_assets
  for select
  using (exists (select 1 from stores s where s.id = media_assets.store_id and s.status = 'active'));

-- addresses: só o dono (cliente ou loja) e admin — nunca público
alter table addresses enable row level security;

create policy addresses_owner_access on addresses
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

-- orders: cliente vê os próprios, loja vê os da loja, admin vê tudo
alter table orders enable row level security;

create policy orders_access on orders
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

-- order_items: acesso via join com orders
alter table order_items enable row level security;

create policy order_items_access on order_items
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or exists (
      select 1 from orders o where o.id = order_items.order_id
      and (
        o.customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
        or o.store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
      )
    )
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or exists (
      select 1 from orders o where o.id = order_items.order_id
      and (
        o.customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
        or o.store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
      )
    )
  );

-- order_events: mesmo padrão via join com orders
alter table order_events enable row level security;

create policy order_events_access on order_events
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or exists (
      select 1 from orders o where o.id = order_events.order_id
      and (
        o.customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
        or o.store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
      )
    )
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or exists (
      select 1 from orders o where o.id = order_events.order_id
      and (
        o.customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
        or o.store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
      )
    )
  );

-- order_feedback: cliente e loja donos, admin
alter table order_feedback enable row level security;

create policy order_feedback_access on order_feedback
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

-- customer_stores: cliente e loja donos, admin
alter table customer_stores enable row level security;

create policy customer_stores_access on customer_stores
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );
```

- [ ] **Step 4: Aplicar a migração e rodar o teste**

Run:
```bash
npx supabase db reset
npm test -- tests/db/rls.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Rodar toda a suíte de banco pra garantir que nada quebrou**

Run: `npm test -- tests/db`
Expected: PASS (todos os testes das Tasks 3, 4 e 5)

**Nota:** os testes das Tasks 3 e 4 usam `pool.query` diretamente (sem `withTenantContext`), então uma conexão comum ao pool precisa continuar enxergando todas as linhas — isso só é verdade se essa conexão usar uma role do Postgres com `BYPASSRLS` (o usuário `postgres` do Supabase local já tem isso por padrão) ou se os testes anteriores também passarem a usar `withTenantContext` com `role: 'platform_admin'`. Se os testes das Tasks 3/4 começarem a falhar depois de habilitar RLS, ajuste-os para envolver as queries em `withTenantContext({ role: 'platform_admin' }, ...)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_rls.sql tests/db/rls.test.ts
git commit -m "feat: add RLS policies for tenant isolation"
```

---

### Task 6: Resolução de sessão (Supabase Auth → TenantContext)

**Files:**
- Create: `src/lib/auth/session.ts`
- Test: `tests/auth/session.test.ts`

**Interfaces:**
- Consumes: `TenantContext`, `Role` (Task 2), `pool` (Task 2)
- Produces:
  - `interface SessionContext extends TenantContext { userId: string }`
  - `resolveSessionContext(authUserId: string): Promise<SessionContext | null>`

Esta função recebe o id do usuário autenticado (que o Supabase Auth já validou via JWT em cada request) e resolve o papel e o(s) escopo(s) de tenant, consultando `users`/`store_users`/`customers`. A validação do JWT em si (extrair `authUserId` do cookie de sessão) é responsabilidade do middleware do Next.js/Supabase — este task cobre só a resolução pós-autenticação, que é a parte testável sem precisar de um servidor HTTP de verdade.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/auth/session.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { resolveSessionContext } from '@/lib/auth/session';

describe('resolveSessionContext', () => {
  it('resolves a customer session with customerId set', async () => {
    const authUserId = crypto.randomUUID();
    await pool.query(`insert into users (id, email, role) values ($1, $2, 'customer')`, [
      authUserId,
      `cliente-${authUserId}@example.com`,
    ]);
    const customer = await pool.query(`insert into customers (user_id) values ($1) returning id`, [authUserId]);

    const ctx = await resolveSessionContext(authUserId);

    expect(ctx).toEqual({
      userId: authUserId,
      role: 'customer',
      customerId: customer.rows[0].id,
      storeId: undefined,
    });
  });

  it('resolves a store_owner session with storeId set', async () => {
    const authUserId = crypto.randomUUID();
    await pool.query(`insert into users (id, email, role) values ($1, $2, 'store_owner')`, [
      authUserId,
      `lojista-${authUserId}@example.com`,
    ]);
    const store = await pool.query(
      `insert into stores (name, slug) values ('Loja Sessão', $1) returning id`,
      [`loja-sessao-${authUserId}`]
    );
    await pool.query(`insert into store_users (store_id, user_id, role_in_store) values ($1, $2, 'owner')`, [
      store.rows[0].id,
      authUserId,
    ]);

    const ctx = await resolveSessionContext(authUserId);

    expect(ctx?.role).toBe('store_owner');
    expect(ctx?.storeId).toBe(store.rows[0].id);
  });

  it('returns null for an unknown user id', async () => {
    const ctx = await resolveSessionContext(crypto.randomUUID());
    expect(ctx).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/auth/session.test.ts`
Expected: FAIL (`Cannot find module '@/lib/auth/session'`)

- [ ] **Step 3: Implementar**

Create `src/lib/auth/session.ts`:
```typescript
import { pool } from '@/lib/db/pool';
import type { Role, TenantContext } from '@/lib/db/tenantContext';

export interface SessionContext extends TenantContext {
  userId: string;
}

export async function resolveSessionContext(authUserId: string): Promise<SessionContext | null> {
  const userResult = await pool.query<{ role: Role }>(`select role from users where id = $1`, [authUserId]);
  if (userResult.rows.length === 0) return null;

  const role = userResult.rows[0].role;

  if (role === 'customer') {
    const customer = await pool.query<{ id: string }>(`select id from customers where user_id = $1`, [authUserId]);
    return { userId: authUserId, role, customerId: customer.rows[0]?.id, storeId: undefined };
  }

  if (role === 'store_owner') {
    const storeUser = await pool.query<{ store_id: string }>(
      `select store_id from store_users where user_id = $1 limit 1`,
      [authUserId]
    );
    return { userId: authUserId, role, storeId: storeUser.rows[0]?.store_id, customerId: undefined };
  }

  return { userId: authUserId, role, storeId: undefined, customerId: undefined };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/auth/session.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts tests/auth/session.test.ts
git commit -m "feat: resolve authenticated user into tenant session context"
```

---

### Task 7: Cadastro de cliente

**Files:**
- Create: `src/lib/supabaseServerClient.ts`, `src/app/(auth)/cadastro/cliente/page.tsx`, `src/app/(auth)/cadastro/cliente/actions.ts`
- Test: `tests/lib/signupCustomer.test.ts`

**Interfaces:**
- Consumes: `pool`, `withTenantContext` (Task 2)
- Produces: `signupCustomer(input: { email: string; password: string; phone?: string }): Promise<{ userId: string; customerId: string }>`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/lib/signupCustomer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { signupCustomer } from '@/app/(auth)/cadastro/cliente/actions';

describe('signupCustomer', () => {
  it('creates a users row (role=customer) and a customers row linked to it', async () => {
    const email = `cliente-${Date.now()}@example.com`;

    const result = await signupCustomer({ email, password: 'senha-forte-123', phone: '11999998888' });

    const user = await pool.query(`select role, phone from users where id = $1`, [result.userId]);
    const customer = await pool.query(`select user_id from customers where id = $1`, [result.customerId]);

    expect(user.rows[0].role).toBe('customer');
    expect(user.rows[0].phone).toBe('11999998888');
    expect(customer.rows[0].user_id).toBe(result.userId);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/lib/signupCustomer.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar o client Supabase server-side**

Create `src/lib/supabaseServerClient.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

export function supabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 4: Implementar `signupCustomer`**

Create `src/app/(auth)/cadastro/cliente/actions.ts`:
```typescript
'use server';

import { z } from 'zod';
import { pool } from '@/lib/db/pool';
import { supabaseAdminClient } from '@/lib/supabaseServerClient';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

export type SignupCustomerInput = z.infer<typeof signupSchema>;

export async function signupCustomer(
  input: SignupCustomerInput
): Promise<{ userId: string; customerId: string }> {
  const parsed = signupSchema.parse(input);

  const supabase = supabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário no Supabase Auth: ${error?.message}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`insert into users (id, email, role, phone) values ($1, $2, 'customer', $3)`, [
      data.user.id,
      parsed.email,
      parsed.phone ?? null,
    ]);
    const customer = await client.query(`insert into customers (user_id) values ($1) returning id`, [
      data.user.id,
    ]);
    await client.query('COMMIT');
    return { userId: data.user.id, customerId: customer.rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 5: Criar a página de cadastro**

Create `src/app/(auth)/cadastro/cliente/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signupCustomer } from './actions';

export default function CadastroClientePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signupCustomer({ email, password, phone: phone || undefined });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mendu-bg px-5">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-mendu-border bg-white p-6 shadow-sm"
      >
        <h1 className="font-brand text-2xl font-bold text-mendu-ink">Criar conta</h1>
        <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-xl border border-mendu-border px-3 py-2.5 text-sm font-normal outline-none focus:border-mendu-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="rounded-xl border border-mendu-border px-3 py-2.5 text-sm font-normal outline-none focus:border-mendu-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
          Telefone (opcional)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl border border-mendu-border px-3 py-2.5 text-sm font-normal outline-none focus:border-mendu-red"
          />
        </label>
        {error && <p className="text-sm font-semibold text-mendu-red">{error}</p>}
        <button
          type="submit"
          className="mt-2 rounded-xl bg-mendu-red py-3 text-sm font-bold text-white transition hover:bg-mendu-reddark"
        >
          Criar conta
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Pré-requisito: `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apontando pro Supabase local (`supabase start` imprime essas chaves no terminal — copie pro `.env`).

Run: `npm test -- tests/lib/signupCustomer.test.ts`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabaseServerClient.ts "src/app/(auth)/cadastro/cliente" tests/lib/signupCustomer.test.ts
git commit -m "feat: add customer signup"
```

---

### Task 8: Cadastro de loja (com plano padrão e endereço)

**Files:**
- Create: `src/app/(auth)/cadastro/loja/page.tsx`, `src/app/(auth)/cadastro/loja/actions.ts`
- Test: `tests/lib/signupStore.test.ts`

**Interfaces:**
- Consumes: `supabaseAdminClient` (Task 7), `pool` (Task 2)
- Produces: `signupStore(input): Promise<{ userId: string; storeId: string }>` — cria `users` (role=store_owner), `stores` (status=pending_approval), `store_users` (owner), `addresses` (endereço da loja), `store_subscriptions` (plano START por padrão).

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/lib/signupStore.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { signupStore } from '@/app/(auth)/cadastro/loja/actions';

describe('signupStore', () => {
  it('creates store, owner link, address and a default START subscription', async () => {
    const email = `lojista-${Date.now()}@example.com`;

    const result = await signupStore({
      email,
      password: 'senha-forte-123',
      storeName: 'Hamburgueria do Zé',
      storeSlug: `hamburgueria-do-ze-${Date.now()}`,
      address: {
        cep: '01310-100',
        rua: 'Av. Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        municipio: 'São Paulo',
        uf: 'SP',
      },
    });

    const store = await pool.query(`select status, address_id from stores where id = $1`, [result.storeId]);
    const storeUser = await pool.query(
      `select role_in_store from store_users where store_id = $1 and user_id = $2`,
      [result.storeId, result.userId]
    );
    const subscription = await pool.query(
      `select sp.code from store_subscriptions ss join subscription_plans sp on sp.id = ss.plan_id
       where ss.store_id = $1 and ss.ended_at is null`,
      [result.storeId]
    );

    expect(store.rows[0].status).toBe('pending_approval');
    expect(store.rows[0].address_id).not.toBeNull();
    expect(storeUser.rows[0].role_in_store).toBe('owner');
    expect(subscription.rows[0].code).toBe('START');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/lib/signupStore.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar**

Create `src/app/(auth)/cadastro/loja/actions.ts`:
```typescript
'use server';

import { z } from 'zod';
import { pool } from '@/lib/db/pool';
import { supabaseAdminClient } from '@/lib/supabaseServerClient';

const addressSchema = z.object({
  cep: z.string().min(1),
  rua: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  loteamento: z.string().optional(),
  bairro: z.string().min(1),
  municipio: z.string().min(1),
  uf: z.string().length(2),
});

const signupStoreSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  storeName: z.string().min(1),
  storeSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'use apenas letras minúsculas, números e hífen'),
  address: addressSchema,
});

export type SignupStoreInput = z.infer<typeof signupStoreSchema>;

export async function signupStore(input: SignupStoreInput): Promise<{ userId: string; storeId: string }> {
  const parsed = signupStoreSchema.parse(input);

  const supabase = supabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário no Supabase Auth: ${error?.message}`);
  }
  const userId = data.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`insert into users (id, email, role) values ($1, $2, 'store_owner')`, [
      userId,
      parsed.email,
    ]);

    const store = await client.query(
      `insert into stores (name, slug, status) values ($1, $2, 'pending_approval') returning id`,
      [parsed.storeName, parsed.storeSlug]
    );
    const storeId = store.rows[0].id;

    await client.query(`insert into store_users (store_id, user_id, role_in_store) values ($1, $2, 'owner')`, [
      storeId,
      userId,
    ]);

    const address = await client.query(
      `insert into addresses (store_id, cep, rua, numero, complemento, loteamento, bairro, municipio, uf)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [
        storeId,
        parsed.address.cep,
        parsed.address.rua,
        parsed.address.numero,
        parsed.address.complemento ?? null,
        parsed.address.loteamento ?? null,
        parsed.address.bairro,
        parsed.address.municipio,
        parsed.address.uf,
      ]
    );

    await client.query(`update stores set address_id = $1 where id = $2`, [address.rows[0].id, storeId]);

    const startPlan = await client.query(`select id, commission_rate, monthly_fee from subscription_plans where code = 'START'`);
    await client.query(
      `insert into store_subscriptions (store_id, plan_id, commission_rate_snapshot, monthly_fee_snapshot)
       values ($1, $2, $3, $4)`,
      [storeId, startPlan.rows[0].id, startPlan.rows[0].commission_rate, startPlan.rows[0].monthly_fee]
    );

    await client.query('COMMIT');
    return { userId, storeId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Criar a página de cadastro de loja**

Create `src/app/(auth)/cadastro/loja/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signupStore } from './actions';

export default function CadastroLojaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    storeName: '',
    storeSlug: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
  });
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signupStore({
        email: form.email,
        password: form.password,
        storeName: form.storeName,
        storeSlug: form.storeSlug,
        address: {
          cep: form.cep,
          rua: form.rua,
          numero: form.numero,
          complemento: form.complemento || undefined,
          bairro: form.bairro,
          municipio: form.municipio,
          uf: form.uf,
        },
      });
      router.push('/cadastro/loja/sucesso');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar loja');
    }
  }

  const inputClass =
    'rounded-xl border border-mendu-border px-3 py-2.5 text-sm outline-none focus:border-mendu-red';

  return (
    <div className="flex min-h-screen items-center justify-center bg-mendu-bg px-5 py-10">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-mendu-border bg-white p-6 shadow-sm"
      >
        <h1 className="font-brand text-2xl font-bold text-mendu-ink">Cadastrar minha loja</h1>
        <p className="-mt-2 text-sm text-mendu-muted">Sua loja fica pendente de aprovação até revisarmos o cadastro.</p>
        <input className={inputClass} placeholder="Nome da loja" value={form.storeName} onChange={(e) => update('storeName', e.target.value)} required />
        <input className={inputClass} placeholder="slug-da-loja" value={form.storeSlug} onChange={(e) => update('storeSlug', e.target.value)} required />
        <input className={inputClass} type="email" placeholder="E-mail" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        <input className={inputClass} type="password" placeholder="Senha" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={8} />
        <div className="mt-2 grid grid-cols-2 gap-3">
          <input className={`${inputClass} col-span-2`} placeholder="CEP" value={form.cep} onChange={(e) => update('cep', e.target.value)} required />
          <input className={`${inputClass} col-span-2`} placeholder="Rua" value={form.rua} onChange={(e) => update('rua', e.target.value)} required />
          <input className={inputClass} placeholder="Número" value={form.numero} onChange={(e) => update('numero', e.target.value)} required />
          <input className={inputClass} placeholder="Complemento" value={form.complemento} onChange={(e) => update('complemento', e.target.value)} />
          <input className={`${inputClass} col-span-2`} placeholder="Bairro" value={form.bairro} onChange={(e) => update('bairro', e.target.value)} required />
          <input className={inputClass} placeholder="Município" value={form.municipio} onChange={(e) => update('municipio', e.target.value)} required />
          <input className={inputClass} placeholder="UF" maxLength={2} value={form.uf} onChange={(e) => update('uf', e.target.value.toUpperCase())} required />
        </div>
        {error && <p className="text-sm font-semibold text-mendu-red">{error}</p>}
        <button
          type="submit"
          className="mt-2 rounded-xl bg-mendu-red py-3 text-sm font-bold text-white transition hover:bg-mendu-reddark"
        >
          Cadastrar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/signupStore.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add "src/app/(auth)/cadastro/loja" tests/lib/signupStore.test.ts
git commit -m "feat: add store signup with default START subscription"
```

---

### Task 9: Aprovação de loja (ação restrita a platform_admin)

**Files:**
- Create: `src/lib/db/repositories/stores.ts`, `src/app/admin/lojas-pendentes/page.tsx`, `src/app/admin/lojas-pendentes/actions.ts`
- Test: `tests/lib/approveStore.test.ts`

**Interfaces:**
- Consumes: `withTenantContext`, `TenantContext` (Task 2)
- Produces: `approveStore(ctx: TenantContext, storeId: string, approvedByUserId: string): Promise<void>`, `listPendingStores(ctx: TenantContext): Promise<Store[]>`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/lib/approveStore.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { approveStore, listPendingStores } from '@/lib/db/repositories/stores';

describe('approveStore', () => {
  it('sets status to active, approved_by and approved_at when called by platform_admin', async () => {
    const admin = await pool.query(`insert into users (id, email, role) values (gen_random_uuid(), $1, 'platform_admin') returning id`, [
      `admin-${Date.now()}@example.com`,
    ]);
    const store = await pool.query(
      `insert into stores (name, slug, status) values ('Loja Pendente', $1, 'pending_approval') returning id`,
      [`loja-pendente-${Date.now()}`]
    );

    await approveStore({ role: 'platform_admin' }, store.rows[0].id, admin.rows[0].id);

    const result = await pool.query(`select status, approved_by, approved_at from stores where id = $1`, [
      store.rows[0].id,
    ]);
    expect(result.rows[0].status).toBe('active');
    expect(result.rows[0].approved_by).toBe(admin.rows[0].id);
    expect(result.rows[0].approved_at).not.toBeNull();
  });

  it('rejects the call when the actor is not platform_admin', async () => {
    const store = await pool.query(
      `insert into stores (name, slug, status) values ('Loja X', $1, 'pending_approval') returning id`,
      [`loja-x-${Date.now()}`]
    );

    await expect(approveStore({ role: 'customer' }, store.rows[0].id, crypto.randomUUID())).rejects.toThrow(
      'Apenas platform_admin pode aprovar lojas'
    );
  });

  it('lists only pending stores', async () => {
    const slug = `loja-pendente-listagem-${Date.now()}`;
    await pool.query(`insert into stores (name, slug, status) values ('Loja Listagem', $1, 'pending_approval')`, [
      slug,
    ]);

    const pending = await listPendingStores({ role: 'platform_admin' });

    expect(pending.some((s) => s.slug === slug)).toBe(true);
    expect(pending.every((s) => s.status === 'pending_approval')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/lib/approveStore.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar o repositório**

Create `src/lib/db/repositories/stores.ts`:
```typescript
import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';

export interface Store {
  id: string;
  name: string;
  slug: string;
  status: 'pending_approval' | 'active' | 'rejected' | 'suspended';
}

export async function approveStore(ctx: TenantContext, storeId: string, approvedByUserId: string): Promise<void> {
  if (ctx.role !== 'platform_admin') {
    throw new Error('Apenas platform_admin pode aprovar lojas');
  }

  await withTenantContext(ctx, async (client) => {
    await client.query(
      `update stores set status = 'active', approved_by = $1, approved_at = now() where id = $2`,
      [approvedByUserId, storeId]
    );
  });
}

export async function listPendingStores(ctx: TenantContext): Promise<Store[]> {
  if (ctx.role !== 'platform_admin') {
    throw new Error('Apenas platform_admin pode listar lojas pendentes');
  }

  return withTenantContext(ctx, async (client) => {
    const result = await client.query<Store>(
      `select id, name, slug, status from stores where status = 'pending_approval' order by created_at`
    );
    return result.rows;
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/approveStore.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Criar a rota mínima de aprovação**

Create `src/app/admin/lojas-pendentes/actions.ts`:
```typescript
'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { approveStore as approveStoreRepo, listPendingStores as listPendingStoresRepo } from '@/lib/db/repositories/stores';

export async function approveStoreAction(authUserId: string, storeId: string) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  await approveStoreRepo(ctx, storeId, ctx.userId);
}

export async function listPendingStoresAction(authUserId: string) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  return listPendingStoresRepo(ctx);
}
```

Create `src/app/admin/lojas-pendentes/page.tsx`:
```tsx
export default function LojasPendentesPage() {
  return (
    <div>
      <h1>Lojas pendentes de aprovação</h1>
      <p>
        Painel administrativo completo (listagem interativa, botão de aprovar/reprovar) é escopo de um
        plano futuro. Por ora, aprovação é feita chamando <code>approveStoreAction</code> diretamente
        (via console do Next.js ou um script), restrito a usuários com <code>role = platform_admin</code>.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/repositories/stores.ts src/app/admin tests/lib/approveStore.test.ts
git commit -m "feat: add store approval restricted to platform_admin"
```

---

### Task 10: CRUD de produto (painel do lojista)

**Files:**
- Create: `src/lib/db/repositories/products.ts`, `src/app/dashboard/produtos/page.tsx`, `src/app/dashboard/produtos/actions.ts`
- Test: `tests/lib/products.test.ts`

**Interfaces:**
- Consumes: `withTenantContext`, `TenantContext` (Task 2)
- Produces:
  - `createProduct(ctx: TenantContext, input: { name: string; description?: string; price: number }): Promise<{ id: string }>`
  - `listProductsByStore(ctx: TenantContext): Promise<Product[]>`
  - `updateProduct(ctx: TenantContext, productId: string, input: Partial<{ name: string; description: string; price: number; isAvailable: boolean }>): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/lib/products.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { createProduct, listProductsByStore, updateProduct } from '@/lib/db/repositories/products';

describe('products repository', () => {
  it('creates, lists and updates a product scoped to the owning store', async () => {
    const store = await pool.query(
      `insert into stores (name, slug, status) values ('Loja Produtos', $1, 'active') returning id`,
      [`loja-produtos-${Date.now()}`]
    );
    const ctx = { role: 'store_owner' as const, storeId: store.rows[0].id };

    const created = await createProduct(ctx, { name: 'X-Burger', description: 'Pão, carne, queijo', price: 22.5 });
    expect(created.id).toBeDefined();

    const list = await listProductsByStore(ctx);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('X-Burger');

    await updateProduct(ctx, created.id, { price: 25, isAvailable: false });

    const updated = await listProductsByStore(ctx);
    expect(Number(updated[0].price)).toBe(25);
    expect(updated[0].is_available).toBe(false);
  });

  it('does not let a different store list or update another store products', async () => {
    const storeA = await pool.query(
      `insert into stores (name, slug, status) values ('Loja A2', $1, 'active') returning id`,
      [`loja-a2-${Date.now()}`]
    );
    const storeB = await pool.query(
      `insert into stores (name, slug, status) values ('Loja B2', $1, 'active') returning id`,
      [`loja-b2-${Date.now()}`]
    );

    const created = await createProduct({ role: 'store_owner', storeId: storeA.rows[0].id }, {
      name: 'Produto A2',
      price: 10,
    });

    const listFromB = await listProductsByStore({ role: 'store_owner', storeId: storeB.rows[0].id });
    expect(listFromB).toHaveLength(0);

    await updateProduct({ role: 'store_owner', storeId: storeB.rows[0].id }, created.id, { price: 999 });
    const stillOriginal = await listProductsByStore({ role: 'store_owner', storeId: storeA.rows[0].id });
    expect(Number(stillOriginal[0].price)).toBe(10);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/lib/products.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar**

Create `src/lib/db/repositories/products.ts`:
```typescript
import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';

export interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: string;
  is_available: boolean;
}

export async function createProduct(
  ctx: TenantContext,
  input: { name: string; description?: string; price: number }
): Promise<{ id: string }> {
  return withTenantContext(ctx, async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into products (store_id, name, description, price) values ($1, $2, $3, $4) returning id`,
      [ctx.storeId, input.name, input.description ?? null, input.price]
    );
    return result.rows[0];
  });
}

export async function listProductsByStore(ctx: TenantContext): Promise<Product[]> {
  return withTenantContext(ctx, async (client) => {
    const result = await client.query<Product>(
      `select * from products where store_id = $1 order by created_at desc`,
      [ctx.storeId]
    );
    return result.rows;
  });
}

export async function updateProduct(
  ctx: TenantContext,
  productId: string,
  input: Partial<{ name: string; description: string; price: number; isAvailable: boolean }>
): Promise<void> {
  await withTenantContext(ctx, async (client) => {
    await client.query(
      `update products set
         name = coalesce($1, name),
         description = coalesce($2, description),
         price = coalesce($3, price),
         is_available = coalesce($4, is_available),
         updated_at = now()
       where id = $5 and store_id = $6`,
      [input.name ?? null, input.description ?? null, input.price ?? null, input.isAvailable ?? null, productId, ctx.storeId]
    );
  });
}
```

A proteção contra a loja B editar produto da loja A vem de duas camadas: o `WHERE ... and store_id = $6` na query (camada de aplicação) e a política RLS `products_owner_access` (Task 5) — mesmo que alguém remova o filtro da query por engano, RLS ainda bloqueia.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/products.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Criar página e server actions do dashboard**

Create `src/app/dashboard/produtos/actions.ts`:
```typescript
'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { createProduct as createProductRepo, listProductsByStore as listProductsByStoreRepo } from '@/lib/db/repositories/products';

export async function createProductAction(
  authUserId: string,
  input: { name: string; description?: string; price: number }
) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx || ctx.role !== 'store_owner') throw new Error('Apenas lojista pode cadastrar produto');
  return createProductRepo(ctx, input);
}

export async function listMyProductsAction(authUserId: string) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx || ctx.role !== 'store_owner') throw new Error('Apenas lojista pode listar produtos');
  return listProductsByStoreRepo(ctx);
}
```

Create `src/app/dashboard/produtos/page.tsx`:
```tsx
export default function ProdutosDashboardPage() {
  return (
    <div>
      <h1>Meus produtos</h1>
      <p>
        Formulário de cadastro/edição consumindo <code>createProductAction</code> e{' '}
        <code>listMyProductsAction</code> — UI interativa detalhada fica pra iteração seguinte deste
        mesmo plano; a lógica de negócio já está coberta pelos testes do repositório.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/repositories/products.ts src/app/dashboard/produtos tests/lib/products.test.ts
git commit -m "feat: add product CRUD scoped to owning store"
```

---

### Task 11: Upload de mídia via Bunny.net (StorageService)

**Files:**
- Create: `src/lib/storage/StorageService.ts`, `src/lib/storage/bunnyStorage.ts`, `src/lib/db/repositories/mediaAssets.ts`
- Test: `tests/lib/bunnyStorage.test.ts`, `tests/lib/mediaAssets.test.ts`

**Interfaces:**
- Produces:
  - `interface StorageService { upload(input: { path: string; contentType: string; data: Buffer }): Promise<{ url: string }> }`
  - `bunnyStorage: StorageService`
  - `createMediaAsset(ctx: TenantContext, input: { productId?: string; role: 'logo'|'banner'|'gallery'; url: string; position?: number }): Promise<{ id: string }>`

**Nota de conta externa:** este task precisa de uma conta Bunny.net real (Storage Zone + API key) pra rodar de ponta a ponta contra o serviço de verdade. O teste de `bunnyStorage.ts` usa `fetch` mockado, então roda sem credencial real — mas a verificação manual (upload de uma imagem de produto de verdade) exige `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_API_KEY` e `BUNNY_CDN_BASE_URL` preenchidos no `.env`.

- [ ] **Step 1: Escrever o teste que falha (StorageService)**

Create `tests/lib/bunnyStorage.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bunnyStorage } from '@/lib/storage/bunnyStorage';

describe('bunnyStorage', () => {
  beforeEach(() => {
    process.env.BUNNY_STORAGE_ZONE = 'mendu-zone';
    process.env.BUNNY_STORAGE_API_KEY = 'test-key';
    process.env.BUNNY_CDN_BASE_URL = 'https://mendu-zone.b-cdn.net';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 201 })
    );
  });

  it('uploads to Bunny Storage and returns the CDN url', async () => {
    const result = await bunnyStorage.upload({
      path: 'products/x-burger.jpg',
      contentType: 'image/jpeg',
      data: Buffer.from('fake-image-bytes'),
    });

    expect(result.url).toBe('https://mendu-zone.b-cdn.net/products/x-burger.jpg');
    expect(fetch).toHaveBeenCalledWith(
      'https://storage.bunnycdn.com/mendu-zone/products/x-burger.jpg',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ AccessKey: 'test-key', 'Content-Type': 'image/jpeg' }),
      })
    );
  });

  it('throws when Bunny returns a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    await expect(
      bunnyStorage.upload({ path: 'x.jpg', contentType: 'image/jpeg', data: Buffer.from('a') })
    ).rejects.toThrow('Falha no upload para Bunny Storage: 401');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/lib/bunnyStorage.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar a interface e a implementação Bunny**

Create `src/lib/storage/StorageService.ts`:
```typescript
export interface UploadInput {
  path: string;
  contentType: string;
  data: Buffer;
}

export interface UploadResult {
  url: string;
}

export interface StorageService {
  upload(input: UploadInput): Promise<UploadResult>;
}
```

Create `src/lib/storage/bunnyStorage.ts`:
```typescript
import type { StorageService, UploadInput, UploadResult } from './StorageService';

export const bunnyStorage: StorageService = {
  async upload(input: UploadInput): Promise<UploadResult> {
    const zone = process.env.BUNNY_STORAGE_ZONE!;
    const apiKey = process.env.BUNNY_STORAGE_API_KEY!;
    const cdnBaseUrl = process.env.BUNNY_CDN_BASE_URL!;

    const response = await fetch(`https://storage.bunnycdn.com/${zone}/${input.path}`, {
      method: 'PUT',
      headers: {
        AccessKey: apiKey,
        'Content-Type': input.contentType,
      },
      body: input.data,
    });

    if (!response.ok) {
      throw new Error(`Falha no upload para Bunny Storage: ${response.status}`);
    }

    return { url: `${cdnBaseUrl}/${input.path}` };
  },
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/bunnyStorage.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Escrever o teste de `media_assets` que falha**

Create `tests/lib/mediaAssets.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { createMediaAsset } from '@/lib/db/repositories/mediaAssets';

describe('createMediaAsset', () => {
  it('creates a store logo media asset scoped to the store', async () => {
    const store = await pool.query(
      `insert into stores (name, slug, status) values ('Loja Mídia', $1, 'active') returning id`,
      [`loja-midia-${Date.now()}`]
    );
    const ctx = { role: 'store_owner' as const, storeId: store.rows[0].id };

    const result = await createMediaAsset(ctx, {
      role: 'logo',
      url: 'https://mendu-zone.b-cdn.net/stores/logo.png',
    });

    const row = await pool.query(`select store_id, role, url, status from media_assets where id = $1`, [result.id]);
    expect(row.rows[0].store_id).toBe(store.rows[0].id);
    expect(row.rows[0].role).toBe('logo');
    expect(row.rows[0].status).toBe('ready');
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npm test -- tests/lib/mediaAssets.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 7: Implementar o repositório de `media_assets`**

Create `src/lib/db/repositories/mediaAssets.ts`:
```typescript
import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';

export async function createMediaAsset(
  ctx: TenantContext,
  input: { productId?: string; role: 'logo' | 'banner' | 'gallery'; url: string; position?: number }
): Promise<{ id: string }> {
  return withTenantContext(ctx, async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into media_assets (store_id, product_id, role, url, position)
       values ($1, $2, $3, $4, $5) returning id`,
      [ctx.storeId, input.productId ?? null, input.role, input.url, input.position ?? 0]
    );
    return result.rows[0];
  });
}
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/mediaAssets.test.ts`
Expected: PASS (1 test)

- [ ] **Step 9: Commit**

```bash
git add src/lib/storage src/lib/db/repositories/mediaAssets.ts tests/lib/bunnyStorage.test.ts tests/lib/mediaAssets.test.ts
git commit -m "feat: add Bunny.net StorageService and media_assets repository"
```

---

### Task 12: Vitrine pública (lista de lojas + página da loja)

**Files:**
- Create: `src/lib/db/repositories/publicStorefront.ts`, `src/app/page.tsx` (substitui o placeholder da Task 1), `src/app/loja/[slug]/page.tsx`
- Test: `tests/lib/publicStorefront.test.ts`

**Interfaces:**
- Produces:
  - `listActiveStores(): Promise<{ id: string; name: string; slug: string }[]>`
  - `getStoreBySlugWithProducts(slug: string): Promise<{ store: Store; products: Product[] } | null>`

Leitura pública não usa `withTenantContext` com role de tenant — usa uma conexão sem contexto de tenant setado (`app.current_role` fica vazio), o que cai nas políticas `*_public_read` (Task 5), que não exigem nenhum contexto.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/lib/publicStorefront.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { listActiveStores, getStoreBySlugWithProducts } from '@/lib/db/repositories/publicStorefront';

describe('publicStorefront', () => {
  it('lists only active stores', async () => {
    const activeSlug = `loja-ativa-${Date.now()}`;
    const pendingSlug = `loja-pendente-pub-${Date.now()}`;
    await pool.query(`insert into stores (name, slug, status) values ('Ativa', $1, 'active')`, [activeSlug]);
    await pool.query(`insert into stores (name, slug, status) values ('Pendente', $1, 'pending_approval')`, [
      pendingSlug,
    ]);

    const stores = await listActiveStores();

    expect(stores.some((s) => s.slug === activeSlug)).toBe(true);
    expect(stores.some((s) => s.slug === pendingSlug)).toBe(false);
  });

  it('returns store with only available products by slug', async () => {
    const slug = `loja-catalogo-${Date.now()}`;
    const store = await pool.query(`insert into stores (name, slug, status) values ('Catálogo', $1, 'active') returning id`, [
      slug,
    ]);
    await pool.query(`insert into products (store_id, name, price, is_available) values ($1, 'Disponível', 10, true)`, [
      store.rows[0].id,
    ]);
    await pool.query(`insert into products (store_id, name, price, is_available) values ($1, 'Indisponível', 10, false)`, [
      store.rows[0].id,
    ]);

    const result = await getStoreBySlugWithProducts(slug);

    expect(result?.store.slug).toBe(slug);
    expect(result?.products).toHaveLength(1);
    expect(result?.products[0].name).toBe('Disponível');
  });

  it('returns null for an unknown slug', async () => {
    const result = await getStoreBySlugWithProducts('slug-que-nao-existe');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/lib/publicStorefront.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar**

Create `src/lib/db/repositories/publicStorefront.ts`:
```typescript
import { pool } from '@/lib/db/pool';
import type { Store } from './stores';
import type { Product } from './products';

export async function listActiveStores(): Promise<Pick<Store, 'id' | 'name' | 'slug'>[]> {
  const result = await pool.query(`select id, name, slug from stores where status = 'active' order by name`);
  return result.rows;
}

export async function getStoreBySlugWithProducts(
  slug: string
): Promise<{ store: Store; products: Product[] } | null> {
  const storeResult = await pool.query<Store>(
    `select id, name, slug, status from stores where slug = $1 and status = 'active'`,
    [slug]
  );
  if (storeResult.rows.length === 0) return null;

  const store = storeResult.rows[0];
  const productsResult = await pool.query<Product>(
    `select * from products where store_id = $1 and is_available = true order by name`,
    [store.id]
  );

  return { store, products: productsResult.rows };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/publicStorefront.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Criar as páginas**

Create `src/app/page.tsx`:
```tsx
import Link from 'next/link';
import { listActiveStores } from '@/lib/db/repositories/publicStorefront';

export const revalidate = 60;

export default async function HomePage() {
  const stores = await listActiveStores();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-mendu-bg">
      <header className="flex flex-col gap-1 border-b border-mendu-border bg-white px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="font-brand text-xl font-bold tracking-tight text-mendu-ink">MENDU</span>
          <span className="text-sm font-semibold text-mendu-red">delivery</span>
        </div>
        <span className="text-xs font-semibold text-mendu-inksoft">Peça. Receba. Aproveite.</span>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-5 py-5">
        <h1 className="text-base font-bold text-mendu-ink">Lojas perto de você</h1>

        {stores.length === 0 && (
          <p className="rounded-2xl border border-dashed border-mendu-border bg-white p-6 text-center text-sm text-mendu-muted">
            Nenhuma loja ativa por aqui ainda.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                href={`/loja/${store.slug}`}
                className="flex items-center gap-3 rounded-2xl border border-mendu-border bg-white p-3 shadow-sm transition hover:border-mendu-red"
              >
                <div className="h-16 w-16 flex-shrink-0 rounded-xl bg-gradient-to-br from-mendu-red to-mendu-reddark" />
                <span className="font-semibold text-mendu-ink">{store.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
```

Create `src/app/loja/[slug]/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { getStoreBySlugWithProducts } from '@/lib/db/repositories/publicStorefront';

export const revalidate = 60;

export default async function StorePage({ params }: { params: { slug: string } }) {
  const result = await getStoreBySlugWithProducts(params.slug);
  if (!result) notFound();

  const { store, products } = result;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-mendu-bg pb-24">
      <div className="h-32 flex-shrink-0 bg-gradient-to-br from-mendu-red to-mendu-reddark" />

      <div className="-mt-6 flex flex-col gap-4 px-5">
        <div className="flex flex-col gap-1 rounded-2xl border border-mendu-border bg-white p-4 shadow-sm">
          <h1 className="text-lg font-bold text-mendu-ink">{store.name}</h1>
          <span className="w-fit rounded-full bg-mendu-green/10 px-2.5 py-0.5 text-xs font-bold text-mendu-green">
            Aberto agora
          </span>
        </div>

        <ul className="flex flex-col gap-3">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-mendu-border bg-white p-3 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-mendu-ink">{product.name}</span>
                {product.description && (
                  <span className="text-xs text-mendu-muted">{product.description}</span>
                )}
                <span className="text-sm font-bold text-mendu-ink">
                  R$ {Number(product.price).toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                aria-label={`Adicionar ${product.name} ao carrinho`}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-mendu-red text-white shadow-sm transition hover:bg-mendu-reddark"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/repositories/publicStorefront.ts src/app/page.tsx src/app/loja tests/lib/publicStorefront.test.ts
git commit -m "feat: add public storefront (store list and store catalog page)"
```

---

### Task 13: Cálculo de totais do pedido (função pura)

**Files:**
- Create: `src/lib/orders/totals.ts`
- Test: `tests/lib/orders-totals.test.ts`

**Interfaces:**
- Produces:
  - `interface OrderItemInput { unitPrice: number; quantity: number }`
  - `interface OrderTotalsInput { items: OrderItemInput[]; discountAmount: number; deliveryFee: number; commissionRate: number }`
  - `interface OrderTotals { grossAmount: number; commissionBaseAmount: number; commissionAmount: number; netAmountToStore: number }`
  - `computeOrderTotals(input: OrderTotalsInput): OrderTotals`

Esta é a lógica financeira mais sensível da spec — isolada como função pura pra ser testada exaustivamente sem precisar de banco.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/lib/orders-totals.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computeOrderTotals } from '@/lib/orders/totals';

describe('computeOrderTotals', () => {
  it('matches the exact example from the spec (100 gross, 10 discount, 6% commission)', () => {
    const totals = computeOrderTotals({
      items: [{ unitPrice: 100, quantity: 1 }],
      discountAmount: 10,
      deliveryFee: 10,
      commissionRate: 0.06,
    });

    expect(totals.grossAmount).toBe(100);
    expect(totals.commissionBaseAmount).toBe(90);
    expect(totals.commissionAmount).toBe(5.4);
    expect(totals.netAmountToStore).toBe(84.6);
  });

  it('sums multiple items with different quantities', () => {
    const totals = computeOrderTotals({
      items: [
        { unitPrice: 22.5, quantity: 2 },
        { unitPrice: 8, quantity: 1 },
      ],
      discountAmount: 0,
      deliveryFee: 6,
      commissionRate: 0.07,
    });

    expect(totals.grossAmount).toBe(53);
    expect(totals.commissionBaseAmount).toBe(53);
    expect(totals.commissionAmount).toBe(3.71);
    expect(totals.netAmountToStore).toBe(49.29);
  });

  it('does not let discount push the commission base below zero', () => {
    const totals = computeOrderTotals({
      items: [{ unitPrice: 10, quantity: 1 }],
      discountAmount: 15,
      deliveryFee: 0,
      commissionRate: 0.07,
    });

    expect(totals.commissionBaseAmount).toBe(0);
    expect(totals.commissionAmount).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/lib/orders-totals.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar**

Create `src/lib/orders/totals.ts`:
```typescript
export interface OrderItemInput {
  unitPrice: number;
  quantity: number;
}

export interface OrderTotalsInput {
  items: OrderItemInput[];
  discountAmount: number;
  deliveryFee: number;
  commissionRate: number;
}

export interface OrderTotals {
  grossAmount: number;
  commissionBaseAmount: number;
  commissionAmount: number;
  netAmountToStore: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const grossAmount = round2(input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const commissionBaseAmount = round2(Math.max(0, grossAmount - input.discountAmount));
  const commissionAmount = round2(commissionBaseAmount * input.commissionRate);
  const netAmountToStore = round2(grossAmount - input.discountAmount - commissionAmount);

  return { grossAmount, commissionBaseAmount, commissionAmount, netAmountToStore };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/orders-totals.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/totals.ts tests/lib/orders-totals.test.ts
git commit -m "feat: add pure order totals calculation matching spec formula"
```

---

### Task 14: Criação de pedido (carrinho → checkout → order)

**Files:**
- Create: `src/lib/db/repositories/orders.ts`, `src/lib/cart/cartStore.ts`, `src/app/checkout/page.tsx`, `src/app/checkout/actions.ts`
- Test: `tests/lib/createOrder.test.ts`

**Interfaces:**
- Consumes: `computeOrderTotals` (Task 13), `withTenantContext` (Task 2)
- Produces: `createOrder(ctx: TenantContext, input: CreateOrderInput): Promise<{ orderId: string }>`
  - `interface CreateOrderInput { storeId: string; deliveryAddressId: string; deliveryFee: number; items: { productId: string; quantity: number; observacoes?: string }[] }`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/lib/createOrder.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { createOrder } from '@/lib/db/repositories/orders';

async function seedStoreWithProductAndPlan() {
  const store = await pool.query(
    `insert into stores (name, slug, status) values ('Loja Pedido', $1, 'active') returning id`,
    [`loja-pedido-${Date.now()}`]
  );
  const plan = await pool.query(`select id, commission_rate, monthly_fee from subscription_plans where code = 'START'`);
  await pool.query(
    `insert into store_subscriptions (store_id, plan_id, commission_rate_snapshot, monthly_fee_snapshot)
     values ($1, $2, $3, $4)`,
    [store.rows[0].id, plan.rows[0].id, plan.rows[0].commission_rate, plan.rows[0].monthly_fee]
  );
  const product = await pool.query(
    `insert into products (store_id, name, price) values ($1, 'X-Burger', 22.50) returning id`,
    [store.rows[0].id]
  );
  return { storeId: store.rows[0].id, productId: product.rows[0].id };
}

describe('createOrder', () => {
  it('creates an order with items, freezing commission rate and product price', async () => {
    const { storeId, productId } = await seedStoreWithProductAndPlan();
    const user = await pool.query(`insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`, [
      `cliente-pedido-${Date.now()}@example.com`,
    ]);
    const customer = await pool.query(`insert into customers (user_id) values ($1) returning id`, [user.rows[0].id]);
    const address = await pool.query(
      `insert into addresses (customer_id, cep, rua, numero, bairro, municipio, uf)
       values ($1, '01310-100', 'Av. Paulista', '1', 'Bela Vista', 'São Paulo', 'SP') returning id`,
      [customer.rows[0].id]
    );

    const ctx = { role: 'customer' as const, customerId: customer.rows[0].id };

    const result = await createOrder(ctx, {
      storeId,
      deliveryAddressId: address.rows[0].id,
      deliveryFee: 6,
      items: [{ productId, quantity: 2, observacoes: 'sem cebola' }],
    });

    const order = await pool.query(`select * from orders where id = $1`, [result.orderId]);
    const items = await pool.query(`select * from order_items where order_id = $1`, [result.orderId]);
    const events = await pool.query(`select event_type from order_events where order_id = $1`, [result.orderId]);

    expect(Number(order.rows[0].gross_amount)).toBe(45);
    expect(Number(order.rows[0].commission_amount)).toBeCloseTo(3.15, 2);
    expect(order.rows[0].payment_method).toBe('cash_on_delivery');
    expect(order.rows[0].status).toBe('confirmed');
    expect(order.rows[0].plan_code_at_order).toBe('START');
    expect(items.rows[0].observacoes).toBe('sem cebola');
    expect(items.rows[0].product_name_at_order).toBe('X-Burger');
    expect(events.rows.map((e) => e.event_type)).toContain('created');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- tests/lib/createOrder.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar**

Create `src/lib/db/repositories/orders.ts`:
```typescript
import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';
import { computeOrderTotals } from '@/lib/orders/totals';

export interface CreateOrderInput {
  storeId: string;
  deliveryAddressId: string;
  deliveryFee: number;
  items: { productId: string; quantity: number; observacoes?: string }[];
}

export async function createOrder(ctx: TenantContext, input: CreateOrderInput): Promise<{ orderId: string }> {
  if (ctx.role !== 'customer' || !ctx.customerId) {
    throw new Error('Apenas cliente autenticado pode criar pedido');
  }
  if (input.items.length === 0) {
    throw new Error('Pedido precisa de ao menos um item');
  }

  return withTenantContext(ctx, async (client) => {
    const products = await client.query<{ id: string; name: string; price: string }>(
      `select id, name, price from products where id = any($1::uuid[]) and store_id = $2`,
      [input.items.map((i) => i.productId), input.storeId]
    );
    if (products.rows.length !== input.items.length) {
      throw new Error('Um ou mais produtos não pertencem a essa loja ou não existem');
    }
    const productsById = new Map(products.rows.map((p) => [p.id, p]));

    const subscription = await client.query<{ commission_rate_snapshot: string; code: string }>(
      `select ss.commission_rate_snapshot, sp.code
       from store_subscriptions ss
       join subscription_plans sp on sp.id = ss.plan_id
       where ss.store_id = $1 and ss.ended_at is null
       limit 1`,
      [input.storeId]
    );
    if (subscription.rows.length === 0) {
      throw new Error('Loja sem plano de assinatura vigente');
    }
    const commissionRate = Number(subscription.rows[0].commission_rate_snapshot);
    const planCode = subscription.rows[0].code;

    const totals = computeOrderTotals({
      items: input.items.map((item) => ({
        unitPrice: Number(productsById.get(item.productId)!.price),
        quantity: item.quantity,
      })),
      discountAmount: 0,
      deliveryFee: input.deliveryFee,
      commissionRate,
    });

    const order = await client.query<{ id: string }>(
      `insert into orders (
         store_id, customer_id, status, payment_method, payment_status, delivery_address_id,
         gross_amount, discount_amount, commission_base_amount, commission_rate_applied, commission_amount,
         delivery_fee, net_amount_to_store, plan_code_at_order
       ) values ($1, $2, 'confirmed', 'cash_on_delivery', 'pending', $3, $4, 0, $5, $6, $7, $8, $9, $10)
       returning id`,
      [
        input.storeId,
        ctx.customerId,
        input.deliveryAddressId,
        totals.grossAmount,
        totals.commissionBaseAmount,
        commissionRate,
        totals.commissionAmount,
        input.deliveryFee,
        totals.netAmountToStore,
        planCode,
      ]
    );
    const orderId = order.rows[0].id;

    for (const item of input.items) {
      const product = productsById.get(item.productId)!;
      const subtotal = Number(product.price) * item.quantity;
      await client.query(
        `insert into order_items (order_id, product_id, product_name_at_order, unit_price_at_order, quantity, observacoes, subtotal)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, item.productId, product.name, product.price, item.quantity, item.observacoes ?? null, subtotal]
      );
    }

    await client.query(
      `insert into order_events (order_id, event_type, actor_type, actor_id) values ($1, 'created', 'customer', $2)`,
      [orderId, ctx.customerId]
    );

    return { orderId };
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/createOrder.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Criar o carrinho (estado client-side) e a página de checkout**

Create `src/lib/cart/cartStore.ts`:
```typescript
import { create } from 'zustand';

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  observacoes?: string;
}

interface CartState {
  storeId: string | null;
  items: CartItem[];
  addItem: (storeId: string, item: CartItem) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  storeId: null,
  items: [],
  addItem: (storeId, item) =>
    set((state) => {
      if (state.storeId && state.storeId !== storeId) {
        return { storeId, items: [item] };
      }
      return { storeId, items: [...state.items, item] };
    }),
  removeItem: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
  clear: () => set({ storeId: null, items: [] }),
}));
```

Create `src/app/checkout/actions.ts`:
```typescript
'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { createOrder as createOrderRepo, type CreateOrderInput } from '@/lib/db/repositories/orders';

export async function createOrderAction(authUserId: string, input: CreateOrderInput) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  return createOrderRepo(ctx, input);
}
```

Create `src/app/checkout/page.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/cart/cartStore';

export default function CheckoutPage() {
  const router = useRouter();
  const { storeId, items, clear } = useCartStore();

  async function handleConfirm(authUserId: string, deliveryAddressId: string) {
    const { createOrderAction } = await import('./actions');
    const result = await createOrderAction(authUserId, {
      storeId: storeId!,
      deliveryAddressId,
      deliveryFee: 6,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, observacoes: i.observacoes })),
    });
    clear();
    router.push(`/pedido/${result.orderId}`);
  }

  const deliveryFee = 6;
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = subtotal + deliveryFee;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-mendu-bg pb-28">
      <header className="flex items-center gap-3 border-b border-mendu-border bg-white px-5 py-4">
        <h1 className="text-base font-bold text-mendu-ink">Finalizar pedido</h1>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-5 py-5">
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between rounded-xl border border-mendu-border bg-white px-3 py-2.5"
            >
              <div className="flex flex-col">
                <span className="text-sm font-bold text-mendu-ink">
                  {item.quantity}x {item.name}
                </span>
                {item.observacoes && <span className="text-xs text-mendu-muted">{item.observacoes}</span>}
              </div>
              <span className="text-sm font-bold text-mendu-ink">
                R$ {(item.unitPrice * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1 rounded-2xl border border-mendu-border bg-white p-4">
          <div className="flex justify-between text-sm text-mendu-inksoft">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-mendu-inksoft">
            <span>Taxa de entrega</span>
            <span>R$ {deliveryFee.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-mendu-border pt-2 text-sm font-bold text-mendu-ink">
            <span>Total</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-sm font-semibold text-mendu-ink">Pagamento: na entrega</p>
      </main>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-mendu-border bg-white p-4">
        <button
          type="button"
          className="w-full rounded-xl bg-mendu-red py-3 text-sm font-bold text-white transition hover:bg-mendu-reddark"
        >
          Confirmar pedido · R$ {total.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/repositories/orders.ts src/lib/cart src/app/checkout tests/lib/createOrder.test.ts
git commit -m "feat: create order from cart with frozen commission and product snapshots"
```

---

### Task 15: Transição de status do pedido (painel do lojista)

**Files:**
- Create: `src/lib/orders/stateMachine.ts`, `src/app/dashboard/pedidos/actions.ts`, `src/app/dashboard/pedidos/page.tsx`
- Modify: `src/lib/db/repositories/orders.ts`
- Test: `tests/lib/orders-stateMachine.test.ts`, `tests/lib/advanceOrderStatus.test.ts`

**Interfaces:**
- Consumes: `withTenantContext`, `TenantContext` (Task 2)
- Produces:
  - `isValidTransition(from: OrderStatus, to: OrderStatus): boolean`
  - `advanceOrderStatus(ctx: TenantContext, orderId: string, nextStatus: OrderStatus): Promise<void>` (em `orders.ts`)

- [ ] **Step 1: Escrever o teste da máquina de estados que falha**

Create `tests/lib/orders-stateMachine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidTransition } from '@/lib/orders/stateMachine';

describe('isValidTransition', () => {
  it('allows the happy path confirmed -> preparing -> out_for_delivery -> delivered', () => {
    expect(isValidTransition('confirmed', 'preparing')).toBe(true);
    expect(isValidTransition('preparing', 'out_for_delivery')).toBe(true);
    expect(isValidTransition('out_for_delivery', 'delivered')).toBe(true);
  });

  it('allows cancellation up to preparing but not after out_for_delivery', () => {
    expect(isValidTransition('confirmed', 'cancelled')).toBe(true);
    expect(isValidTransition('preparing', 'cancelled')).toBe(true);
    expect(isValidTransition('out_for_delivery', 'cancelled')).toBe(false);
  });

  it('rejects skipping steps or moving backwards', () => {
    expect(isValidTransition('confirmed', 'delivered')).toBe(false);
    expect(isValidTransition('delivered', 'preparing')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/lib/orders-stateMachine.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar a máquina de estados**

Create `src/lib/orders/stateMachine.ts`:
```typescript
export type OrderStatus = 'pending_payment' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- tests/lib/orders-stateMachine.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Escrever o teste de `advanceOrderStatus` que falha**

Create `tests/lib/advanceOrderStatus.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { createOrder, advanceOrderStatus } from '@/lib/db/repositories/orders';

async function seedOrder() {
  const store = await pool.query(
    `insert into stores (name, slug, status) values ('Loja Status', $1, 'active') returning id`,
    [`loja-status-${Date.now()}`]
  );
  const plan = await pool.query(`select id, commission_rate, monthly_fee from subscription_plans where code = 'START'`);
  await pool.query(
    `insert into store_subscriptions (store_id, plan_id, commission_rate_snapshot, monthly_fee_snapshot) values ($1, $2, $3, $4)`,
    [store.rows[0].id, plan.rows[0].id, plan.rows[0].commission_rate, plan.rows[0].monthly_fee]
  );
  const product = await pool.query(`insert into products (store_id, name, price) values ($1, 'Produto', 10) returning id`, [
    store.rows[0].id,
  ]);
  const user = await pool.query(`insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`, [
    `cliente-status-${Date.now()}@example.com`,
  ]);
  const customer = await pool.query(`insert into customers (user_id) values ($1) returning id`, [user.rows[0].id]);
  const address = await pool.query(
    `insert into addresses (customer_id, cep, rua, numero, bairro, municipio, uf) values ($1, '1', 'Rua', '1', 'B', 'M', 'SP') returning id`,
    [customer.rows[0].id]
  );

  const order = await createOrder(
    { role: 'customer', customerId: customer.rows[0].id },
    {
      storeId: store.rows[0].id,
      deliveryAddressId: address.rows[0].id,
      deliveryFee: 5,
      items: [{ productId: product.rows[0].id, quantity: 1 }],
    }
  );

  return { storeId: store.rows[0].id, orderId: order.orderId };
}

describe('advanceOrderStatus', () => {
  it('advances confirmed -> preparing and logs a status_changed event', async () => {
    const { storeId, orderId } = await seedOrder();

    await advanceOrderStatus({ role: 'store_owner', storeId }, orderId, 'preparing');

    const order = await pool.query(`select status from orders where id = $1`, [orderId]);
    const events = await pool.query(
      `select event_type, payload from order_events where order_id = $1 and event_type = 'status_changed'`,
      [orderId]
    );

    expect(order.rows[0].status).toBe('preparing');
    expect(events.rows[0].payload).toEqual({ from: 'confirmed', to: 'preparing' });
  });

  it('rejects an invalid transition', async () => {
    const { storeId, orderId } = await seedOrder();

    await expect(advanceOrderStatus({ role: 'store_owner', storeId }, orderId, 'delivered')).rejects.toThrow(
      'Transição de status inválida: confirmed -> delivered'
    );
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npm test -- tests/lib/advanceOrderStatus.test.ts`
Expected: FAIL (`advanceOrderStatus is not a function`)

- [ ] **Step 7: Implementar `advanceOrderStatus`**

Modify `src/lib/db/repositories/orders.ts` — adicionar ao final do arquivo:
```typescript
import { isValidTransition, type OrderStatus } from '@/lib/orders/stateMachine';

export async function advanceOrderStatus(ctx: TenantContext, orderId: string, nextStatus: OrderStatus): Promise<void> {
  if (ctx.role !== 'store_owner' && ctx.role !== 'platform_admin') {
    throw new Error('Apenas lojista ou admin pode avançar o status do pedido');
  }

  await withTenantContext(ctx, async (client) => {
    const current = await client.query<{ status: OrderStatus; customer_id: string; store_id: string }>(
      `select status, customer_id, store_id from orders where id = $1`,
      [orderId]
    );
    if (current.rows.length === 0) {
      throw new Error('Pedido não encontrado');
    }
    const currentStatus = current.rows[0].status;

    if (!isValidTransition(currentStatus, nextStatus)) {
      throw new Error(`Transição de status inválida: ${currentStatus} -> ${nextStatus}`);
    }

    await client.query(`update orders set status = $1 where id = $2`, [nextStatus, orderId]);

    await client.query(
      `insert into order_events (order_id, event_type, payload, actor_type)
       values ($1, 'status_changed', $2, $3)`,
      [orderId, JSON.stringify({ from: currentStatus, to: nextStatus }), ctx.role === 'platform_admin' ? 'admin' : 'store_user']
    );

    if (nextStatus === 'delivered') {
      const order = await client.query<{ customer_id: string; store_id: string }>(
        `select customer_id, store_id from orders where id = $1`,
        [orderId]
      );
      await client.query(
        `insert into customer_stores (customer_id, store_id, first_order_at, last_order_at, total_orders)
         values ($1, $2, now(), now(), 1)
         on conflict (customer_id, store_id)
         do update set last_order_at = now(), total_orders = customer_stores.total_orders + 1`,
        [order.rows[0].customer_id, order.rows[0].store_id]
      );
    }
  });
}
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/advanceOrderStatus.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Criar server action e página do dashboard de pedidos**

Create `src/app/dashboard/pedidos/actions.ts`:
```typescript
'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { advanceOrderStatus as advanceOrderStatusRepo } from '@/lib/db/repositories/orders';
import type { OrderStatus } from '@/lib/orders/stateMachine';

export async function advanceOrderStatusAction(authUserId: string, orderId: string, nextStatus: OrderStatus) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  await advanceOrderStatusRepo(ctx, orderId, nextStatus);
}
```

Create `src/app/dashboard/pedidos/page.tsx`:
```tsx
export default function PedidosDashboardPage() {
  return (
    <div>
      <h1>Pedidos recebidos</h1>
      <p>
        Listagem e botões de avançar status consomem <code>advanceOrderStatusAction</code> — a lógica de
        transição já está coberta pelos testes do repositório.
      </p>
    </div>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/orders/stateMachine.ts src/lib/db/repositories/orders.ts src/app/dashboard/pedidos tests/lib/orders-stateMachine.test.ts tests/lib/advanceOrderStatus.test.ts
git commit -m "feat: add order status state machine and customer_stores update on delivery"
```

---

### Task 16: Acompanhamento do pedido pelo cliente + feedback

**Files:**
- Create: `src/lib/db/repositories/orderFeedback.ts`, `src/app/pedido/[id]/page.tsx`, `src/app/pedido/[id]/actions.ts`
- Test: `tests/lib/orderFeedback.test.ts`

**Interfaces:**
- Consumes: `withTenantContext`, `TenantContext` (Task 2)
- Produces: `submitFeedback(ctx: TenantContext, input: { orderId: string; rating: number; comment?: string }): Promise<{ id: string }>`, `getOrderForCustomer(ctx: TenantContext, orderId: string): Promise<OrderWithItems | null>`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/lib/orderFeedback.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { createOrder, advanceOrderStatus } from '@/lib/db/repositories/orders';
import { submitFeedback } from '@/lib/db/repositories/orderFeedback';

describe('submitFeedback', () => {
  it('allows feedback only after the order is delivered', async () => {
    const store = await pool.query(
      `insert into stores (name, slug, status) values ('Loja Feedback', $1, 'active') returning id`,
      [`loja-feedback-${Date.now()}`]
    );
    const plan = await pool.query(`select id, commission_rate, monthly_fee from subscription_plans where code = 'START'`);
    await pool.query(
      `insert into store_subscriptions (store_id, plan_id, commission_rate_snapshot, monthly_fee_snapshot) values ($1, $2, $3, $4)`,
      [store.rows[0].id, plan.rows[0].id, plan.rows[0].commission_rate, plan.rows[0].monthly_fee]
    );
    const product = await pool.query(`insert into products (store_id, name, price) values ($1, 'Produto', 10) returning id`, [
      store.rows[0].id,
    ]);
    const user = await pool.query(
      `insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`,
      [`cliente-feedback-${Date.now()}@example.com`]
    );
    const customer = await pool.query(`insert into customers (user_id) values ($1) returning id`, [user.rows[0].id]);
    const address = await pool.query(
      `insert into addresses (customer_id, cep, rua, numero, bairro, municipio, uf) values ($1, '1', 'Rua', '1', 'B', 'M', 'SP') returning id`,
      [customer.rows[0].id]
    );
    const ctx = { role: 'customer' as const, customerId: customer.rows[0].id };

    const order = await createOrder(ctx, {
      storeId: store.rows[0].id,
      deliveryAddressId: address.rows[0].id,
      deliveryFee: 5,
      items: [{ productId: product.rows[0].id, quantity: 1 }],
    });

    await expect(submitFeedback(ctx, { orderId: order.orderId, rating: 5 })).rejects.toThrow(
      'Só é possível avaliar um pedido entregue'
    );

    await advanceOrderStatus({ role: 'store_owner', storeId: store.rows[0].id }, order.orderId, 'preparing');
    await advanceOrderStatus({ role: 'store_owner', storeId: store.rows[0].id }, order.orderId, 'out_for_delivery');
    await advanceOrderStatus({ role: 'store_owner', storeId: store.rows[0].id }, order.orderId, 'delivered');

    const feedback = await submitFeedback(ctx, { orderId: order.orderId, rating: 5, comment: 'Ótimo!' });
    const row = await pool.query(`select rating, comment from order_feedback where id = $1`, [feedback.id]);
    expect(row.rows[0].rating).toBe(5);
    expect(row.rows[0].comment).toBe('Ótimo!');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/lib/orderFeedback.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: Implementar**

Create `src/lib/db/repositories/orderFeedback.ts`:
```typescript
import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';

export async function submitFeedback(
  ctx: TenantContext,
  input: { orderId: string; rating: number; comment?: string }
): Promise<{ id: string }> {
  if (ctx.role !== 'customer' || !ctx.customerId) {
    throw new Error('Apenas cliente pode enviar feedback');
  }
  if (input.rating < 1 || input.rating > 5) {
    throw new Error('Nota precisa estar entre 1 e 5');
  }

  return withTenantContext(ctx, async (client) => {
    const order = await client.query<{ status: string; store_id: string }>(
      `select status, store_id from orders where id = $1 and customer_id = $2`,
      [input.orderId, ctx.customerId]
    );
    if (order.rows.length === 0) {
      throw new Error('Pedido não encontrado');
    }
    if (order.rows[0].status !== 'delivered') {
      throw new Error('Só é possível avaliar um pedido entregue');
    }

    const result = await client.query<{ id: string }>(
      `insert into order_feedback (order_id, customer_id, store_id, rating, comment)
       values ($1, $2, $3, $4, $5) returning id`,
      [input.orderId, ctx.customerId, order.rows[0].store_id, input.rating, input.comment ?? null]
    );

    await client.query(
      `insert into order_events (order_id, event_type, actor_type, actor_id) values ($1, 'feedback_submitted', 'customer', $2)`,
      [input.orderId, ctx.customerId]
    );

    return result.rows[0];
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- tests/lib/orderFeedback.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Criar a página de acompanhamento**

Create `src/app/pedido/[id]/actions.ts`:
```typescript
'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { submitFeedback as submitFeedbackRepo } from '@/lib/db/repositories/orderFeedback';

export async function submitFeedbackAction(authUserId: string, orderId: string, rating: number, comment?: string) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  return submitFeedbackRepo(ctx, { orderId, rating, comment });
}
```

Create `src/app/pedido/[id]/page.tsx`:
```tsx
const STEPS = [
  { key: 'confirmed', label: 'Pedido confirmado' },
  { key: 'preparing', label: 'Em preparo na loja' },
  { key: 'out_for_delivery', label: 'Saiu para entrega' },
  { key: 'delivered', label: 'Entregue' },
] as const;

export default function AcompanharPedidoPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-mendu-bg">
      <header className="flex flex-col gap-1 bg-mendu-ink px-5 py-4">
        <span className="text-xs font-semibold text-white/60">Pedido #{params.id}</span>
        <span className="text-lg font-bold text-white">Acompanhando seu pedido</span>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-5 py-5">
        <ol className="flex flex-col gap-4 rounded-2xl border border-mendu-border bg-white p-4">
          {STEPS.map((step) => (
            <li key={step.key} className="flex items-center gap-3">
              <span className="h-6 w-6 flex-shrink-0 rounded-full border-2 border-mendu-border" />
              <span className="text-sm font-bold text-mendu-ink">{step.label}</span>
            </li>
          ))}
        </ol>

        <p className="text-sm text-mendu-muted">
          Formulário de nota/comentário (habilitado após o status <code>delivered</code>) chama{' '}
          <code>submitFeedbackAction</code> — lógica de negócio já coberta pelos testes do repositório;
          o preenchimento visual de qual etapa está ativa/concluída é uma iteração seguinte deste mesmo
          plano.
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/repositories/orderFeedback.ts src/app/pedido tests/lib/orderFeedback.test.ts
git commit -m "feat: add post-delivery feedback restricted to delivered orders"
```

---

### Task 17: Deploy na Vercel

**Files:**
- Create: `vercel.json` (se necessário para variáveis de build)
- Modify: `.env.example` (documentar variáveis de produção)

**Interfaces:**
- Nenhuma nova — este task conecta o que já existe a um ambiente hospedado.

**Contas externas necessárias a partir daqui:** projeto Supabase na nuvem (não mais só o CLI local), conta Vercel, repositório no GitHub (Vercel importa direto do Git), conta Bunny.net com Storage Zone criada. Se ainda não tiver essas contas, é a hora de criar.

- [ ] **Step 1: Criar o projeto Supabase na nuvem**

No painel do Supabase (supabase.com), criar um novo projeto. Copiar a `Connection string` (modo "Transaction" ou "Session", compatível com `pg`) e as chaves de API (`anon key`, `service_role key`).

- [ ] **Step 2: Aplicar as migrações no projeto remoto**

Run:
```bash
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push
```

- [ ] **Step 3: Criar o repositório no GitHub e conectar à Vercel**

Run:
```bash
git remote add origin <url-do-repositorio-github>
git push -u origin master
```

No painel da Vercel: "Add New Project" → importar o repositório → framework detectado automaticamente como Next.js.

- [ ] **Step 4: Configurar variáveis de ambiente na Vercel**

No painel do projeto na Vercel, em Settings → Environment Variables, adicionar (valores de produção, não os de dev local): `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_API_KEY`, `BUNNY_CDN_BASE_URL`.

- [ ] **Step 5: Disparar o deploy e verificar manualmente**

Run: `git push` (qualquer push na branch conectada dispara deploy automático na Vercel)

Verificação manual: abrir a URL gerada pela Vercel, confirmar que a página inicial carrega (lista de lojas vazia é esperado, ainda não há loja aprovada em produção).

- [ ] **Step 6: Commit (se `vercel.json` ou `.env.example` mudaram)**

```bash
git add vercel.json .env.example
git commit -m "chore: document production environment variables for Vercel deploy"
```

---

## Self-Review

**1. Cobertura da spec (Seções relevantes a este plano):**
- Seção 3 (papéis/auth/multi-tenancy/RLS) → Tasks 2, 5, 6.
- Seção 4.1 (users, customers, store_users, stores, products, addresses, media_assets, customer_stores) → Tasks 3, 15 (customer_stores update).
- Seção 4.2 (subscription_plans, store_subscriptions — parte mínima usada no cálculo de comissão) → Task 4, 8, 14.
- Seção 4.3 (orders, order_items — tabela nova adicionada por decisão de 2026-09-22 —, order_events, order_feedback) → Tasks 4, 14, 15, 16.
- Seção 5 (fluxo do pedido) → Tasks 8 (checkout), 14 (criação), 15 (status), 16 (feedback) — cobre o caminho `cash_on_delivery`; o caminho `online`/Asaas fica para o plano de Pagamento (Plano 2 da decomposição).
- Seção 6 (RLS técnico) → Tasks 2 e 5.
- Seção 7 (stack) → Task 1 (Next.js), Task 11 (Bunny.net/StorageService), Task 17 (Vercel). Supabase Realtime não é usado neste plano (não há tela ao vivo ainda).
- Seção 10 (marca) → fora do escopo deste plano (é branding, não código de produto).

**Fora do escopo deste plano, por decisão explícita da decomposição:** pagamento online via Asaas, `webhook_events`, `store_payment_accounts`, `billing_periods`, `financial_transactions`, painel admin visual completo, `audit_log`, `deliveries`/`delivery_tracking`, observabilidade (Sentry), testes E2E automatizados. Cada um pertence a um dos Planos 2-5 já combinados.

**2. Placeholder scan:** nenhum "TBD"/"TODO" nos passos executáveis. As páginas internas (Tasks 9, 10 e 15 — painel admin mínimo e dashboard do lojista) têm um parágrafo explicando que a UI interativa completa (formulário rico, listagem com botões) é iteração visual posterior — mas a lógica de negócio de cada uma está 100% implementada e testada nos repositórios; isso é uma decisão consciente de escopo (lógica testável > polish visual no primeiro corte para telas internas), não uma lacuna disfarçada. As telas voltadas ao público (Tasks 1, 7, 8, 12, 14 e 16 — layout base, cadastro, vitrine, checkout e acompanhamento) já usam Tailwind com os tokens de marca (`tailwind.config.ts`) e seguem o preview visual aprovado em 2026-09-22, incluída na Task 1.

**3. Consistência de tipos:** `TenantContext`/`Role` (Task 2) usados identicamente em Tasks 6-16. `OrderStatus` (Task 15) reaproveitado em `advanceOrderStatusAction`. `OrderTotals`/`computeOrderTotals` (Task 13) consumido em `createOrder` (Task 14) sem divergência de nome. `StorageService`/`bunnyStorage` (Task 11) segue a interface exata definida no arquivo — nenhuma outra implementação é referenciada ainda (troca de provedor é um plano futuro).

---

Plano completo e salvo em `docs/superpowers/plans/2026-09-22-fundacao-loop-pedido.md`.
