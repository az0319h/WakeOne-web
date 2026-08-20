-- 2026-08-20: CS 문의 댓글/대댓글 및 support 알림 타입 확장 (plan 43)
-- File: 46_support_comments_notifications.sql
-- Plan: 43_cs-support-comments-notifications-plan.md
-- Date: 2026-08-20
-- Status: Approved
-- Remote migration: applied via MCP (2026-08-20)
-- Summary: support_comments tree/soft-delete/RLS/Realtime + support notification types

create table public.support_comments (
  id bigint generated always as identity primary key,
  support_request_id bigint not null references public.support_requests(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  parent_id bigint references public.support_comments(id),
  root_comment_id bigint references public.support_comments(id),
  path text not null,
  depth integer not null default 0 check (depth >= 0),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_comments_deleted_state_check check (
    (is_deleted = false and deleted_at is null and deleted_by is null)
    or (is_deleted = true and deleted_at is not null and deleted_by is not null)
  )
);

comment on table public.support_comments is 'CS 문의 댓글/대댓글 (plan 43, soft delete only)';
comment on column public.support_comments.path is '서버 계산 tree 정렬 경로. id를 10자리 lpad로 연결한다.';
comment on column public.support_comments.depth is '서버 계산 depth. UI는 visual indent만 clamp한다.';
comment on column public.support_comments.is_deleted is 'soft delete 상태. hard delete는 trigger로 금지한다.';

create unique index idx_support_comments_request_id_unique
  on public.support_comments (support_request_id, id);

alter table public.support_comments
  add constraint support_comments_parent_same_request_fk
  foreign key (support_request_id, parent_id)
  references public.support_comments (support_request_id, id);

alter table public.support_comments
  add constraint support_comments_root_same_request_fk
  foreign key (support_request_id, root_comment_id)
  references public.support_comments (support_request_id, id);

create index idx_support_comments_request_path
  on public.support_comments (support_request_id, path);

create index idx_support_comments_request_created
  on public.support_comments (support_request_id, created_at, id);

create index idx_support_comments_parent
  on public.support_comments (parent_id);

create index idx_support_comments_root
  on public.support_comments (root_comment_id);

create index idx_support_comments_author
  on public.support_comments (author_user_id);

create index idx_support_comments_deleted_by
  on public.support_comments (deleted_by);

create index idx_support_comments_request_parent
  on public.support_comments (support_request_id, parent_id);

create index idx_support_comments_request_root
  on public.support_comments (support_request_id, root_comment_id);

create or replace function public.prepare_support_comment_tree()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  parent_comment public.support_comments%rowtype;
begin
  if new.parent_id is null then
    new.root_comment_id := new.id;
    new.path := lpad(new.id::text, 10, '0');
    new.depth := 0;
    return new;
  end if;

  select *
  into parent_comment
  from public.support_comments
  where id = new.parent_id
    and support_request_id = new.support_request_id;

  if not found then
    raise exception 'parent comment must belong to the same support request';
  end if;

  new.root_comment_id := coalesce(parent_comment.root_comment_id, parent_comment.id);
  new.path := parent_comment.path || '.' || lpad(new.id::text, 10, '0');
  new.depth := parent_comment.depth + 1;
  return new;
end;
$$;

drop trigger if exists trg_support_comments_prepare_tree on public.support_comments;
create trigger trg_support_comments_prepare_tree
before insert on public.support_comments
for each row
execute function public.prepare_support_comment_tree();

create or replace function public.prevent_support_comment_tree_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.support_request_id is distinct from new.support_request_id
    or old.author_user_id is distinct from new.author_user_id
    or old.parent_id is distinct from new.parent_id
    or old.root_comment_id is distinct from new.root_comment_id
    or old.path is distinct from new.path
    or old.depth is distinct from new.depth then
    raise exception 'support_comments tree fields are immutable';
  end if;

  if old.is_deleted = true and new.is_deleted = false then
    raise exception 'support_comments cannot be undeleted';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_support_comments_prevent_tree_mutation on public.support_comments;
create trigger trg_support_comments_prevent_tree_mutation
before update on public.support_comments
for each row
execute function public.prevent_support_comment_tree_mutation();

drop trigger if exists trg_support_comments_updated_at on public.support_comments;
create trigger trg_support_comments_updated_at
before update on public.support_comments
for each row
execute function public.set_updated_at();

create or replace function public.prevent_support_comments_hard_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'support_comments hard delete is not allowed';
end;
$$;

drop trigger if exists trg_support_comments_no_delete on public.support_comments;
create trigger trg_support_comments_no_delete
before delete on public.support_comments
for each row
execute function public.prevent_support_comments_hard_delete();

alter table public.support_comments enable row level security;

drop policy if exists support_comments_select_owner_or_admin on public.support_comments;
create policy support_comments_select_owner_or_admin
on public.support_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.support_requests sr
    where sr.id = support_comments.support_request_id
      and (
        sr.submitted_by = (select auth.uid())
        or exists (
          select 1
          from public.profiles p
          where p.user_id = (select auth.uid())
            and p.system_role = 'admin'
        )
      )
  )
);

revoke insert, update, delete on public.support_comments from authenticated;
revoke insert, update, delete on public.support_comments from anon;

alter table public.support_comments replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_comments'
  ) then
    alter publication supabase_realtime add table public.support_comments;
  end if;
end $$;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'user.update',
      'contract.reminder_admin',
      'contract.reminder_recipient',
      'wallet.sync_admin',
      'wallet.sync_recipient',
      'announcement.published',
      'support.created',
      'support.updated',
      'support.status_changed',
      'support.comment_created',
      'support.reply_created'
    )
  );
