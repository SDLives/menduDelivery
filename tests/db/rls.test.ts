import { describe, it, expect, beforeAll } from 'vitest';
import { withTenantContext } from '@/lib/db/tenantContext';

let storeAId: string;
let storeBId: string;

beforeAll(async () => {
  // Setup runs as platform_admin (which bypasses these RLS policies by design)
  // because the app's own DB connection (mendu_app) does NOT bypass RLS
  // (see Task 2 Ruling 2) — a bare pool.query() with no tenant context set
  // would be blocked by stores_owner_access/products_owner_access's WITH
  // CHECK clause on INSERT. This mirrors the fix applied to Tasks 3/4's
  // test files and does not change what this test verifies.
  await withTenantContext({ role: 'platform_admin' }, async (client) => {
    const a = await client.query(
      `insert into stores (name, slug, status) values ('Loja A', $1, 'active') returning id`,
      [`loja-a-${Date.now()}`]
    );
    const b = await client.query(
      `insert into stores (name, slug, status) values ('Loja B', $1, 'active') returning id`,
      [`loja-b-${Date.now()}`]
    );
    storeAId = a.rows[0].id;
    storeBId = b.rows[0].id;

    await client.query(
      `insert into products (store_id, name, price, is_available) values ($1, 'Produto A', 10, false)`,
      [storeAId]
    );
  });
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
