import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { withTenantContext } from '@/lib/db/tenantContext';
import { approveStore, listPendingStores } from '@/lib/db/repositories/stores';

describe('approveStore', () => {
  it('sets status to active, approved_by and approved_at when called by platform_admin', async () => {
    const admin = await pool.query(`insert into users (id, email, role) values (gen_random_uuid(), $1, 'platform_admin') returning id`, [
      `admin-${Date.now()}@example.com`,
    ]);

    // stores has RLS, so we need to wrap the insert in withTenantContext
    const storeResult = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into stores (name, slug, status) values ('Loja Pendente', $1, 'pending_approval') returning id`,
        [`loja-pendente-${Date.now()}`]
      )
    );
    const storeId = storeResult.rows[0].id;

    await approveStore({ role: 'platform_admin' }, storeId, admin.rows[0].id);

    // Read-back from stores also needs withTenantContext due to RLS
    const result = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`select status, approved_by, approved_at from stores where id = $1`, [storeId])
    );
    expect(result.rows[0].status).toBe('active');
    expect(result.rows[0].approved_by).toBe(admin.rows[0].id);
    expect(result.rows[0].approved_at).not.toBeNull();
  });

  it('rejects the call when the actor is not platform_admin', async () => {
    // stores has RLS, so we need to wrap the insert in withTenantContext
    const storeResult = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into stores (name, slug, status) values ('Loja X', $1, 'pending_approval') returning id`,
        [`loja-x-${Date.now()}`]
      )
    );

    await expect(approveStore({ role: 'customer' }, storeResult.rows[0].id, crypto.randomUUID())).rejects.toThrow(
      'Apenas platform_admin pode aprovar lojas'
    );
  });

  it('lists only pending stores', async () => {
    const slug = `loja-pendente-listagem-${Date.now()}`;

    // stores has RLS, so we need to wrap the insert in withTenantContext
    await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`insert into stores (name, slug, status) values ('Loja Listagem', $1, 'pending_approval')`, [slug])
    );

    const pending = await listPendingStores({ role: 'platform_admin' });

    expect(pending.some((s) => s.slug === slug)).toBe(true);
    expect(pending.every((s) => s.status === 'pending_approval')).toBe(true);
  });
});
