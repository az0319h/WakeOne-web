import { expect, test } from '@playwright/test';
import {
  buildCreateBody,
  callManyAs,
  createQuickRequestApi,
  dbQuickRequest,
  expectLogFor,
  REQUEST_NO_RE,
  serviceClient,
  uniqueTag,
  withApi
} from './helpers';

// plan 89 §B 등록·번호 (API) — docs/plans/89 · plan 92가 webhook 판정(옛 AC-11 본문·AC-12)을 제거했다
test.describe('plan 89 B. 퀵 요청 등록 API · 번호', () => {
  test.describe.configure({ timeout: 120_000 });

  test('AC-10: 동시 5건 → 번호 5개 모두 다름 · 연속 · 형식 · format 함수 9→09 · 10→10 · 100→100', async () => {
    const results = await callManyAs('user', async (api) =>
      Promise.all(
        Array.from({ length: 5 }, () =>
          api.post('/api/quick-request', { data: buildCreateBody(uniqueTag()) })
        )
      )
    );
    const numbers: string[] = [];
    for (const response of results) {
      expect(response.status).toBe(201);
      numbers.push((response.body.data as { requestNo: string }).requestNo);
    }
    expect(new Set(numbers).size).toBe(5);
    for (const no of numbers) expect(no).toMatch(REQUEST_NO_RE);

    const years = new Set(numbers.map((no) => no.split('-')[0]));
    expect(years.size).toBe(1);
    const seqs = numbers.map((no) => Number(no.split('-')[1])).sort((a, b) => a - b);
    for (let i = 1; i < seqs.length; i += 1) expect(seqs[i]).toBe(seqs[0] + i);
    for (const no of numbers) {
      const seq = Number(no.split('-')[1]);
      expect(no.split('-')[1]).toBe(seq < 10 ? `0${seq}` : String(seq));
    }

    const format = async (seq: number) => {
      const { data, error } = await serviceClient().rpc('format_quick_request_no', {
        p_year: 2026,
        p_seq: seq
      });
      if (error) throw new Error(error.message);
      return data as string;
    };
    expect(await format(1)).toBe('2026-01');
    expect(await format(9)).toBe('2026-09');
    expect(await format(10)).toBe('2026-10');
    expect(await format(99)).toBe('2026-99');
    expect(await format(100)).toBe('2026-100');
  });

  test('AC-11 (92 AC-04): 등록 201 data = {requestNo, id}만 · 클라이언트 requesterName·requestedAtIso 무시 · create 로그', async () => {
    const created = await withApi('user', (api) => createQuickRequestApi(api, buildCreateBody()));
    const no = created.requestNo;
    expect(Object.keys(created).sort()).toEqual(['id', 'requestNo']);

    const row = await dbQuickRequest(no);
    expect(row.id).toBe(created.id);
    expect(new Date(row.requested_at).getFullYear()).toBeGreaterThan(2000);
    const log = await expectLogFor('quick_request.create', no, 201);
    expect(log.metadata).toMatchObject({ recentAddressesRecorded: true });
  });
});
