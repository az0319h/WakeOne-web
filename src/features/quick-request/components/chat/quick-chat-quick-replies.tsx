'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { QuickChatAiSource } from '../../schemas/quick-request-chat';
import { QuickChatAiBadge } from './quick-chat-ai-badge';
import { QUICK_CHAT_AI_LOADING_DELAY_MS, QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';

type QuickChatQuickRepliesProps = {
  replies: readonly string[];
  /** 입력창에 채우기만 (전송 0건 · C-14) */
  onPick: (text: string) => void;
  /** plan 100 — `ai`면 왼쪽 「AI 추천」 배지 + 칩마다 전체 문장 Tooltip. 기본 `rules`(지금 화면 그대로) */
  source?: QuickChatAiSource;
  /** plan 100 — AI 추천 대기 중. 300ms 넘게 이어질 때만 오른쪽 칸에 스피너 (칩은 그대로 누를 수 있음) */
  loading?: boolean;
};

type QuickReplyChipProps = Omit<React.ComponentProps<'button'>, 'children' | 'type'> & {
  reply: string;
  index: number;
  onPick: (text: string) => void;
};

/**
 * plan 106 — 휴대폰 규칙(lg 미만 · 태블릿 포함)은 44px, PC(lg↑)는 지금처럼 36px.
 * 긴 AI 문장은 `max-w` + 말줄임 (전체 문장은 Tooltip · 모바일은 탭하면 입력창에서 확인).
 * `TooltipTrigger asChild`가 넘기는 ref·이벤트·`data-state`·`aria-describedby`를 Button에 그대로 전달한다 (React 19 ref prop).
 */
function QuickReplyChip({ reply, index, onPick, onClick, className, ...props }: QuickReplyChipProps) {
  return (
    <Button
      {...props}
      type='button'
      variant='outline'
      size='sm'
      className={cn(
        'h-11 max-w-[14rem] shrink-0 touch-manipulation rounded-full px-3 sm:max-w-[16rem] lg:h-9',
        className
      )}
      data-testid={`quick-chat-quick-reply-${index}`}
      onClick={(event) => {
        onClick?.(event);
        onPick(reply);
      }}
    >
      <span className='min-w-0 truncate'>{reply}</span>
    </Button>
  );
}

/** 오른쪽 고정 칸 — 마운트 후 300ms가 지나야 보인다 (`loading`이 끝나면 언마운트돼 타이머도 초기화) */
function QuickChatAiLoading() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), QUICK_CHAT_AI_LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!shown) {
    return null;
  }

  return (
    <span aria-hidden data-testid='quick-chat-ai-loading' className='flex shrink-0 items-center gap-1'>
      <Spinner className='size-3.5 text-muted-foreground motion-reduce:animate-none' />
      <span className='hidden text-xs text-muted-foreground sm:inline'>{QUICK_CHAT_TEXT.aiLoading}</span>
    </span>
  );
}

/**
 * plan 93 C-14 · plan 100 designer §4 — [배지 칸] + [가로 스크롤 칩 줄] + [로딩 칸].
 * 모든 폭에서 한 줄(nowrap)이라 칩 수·길이·배지·스피너와 무관하게 줄 높이가 같다 (AC-14).
 * `quick-chat-quick-replies`(role=group) 안에는 칩 버튼만 둔다 — 기존 spec이 `getByRole('button')` 개수를 센다.
 */
export function QuickChatQuickReplies({
  replies,
  onPick,
  source = 'rules',
  loading = false
}: QuickChatQuickRepliesProps) {
  if (replies.length === 0) {
    return null;
  }

  const isAi = source === 'ai';

  return (
    <div data-testid='quick-chat-quick-replies-row' className='flex min-w-0 items-center gap-2'>
      {isAi ? <QuickChatAiBadge /> : null}
      <div
        role='group'
        aria-label={QUICK_CHAT_TEXT.quickReplies}
        aria-busy={loading}
        data-testid='quick-chat-quick-replies'
        data-source={source}
        className='flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain py-1 [mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      >
        {replies.map((reply, index) =>
          isAi ? (
            <Tooltip key={`${index}:${reply}`}>
              <TooltipTrigger asChild>
                <QuickReplyChip reply={reply} index={index} onPick={onPick} />
              </TooltipTrigger>
              <TooltipContent side='top'>{reply}</TooltipContent>
            </Tooltip>
          ) : (
            <QuickReplyChip key={`${index}:${reply}`} reply={reply} index={index} onPick={onPick} />
          )
        )}
        {/* 끝 여백 — 마지막 칩이 오른쪽 흐림에 가리지 않게 */}
        <span aria-hidden className='w-4 shrink-0' />
      </div>
      {loading ? <QuickChatAiLoading /> : null}
      <span className='sr-only' aria-live='polite'>
        {isAi ? quickChatText.aiReadyLive(replies.length) : ''}
      </span>
    </div>
  );
}
