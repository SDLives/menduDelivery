create type order_status as enum ('pending_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
create type payment_method as enum ('online', 'cash_on_delivery');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'chargeback');
create type delivery_fee_recipient as enum ('store', 'courier', 'platform');
create type gateway_provider as enum ('asaas');
create type order_event_actor as enum ('customer', 'store_user', 'system', 'admin', 'courier');

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  revenue_min numeric,
  revenue_max numeric,
  commission_rate numeric,
  monthly_fee numeric,
  is_custom boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into subscription_plans (code, name, revenue_min, revenue_max, commission_rate, monthly_fee, is_custom) values
  ('START', 'Start', 0, 8000, 0.07, 0, false),
  ('PRO', 'Pro', 8000.01, 30000, 0.06, 49.90, false),
  ('BUSINESS', 'Business', 30000.01, 80000, 0.05, 99.90, false),
  ('ENTERPRISE', 'Enterprise', 80000.01, null, null, null, true);

create table store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  plan_id uuid not null references subscription_plans(id),
  commission_rate_snapshot numeric not null,
  monthly_fee_snapshot numeric not null,
  asaas_subscription_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  changed_by uuid references users(id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  customer_id uuid not null references customers(id),
  status order_status not null default 'confirmed',
  payment_method payment_method not null,
  payment_status payment_status not null default 'pending',
  delivery_address_id uuid not null references addresses(id),
  gross_amount numeric(10,2) not null,
  discount_amount numeric(10,2) not null default 0,
  commission_base_amount numeric(10,2) not null,
  commission_rate_applied numeric not null,
  commission_amount numeric(10,2) not null,
  gateway_fee_amount numeric(10,2),
  delivery_fee numeric(10,2) not null default 0,
  delivery_fee_recipient delivery_fee_recipient not null default 'store',
  net_amount_to_store numeric(10,2) not null,
  plan_code_at_order text not null,
  gateway_provider gateway_provider,
  gateway_charge_id text,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  product_id uuid not null references products(id),
  product_name_at_order text not null,
  unit_price_at_order numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  observacoes text,
  subtotal numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  event_type text not null,
  payload jsonb,
  actor_type order_event_actor not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create table order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id),
  customer_id uuid not null references customers(id),
  store_id uuid not null references stores(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
