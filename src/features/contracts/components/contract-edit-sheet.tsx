'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { AlertModal } from '@/components/modal/alert-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Icons } from '@/components/icons';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  setContractNoAttachmentMutation,
  softDeleteContractAttachmentMutation,
  updateContractMutation,
  uploadContractAttachmentMutation
} from '../api/mutations';
import {
  canOpenContractAttachment,
  downloadContractAttachment,
  openContractAttachment
} from '../api/service';
import {
  CONTRACT_ATTACHMENT_MAX_BYTES,
  type ContractAttachmentSummary,
  type ContractDocument,
  type ContractUpdatePayload
} from '../api/types';
import { contractUpdateSchema } from '../api/validators';
import { CONTRACT_ATTACHMENT_STATUS_LABELS } from './contracts-table/options';

interface ContractEditSheetProps {
  contract: ContractDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ContractEditSheetContentProps {
  contract: ContractDocument;
  onOpenChange: (open: boolean) => void;
}

type ContractEditFormValues = {
  document_created_at: string;
  approved_at: string;
  author_name: string;
  author_email: string;
  contract_target: string;
  contract_summary: string;
  amount: number | undefined;
  contract_start_date: string;
  contract_end_date: string;
  notes: string;
  source_document_url: string;
};

function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toFormValues(
  contract?: ContractDocument | null
): ContractEditFormValues {
  return {
    document_created_at: toDateInputValue(contract?.document_created_at),
    approved_at: toDateInputValue(contract?.approved_at),
    author_name: contract?.author_name ?? '',
    author_email: contract?.author_email ?? '',
    contract_target: contract?.contract_target ?? '',
    contract_summary: contract?.contract_summary ?? '',
    amount: contract?.amount ?? undefined,
    contract_start_date: contract?.contract_start_date ?? '',
    contract_end_date: contract?.contract_end_date ?? '',
    notes: contract?.notes ?? '',
    source_document_url: contract?.source_document_url ?? ''
  };
}

function cleanOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('ko-KR');
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value}B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)}KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function buildSubmitSchema() {
  return z.object({
    document_created_at: z
      .string()
      .trim()
      .min(1, '문서 생성일을 입력해 주세요.')
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        '문서 생성일 형식이 올바르지 않습니다.'
      ),
    approved_at: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || !Number.isNaN(Date.parse(value)),
        '문서승인일 형식이 올바르지 않습니다.'
      ),
    author_name: z.string().trim().min(1, '작성자를 입력해 주세요.'),
    author_email: z.string(),
    contract_target: z.string().trim().min(1, '계약대상을 입력해 주세요.'),
    contract_summary: z.string().trim().min(1, '계약 내용을 입력해 주세요.'),
    amount: z.union([z.number().nonnegative(), z.undefined()]),
    contract_start_date: z.string(),
    contract_end_date: z.string(),
    notes: z.string(),
    source_document_url: z.string()
  });
}

function ContractAttachmentRow({
  contractId,
  attachment,
  onContractChange
}: {
  contractId: number;
  attachment: ContractAttachmentSummary;
  onContractChange: (contract: ContractDocument) => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isActive = attachment.status === 'active';
  const canOpen = canOpenContractAttachment(attachment);

  const deleteMutation = useMutation({
    ...softDeleteContractAttachmentMutation,
    onSuccess: (response) => {
      notifySuccess('첨부파일이 삭제 처리되었습니다.');
      onContractChange(response.contract);
      setDeleteOpen(false);
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : '첨부파일 삭제 처리에 실패했습니다.';
      notifyError(message);
    }
  });

  async function handleDownload() {
    try {
      const blob = await downloadContractAttachment(contractId, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '첨부파일 다운로드에 실패했습니다.';
      notifyError(message);
    }
  }

  function handleOpen() {
    if (!openContractAttachment(contractId, attachment.id)) {
      notifyError('첨부파일을 새 탭으로 열 수 없습니다.');
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between',
        !isActive && 'border-destructive/30 bg-destructive/5'
      )}
    >
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          deleteMutation.mutate({ id: contractId, attachmentId: attachment.id })
        }
        loading={deleteMutation.isPending}
        title='첨부파일을 삭제 처리할까요?'
        description={`"${attachment.file_name}" 파일을 비활성 처리합니다. 파일은 물리 삭제되지 않고 감사 로그에 기록됩니다.`}
        confirmLabel='삭제 처리'
        cancelLabel='취소'
      />
      <div className='min-w-0'>
        <div className='flex items-center gap-2'>
          <Icons.paperclip className='h-4 w-4 shrink-0' />
          <span className='truncate text-sm font-medium'>
            {attachment.file_name}
          </span>
          {!isActive ? (
            <Badge variant='destructive' className='shrink-0'>
              삭제됨
            </Badge>
          ) : null}
        </div>
        <p className='text-muted-foreground mt-1 text-xs'>
          {formatBytes(attachment.file_size)} ·{' '}
          {formatDate(attachment.created_at)}
        </p>
      </div>
      <div className='flex gap-2'>
        {canOpen ? (
          <Button
            type='button'
            variant='outline'
            size='icon'
            disabled={!isActive}
            aria-label={`${attachment.file_name} 열기`}
            title='열기'
            onClick={handleOpen}
          >
            <Icons.externalLink className='h-4 w-4' />
            <span className='sr-only'>열기</span>
          </Button>
        ) : null}
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={!isActive}
          aria-label={`${attachment.file_name} 다운로드`}
          title='다운로드'
          onClick={handleDownload}
        >
          <Icons.download className='h-4 w-4' />
          <span className='sr-only'>다운로드</span>
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={!isActive}
          aria-label={`${attachment.file_name} 삭제 처리`}
          title='삭제 처리'
          onClick={() => setDeleteOpen(true)}
        >
          <Icons.trash className='h-4 w-4' />
          <span className='sr-only'>삭제 처리</span>
        </Button>
      </div>
    </div>
  );
}

function ContractAttachmentManager({
  contract,
  onContractChange,
  selectedFiles,
  onSelectedFilesChange,
  onRemoveSelectedFile,
  isSaving
}: {
  contract: ContractDocument;
  onContractChange: (contract: ContractDocument) => void;
  selectedFiles: File[];
  onSelectedFilesChange: (files: File[]) => void;
  onRemoveSelectedFile: (index: number) => void;
  isSaving: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [noAttachmentOpen, setNoAttachmentOpen] = useState(false);
  const [noAttachmentReason, setNoAttachmentReason] = useState('');
  const nextNoAttachmentValue = !contract.no_attachment_required;
  const hasActiveAttachments = contract.attachments.some(
    (attachment) => attachment.status === 'active'
  );
  const isNoAttachmentSetBlocked =
    nextNoAttachmentValue && hasActiveAttachments;

  const noAttachmentMutation = useMutation({
    ...setContractNoAttachmentMutation,
    onSuccess: (response) => {
      notifySuccess(response.message);
      onContractChange(response.contract);
      setNoAttachmentOpen(false);
      if (response.contract.no_attachment_required) {
        setNoAttachmentReason('');
      }
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : '첨부파일 없음 상태 변경에 실패했습니다.';
      notifyError(message);
    }
  });

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const existingFileNames = new Set(
      contract.attachments.map((attachment) => attachment.file_name)
    );
    const selectedFileNames = new Set(
      selectedFiles.map((selectedFile) => selectedFile.name)
    );
    const incomingFileNames = new Set<string>();
    const duplicatedFile = files.find((file) => {
      const isDuplicated =
        existingFileNames.has(file.name) ||
        selectedFileNames.has(file.name) ||
        incomingFileNames.has(file.name);
      incomingFileNames.add(file.name);
      return isDuplicated;
    });
    if (duplicatedFile) {
      notifyError(
        `이미 등록되었거나 선택된 파일명입니다: ${duplicatedFile.name}`
      );
      event.target.value = '';
      return;
    }

    const nextFiles = [...selectedFiles, ...files];
    const selectedTotalSize = nextFiles.reduce(
      (total, file) => total + file.size,
      0
    );
    const nextActiveTotalSize =
      contract.active_attachment_total_size + selectedTotalSize;
    if (nextActiveTotalSize > CONTRACT_ATTACHMENT_MAX_BYTES) {
      notifyError('활성 첨부파일과 선택 파일의 총량은 1MB 이하여야 합니다.');
      event.target.value = '';
      return;
    }

    onSelectedFilesChange(nextFiles);
    event.target.value = '';
  }

  function handleNoAttachmentConfirm() {
    if (isNoAttachmentSetBlocked) {
      notifyError('활성 첨부파일이 있어 첨부파일 없음으로 지정할 수 없습니다.');
      setNoAttachmentOpen(false);
      return;
    }

    noAttachmentMutation.mutate({
      id: contract.id,
      payload: {
        no_attachment_required: nextNoAttachmentValue,
        no_attachment_reason: nextNoAttachmentValue
          ? noAttachmentReason.trim() || null
          : null
      }
    });
  }

  return (
    <section className='space-y-3 rounded-lg border p-4'>
      <AlertModal
        isOpen={noAttachmentOpen}
        onClose={() => setNoAttachmentOpen(false)}
        onConfirm={handleNoAttachmentConfirm}
        loading={noAttachmentMutation.isPending}
        title={
          nextNoAttachmentValue
            ? '첨부파일 없음으로 지정할까요?'
            : '첨부파일 없음 지정을 해제할까요?'
        }
        description={
          nextNoAttachmentValue
            ? `"${contract.document_number}" 문서를 독촉 제외 대상으로 지정합니다.`
            : `"${contract.document_number}" 문서를 첨부 누락 상태로 되돌립니다.`
        }
        confirmLabel={nextNoAttachmentValue ? '지정' : '해제'}
        cancelLabel='취소'
      />
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-base font-semibold'>첨부파일 관리</h3>
            <Badge variant='outline'>
              {CONTRACT_ATTACHMENT_STATUS_LABELS[contract.attachment_status]}
            </Badge>
          </div>
          <p className='text-muted-foreground mt-1 text-sm'>
            계약 문서당 활성 첨부파일 총량은 1MB 이하입니다.
          </p>
        </div>
        <div className='flex gap-2'>
          <input
            ref={fileInputRef}
            type='file'
            multiple
            className='hidden'
            onChange={handleFileChange}
          />
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={contract.status === 'soft_deleted' || isSaving}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icons.upload className='mr-2 h-4 w-4' />
            파일 선택
          </Button>
        </div>
      </div>

      {selectedFiles.length > 0 ? (
        <div className='space-y-2 rounded-lg border border-dashed p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-sm font-medium'>저장 대기 첨부파일</p>
            <Badge variant='secondary'>{selectedFiles.length}개 선택됨</Badge>
          </div>
          <div className='space-y-2'>
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className='flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='min-w-0'>
                  <div className='flex items-center gap-2'>
                    <Icons.paperclip className='h-4 w-4 shrink-0' />
                    <span className='truncate text-sm font-medium'>
                      {file.name}
                    </span>
                    <Badge variant='outline' className='shrink-0'>
                      저장 대기
                    </Badge>
                  </div>
                  <p className='text-muted-foreground mt-1 text-xs'>
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  disabled={isSaving}
                  onClick={() => onRemoveSelectedFile(index)}
                >
                  제거
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {contract.attachments.length > 0 ? (
        <div className='space-y-2'>
          {contract.attachments.map((attachment) => (
            <ContractAttachmentRow
              key={attachment.id}
              contractId={contract.id}
              attachment={attachment}
              onContractChange={onContractChange}
            />
          ))}
        </div>
      ) : (
        <div className='border-border bg-card/50 rounded-lg border border-dashed p-4 text-sm'>
          등록된 첨부파일이 없습니다.
        </div>
      )}

      <div className='rounded-lg border p-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <p className='text-sm font-medium'>첨부파일 없음 예외</p>
            <p className='text-muted-foreground mt-1 text-sm'>
              {contract.no_attachment_required
                ? contract.no_attachment_reason ||
                  '첨부파일 없음으로 지정되어 독촉 대상에서 제외됩니다.'
                : isNoAttachmentSetBlocked
                  ? '활성 첨부파일이 있어 첨부파일 없음으로 지정할 수 없습니다.'
                  : '첨부파일이 필요 없는 문서라면 예외로 지정할 수 있습니다.'}
            </p>
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={
              contract.status === 'soft_deleted' ||
              isSaving ||
              isNoAttachmentSetBlocked
            }
            onClick={() => setNoAttachmentOpen(true)}
          >
            {contract.no_attachment_required
              ? '지정 해제'
              : '첨부파일 없음 지정'}
          </Button>
        </div>
        {!contract.no_attachment_required ? (
          <textarea
            value={noAttachmentReason}
            onChange={(event) => setNoAttachmentReason(event.target.value)}
            placeholder='지정 사유를 입력해 주세요. (선택)'
            disabled={isNoAttachmentSetBlocked}
            className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-3 min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
          />
        ) : null}
      </div>
    </section>
  );
}

function ContractEditSheetContent({
  contract,
  onOpenChange
}: ContractEditSheetContentProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [displayContract, setDisplayContract] =
    useState<ContractDocument | null>(contract);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const contractForDisplay = displayContract ?? contract;

  const updateMutation = useMutation(updateContractMutation);
  const uploadMutation = useMutation(uploadContractAttachmentMutation);

  const form = useAppForm({
    defaultValues: toFormValues(contract),
    validators: {
      onSubmit: buildSubmitSchema()
    },
    onSubmit: async ({ value }) => {
      setApiError(null);
      const payload: ContractUpdatePayload = {
        document_created_at: value.document_created_at.trim(),
        approved_at: cleanOptionalText(value.approved_at),
        author_name: value.author_name.trim(),
        author_email: cleanOptionalText(value.author_email),
        contract_target: value.contract_target.trim(),
        contract_summary: value.contract_summary.trim(),
        amount: value.amount ?? null,
        contract_start_date: cleanOptionalText(value.contract_start_date),
        contract_end_date: cleanOptionalText(value.contract_end_date),
        notes: cleanOptionalText(value.notes),
        source_document_url: cleanOptionalText(value.source_document_url)
      };

      const parsed = contractUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
        setApiError(message);
        notifyError(message);
        return;
      }

      try {
        const updateResponse = await updateMutation.mutateAsync({
          id: contract.id,
          payload: parsed.data
        });
        let latestContract = updateResponse.contract;
        setDisplayContract(latestContract);

        for (let index = 0; index < selectedFiles.length; index += 1) {
          const file = selectedFiles[index];
          try {
            const uploadResponse = await uploadMutation.mutateAsync({
              id: contract.id,
              file
            });
            latestContract = uploadResponse.contract;
            setDisplayContract(latestContract);
          } catch (error) {
            const message =
              error instanceof Error
                ? `"${file.name}" 업로드 실패: ${error.message}`
                : `"${file.name}" 업로드에 실패했습니다.`;
            setSelectedFiles(selectedFiles.slice(index));
            setApiError(message);
            notifyError(message);
            return;
          }
        }

        notifySuccess(
          selectedFiles.length > 0
            ? '계약서와 첨부파일이 저장되었습니다.'
            : '계약서가 수정되었습니다.'
        );
        setApiError(null);
        setSelectedFiles([]);
        form.reset(toFormValues(latestContract));
        onOpenChange(false);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '계약서 수정에 실패했습니다.';
        setApiError(message);
        notifyError(message);
      }
    }
  });

  const { FormTextField, FormTextareaField } =
    useFormFields<ContractEditFormValues>();

  function handleRemoveSelectedFile(index: number) {
    setSelectedFiles((files) =>
      files.filter((_, fileIndex) => fileIndex !== index)
    );
  }

  return (
    <>
        {apiError ? (
          <div className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {apiError}
          </div>
        ) : null}

        <form.AppForm>
          <form.Form
            id='contract-edit-form'
            className='flex h-full min-h-0 flex-col'
          >
            <div className='min-h-0 flex-1 space-y-4 overflow-auto py-2 pr-1'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <form.AppField
                  name='document_created_at'
                >
                  {(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          문서 생성일{' '}
                          <span className='text-destructive'>*</span>
                        </field.FieldLabel>
                        <input
                          id={field.name}
                          name={field.name}
                          aria-label='문서 생성일'
                          type='date'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                </form.AppField>
                <form.AppField
                  name='approved_at'
                >
                  {(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          문서승인일
                        </field.FieldLabel>
                        <input
                          id={field.name}
                          name={field.name}
                          aria-label='문서승인일'
                          type='date'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                </form.AppField>
                <FormTextField
                  name='author_name'
                  label='작성자'
                  required
                  placeholder='작성자'
                />
              </div>

              <FormTextField
                name='author_email'
                label='작성자 이메일'
                placeholder='author@example.com'
              />
              <FormTextField
                name='contract_target'
                label='계약대상'
                required
                placeholder='계약대상'
              />
              <FormTextareaField
                name='contract_summary'
                label='계약 내용'
                required
                rows={4}
                placeholder='계약 내용을 입력해 주세요.'
              />

              <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                <FormTextField
                  name='amount'
                  label='금액'
                  type='number'
                  min={0}
                  step={1}
                  placeholder='예: 1000000'
                />
                <form.AppField
                  name='contract_start_date'
                >
                  {(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          계약 시작일
                        </field.FieldLabel>
                        <input
                          id={field.name}
                          name={field.name}
                          aria-label='계약 시작일'
                          type='date'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                </form.AppField>
                <form.AppField
                  name='contract_end_date'
                >
                  {(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          계약 종료일
                        </field.FieldLabel>
                        <input
                          id={field.name}
                          name={field.name}
                          aria-label='계약 종료일'
                          type='date'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                </form.AppField>
              </div>

              <FormTextareaField
                name='notes'
                label='비고'
                rows={4}
                placeholder='추가 메모'
              />
              <FormTextField
                name='source_document_url'
                label='Flex 문서 URL'
                placeholder='https://...'
              />
              {contractForDisplay ? (
                <ContractAttachmentManager
                  contract={contractForDisplay}
                  onContractChange={setDisplayContract}
                  selectedFiles={selectedFiles}
                  onSelectedFilesChange={setSelectedFiles}
                  onRemoveSelectedFile={handleRemoveSelectedFile}
                  isSaving={
                    updateMutation.isPending || uploadMutation.isPending
                  }
                />
              ) : null}
            </div>
          </form.Form>
        </form.AppForm>

        <SheetFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type='submit'
            form='contract-edit-form'
            isLoading={updateMutation.isPending || uploadMutation.isPending}
          >
            <Icons.edit className='mr-2 h-4 w-4' />
            저장
          </Button>
        </SheetFooter>
    </>
  );
}

export function ContractEditSheet({
  contract,
  open,
  onOpenChange
}: ContractEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>계약서 수정</SheetTitle>
          <SheetDescription>
            OpenClaw가 수집한 계약 문서 정보를 보정합니다.
          </SheetDescription>
        </SheetHeader>

        {contract ? (
          <ContractEditSheetContent
            key={contract.id}
            contract={contract}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
