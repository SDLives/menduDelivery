'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { submitFeedback as submitFeedbackRepo } from '@/lib/db/repositories/orderFeedback';

export async function submitFeedbackAction(authUserId: string, orderId: string, rating: number, comment?: string) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  return submitFeedbackRepo(ctx, { orderId, rating, comment });
}
