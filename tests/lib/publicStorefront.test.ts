import { describe, it, expect } from 'vitest';
import { withTenantContext } from '@/lib/db/tenantContext';
import { listActiveStores, getStoreBySlugWithProducts } from '@/lib/db/repositories/publicStorefront';

describe('publicStorefront', () => {
  it('lists only active stores', async () => {
    const activeSlug = `loja-ativa-${Date.now()}`;
    const pendingSlug = `loja-pendente-pub-${Date.now()}`;
    await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`insert into stores (name, slug, status) values ('Ativa', $1, 'active')`, [activeSlug])
    );
    await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`insert into stores (name, slug, status) values ('Pendente', $1, 'pending_approval')`, [
        pendingSlug,
      ])
    );

    const stores = await listActiveStores();

    expect(stores.some((s) => s.slug === activeSlug)).toBe(true);
    expect(stores.some((s) => s.slug === pendingSlug)).toBe(false);
  });

  it('returns store with only available products by slug', async () => {
    const slug = `loja-catalogo-${Date.now()}`;
    const store = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`insert into stores (name, slug, status) values ('Catálogo', $1, 'active') returning id`, [slug])
    );
    await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`insert into products (store_id, name, price, is_available) values ($1, 'Disponível', 10, true)`, [
        store.rows[0].id,
      ])
    );
    await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into products (store_id, name, price, is_available) values ($1, 'Indisponível', 10, false)`,
        [store.rows[0].id]
      )
    );

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
