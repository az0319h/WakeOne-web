import { Icons } from '@/components/icons';
import {
  QUICK_CHAT_READ_ONLY_NOTICE,
  type QuickChatReadOnlyReason
} from '../../schemas/quick-request-chat';

type QuickChatReadOnlyNoticeProps = {
  reason: QuickChatReadOnlyReason;
};

/** 입력 영역 자리의 읽기 전용 안내 한 줄 (U-7 · AC-05 · AC-07) */
export function QuickChatReadOnlyNotice({ reason }: QuickChatReadOnlyNoticeProps) {
  return (
    <div
      role='status'
      data-testid='quick-chat-read-only'
      data-reason={reason}
      className='flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground'
    >
      <Icons.info aria-hidden className='mt-0.5 size-4 shrink-0' />
      <span>{QUICK_CHAT_READ_ONLY_NOTICE[reason]}</span>
    </div>
  );
}
