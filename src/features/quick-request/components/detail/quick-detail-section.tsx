import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { QuickRequestDetail } from '../../api/types';
import {
  formatQuickFreightLabel,
  formatQuickGoodsLabel,
  formatQuickVehicleTypes
} from '../../lib/quick-request-route-label';

type QuickDetailSectionProps = {
  title: string;
  description?: string;
  /** 헤더 오른쪽 슬롯 */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * plan 106 designer §6.2 — `compact`는 휴대폰 상세 트리용(`py-4` · `px-4` · `gap-3`).
   * 기본값(`default`)은 지금과 같다 → PC 화면 불변.
   */
  density?: 'default' | 'compact';
  'data-testid'?: string;
};

/** 상세 섹션 Card — 테두리만 (shadow-none · designer §3.3) */
export function QuickDetailSection({
  title,
  description,
  action,
  children,
  className,
  density = 'default',
  'data-testid': testId
}: QuickDetailSectionProps) {
  const isCompact = density === 'compact';
  const paddingX = isCompact ? 'px-4' : 'px-5';
  return (
    <Card
      data-testid={testId}
      className={cn('min-w-0 shadow-none', isCompact ? 'gap-3 py-4' : 'gap-4 py-5', className)}
    >
      <CardHeader className={cn('flex items-center justify-between gap-3', paddingX)}>
        <div className='min-w-0 space-y-1'>
          <h3 className='text-base font-semibold text-foreground'>{title}</h3>
          {description ? <p className='text-sm text-muted-foreground'>{description}</p> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn('min-w-0', paddingX)}>{children}</CardContent>
    </Card>
  );
}

type QuickDetailRowProps = {
  label: string;
  children: ReactNode;
};

/** `<dl>` 한 줄 — 라벨 / 값 */
export function QuickDetailRow({ label, children }: QuickDetailRowProps) {
  return (
    <>
      <dt className='text-sm break-keep text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 text-sm break-words text-foreground'>{children}</dd>
    </>
  );
}

export const QUICK_DETAIL_DL_CLASS =
  'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2';

type QuickDetailGoodsRowsProps = {
  detail: QuickRequestDetail;
};

/** 「물품 · 차량 · 운임」 섹션 본문 — PC·휴대폰 상세 트리 공용 (plan 106 · 같은 행·문구) */
export function QuickDetailGoodsRows({ detail }: QuickDetailGoodsRowsProps) {
  const isOtherGoods = detail.goodsSize === 'other';
  return (
    <dl className={QUICK_DETAIL_DL_CLASS}>
      <QuickDetailRow label='물품 크기'>{formatQuickGoodsLabel(detail.goodsSize)}</QuickDetailRow>
      {isOtherGoods && detail.itemDescription ? (
        <QuickDetailRow label='물품 내용'>
          <span className='whitespace-pre-wrap'>{detail.itemDescription}</span>
        </QuickDetailRow>
      ) : null}
      <QuickDetailRow label='차량 종류'>{formatQuickVehicleTypes(detail)}</QuickDetailRow>
      <QuickDetailRow label='대수'>
        <span className='tabular-nums'>{detail.vehicleCount}대</span>
      </QuickDetailRow>
      <QuickDetailRow label='운임'>{formatQuickFreightLabel(detail.freightPayment)}</QuickDetailRow>
    </dl>
  );
}
