import { Pool } from 'pg';

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.DATABASE_URL_TEST
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL (ou DATABASE_URL_TEST em teste) não configurada');
}

export const pool = new Pool({ connectionString });
