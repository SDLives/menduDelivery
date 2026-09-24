import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';

describe('commerce schema', () => {
  it('seeds the four commercial plans from the spec', async () => {
    const result = await pool.query(
      `select code, commission_rate, monthly_fee from subscription_plans order by code`
    );
    const byCode = Object.fromEntries(result.rows.map((r) => [r.code, r]));

    expect(Number(byCode.START.commission_rate)).toBeCloseTo(0.07);
    expect(Number(byCode.START.monthly_fee)).toBe(0);
    expect(Number(byCode.PRO.commission_rate)).toBeCloseTo(0.06);
    expect(Number(byCode.BUSINESS.commission_rate)).toBeCloseTo(0.05);
    expect(byCode.ENTERPRISE.commission_rate).toBeNull();
  });

  it('creates an order with items and events end to end', async () => {
    const client = await pool.connect();
    try {
      const user = await client.query(
        `insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`,
        [`cliente-${Date.now()}@example.com`]
      );
      const customer = await client.query(`insert into customers (user_id) values ($1) returning id`, [
        user.rows[0].id,
      ]);
      const store = await client.query(
        `insert into stores (name, slug, status) values ('Pizzaria Teste', $1, 'active') returning id`,
        [`pizzaria-teste-${Date.now()}`]
      );
      const plan = await client.query(`select id, commission_rate from subscription_plans where code = 'START'`);
      const subscription = await client.query(
        `insert into store_subscriptions (store_id, plan_id, commission_rate_snapshot, monthly_fee_snapshot)
         values ($1, $2, $3, 0) returning id`,
        [store.rows[0].id, plan.rows[0].id, plan.rows[0].commission_rate]
      );
      const address = await client.query(
        `insert into addresses (customer_id, cep, rua, numero, bairro, municipio, uf)
         values ($1, '01310-100', 'Av. Paulista', '2000', 'Bela Vista', 'São Paulo', 'SP') returning id`,
        [customer.rows[0].id]
      );
      const product = await client.query(
        `insert into products (store_id, name, price) values ($1, 'Pizza Margherita', 40.00) returning id`,
        [store.rows[0].id]
      );

      const order = await client.query(
        `insert into orders (
           store_id, customer_id, status, payment_method, payment_status, delivery_address_id,
           gross_amount, discount_amount, commission_base_amount, commission_rate_applied, commission_amount,
           delivery_fee, net_amount_to_store, plan_code_at_order
         ) values ($1, $2, 'confirmed', 'cash_on_delivery', 'pending', $3, 40.00, 0, 40.00, 0.07, 2.80, 6.00, 37.20, 'START')
         returning id`,
        [store.rows[0].id, customer.rows[0].id, address.rows[0].id]
      );

      await client.query(
        `insert into order_items (order_id, product_id, product_name_at_order, unit_price_at_order, quantity, subtotal)
         values ($1, $2, 'Pizza Margherita', 40.00, 1, 40.00)`,
        [order.rows[0].id, product.rows[0].id]
      );

      await client.query(
        `insert into order_events (order_id, event_type, actor_type) values ($1, 'created', 'customer')`,
        [order.rows[0].id]
      );

      const items = await client.query(`select * from order_items where order_id = $1`, [order.rows[0].id]);
      const events = await client.query(`select * from order_events where order_id = $1`, [order.rows[0].id]);

      expect(items.rows).toHaveLength(1);
      expect(events.rows).toHaveLength(1);
      expect(subscription.rows[0].id).toBeDefined();
    } finally {
      client.release();
    }
  });
});
