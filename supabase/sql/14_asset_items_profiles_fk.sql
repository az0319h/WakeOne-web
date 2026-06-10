-- 2026-06-09: asset_items 사용자 FK를 profiles로 정렬
-- File: 14_asset_items_profiles_fk.sql
-- Plan: 15_asset-ledger-plan.md
-- Date: 2026-06-09
-- Status: Completed
-- Remote migration: applied (14_asset_items_profiles_fk)
-- Summary: rewire asset_items user foreign keys from auth.users to public.profiles(user_id) for PostgREST profile embedding

alter table public.asset_items
  drop constraint if exists asset_items_actual_user_id_fkey,
  drop constraint if exists asset_items_created_by_id_fkey,
  drop constraint if exists asset_items_updated_by_id_fkey;

alter table public.asset_items
  add constraint asset_items_actual_user_id_fkey
    foreign key (actual_user_id)
    references public.profiles(user_id)
    on delete set null;

alter table public.asset_items
  add constraint asset_items_created_by_id_fkey
    foreign key (created_by_id)
    references public.profiles(user_id)
    on delete restrict;

alter table public.asset_items
  add constraint asset_items_updated_by_id_fkey
    foreign key (updated_by_id)
    references public.profiles(user_id)
    on delete restrict;
