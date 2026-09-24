import { describe, it, expect } from 'vitest';
import { withTenantContext } from '@/lib/db/tenantContext';
import { createMediaAsset } from '@/lib/db/repositories/mediaAssets';

describe('createMediaAsset', () => {
  it('creates a store logo media asset scoped to the store', async () => {
    const store = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into stores (name, slug, status) values ('Loja Mídia', $1, 'active') returning id`,
        [`loja-midia-${Date.now()}`]
      )
    );
    const ctx = { role: 'store_owner' as const, storeId: store.rows[0].id };

    const result = await createMediaAsset(ctx, {
      role: 'logo',
      url: 'https://mendu-zone.b-cdn.net/stores/logo.png',
    });

    const row = await withTenantContext(ctx, (client) =>
      client.query(`select store_id, role, url, status from media_assets where id = $1`, [result.id])
    );
    expect(row.rows[0].store_id).toBe(store.rows[0].id);
    expect(row.rows[0].role).toBe('logo');
    expect(row.rows[0].status).toBe('ready');
  });
});
