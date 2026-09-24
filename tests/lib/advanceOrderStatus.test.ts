import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { withTenantContext } from '@/lib/db/tenantContext';
import { createOrder, advanceOrderStatus } from '@/lib/db/repositories/orders';

async function seedOrder() {
  const store = await withTenantContext({ role: 'platform_admin' }, (client) =>
    client.query(
      `insert into stores (name, slug, status) values ('Loja Status', $1, 'active') returning id`,
      [`loja-status-${Date.now()}`]
    )
  );
  const plan = await pool.query(`select id, commission_rate, monthly_fee from subscription_plans where code = 'START'`);
  await pool.query(
    `insert into store_subscriptions (store_id, plan_id, commission_rate_snapshot, monthly_fee_snapshot) values ($1, $2, $3, $4)`,
    [store.rows[0].id, plan.rows[0].id, plan.rows[0].commission_rate, plan.rows[0].monthly_fee]
  );
  const product = await withTenantContext({ role: 'platform_admin' }, (client) =>
    client.query(`insert into products (store_id, name, price) values ($1, 'Produto', 10) returning id`, [
      store.rows[0].id,
    ])
  );
  const user = await pool.query(`insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`, [
    `cliente-status-${Date.now()}@example.com`,
  ]);
  const customer = await pool.query(`insert into customers (user_id) values ($1) returning id`, [user.rows[0].id]);
  const address = await withTenantContext({ role: 'platform_admin' }, (client) =>
    client.query(
      `insert into addresses (customer_id, cep, rua, numero, bairro, municipio, uf) values ($1, '1', 'Rua', '1', 'B', 'M', 'SP') returning id`,
      [customer.rows[0].id]
    )
  );

  const order = await createOrder(
    { role: 'customer', customerId: customer.rows[0].id },
    {
      storeId: store.rows[0].id,
      deliveryAddressId: address.rows[0].id,
      deliveryFee: 5,
      items: [{ productId: product.rows[0].id, quantity: 1 }],
    }
  );

  return { storeId: store.rows[0].id, orderId: order.orderId };
}

describe('advanceOrderStatus', () => {
  it('advances confirmed -> preparing and logs a status_changed event', async () => {
    const { storeId, orderId } = await seedOrder();

    await advanceOrderStatus({ role: 'store_owner', storeId }, orderId, 'preparing');

    const order = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`select status from orders where id = $1`, [orderId])
    );
    const events = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `select event_type, payload from order_events where order_id = $1 and event_type = 'status_changed'`,
        [orderId]
      )
    );

    expect(order.rows[0].status).toBe('preparing');
    expect(events.rows[0].payload).toEqual({ from: 'confirmed', to: 'preparing' });
  });

  it('rejects an invalid transition', async () => {
    const { storeId, orderId } = await seedOrder();

    await expect(advanceOrderStatus({ role: 'store_owner', storeId }, orderId, 'delivered')).rejects.toThrow(
      'Transição de status inválida: confirmed -> delivered'
    );
  });
});
