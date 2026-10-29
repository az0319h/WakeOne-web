'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type UnderlineTabItem = {
  value: string;
  label: string;
};

type AssetLedgerUnderlineTabsProps = {
  items: UnderlineTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** 탭 옆 건수 — 처음 로딩 땐 undefined(라벨만) */
  counts: Record<string, number> | undefined;
  /** 묶음 testid (`subscription-category-tabs` · `equipment-kind-tabs`) */
  listTestId: string;
  /** 탭별 testid 접두 (`subscription-category-tab` → `subscription-category-tab-{value}`) */
  tabTestIdPrefix: string;
  ariaLabel: string;
  /** 활성 탭 내용(필터 줄 + 본문) — aria-controls가 실제 영역을 가리키게 */
  children: React.ReactNode;
};

const TRIGGER_CLASS = cn(
  'relative h-10 flex-none rounded-none border-0 bg-transparent px-0 pb-2.5 font-medium text-muted-foreground shadow-none',
  'data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
  'dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent',
  'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full data-[state=active]:after:bg-foreground'
);

/**
 * 구분·품목 밑줄 탭 (designer §2-3) — `ui/tabs` className 확장만(ui 파일 수정 없음).
 * 9개 탭은 가로 스크롤(자기 안에서만 · 페이지 가로 스크롤 없음).
 */
export function AssetLedgerUnderlineTabs({
  items,
  value,
  onValueChange,
  counts,
  listTestId,
  tabTestIdPrefix,
  ariaLabel,
  children
}: AssetLedgerUnderlineTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className='min-w-0 gap-4'>
      <div className='min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
        <TabsList
          data-testid={listTestId}
          aria-label={ariaLabel}
          className='h-auto w-max min-w-full justify-start gap-5 rounded-none border-b bg-transparent p-0'
        >
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              data-testid={`${tabTestIdPrefix}-${item.value}`}
              className={TRIGGER_CLASS}
            >
              {item.label}
              {counts ? ' ' : null}
              {counts ? (
                <span className='font-normal text-muted-foreground tabular-nums'>
                  {counts[item.value] ?? 0}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value={value} className='flex min-w-0 flex-col gap-4'>
        {children}
      </TabsContent>
    </Tabs>
  );
}
