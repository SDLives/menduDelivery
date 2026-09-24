import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';

export async function submitFeedback(
  ctx: TenantContext,
  input: { orderId: string; rating: number; comment?: string }
): Promise<{ id: string }> {
  if (ctx.role !== 'customer' || !ctx.customerId) {
    throw new Error('Apenas cliente pode enviar feedback');
  }
  if (input.rating < 1 || input.rating > 5) {
    throw new Error('Nota precisa estar entre 1 e 5');
  }

  return withTenantContext(ctx, async (client) => {
    const order = await client.query<{ status: string; store_id: string }>(
      `select status, store_id from orders where id = $1 and customer_id = $2`,
      [input.orderId, ctx.customerId]
    );
    if (order.rows.length === 0) {
      throw new Error('Pedido não encontrado');
    }
    if (order.rows[0].status !== 'delivered') {
      throw new Error('Só é possível avaliar um pedido entregue');
    }

    const result = await client.query<{ id: string }>(
      `insert into order_feedback (order_id, customer_id, store_id, rating, comment)
       values ($1, $2, $3, $4, $5) returning id`,
      [input.orderId, ctx.customerId, order.rows[0].store_id, input.rating, input.comment ?? null]
    );

    await client.query(
      `insert into order_events (order_id, event_type, actor_type, actor_id) values ($1, 'feedback_submitted', 'customer', $2)`,
      [input.orderId, ctx.customerId]
    );

    return result.rows[0];
  });
}
