import { withTenantContext, type TenantContext } from '@/lib/db/tenantContext';

export interface CreateAddressInput {
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  loteamento?: string;
  bairro: string;
  municipio: string;
  uf: string;
}

export async function createAddressForCustomer(
  ctx: TenantContext,
  input: CreateAddressInput
): Promise<{ id: string }> {
  if (ctx.role !== 'customer' || !ctx.customerId) {
    throw new Error('Apenas cliente autenticado pode cadastrar endereço');
  }

  return withTenantContext(ctx, async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into addresses (customer_id, cep, rua, numero, complemento, loteamento, bairro, municipio, uf)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [
        ctx.customerId,
        input.cep,
        input.rua,
        input.numero,
        input.complemento ?? null,
        input.loteamento ?? null,
        input.bairro,
        input.municipio,
        input.uf,
      ]
    );
    return result.rows[0];
  });
}
