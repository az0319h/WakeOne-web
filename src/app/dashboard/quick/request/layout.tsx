type QuickRequestLayoutProps = {
  children: React.ReactNode;
};

/**
 * 퀵 요청 화면 높이 제한 — 좌측 폼 독립 스크롤 · 우측 요약/하단 바 고정용.
 * `flex-1` 금지 — flex-basis 0이 content 높이 부모에서 h-[calc]를 무력화한다.
 * Live presence track은 상위 `dashboard/layout.tsx`에서 상속 (plan 49) — 여기서 추가 금지.
 */
export default function QuickRequestLayout({ children }: QuickRequestLayoutProps) {
  return (
    <div className='flex h-[calc(100dvh-4rem)] min-h-0 shrink-0 flex-col overflow-hidden md:h-[calc(100dvh-3.5rem)]'>
      {children}
    </div>
  );
}
