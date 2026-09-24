'use server';

import { z } from 'zod';
import { pool } from '@/lib/db/pool';
import { supabaseAdminClient } from '@/lib/supabaseServerClient';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

export type SignupCustomerInput = z.infer<typeof signupSchema>;

export async function signupCustomer(
  input: SignupCustomerInput
): Promise<{ userId: string; customerId: string }> {
  const parsed = signupSchema.parse(input);

  const supabase = supabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário no Supabase Auth: ${error?.message}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`insert into users (id, email, role, phone) values ($1, $2, 'customer', $3)`, [
      data.user.id,
      parsed.email,
      parsed.phone ?? null,
    ]);
    const customer = await client.query(`insert into customers (user_id) values ($1) returning id`, [
      data.user.id,
    ]);
    await client.query('COMMIT');
    return { userId: data.user.id, customerId: customer.rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    // Best-effort cleanup: delete the Auth user to avoid orphaned state
    try {
      await supabase.auth.admin.deleteUser(data.user.id);
    } catch (cleanupErr) {
      // Log cleanup failure but don't mask the original error
      console.error(`Failed to delete orphaned Auth user ${data.user.id}:`, cleanupErr);
    }
    throw err;
  } finally {
    client.release();
  }
}
