import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveChatRecipients } from '../resolve-chat-recipients.ts';

/**
 * plan 93 r3 §알림 수신 규칙 — 실행: `node --test src/features/quick-request/lib/__tests__/`
 * (Node 24 내장 러너 + 타입 스트리핑 · vitest 등 별도 러너 없음. `.mjs`인 이유: tsc `allowImportingTsExtensions` 없이 `.ts`를 import하기 위해)
 */

const R = 'requester';
const A = 'dongbang-a';
const B = 'dongbang-b';
const C = 'dongbang-c';
const X = 'admin-x';
const Y = 'admin-y';

describe('resolveChatRecipients', () => {
  it('요청자 발신 → active 동방 전원 (+ 참여한 admin) · 본인 제외', () => {
    assert.deepEqual(
      resolveChatRecipients({
        requesterId: R,
        activeDongbangIds: [A, B, C],
        adminParticipantIds: [],
        senderId: R,
        inactiveIds: []
      }),
      [A, B, C]
    );
  });

  it('동방 A 발신 → 요청자 + 다른 동방 전원 (+ 참여한 admin)', () => {
    assert.deepEqual(
      resolveChatRecipients({
        requesterId: R,
        activeDongbangIds: [A, B, C],
        adminParticipantIds: [X],
        senderId: A,
        inactiveIds: []
      }),
      [R, B, C, X]
    );
  });

  it('admin 발신 → 요청자 + 동방 전원 + (보낸 admin 외) 참여한 다른 admin · 중복 제거', () => {
    assert.deepEqual(
      resolveChatRecipients({
        requesterId: R,
        activeDongbangIds: [A, B],
        adminParticipantIds: [X, Y, X],
        senderId: X,
        inactiveIds: []
      }),
      [R, A, B, Y]
    );
  });

  it('비활성 사용자 제외 (동방 B inactive · admin Y inactive) · 요청자가 비활성이면 요청자도 제외', () => {
    assert.deepEqual(
      resolveChatRecipients({
        requesterId: R,
        activeDongbangIds: [A, C],
        adminParticipantIds: [X, Y],
        senderId: R,
        inactiveIds: [B, Y]
      }),
      [A, C, X]
    );
    assert.deepEqual(
      resolveChatRecipients({
        requesterId: R,
        activeDongbangIds: [A],
        adminParticipantIds: [],
        senderId: A,
        inactiveIds: [R]
      }),
      []
    );
  });

  // plan 101 AC-05 — 초대 참여자 `participantIds` 4케이스
  describe('participantIds (plan 101)', () => {
    const P = 'participant-p';
    const Q = 'participant-q';

    it('요청자 발신 → 동방 전원 + admin 참여자 + 초대 참여자 전원', () => {
      assert.deepEqual(
        resolveChatRecipients({
          requesterId: R,
          activeDongbangIds: [A],
          adminParticipantIds: [X],
          participantIds: [P, Q],
          senderId: R,
          inactiveIds: []
        }),
        [A, X, P, Q]
      );
    });

    it('참여자 발신 → 요청자 + 동방 전원 + admin 참여자 + 다른 참여자 · 본인 제외', () => {
      assert.deepEqual(
        resolveChatRecipients({
          requesterId: R,
          activeDongbangIds: [A, B],
          adminParticipantIds: [],
          participantIds: [P, Q],
          senderId: P,
          inactiveIds: []
        }),
        [R, A, B, Q]
      );
    });

    it('비활성 참여자 제외 · 요청자와 같은 id가 participantIds에 있어도 중복 제거', () => {
      assert.deepEqual(
        resolveChatRecipients({
          requesterId: R,
          activeDongbangIds: [A],
          adminParticipantIds: [X],
          participantIds: [P, Q, R],
          senderId: A,
          inactiveIds: [Q]
        }),
        [R, X, P]
      );
    });

    it('participantIds 생략 또는 빈 배열이면 93 규칙과 결과가 같다 (제외된 참여자는 호출부가 넣지 않는다)', () => {
      const legacy = resolveChatRecipients({
        requesterId: R,
        activeDongbangIds: [A, B],
        adminParticipantIds: [X],
        senderId: R,
        inactiveIds: []
      });
      assert.deepEqual(legacy, [A, B, X]);
      assert.deepEqual(
        resolveChatRecipients({
          requesterId: R,
          activeDongbangIds: [A, B],
          adminParticipantIds: [X],
          participantIds: [],
          senderId: R,
          inactiveIds: []
        }),
        legacy
      );
    });
  });

  it('admin이 글을 쓰기 전에는 수신하지 않는다 (참여자 아님) · 접수 여부·상태 입력 자체가 없다', () => {
    assert.deepEqual(
      resolveChatRecipients({
        requesterId: R,
        activeDongbangIds: [A],
        adminParticipantIds: [],
        senderId: R,
        inactiveIds: []
      }),
      [A]
    );
  });
});
