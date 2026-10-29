import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AI_MASK_TOKENS, clipText, maskChatForAi, maskSensitiveText } from '../ai-mask.ts';

/**
 * plan 100 AC-13 — 실행: `node --test src/features/quick-request/lib/__tests__/ai-mask.test.mjs`
 */

const { phone, email, address, name, attachmentOnly } = AI_MASK_TOKENS;

describe('maskSensitiveText — 전화', () => {
  it('하이픈·붙여쓰기·공백·지역번호·+82를 모두 가린다', () => {
    assert.equal(maskSensitiveText('010-1234-5678로 연락 주세요'), `${phone}로 연락 주세요`);
    assert.equal(maskSensitiveText('01012345678'), phone);
    assert.equal(maskSensitiveText('사무실 02 123 4567'), `사무실 ${phone}`);
    assert.equal(maskSensitiveText('031-123-4567, 010.9876.5432'), `${phone}, ${phone}`);
    assert.equal(maskSensitiveText('+82 10-1234-5678'), phone);
  });

  it('요청번호·날짜·시각·금액은 건드리지 않는다', () => {
    const text = '2026-15 건 2026-10-28 14:30 도착 · 35,000원';
    assert.equal(maskSensitiveText(text), text);
  });
});

describe('maskSensitiveText — 이메일', () => {
  it('이메일을 가린다', () => {
    assert.equal(maskSensitiveText('kim.dong@wakecorp.com 으로 보내 주세요'), `${email} 으로 보내 주세요`);
  });
});

describe('maskSensitiveText — 주소', () => {
  it('시·도로 시작하는 도로명 주소 (AC-05 예시)', () => {
    assert.equal(maskSensitiveText('서울 강남구 테헤란로 1'), address);
    assert.equal(maskSensitiveText('서울 강남구 테헤란로 1 으로 와 주세요'), `${address} 으로 와 주세요`);
  });

  it('특별시·도·구 2단계·길 번호', () => {
    assert.equal(maskSensitiveText('서울특별시 종로구 수표로28길 30'), address);
    assert.equal(maskSensitiveText('경기도 성남시 분당구 판교역로 166에서 출발'), `${address}에서 출발`);
    assert.equal(maskSensitiveText('서울 종로구 익선동 40'), address);
  });

  it('주소 뒤 층·시각 숫자는 남긴다', () => {
    assert.equal(maskSensitiveText('서울 강남구 테헤란로 1 2층'), `${address} 2층`);
    assert.equal(maskSensitiveText('서울 강남구 테헤란로 3시까지'), `${address} 3시까지`);
  });

  it('시·도 이름 없이 ○○시 ○○구 ○○로 …', () => {
    assert.equal(maskSensitiveText('수원시 팔달구 매산로 1 앞'), `${address} 앞`);
  });

  it('도로명 + 번호만', () => {
    assert.equal(maskSensitiveText('테헤란로 1 정문'), `${address} 정문`);
    assert.equal(maskSensitiveText('수표로28길 30 2층'), `${address} 2층`);
  });

  it('공동주택 동·호', () => {
    assert.equal(maskSensitiveText('101동 202호 앞에 두세요'), `${address} 앞에 두세요`);
  });

  it('일상 문장(으로·시각·수량)은 주소로 보지 않는다', () => {
    for (const text of ['회사로 3시까지 와 주세요', '1층으로 2개 옮겨 주세요', '혹시 다시 연락 가능할까요?', '바로 1번 출구 앞입니다']) {
      assert.equal(maskSensitiveText(text), text, text);
    }
  });

  it('그 건의 알려진 주소 문자열은 정확 일치로 가린다', () => {
    const masked = maskSensitiveText('산스 카페 2층 회의실로 가져다 주세요', {
      addresses: ['산스 카페 2층 회의실', null, '']
    });
    assert.equal(masked, `${address}로 가져다 주세요`);
  });
});

describe('maskSensitiveText — 이름', () => {
  it('참여자 이름 정확 일치만 [이름] (긴 이름 먼저 · 한 글자 무시)', () => {
    const masked = maskSensitiveText('김동방님, 박요청 대리가 확인했어요. 김 과장님도요', {
      names: ['김동방', '박요청', '김', null]
    });
    assert.equal(masked, `${name}님, ${name} 대리가 확인했어요. 김 과장님도요`);
  });

  it('정규식 특수문자가 있는 이름도 안전하게 치환', () => {
    assert.equal(maskSensitiveText('a.b+c 님', { names: ['a.b+c'] }), `${name} 님`);
  });
});

describe('maskChatForAi', () => {
  const msg = (overrides = {}) => ({
    authorRole: 'dongbang',
    isMine: false,
    body: '확인했습니다',
    attachmentCount: 0,
    ...overrides
  });

  it('최근 10개 · 오래된 순 · 역할 라벨만(이름 없음)', () => {
    const messages = Array.from({ length: 13 }, (_, index) =>
      msg({ body: `메시지 ${index + 1}`, authorRole: index % 2 ? 'requester' : 'dongbang', isMine: index % 2 === 1 })
    );
    const masked = maskChatForAi({ messages });
    assert.equal(masked.length, 10);
    assert.equal(masked[0].text, '메시지 4');
    assert.equal(masked[9].text, '메시지 13');
    assert.deepEqual(Object.keys(masked[0]).sort(), ['from', 'me', 'text']);
    assert.equal(masked[0].from, '요청자');
    assert.equal(masked[0].me, true);
    assert.equal(masked[1].from, '동방특송');
  });

  it('첨부만 → (파일 첨부) · 본문+첨부 → 본문 뒤에 표시', () => {
    const masked = maskChatForAi({
      messages: [msg({ body: '', attachmentCount: 2 }), msg({ body: '사진 보냅니다', attachmentCount: 1 })]
    });
    assert.equal(masked[0].text, attachmentOnly);
    assert.equal(masked[1].text, `사진 보냅니다 ${attachmentOnly}`);
  });

  it('마스킹 후 300자 클립 (번호가 반만 남지 않는다)', () => {
    const body = `${'가'.repeat(295)} 010-1234-5678 끝`;
    const [masked] = maskChatForAi({ messages: [msg({ body })] });
    assert.ok(Array.from(masked.text).length <= 300);
    assert.ok(!/\d{3,}/.test(masked.text), masked.text);
  });

  it('AC-05 — 원문 전화·주소·이름이 결과 JSON에 0', () => {
    const masked = maskChatForAi({
      messages: [
        msg({ body: '김동방입니다. 010-1234-5678 / 서울 강남구 테헤란로 1 맞나요?', authorRole: 'dongbang' }),
        msg({ body: '네 맞아요 박요청', authorRole: 'requester', isMine: true })
      ],
      dictionary: { names: ['김동방', '박요청'] }
    });
    const json = JSON.stringify(masked);
    for (const needle of ['010-1234-5678', '1234', '테헤란로', '강남구', '김동방', '박요청']) {
      assert.ok(!json.includes(needle), `${needle} leaked: ${json}`);
    }
    assert.ok(json.includes(phone));
    assert.ok(json.includes(address));
    assert.ok(json.includes(name));
  });
});

describe('clipText', () => {
  it('코드 포인트 기준 · 잘리면 … 포함 합계 ≤ max', () => {
    assert.equal(clipText('가나다', 5), '가나다');
    assert.equal(clipText('가나다라마바', 4), '가나다…');
  });
});
