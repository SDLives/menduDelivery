const STEPS = [
  { key: 'confirmed', label: 'Pedido confirmado' },
  { key: 'preparing', label: 'Em preparo na loja' },
  { key: 'out_for_delivery', label: 'Saiu para entrega' },
  { key: 'delivered', label: 'Entregue' },
] as const;

export default async function AcompanharPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-mendu-bg">
      <header className="flex flex-col gap-1 bg-mendu-ink px-5 py-4">
        <span className="text-xs font-semibold text-white/60">Pedido #{id}</span>
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
