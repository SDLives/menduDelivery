import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';

export interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: string;
  is_available: boolean;
}

export async function createProduct(
  ctx: TenantContext,
  input: { name: string; description?: string; price: number }
): Promise<{ id: string }> {
  return withTenantContext(ctx, async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into products (store_id, name, description, price) values ($1, $2, $3, $4) returning id`,
      [ctx.storeId, input.name, input.description ?? null, input.price]
    );
    return result.rows[0];
  });
}

export async function listProductsByStore(ctx: TenantContext): Promise<Product[]> {
  return withTenantContext(ctx, async (client) => {
    const result = await client.query<Product>(
      `select * from products where store_id = $1 order by created_at desc`,
      [ctx.storeId]
    );
    return result.rows;
  });
}

export async function updateProduct(
  ctx: TenantContext,
  productId: string,
  input: Partial<{ name: string; description: string; price: number; isAvailable: boolean }>
): Promise<void> {
  await withTenantContext(ctx, async (client) => {
    await client.query(
      `update products set
         name = coalesce($1, name),
         description = coalesce($2, description),
         price = coalesce($3, price),
         is_available = coalesce($4, is_available),
         updated_at = now()
       where id = $5 and store_id = $6`,
      [input.name ?? null, input.description ?? null, input.price ?? null, input.isAvailable ?? null, productId, ctx.storeId]
    );
  });
}
