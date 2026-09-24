'use server';

import { z } from 'zod';
import { withTenantContext } from '@/lib/db/tenantContext';
import { supabaseAdminClient } from '@/lib/supabaseServerClient';

const addressSchema = z.object({
  cep: z.string().min(1),
  rua: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  loteamento: z.string().optional(),
  bairro: z.string().min(1),
  municipio: z.string().min(1),
  uf: z.string().length(2),
});

const signupStoreSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  storeName: z.string().min(1),
  storeSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'use apenas letras minúsculas, números e hífen'),
  address: addressSchema,
});

export type SignupStoreInput = z.infer<typeof signupStoreSchema>;

export async function signupStore(input: SignupStoreInput): Promise<{ userId: string; storeId: string }> {
  const parsed = signupStoreSchema.parse(input);

  const supabase = supabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário no Supabase Auth: ${error?.message}`);
  }
  const userId = data.user.id;

  try {
    // stores/addresses have RLS with owner/admin-scoped WITH CHECK policies (Task 5).
    // At signup time there is no resolved tenant context yet (the store doesn't exist
    // until this transaction runs), so we run it as platform_admin — the same
    // authorized bypass pattern used in tests/db/rls.test.ts — rather than weakening
    // any policy.
    return await withTenantContext({ role: 'platform_admin' }, async (client) => {
      await client.query(`insert into users (id, email, role) values ($1, $2, 'store_owner')`, [
        userId,
        parsed.email,
      ]);

      const store = await client.query(
        `insert into stores (name, slug, status) values ($1, $2, 'pending_approval') returning id`,
        [parsed.storeName, parsed.storeSlug]
      );
      const storeId = store.rows[0].id;

      await client.query(`insert into store_users (store_id, user_id, role_in_store) values ($1, $2, 'owner')`, [
        storeId,
        userId,
      ]);

      const address = await client.query(
        `insert into addresses (store_id, cep, rua, numero, complemento, loteamento, bairro, municipio, uf)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
        [
          storeId,
          parsed.address.cep,
          parsed.address.rua,
          parsed.address.numero,
          parsed.address.complemento ?? null,
          parsed.address.loteamento ?? null,
          parsed.address.bairro,
          parsed.address.municipio,
          parsed.address.uf,
        ]
      );

      await client.query(`update stores set address_id = $1 where id = $2`, [address.rows[0].id, storeId]);

      const startPlan = await client.query(
        `select id, commission_rate, monthly_fee from subscription_plans where code = 'START'`
      );
      await client.query(
        `insert into store_subscriptions (store_id, plan_id, commission_rate_snapshot, monthly_fee_snapshot)
         values ($1, $2, $3, $4)`,
        [storeId, startPlan.rows[0].id, startPlan.rows[0].commission_rate, startPlan.rows[0].monthly_fee]
      );

      return { userId, storeId };
    });
  } catch (err) {
    // Best-effort cleanup: delete the Auth user to avoid orphaned state
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch (cleanupErr) {
      // Log cleanup failure but don't mask the original error
      console.error(`Failed to delete orphaned Auth user ${userId}:`, cleanupErr);
    }
    throw err;
  }
}
