'use server';

import { resolveSessionContext } from '@/lib/auth/session';
import { createProduct as createProductRepo, listProductsByStore as listProductsByStoreRepo } from '@/lib/db/repositories/products';

export async function createProductAction(
  authUserId: string,
  input: { name: string; description?: string; price: number }
) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx || ctx.role !== 'store_owner') throw new Error('Apenas lojista pode cadastrar produto');
  return createProductRepo(ctx, input);
}

export async function listMyProductsAction(authUserId: string) {
  const ctx = await resolveSessionContext(authUserId);
  if (!ctx || ctx.role !== 'store_owner') throw new Error('Apenas lojista pode listar produtos');
  return listProductsByStoreRepo(ctx);
}
