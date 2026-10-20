import { expect, test, type APIRequestContext } from '@playwright/test';
import { createTasklist, deleteAllTasklists, deleteNonDefaultTasklists } from '../kanban/helpers';

type ActivityLog = {
  request_id?: string;
  action?: string;
  http_status?: number;
};

async function fetchLogs(request: APIRequestContext, action: string): Promise<ActivityLog[]> {
  const response = await request.get(
    `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50&log_user=self`
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data?: { logs?: ActivityLog[] } };
  return body.data?.logs ?? [];
}

test.describe('Google Tasks activity log API', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-27: task create 2xx → x-request-id + google_tasks.task.create', async ({ request }) => {
    await deleteAllTasklists(request);
    const list = await createTasklist(request, 'API 로그');

    const response = await request.post(`/api/google-tasks/tasklists/${list.id}/tasks`, {
      data: { title: 'API 로그 할 일' }
    });
    expect(response.status()).toBe(201);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expect
      .poll(async () => {
        const logs = await fetchLogs(request, 'google_tasks.task.create');
        return logs.some(
          (log) => log.request_id === requestId && log.http_status === 201
        );
      })
      .toBe(true);
  });

  test('AC-28: title 누락 POST 400 + 동일 request id 로그', async ({ request }) => {
    await deleteAllTasklists(request);
    const list = await createTasklist(request, 'API validation');

    const response = await request.post(`/api/google-tasks/tasklists/${list.id}/tasks`, {
      data: { title: '' }
    });
    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expect
      .poll(async () => {
        const logs = await fetchLogs(request, 'google_tasks.task.create');
        return logs.some(
          (log) => log.request_id === requestId && log.http_status === 400
        );
      })
      .toBe(true);
  });

  test('AC-04: tasklist update 2xx → x-request-id + google_tasks.tasklist.update', async ({
    request
  }) => {
    await deleteNonDefaultTasklists(request);
    const list = await createTasklist(request, 'API 목록 수정');

    const response = await request.patch(`/api/google-tasks/tasklists/${list.id}`, {
      data: { title: 'API 목록 수정 후' }
    });
    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expect
      .poll(async () => {
        const logs = await fetchLogs(request, 'google_tasks.tasklist.update');
        return logs.some((log) => log.request_id === requestId && log.http_status === 200);
      })
      .toBe(true);
  });

  test('AC-05: empty title PATCH 400 + 동일 request id 4xx 로그', async ({ request }) => {
    await deleteNonDefaultTasklists(request);
    const list = await createTasklist(request, 'API 빈 제목');

    const response = await request.patch(`/api/google-tasks/tasklists/${list.id}`, {
      data: { title: '' }
    });
    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    await expect
      .poll(async () => {
        const logs = await fetchLogs(request, 'google_tasks.tasklist.update');
        return logs.some((log) => log.request_id === requestId && log.http_status === 400);
      })
      .toBe(true);
  });
});
