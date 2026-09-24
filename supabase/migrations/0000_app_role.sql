-- 0000_app_role.sql
--
-- Creates a dedicated, non-superuser application role for the app's runtime
-- connection pool (src/lib/db/pool.ts). This role does NOT have BYPASSRLS,
-- unlike the `postgres` superuser that Supabase's local CLI (and the
-- migration runner itself) connects as by default.
--
-- Why this matters: withTenantContext() (src/lib/db/tenantContext.ts) sets
-- `app.current_role` / `app.current_store_id` / `app.current_customer_id` as
-- session-local settings that Task 5's Row Level Security policies will key
-- off of. If the application connected as `postgres`, RLS policies would be
-- defined but never actually enforced, because BYPASSRLS roles skip RLS
-- checks entirely — the policies would look correct on paper while providing
-- zero real defense-in-depth. Running the app as `mendu_app` instead means
-- RLS is actually exercised in dev/test, the same way it will be in
-- production.
--
-- This migration is numbered 0000 so it runs before 0001_core_identity_and_store.sql
-- (Task 3) and all later migrations — those still run as the `postgres`
-- superuser via the Supabase CLI (migrations always apply as the DB owner),
-- but the ALTER DEFAULT PRIVILEGES below ensures every table THEY create
-- automatically grants mendu_app the DML rights it needs, without every
-- future migration having to remember to add its own GRANT statement.
--
-- SECURITY NOTE: the password below is a placeholder for local development
-- only (matches .env.example). Production deployments must not use this
-- password — Supabase-hosted projects manage their own database credentials
-- separately, and this role/password pair should be rotated or replaced
-- entirely before any non-local use.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mendu_app') then
    create role mendu_app with login password 'mendu_app_dev_password';
  end if;
end
$$;

grant usage on schema public to mendu_app;

-- No tables exist yet at this point in migration history, but grant DML on
-- whatever is currently in `public` for completeness / idempotency on reruns.
grant select, insert, update, delete on all tables in schema public to mendu_app;

-- Ensure tables created by LATER migrations (run as the `postgres`
-- superuser via the Supabase CLI) automatically grant mendu_app the same
-- DML rights, without needing a GRANT statement added to every future
-- migration file.
alter default privileges in schema public
  grant select, insert, update, delete on tables to mendu_app;
