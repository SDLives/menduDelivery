'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/cart/cartStore';
import { supabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { buscarCep } from '@/lib/cep';
import { maskCEP, maskUF } from '@/lib/masks';

const inputClass =
  'rounded-xl border border-mendu-border px-3 py-2.5 text-sm outline-none focus:border-mendu-red';

export default function CheckoutPage() {
  const router = useRouter();
  const { storeId, items, clear } = useCartStore();
  const [address, setAddress] = useState({
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cepAviso, setCepAviso] = useState<string | null>(null);

  function updateAddress<K extends keyof typeof address>(key: K, value: string) {
    setAddress((a) => ({ ...a, [key]: value }));
  }

  async function handleCepBlur() {
    setCepAviso(null);
    const endereco = await buscarCep(address.cep);
    if (!endereco) {
      if (address.cep.replace(/\D/g, '').length === 8) {
        setCepAviso('CEP não encontrado, preencha o endereço manualmente.');
      }
      return;
    }
    setAddress((a) => ({ ...a, rua: endereco.rua, bairro: endereco.bairro, municipio: endereco.municipio, uf: endereco.uf }));
  }

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabaseBrowserClient().auth.getUser();
      if (!user) {
        throw new Error('Faça login para finalizar o pedido');
      }

      const { createAddressAction, createOrderAction } = await import('./actions');
      const createdAddress = await createAddressAction(user.id, {
        cep: address.cep,
        rua: address.rua,
        numero: address.numero,
        complemento: address.complemento || undefined,
        bairro: address.bairro,
        municipio: address.municipio,
        uf: address.uf,
      });

      const result = await createOrderAction(user.id, {
        storeId: storeId!,
        deliveryAddressId: createdAddress.id,
        deliveryFee: 6,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, observacoes: i.observacoes })),
      });

      clear();
      router.push(`/pedido/${result.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao confirmar pedido');
    } finally {
      setSubmitting(false);
    }
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

        <div className="flex flex-col gap-2 rounded-2xl border border-mendu-border bg-white p-4">
          <h2 className="text-sm font-bold text-mendu-ink">Endereço de entrega</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              className={`${inputClass} col-span-2`}
              placeholder="CEP"
              value={address.cep}
              onChange={(e) => updateAddress('cep', maskCEP(e.target.value))}
              onBlur={handleCepBlur}
              required
            />
            {cepAviso && <p className="col-span-2 -mt-1 text-xs font-semibold text-mendu-gold">{cepAviso}</p>}
            <input
              className={`${inputClass} col-span-2`}
              placeholder="Rua"
              value={address.rua}
              onChange={(e) => updateAddress('rua', e.target.value)}
              required
            />
            <input
              className={inputClass}
              placeholder="Número"
              value={address.numero}
              onChange={(e) => updateAddress('numero', e.target.value)}
              required
            />
            <input
              className={inputClass}
              placeholder="Complemento"
              value={address.complemento}
              onChange={(e) => updateAddress('complemento', e.target.value)}
            />
            <input
              className={`${inputClass} col-span-2`}
              placeholder="Bairro"
              value={address.bairro}
              onChange={(e) => updateAddress('bairro', e.target.value)}
              required
            />
            <input
              className={inputClass}
              placeholder="Município"
              value={address.municipio}
              onChange={(e) => updateAddress('municipio', e.target.value)}
              required
            />
            <input
              className={inputClass}
              maxLength={2}
              placeholder="UF"
              value={address.uf}
              onChange={(e) => updateAddress('uf', maskUF(e.target.value))}
              required
            />
          </div>
        </div>

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

        {error && <p className="text-sm font-semibold text-mendu-red">{error}</p>}
      </main>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-mendu-border bg-white p-4">
        <button
          type="button"
          disabled={submitting || items.length === 0}
          onClick={handleConfirm}
          className="w-full rounded-xl bg-mendu-red py-3 text-sm font-bold text-white transition hover:bg-mendu-reddark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Confirmando...' : `Confirmar pedido · R$ ${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
