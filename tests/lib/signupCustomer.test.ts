import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { signupCustomer } from '@/app/(auth)/cadastro/cliente/actions';

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
});
