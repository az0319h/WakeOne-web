/**
 * plan 100 D-4 — 퀵 대화를 외부 AI(Anthropic)에 보내기 전 개인정보 가림 (순수 함수 · 단위 테스트 대상).
 * - 전화 → `[연락처]` · 이메일 → `[이메일]` · 주소(시·도/도로명/동·호) → `[주소]`
 * - 보낸 사람 이름은 보내지 않는다(역할 라벨만). 본문 속 참여자 이름은 정확 일치만 `[이름]`
 * - 첨부만 있는 메시지 → `(파일 첨부)` · 마스킹 **후** 300자 클립(번호가 반만 잘려 남지 않게)
 * - 최근 10개 · 오래된 순
 * 이 파일은 path alias(`@/…`)·런타임 상대 import를 쓰지 않는다 — `node --test`에서 직접 불러 쓰기 위함.
 */

export type AiChatAuthorRole = 'requester' | 'dongbang' | 'admin' | 'participant';

/** 모델에 보내는 역할 라벨 (QUICK_CHAT_ROLE_LABELS와 같은 문구 — 상수 import 대신 복제: node --test 직접 실행용) */
export const AI_CHAT_ROLE_LABELS: Record<AiChatAuthorRole, string> = {
  requester: '요청자',
  dongbang: '동방특송',
  admin: '관리자',
  participant: '참여자'
};

export const AI_MASK_TOKENS = {
  phone: '[연락처]',
  email: '[이메일]',
  address: '[주소]',
  name: '[이름]',
  attachmentOnly: '(파일 첨부)'
} as const;

export const AI_MASK_DEFAULT_LIMIT = 10;
export const AI_MASK_DEFAULT_CLIP = 300;

/** 이름·주소 정확 일치 치환 최소 길이 (한 글자 이름이 일반 단어를 덮지 않게) */
const MIN_NAME_LENGTH = 2;
const MIN_ADDRESS_LENGTH = 4;

// ---------------------------------------------------------------------------
// 패턴
// ---------------------------------------------------------------------------

/** 휴대폰·지역번호 (`010-1234-5678` · `01012345678` · `02 123 4567` · `+82 10-1234-5678`). 앞뒤가 숫자면 제외(요청번호·날짜 보호) */
const PHONE_PATTERN = /(?<!\d)(?:\+82[-.\s]?|0)\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const SIDO =
  '서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청북|충청남|충북|충남|전라북|전라남|전북|전남|경상북|경상남|경북|경남|제주';
const SIDO_SUFFIX = '(?:특별자치시|특별자치도|특별시|광역시|도|시)?';
/** 도로명·동 토큰 (`테헤란로` · `수표로28길` · `익선동` · `판교역로`) */
const ROAD_TOKEN = '[가-힣A-Za-z0-9]+(?:대로|로|길|동|읍|면|리|가)';
/** 번호 뒤가 숫자·단위(시·분·개·명·층·원·대·건·번 …)면 주소 번호가 아니다 (「3시까지」「2층」) */
const NOT_UNIT = '(?!\\d)(?!\\s?(?:시|분|초|개|명|층|원|대|건|번|일|월|년|주|박스|kg|km|톤|%))';
/** 건물번호·지번 (`1` · `30` · `40-1` · `28번길`) */
const NUMBER_TOKEN = `\\d+(?:-\\d+)?(?:\\s?번길)?${NOT_UNIT}`;
/** 건물번호 뒤 추가 번호 (`판교로 1 2` 형태 · 단위 제외) */
const EXTRA_NUMBER = `(?:\\s+\\d+(?:-\\d+)?${NOT_UNIT})?`;

/** ① 시·도로 시작하는 주소: `서울 강남구 테헤란로 1` · `경기도 성남시 분당구 판교역로 166` · `서울특별시 종로구 익선동 40` */
const SIDO_ADDRESS_PATTERN = new RegExp(
  `(?:${SIDO})${SIDO_SUFFIX}\\s+[가-힣]+(?:시|군|구)(?:\\s+[가-힣]+구)?(?:\\s+${ROAD_TOKEN})*(?:\\s*${NUMBER_TOKEN})?${EXTRA_NUMBER}`,
  'g'
);

/** ② 시·도 이름 없이 `○○시|도 ○○구|군|시 ○○로|동 …` (plan D-4 패턴 · 세 번째 토큰을 도로명/동으로 좁혀 「혹시 다시」 같은 오탐 방지) */
const CITY_ADDRESS_PATTERN = new RegExp(
  `[가-힣]{2,}(?:시|도)\\s+[가-힣]+(?:구|군|시)(?:\\s+[가-힣]+구)?(?:\\s+${ROAD_TOKEN})+(?:\\s*${NUMBER_TOKEN})?${EXTRA_NUMBER}`,
  'g'
);

/**
 * ③ 도로명 + 번호만: `테헤란로 1` · `수표로28길 30` · `판교역로 166에서`.
 * 「회사로 3시」「1층으로 2개」 같은 문장은 제외: `으로`로 끝나는 단어 · 번호 뒤 단위(시·분·개·명·층·원·대·건·번 …)
 */
const ROAD_NUMBER_PATTERN = new RegExp(
  `(?<![가-힣A-Za-z0-9])[가-힣A-Za-z0-9]*[가-힣](?:대로|(?<!으)로|길)(?:\\d+번?길)?\\s?\\d+(?:-\\d+)?${NOT_UNIT}(?:\\s\\d+(?:-\\d+)?${NOT_UNIT})?`,
  'g'
);

/** ④ 공동주택 동·호: `101동 202호` */
const UNIT_PATTERN = /\d+\s?동\s?\d+\s?호/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueByLengthDesc(values: readonly (string | null | undefined)[], minLength: number): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && Array.from(trimmed).length >= minLength) {
      set.add(trimmed);
    }
  }
  return [...set].sort((a, b) => b.length - a.length);
}

function replaceExact(text: string, needles: readonly string[], token: string): string {
  let result = text;
  for (const needle of needles) {
    if (!result.includes(needle)) continue;
    result = result.replace(new RegExp(escapeRegExp(needle), 'g'), token);
  }
  return result;
}

/** 코드 포인트 기준 자르기 (한글·이모지 안전) · 잘리면 끝이 `…`(합계 ≤ maxLength) */
export function clipText(text: string, maxLength: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  return `${chars.slice(0, Math.max(0, maxLength - 1)).join('').trimEnd()}…`;
}

export type AiMaskDictionary = {
  /** 그 건의 알려진 이름(요청자·동방·참여자·작성자 스냅샷·기사·담당자). 정확 일치만 `[이름]` */
  names?: readonly (string | null | undefined)[];
  /** 그 건의 알려진 주소 문자열(출발·도착·경유 도로명·상세). 정확 일치 → `[주소]` */
  addresses?: readonly (string | null | undefined)[];
};

/**
 * 본문 1개 마스킹. 순서: 알려진 주소(정확 일치) → 이메일 → 전화 → 주소 패턴 → 동·호 → 알려진 이름(정확 일치).
 * 이메일을 전화보다 먼저 지워 `0101234567@x.com` 같은 문자열이 반쯤 남지 않게 한다.
 */
export function maskSensitiveText(text: string, dictionary: AiMaskDictionary = {}): string {
  let result = text;
  result = replaceExact(result, uniqueByLengthDesc(dictionary.addresses ?? [], MIN_ADDRESS_LENGTH), AI_MASK_TOKENS.address);
  result = result.replace(EMAIL_PATTERN, AI_MASK_TOKENS.email);
  result = result.replace(PHONE_PATTERN, AI_MASK_TOKENS.phone);
  result = result.replace(SIDO_ADDRESS_PATTERN, AI_MASK_TOKENS.address);
  result = result.replace(CITY_ADDRESS_PATTERN, AI_MASK_TOKENS.address);
  result = result.replace(ROAD_NUMBER_PATTERN, AI_MASK_TOKENS.address);
  result = result.replace(UNIT_PATTERN, AI_MASK_TOKENS.address);
  result = replaceExact(result, uniqueByLengthDesc(dictionary.names ?? [], MIN_NAME_LENGTH), AI_MASK_TOKENS.name);
  return result;
}

export type AiMaskInputMessage = {
  authorRole: AiChatAuthorRole;
  /** 답장을 받을 사람(보는 사람) 본인이 보낸 메시지인지 */
  isMine: boolean;
  body: string;
  attachmentCount: number;
};

/** 모델에 그대로 JSON으로 보내는 형태 (이름·id·시각 없음) */
export type AiMaskedMessage = {
  from: string;
  me: boolean;
  text: string;
};

/**
 * 최근 `limit`개(기본 10 · 오래된 순)를 역할 라벨 + 마스킹 본문으로 바꾼다.
 * 입력 `messages`는 오래된 순(오름차순)이어야 한다.
 */
export function maskChatForAi(input: {
  messages: readonly AiMaskInputMessage[];
  dictionary?: AiMaskDictionary;
  limit?: number;
  clip?: number;
}): AiMaskedMessage[] {
  const limit = Math.max(1, input.limit ?? AI_MASK_DEFAULT_LIMIT);
  const clip = Math.max(1, input.clip ?? AI_MASK_DEFAULT_CLIP);
  const recent = input.messages.slice(-limit);

  return recent.map((message) => {
    const masked = maskSensitiveText(message.body.trim(), input.dictionary);
    const clipped = masked ? clipText(masked, clip) : '';
    const hasAttachment = message.attachmentCount > 0;
    let text = clipped;
    if (hasAttachment) {
      text = clipped ? `${clipped} ${AI_MASK_TOKENS.attachmentOnly}` : AI_MASK_TOKENS.attachmentOnly;
    }
    return {
      from: AI_CHAT_ROLE_LABELS[message.authorRole] ?? AI_CHAT_ROLE_LABELS.participant,
      me: message.isMine,
      text
    };
  });
}
