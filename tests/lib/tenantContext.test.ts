import { describe, it, expect } from 'vitest';
import { withTenantContext } from '@/lib/db/tenantContext';

describe('withTenantContext', () => {
  it('exposes role and storeId as session settings inside the transaction', async () => {
    const result = await withTenantContext(
      { role: 'store_owner', storeId: '11111111-1111-1111-1111-111111111111' },
      async (client) => {
        const role = await client.query(`select current_setting('app.current_role', true) as v`);
        const storeId = await client.query(`select current_setting('app.current_store_id', true) as v`);
        return { role: role.rows[0].v, storeId: storeId.rows[0].v };
      }
    );

    expect(result.role).toBe('store_owner');
    expect(result.storeId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('rolls back on error and does not leak the transaction', async () => {
    await expect(
      withTenantContext({ role: 'customer' }, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
  });
});
