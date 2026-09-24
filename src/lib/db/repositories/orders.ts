import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';
import { computeOrderTotals } from '@/lib/orders/totals';
import { isValidTransition, type OrderStatus } from '@/lib/orders/stateMachine';

export interface CreateOrderInput {
  storeId: string;
  deliveryAddressId: string;
  deliveryFee: number;
  items: { productId: string; quantity: number; observacoes?: string }[];
}

export async function createOrder(ctx: TenantContext, input: CreateOrderInput): Promise<{ orderId: string }> {
  if (ctx.role !== 'customer' || !ctx.customerId) {
    throw new Error('Apenas cliente autenticado pode criar pedido');
  }
  if (input.items.length === 0) {
    throw new Error('Pedido precisa de ao menos um item');
  }

  return withTenantContext(ctx, async (client) => {
    const products = await client.query<{ id: string; name: string; price: string }>(
      `select id, name, price from products where id = any($1::uuid[]) and store_id = $2`,
      [input.items.map((i) => i.productId), input.storeId]
    );
    if (products.rows.length !== input.items.length) {
      throw new Error('Um ou mais produtos não pertencem a essa loja ou não existem');
    }
    const productsById = new Map(products.rows.map((p) => [p.id, p]));

    const subscription = await client.query<{ commission_rate_snapshot: string; code: string }>(
      `select ss.commission_rate_snapshot, sp.code
       from store_subscriptions ss
       join subscription_plans sp on sp.id = ss.plan_id
       where ss.store_id = $1 and ss.ended_at is null
       limit 1`,
      [input.storeId]
    );
    if (subscription.rows.length === 0) {
      throw new Error('Loja sem plano de assinatura vigente');
    }
    const commissionRate = Number(subscription.rows[0].commission_rate_snapshot);
    const planCode = subscription.rows[0].code;

    const totals = computeOrderTotals({
      items: input.items.map((item) => ({
        unitPrice: Number(productsById.get(item.productId)!.price),
        quantity: item.quantity,
      })),
      discountAmount: 0,
      deliveryFee: input.deliveryFee,
      commissionRate,
    });

    const order = await client.query<{ id: string }>(
      `insert into orders (
         store_id, customer_id, status, payment_method, payment_status, delivery_address_id,
         gross_amount, discount_amount, commission_base_amount, commission_rate_applied, commission_amount,
         delivery_fee, net_amount_to_store, plan_code_at_order
       ) values ($1, $2, 'confirmed', 'cash_on_delivery', 'pending', $3, $4, 0, $5, $6, $7, $8, $9, $10)
       returning id`,
      [
        input.storeId,
        ctx.customerId,
        input.deliveryAddressId,
        totals.grossAmount,
        totals.commissionBaseAmount,
        commissionRate,
        totals.commissionAmount,
        input.deliveryFee,
        totals.netAmountToStore,
        planCode,
      ]
    );
    const orderId = order.rows[0].id;

    for (const item of input.items) {
      const product = productsById.get(item.productId)!;
      const subtotal = Number(product.price) * item.quantity;
      await client.query(
        `insert into order_items (order_id, product_id, product_name_at_order, unit_price_at_order, quantity, observacoes, subtotal)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, item.productId, product.name, product.price, item.quantity, item.observacoes ?? null, subtotal]
      );
    }

    await client.query(
      `insert into order_events (order_id, event_type, actor_type, actor_id) values ($1, 'created', 'customer', $2)`,
      [orderId, ctx.customerId]
    );

    return { orderId };
  });
}

export async function advanceOrderStatus(ctx: TenantContext, orderId: string, nextStatus: OrderStatus): Promise<void> {
  if (ctx.role !== 'store_owner' && ctx.role !== 'platform_admin') {
    throw new Error('Apenas lojista ou admin pode avançar o status do pedido');
  }

  await withTenantContext(ctx, async (client) => {
    const current = await client.query<{ status: OrderStatus; customer_id: string; store_id: string }>(
      `select status, customer_id, store_id from orders where id = $1`,
      [orderId]
    );
    if (current.rows.length === 0) {
      throw new Error('Pedido não encontrado');
    }
    const currentStatus = current.rows[0].status;

    if (!isValidTransition(currentStatus, nextStatus)) {
      throw new Error(`Transição de status inválida: ${currentStatus} -> ${nextStatus}`);
    }

    await client.query(`update orders set status = $1 where id = $2`, [nextStatus, orderId]);

    await client.query(
      `insert into order_events (order_id, event_type, payload, actor_type)
       values ($1, 'status_changed', $2, $3)`,
      [orderId, JSON.stringify({ from: currentStatus, to: nextStatus }), ctx.role === 'platform_admin' ? 'admin' : 'store_user']
    );

    if (nextStatus === 'delivered') {
      const order = await client.query<{ customer_id: string; store_id: string }>(
        `select customer_id, store_id from orders where id = $1`,
        [orderId]
      );
      await client.query(
        `insert into customer_stores (customer_id, store_id, first_order_at, last_order_at, total_orders)
         values ($1, $2, now(), now(), 1)
         on conflict (customer_id, store_id)
         do update set last_order_at = now(), total_orders = customer_stores.total_orders + 1`,
        [order.rows[0].customer_id, order.rows[0].store_id]
      );
    }
  });
}
