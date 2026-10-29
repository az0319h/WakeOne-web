/**
 * plan 102 — 생일 휠 카드와 Skeleton이 함께 쓰는 치수·클래스.
 * 높이 414 = border 2 + py-5 40 + 헤더 22 + mt-3 12 + 탭 36 + gap-3 12 + 휠 290 (D-15).
 */

/** 줄 높이(px) — 가운데 맞춤은 `index × ROW_HEIGHT`로 계산한다 */
export const BIRTHDAY_WHEEL_ROW_HEIGHT = 64;

/** 카드·Skeleton 고정 높이 (PC·모바일 동일) */
export const BIRTHDAY_CARD_HEIGHT_CLASS = 'h-[414px]';

/** 휠 위아래 끝 흐림 — black/transparent는 색이 아니라 알파 마스크 값 */
export const BIRTHDAY_WHEEL_MASK_CLASS =
  '[mask-image:linear-gradient(to_bottom,transparent_0,black_14%,black_86%,transparent_100%)]';
