'use client';

import { useId, useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Switch } from '@/components/ui/switch';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  grantWorkflowAdminMutation,
  revokeWorkflowAdminMutation,
  saveWorkflowTemplatePolicyMutation
} from '../api/mutations';
import {
  workflowAdminsQueryOptions,
  workflowTemplateQueryOptions,
  workflowTemplatesQueryOptions
} from '../api/queries';
import type { WorkflowAdmin, WorkflowTemplateDetail } from '../api/types';
import { validateApprovalLine } from '../lib/approval-line-rules';
import {
  lineFromDefault,
  lineToPayload,
  type WorkflowLineValue
} from '../lib/approval-line-state';
import { WorkflowApprovalLineEditor } from './workflow-approval-line-editor';
import { WorkflowMemberCombobox } from './workflow-member-combobox';
import { WorkflowPersonInfo } from './workflow-person';
import { WorkflowQueryBoundary } from './workflow-query-boundary';

// ---------------------------------------------------------------------------
// 워크플로우 관리자 (시스템 관리자 전용)
// ---------------------------------------------------------------------------
function WorkflowAdminList() {
  const { data: admins } = useSuspenseQuery(workflowAdminsQueryOptions());
  const grantMutation = useMutation({ ...grantWorkflowAdminMutation });
  const revokeMutation = useMutation({ ...revokeWorkflowAdminMutation });
  const [target, setTarget] = useState<WorkflowAdmin | null>(null);
  const adminIds = new Set(admins.map((admin) => admin.user_id));

  return (
    <>
      <div className='flex justify-end px-6'>
        <WorkflowMemberCombobox
          getDisabledReason={(member) => (adminIds.has(member.user_id) ? '이미 지정됨' : null)}
          onSelect={(member) =>
            grantMutation.mutate(
              { userId: member.user_id },
              {
                onSuccess: () => notifySuccess('워크플로우 관리자를 지정했습니다.'),
                onError: (error) => notifyError(error.message)
              }
            )
          }
        >
          <Button
            type='button'
            size='sm'
            data-testid='workflow-admin-add'
            className='h-11 md:h-8'
            isLoading={grantMutation.isPending}
          >
            <Icons.add aria-hidden />
            관리자 추가
          </Button>
        </WorkflowMemberCombobox>
      </div>
      <CardContent>
        {admins.length === 0 ? (
          <p className='py-4 text-sm text-muted-foreground'>지정된 워크플로우 관리자가 없습니다.</p>
        ) : (
          <ul className='flex flex-col divide-y'>
            {admins.map((admin) => (
              <li key={admin.user_id} className='flex min-h-14 items-center gap-3 py-2'>
                <WorkflowPersonInfo person={admin} />
                <span className='hidden text-xs text-muted-foreground tabular-nums sm:inline'>
                  {formatAbsoluteDateKo(admin.created_at)} 지정
                </span>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  data-testid={`workflow-admin-remove-${admin.user_id}`}
                  className='h-11 shrink-0 md:h-8'
                  onClick={() => setTarget(admin)}
                >
                  해제
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <AlertModal
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        loading={revokeMutation.isPending}
        title='워크플로우 관리자 해제'
        description={target ? `${target.full_name}님의 워크플로우 관리자 권한을 해제합니다.` : ''}
        confirmLabel='해제'
        cancelLabel='취소'
        onConfirm={() => {
          if (!target) return;
          revokeMutation.mutate(
            { userId: target.user_id },
            {
              onSuccess: () => {
                notifySuccess('워크플로우 관리자를 해제했습니다.');
                setTarget(null);
              },
              onError: (error) => notifyError(error.message)
            }
          );
        }}
      />
    </>
  );
}

function WorkflowAdminsCard() {
  return (
    <Card data-testid='workflow-admins'>
      <CardHeader>
        <CardTitle>워크플로우 관리자</CardTitle>
        <CardDescription>시스템 관리자는 따로 지정하지 않아도 워크플로우 관리자 권한을 가집니다.</CardDescription>
      </CardHeader>
      <WorkflowQueryBoundary
        errorMessage='워크플로우 관리자를 불러오지 못했습니다.'
        loadingFallback={<PageLoadingSpinner variant='fill' />}
      >
        <WorkflowAdminList />
      </WorkflowQueryBoundary>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 양식 기본 결재선
// ---------------------------------------------------------------------------
function PolicyForm({ template }: { template: WorkflowTemplateDetail }) {
  const [line, setLine] = useState<WorkflowLineValue>(() => lineFromDefault(template.default_line));
  const [editEnabled, setEditEnabled] = useState(template.approval_step_edit_enabled);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({ ...saveWorkflowTemplatePolicyMutation });
  const switchId = useId();

  function handleSave() {
    const payload = lineToPayload(line);
    const message = validateApprovalLine(payload, { allowEmpty: true });
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    mutation.mutate(
      {
        templateKey: template.template_key,
        payload: { ...payload, approval_step_edit_enabled: editEnabled }
      },
      {
        onSuccess: () => notifySuccess('기본 결재선이 저장되었습니다.'),
        onError: (mutationError) => setError(mutationError.message)
      }
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      {error ? (
        <Alert variant='destructive'>
          <Icons.alertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <WorkflowApprovalLineEditor mode='policy' value={line} onChange={setLine} />
      <div className='flex items-center gap-3'>
        <Switch id={switchId} checked={editEnabled} onCheckedChange={setEditEnabled} />
        <Label htmlFor={switchId} className='font-normal'>
          작성자가 결재선을 변경할 수 있어요
        </Label>
      </div>
      <div className='flex justify-end'>
        <Button
          type='button'
          data-testid='workflow-policy-save'
          className='h-11 md:h-9'
          isLoading={mutation.isPending}
          onClick={handleSave}
        >
          저장
        </Button>
      </div>
    </div>
  );
}

function PolicyLoader({ templateKey }: { templateKey: string }) {
  const { data: template } = useSuspenseQuery(workflowTemplateQueryOptions(templateKey));
  return <PolicyForm template={template} />;
}

function TemplatePolicyList() {
  const { data: templates } = useSuspenseQuery(workflowTemplatesQueryOptions());
  if (templates.length === 0) {
    return <p className='text-sm text-muted-foreground'>등록된 양식이 없습니다.</p>;
  }
  return (
    <div className='flex flex-col gap-4'>
      {templates.map((template) => (
        <section
          key={template.template_key}
          data-testid={`workflow-template-policy-${template.template_key}`}
          aria-labelledby={`workflow-policy-title-${template.template_key}`}
          className='flex flex-col gap-4 rounded-lg border p-4'
        >
          <h3 id={`workflow-policy-title-${template.template_key}`} className='text-base font-semibold'>
            <span aria-hidden className='mr-1.5'>
              {template.emoji}
            </span>
            {template.name}
          </h3>
          <WorkflowQueryBoundary
            errorMessage='기본 결재선을 불러오지 못했습니다.'
            loadingFallback={<PageLoadingSpinner variant='fill' />}
          >
            <PolicyLoader templateKey={template.template_key} />
          </WorkflowQueryBoundary>
        </section>
      ))}
    </div>
  );
}

function WorkflowTemplatePoliciesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>양식 기본 결재선</CardTitle>
        <CardDescription>문서를 작성할 때 자동으로 채워지는 승인 단계와 참조자입니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <WorkflowQueryBoundary
          errorMessage='양식을 불러오지 못했습니다.'
          loadingFallback={<PageLoadingSpinner variant='fill' />}
        >
          <TemplatePolicyList />
        </WorkflowQueryBoundary>
      </CardContent>
    </Card>
  );
}

/** 워크플로우 설정 — 관리자 카드는 시스템 관리자에게만 (AC-04) */
export function WorkflowSettingsPage({ isSystemAdmin }: { isSystemAdmin: boolean }) {
  return (
    <div data-testid='workflow-settings-page' className='flex w-full max-w-3xl flex-col gap-6'>
      {isSystemAdmin ? <WorkflowAdminsCard /> : null}
      <WorkflowTemplatePoliciesCard />
    </div>
  );
}
