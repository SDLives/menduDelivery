import { pool } from '@/lib/db/pool';
import type { Role, TenantContext } from '@/lib/db/tenantContext';

export interface SessionContext extends TenantContext {
  userId: string;
}

export async function resolveSessionContext(authUserId: string): Promise<SessionContext | null> {
  const userResult = await pool.query<{ role: Role }>(`select role from users where id = $1`, [authUserId]);
  if (userResult.rows.length === 0) return null;

  const role = userResult.rows[0].role;

  if (role === 'customer') {
    const customer = await pool.query<{ id: string }>(`select id from customers where user_id = $1`, [authUserId]);
    return { userId: authUserId, role, customerId: customer.rows[0]?.id, storeId: undefined };
  }

  if (role === 'store_owner') {
    const storeUser = await pool.query<{ store_id: string }>(
      `select store_id from store_users where user_id = $1 limit 1`,
      [authUserId]
    );
    return { userId: authUserId, role, storeId: storeUser.rows[0]?.store_id, customerId: undefined };
  }

  return { userId: authUserId, role, storeId: undefined, customerId: undefined };
}
