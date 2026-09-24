import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { withTenantContext } from '@/lib/db/tenantContext';
import { createProduct, listProductsByStore, updateProduct } from '@/lib/db/repositories/products';

describe('products repository', () => {
  it('creates, lists and updates a product scoped to the owning store', async () => {
    const store = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into stores (name, slug, status) values ('Loja Produtos', $1, 'active') returning id`,
        [`loja-produtos-${Date.now()}`]
      )
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
    const storeA = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into stores (name, slug, status) values ('Loja A2', $1, 'active') returning id`,
        [`loja-a2-${Date.now()}`]
      )
    );
    const storeB = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into stores (name, slug, status) values ('Loja B2', $1, 'active') returning id`,
        [`loja-b2-${Date.now()}`]
      )
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
