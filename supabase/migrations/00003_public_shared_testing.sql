-- Public no-login test data for the Dijei Coat PWA.
-- Anyone with the app link can read, add, and change rows in this table.
-- Use only for the explicitly public test environment; do not store confidential data.

create table if not exists public.coatx_shared_data (
  id text not null,
  entity_type text not null check (entity_type in ('project', 'item', 'work_record')),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload ->> 'id' = id
  ),
  updated_at timestamptz not null default now(),
  primary key (entity_type, id)
);

create index if not exists idx_coatx_shared_data_type_updated
  on public.coatx_shared_data (entity_type, updated_at desc);

alter table public.coatx_shared_data enable row level security;

drop policy if exists "Public test users can manage shared data"
  on public.coatx_shared_data;
create policy "Public test users can manage shared data"
  on public.coatx_shared_data
  for all
  to anon, authenticated
  using (true)
  with check (true);

revoke all on public.coatx_shared_data from public;
grant select, insert, update, delete
  on public.coatx_shared_data
  to anon, authenticated;
