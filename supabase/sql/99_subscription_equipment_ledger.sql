-- 2026-10-29: plan 103 — 구독 관리 · 비품 관리 (대장 3테이블 · 요청 · 요청 댓글 · 권한자 판정 · RLS · Realtime · 알림 6 type · 푸시 그룹)
-- File: 99_subscription_equipment_ledger.sql
-- Plan: 103_subscription-equipment-ledger-plan.md (§데이터 모델 · §함수·RLS · §알림·푸시 CHECK)
-- Date: 2026-10-29
-- Status: Completed
-- Remote migration: 99_subscription_equipment_ledger — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용(사용자 별도 확인)
-- Summary:
--   1) private.is_asset_manager(uid) — active AND (admin OR (user AND wake AND rank in (인사팀, 회계팀))).
--      TS `isAssetManager`(src/features/auth/api/asset-access.server.ts)와 같은 규칙 · SECURITY DEFINER · search_path=''
--   2) subscriptions · subscription_assignees · equipment_items — 대장. source(excel_import|manual|e2e) 표식 ·
--      import_key(이관 재실행 중복 방지). SELECT RLS = 권한자만(일반 직원은 Route가 service role로 읽고 허용 목록 투영)
--   3) asset_requests — 요청(target_type subscription|equipment · FK on delete restrict = 요청 있으면 대장 삭제 불가) ·
--      진행 중(pending·in_progress) 같은 사람·같은 줄 부분 unique(409) · 반려 사유 CHECK
--   4) asset_request_comments — plan 43 support_comments 구조(path·depth 트리 트리거 · soft delete) + edited_at ·
--      replica identity full · supabase_realtime publication
--   5) 쓰기는 Route Handler(service role)만 — authenticated/anon INSERT·UPDATE·DELETE 권한 없음
--   6) notifications_type_check 31 → 37종(asset_request.* 6종 추가 · 기존 31종은 적용 직전 Dev 조회값 그대로 보존)
--   7) push_notification_preferences_groups_check 9 → 10그룹(asset_request)
-- 비밀번호·로그인 정보 칸은 만들지 않는다(D-8). 관리 메모의 비밀번호 패턴 차단은 Route 검증(SECRET_LIKE_PATTERN).
-- 롤백(역순):
--   alter publication supabase_realtime drop table public.asset_request_comments;
--   drop table if exists public.asset_request_comments;
--   drop table if exists public.asset_requests;
--   drop table if exists public.subscription_assignees;
--   drop table if exists public.equipment_items;
--   drop table if exists public.subscriptions;
--   drop function if exists public.prepare_asset_request_comment_tree();
--   drop function if exists public.guard_asset_request_comment_update();
--   drop function if exists private.is_asset_manager(uuid);
--   notifications_type_check · push_notification_preferences_groups_check → 이 파일 이전 목록(31종 · 9그룹)으로 재생성

-- ---------------------------------------------------------------------------
-- 1. 권한자 판정 함수 (private · SECURITY DEFINER — RLS 재귀 방지)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_asset_manager(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid is not null and exists (
    select 1
    from public.profiles p
    where p.user_id = p_uid
      and p.status = 'active'
      and (
        p.system_role = 'admin'::public.system_role
        or (p.system_role = 'user'::public.system_role
            and p.affiliation = 'wake'
            and p.rank in ('인사팀', '회계팀'))
      )
  );
$$;

comment on function private.is_asset_manager(uuid) is
  'plan 103 — 구독·비품 권한자(admin · 웨이크 인사팀 · 웨이크 회계팀 · active). TS isAssetManager와 같은 규칙';

revoke all on function private.is_asset_manager(uuid) from public, anon;
grant execute on function private.is_asset_manager(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. subscriptions (구독 대장)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  category text not null
    check (category in ('creative', 'software', 'collaboration', 'etc')),
  name text not null check (char_length(trim(name)) between 1 and 80),
  plan_name text check (plan_name is null or char_length(plan_name) <= 80),
  purpose text check (purpose is null or char_length(purpose) <= 200),
  status text not null default 'active'
    check (status in ('active', 'cancel_scheduled', 'canceled')),
  expires_on date,
  -- 권한자 전용 칸 (Route 투영으로 일반 직원 응답에서 키 자체를 뺀다)
  payer_entity text
    check (payer_entity in ('wake', 'sans', 'sans_foundry', 'kinky', 'beyond_food', 'personal_card', 'unknown')),
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  billing_cycle text check (billing_cycle in ('monthly', 'yearly')),
  billing_day smallint check (billing_day between 1 and 31),
  billing_date date,
  amount numeric(14, 2) check (amount >= 0),
  currency text check (currency in ('KRW', 'USD')),
  amount_varies boolean not null default false,
  started_on date,
  owner_account text check (
    owner_account is null
    or (char_length(owner_account) <= 120 and owner_account ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  ),
  manager_memo text check (manager_memo is null or char_length(manager_memo) <= 1000),
  -- 출처 표식: API = manual · 이관 스크립트 = excel_import · E2E 헬퍼 = e2e (cleanup은 excel_import를 절대 지우지 않는다)
  source text not null default 'manual' check (source in ('excel_import', 'manual', 'e2e')),
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'plan 103 — 구독 대장(한 번에 결제되는 묶음 1줄). 결제·카드·주계정·관리 메모는 권한자 전용(Route 허용 목록 투영). 비밀번호 칸 없음. 쓰기는 service_role Route만';
comment on column public.subscriptions.import_key is '엑셀 이관 행 키 `{시트명}:{행번호}` — 재실행 시 on conflict do nothing(앱에서 고친 값 보존)';
comment on column public.subscriptions.source is 'excel_import | manual | e2e — e2e cleanup은 e2e(+ manual·E2E 접두)만 삭제';

create index if not exists idx_subscriptions_category_name on public.subscriptions (category, name);
create index if not exists idx_subscriptions_status on public.subscriptions (status);
create index if not exists idx_subscriptions_source on public.subscriptions (source);
create index if not exists idx_subscriptions_created_by on public.subscriptions (created_by);
create index if not exists idx_subscriptions_updated_by on public.subscriptions (updated_by);

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. subscription_assignees (구독 대상자 — 사람 · 팀(소속+부서) · 소속 전체)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_assignees (
  id bigint generated always as identity primary key,
  subscription_id bigint not null references public.subscriptions (id) on delete cascade,
  assignee_type text not null check (assignee_type in ('user', 'team', 'affiliation')),
  user_id uuid references auth.users (id) on delete cascade,
  affiliation text check (affiliation in ('wake', 'sans', 'sans_foundry')),
  rank text check (rank is null or char_length(rank) between 1 and 40),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint subscription_assignees_shape_check check (
    (assignee_type = 'user' and user_id is not null and affiliation is null and rank is null)
    or (assignee_type = 'team' and user_id is null and affiliation is not null and rank is not null)
    or (assignee_type = 'affiliation' and user_id is null and affiliation is not null and rank is null)
  )
);

comment on table public.subscription_assignees is
  'plan 103 — 구독 대상자. 동방특송 불가(affiliation CHECK · 사람은 Route가 비동방 active만 허용). PATCH 시 Route가 diff로 교체';

create unique index if not exists idx_subscription_assignees_unique
  on public.subscription_assignees (
    subscription_id,
    assignee_type,
    coalesce(user_id::text, ''),
    coalesce(affiliation, ''),
    coalesce(rank, '')
  );
create index if not exists idx_subscription_assignees_user on public.subscription_assignees (user_id);
create index if not exists idx_subscription_assignees_team on public.subscription_assignees (affiliation, rank);
create index if not exists idx_subscription_assignees_created_by on public.subscription_assignees (created_by);

-- ---------------------------------------------------------------------------
-- 4. equipment_items (비품 대장)
-- ---------------------------------------------------------------------------
create table if not exists public.equipment_items (
  id bigint generated always as identity primary key,
  asset_no text not null unique
    check (asset_no ~ '^(N|M|W|S|K|T|R|F|TER|A|P)-[0-9]{3,4}$'),
  kind text not null
    check (kind in ('notebook', 'monitor', 'desktop', 'mouse', 'keyboard', 'tablet', 'store_device', 'etc')),
  model_serial text check (model_serial is null or char_length(model_serial) <= 120),
  status text not null default 'in_use'
    check (status in ('in_use', 'stored', 'repair', 'lost', 'disposed')),
  assignee_type text check (assignee_type in ('user', 'team')),
  assignee_user_id uuid references auth.users (id),
  assignee_affiliation text check (assignee_affiliation in ('wake', 'sans', 'sans_foundry')),
  assignee_rank text check (assignee_rank is null or char_length(assignee_rank) between 1 and 40),
  -- 권한자 전용 칸
  ledger_entity text check (ledger_entity in ('wake', 'sans', 'sans_foundry', 'kinky', 'beyond_food')),
  ledger_code text check (ledger_code is null or char_length(ledger_code) <= 40),
  purchase_amount numeric(14, 0) check (purchase_amount >= 0),
  purchased_on date,
  vendor text check (vendor is null or char_length(vendor) <= 80),
  manager_memo text check (manager_memo is null or char_length(manager_memo) <= 1000),
  source text not null default 'manual' check (source in ('excel_import', 'manual', 'e2e')),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_items_assignee_shape_check check (
    (assignee_type is null and assignee_user_id is null and assignee_affiliation is null and assignee_rank is null)
    or (assignee_type = 'user' and assignee_user_id is not null and assignee_affiliation is null and assignee_rank is null)
    or (assignee_type = 'team' and assignee_user_id is null and assignee_affiliation is not null and assignee_rank is not null)
  ),
  -- 품목 ↔ 자산번호 접두사 (plan §데이터 모델 표). 'T-%'는 'TER-'와 겹치지 않는다(두 번째 글자가 '-')
  constraint equipment_items_prefix_kind_check check (
    (kind = 'notebook' and asset_no like 'N-%')
    or (kind = 'monitor' and asset_no like 'M-%')
    or (kind = 'desktop' and asset_no like 'W-%')
    or (kind = 'mouse' and asset_no like 'S-%')
    or (kind = 'keyboard' and asset_no like 'K-%')
    or (kind = 'tablet' and asset_no like 'T-%')
    or (kind = 'store_device' and (asset_no like 'R-%' or asset_no like 'F-%' or asset_no like 'TER-%'))
    or (kind = 'etc' and (asset_no like 'A-%' or asset_no like 'P-%'))
  )
);

comment on table public.equipment_items is
  'plan 103 — 비품 대장(자산번호 unique · 품목↔접두사 CHECK · 사용자 1명/팀/비어 있음). 구입 정보·관리 메모는 권한자 전용. 쓰기는 service_role Route만';

create index if not exists idx_equipment_items_kind_asset_no on public.equipment_items (kind, asset_no);
create index if not exists idx_equipment_items_status on public.equipment_items (status);
create index if not exists idx_equipment_items_assignee_user on public.equipment_items (assignee_user_id);
create index if not exists idx_equipment_items_assignee_team on public.equipment_items (assignee_affiliation, assignee_rank);
create index if not exists idx_equipment_items_source on public.equipment_items (source);
create index if not exists idx_equipment_items_created_by on public.equipment_items (created_by);
create index if not exists idx_equipment_items_updated_by on public.equipment_items (updated_by);

drop trigger if exists trg_equipment_items_updated_at on public.equipment_items;
create trigger trg_equipment_items_updated_at
  before update on public.equipment_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. asset_requests (구독·비품 요청)
-- ---------------------------------------------------------------------------
create table if not exists public.asset_requests (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('subscription', 'equipment')),
  subscription_id bigint references public.subscriptions (id) on delete restrict,
  equipment_id bigint references public.equipment_items (id) on delete restrict,
  target_label text not null check (char_length(trim(target_label)) between 1 and 200),
  request_type text not null,
  body text not null check (char_length(trim(body)) between 5 and 2000),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'rejected', 'canceled')),
  requester_user_id uuid not null references auth.users (id),
  requester_name text not null,
  assignee_user_id uuid references auth.users (id) on delete set null,
  reject_reason text,
  status_updated_at timestamptz,
  status_updated_by uuid references auth.users (id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_requests_target_check check (
    (target_type = 'subscription' and subscription_id is not null and equipment_id is null)
    or (target_type = 'equipment' and equipment_id is not null and subscription_id is null)
  ),
  constraint asset_requests_request_type_check check (
    (target_type = 'equipment' and request_type in ('repair', 'replace', 'return', 'lost', 'other'))
    or (target_type = 'subscription' and request_type in ('cancel', 'change', 'other'))
  ),
  constraint asset_requests_reject_reason_check check (
    (status = 'rejected' and reject_reason is not null and char_length(trim(reject_reason)) between 1 and 500)
    or (status <> 'rejected' and reject_reason is null)
  )
);

comment on table public.asset_requests is
  'plan 103 — 구독·비품 요청(접수대기→처리중→완료/반려 · 요청자 취소). 요청자 본인 + 권한자만 열람. 본문·반려 사유는 activity_logs·알림 metadata에 저장 금지. 쓰기는 service_role Route만';
comment on column public.asset_requests.target_label is '생성 시 스냅샷(예: N-012 · MacBook Air 13 / Adobe Creative Cloud · 모든 앱)';
comment on column public.asset_requests.edited_at is '요청자 수정 시각(「수정됨」 표시) — 상태 변경은 status_updated_at';

create index if not exists idx_asset_requests_target_status
  on public.asset_requests (target_type, status, created_at desc);
create index if not exists idx_asset_requests_requester
  on public.asset_requests (requester_user_id, created_at desc);
create index if not exists idx_asset_requests_assignee on public.asset_requests (assignee_user_id);
create index if not exists idx_asset_requests_subscription on public.asset_requests (subscription_id);
create index if not exists idx_asset_requests_equipment on public.asset_requests (equipment_id);
create index if not exists idx_asset_requests_status_updated_by on public.asset_requests (status_updated_by);

-- D-13 — 같은 사람이 같은 줄에 진행 중(접수대기·처리중) 요청 2개 금지 → Route 409
create unique index if not exists idx_asset_requests_one_open_per_target
  on public.asset_requests (requester_user_id, coalesce(subscription_id, 0), coalesce(equipment_id, 0))
  where status in ('pending', 'in_progress');

drop trigger if exists trg_asset_requests_updated_at on public.asset_requests;
create trigger trg_asset_requests_updated_at
  before update on public.asset_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. asset_request_comments (요청 댓글 · plan 43 구조 복제)
-- ---------------------------------------------------------------------------
create table if not exists public.asset_request_comments (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.asset_requests (id) on delete cascade,
  author_user_id uuid not null references auth.users (id),
  parent_id bigint references public.asset_request_comments (id),
  root_comment_id bigint references public.asset_request_comments (id),
  path text not null,
  depth integer not null default 0 check (depth >= 0),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_request_comments_deleted_state_check check (
    (is_deleted = false and deleted_at is null and deleted_by is null)
    or (is_deleted = true and deleted_at is not null)
  )
);

comment on table public.asset_request_comments is
  'plan 103 — 구독·비품 요청 댓글/답글(임의 깊이 · soft delete). 작성 = 요청자 + 권한자. 본문은 activity_logs·알림 metadata 저장 금지';
comment on column public.asset_request_comments.path is '서버 계산 트리 정렬 경로 — id 10자리 lpad를 . 으로 연결';

create unique index if not exists idx_asset_request_comments_request_id_unique
  on public.asset_request_comments (request_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'asset_request_comments_parent_same_request_fk'
  ) then
    alter table public.asset_request_comments
      add constraint asset_request_comments_parent_same_request_fk
      foreign key (request_id, parent_id)
      references public.asset_request_comments (request_id, id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'asset_request_comments_root_same_request_fk'
  ) then
    alter table public.asset_request_comments
      add constraint asset_request_comments_root_same_request_fk
      foreign key (request_id, root_comment_id)
      references public.asset_request_comments (request_id, id);
  end if;
end $$;

create index if not exists idx_asset_request_comments_request_path
  on public.asset_request_comments (request_id, path);
create index if not exists idx_asset_request_comments_parent on public.asset_request_comments (parent_id);
create index if not exists idx_asset_request_comments_root on public.asset_request_comments (root_comment_id);
create index if not exists idx_asset_request_comments_author on public.asset_request_comments (author_user_id);
create index if not exists idx_asset_request_comments_deleted_by on public.asset_request_comments (deleted_by);
create index if not exists idx_asset_request_comments_request_parent
  on public.asset_request_comments (request_id, parent_id);
create index if not exists idx_asset_request_comments_request_root
  on public.asset_request_comments (request_id, root_comment_id);

create or replace function public.prepare_asset_request_comment_tree()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.asset_request_comments%rowtype;
begin
  if new.parent_id is null then
    new.root_comment_id := new.id;
    new.path := lpad(new.id::text, 10, '0');
    new.depth := 0;
    return new;
  end if;

  select * into v_parent
  from public.asset_request_comments c
  where c.id = new.parent_id
    and c.request_id = new.request_id;

  if not found then
    raise exception 'parent comment must belong to the same asset request';
  end if;

  new.root_comment_id := coalesce(v_parent.root_comment_id, v_parent.id);
  new.path := v_parent.path || '.' || lpad(new.id::text, 10, '0');
  new.depth := v_parent.depth + 1;
  return new;
end;
$$;

drop trigger if exists trg_asset_request_comments_prepare_tree on public.asset_request_comments;
create trigger trg_asset_request_comments_prepare_tree
  before insert on public.asset_request_comments
  for each row execute function public.prepare_asset_request_comment_tree();

create or replace function public.guard_asset_request_comment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.request_id is distinct from new.request_id
    or old.author_user_id is distinct from new.author_user_id
    or old.parent_id is distinct from new.parent_id
    or old.root_comment_id is distinct from new.root_comment_id
    or old.path is distinct from new.path
    or old.depth is distinct from new.depth then
    raise exception 'asset_request_comments tree fields are immutable';
  end if;

  if old.is_deleted = true and new.is_deleted = false then
    raise exception 'asset_request_comments cannot be undeleted';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_asset_request_comments_guard_update on public.asset_request_comments;
create trigger trg_asset_request_comments_guard_update
  before update on public.asset_request_comments
  for each row execute function public.guard_asset_request_comment_update();

drop trigger if exists trg_asset_request_comments_updated_at on public.asset_request_comments;
create trigger trg_asset_request_comments_updated_at
  before update on public.asset_request_comments
  for each row execute function public.set_updated_at();

revoke all on function public.prepare_asset_request_comment_tree() from public, anon, authenticated;
revoke all on function public.guard_asset_request_comment_update() from public, anon, authenticated;
grant execute on function public.prepare_asset_request_comment_tree() to service_role;
grant execute on function public.guard_asset_request_comment_update() to service_role;

-- ---------------------------------------------------------------------------
-- 7. RLS · 권한
--    대장 3테이블: 권한자만 SELECT (일반 직원 화면 데이터는 Route가 service role로 읽고 칸을 고른다)
--    요청·댓글: 비동방 AND (요청자 본인 OR 권한자) — Realtime 수신 범위와 같다
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.subscription_assignees enable row level security;
alter table public.equipment_items enable row level security;
alter table public.asset_requests enable row level security;
alter table public.asset_request_comments enable row level security;

drop policy if exists subscriptions_select_asset_manager on public.subscriptions;
create policy subscriptions_select_asset_manager
  on public.subscriptions for select to authenticated
  using (private.is_asset_manager((select auth.uid())));

drop policy if exists subscription_assignees_select_asset_manager on public.subscription_assignees;
create policy subscription_assignees_select_asset_manager
  on public.subscription_assignees for select to authenticated
  using (private.is_asset_manager((select auth.uid())));

drop policy if exists equipment_items_select_asset_manager on public.equipment_items;
create policy equipment_items_select_asset_manager
  on public.equipment_items for select to authenticated
  using (private.is_asset_manager((select auth.uid())));

drop policy if exists asset_requests_select_requester_or_manager on public.asset_requests;
create policy asset_requests_select_requester_or_manager
  on public.asset_requests for select to authenticated
  using (
    not private.is_dongbang_user((select auth.uid()))
    and (
      requester_user_id = (select auth.uid())
      or private.is_asset_manager((select auth.uid()))
    )
  );

drop policy if exists asset_request_comments_select_requester_or_manager on public.asset_request_comments;
create policy asset_request_comments_select_requester_or_manager
  on public.asset_request_comments for select to authenticated
  using (
    not private.is_dongbang_user((select auth.uid()))
    and exists (
      select 1
      from public.asset_requests r
      where r.id = asset_request_comments.request_id
        and (
          r.requester_user_id = (select auth.uid())
          or private.is_asset_manager((select auth.uid()))
        )
    )
  );

revoke all on table public.subscriptions from anon;
revoke all on table public.subscription_assignees from anon;
revoke all on table public.equipment_items from anon;
revoke all on table public.asset_requests from anon;
revoke all on table public.asset_request_comments from anon;

revoke insert, update, delete, truncate on table public.subscriptions from authenticated;
revoke insert, update, delete, truncate on table public.subscription_assignees from authenticated;
revoke insert, update, delete, truncate on table public.equipment_items from authenticated;
revoke insert, update, delete, truncate on table public.asset_requests from authenticated;
revoke insert, update, delete, truncate on table public.asset_request_comments from authenticated;

grant select on table public.subscriptions to authenticated;
grant select on table public.subscription_assignees to authenticated;
grant select on table public.equipment_items to authenticated;
grant select on table public.asset_requests to authenticated;
grant select on table public.asset_request_comments to authenticated;

grant all on table public.subscriptions to service_role;
grant all on table public.subscription_assignees to service_role;
grant all on table public.equipment_items to service_role;
grant all on table public.asset_requests to service_role;
grant all on table public.asset_request_comments to service_role;

-- ---------------------------------------------------------------------------
-- 8. Realtime (댓글만 · INSERT/UPDATE)
-- ---------------------------------------------------------------------------
alter table public.asset_request_comments replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'asset_request_comments'
  ) then
    alter publication supabase_realtime add table public.asset_request_comments;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. 알림 type CHECK (31 → 37) — 기존 31종은 2026-10-29 적용 직전 Dev `pg_get_constraintdef` 조회값 그대로
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'user.update',
      'user.approval_request_admin',
      'contract.reminder_admin',
      'contract.reminder_recipient',
      'contract.import_admin',
      'contract.import_author',
      'wallet.sync_admin',
      'wallet.sync_recipient',
      'wallet.balance_email',
      'wallet.balance_email_admin',
      'announcement.published',
      'support.created',
      'support.updated',
      'support.status_changed',
      'support.comment_created',
      'support.reply_created',
      'benefit.import_operations',
      'benefit.import_applicant',
      'benefit.document_cancel_operations',
      'benefit.document_cancel_applicant',
      'benefit.document_restore_operations',
      'benefit.document_restore_applicant',
      'workflow.approval_requested',
      'workflow.referrer_requested',
      'workflow.completed',
      'workflow.declined',
      'workflow.canceled',
      'workflow.comment_created',
      'quick_request.vendor_event',
      'quick_request.requester_event',
      'quick_request.chat_message',
      -- plan 103
      'asset_request.created',
      'asset_request.updated',
      'asset_request.canceled',
      'asset_request.status_changed',
      'asset_request.assigned',
      'asset_request.comment_created'
    )
  );

-- ---------------------------------------------------------------------------
-- 10. 푸시 그룹 CHECK (9 → 10) — push-groups.ts PUSH_GROUP_KEYS와 같은 목록
-- ---------------------------------------------------------------------------
alter table public.push_notification_preferences
  drop constraint if exists push_notification_preferences_groups_check;
alter table public.push_notification_preferences
  add constraint push_notification_preferences_groups_check check (
    disabled_groups <@ array[
      'profile', 'users', 'contract', 'wallet', 'announcement',
      'support', 'benefit', 'workflow', 'quick_request', 'asset_request'
    ]::text[]
  );
