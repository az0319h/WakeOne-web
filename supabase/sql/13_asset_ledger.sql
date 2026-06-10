-- 2026-06-09: 비품 대장 asset_items 스키마 및 RPC 추가
-- File: 13_asset_ledger.sql
-- Plan: 15_asset-ledger-plan.md
-- Date: 2026-06-09
-- Status: Completed
-- Remote migration: applied (13_asset_ledger)
-- Summary: asset ledger schema, constraints, indexes, trigger, RLS, and suggest number RPC

create table if not exists public.asset_items (
  id bigint generated always as identity primary key,
  asset_number text not null,
  asset_name text not null,
  status text not null default '사용중' check (status in ('사용중', '미사용', '분실')),
  model_number text,
  actual_user_id uuid references auth.users(id) on delete set null,
  usage_location text,
  accounting_ledger text,
  ledger_code text,
  purchase_amount numeric(12, 0) check (purchase_amount is null or purchase_amount >= 0),
  purchase_date date,
  purchase_vendor text,
  notes text,
  created_by_id uuid not null references auth.users(id) on delete restrict,
  updated_by_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_items_asset_number_unique unique (asset_number),
  constraint asset_items_asset_number_format_check check (asset_number ~ '^[A-Z0-9]{1,10}-[0-9]{3}$'),
  constraint asset_items_asset_name_length_check check (char_length(asset_name) <= 200),
  constraint asset_items_model_number_length_check check (model_number is null or char_length(model_number) <= 200),
  constraint asset_items_usage_location_length_check check (usage_location is null or char_length(usage_location) <= 200),
  constraint asset_items_accounting_ledger_length_check check (accounting_ledger is null or char_length(accounting_ledger) <= 200),
  constraint asset_items_ledger_code_length_check check (ledger_code is null or char_length(ledger_code) <= 100),
  constraint asset_items_purchase_vendor_length_check check (purchase_vendor is null or char_length(purchase_vendor) <= 200)
);

create index if not exists idx_asset_items_asset_number
  on public.asset_items (asset_number);

create index if not exists idx_asset_items_asset_name
  on public.asset_items (asset_name);

create index if not exists idx_asset_items_status
  on public.asset_items (status);

create index if not exists idx_asset_items_actual_user
  on public.asset_items (actual_user_id);

create index if not exists idx_asset_items_created_by
  on public.asset_items (created_by_id);

create index if not exists idx_asset_items_updated_by
  on public.asset_items (updated_by_id);

create index if not exists idx_asset_items_created_at
  on public.asset_items (created_at desc);

create index if not exists idx_asset_items_purchase_date
  on public.asset_items (purchase_date desc nulls last);

drop trigger if exists trg_asset_items_updated_at on public.asset_items;
create trigger trg_asset_items_updated_at
before update on public.asset_items
for each row
execute function public.set_updated_at();

create or replace function public.extract_asset_prefix(asset_name text)
returns text
language sql
stable
as $$
  select nullif(upper(btrim((regexp_match(asset_name, '\(([^)]+)\)'))[1])), '');
$$;

create or replace function public.suggest_asset_number(p_asset_name text)
returns table (suggested text, prefix text)
language sql
stable
as $$
  with parsed as (
    select public.extract_asset_prefix(p_asset_name) as prefix
  ),
  next_serial as (
    select
      parsed.prefix,
      coalesce(
        max((substring(ai.asset_number from ('^' || parsed.prefix || '-([0-9]{3})$')))::integer),
        0
      ) + 1 as serial
    from parsed
    left join public.asset_items ai
      on parsed.prefix is not null
      and ai.asset_number ~ ('^' || parsed.prefix || '-[0-9]{3}$')
    group by parsed.prefix
  )
  select
    case
      when next_serial.prefix is null then null
      else next_serial.prefix || '-' || lpad(next_serial.serial::text, 3, '0')
    end as suggested,
    next_serial.prefix
  from next_serial;
$$;

alter table public.asset_items enable row level security;

drop policy if exists asset_items_select_wake_or_admin on public.asset_items;
create policy asset_items_select_wake_or_admin
on public.asset_items
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.system_role = 'admin'
        or p.affiliation = 'wake'
      )
  )
);

drop policy if exists asset_items_insert_wake_or_admin on public.asset_items;
create policy asset_items_insert_wake_or_admin
on public.asset_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.system_role = 'admin'
        or p.affiliation = 'wake'
      )
  )
  and created_by_id = auth.uid()
  and updated_by_id = auth.uid()
);

drop policy if exists asset_items_update_wake_or_admin on public.asset_items;
create policy asset_items_update_wake_or_admin
on public.asset_items
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.system_role = 'admin'
        or p.affiliation = 'wake'
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.system_role = 'admin'
        or p.affiliation = 'wake'
      )
  )
  and updated_by_id = auth.uid()
);

drop policy if exists asset_items_delete_owner_or_admin on public.asset_items;
create policy asset_items_delete_owner_or_admin
on public.asset_items
for delete
to authenticated
using (
  auth.uid() = created_by_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);
