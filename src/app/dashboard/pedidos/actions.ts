'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { advanceOrderStatus as advanceOrderStatusRepo } from '@/lib/db/repositories/orders';
import type { OrderStatus } from '@/lib/orders/stateMachine';

export async function advanceOrderStatusAction(authUserId: string, orderId: string, nextStatus: OrderStatus) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  await advanceOrderStatusRepo(ctx, orderId, nextStatus);
}
