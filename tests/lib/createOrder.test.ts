import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { withTenantContext } from '@/lib/db/tenantContext';
import { createOrder } from '@/lib/db/repositories/orders';

async function seedStoreWithProductAndPlan() {
  const store = await withTenantContext({ role: 'platform_admin' }, (client) =>
    client.query(
      `insert into stores (name, slug, status) values ('Loja Pedido', $1, 'active') returning id`,
      [`loja-pedido-${Date.now()}`]
    )
  );
  const plan = await pool.query(`select id, commission_rate, monthly_fee from subscription_plans where code = 'START'`);
  await pool.query(
    `insert into store_subscriptions (store_id, plan_id, commission_rate_snapshot, monthly_fee_snapshot)
     values ($1, $2, $3, $4)`,
    [store.rows[0].id, plan.rows[0].id, plan.rows[0].commission_rate, plan.rows[0].monthly_fee]
  );
  const product = await withTenantContext({ role: 'platform_admin' }, (client) =>
    client.query(`insert into products (store_id, name, price) values ($1, 'X-Burger', 22.50) returning id`, [
      store.rows[0].id,
    ])
  );
  return { storeId: store.rows[0].id, productId: product.rows[0].id };
}

describe('createOrder', () => {
  it('creates an order with items, freezing commission rate and product price', async () => {
    const { storeId, productId } = await seedStoreWithProductAndPlan();
    const user = await pool.query(`insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`, [
      `cliente-pedido-${Date.now()}@example.com`,
    ]);
    const customer = await pool.query(`insert into customers (user_id) values ($1) returning id`, [user.rows[0].id]);
    const address = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into addresses (customer_id, cep, rua, numero, bairro, municipio, uf)
         values ($1, '01310-100', 'Av. Paulista', '1', 'Bela Vista', 'São Paulo', 'SP') returning id`,
        [customer.rows[0].id]
      )
    );

    const ctx = { role: 'customer' as const, customerId: customer.rows[0].id };

    const result = await createOrder(ctx, {
      storeId,
      deliveryAddressId: address.rows[0].id,
      deliveryFee: 6,
      items: [{ productId, quantity: 2, observacoes: 'sem cebola' }],
    });

    const order = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`select * from orders where id = $1`, [result.orderId])
    );
    const items = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`select * from order_items where order_id = $1`, [result.orderId])
    );
    const events = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`select event_type from order_events where order_id = $1`, [result.orderId])
    );

    expect(Number(order.rows[0].gross_amount)).toBe(45);
    expect(Number(order.rows[0].commission_amount)).toBeCloseTo(3.15, 2);
    expect(order.rows[0].payment_method).toBe('cash_on_delivery');
    expect(order.rows[0].status).toBe('confirmed');
    expect(order.rows[0].plan_code_at_order).toBe('START');
    expect(items.rows[0].observacoes).toBe('sem cebola');
    expect(items.rows[0].product_name_at_order).toBe('X-Burger');
    expect(events.rows.map((e) => e.event_type)).toContain('created');
  });
});
