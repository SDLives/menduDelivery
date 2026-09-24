'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { createOrder as createOrderRepo, type CreateOrderInput } from '@/lib/db/repositories/orders';

export async function createOrderAction(authUserId: string, input: CreateOrderInput) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  return createOrderRepo(ctx, input);
}
