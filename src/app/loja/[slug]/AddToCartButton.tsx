'use client';

import { useCartStore } from '@/lib/cart/cartStore';

export function AddToCartButton({
  storeId,
  productId,
  name,
  unitPrice,
}: {
  storeId: string;
  productId: string;
  name: string;
  unitPrice: number;
}) {
  const addItem = useCartStore((state) => state.addItem);

  return (
    <button
      type="button"
      aria-label={`Adicionar ${name} ao carrinho`}
      onClick={() => addItem(storeId, { productId, name, unitPrice, quantity: 1 })}
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-mendu-red text-white shadow-sm transition hover:bg-mendu-reddark"
    >
      +
    </button>
  );
}
