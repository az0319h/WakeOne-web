'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QUICK_CHAT_TEXT } from './quick-chat-constants';

/**
 * plan 100 D-8 · designer §4-1 — 「✦ AI 추천」 배지 (칩 줄 왼쪽 고정 칸 · AI 추천이 칩에 들어온 동안만).
 * `RealtimeStatusBadge` 패턴: `Tooltip > TooltipTrigger asChild > Badge(tabIndex=0)`. 액션이 없으므로 button 역할 금지
 * (기존 spec이 칩 줄의 `getByRole('button')` 개수를 센다). 모바일은 Tooltip이 안 뜨므로 설명은 `aria-label`·ⓘ 1줄이 담당.
 */
export function QuickChatAiBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant='outline'
          role='note'
          tabIndex={0}
          aria-label={`${QUICK_CHAT_TEXT.aiBadge} — ${QUICK_CHAT_TEXT.aiBadgeTooltip}`}
          data-testid='quick-chat-ai-badge'
          className='shrink-0 gap-1 rounded-full border-primary/30 px-2 py-0.5 text-xs font-normal text-primary'
        >
          <Icons.sparkles aria-hidden className='size-3' />
          {QUICK_CHAT_TEXT.aiBadge}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side='top' align='start'>
        {QUICK_CHAT_TEXT.aiBadgeTooltip}
      </TooltipContent>
    </Tooltip>
  );
}
