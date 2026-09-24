import { describe, it, expect, beforeAll } from 'vitest';
import { pool } from '@/lib/db/pool';

describe('core identity and store schema', () => {
  it('creates a store, a store_owner user, and an address respecting the ownership check', async () => {
    const client = await pool.connect();
    try {
      const user = await client.query(
        `insert into users (id, email, role) values (gen_random_uuid(), $1, 'store_owner') returning id`,
        [`lojista-${Date.now()}@example.com`]
      );
      const userId = user.rows[0].id;

      const store = await client.query(
        `insert into stores (name, slug, status) values ($1, $2, 'pending_approval') returning id`,
        ['Hamburgueria do Zé', `hamburgueria-do-ze-${Date.now()}`]
      );
      const storeId = store.rows[0].id;

      await client.query(
        `insert into store_users (store_id, user_id, role_in_store) values ($1, $2, 'owner')`,
        [storeId, userId]
      );

      const address = await client.query(
        `insert into addresses (store_id, cep, rua, numero, bairro, municipio, uf)
         values ($1, '01310-100', 'Av. Paulista', '1000', 'Bela Vista', 'São Paulo', 'SP')
         returning id`,
        [storeId]
      );

      await client.query(`update stores set address_id = $1 where id = $2`, [address.rows[0].id, storeId]);

      const result = await client.query(`select address_id from stores where id = $1`, [storeId]);
      expect(result.rows[0].address_id).toBe(address.rows[0].id);
    } finally {
      client.release();
    }
  });

  it('rejects an address with both customer_id and store_id set', async () => {
    const client = await pool.connect();
    try {
      const user = await client.query(
        `insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`,
        [`cliente-${Date.now()}@example.com`]
      );
      const customer = await client.query(
        `insert into customers (user_id) values ($1) returning id`,
        [user.rows[0].id]
      );
      const store = await client.query(
        `insert into stores (name, slug) values ('Loja X', $1) returning id`,
        [`loja-x-${Date.now()}`]
      );

      await expect(
        client.query(
          `insert into addresses (customer_id, store_id, cep, rua, numero, bairro, municipio, uf)
           values ($1, $2, '01310-100', 'Av. Paulista', '1', 'Bela Vista', 'São Paulo', 'SP')`,
          [customer.rows[0].id, store.rows[0].id]
        )
      ).rejects.toThrow();
    } finally {
      client.release();
    }
  });
});
