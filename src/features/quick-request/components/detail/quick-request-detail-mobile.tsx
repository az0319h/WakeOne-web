'use client';

import { cn } from '@/lib/utils';
import type { QuickRequestDetail } from '../../api/types';
import {
  hasQuickDetailActions,
  resolveQuickDetailPrimaryAction,
  type QuickRequestDetailActionHandlers
} from './quick-request-action-bar';
import { QuickRequestAmountSection } from './quick-request-amount-section';
import {
  QUICK_DETAIL_DL_CLASS,
  QuickDetailGoodsRows,
  QuickDetailRow,
  QuickDetailSection
} from './quick-detail-section';
import { QuickRequestDetailHero } from './quick-request-detail-hero';
import { QuickRequestDriverCard } from './quick-request-driver-card';
import { QuickRequestHistorySection } from './quick-request-history';
import { QuickRequestMobileActionBar } from './quick-request-mobile-action-bar';
import { QuickRequestPhoneLink } from './quick-request-phone-link';
import { QuickRequestRouteView } from './quick-request-route-view';

type QuickRequestDetailMobileProps = QuickRequestDetailActionHandlers & {
  detail: QuickRequestDetail;
};

/**
 * plan 106 D-15 · D-16 · designer §6.2 (K9) — lg(1024) 미만 상세 **휴대폰 전용 트리 1벌**.
 * 상세 본문은 hydration 뒤에만 그려지므로 `useMatchMedia`로 PC 트리와 한 벌만 렌더한다(testid 중복 없음).
 *
 * ① 상태 카드(번호·상태·ⓘ / 지금 상태 한 문장 / 스테퍼 시각) → ② 기사 카드 → ③ 금액 → ④ 이동 경로
 * → ⑤ 물품·차량·운임 → ⑥ 요청 정보(요청자·연락처만 · 요청 시각·번호 반복 제거) → ⑦ 처리 이력(접힘)
 * → 하단 바(주 버튼 + 대화 + ⋯) 또는 떠 있는 「대화」.
 * 「배차 정보」 카드는 없다(기사 카드가 대신 · `quick-detail-driver-phone` 한 벌).
 */
export function QuickRequestDetailMobile({ detail, ...handlers }: QuickRequestDetailMobileProps) {
  const primary = resolveQuickDetailPrimaryAction(detail);
  // 승인 막힘(최종금액 없음 · 비활성)은 「활성 주 버튼 없음」으로 본다 (designer K11)
  const hasActivePrimary =
    primary !== null && !(primary === 'approve' && detail.finalAmount == null);
  const hasBar = hasQuickDetailActions(detail);

  return (
    <div
      data-testid='quick-detail-mobile'
      className={cn('flex min-w-0 flex-col gap-3', !hasBar && 'pb-24')}
    >
      <QuickRequestDetailHero detail={detail} variant='mobile' />
      <QuickRequestDriverCard
        detail={detail}
        callButtonVariant={hasActivePrimary ? 'outline' : 'default'}
      />
      <QuickRequestAmountSection detail={detail} density='compact' />
      <QuickDetailSection title='이동 경로' density='compact' data-testid='quick-detail-section-route'>
        <QuickRequestRouteView detail={detail} />
      </QuickDetailSection>
      <QuickDetailSection
        title='물품 · 차량 · 운임'
        density='compact'
        data-testid='quick-detail-section-goods'
      >
        <QuickDetailGoodsRows detail={detail} />
      </QuickDetailSection>
      <QuickDetailSection title='요청 정보' density='compact' data-testid='quick-detail-section-request'>
        <dl className={QUICK_DETAIL_DL_CLASS}>
          <QuickDetailRow label='요청자'>{detail.requester.name}</QuickDetailRow>
          <QuickDetailRow label='연락처'>
            <QuickRequestPhoneLink phone={detail.requester.phone} />
          </QuickDetailRow>
        </dl>
      </QuickDetailSection>
      <QuickRequestHistorySection detail={detail} />
      <QuickRequestMobileActionBar detail={detail} {...handlers} />
    </div>
  );
}
