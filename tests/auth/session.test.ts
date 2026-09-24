import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { withTenantContext } from '@/lib/db/tenantContext';
import { resolveSessionContext } from '@/lib/auth/session';

describe('resolveSessionContext', () => {
  it('resolves a customer session with customerId set', async () => {
    const authUserId = crypto.randomUUID();
    let customerId: string;

    // Setup test data with platform_admin role to bypass RLS
    await withTenantContext({ role: 'platform_admin' }, async (client) => {
      await client.query(`insert into users (id, email, role) values ($1, $2, 'customer')`, [
        authUserId,
        `cliente-${authUserId}@example.com`,
      ]);
      const customer = await client.query(`insert into customers (user_id) values ($1) returning id`, [authUserId]);
      customerId = customer.rows[0].id;
    });

    // Test resolveSessionContext with bare pool
    const ctx = await resolveSessionContext(authUserId);

    expect(ctx).toEqual({
      userId: authUserId,
      role: 'customer',
      customerId,
      storeId: undefined,
    });
  });

  it('resolves a store_owner session with storeId set', async () => {
    const authUserId = crypto.randomUUID();
    let storeId: string;

    // Setup test data with platform_admin role to bypass RLS
    await withTenantContext({ role: 'platform_admin' }, async (client) => {
      await client.query(`insert into users (id, email, role) values ($1, $2, 'store_owner')`, [
        authUserId,
        `lojista-${authUserId}@example.com`,
      ]);
      const store = await client.query(
        `insert into stores (name, slug) values ('Loja Sessão', $1) returning id`,
        [`loja-sessao-${authUserId}`]
      );
      storeId = store.rows[0].id;
      await client.query(`insert into store_users (store_id, user_id, role_in_store) values ($1, $2, 'owner')`, [
        storeId,
        authUserId,
      ]);
    });

    // Test resolveSessionContext with bare pool
    const ctx = await resolveSessionContext(authUserId);

    expect(ctx?.role).toBe('store_owner');
    expect(ctx?.storeId).toBe(storeId);
  });

  it('returns null for an unknown user id', async () => {
    const ctx = await resolveSessionContext(crypto.randomUUID());
    expect(ctx).toBeNull();
  });
});
