import type {
  QuickRequestNotifyBody,
  QuickRequestVehicleType
} from '../schemas/quick-request-notify';

export type { QuickRequestFormValues } from '../schemas/quick-request-form';

export type QuickRequestLocation = {
  roadAddress: string;
  detailAddress: string;
  contactName: string;
  contactPhone: string;
};

export type QuickRequestNotifyPayload = QuickRequestNotifyBody;

export type QuickRequestNotifyResponse = {
  success: boolean;
  message: string;
  redirectUrl?: string;
};

export type { QuickRequestVehicleType };

export type { QuickRequestGoodsSize } from '../schemas/quick-request-notify';

// ---------------------------------------------------------------------------
// plan 87 — 특이사항 칩 (GET/POST /api/quick-request/notes · PATCH/DELETE /notes/[id])
// ---------------------------------------------------------------------------

export type QuickRequestNote = {
  id: number;
  label: string;
};

export type QuickRequestNoteMutationPayload = {
  label: string;
};

/** 실패 응답 공통 형태 (`message`는 사용자에게 그대로 표시) */
export type QuickRequestApiError = {
  success: false;
  message: string;
};

export type QuickRequestNotesListResponse = {
  success: true;
  data: { notes: QuickRequestNote[] };
};

/** POST 201 */
export type QuickRequestNoteCreateResponse = {
  success: true;
  data: { note: QuickRequestNote };
};

/** PATCH 200 — `previousLabel`로 폼 선택값을 치환한다 */
export type QuickRequestNoteUpdateResponse = {
  success: true;
  data: { note: QuickRequestNote; previousLabel: string };
};

/** DELETE 200 — `label`로 폼 선택값을 제거한다 */
export type QuickRequestNoteDeleteResponse = {
  success: true;
  data: { id: number; label: string };
};

// ---------------------------------------------------------------------------
// plan 87 — 최근 주소 (GET/POST /api/quick-request/recent-addresses)
// ---------------------------------------------------------------------------

/** `contactPhone`은 숫자만(11자리). 표시는 `formatPhoneDisplay` */
export type QuickRequestRecentAddress = QuickRequestLocation & {
  lastUsedAt: string;
};

export type QuickRequestRecentAddressesListResponse = {
  success: true;
  data: { addresses: QuickRequestRecentAddress[] };
};

/** 출발 → 경유 → 도착 순서. 앞쪽 항목이 더 최근으로 정렬된다 */
export type QuickRequestRecentAddressesRecordPayload = {
  locations: QuickRequestLocation[];
};

export type QuickRequestRecentAddressesRecordResponse = {
  success: true;
  data: { count: number };
};
