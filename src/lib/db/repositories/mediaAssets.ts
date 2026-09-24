import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';

export async function createMediaAsset(
  ctx: TenantContext,
  input: { productId?: string; role: 'logo' | 'banner' | 'gallery'; url: string; position?: number }
): Promise<{ id: string }> {
  return withTenantContext(ctx, async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into media_assets (store_id, product_id, role, url, position)
       values ($1, $2, $3, $4, $5) returning id`,
      [ctx.storeId, input.productId ?? null, input.role, input.url, input.position ?? 0]
    );
    return result.rows[0];
  });
}
