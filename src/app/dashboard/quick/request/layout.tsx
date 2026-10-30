type QuickRequestLayoutProps = {
  children: React.ReactNode;
};

/**
 * 퀵 요청 화면 높이 제한 — **lg(1024) 이상만** 좌측 폼 독립 스크롤 · 우측 요약 고정용.
 * plan 106 D-10 ① — lg 미만은 높이 고정·overflow 없이 **페이지 전체 스크롤**(하단 요약바는 sticky).
 * lg에서 `flex-1` 금지 — flex-basis 0이 content 높이 부모에서 h-[calc]를 무력화한다(`lg:flex-none`).
 * Live presence track은 상위 `dashboard/layout.tsx`에서 상속 (plan 49) — 여기서 추가 금지.
 */
export default function QuickRequestLayout({ children }: QuickRequestLayoutProps) {
  return (
    <div className='flex min-w-0 flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:min-h-0 lg:flex-none lg:overflow-hidden'>
      {children}
    </div>
  );
}
