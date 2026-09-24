-- stores: dono/admin vê tudo da própria loja; qualquer um vê lojas ativas (vitrine pública)
alter table stores enable row level security;

create policy stores_owner_access on stores
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

create policy stores_public_read on stores
  for select
  using (status = 'active');

-- products: dono/admin vê tudo da loja; público vê produto disponível de loja ativa
alter table products enable row level security;

create policy products_owner_access on products
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

create policy products_public_read on products
  for select
  using (
    is_available = true
    and exists (select 1 from stores s where s.id = products.store_id and s.status = 'active')
  );

-- media_assets: mesmo padrão de products
alter table media_assets enable row level security;

create policy media_assets_owner_access on media_assets
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

create policy media_assets_public_read on media_assets
  for select
  using (exists (select 1 from stores s where s.id = media_assets.store_id and s.status = 'active'));

-- addresses: só o dono (cliente ou loja) e admin — nunca público
alter table addresses enable row level security;

create policy addresses_owner_access on addresses
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

-- orders: cliente vê os próprios, loja vê os da loja, admin vê tudo
alter table orders enable row level security;

create policy orders_access on orders
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

-- order_items: acesso via join com orders
alter table order_items enable row level security;

create policy order_items_access on order_items
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or exists (
      select 1 from orders o where o.id = order_items.order_id
      and (
        o.customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
        or o.store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
      )
    )
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or exists (
      select 1 from orders o where o.id = order_items.order_id
      and (
        o.customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
        or o.store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
      )
    )
  );

-- order_events: mesmo padrão via join com orders
alter table order_events enable row level security;

create policy order_events_access on order_events
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or exists (
      select 1 from orders o where o.id = order_events.order_id
      and (
        o.customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
        or o.store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
      )
    )
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or exists (
      select 1 from orders o where o.id = order_events.order_id
      and (
        o.customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
        or o.store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
      )
    )
  );

-- order_feedback: cliente e loja donos, admin
alter table order_feedback enable row level security;

create policy order_feedback_access on order_feedback
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );

-- customer_stores: cliente e loja donos, admin
alter table customer_stores enable row level security;

create policy customer_stores_access on customer_stores
  for all
  using (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  )
  with check (
    current_setting('app.current_role', true) = 'platform_admin'
    or customer_id = nullif(current_setting('app.current_customer_id', true), '')::uuid
    or store_id = nullif(current_setting('app.current_store_id', true), '')::uuid
  );
