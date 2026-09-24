import { notFound } from 'next/navigation';
import { getStoreBySlugWithProducts } from '@/lib/db/repositories/publicStorefront';

export const revalidate = 60;

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getStoreBySlugWithProducts(slug);
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
