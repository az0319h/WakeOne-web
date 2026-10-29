import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasTeam, matchesAssetScope } from '../scope.ts';

/** plan 103 D-7 · AC-10·11 — 「내 것 / 내 팀」 판정 */

const A = { user_id: 'a', affiliation: 'wake', rank: '디자인팀' };
const TEAMMATES = new Set(['a', 'b']);
const user = (id) => ({ assignee_type: 'user', user_id: id, affiliation: null, rank: null });
const team = (affiliation, rank) => ({ assignee_type: 'team', user_id: null, affiliation, rank });
const all = (affiliation) => ({ assignee_type: 'affiliation', user_id: null, affiliation, rank: null });

const S1 = [user('a')];
const S2 = [team('wake', '디자인팀')];
const S3 = [all('wake')];
const S4 = [user('b')];
const S5 = [team('wake', '마케팅팀')];
const SUBS = { S1, S2, S3, S4, S5 };

function pick(scope, viewer = A) {
  return Object.entries(SUBS)
    .filter(([, assignees]) => matchesAssetScope(assignees, scope, viewer, TEAMMATES))
    .map(([key]) => key);
}

describe('matchesAssetScope (AC-10 구독)', () => {
  it('mine = S1·S2·S3', () => assert.deepEqual(pick('mine'), ['S1', 'S2', 'S3']));
  it('team = S2·S4 (본인 개인·소속 전체 제외)', () => assert.deepEqual(pick('team'), ['S2', 'S4']));
  it('all = 전부', () => assert.deepEqual(pick('all'), ['S1', 'S2', 'S3', 'S4', 'S5']));
});

describe('matchesAssetScope (AC-11 비품 · 한 대에 하나)', () => {
  const E = { E1: [user('a')], E2: [team('wake', '디자인팀')], E3: [user('b')], E4: [team('wake', '마케팅팀')], E5: [] };
  const pickE = (scope) =>
    Object.entries(E)
      .filter(([, assignees]) => matchesAssetScope(assignees, scope, A, TEAMMATES, { personalOnly: true }))
      .map(([key]) => key);
  it('mine = E1', () => assert.deepEqual(pickE('mine'), ['E1']));
  it('team = E2·E3', () => assert.deepEqual(pickE('team'), ['E2', 'E3']));
});

describe('부서 없음 (관리자 등)', () => {
  const admin = { user_id: 'x', affiliation: null, rank: null };
  it('hasTeam false · team 빈 목록', () => {
    assert.equal(hasTeam(admin), false);
    assert.deepEqual(pick('team', admin), []);
  });
  it('mine은 본인 개인만', () => {
    assert.deepEqual(pick('mine', admin), []);
    assert.equal(matchesAssetScope([user('x')], 'mine', admin, new Set()), true);
  });
});
