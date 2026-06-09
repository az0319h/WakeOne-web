-- File: 12_office_snack_vote.sql
-- Plan: 13_office-snack-vote-plan.md
-- Date: 2026-06-08
-- Status: Completed
-- Remote migration: applied (12_office_snack_vote)
-- Summary: office snack session/candidate/vote schema, constraints, RLS, results view

create table if not exists public.office_snack_sessions (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  registration_start_at timestamptz not null,
  registration_end_at timestamptz not null,
  voting_start_at timestamptz not null,
  voting_end_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_snack_sessions_time_order_check check (
    registration_start_at < registration_end_at
    and registration_end_at < voting_start_at
    and voting_start_at < voting_end_at
  )
);

create index if not exists idx_office_snack_sessions_created_at
  on public.office_snack_sessions (created_at desc);

create index if not exists idx_office_snack_sessions_periods
  on public.office_snack_sessions (
    registration_start_at,
    registration_end_at,
    voting_start_at,
    voting_end_at
  );

drop trigger if exists trg_office_snack_sessions_updated_at on public.office_snack_sessions;
create trigger trg_office_snack_sessions_updated_at
before update on public.office_snack_sessions
for each row
execute function public.set_updated_at();

create table if not exists public.office_snack_candidates (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.office_snack_sessions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  product_url text not null,
  image_url text,
  price integer not null check (price > 0 and price <= 50000),
  source_type text not null default 'parsed' check (source_type in ('parsed', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_snack_candidates_one_per_user_per_session unique (session_id, owner_user_id)
);

create index if not exists idx_office_snack_candidates_session_created
  on public.office_snack_candidates (session_id, created_at asc);

create index if not exists idx_office_snack_candidates_owner_session
  on public.office_snack_candidates (owner_user_id, session_id);

drop trigger if exists trg_office_snack_candidates_updated_at on public.office_snack_candidates;
create trigger trg_office_snack_candidates_updated_at
before update on public.office_snack_candidates
for each row
execute function public.set_updated_at();

create table if not exists public.office_snack_votes (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.office_snack_sessions(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  rank1_candidate_id bigint not null references public.office_snack_candidates(id) on delete restrict,
  rank2_candidate_id bigint not null references public.office_snack_candidates(id) on delete restrict,
  rank3_candidate_id bigint not null references public.office_snack_candidates(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint office_snack_votes_one_per_user_per_session unique (session_id, voter_user_id),
  constraint office_snack_votes_distinct_ranks_check check (
    rank1_candidate_id <> rank2_candidate_id
    and rank1_candidate_id <> rank3_candidate_id
    and rank2_candidate_id <> rank3_candidate_id
  )
);

create index if not exists idx_office_snack_votes_session_created
  on public.office_snack_votes (session_id, created_at desc);

create index if not exists idx_office_snack_votes_voter_session
  on public.office_snack_votes (voter_user_id, session_id);

create or replace function public.validate_office_snack_vote_candidates()
returns trigger
language plpgsql
as $$
declare
  session_rank1 bigint;
  session_rank2 bigint;
  session_rank3 bigint;
begin
  select session_id into session_rank1 from public.office_snack_candidates where id = new.rank1_candidate_id;
  select session_id into session_rank2 from public.office_snack_candidates where id = new.rank2_candidate_id;
  select session_id into session_rank3 from public.office_snack_candidates where id = new.rank3_candidate_id;

  if session_rank1 is null or session_rank2 is null or session_rank3 is null then
    raise exception '투표 후보를 찾을 수 없습니다.';
  end if;

  if session_rank1 <> new.session_id
    or session_rank2 <> new.session_id
    or session_rank3 <> new.session_id then
    raise exception '다른 회차의 후보에는 투표할 수 없습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_office_snack_votes_validate_candidates on public.office_snack_votes;
create trigger trg_office_snack_votes_validate_candidates
before insert on public.office_snack_votes
for each row
execute function public.validate_office_snack_vote_candidates();

create or replace function public.prevent_office_snack_vote_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'office_snack_votes는 수정/삭제할 수 없습니다.';
end;
$$;

drop trigger if exists trg_office_snack_votes_no_update_delete on public.office_snack_votes;
create trigger trg_office_snack_votes_no_update_delete
before update or delete on public.office_snack_votes
for each row
execute function public.prevent_office_snack_vote_mutation();

create or replace view public.office_snack_results
with (security_invoker = true)
as
with scored as (
  select
    c.session_id,
    c.id as candidate_id,
    c.name as candidate_name,
    c.product_url,
    c.image_url,
    c.price,
    c.owner_user_id,
    c.created_at as candidate_created_at,
    coalesce(sum(case when v.rank1_candidate_id = c.id then 5 else 0 end), 0) as rank1_score,
    coalesce(sum(case when v.rank2_candidate_id = c.id then 3 else 0 end), 0) as rank2_score,
    coalesce(sum(case when v.rank3_candidate_id = c.id then 1 else 0 end), 0) as rank3_score
  from public.office_snack_candidates c
  left join public.office_snack_votes v
    on v.session_id = c.session_id
  group by
    c.session_id,
    c.id,
    c.name,
    c.product_url,
    c.image_url,
    c.price,
    c.owner_user_id,
    c.created_at
)
select
  scored.*,
  (scored.rank1_score + scored.rank2_score + scored.rank3_score) as total_score,
  rank() over (
    partition by scored.session_id
    order by
      (scored.rank1_score + scored.rank2_score + scored.rank3_score) desc,
      scored.candidate_created_at asc
  ) as rank
from scored;

alter table public.office_snack_sessions enable row level security;
alter table public.office_snack_candidates enable row level security;
alter table public.office_snack_votes enable row level security;

drop policy if exists office_snack_sessions_select_authenticated on public.office_snack_sessions;
create policy office_snack_sessions_select_authenticated
on public.office_snack_sessions
for select
to authenticated
using (true);

drop policy if exists office_snack_sessions_insert_admin on public.office_snack_sessions;
create policy office_snack_sessions_insert_admin
on public.office_snack_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists office_snack_sessions_update_admin on public.office_snack_sessions;
create policy office_snack_sessions_update_admin
on public.office_snack_sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists office_snack_candidates_select_authenticated on public.office_snack_candidates;
create policy office_snack_candidates_select_authenticated
on public.office_snack_candidates
for select
to authenticated
using (true);

drop policy if exists office_snack_candidates_insert_owner on public.office_snack_candidates;
create policy office_snack_candidates_insert_owner
on public.office_snack_candidates
for insert
to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists office_snack_candidates_update_owner_or_admin on public.office_snack_candidates;
create policy office_snack_candidates_update_owner_or_admin
on public.office_snack_candidates
for update
to authenticated
using (
  auth.uid() = owner_user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
)
with check (
  auth.uid() = owner_user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists office_snack_candidates_delete_owner_or_admin on public.office_snack_candidates;
create policy office_snack_candidates_delete_owner_or_admin
on public.office_snack_candidates
for delete
to authenticated
using (
  auth.uid() = owner_user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists office_snack_votes_select_self_or_admin on public.office_snack_votes;
create policy office_snack_votes_select_self_or_admin
on public.office_snack_votes
for select
to authenticated
using (
  auth.uid() = voter_user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists office_snack_votes_insert_self on public.office_snack_votes;
create policy office_snack_votes_insert_self
on public.office_snack_votes
for insert
to authenticated
with check (auth.uid() = voter_user_id);
