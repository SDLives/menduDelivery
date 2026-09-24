import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';

export interface Store {
  id: string;
  name: string;
  slug: string;
  status: 'pending_approval' | 'active' | 'rejected' | 'suspended';
}

export async function approveStore(ctx: TenantContext, storeId: string, approvedByUserId: string): Promise<void> {
  if (ctx.role !== 'platform_admin') {
    throw new Error('Apenas platform_admin pode aprovar lojas');
  }

  await withTenantContext(ctx, async (client) => {
    await client.query(
      `update stores set status = 'active', approved_by = $1, approved_at = now() where id = $2`,
      [approvedByUserId, storeId]
    );
  });
}

export async function listPendingStores(ctx: TenantContext): Promise<Store[]> {
  if (ctx.role !== 'platform_admin') {
    throw new Error('Apenas platform_admin pode listar lojas pendentes');
  }

  return withTenantContext(ctx, async (client) => {
    const result = await client.query<Store>(
      `select id, name, slug, status from stores where status = 'pending_approval' order by created_at`
    );
    return result.rows;
  });
}
