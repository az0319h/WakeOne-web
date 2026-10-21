-- 2026-10-21: plan 88 — 워크플로우 쓰기 RPC(service_role 전용) + 목록·건수 조회 함수(SECURITY INVOKER, RLS 적용)
-- File: 87_workflow_rpc.sql
-- Plan: 88_workflow-expense-plan.md
-- Date: 2026-10-21
-- Status: Completed
-- Remote migration: 87_workflow_rpc + 87_workflow_rpc_referrer_diff_label (참조 알림 설정만 바뀐 diff 라벨) — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: 쓰기 RPC 15종(SECURITY DEFINER, execute = service_role only, p_actor_user_id로 권한·상태 재검사)
--            workflow_submit_document · workflow_approve · workflow_decline · workflow_cancel_document
--            workflow_update_document · workflow_change_approval_line · workflow_add_comment · workflow_set_star
--            workflow_save_draft · workflow_delete_draft · workflow_set_template_policy
--            workflow_grant_admin · workflow_revoke_admin · workflow_register_attachment · workflow_delete_staged_attachment
--          조회: workflow_list_documents · workflow_document_counts (SECURITY INVOKER → RLS 강제, authenticated 실행)
--          오류 규약: raise exception 'WF{HTTP}:{한국어 문구}' (Route가 파싱해 HTTP status로 변환)
--          조건부 필수 검증은 Route(TS 공유 모듈 required-rules.ts)가 한다. RPC는 구조·권한·상태만 검증한다.

-- ---------------------------------------------------------------------------
-- 0. private helpers (service_role만 실행)
-- ---------------------------------------------------------------------------
create or replace function private.wf_assert_active_actor(p_actor_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.profiles p where p.user_id = p_actor_user_id and p.status = 'active'
  ) then
    raise exception 'WF403:활성화된 계정만 접근할 수 있습니다.';
  end if;
end;
$$;

-- 결재선 구조 검증. p_steps = [["uuid", ...], ...] (배열 순서 = 단계), p_referrers = [{"user_id", "notification_setting"}]
create or replace function private.wf_validate_line(
  p_steps jsonb,
  p_referrers jsonb,
  p_writer_id uuid,
  p_allow_empty boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_step jsonb;
  v_ids uuid[] := '{}';
  v_ref_ids uuid[] := '{}';
  v_ref jsonb;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    raise exception 'WF400:결재선 형식이 올바르지 않습니다.';
  end if;
  if p_referrers is null or jsonb_typeof(p_referrers) <> 'array' then
    raise exception 'WF400:참조자 형식이 올바르지 않습니다.';
  end if;
  if jsonb_array_length(p_steps) > 20 then
    raise exception 'WF400:승인 단계는 최대 20개까지 지정할 수 있습니다.';
  end if;

  for v_step in select value from jsonb_array_elements(p_steps) loop
    if jsonb_typeof(v_step) <> 'array' then
      raise exception 'WF400:결재선 형식이 올바르지 않습니다.';
    end if;
    if jsonb_array_length(v_step) = 0 then
      raise exception 'WF400:승인자가 없는 단계가 있습니다.';
    end if;
    v_ids := v_ids || array(select x::uuid from jsonb_array_elements_text(v_step) x);
  end loop;

  if not p_allow_empty and jsonb_array_length(p_steps) = 0 then
    raise exception 'WF400:승인자를 1명 이상 지정해 주세요.';
  end if;

  if p_writer_id is not null and p_writer_id = any (v_ids) then
    raise exception 'WF400:작성자는 승인자로 지정할 수 없습니다.';
  end if;

  if (select count(distinct u) from unnest(v_ids) u) <> coalesce(cardinality(v_ids), 0) then
    raise exception 'WF400:같은 승인자를 여러 번 지정할 수 없습니다.';
  end if;

  for v_ref in select value from jsonb_array_elements(p_referrers) loop
    if jsonb_typeof(v_ref) <> 'object' or jsonb_typeof(v_ref -> 'user_id') <> 'string' then
      raise exception 'WF400:참조자 형식이 올바르지 않습니다.';
    end if;
    if coalesce(v_ref ->> 'notification_setting', 'START_AND_END') not in ('START_AND_END', 'END', 'NONE') then
      raise exception 'WF400:참조 알림 설정이 올바르지 않습니다.';
    end if;
    v_ref_ids := v_ref_ids || (v_ref ->> 'user_id')::uuid;
  end loop;

  if (select count(distinct u) from unnest(v_ref_ids) u) <> coalesce(cardinality(v_ref_ids), 0) then
    raise exception 'WF400:같은 참조자를 여러 번 지정할 수 없습니다.';
  end if;

  if exists (
    select 1
    from unnest(v_ids || v_ref_ids) u
    where not exists (
      select 1 from public.profiles p where p.user_id = u and p.status = 'active'
    )
  ) then
    raise exception 'WF400:비활성 사용자는 지정할 수 없습니다.';
  end if;
end;
$$;

create or replace function private.wf_template_snapshot(p_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'template_key', t.template_key,
    'name', t.name,
    'emoji', t.emoji,
    'description', t.description,
    'content_visible', t.content_visible,
    'attachment_visible', t.attachment_visible,
    'attachment_required', t.attachment_required,
    'attachment_required_when', t.attachment_required_when,
    'edit_policy', t.edit_policy,
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'field_key', f.field_key,
        'name', f.name,
        'type', f.type,
        'options', f.options,
        'required', f.required,
        'required_when', f.required_when,
        'prefill_type', f.prefill_type,
        'prefill_default', f.prefill_default,
        'display_order', f.display_order
      ) order by f.display_order, f.field_key)
      from public.workflow_template_fields f
      where f.template_id = t.id
    ), '[]'::jsonb)
  )
  from public.workflow_templates t
  where t.id = p_template_id;
$$;

-- p_from_step 이상 단계만 PENDING/WAITING으로 insert
create or replace function private.wf_insert_steps(p_document_id uuid, p_steps jsonb, p_from_step integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_step jsonb;
  v_idx bigint;
begin
  for v_step, v_idx in
    select value, ordinality from jsonb_array_elements(p_steps) with ordinality
  loop
    if v_idx < p_from_step then
      continue;
    end if;
    insert into public.workflow_approval_steps (document_id, step, status)
    values (p_document_id, v_idx::integer, 'PENDING');

    insert into public.workflow_approval_actors (document_id, step, user_id, status, position)
    select p_document_id, v_idx::integer, x.value::uuid, 'WAITING', x.ordinality::integer
    from jsonb_array_elements_text(v_step) with ordinality as x (value, ordinality);
  end loop;
end;
$$;

-- current_step부터 전이 재계산: 모두 승인된 단계는 APPROVED로 넘기고, 남은 단계가 없으면 DONE
create or replace function private.wf_advance(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_step integer;
  v_total integer;
  v_cnt integer;
  v_open integer;
begin
  select current_step, total_steps into v_step, v_total
  from public.workflow_documents where id = p_document_id;

  loop
    if v_step > v_total then
      update public.workflow_documents
      set status = 'DONE', completed_at = now(), current_step = greatest(v_total, 1), updated_at = now()
      where id = p_document_id;
      return jsonb_build_object('done', true, 'ongoing_step', null);
    end if;

    select count(*), count(*) filter (where status <> 'APPROVED')
    into v_cnt, v_open
    from public.workflow_approval_actors
    where document_id = p_document_id and step = v_step;

    if v_cnt > 0 and v_open = 0 then
      update public.workflow_approval_steps set status = 'APPROVED'
      where document_id = p_document_id and step = v_step;
      v_step := v_step + 1;
    else
      update public.workflow_approval_steps set status = 'ONGOING'
      where document_id = p_document_id and step = v_step;
      update public.workflow_documents
      set current_step = v_step, updated_at = now()
      where id = p_document_id;
      return jsonb_build_object('done', false, 'ongoing_step', v_step);
    end if;
  end loop;
end;
$$;

create or replace function private.wf_waiting_actor_ids(p_document_id uuid, p_step integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(a.user_id order by a.position), '[]'::jsonb)
  from public.workflow_approval_actors a
  where a.document_id = p_document_id and a.step = p_step and a.status = 'WAITING';
$$;

-- 결과(완료·반려) 알림 대상: 작성자 + START_AND_END·END 참조자
create or replace function private.wf_end_recipient_ids(p_document_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(distinct u), '[]'::jsonb)
  from (
    select d.writer_id as u from public.workflow_documents d where d.id = p_document_id
    union
    select r.user_id from public.workflow_document_referrers r
    where r.document_id = p_document_id and r.notification_setting in ('START_AND_END', 'END')
  ) s;
$$;

create or replace function private.wf_document_result(p_document_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'document_id', d.id,
    'code', d.code,
    'template_key', d.template_key,
    'template_name', d.template_snapshot ->> 'name',
    'writer_id', d.writer_id,
    'status', d.status,
    'current_step', d.current_step,
    'total_steps', d.total_steps
  )
  from public.workflow_documents d
  where d.id = p_document_id;
$$;

-- 단계별 사람 목록 (diff 계산용)
create or replace function private.wf_line_state(p_document_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'step', s.step,
        'users', coalesce((
          select jsonb_agg(jsonb_build_object(
            'user_id', a.user_id,
            'name', coalesce(nullif(btrim(p.full_name), ''), p.email)
          ) order by a.position, a.user_id)
          from public.workflow_approval_actors a
          left join public.profiles p on p.user_id = a.user_id
          where a.document_id = s.document_id and a.step = s.step
        ), '[]'::jsonb)
      ) order by s.step)
      from public.workflow_approval_steps s
      where s.document_id = p_document_id
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', r.user_id,
        'name', coalesce(nullif(btrim(p.full_name), ''), p.email),
        'notification_setting', r.notification_setting
      ) order by r.position, r.user_id)
      from public.workflow_document_referrers r
      left join public.profiles p on p.user_id = r.user_id
      where r.document_id = p_document_id
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. 제출
-- ---------------------------------------------------------------------------
create or replace function public.workflow_submit_document(
  p_actor_user_id uuid,
  p_template_id uuid,
  p_inputs jsonb,
  p_content_html text,
  p_search_text text,
  p_steps jsonb,
  p_referrers jsonb,
  p_reference_ids uuid[],
  p_attachment_ids uuid[],
  p_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tpl public.workflow_templates%rowtype;
  v_year integer;
  v_no integer;
  v_code text;
  v_doc_id uuid;
  v_ref uuid;
  v_att_ids uuid[] := array(select distinct u from unnest(coalesce(p_attachment_ids, '{}'::uuid[])) u);
  v_ref_ids uuid[] := array(select distinct u from unnest(coalesce(p_reference_ids, '{}'::uuid[])) u);
  v_valid integer;
  v_removed text[] := '{}';
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  select * into v_tpl from public.workflow_templates where id = p_template_id and is_active;
  if not found then
    raise exception 'WF404:양식을 찾을 수 없습니다.';
  end if;
  if v_tpl.only_visible_for_admin and not private.is_workflow_admin(p_actor_user_id) then
    raise exception 'WF403:이 양식으로 작성할 권한이 없습니다.';
  end if;
  if p_inputs is null or jsonb_typeof(p_inputs) <> 'array' then
    raise exception 'WF400:입력값 형식이 올바르지 않습니다.';
  end if;

  perform private.wf_validate_line(p_steps, coalesce(p_referrers, '[]'::jsonb), p_actor_user_id, false);

  if p_draft_id is not null and not exists (
    select 1 from public.workflow_drafts where id = p_draft_id and writer_id = p_actor_user_id
  ) then
    raise exception 'WF404:임시저장을 찾을 수 없습니다.';
  end if;

  if cardinality(v_ref_ids) > 20 then
    raise exception 'WF400:참조문서는 최대 20개까지 연결할 수 있습니다.';
  end if;
  foreach v_ref in array v_ref_ids loop
    if not private.workflow_can_view_document(v_ref, p_actor_user_id) then
      raise exception 'WF400:참조할 수 없는 문서가 있습니다.';
    end if;
  end loop;

  if cardinality(v_att_ids) > 30 then
    raise exception 'WF400:첨부파일은 최대 30개까지 올릴 수 있습니다.';
  end if;
  select count(*) into v_valid
  from public.workflow_attachments a
  where a.id = any (v_att_ids)
    and a.owner_user_id = p_actor_user_id
    and a.status = 'staged'
    and a.deleted_at is null
    and a.document_id is null
    and (a.draft_id is null or a.draft_id = p_draft_id);
  if v_valid <> cardinality(v_att_ids) then
    raise exception 'WF400:첨부파일을 확인할 수 없습니다. 다시 올려 주세요.';
  end if;

  -- 연도별 번호 (counter 행 잠금 — upsert는 행 잠금을 잡는다)
  v_year := extract(year from (now() at time zone 'Asia/Seoul'))::integer;
  insert into public.workflow_document_counters as c (year, last_no)
  values (v_year, 1)
  on conflict (year) do update set last_no = c.last_no + 1
  returning c.last_no into v_no;
  v_code := v_year::text || '-' ||
    case when v_no < 10000 then lpad(v_no::text, 4, '0') else v_no::text end;

  insert into public.workflow_documents (
    code, template_id, template_key, template_snapshot, title, status, writer_id,
    inputs, content_html, search_text, current_step, total_steps, edit_policy,
    approval_step_edit_enabled
  ) values (
    v_code, v_tpl.id, v_tpl.template_key, private.wf_template_snapshot(v_tpl.id), v_tpl.name,
    'IN_PROGRESS', p_actor_user_id, p_inputs, coalesce(p_content_html, ''),
    left(v_code || ' ' || coalesce(p_search_text, ''), 20000), 1, jsonb_array_length(p_steps),
    v_tpl.edit_policy, v_tpl.approval_step_edit_enabled
  )
  returning id into v_doc_id;

  perform private.wf_insert_steps(v_doc_id, p_steps, 1);
  update public.workflow_approval_steps set status = 'ONGOING'
  where document_id = v_doc_id and step = 1;

  insert into public.workflow_document_referrers (document_id, user_id, notification_setting, position)
  select v_doc_id, (r.value ->> 'user_id')::uuid,
         coalesce(r.value ->> 'notification_setting', 'START_AND_END'), r.ordinality::integer
  from jsonb_array_elements(coalesce(p_referrers, '[]'::jsonb)) with ordinality as r (value, ordinality);

  insert into public.workflow_document_references (document_id, referenced_document_id, position)
  select v_doc_id, x.u, x.ord::integer
  from unnest(v_ref_ids) with ordinality as x (u, ord);

  if p_draft_id is not null then
    select coalesce(array_agg(a.storage_path), '{}') into v_removed
    from public.workflow_attachments a
    where a.draft_id = p_draft_id and not (a.id = any (v_att_ids));
  end if;

  update public.workflow_attachments
  set document_id = v_doc_id, draft_id = null, status = 'bound'
  where id = any (v_att_ids);

  if p_draft_id is not null then
    delete from public.workflow_drafts where id = p_draft_id;
  end if;

  insert into public.workflow_document_events (document_id, type, actor_id, payload)
  values (v_doc_id, 'WRITE', p_actor_user_id, '{}'::jsonb);

  return private.wf_document_result(v_doc_id) || jsonb_build_object(
    'attachment_count', cardinality(v_att_ids),
    'removed_storage_paths', to_jsonb(v_removed),
    'notify', jsonb_build_object(
      'approval_requested', private.wf_waiting_actor_ids(v_doc_id, 1),
      'referrer_requested', (
        select coalesce(jsonb_agg(r.user_id order by r.position), '[]'::jsonb)
        from public.workflow_document_referrers r
        where r.document_id = v_doc_id and r.notification_setting = 'START_AND_END'
      )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. 승인 · 반려 · 취소
-- ---------------------------------------------------------------------------
create or replace function public.workflow_approve(
  p_actor_user_id uuid,
  p_document_id uuid,
  p_opinion text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.workflow_documents%rowtype;
  v_my_status text;
  v_prev_step integer;
  v_adv jsonb;
  v_opinion text := nullif(btrim(coalesce(p_opinion, '')), '');
  v_notify jsonb := jsonb_build_object('approval_requested', '[]'::jsonb, 'completed', '[]'::jsonb);
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  select * into v_doc from public.workflow_documents where id = p_document_id for update;
  if not found or not private.workflow_can_view_document(p_document_id, p_actor_user_id) then
    raise exception 'WF404:문서를 찾을 수 없습니다.';
  end if;

  select a.status into v_my_status
  from public.workflow_approval_actors a
  where a.document_id = p_document_id and a.user_id = p_actor_user_id;

  if v_doc.status <> 'IN_PROGRESS' then
    if v_my_status in ('APPROVED', 'DECLINED') then
      raise exception 'WF409:이미 처리된 문서입니다.';
    end if;
    raise exception 'WF409:진행중인 문서만 처리할 수 있습니다.';
  end if;

  if not exists (
    select 1 from public.workflow_approval_actors a
    where a.document_id = p_document_id and a.user_id = p_actor_user_id
      and a.step = v_doc.current_step and a.status = 'WAITING'
  ) then
    if v_my_status in ('APPROVED', 'DECLINED') then
      raise exception 'WF409:이미 처리된 문서입니다.';
    end if;
    raise exception 'WF403:지금 승인할 차례가 아닙니다.';
  end if;

  if v_opinion is not null and char_length(v_opinion) > 2000 then
    raise exception 'WF400:의견은 2000자 이내로 입력해 주세요.';
  end if;

  update public.workflow_approval_actors
  set status = 'APPROVED', acted_at = now(), opinion = v_opinion
  where document_id = p_document_id and user_id = p_actor_user_id;

  insert into public.workflow_document_events (document_id, type, actor_id, content, payload)
  values (p_document_id, 'APPROVE', p_actor_user_id, v_opinion,
          jsonb_build_object('step', v_doc.current_step));

  v_prev_step := v_doc.current_step;
  v_adv := private.wf_advance(p_document_id);

  if (v_adv ->> 'done')::boolean then
    v_notify := jsonb_set(v_notify, '{completed}', private.wf_end_recipient_ids(p_document_id));
  elsif (v_adv ->> 'ongoing_step')::integer <> v_prev_step then
    v_notify := jsonb_set(v_notify, '{approval_requested}',
      private.wf_waiting_actor_ids(p_document_id, (v_adv ->> 'ongoing_step')::integer));
  end if;

  return private.wf_document_result(p_document_id)
    || jsonb_build_object('step', v_prev_step, 'notify', v_notify);
end;
$$;

create or replace function public.workflow_decline(
  p_actor_user_id uuid,
  p_document_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.workflow_documents%rowtype;
  v_my_status text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  select * into v_doc from public.workflow_documents where id = p_document_id for update;
  if not found or not private.workflow_can_view_document(p_document_id, p_actor_user_id) then
    raise exception 'WF404:문서를 찾을 수 없습니다.';
  end if;

  select a.status into v_my_status
  from public.workflow_approval_actors a
  where a.document_id = p_document_id and a.user_id = p_actor_user_id;

  if v_doc.status <> 'IN_PROGRESS' then
    if v_my_status in ('APPROVED', 'DECLINED') then
      raise exception 'WF409:이미 처리된 문서입니다.';
    end if;
    raise exception 'WF409:진행중인 문서만 처리할 수 있습니다.';
  end if;

  if not exists (
    select 1 from public.workflow_approval_actors a
    where a.document_id = p_document_id and a.user_id = p_actor_user_id
      and a.step = v_doc.current_step and a.status = 'WAITING'
  ) then
    if v_my_status in ('APPROVED', 'DECLINED') then
      raise exception 'WF409:이미 처리된 문서입니다.';
    end if;
    raise exception 'WF403:지금 승인할 차례가 아닙니다.';
  end if;

  if v_reason is not null and char_length(v_reason) > 2000 then
    raise exception 'WF400:반려 사유는 2000자 이내로 입력해 주세요.';
  end if;

  update public.workflow_approval_actors
  set status = 'DECLINED', acted_at = now(), opinion = v_reason
  where document_id = p_document_id and user_id = p_actor_user_id;

  update public.workflow_approval_steps set status = 'DECLINED'
  where document_id = p_document_id and step = v_doc.current_step;

  update public.workflow_documents
  set status = 'DECLINED', completed_at = now(), updated_at = now()
  where id = p_document_id;

  insert into public.workflow_document_events (document_id, type, actor_id, content, payload)
  values (p_document_id, 'DECLINE', p_actor_user_id, v_reason,
          jsonb_build_object('step', v_doc.current_step));

  return private.wf_document_result(p_document_id) || jsonb_build_object(
    'step', v_doc.current_step,
    'notify', jsonb_build_object('declined', private.wf_end_recipient_ids(p_document_id))
  );
end;
$$;

create or replace function public.workflow_cancel_document(
  p_actor_user_id uuid,
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.workflow_documents%rowtype;
  v_waiting jsonb;
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  select * into v_doc from public.workflow_documents where id = p_document_id for update;
  if not found or not private.workflow_can_view_document(p_document_id, p_actor_user_id) then
    raise exception 'WF404:문서를 찾을 수 없습니다.';
  end if;
  if v_doc.status <> 'IN_PROGRESS' then
    raise exception 'WF409:진행중인 문서만 처리할 수 있습니다.';
  end if;
  if v_doc.writer_id <> p_actor_user_id then
    raise exception 'WF403:작성자만 문서를 취소할 수 있습니다.';
  end if;

  v_waiting := private.wf_waiting_actor_ids(p_document_id, v_doc.current_step);

  update public.workflow_documents
  set status = 'CANCELED', canceled_at = now(), updated_at = now()
  where id = p_document_id;

  insert into public.workflow_document_events (document_id, type, actor_id, payload)
  values (p_document_id, 'CANCEL', p_actor_user_id, '{}'::jsonb);

  return private.wf_document_result(p_document_id) || jsonb_build_object(
    'notify', jsonb_build_object('canceled', v_waiting)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 수정 (입력값·본문·참조문서·첨부 추가/제거)
-- ---------------------------------------------------------------------------
create or replace function public.workflow_update_document(
  p_actor_user_id uuid,
  p_document_id uuid,
  p_inputs jsonb,
  p_content_html text,
  p_search_text text,
  p_reference_ids uuid[],
  p_add_attachment_ids uuid[],
  p_remove_attachment_ids uuid[],
  p_changed_field_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.workflow_documents%rowtype;
  v_add uuid[] := array(select distinct u from unnest(coalesce(p_add_attachment_ids, '{}'::uuid[])) u);
  v_remove uuid[] := array(select distinct u from unnest(coalesce(p_remove_attachment_ids, '{}'::uuid[])) u);
  v_ref_ids uuid[];
  v_ref uuid;
  v_valid integer;
  v_removed text[] := '{}';
  v_count integer;
  v_changed text[] := coalesce(p_changed_field_keys, '{}');
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  select * into v_doc from public.workflow_documents where id = p_document_id for update;
  if not found or not private.workflow_can_view_document(p_document_id, p_actor_user_id) then
    raise exception 'WF404:문서를 찾을 수 없습니다.';
  end if;
  if v_doc.status <> 'IN_PROGRESS' then
    raise exception 'WF409:진행중인 문서만 처리할 수 있습니다.';
  end if;
  if not (
    v_doc.writer_id = p_actor_user_id
    or (
      v_doc.edit_policy = 'AUTHOR_AND_APPROVER'
      and exists (
        select 1 from public.workflow_approval_actors a
        where a.document_id = p_document_id and a.user_id = p_actor_user_id
      )
    )
  ) then
    raise exception 'WF403:문서를 수정할 권한이 없습니다.';
  end if;
  if p_inputs is null or jsonb_typeof(p_inputs) <> 'array' then
    raise exception 'WF400:입력값 형식이 올바르지 않습니다.';
  end if;

  if p_reference_ids is not null then
    v_ref_ids := array(select distinct u from unnest(p_reference_ids) u);
    if cardinality(v_ref_ids) > 20 then
      raise exception 'WF400:참조문서는 최대 20개까지 연결할 수 있습니다.';
    end if;
    foreach v_ref in array v_ref_ids loop
      if v_ref = p_document_id or not private.workflow_can_view_document(v_ref, p_actor_user_id) then
        raise exception 'WF400:참조할 수 없는 문서가 있습니다.';
      end if;
    end loop;
  end if;

  if cardinality(v_remove) > 0 then
    select count(*) into v_valid
    from public.workflow_attachments a
    where a.id = any (v_remove) and a.document_id = p_document_id and a.status = 'bound';
    if v_valid <> cardinality(v_remove) then
      raise exception 'WF400:삭제할 첨부파일을 찾을 수 없습니다.';
    end if;
  end if;

  if cardinality(v_add) > 0 then
    select count(*) into v_valid
    from public.workflow_attachments a
    where a.id = any (v_add)
      and a.owner_user_id = p_actor_user_id
      and a.status = 'staged'
      and a.deleted_at is null
      and a.document_id is null
      and a.draft_id is null;
    if v_valid <> cardinality(v_add) then
      raise exception 'WF400:첨부파일을 확인할 수 없습니다. 다시 올려 주세요.';
    end if;
  end if;

  select count(*) into v_count
  from public.workflow_attachments a
  where a.document_id = p_document_id and a.status = 'bound' and a.deleted_at is null
    and not (a.id = any (v_remove));
  if v_count + cardinality(v_add) > 30 then
    raise exception 'WF400:첨부파일은 최대 30개까지 올릴 수 있습니다.';
  end if;

  if cardinality(v_remove) > 0 then
    select coalesce(array_agg(a.storage_path), '{}') into v_removed
    from public.workflow_attachments a
    where a.id = any (v_remove) and a.document_id = p_document_id;
    delete from public.workflow_attachments
    where id = any (v_remove) and document_id = p_document_id;
  end if;

  if cardinality(v_add) > 0 then
    update public.workflow_attachments
    set document_id = p_document_id, status = 'bound'
    where id = any (v_add);
  end if;

  update public.workflow_documents
  set inputs = p_inputs,
      content_html = coalesce(p_content_html, ''),
      search_text = left(v_doc.code || ' ' || coalesce(p_search_text, ''), 20000),
      updated_at = now()
  where id = p_document_id;

  if p_reference_ids is not null then
    delete from public.workflow_document_references where document_id = p_document_id;
    insert into public.workflow_document_references (document_id, referenced_document_id, position)
    select p_document_id, x.u, x.ord::integer
    from unnest(v_ref_ids) with ordinality as x (u, ord);
  end if;

  if cardinality(v_changed) > 0 then
    insert into public.workflow_document_events (document_id, type, actor_id, payload)
    values (p_document_id, 'UPDATE', p_actor_user_id,
            jsonb_build_object('changed_field_keys', to_jsonb(v_changed)));
  end if;

  return private.wf_document_result(p_document_id) || jsonb_build_object(
    'changed_field_keys', to_jsonb(v_changed),
    'attachment_count', v_count + cardinality(v_add),
    'removed_storage_paths', to_jsonb(v_removed)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 결재선 변경 (작성자 · 완료 단계 불변 · 승인한 사람 제거 금지 · diff 이벤트 · 전이 재계산)
-- ---------------------------------------------------------------------------
create or replace function public.workflow_change_approval_line(
  p_actor_user_id uuid,
  p_document_id uuid,
  p_steps jsonb,
  p_referrers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.workflow_documents%rowtype;
  v_cur integer;
  v_new_total integer;
  v_i integer;
  v_old uuid[];
  v_new uuid[];
  v_approved uuid[];
  v_keep jsonb;
  v_prev_waiting uuid[];
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb := '[]'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_b jsonb;
  v_a jsonb;
  v_max integer;
  v_adv jsonb;
  v_ongoing integer;
  v_notify jsonb := jsonb_build_object('approval_requested', '[]'::jsonb, 'completed', '[]'::jsonb);
  v_b_txt text;
  v_a_txt text;
  v_same_ref boolean;
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  select * into v_doc from public.workflow_documents where id = p_document_id for update;
  if not found or not private.workflow_can_view_document(p_document_id, p_actor_user_id) then
    raise exception 'WF404:문서를 찾을 수 없습니다.';
  end if;
  if v_doc.status <> 'IN_PROGRESS' then
    raise exception 'WF409:진행중인 문서만 처리할 수 있습니다.';
  end if;
  if v_doc.writer_id <> p_actor_user_id then
    raise exception 'WF403:작성자만 승인·참조자를 변경할 수 있습니다.';
  end if;
  if not v_doc.approval_step_edit_enabled then
    raise exception 'WF403:이 문서는 결재선을 변경할 수 없습니다.';
  end if;

  perform private.wf_validate_line(p_steps, coalesce(p_referrers, '[]'::jsonb), v_doc.writer_id, false);

  v_cur := v_doc.current_step;
  v_new_total := jsonb_array_length(p_steps);

  -- 완료(APPROVED) 단계는 사람 구성이 같아야 한다
  for v_i in 1 .. (v_cur - 1) loop
    if v_i > v_new_total then
      raise exception 'WF409:완료된 단계는 변경할 수 없습니다.';
    end if;
    v_old := array(
      select a.user_id from public.workflow_approval_actors a
      where a.document_id = p_document_id and a.step = v_i order by a.user_id
    );
    v_new := array(select x::uuid from jsonb_array_elements_text(p_steps -> (v_i - 1)) x order by 1);
    if v_old is distinct from v_new then
      raise exception 'WF409:완료된 단계는 변경할 수 없습니다.';
    end if;
  end loop;

  -- 진행 중 단계에서 이미 승인한 사람은 뺄 수 없다
  v_approved := array(
    select a.user_id from public.workflow_approval_actors a
    where a.document_id = p_document_id and a.step = v_cur and a.status = 'APPROVED'
  );
  if cardinality(v_approved) > 0 then
    if v_cur > v_new_total then
      raise exception 'WF409:이미 승인한 승인자는 뺄 수 없습니다.';
    end if;
    v_new := array(select x::uuid from jsonb_array_elements_text(p_steps -> (v_cur - 1)) x);
    if not (v_approved <@ v_new) then
      raise exception 'WF409:이미 승인한 승인자는 뺄 수 없습니다.';
    end if;
  end if;

  v_before := private.wf_line_state(p_document_id);
  v_prev_waiting := array(
    select a.user_id from public.workflow_approval_actors a
    where a.document_id = p_document_id and a.step = v_cur and a.status = 'WAITING'
  );
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', a.user_id, 'acted_at', a.acted_at, 'opinion', a.opinion)), '[]'::jsonb)
  into v_keep
  from public.workflow_approval_actors a
  where a.document_id = p_document_id and a.step = v_cur and a.status = 'APPROVED';

  delete from public.workflow_approval_actors where document_id = p_document_id and step >= v_cur;
  delete from public.workflow_approval_steps where document_id = p_document_id and step >= v_cur;

  perform private.wf_insert_steps(p_document_id, p_steps, v_cur);

  update public.workflow_approval_actors a
  set status = 'APPROVED', acted_at = k.acted_at, opinion = k.opinion
  from jsonb_to_recordset(v_keep) as k (user_id uuid, acted_at timestamptz, opinion text)
  where a.document_id = p_document_id and a.user_id = k.user_id and a.step = v_cur;

  update public.workflow_documents set total_steps = greatest(v_new_total, 1)
  where id = p_document_id;

  delete from public.workflow_document_referrers where document_id = p_document_id;
  insert into public.workflow_document_referrers (document_id, user_id, notification_setting, position)
  select p_document_id, (r.value ->> 'user_id')::uuid,
         coalesce(r.value ->> 'notification_setting', 'START_AND_END'), r.ordinality::integer
  from jsonb_array_elements(coalesce(p_referrers, '[]'::jsonb)) with ordinality as r (value, ordinality);

  v_after := private.wf_line_state(p_document_id);

  -- diff (표시용): 단계별 사람 목록 비교 + 참조자 비교
  v_max := greatest(jsonb_array_length(v_before -> 'steps'), jsonb_array_length(v_after -> 'steps'));
  for v_i in 1 .. v_max loop
    select coalesce((
      select s -> 'users' from jsonb_array_elements(v_before -> 'steps') s
      where (s ->> 'step')::integer = v_i
    ), '[]'::jsonb) into v_b;
    select coalesce((
      select s -> 'users' from jsonb_array_elements(v_after -> 'steps') s
      where (s ->> 'step')::integer = v_i
    ), '[]'::jsonb) into v_a;
    if (select coalesce(array_agg(x ->> 'user_id' order by x ->> 'user_id'), '{}') from jsonb_array_elements(v_b) x)
       is distinct from
       (select coalesce(array_agg(x ->> 'user_id' order by x ->> 'user_id'), '{}') from jsonb_array_elements(v_a) x)
    then
      v_diff := v_diff || jsonb_build_array(jsonb_build_object(
        'kind', 'step',
        'step', v_i,
        'before', (select coalesce(jsonb_agg(x || jsonb_build_object('type', '승인')), '[]'::jsonb) from jsonb_array_elements(v_b) x),
        'after', (select coalesce(jsonb_agg(x || jsonb_build_object('type', '승인')), '[]'::jsonb) from jsonb_array_elements(v_a) x)
      ));
      v_b_txt := coalesce((select string_agg((x ->> 'name') || '(승인)', ', ') from jsonb_array_elements(v_b) x), '없음');
      v_a_txt := coalesce((select string_agg((x ->> 'name') || '(승인)', ', ') from jsonb_array_elements(v_a) x), '없음');
      v_lines := v_lines || to_jsonb(v_i::text || '단계: ' || v_b_txt || ' → ' || v_a_txt);
    end if;
  end loop;

  if (select coalesce(array_agg((x ->> 'user_id') || ':' || (x ->> 'notification_setting') order by x ->> 'user_id'), '{}')
      from jsonb_array_elements(v_before -> 'referrers') x)
     is distinct from
     (select coalesce(array_agg((x ->> 'user_id') || ':' || (x ->> 'notification_setting') order by x ->> 'user_id'), '{}')
      from jsonb_array_elements(v_after -> 'referrers') x)
  then
    v_diff := v_diff || jsonb_build_array(jsonb_build_object(
      'kind', 'referrer',
      'step', null,
      'before', (select coalesce(jsonb_agg(x || jsonb_build_object('type', '참조')), '[]'::jsonb) from jsonb_array_elements(v_before -> 'referrers') x),
      'after', (select coalesce(jsonb_agg(x || jsonb_build_object('type', '참조')), '[]'::jsonb) from jsonb_array_elements(v_after -> 'referrers') x)
    ));
    -- 같은 사람 구성에서 알림 설정만 바뀐 경우는 설정 라벨을 붙여 차이를 보여 준다
    v_same_ref := (select coalesce(array_agg(x ->> 'user_id' order by x ->> 'user_id'), '{}') from jsonb_array_elements(v_before -> 'referrers') x)
      = (select coalesce(array_agg(x ->> 'user_id' order by x ->> 'user_id'), '{}') from jsonb_array_elements(v_after -> 'referrers') x);
    v_b_txt := coalesce((
      select string_agg((x ->> 'name') || case when v_same_ref then '(' || case x ->> 'notification_setting'
        when 'START_AND_END' then '알림' when 'END' then '완료 알림' else '알림 없음' end || ')' else '' end, ', ')
      from jsonb_array_elements(v_before -> 'referrers') x), '없음');
    v_a_txt := coalesce((
      select string_agg((x ->> 'name') || case when v_same_ref then '(' || case x ->> 'notification_setting'
        when 'START_AND_END' then '알림' when 'END' then '완료 알림' else '알림 없음' end || ')' else '' end, ', ')
      from jsonb_array_elements(v_after -> 'referrers') x), '없음');
    v_lines := v_lines || to_jsonb('참조: ' || v_b_txt || ' → ' || v_a_txt);
  end if;

  v_adv := private.wf_advance(p_document_id);

  if (v_adv ->> 'done')::boolean then
    v_notify := jsonb_set(v_notify, '{completed}', private.wf_end_recipient_ids(p_document_id));
  else
    v_ongoing := (v_adv ->> 'ongoing_step')::integer;
    if v_ongoing <> v_cur then
      v_notify := jsonb_set(v_notify, '{approval_requested}', private.wf_waiting_actor_ids(p_document_id, v_ongoing));
    else
      v_notify := jsonb_set(v_notify, '{approval_requested}', coalesce((
        select jsonb_agg(a.user_id order by a.position)
        from public.workflow_approval_actors a
        where a.document_id = p_document_id and a.step = v_ongoing and a.status = 'WAITING'
          and not (a.user_id = any (v_prev_waiting))
      ), '[]'::jsonb));
    end if;
  end if;

  if jsonb_array_length(v_diff) > 0 then
    insert into public.workflow_document_events (document_id, type, actor_id, payload)
    values (p_document_id, 'CHANGE_STAGE_STAKE_HOLDERS', p_actor_user_id,
            jsonb_build_object('diff', v_diff, 'diff_lines', v_lines));
    update public.workflow_documents set updated_at = now() where id = p_document_id;
  end if;

  return private.wf_document_result(p_document_id) || jsonb_build_object(
    'changed', jsonb_array_length(v_diff) > 0,
    'diff_lines', v_lines,
    'notify', v_notify
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 댓글 · 중요
-- ---------------------------------------------------------------------------
create or replace function public.workflow_add_comment(
  p_actor_user_id uuid,
  p_document_id uuid,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content text := btrim(coalesce(p_content, ''));
  v_event_id uuid;
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  if not exists (select 1 from public.workflow_documents where id = p_document_id)
     or not private.workflow_can_view_document(p_document_id, p_actor_user_id) then
    raise exception 'WF404:문서를 찾을 수 없습니다.';
  end if;
  if char_length(v_content) = 0 then
    raise exception 'WF400:댓글을 입력해 주세요.';
  end if;
  if char_length(v_content) > 2000 then
    raise exception 'WF400:댓글은 2000자 이내로 입력해 주세요.';
  end if;

  insert into public.workflow_document_events (document_id, type, actor_id, content, payload)
  values (p_document_id, 'COMMENT', p_actor_user_id, v_content, '{}'::jsonb)
  returning id into v_event_id;

  update public.workflow_documents set updated_at = now() where id = p_document_id;

  return private.wf_document_result(p_document_id) || jsonb_build_object(
    'event_id', v_event_id,
    'notify', jsonb_build_object('comment_created', (
      select coalesce(jsonb_agg(distinct u), '[]'::jsonb)
      from (
        select d.writer_id as u from public.workflow_documents d where d.id = p_document_id
        union select a.user_id from public.workflow_approval_actors a where a.document_id = p_document_id
        union select r.user_id from public.workflow_document_referrers r where r.document_id = p_document_id
      ) s
      where u <> p_actor_user_id
    ))
  );
end;
$$;

create or replace function public.workflow_set_star(
  p_actor_user_id uuid,
  p_document_id uuid,
  p_starred boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  if not exists (select 1 from public.workflow_documents where id = p_document_id)
     or not private.workflow_can_view_document(p_document_id, p_actor_user_id) then
    raise exception 'WF404:문서를 찾을 수 없습니다.';
  end if;
  if p_starred is null then
    raise exception 'WF400:중요 표시 값이 올바르지 않습니다.';
  end if;

  insert into public.workflow_document_user_states (document_id, user_id, starred, updated_at)
  values (p_document_id, p_actor_user_id, p_starred, now())
  on conflict (document_id, user_id) do update
    set starred = excluded.starred, updated_at = now();

  return private.wf_document_result(p_document_id) || jsonb_build_object('starred', p_starred);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. 임시저장 (번호 소모 없음)
-- ---------------------------------------------------------------------------
create or replace function public.workflow_save_draft(
  p_actor_user_id uuid,
  p_draft_id uuid,
  p_template_id uuid,
  p_payload jsonb,
  p_attachment_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tpl public.workflow_templates%rowtype;
  v_id uuid := p_draft_id;
  v_created boolean := false;
  v_att uuid[] := array(select distinct u from unnest(coalesce(p_attachment_ids, '{}'::uuid[])) u);
  v_valid integer;
  v_removed text[] := '{}';
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  select * into v_tpl from public.workflow_templates where id = p_template_id and is_active;
  if not found then
    raise exception 'WF404:양식을 찾을 수 없습니다.';
  end if;
  if v_tpl.only_visible_for_admin and not private.is_workflow_admin(p_actor_user_id) then
    raise exception 'WF403:이 양식으로 작성할 권한이 없습니다.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'WF400:임시저장 형식이 올바르지 않습니다.';
  end if;
  if cardinality(v_att) > 30 then
    raise exception 'WF400:첨부파일은 최대 30개까지 올릴 수 있습니다.';
  end if;

  if v_id is null then
    insert into public.workflow_drafts (writer_id, template_id, payload)
    values (p_actor_user_id, p_template_id, p_payload)
    returning id into v_id;
    v_created := true;
  else
    update public.workflow_drafts
    set payload = p_payload, template_id = p_template_id
    where id = v_id and writer_id = p_actor_user_id;
    if not found then
      raise exception 'WF404:임시저장을 찾을 수 없습니다.';
    end if;
  end if;

  select count(*) into v_valid
  from public.workflow_attachments a
  where a.id = any (v_att)
    and a.owner_user_id = p_actor_user_id
    and a.status = 'staged'
    and a.deleted_at is null
    and a.document_id is null
    and (a.draft_id is null or a.draft_id = v_id);
  if v_valid <> cardinality(v_att) then
    raise exception 'WF400:첨부파일을 확인할 수 없습니다. 다시 올려 주세요.';
  end if;

  select coalesce(array_agg(a.storage_path), '{}') into v_removed
  from public.workflow_attachments a
  where a.draft_id = v_id and not (a.id = any (v_att));
  delete from public.workflow_attachments where draft_id = v_id and not (id = any (v_att));

  update public.workflow_attachments set draft_id = v_id where id = any (v_att);

  return jsonb_build_object(
    'draft_id', v_id,
    'created', v_created,
    'template_key', v_tpl.template_key,
    'template_name', v_tpl.name,
    'attachment_count', cardinality(v_att),
    'removed_storage_paths', to_jsonb(v_removed)
  );
end;
$$;

create or replace function public.workflow_delete_draft(
  p_actor_user_id uuid,
  p_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paths text[];
  v_template_key text;
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  select t.template_key into v_template_key
  from public.workflow_drafts d
  join public.workflow_templates t on t.id = d.template_id
  where d.id = p_draft_id and d.writer_id = p_actor_user_id
  for update of d;
  if not found then
    raise exception 'WF404:임시저장을 찾을 수 없습니다.';
  end if;

  select coalesce(array_agg(a.storage_path), '{}') into v_paths
  from public.workflow_attachments a where a.draft_id = p_draft_id;

  delete from public.workflow_drafts where id = p_draft_id;

  return jsonb_build_object(
    'draft_id', p_draft_id,
    'template_key', v_template_key,
    'removed_storage_paths', to_jsonb(v_paths)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. 첨부 staged 등록 · 삭제
-- ---------------------------------------------------------------------------
create or replace function public.workflow_register_attachment(
  p_actor_user_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.workflow_attachments%rowtype;
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  if p_storage_path is null or position(('staged/' || p_actor_user_id::text || '/') in p_storage_path) <> 1
     or p_storage_path like '%..%' then
    raise exception 'WF400:저장 경로가 올바르지 않습니다.';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 20971520 then
    raise exception 'WF400:파일당 20MB 이하만 올릴 수 있습니다.';
  end if;
  if p_file_name is null or char_length(btrim(p_file_name)) = 0 or char_length(p_file_name) > 255 then
    raise exception 'WF400:파일명이 올바르지 않습니다.';
  end if;

  insert into public.workflow_attachments (owner_user_id, storage_path, file_name, mime_type, size_bytes, status)
  values (p_actor_user_id, p_storage_path, btrim(p_file_name), nullif(btrim(coalesce(p_mime_type, '')), ''), p_size_bytes, 'staged')
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'file_name', v_row.file_name,
    'mime_type', v_row.mime_type,
    'size_bytes', v_row.size_bytes,
    'status', v_row.status,
    'created_at', v_row.created_at
  );
end;
$$;

create or replace function public.workflow_delete_staged_attachment(
  p_actor_user_id uuid,
  p_attachment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  perform private.wf_assert_active_actor(p_actor_user_id);

  delete from public.workflow_attachments
  where id = p_attachment_id and owner_user_id = p_actor_user_id and status = 'staged'
  returning storage_path into v_path;
  if v_path is null then
    raise exception 'WF404:첨부파일을 찾을 수 없습니다.';
  end if;

  return jsonb_build_object('attachment_id', p_attachment_id, 'storage_path', v_path);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. 양식 기본 결재선 · 워크플로우 관리자
-- ---------------------------------------------------------------------------
create or replace function public.workflow_set_template_policy(
  p_actor_user_id uuid,
  p_template_id uuid,
  p_steps jsonb,
  p_referrers jsonb,
  p_approval_step_edit_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tpl public.workflow_templates%rowtype;
begin
  perform private.wf_assert_active_actor(p_actor_user_id);
  if not private.is_workflow_admin(p_actor_user_id) then
    raise exception 'WF403:워크플로우 관리자 권한이 필요합니다.';
  end if;

  select * into v_tpl from public.workflow_templates where id = p_template_id for update;
  if not found then
    raise exception 'WF404:양식을 찾을 수 없습니다.';
  end if;

  perform private.wf_validate_line(p_steps, coalesce(p_referrers, '[]'::jsonb), null, true);

  delete from public.workflow_template_default_approvers where template_id = p_template_id;
  insert into public.workflow_template_default_approvers (template_id, step, user_id, position)
  select p_template_id, s.ordinality::integer, x.value::uuid, x.ordinality::integer
  from jsonb_array_elements(p_steps) with ordinality as s (value, ordinality)
  cross join lateral jsonb_array_elements_text(s.value) with ordinality as x (value, ordinality);

  delete from public.workflow_template_default_referrers where template_id = p_template_id;
  insert into public.workflow_template_default_referrers (template_id, user_id, notification_setting, position)
  select p_template_id, (r.value ->> 'user_id')::uuid,
         coalesce(r.value ->> 'notification_setting', 'START_AND_END'), r.ordinality::integer
  from jsonb_array_elements(coalesce(p_referrers, '[]'::jsonb)) with ordinality as r (value, ordinality);

  if p_approval_step_edit_enabled is not null then
    update public.workflow_templates
    set approval_step_edit_enabled = p_approval_step_edit_enabled
    where id = p_template_id;
  end if;

  return jsonb_build_object(
    'template_id', p_template_id,
    'template_key', v_tpl.template_key,
    'template_name', v_tpl.name,
    'step_count', jsonb_array_length(p_steps)
  );
end;
$$;

create or replace function public.workflow_grant_admin(
  p_actor_user_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id and p.status = 'active' and p.system_role = 'admin'::public.system_role
  ) then
    raise exception 'WF403:관리자 권한이 필요합니다.';
  end if;

  select * into v_target from public.profiles where user_id = p_user_id;
  if not found then
    raise exception 'WF400:사용자를 찾을 수 없습니다.';
  end if;
  if v_target.status <> 'active' then
    raise exception 'WF400:비활성 사용자는 지정할 수 없습니다.';
  end if;
  if v_target.system_role = 'admin'::public.system_role then
    raise exception 'WF400:시스템 관리자는 따로 지정하지 않아도 워크플로우 관리자 권한을 가집니다.';
  end if;
  if exists (select 1 from public.workflow_admins where user_id = p_user_id) then
    raise exception 'WF409:이미 워크플로우 관리자입니다.';
  end if;

  insert into public.workflow_admins (user_id, granted_by) values (p_user_id, p_actor_user_id);

  return jsonb_build_object('user_id', p_user_id);
end;
$$;

create or replace function public.workflow_revoke_admin(
  p_actor_user_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id and p.status = 'active' and p.system_role = 'admin'::public.system_role
  ) then
    raise exception 'WF403:관리자 권한이 필요합니다.';
  end if;

  delete from public.workflow_admins where user_id = p_user_id returning user_id into v_deleted;
  if v_deleted is null then
    raise exception 'WF404:워크플로우 관리자를 찾을 수 없습니다.';
  end if;

  return jsonb_build_object('user_id', v_deleted);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. 목록 · 건수 (SECURITY INVOKER → 호출자 RLS 적용)
-- ---------------------------------------------------------------------------
create or replace function private.workflow_filter_documents(
  p_tab text,
  p_scope text,
  p_group text,
  p_q text,
  p_writer_ids uuid[],
  p_template_keys text[],
  p_updated_from timestamptz,
  p_updated_to timestamptz,
  p_exclude_id uuid
)
returns setof public.workflow_documents
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as uid)
  select d.*
  from public.workflow_documents d, me
  where me.uid is not null
    -- 범위
    and (
      case coalesce(p_scope, 'related')
        when 'mine' then d.writer_id = me.uid
        when 'company' then true
        else (
          d.writer_id = me.uid
          or exists (select 1 from public.workflow_approval_actors a
                     where a.document_id = d.id and a.user_id = me.uid)
          or exists (select 1 from public.workflow_document_referrers r
                     where r.document_id = d.id and r.user_id = me.uid)
        )
      end
    )
    -- 탭
    and (
      case coalesce(p_tab, 'all')
        when 'in_progress' then d.status = 'IN_PROGRESS'
        when 'done' then d.status in ('DONE', 'DECLINED', 'CANCELED')
        when 'star' then exists (
          select 1 from public.workflow_document_user_states s
          where s.document_id = d.id and s.user_id = me.uid and s.starred
        )
        else true
      end
    )
    -- 진행중 그룹 (승인 필요 / 그 외 진행중)
    and (
      p_group is null
      or (
        p_group = 'approval_required'
        and d.status = 'IN_PROGRESS'
        and exists (select 1 from public.workflow_approval_actors a
                    where a.document_id = d.id and a.user_id = me.uid
                      and a.step = d.current_step and a.status = 'WAITING')
      )
      or (
        p_group = 'in_progress'
        and d.status = 'IN_PROGRESS'
        and not exists (select 1 from public.workflow_approval_actors a
                        where a.document_id = d.id and a.user_id = me.uid
                          and a.step = d.current_step and a.status = 'WAITING')
      )
    )
    and (
      p_q is null or btrim(p_q) = ''
      or d.search_text ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
    and (p_writer_ids is null or cardinality(p_writer_ids) = 0 or d.writer_id = any (p_writer_ids))
    and (p_template_keys is null or cardinality(p_template_keys) = 0 or d.template_key = any (p_template_keys))
    and (p_updated_from is null or d.updated_at >= p_updated_from)
    and (p_updated_to is null or d.updated_at < p_updated_to)
    and (p_exclude_id is null or d.id <> p_exclude_id);
$$;

create or replace function public.workflow_list_documents(
  p_tab text default 'in_progress',
  p_scope text default 'related',
  p_group text default null,
  p_q text default null,
  p_writer_ids uuid[] default null,
  p_template_keys text[] default null,
  p_updated_from timestamptz default null,
  p_updated_to timestamptz default null,
  p_sort text default 'updated_desc',
  p_limit integer default 20,
  p_offset integer default 0,
  p_exclude_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select * from private.workflow_filter_documents(
      p_tab, p_scope, p_group, p_q, p_writer_ids, p_template_keys,
      p_updated_from, p_updated_to, p_exclude_id
    )
  ),
  page as (
    select f.*
    from filtered f
    order by
      case when p_sort = 'updated_asc' then f.updated_at end asc,
      case when p_sort = 'written_desc' then f.written_at end desc,
      case when p_sort = 'written_asc' then f.written_at end asc,
      case when coalesce(p_sort, 'updated_desc') not in ('updated_asc', 'written_desc', 'written_asc')
           then f.updated_at end desc,
      f.id
    limit greatest(least(coalesce(p_limit, 20), 100), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'code', p.code,
        'status', p.status,
        'current_step', p.current_step,
        'total_steps', p.total_steps,
        'template_key', p.template_key,
        'template_name', p.template_snapshot ->> 'name',
        'template_emoji', p.template_snapshot ->> 'emoji',
        'fields', coalesce(p.template_snapshot -> 'fields', '[]'::jsonb),
        'inputs', p.inputs,
        'writer_id', p.writer_id,
        'written_at', p.written_at,
        'updated_at', p.updated_at,
        'attachment_count', (
          select count(*) from public.workflow_attachments a
          where a.document_id = p.id and a.status = 'bound' and a.deleted_at is null
        ),
        'approver_ids', coalesce((
          select jsonb_agg(a.user_id order by a.step, a.position)
          from public.workflow_approval_actors a where a.document_id = p.id
        ), '[]'::jsonb),
        'approval_required', (
          p.status = 'IN_PROGRESS' and exists (
            select 1 from public.workflow_approval_actors a
            where a.document_id = p.id and a.user_id = auth.uid()
              and a.step = p.current_step and a.status = 'WAITING'
          )
        ),
        'starred', coalesce((
          select s.starred from public.workflow_document_user_states s
          where s.document_id = p.id and s.user_id = auth.uid()
        ), false)
      ) order by
        case when p_sort = 'updated_asc' then p.updated_at end asc,
        case when p_sort = 'written_desc' then p.written_at end desc,
        case when p_sort = 'written_asc' then p.written_at end asc,
        case when coalesce(p_sort, 'updated_desc') not in ('updated_asc', 'written_desc', 'written_asc')
             then p.updated_at end desc,
        p.id)
      from page p
    ), '[]'::jsonb)
  );
$$;

create or replace function public.workflow_document_counts(
  p_scope text default 'related',
  p_q text default null,
  p_writer_ids uuid[] default null,
  p_template_keys text[] default null,
  p_updated_from timestamptz default null,
  p_updated_to timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'in_progress', count(*) filter (where f.status = 'IN_PROGRESS'),
    'done', count(*) filter (where f.status in ('DONE', 'DECLINED', 'CANCELED')),
    'star', count(*) filter (where exists (
      select 1 from public.workflow_document_user_states s
      where s.document_id = f.id and s.user_id = auth.uid() and s.starred
    )),
    'all', count(*),
    'approval_required', count(*) filter (where f.status = 'IN_PROGRESS' and exists (
      select 1 from public.workflow_approval_actors a
      where a.document_id = f.id and a.user_id = auth.uid()
        and a.step = f.current_step and a.status = 'WAITING'
    ))
  )
  from private.workflow_filter_documents(
    'all', p_scope, null, p_q, p_writer_ids, p_template_keys, p_updated_from, p_updated_to, null
  ) f;
$$;

-- ---------------------------------------------------------------------------
-- 10. 실행 권한: 쓰기 RPC·private helper = service_role만. 조회 함수 = authenticated(+service_role)
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'private.wf_assert_active_actor(uuid)',
    'private.wf_validate_line(jsonb, jsonb, uuid, boolean)',
    'private.wf_template_snapshot(uuid)',
    'private.wf_insert_steps(uuid, jsonb, integer)',
    'private.wf_advance(uuid)',
    'private.wf_waiting_actor_ids(uuid, integer)',
    'private.wf_end_recipient_ids(uuid)',
    'private.wf_document_result(uuid)',
    'private.wf_line_state(uuid)',
    'public.workflow_submit_document(uuid, uuid, jsonb, text, text, jsonb, jsonb, uuid[], uuid[], uuid)',
    'public.workflow_approve(uuid, uuid, text)',
    'public.workflow_decline(uuid, uuid, text)',
    'public.workflow_cancel_document(uuid, uuid)',
    'public.workflow_update_document(uuid, uuid, jsonb, text, text, uuid[], uuid[], uuid[], text[])',
    'public.workflow_change_approval_line(uuid, uuid, jsonb, jsonb)',
    'public.workflow_add_comment(uuid, uuid, text)',
    'public.workflow_set_star(uuid, uuid, boolean)',
    'public.workflow_save_draft(uuid, uuid, uuid, jsonb, uuid[])',
    'public.workflow_delete_draft(uuid, uuid)',
    'public.workflow_register_attachment(uuid, text, text, text, integer)',
    'public.workflow_delete_staged_attachment(uuid, uuid)',
    'public.workflow_set_template_policy(uuid, uuid, jsonb, jsonb, boolean)',
    'public.workflow_grant_admin(uuid, uuid)',
    'public.workflow_revoke_admin(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on function private.workflow_filter_documents(text, text, text, text, uuid[], text[], timestamptz, timestamptz, uuid) from public, anon;
grant execute on function private.workflow_filter_documents(text, text, text, text, uuid[], text[], timestamptz, timestamptz, uuid) to authenticated, service_role;

revoke all on function public.workflow_list_documents(text, text, text, text, uuid[], text[], timestamptz, timestamptz, text, integer, integer, uuid) from public, anon;
grant execute on function public.workflow_list_documents(text, text, text, text, uuid[], text[], timestamptz, timestamptz, text, integer, integer, uuid) to authenticated, service_role;

revoke all on function public.workflow_document_counts(text, text, uuid[], text[], timestamptz, timestamptz) from public, anon;
grant execute on function public.workflow_document_counts(text, text, uuid[], text[], timestamptz, timestamptz) to authenticated, service_role;
