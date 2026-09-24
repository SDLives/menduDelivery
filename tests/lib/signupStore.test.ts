import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { withTenantContext } from '@/lib/db/tenantContext';
import { signupStore } from '@/app/(auth)/cadastro/loja/actions';
import { supabaseAdminClient } from '@/lib/supabaseServerClient';

describe('signupStore', () => {
  it('creates store, owner link, address and a default START subscription', async () => {
    const email = `lojista-${Date.now()}@example.com`;

    const result = await signupStore({
      email,
      password: 'senha-forte-123',
      storeName: 'Hamburgueria do Zé',
      storeSlug: `hamburgueria-do-ze-${Date.now()}`,
      address: {
        cep: '01310-100',
        rua: 'Av. Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        municipio: 'São Paulo',
        uf: 'SP',
      },
    });

    // stores has RLS (owner/admin-scoped, see supabase/migrations/0003_rls.sql); a
    // pending_approval store is not covered by stores_public_read, so this read-back
    // must run as platform_admin, the same authorized bypass tests/db/rls.test.ts uses.
    const store = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`select status, address_id from stores where id = $1`, [result.storeId])
    );
    const storeUser = await pool.query(
      `select role_in_store from store_users where store_id = $1 and user_id = $2`,
      [result.storeId, result.userId]
    );
    const subscription = await pool.query(
      `select sp.code from store_subscriptions ss join subscription_plans sp on sp.id = ss.plan_id
       where ss.store_id = $1 and ss.ended_at is null`,
      [result.storeId]
    );

    expect(store.rows[0].status).toBe('pending_approval');
    expect(store.rows[0].address_id).not.toBeNull();
    expect(storeUser.rows[0].role_in_store).toBe('owner');
    expect(subscription.rows[0].code).toBe('START');
  });

  it('cleans up Auth user if database transaction fails', async () => {
    const slug = `colisao-slug-${Date.now()}`;

    // Pre-insert a store with this slug (as platform_admin, bypassing RLS via tenant context)
    // to force a unique constraint violation when signupStore tries to insert.
    await withTenantContext({ role: 'platform_admin' }, async (client) => {
      await client.query(`insert into stores (name, slug, status) values ('Loja Colisão', $1, 'pending_approval')`, [
        slug,
      ]);
    });

    const email = `lojista-colisao-${Date.now()}@example.com`;

    // Try to call signupStore with the same slug.
    // This will create an Auth user, but fail on database insert due to the slug uniqueness constraint.
    await expect(
      signupStore({
        email,
        password: 'senha-forte-123',
        storeName: 'Outra Loja',
        storeSlug: slug,
        address: {
          cep: '01310-100',
          rua: 'Av. Paulista',
          numero: '1000',
          bairro: 'Bela Vista',
          municipio: 'São Paulo',
          uf: 'SP',
        },
      })
    ).rejects.toThrow();

    // Verify the Auth user was cleaned up and no longer exists
    const supabase = supabaseAdminClient();
    const { data: result } = await supabase.auth.admin.listUsers();

    if (result?.users) {
      const authUser = result.users.find((u) => u.email === email);
      expect(authUser).toBeUndefined();
    }

    // Clean up the placeholder store (bare pool.query would be rejected by
    // stores_owner_access's USING clause, so this also runs as platform_admin)
    await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`delete from stores where slug = $1`, [slug])
    );
  });
});
