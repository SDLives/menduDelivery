'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { approveStore as approveStoreRepo, listPendingStores as listPendingStoresRepo } from '@/lib/db/repositories/stores';

export async function approveStoreAction(authUserId: string, storeId: string) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  await approveStoreRepo(ctx, storeId, ctx.userId);
}

export async function listPendingStoresAction(authUserId: string) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx) throw new Error('Sessão inválida');
  return listPendingStoresRepo(ctx);
}
