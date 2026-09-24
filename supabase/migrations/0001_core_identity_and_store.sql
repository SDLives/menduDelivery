create extension if not exists pgcrypto;

create type user_role as enum ('customer', 'store_owner', 'platform_admin', 'courier');
create type store_user_role as enum ('owner', 'staff');
create type store_status as enum ('pending_approval', 'active', 'rejected', 'suspended');
create type media_role as enum ('logo', 'banner', 'gallery');
create type media_type as enum ('image', 'video');
create type media_status as enum ('ready', 'processing', 'failed');

create table users (
  id uuid primary key,
  email text not null unique,
  role user_role not null,
  phone text,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id),
  marketing_opt_in boolean not null default false,
  asaas_customer_id text,
  created_at timestamptz not null default now()
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  custom_domain text,
  primary_color text,
  secondary_color text,
  status store_status not null default 'pending_approval',
  approved_by uuid references users(id),
  approved_at timestamptz,
  is_open boolean not null default false,
  opening_hours jsonb,
  address_id uuid,
  created_at timestamptz not null default now()
);

create table store_users (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  user_id uuid not null references users(id),
  role_in_store store_user_role not null,
  unique (store_id, user_id)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  name text not null,
  description text,
  price numeric(10,2) not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  store_id uuid references stores(id),
  cep text not null,
  rua text not null,
  numero text not null,
  complemento text,
  loteamento text,
  bairro text not null,
  municipio text not null,
  uf text not null,
  ativo boolean not null default true,
  lat numeric,
  lng numeric,
  created_at timestamptz not null default now(),
  constraint chk_addresses_single_owner check (
    (customer_id is not null and store_id is null)
    or (customer_id is null and store_id is not null)
  )
);

alter table stores
  add constraint fk_stores_address foreign key (address_id) references addresses(id);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  product_id uuid references products(id),
  role media_role not null,
  media_type media_type not null default 'image',
  url text not null,
  thumbnail_url text,
  width int,
  height int,
  duration_seconds int,
  status media_status not null default 'ready',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table customer_stores (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  store_id uuid not null references stores(id),
  first_order_at timestamptz,
  last_order_at timestamptz,
  total_orders int not null default 0,
  is_favorite boolean not null default false,
  unique (customer_id, store_id)
);
