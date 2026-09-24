import { pool } from '@/lib/db/pool';
import type { Store } from './stores';
import type { Product } from './products';

export async function listActiveStores(): Promise<Pick<Store, 'id' | 'name' | 'slug'>[]> {
  const result = await pool.query(`select id, name, slug from stores where status = 'active' order by name`);
  return result.rows;
}

export async function getStoreBySlugWithProducts(
  slug: string
): Promise<{ store: Store; products: Product[] } | null> {
  const storeResult = await pool.query<Store>(
    `select id, name, slug, status from stores where slug = $1 and status = 'active'`,
    [slug]
  );
  if (storeResult.rows.length === 0) return null;

  const store = storeResult.rows[0];
  const productsResult = await pool.query<Product>(
    `select * from products where store_id = $1 and is_available = true order by name`,
    [store.id]
  );

  return { store, products: productsResult.rows };
}
