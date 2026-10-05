-- As migrações 0001/0002 sempre definiram essas foreign keys inline nas
-- tabelas (`references tabela(coluna)`), mas elas nunca pegaram no banco de
-- produção (causa não identificada com certeza — possivelmente algo na cópia
-- manual via SQL Editor durante o Task 17). Resultado: era possível apagar
-- uma loja pelo painel do Supabase deixando store_users/store_subscriptions
-- órfãos, sem nenhum erro. Esta migração adiciona as constraints que
-- deveriam sempre ter existido.
--
-- Local (onde essas constraints já existem, criadas certinho pelas
-- migrações 0001/0002 via CLI) e produção (onde faltam todas) precisam da
-- mesma migração, então cada ALTER só roda se a constraint ainda não
-- existir — idempotente nos dois ambientes.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_user_id_fkey') then
    alter table customers add constraint customers_user_id_fkey foreign key (user_id) references users(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_stores_address') then
    alter table stores add constraint fk_stores_address foreign key (address_id) references addresses(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stores_approved_by_fkey') then
    alter table stores add constraint stores_approved_by_fkey foreign key (approved_by) references users(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'store_users_store_id_fkey') then
    alter table store_users add constraint store_users_store_id_fkey foreign key (store_id) references stores(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'store_users_user_id_fkey') then
    alter table store_users add constraint store_users_user_id_fkey foreign key (user_id) references users(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'products_store_id_fkey') then
    alter table products add constraint products_store_id_fkey foreign key (store_id) references stores(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'addresses_customer_id_fkey') then
    alter table addresses add constraint addresses_customer_id_fkey foreign key (customer_id) references customers(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'addresses_store_id_fkey') then
    alter table addresses add constraint addresses_store_id_fkey foreign key (store_id) references stores(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'media_assets_store_id_fkey') then
    alter table media_assets add constraint media_assets_store_id_fkey foreign key (store_id) references stores(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'media_assets_product_id_fkey') then
    alter table media_assets add constraint media_assets_product_id_fkey foreign key (product_id) references products(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customer_stores_customer_id_fkey') then
    alter table customer_stores add constraint customer_stores_customer_id_fkey foreign key (customer_id) references customers(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customer_stores_store_id_fkey') then
    alter table customer_stores add constraint customer_stores_store_id_fkey foreign key (store_id) references stores(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'store_subscriptions_store_id_fkey') then
    alter table store_subscriptions add constraint store_subscriptions_store_id_fkey foreign key (store_id) references stores(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'store_subscriptions_plan_id_fkey') then
    alter table store_subscriptions add constraint store_subscriptions_plan_id_fkey foreign key (plan_id) references subscription_plans(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'store_subscriptions_changed_by_fkey') then
    alter table store_subscriptions add constraint store_subscriptions_changed_by_fkey foreign key (changed_by) references users(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_store_id_fkey') then
    alter table orders add constraint orders_store_id_fkey foreign key (store_id) references stores(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_customer_id_fkey') then
    alter table orders add constraint orders_customer_id_fkey foreign key (customer_id) references customers(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_delivery_address_id_fkey') then
    alter table orders add constraint orders_delivery_address_id_fkey foreign key (delivery_address_id) references addresses(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_items_order_id_fkey') then
    alter table order_items add constraint order_items_order_id_fkey foreign key (order_id) references orders(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_items_product_id_fkey') then
    alter table order_items add constraint order_items_product_id_fkey foreign key (product_id) references products(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_events_order_id_fkey') then
    alter table order_events add constraint order_events_order_id_fkey foreign key (order_id) references orders(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_feedback_order_id_fkey') then
    alter table order_feedback add constraint order_feedback_order_id_fkey foreign key (order_id) references orders(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_feedback_customer_id_fkey') then
    alter table order_feedback add constraint order_feedback_customer_id_fkey foreign key (customer_id) references customers(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_feedback_store_id_fkey') then
    alter table order_feedback add constraint order_feedback_store_id_fkey foreign key (store_id) references stores(id);
  end if;
end $$;
