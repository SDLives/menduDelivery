import { describe, it, expect } from 'vitest';
import { pool } from '@/lib/db/pool';
import { withTenantContext } from '@/lib/db/tenantContext';
import { createOrder, advanceOrderStatus } from '@/lib/db/repositories/orders';
import { submitFeedback } from '@/lib/db/repositories/orderFeedback';

describe('submitFeedback', () => {
  it('allows feedback only after the order is delivered', async () => {
    const store = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into stores (name, slug, status) values ('Loja Feedback', $1, 'active') returning id`,
        [`loja-feedback-${Date.now()}`]
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
    const user = await pool.query(
      `insert into users (id, email, role) values (gen_random_uuid(), $1, 'customer') returning id`,
      [`cliente-feedback-${Date.now()}@example.com`]
    );
    const customer = await pool.query(`insert into customers (user_id) values ($1) returning id`, [user.rows[0].id]);
    const address = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(
        `insert into addresses (customer_id, cep, rua, numero, bairro, municipio, uf) values ($1, '1', 'Rua', '1', 'B', 'M', 'SP') returning id`,
        [customer.rows[0].id]
      )
    );
    const ctx = { role: 'customer' as const, customerId: customer.rows[0].id };

    const order = await createOrder(ctx, {
      storeId: store.rows[0].id,
      deliveryAddressId: address.rows[0].id,
      deliveryFee: 5,
      items: [{ productId: product.rows[0].id, quantity: 1 }],
    });

    await expect(submitFeedback(ctx, { orderId: order.orderId, rating: 5 })).rejects.toThrow(
      'Só é possível avaliar um pedido entregue'
    );

    await advanceOrderStatus({ role: 'store_owner', storeId: store.rows[0].id }, order.orderId, 'preparing');
    await advanceOrderStatus({ role: 'store_owner', storeId: store.rows[0].id }, order.orderId, 'out_for_delivery');
    await advanceOrderStatus({ role: 'store_owner', storeId: store.rows[0].id }, order.orderId, 'delivered');

    const feedback = await submitFeedback(ctx, { orderId: order.orderId, rating: 5, comment: 'Ótimo!' });
    const row = await withTenantContext({ role: 'platform_admin' }, (client) =>
      client.query(`select rating, comment from order_feedback where id = $1`, [feedback.id])
    );
    expect(row.rows[0].rating).toBe(5);
    expect(row.rows[0].comment).toBe('Ótimo!');
  });
});
