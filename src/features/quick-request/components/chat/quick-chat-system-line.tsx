import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { QuickChatSystemEvent } from './group-messages';
import { quickChatText } from './quick-chat-constants';
import { QuickChatDivider } from './quick-chat-divider';

type QuickChatSystemLineProps = {
  event: QuickChatSystemEvent;
};

export function formatQuickChatSystemLabel(event: QuickChatSystemEvent): string {
  const time = formatAbsoluteDateTimeKo(event.at);
  switch (event.type) {
    case 'joined':
      return quickChatText.systemJoined(event.name, time);
    case 'removed':
      return quickChatText.systemRemoved(event.name, time);
    case 'left':
      return quickChatText.systemLeft(event.name, time);
  }
}

/** plan 101 D-7 · U-5 — 「{이름}님이 참여했습니다 · {절대 시각}」 시스템 줄 (`QuickChatDivider` muted 그대로) */
export function QuickChatSystemLine({ event }: QuickChatSystemLineProps) {
  return (
    <div data-event-type={event.type} data-user-id={event.userId}>
      <QuickChatDivider label={formatQuickChatSystemLabel(event)} data-testid='quick-chat-system-line' />
    </div>
  );
}
