'use client';

import { useCartStore } from '@/lib/cart/cartStore';

// O clique em "Confirmar pedido" ainda não está ligado a `createOrderAction`
// (src/app/checkout/actions.ts): o plano não cobre nem leitura de sessão do
// cliente no browser nem cadastro/seleção de endereço de entrega — sem um
// deliveryAddressId real, chamar a action aqui só resultaria em erro. Fica
// pra próxima iteração deste plano, junto com essas duas peças que faltam.
export default function CheckoutPage() {
  const { items } = useCartStore();

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
          disabled
          className="w-full cursor-not-allowed rounded-xl bg-mendu-red py-3 text-sm font-bold text-white opacity-50"
        >
          Confirmar pedido · R$ {total.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
