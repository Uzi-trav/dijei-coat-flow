-- ================================================================
-- React + Supabase Dashboard Starter: Initial Migration
-- Run in Supabase SQL Editor (https://supabase.com/dashboard)
-- ================================================================

-- 1. TABLES
-- ================================================================

-- Users (extends auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('superadmin', 'admin', 'editor')),
  created_at timestamptz not null default now(),
  last_login timestamptz
);

-- 2. INDEXES
-- ================================================================

create index if not exists idx_users_role on public.users(role);

-- 3. ROW LEVEL SECURITY (RLS)
-- ================================================================

alter table public.users enable row level security;

-- Allow users to read their own row
create policy "Users can read own row"
  on public.users
  for select
  using (auth.uid() = id);

-- Allow users to update their own row (except role)
create policy "Users can update own row"
  on public.users
  for update
  using (auth.uid() = id);

-- Restrict role changes to superadmins
create policy "Only superadmins can update roles"
  on public.users
  for update
  using (exists (
    select 1 from public.users
    where id = auth.uid() and role = 'superadmin'
  ));

-- 4. TRIGGERS
-- ================================================================

-- Create user row automatically on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'editor')
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
