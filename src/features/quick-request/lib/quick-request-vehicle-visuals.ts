import type { QuickRequestVehicleType } from '../schemas/quick-request-notify';

export type QuickRequestVehicleVisual = {
  /** null = 이미지 없는 아이콘 카드(기타) */
  src: string | null;
  /** 카드 1행 표시 라벨 (접근성 이름은 img alt가 담당) */
  title: string;
  /** 카드 2행 괄호 표기 */
  caption?: string;
  /** 이미지 타일 톤수 배지 */
  badge?: string;
};

const VEHICLE_IMAGE_BASE = '/quick-request/vehicles';

export const QUICK_REQUEST_VEHICLE_VISUALS: Record<
  QuickRequestVehicleType,
  QuickRequestVehicleVisual
> = {
  오토바이: { src: `${VEHICLE_IMAGE_BASE}/vehicle-quick.png`, title: '오토바이' },
  다마스: { src: `${VEHICLE_IMAGE_BASE}/vehicle-damas.png`, title: '다마스' },
  라보: { src: `${VEHICLE_IMAGE_BASE}/vehicle-labo.png`, title: '라보' },
  '1톤 탑차(윙바디)': {
    src: `${VEHICLE_IMAGE_BASE}/vehicle-1ton-wingbody.png`,
    title: '1톤 탑차',
    caption: '윙바디'
  },
  '1톤 오픈형': { src: `${VEHICLE_IMAGE_BASE}/vehicle-1ton.png`, title: '1톤 오픈형' },
  '1톤 냉장(냉동)': {
    src: `${VEHICLE_IMAGE_BASE}/vehicle-1ton-refrigerated.png`,
    title: '1톤 냉장',
    caption: '냉동'
  },
  '2.5톤': { src: `${VEHICLE_IMAGE_BASE}/vehicle-2-5ton.png`, title: '2.5톤' },
  '5톤': { src: `${VEHICLE_IMAGE_BASE}/vehicle-5ton.png`, title: '5톤' },
  기타: { src: null, title: '기타' }
};
