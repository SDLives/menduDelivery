import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { signupCustomer } from '@/app/(auth)/cadastro/cliente/actions';
import { supabaseAdminClient } from '@/lib/supabaseServerClient';

describe('signupCustomer', () => {
  it('creates a users row (role=customer) and a customers row linked to it', async () => {
    const email = `cliente-${Date.now()}@example.com`;

    const result = await signupCustomer({ email, password: 'senha-forte-123', phone: '11999998888' });

    const user = await pool.query(`select role, phone from users where id = $1`, [result.userId]);
    const customer = await pool.query(`select user_id from customers where id = $1`, [result.customerId]);

    expect(user.rows[0].role).toBe('customer');
    expect(user.rows[0].phone).toBe('11999998888');
    expect(customer.rows[0].user_id).toBe(result.userId);
  });

  it('cleans up Auth user if database transaction fails', async () => {
    const email = `collision-${Date.now()}@example.com`;

    // Generate a placeholder UUID using Postgres
    const placeholderResult = await pool.query(`select gen_random_uuid() as id`);
    const placeholderId = placeholderResult.rows[0].id;

    // Pre-insert a users row with this email to force a constraint violation
    // when signupCustomer tries to insert
    await pool.query(
      `insert into users (id, email, role, phone) values ($1, $2, 'customer', $3)`,
      [placeholderId, email, null]
    );

    // Try to call signupCustomer with the same email
    // This will create an Auth user, but fail on database insert due to email uniqueness constraint
    await expect(signupCustomer({ email, password: 'senha-forte-123' })).rejects.toThrow();

    // Verify the Auth user was cleaned up and no longer exists
    const supabase = supabaseAdminClient();
    const { data: result } = await supabase.auth.admin.listUsers();

    if (result?.users) {
      const authUser = result.users.find(u => u.email === email);
      expect(authUser).toBeUndefined();
    }

    // Clean up the placeholder user
    await pool.query(`delete from users where id = $1`, [placeholderId]);
  });
});
