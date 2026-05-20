-- AddressLabelPro initial schema.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Tables:
--   profiles       — one row per auth.users row, app-level user data
--   subscriptions  — one row per user, tracks their Stripe subscription
--   jobs           — persisted CSV → PDF label jobs (replaces in-memory dict)
--
-- RLS enforces "users only see their own rows." The backend uses the Supabase
-- service_role key which bypasses RLS for operations it can justify (webhook
-- fulfillment, job CRUD on behalf of the user).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete',
  'incomplete_expired', 'unpaid', 'paused'
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique not null,
  status public.subscription_status not null,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "users read own subscription" on public.subscriptions;
create policy "users read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Convenience view: is this user currently Pro?
create or replace view public.current_user_pro as
  select
    user_id,
    status in ('trialing', 'active') as is_pro,
    current_period_end,
    cancel_at_period_end
  from public.subscriptions;

grant select on public.current_user_pro to authenticated;

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
create type public.job_status as enum (
  'uploaded', 'mapped', 'validated', 'generated', 'failed'
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  status public.job_status not null default 'uploaded',
  total_rows int not null default 0,
  columns jsonb not null default '[]'::jsonb,
  csv_data jsonb not null default '[]'::jsonb,
  template text not null default 'avery_5160',
  error_message text,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Derived values computed during validation (kept for audit / resume):
alter table public.jobs add column if not exists labels jsonb;
alter table public.jobs add column if not exists addresses jsonb;

create index if not exists jobs_user_id_idx on public.jobs(user_id, created_at desc);

alter table public.jobs enable row level security;

drop policy if exists "users read own jobs" on public.jobs;
create policy "users read own jobs" on public.jobs
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own jobs" on public.jobs;
create policy "users insert own jobs" on public.jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own jobs" on public.jobs;
create policy "users update own jobs" on public.jobs
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
