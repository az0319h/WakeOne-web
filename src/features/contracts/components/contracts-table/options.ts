import type { Option } from '@/types/data-table';
import type { ContractFilters } from '../../api/types';

export const CONTRACT_ATTACHMENT_STATUS_OPTIONS: Option[] = [
  { label: '첨부 누락', value: 'missing' },
  { label: '첨부 완료', value: 'has_attachment' },
  { label: '첨부파일 없음', value: 'no_attachment_required' },
  { label: '삭제됨/비활성', value: 'soft_deleted' }
];

export const CONTRACT_ATTACHMENT_STATUS_LABELS: Record<
  NonNullable<ContractFilters['attachment_status']>,
  string
> = {
  missing: '첨부 누락',
  has_attachment: '첨부 완료',
  no_attachment_required: '첨부파일 없음',
  soft_deleted: '삭제됨/비활성'
};
