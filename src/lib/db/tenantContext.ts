import type { PoolClient } from 'pg';
import { pool } from './pool';

export type Role = 'customer' | 'store_owner' | 'platform_admin' | 'courier';

export interface TenantContext {
  role: Role;
  storeId?: string;
  customerId?: string;
}

export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`select set_config('app.current_role', $1, true)`, [ctx.role]);
    await client.query(`select set_config('app.current_store_id', $1, true)`, [ctx.storeId ?? '']);
    await client.query(`select set_config('app.current_customer_id', $1, true)`, [ctx.customerId ?? '']);

    const result = await fn(client);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
