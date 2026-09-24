import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';
import { computeOrderTotals } from '@/lib/orders/totals';

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
