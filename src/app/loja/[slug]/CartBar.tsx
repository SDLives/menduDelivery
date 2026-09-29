'use client';

import Link from 'next/link';
import { useCartStore } from '@/lib/cart/cartStore';

export function CartBar() {
  const items = useCartStore((state) => state.items);

  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-mendu-border bg-white p-4">
      <Link
        href="/checkout"
        className="flex w-full items-center justify-between rounded-xl bg-mendu-red px-4 py-3 text-sm font-bold text-white transition hover:bg-mendu-reddark"
      >
        <span>
          Ver carrinho · {items.length} {items.length === 1 ? 'item' : 'itens'}
        </span>
        <span>R$ {total.toFixed(2)}</span>
      </Link>
    </div>
  );
}
