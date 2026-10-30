import { formatChatBubbleTimeKo } from '@/lib/format-datetime';
import type { QuickChatSystemEvent } from './group-messages';
import { quickChatText } from './quick-chat-constants';
import { QuickChatDivider } from './quick-chat-divider';

type QuickChatSystemLineProps = {
  event: QuickChatSystemEvent;
};

export function formatQuickChatSystemLabel(event: QuickChatSystemEvent): string {
  // plan 106 D-14 — 대화 안 시스템 줄도 `HH:mm` (날짜는 위 구분선)
  const time = formatChatBubbleTimeKo(event.at);
  switch (event.type) {
    case 'joined':
      return quickChatText.systemJoined(event.name, time);
    case 'removed':
      return quickChatText.systemRemoved(event.name, time);
    case 'left':
      return quickChatText.systemLeft(event.name, time);
  }
}

/** plan 101 D-7 · U-5 — 「{이름}님이 참여했습니다 · {HH:mm}」 시스템 줄 (`QuickChatDivider` muted 그대로 · plan 106 D-14) */
export function QuickChatSystemLine({ event }: QuickChatSystemLineProps) {
  return (
    <div data-event-type={event.type} data-user-id={event.userId}>
      <QuickChatDivider label={formatQuickChatSystemLabel(event)} data-testid='quick-chat-system-line' />
    </div>
  );
}
