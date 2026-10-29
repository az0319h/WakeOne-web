import { Badge } from '@/components/ui/badge';
import {
  ASSET_REQUEST_STATUS_LABELS,
  type AssetRequestStatus
} from '@/features/asset-requests/api/types';
import { EQUIPMENT_STATUS_LABELS, type EquipmentStatus } from '@/features/equipment/api/types';
import {
  SUBSCRIPTION_STATUS_LABELS,
  type SubscriptionStatus
} from '@/features/subscriptions/api/types';
import { cn } from '@/lib/utils';
import {
  ASSET_REQUEST_STATUS_TONES,
  EQUIPMENT_STATUS_TONES,
  LEDGER_TONE_CLASSES,
  SUBSCRIPTION_STATUS_TONES,
  type LedgerTone
} from '../lib/ui-labels';

const BADGE_BASE = 'rounded-full px-2 py-0.5 text-xs font-normal whitespace-nowrap shadow-none';

type AssetStatusBadgeProps = (
  | { kind: 'subscription'; status: SubscriptionStatus }
  | { kind: 'equipment'; status: EquipmentStatus }
  | { kind: 'request'; status: AssetRequestStatus }
) & {
  className?: string;
  'data-testid'?: string;
};

function resolve(props: AssetStatusBadgeProps): { label: string; tone: LedgerTone } {
  switch (props.kind) {
    case 'subscription':
      return {
        label: SUBSCRIPTION_STATUS_LABELS[props.status] ?? props.status,
        tone: SUBSCRIPTION_STATUS_TONES[props.status] ?? 'gray'
      };
    case 'equipment':
      return {
        label: EQUIPMENT_STATUS_LABELS[props.status] ?? props.status,
        tone: EQUIPMENT_STATUS_TONES[props.status] ?? 'gray'
      };
    case 'request':
      return {
        label: ASSET_REQUEST_STATUS_LABELS[props.status] ?? props.status,
        tone: ASSET_REQUEST_STATUS_TONES[props.status] ?? 'gray'
      };
  }
}

/** 상태 배지 — 글자로 상태를 말한다(색만으로 구분하지 않음) · `data-status` 항상 (designer §5) */
export function AssetStatusBadge(props: AssetStatusBadgeProps) {
  const { label, tone } = resolve(props);
  return (
    <Badge
      variant='outline'
      data-status={props.status}
      data-testid={props['data-testid']}
      className={cn(BADGE_BASE, LEDGER_TONE_CLASSES[tone], props.className)}
    >
      {label}
    </Badge>
  );
}

type ToneBadgeProps = {
  tone: LedgerTone;
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
};

/** 톤만 고른 작은 배지 — 「처리 대기 N」「권한자만」 등 */
export function LedgerToneBadge({ tone, children, className, ...rest }: ToneBadgeProps) {
  return (
    <Badge
      variant='outline'
      data-testid={rest['data-testid']}
      className={cn(BADGE_BASE, LEDGER_TONE_CLASSES[tone], className)}
    >
      {children}
    </Badge>
  );
}
