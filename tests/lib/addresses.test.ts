import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { withTenantContext } from '@/lib/db/tenantContext';
import { createAddressForCustomer } from '@/lib/db/repositories/addresses';

describe('createAddressForCustomer', () => {
  it('creates an address scoped to the customer', async () => {
    const user = await pool.query(
      `insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`,
      [`cliente-endereco-${Date.now()}@example.com`]
    );
    const customer = await pool.query(`insert into customers (user_id) values ($1) returning id`, [user.rows[0].id]);
    const ctx = { role: 'customer' as const, customerId: customer.rows[0].id };

    const result = await createAddressForCustomer(ctx, {
      cep: '01310-100',
      rua: 'Av. Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      municipio: 'São Paulo',
      uf: 'SP',
    });

    const row = await withTenantContext(ctx, (client) =>
      client.query(`select customer_id, cep, rua, numero, bairro, municipio, uf from addresses where id = $1`, [
        result.id,
      ])
    );

    expect(row.rows[0].customer_id).toBe(customer.rows[0].id);
    expect(row.rows[0].cep).toBe('01310-100');
    expect(row.rows[0].rua).toBe('Av. Paulista');
  });

  it('rejects when the context is not a customer', async () => {
    await expect(
      createAddressForCustomer(
        { role: 'store_owner', storeId: '11111111-1111-1111-1111-111111111111' },
        { cep: '1', rua: 'Rua', numero: '1', bairro: 'B', municipio: 'M', uf: 'SP' }
      )
    ).rejects.toThrow('Apenas cliente autenticado pode cadastrar endereço');
  });
});
