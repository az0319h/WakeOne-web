import type { QuickRequestGoodsSize } from '../schemas/quick-request-notify';

export type QuickRequestGoodsVisual = {
  /** 카드 제목 · 요약 · 메시지 `크기:` 라벨 */
  title: string;
  /** 카드 예시 1줄 (기타는 없음) */
  caption: string | null;
  /** null = 이미지 없는 아이콘 카드(기타) */
  src: string | null;
  /** svg 원본 크기 (next/image width·height) */
  width: number;
  height: number;
};

const GOODS_IMAGE_BASE = '/quick-request/goods';

/** plan 87 — 물품 크기 라벨 단일 출처 (카드 · 요약 · 카톡 메시지 공용) */
export const QUICK_REQUEST_GOODS_VISUALS: Record<QuickRequestGoodsSize, QuickRequestGoodsVisual> = {
  xs: {
    title: '초소형',
    caption: '휴대폰',
    src: `${GOODS_IMAGE_BASE}/goods-xs.svg`,
    width: 72,
    height: 78
  },
  s: {
    title: '소형',
    caption: 'A4박스',
    src: `${GOODS_IMAGE_BASE}/goods-s.svg`,
    width: 80,
    height: 82
  },
  m: {
    title: '중형',
    caption: '라면박스',
    src: `${GOODS_IMAGE_BASE}/goods-m.svg`,
    width: 87,
    height: 82
  },
  other: { title: '기타', caption: null, src: null, width: 0, height: 0 }
};

/** `소형` · `기타` (크기명만) · 선택 전 `null` */
export function formatQuickRequestGoodsSizeLabel(
  goodsSize: QuickRequestGoodsSize | ''
): string | null {
  if (!goodsSize) {
    return null;
  }
  return QUICK_REQUEST_GOODS_VISUALS[goodsSize].title;
}

/**
 * plan 87 r1 — 전송·메시지·요약에 쓰는 물품 내용.
 * 「기타」면 trim 값, 그 외(초소형·소형·중형·미선택)는 폼에 값이 남아 있어도 `''`.
 */
export function resolveQuickRequestItemDescription(
  goodsSize: QuickRequestGoodsSize | '',
  itemDescription: string
): string {
  return goodsSize === 'other' ? itemDescription.trim() : '';
}
