-- File: 27_profiles_slim_drop_fields.sql
-- Plan: 21_user-profile-slim-migration-plan.md
-- Date: 2026-07-10
-- Status: Completed
-- Remote migration: applied (27_profiles_slim_drop_fields)
-- Summary: DROP profiles department, job_title, food_restrictions

alter table public.profiles
  drop constraint if exists profiles_job_title_length,
  drop constraint if exists profiles_food_restrictions_length;

alter table public.profiles
  drop column if exists department,
  drop column if exists job_title,
  drop column if exists food_restrictions;
