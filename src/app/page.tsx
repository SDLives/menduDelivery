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
