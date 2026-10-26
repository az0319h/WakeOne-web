import http from 'node:http';

/**
 * plan 89 — 오픈채팅 외부 봇 webhook mock (127.0.0.1:4599).
 * - `POST /openchat`: 받은 요청(헤더·본문)을 기록하고 현재 모드대로 응답한다
 * - 제어: `GET /__mock/requests` · `DELETE /__mock/requests` · `POST /__mock/mode {mode}`
 * - 모드: `ok`(200) · `status:<code>`(예: 400·500) · `timeout`(6초 뒤 응답 → 앱의 4초 timeout 유발)
 * globalSetup이 띄우고(quick 계열 run), spec은 HTTP 제어 엔드포인트로만 다룬다(워커 프로세스 분리).
 */

export const OPENCHAT_MOCK_PORT = Number(process.env.E2E_OPENCHAT_MOCK_PORT ?? 4599);
export const OPENCHAT_MOCK_ORIGIN = `http://127.0.0.1:${OPENCHAT_MOCK_PORT}`;
export const OPENCHAT_MOCK_WEBHOOK_URL = `${OPENCHAT_MOCK_ORIGIN}/openchat`;
export const OPENCHAT_MOCK_SECRET = 'e2e-openchat-secret';

export type OpenchatMockMode = 'ok' | 'timeout' | `status:${number}`;

export type OpenchatMockRequest = {
  receivedAt: string;
  headers: Record<string, string>;
  body: {
    event?: string;
    requestNo?: string;
    status?: string;
    text?: string;
    link?: string;
    occurredAt?: string;
    requesterName?: string;
    route?: unknown;
    dispatch?: unknown;
  } & Record<string, unknown>;
  respondedStatus: number | null;
};

const TIMEOUT_HOLD_MS = 6_000;

export function startOpenchatMockServer(): Promise<http.Server | null> {
  let mode: OpenchatMockMode = 'ok';
  const received: OpenchatMockRequest[] = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const url = req.url ?? '/';
      const sendJson = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (url.startsWith('/__mock/requests')) {
        if (req.method === 'DELETE') {
          received.length = 0;
          sendJson(200, { ok: true });
          return;
        }
        sendJson(200, { mode, requests: received });
        return;
      }

      if (url.startsWith('/__mock/mode') && req.method === 'POST') {
        try {
          const next = (JSON.parse(raw) as { mode?: OpenchatMockMode }).mode;
          if (next) mode = next;
          sendJson(200, { mode });
        } catch {
          sendJson(400, { error: 'invalid json' });
        }
        return;
      }

      if (url.startsWith('/openchat') && req.method === 'POST') {
        let body: OpenchatMockRequest['body'] = {};
        try {
          body = JSON.parse(raw) as OpenchatMockRequest['body'];
        } catch {
          body = { raw } as OpenchatMockRequest['body'];
        }
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
        }
        const entry: OpenchatMockRequest = {
          receivedAt: new Date().toISOString(),
          headers,
          body,
          respondedStatus: null
        };
        received.push(entry);

        if (mode === 'timeout') {
          const timer = setTimeout(() => {
            entry.respondedStatus = 200;
            if (!res.writableEnded) sendJson(200, { ok: true, late: true });
          }, TIMEOUT_HOLD_MS);
          res.on('close', () => clearTimeout(timer));
          return;
        }
        const status = mode === 'ok' ? 200 : Number(mode.slice('status:'.length)) || 500;
        entry.respondedStatus = status;
        sendJson(status, { ok: status < 300 });
        return;
      }

      sendJson(404, { error: 'not found' });
    });
  });

  return new Promise((resolve) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.warn(`[openchat-mock] port ${OPENCHAT_MOCK_PORT} in use — reuse existing mock`);
        resolve(null);
        return;
      }
      throw error;
    });
    server.listen(OPENCHAT_MOCK_PORT, '127.0.0.1', () => resolve(server));
  });
}

// ---------------------------------------------------------------------------
// spec용 제어 client (워커 프로세스 → HTTP)
// ---------------------------------------------------------------------------

export async function setOpenchatMockMode(mode: OpenchatMockMode) {
  const response = await fetch(`${OPENCHAT_MOCK_ORIGIN}/__mock/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
  if (!response.ok) throw new Error(`openchat mock mode failed: ${response.status}`);
}

export async function listOpenchatMockRequests(): Promise<OpenchatMockRequest[]> {
  const response = await fetch(`${OPENCHAT_MOCK_ORIGIN}/__mock/requests`);
  if (!response.ok) throw new Error(`openchat mock list failed: ${response.status}`);
  const body = (await response.json()) as { requests: OpenchatMockRequest[] };
  return body.requests;
}

export async function openchatRequestsFor(requestNo: string, event?: string) {
  const all = await listOpenchatMockRequests();
  return all.filter(
    (entry) =>
      entry.body.requestNo === requestNo &&
      (event === undefined || entry.body.event === `quick_request.${event}`)
  );
}
