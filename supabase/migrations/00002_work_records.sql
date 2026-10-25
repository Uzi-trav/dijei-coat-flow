-- COATX-FLOW first work-record slice. Apply after 00001_initial_schema.sql.

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = (select auth.uid())
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- Signup metadata is user-controlled; new users must not choose their own role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'editor');
  return new;
end;
$$;

drop policy if exists "Users can read own row" on public.users;
drop policy if exists "Users can update own row" on public.users;
drop policy if exists "Only superadmins can update roles" on public.users;
create policy "Users can read own row"
  on public.users for select to authenticated
  using ((select auth.uid()) = id);
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;

create sequence if not exists public.work_record_number_seq;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (length(btrim(canonical_name)) between 1 and 200),
  part_numbers text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  constraint items_canonical_name_unique unique (canonical_name)
);

create table if not exists public.work_records (
  id uuid primary key default gen_random_uuid(),
  record_number text not null unique default (
    'WF-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' ||
    lpad(nextval('public.work_record_number_seq')::text, 6, '0')
  ),
  project_id uuid not null references public.projects(id) on delete restrict,
  lot_number text not null check (length(btrim(lot_number)) between 1 and 100),
  inspector_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('submitted', 'in_progress', 'completed', 'cancelled')),
  notes text,
  is_rework boolean not null default false
);

create table if not exists public.work_record_items (
  id uuid primary key default gen_random_uuid(),
  work_record_id uuid not null references public.work_records(id) on delete cascade,
  item_id uuid references public.items(id) on delete restrict,
  item_name_snapshot text not null check (length(btrim(item_name_snapshot)) between 1 and 200),
  part_number text,
  quantity numeric not null check (quantity > 0),
  unit text not null check (length(btrim(unit)) between 1 and 20),
  proposed_new_item boolean not null default false,
  constraint proposed_item_not_in_master check (item_id is not null or proposed_new_item)
);

create index if not exists idx_projects_active_name on public.projects(is_active, name);
create index if not exists idx_items_active_name on public.items(is_active, canonical_name);
create index if not exists idx_work_records_created_at on public.work_records(created_at desc);
create index if not exists idx_work_records_project_id on public.work_records(project_id);
create index if not exists idx_work_records_lot_number on public.work_records(lot_number);
create index if not exists idx_work_record_items_record_id on public.work_record_items(work_record_id);
create index if not exists idx_work_record_items_item_id on public.work_record_items(item_id);

alter table public.projects enable row level security;
alter table public.items enable row level security;
alter table public.work_records enable row level security;
alter table public.work_record_items enable row level security;

drop policy if exists "Authenticated users can read projects" on public.projects;
create policy "Authenticated users can read projects"
  on public.projects for select to authenticated using (true);
drop policy if exists "Admins can manage projects" on public.projects;
create policy "Admins can manage projects"
  on public.projects for all to authenticated
  using (public.current_app_role() in ('admin', 'superadmin'))
  with check (public.current_app_role() in ('admin', 'superadmin'));

drop policy if exists "Authenticated users can read items" on public.items;
create policy "Authenticated users can read items"
  on public.items for select to authenticated using (true);
drop policy if exists "Admins can manage items" on public.items;
create policy "Admins can manage items"
  on public.items for all to authenticated
  using (public.current_app_role() in ('admin', 'superadmin'))
  with check (public.current_app_role() in ('admin', 'superadmin'));

drop policy if exists "Authenticated users can read work records" on public.work_records;
create policy "Authenticated users can read work records"
  on public.work_records for select to authenticated using (true);
drop policy if exists "Authenticated users can read work record items" on public.work_record_items;
create policy "Authenticated users can read work record items"
  on public.work_record_items for select to authenticated using (true);

revoke all on public.projects, public.items, public.work_records, public.work_record_items from anon, authenticated;
grant select on public.projects, public.items, public.work_records, public.work_record_items to authenticated;
grant insert, update on public.projects, public.items to authenticated;

create or replace function public.submit_work_record(
  p_project_id uuid,
  p_lot_number text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_id uuid;
  v_item record;
  v_canonical_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if public.current_app_role() not in ('editor', 'admin', 'superadmin') then
    raise exception 'A workshop user profile is required';
  end if;
  if length(btrim(coalesce(p_lot_number, ''))) not between 1 and 100 then
    raise exception 'LOT number is required';
  end if;
  if not exists (
    select 1 from public.projects
    where id = p_project_id and is_active
  ) then
    raise exception 'Select an active project';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one work item is required';
  end if;

  insert into public.work_records (project_id, lot_number, inspector_id, notes)
  values (p_project_id, btrim(p_lot_number), (select auth.uid()), nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_record_id;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(
      item_id uuid,
      item_name text,
      part_number text,
      quantity numeric,
      unit text,
      proposed_new_item boolean
    )
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Each quantity must be greater than zero';
    end if;
    if length(btrim(coalesce(v_item.unit, ''))) not between 1 and 20 then
      raise exception 'Each item must have a unit';
    end if;

    if v_item.item_id is null then
      if v_item.proposed_new_item is distinct from true
        or length(btrim(coalesce(v_item.item_name, ''))) not between 1 and 200 then
        raise exception 'Confirm a name for each proposed new item';
      end if;
      v_canonical_name := btrim(v_item.item_name);
    else
      select canonical_name into v_canonical_name
      from public.items
      where id = v_item.item_id and is_active;
      if not found then
        raise exception 'Select an active item';
      end if;
      if v_item.proposed_new_item is distinct from false then
        raise exception 'Existing items cannot be marked as new proposals';
      end if;
    end if;

    insert into public.work_record_items (
      work_record_id, item_id, item_name_snapshot, part_number,
      quantity, unit, proposed_new_item
    )
    values (
      v_record_id,
      v_item.item_id,
      v_canonical_name,
      nullif(btrim(coalesce(v_item.part_number, '')), ''),
      v_item.quantity,
      btrim(v_item.unit),
      coalesce(v_item.proposed_new_item, false)
    );
  end loop;

  return v_record_id;
end;
$$;

revoke all on function public.submit_work_record(uuid, text, text, jsonb) from public, anon;
grant execute on function public.submit_work_record(uuid, text, text, jsonb) to authenticated;
