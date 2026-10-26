import { expect, test } from '@playwright/test';
import { openchatRequestsFor, setOpenchatMockMode } from '../helpers/openchat-mock';
import {
  APP_URL,
  buildCreateBody,
  callManyAs,
  CONTACT_PHONE_DEST,
  CONTACT_PHONE_ORIGIN,
  createQuickRequestApi,
  dbDispatch,
  dbQuickRequest,
  expectLogFor,
  fixtureUser,
  REQUEST_NO_RE,
  serviceClient,
  uniqueTag,
  withApi
} from './helpers';

// plan 89 §B 등록·번호·발송 (API · mock webhook) — docs/plans/89_quick-workflow-dongbang-openchat-plan.md
test.describe('plan 89 B. 퀵 요청 등록 API · 번호 · webhook', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    await setOpenchatMockMode('ok');
  });

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

  test('AC-11: webhook 1건 · Bearer · X-WakeOne-Event · Idempotency-Key · body · text · link · 담당 연락처 미포함 · sent', async () => {
    const created = await withApi('user', (api) => createQuickRequestApi(api, buildCreateBody()));
    expect(created.openchat.status).toBe('sent');
    const no = created.requestNo;

    const received = await openchatRequestsFor(no);
    expect(received).toHaveLength(1);
    const [entry] = received;
    expect(entry.headers.authorization).toBe('Bearer e2e-openchat-secret');
    expect(entry.headers['x-wakeone-event']).toBe('quick_request.created');
    expect(entry.headers['idempotency-key']).toBe(`${created.id}:created`);
    expect(entry.headers['content-type']).toContain('application/json');

    const body = entry.body;
    for (const key of ['event', 'requestNo', 'status', 'text', 'link', 'occurredAt']) {
      expect(body, `body.${key}`).toHaveProperty(key);
    }
    expect(body.event).toBe('quick_request.created');
    expect(body.requestNo).toBe(no);
    expect(body.status).toBe('requested');
    const lines = String(body.text).split('\n');
    expect(lines[0]).toBe(`❗ 퀵요청 - ${no}`);
    expect(lines[1]).toBe('🚚서울 강남구→서울 용산구');
    expect(lines[2]).toBe('출발일시: 즉시 요청');
    expect(body.text).toContain('동방특송 담당자님 상세 내역을 확인하시고 접수 및 배차를 진행해주세요.');
    const user = await fixtureUser('user');
    expect(body.text).toContain(`"${user.fullName}"님이 퀵 요청을 하였습니다.`);
    expect(body.link).toBe(`${APP_URL}/dashboard/quick/${no}`);
    expect(body.text).toContain(`상세 확인: ${APP_URL}/dashboard/quick/${no}`);
    expect(body.requesterName).toBe(user.fullName);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(CONTACT_PHONE_ORIGIN);
    expect(serialized).not.toContain(CONTACT_PHONE_DEST);
    expect(serialized).not.toContain('E2E 출발담당');
    expect(serialized).not.toContain('무시되는 이름');

    const record = await dbDispatch(no, 'created');
    expect(record?.status).toBe('sent');
    expect(record?.attempt_count).toBe(1);

    // 클라이언트 requesterName·requestedAtIso 무시
    const row = await dbQuickRequest(no);
    expect(new Date(row.requested_at).getFullYear()).toBeGreaterThan(2000);
    const log = await expectLogFor('quick_request.create', no, 201);
    expect(log.metadata).toMatchObject({ recentAddressesRecorded: true });
  });

  test('AC-12: mock 500 → 201 · 수신 2회 · failed · attempt_count=2 · 응답 openchat.status=failed', async () => {
    await setOpenchatMockMode('status:500');
    const created = await withApi('user', (api) => createQuickRequestApi(api, buildCreateBody()));
    expect(created.openchat.status).toBe('failed');
    const received = await openchatRequestsFor(created.requestNo, 'created');
    expect(received).toHaveLength(2);
    const record = await dbDispatch(created.requestNo, 'created');
    expect(record?.status).toBe('failed');
    expect(record?.attempt_count).toBe(2);
    expect(record?.http_status).toBe(500);
  });

  test('AC-12 (D-2): mock 400 → 재시도 없음(1회) · failed', async () => {
    await setOpenchatMockMode('status:400');
    const created = await withApi('user', (api) => createQuickRequestApi(api, buildCreateBody()));
    expect(created.openchat.status).toBe('failed');
    expect(await openchatRequestsFor(created.requestNo, 'created')).toHaveLength(1);
    const record = await dbDispatch(created.requestNo, 'created');
    expect(record?.status).toBe('failed');
    expect(record?.attempt_count).toBe(1);
    expect(record?.http_status).toBe(400);
  });

  test('AC-12 (D-2): mock timeout → 4초 timeout × 2회 · failed · 등록 201', async () => {
    await setOpenchatMockMode('timeout');
    const started = Date.now();
    const created = await withApi('user', (api) =>
      createQuickRequestApi(api, buildCreateBody())
    );
    const elapsed = Date.now() - started;
    expect(created.openchat.status).toBe('failed');
    expect(elapsed).toBeGreaterThanOrEqual(7_500);
    expect(elapsed).toBeLessThan(20_000);
    expect(await openchatRequestsFor(created.requestNo, 'created')).toHaveLength(2);
    const record = await dbDispatch(created.requestNo, 'created');
    expect(record?.status).toBe('failed');
    expect(record?.attempt_count).toBe(2);
    expect(record?.error_message).toContain('timeout');
  });
});
