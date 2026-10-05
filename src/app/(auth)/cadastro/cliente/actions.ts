'use server';

import { z } from 'zod';
import { pool } from '@/lib/db/pool';
import { supabaseAdminClient } from '@/lib/supabaseServerClient';
import { bunnyStorage } from '@/lib/storage/bunnyStorage';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  primeiroNome: z.string().min(1),
  sobrenome: z.string().min(1),
  urlFotoDePerfil: z.string().url().optional(),
});

export type SignupCustomerInput = z.infer<typeof signupSchema>;

export async function signupCustomer(
  input: SignupCustomerInput
): Promise<{ userId: string; customerId: string }> {
  const parsed = signupSchema.parse(input);

  const supabase = supabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário no Supabase Auth: ${error?.message}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `insert into users (id, email, role, phone, primeiro_nome, sobrenome, url_foto_de_perfil)
       values ($1, $2, 'customer', $3, $4, $5, $6)`,
      [
        data.user.id,
        parsed.email,
        parsed.phone ?? null,
        parsed.primeiroNome,
        parsed.sobrenome,
        parsed.urlFotoDePerfil ?? null,
      ]
    );
    const customer = await client.query(`insert into customers (user_id) values ($1) returning id`, [
      data.user.id,
    ]);
    await client.query('COMMIT');
    return { userId: data.user.id, customerId: customer.rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    // Best-effort cleanup: delete the Auth user to avoid orphaned state
    try {
      await supabase.auth.admin.deleteUser(data.user.id);
    } catch (cleanupErr) {
      // Log cleanup failure but don't mask the original error
      console.error(`Failed to delete orphaned Auth user ${data.user.id}:`, cleanupErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function uploadProfilePhoto(file: File): Promise<{ url: string }> {
  const data = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const path = `clientes/${crypto.randomUUID()}.${ext}`;
  return bunnyStorage.upload({ path, contentType: file.type || 'image/jpeg', data });
}
