import * as z from 'zod';

/**
 * plan 94 D-9 — 자동차등록번호(번호판) 형식 검사 (클라이언트 폼 · 서버 Route 공용 · 순수 함수).
 * 공백 정규화(trim · 연속 공백 1칸) 후 3패턴 중 하나면 통과. 최대 20자.
 * DB 컬럼 `dispatch_vehicle_info`·API 필드명 `vehicleInfo`/`dispatchVehicleInfo`는 그대로(라벨·검증만 변경).
 * 이 파일은 path alias(`@/…`)를 import하지 않는다 — `node --test`에서 직접 불러 쓰기 위함.
 */

export const QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH = 20;
export const QUICK_REQUEST_VEHICLE_PLATE_PLACEHOLDER = '예: 21마 6543';
export const QUICK_REQUEST_VEHICLE_PLATE_REQUIRED_MESSAGE = '자동차등록번호를 입력해 주세요.';
export const QUICK_REQUEST_VEHICLE_PLATE_INVALID_MESSAGE = '자동차등록번호 형식을 확인해 주세요. 예: 21마 6543';

/**
 * ① 현행 번호판 `21마 6543` · `123가 4567`
 * ② 지역 번호판 `서울 12가 3456`
 * ③ 이륜차 `서울 강남 가 1234`
 */
export const QUICK_REQUEST_VEHICLE_PLATE_PATTERNS: readonly RegExp[] = [
  /^\d{2,3}[가-힣] ?\d{4}$/,
  /^[가-힣]{2} ?\d{1,2}[가-힣] ?\d{4}$/,
  /^[가-힣]{2} ?[가-힣]{2,3} ?[가-힣] ?\d{4}$/
];

/** trim + 연속 공백(탭·줄바꿈 포함) → 공백 1칸 */
export function normalizeVehiclePlate(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** 정규화 후 길이·패턴 검사. 빈 문자열은 false */
export function isVehiclePlate(value: string): boolean {
  const normalized = normalizeVehiclePlate(value);
  if (normalized.length === 0 || normalized.length > QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH) {
    return false;
  }
  return QUICK_REQUEST_VEHICLE_PLATE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * 공용 zod 스키마 — 출력은 정규화된 문자열. 문구 2종: 비어 있음 → required · 그 밖(길이 초과·형식) → invalid.
 * 폼 입력(`quickRequestVehicleInfoInputSchema`)과 서버 본문(`quickRequestDispatchBodySchema`·`quickRequestPatchBodySchema`)이 같이 쓴다.
 */
export const quickRequestVehiclePlateSchema = z
  .string({ error: QUICK_REQUEST_VEHICLE_PLATE_REQUIRED_MESSAGE })
  .transform(normalizeVehiclePlate)
  .pipe(
    z
      .string()
      .min(1, QUICK_REQUEST_VEHICLE_PLATE_REQUIRED_MESSAGE)
      .max(QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH, QUICK_REQUEST_VEHICLE_PLATE_INVALID_MESSAGE)
      .refine(isVehiclePlate, QUICK_REQUEST_VEHICLE_PLATE_INVALID_MESSAGE)
  );
