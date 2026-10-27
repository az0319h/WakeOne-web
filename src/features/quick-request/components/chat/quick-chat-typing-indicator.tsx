import { formatTypingNames } from './format-typing-names';

type QuickChatTypingIndicatorProps = {
  names: string[];
};

/** 「{이름}님이 입력 중…」 1줄 — 높이 고정(h-5)이라 레이아웃이 튀지 않는다 (U-14 · C-23) */
export function QuickChatTypingIndicator({ names }: QuickChatTypingIndicatorProps) {
  const text = formatTypingNames(names);
  return (
    <p
      data-testid='quick-chat-typing'
      aria-live='polite'
      className='flex h-5 shrink-0 items-center gap-1 truncate px-4 text-xs text-muted-foreground'
    >
      {text ? (
        <>
          <span className='truncate'>{text}</span>
          <span aria-hidden className='inline-flex items-end gap-0.5'>
            <span className='size-1 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none' />
            <span className='size-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:150ms] motion-reduce:animate-none' />
            <span className='size-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:300ms] motion-reduce:animate-none' />
          </span>
        </>
      ) : null}
    </p>
  );
}
