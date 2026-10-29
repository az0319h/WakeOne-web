import type { Icons } from '@/components/icons';
import type { EquipmentKind, EquipmentStatus } from '@/features/equipment/api/types';
import type { AssetRequestStatus } from '@/features/asset-requests/api/types';
import type { SubscriptionCategory, SubscriptionStatus } from '@/features/subscriptions/api/types';

/**
 * plan 103 · designer §5 — 화면 전용 라벨·색·아이콘 (한곳).
 * 업무 라벨(상태·구분·품목·종류 이름)은 각 feature `api/types.ts`가 원본이고, 여기는 표시 톤만 둔다.
 */

export type LedgerTone = 'green' | 'amber' | 'blue' | 'red' | 'gray' | 'violet';

/** CS 배지와 같은 연한 배경 둥근 배지 — 글자색 *-700으로 AA 대비 */
export const LEDGER_TONE_CLASSES: Record<LedgerTone, string> = {
  green: 'border-transparent bg-green-500/10 text-green-700 dark:text-green-400',
  amber: 'border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400',
  blue: 'border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400',
  red: 'border-transparent bg-red-500/10 text-red-700 dark:text-red-400',
  gray: 'border-transparent bg-muted text-muted-foreground',
  violet: 'border-transparent bg-violet-500/10 text-violet-700 dark:text-violet-300'
};

export const SUBSCRIPTION_STATUS_TONES: Record<SubscriptionStatus, LedgerTone> = {
  active: 'green',
  cancel_scheduled: 'amber',
  canceled: 'gray'
};

export const EQUIPMENT_STATUS_TONES: Record<EquipmentStatus, LedgerTone> = {
  in_use: 'green',
  stored: 'gray',
  repair: 'blue',
  lost: 'red',
  disposed: 'gray'
};

export const ASSET_REQUEST_STATUS_TONES: Record<AssetRequestStatus, LedgerTone> = {
  pending: 'amber',
  in_progress: 'blue',
  completed: 'green',
  rejected: 'red',
  canceled: 'gray'
};

type IconKey = keyof typeof Icons;

/** 구독 구분 아이콘 (designer §2-12) */
export const SUBSCRIPTION_CATEGORY_ICONS: Record<SubscriptionCategory, IconKey> = {
  creative: 'palette',
  software: 'code',
  collaboration: 'workspace',
  etc: 'product'
};

/** 비품 품목 아이콘 (plan §품목 표 · designer §2-12) */
export const EQUIPMENT_KIND_ICONS: Record<EquipmentKind, IconKey> = {
  notebook: 'laptop',
  monitor: 'monitor',
  desktop: 'cpu',
  mouse: 'mouse',
  keyboard: 'keyboard',
  tablet: 'smartphone',
  store_device: 'creditCard',
  etc: 'product'
};

/** 요청 1건 제목 — 종류 라벨에 「요청」을 붙이면 어색한 것만 따로 (designer §5) */
const REQUEST_TITLES: Record<string, string> = {
  repair: '고장·수리 요청',
  replace: '교체 요청',
  return: '반납 요청',
  lost: '분실 신고',
  other: '기타 요청',
  cancel: '해지 요청',
  change: '변경 요청'
};

export function assetRequestTitle(requestType: string): string {
  return REQUEST_TITLES[requestType] ?? '요청';
}

/** 아바타 이니셜 — 세 글자 한국어 이름은 뒤 두 글자(「김하늘」 → 「하늘」) */
export function nameInitials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  if (/^[가-힣]{3,4}$/.test(trimmed)) return trimmed.slice(-2);
  return trimmed.slice(0, 2).toUpperCase();
}

/** `target_label`(「N-012 · MacBook Air 13」) 앞부분 — 뒤로 가기 「N-012 장비로」·「{구독명} 구독으로」 */
export function targetLabelHead(targetLabel: string): string {
  return targetLabel.split(' · ')[0]?.trim() || targetLabel;
}
