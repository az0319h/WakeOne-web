import { expect, type APIRequestContext, type Page } from '@playwright/test';

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

export async function resolveUserIdByEmail(
  request: APIRequestContext,
  email: string
): Promise<string> {
  const response = await request.get(
    `/api/users?search=${encodeURIComponent(email)}&limit=5`
  );
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    users?: Array<{ id: string; email: string }>;
  };
  const user = body.users?.find((item) => item.email === email);
  expect(user?.id).toBeTruthy();
  return user!.id;
}

export async function createUserViaApi(
  request: APIRequestContext,
  email: string,
  fullName: string
) {
  const response = await request.post('/api/users', {
    data: {
      email,
      full_name: fullName,
      affiliation: 'wake',
      rank: '경영진',
      system_role: 'user',
      birthday: '1990-01-01'
    }
  });

  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user_id?: string };
  return body.user_id as string;
}

export async function updateUserFullName(
  request: APIRequestContext,
  userId: string,
  fullName: string
) {
  const response = await request.put(`/api/users/${userId}`, {
    data: {
      full_name: fullName,
      affiliation: 'wake',
      rank: '경영진'
    }
  });
  expect(response.status()).toBe(200);
  return response;
}

export async function updateUserBirthday(
  request: APIRequestContext,
  userId: string,
  birthday: string
) {
  const response = await request.put(`/api/users/${userId}`, {
    data: {
      birthday,
      affiliation: 'wake',
      rank: '경영진'
    }
  });
  expect(response.status()).toBe(200);
  return response;
}

export async function markAllNotificationsReadAsUser(
  userRequest: APIRequestContext
) {
  const response = await userRequest.patch('/api/notifications/read-all');
  expect(response.status()).toBe(200);
}

export async function fetchNotifications(
  request: APIRequestContext,
  query = ''
) {
  const response = await request.get(`/api/notifications?limit=10${query}`);
  return response;
}

export async function seedUserUpdateNotifications(
  request: APIRequestContext,
  userId: string,
  count: number
) {
  const birthdays = [
    '1990-01-01',
    '1990-01-02',
    '1990-01-03',
    '1990-01-04',
    '1990-01-05',
    '1990-01-06',
    '1990-01-07',
    '1990-01-08',
    '1990-01-09',
    '1990-01-10',
    '1990-01-11',
    '1990-01-12',
    '1990-01-13',
    '1990-01-14',
    '1990-01-15',
    '1990-01-16'
  ];

  for (let index = 0; index < count; index += 1) {
    await updateUserBirthday(request, userId, birthdays[index % birthdays.length]!);
  }
}

export async function openNotificationPopover(page: Page) {
  await page.getByTestId('notification-bell').click();
  await expect(page.getByRole('heading', { name: '알림', level: 4 })).toBeVisible();
}

export function notificationBellButton(page: Page) {
  return page.getByTestId('notification-bell');
}

export function countNotificationCards(page: Page) {
  return page.getByTestId(/^notification-card-/);
}

export async function editUserNameViaUsersUi(
  page: Page,
  email: string,
  updatedName: string
) {
  await page.goto('/dashboard/users');
  const targetRow = page.getByRole('row', {
    name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  });
  await expect(targetRow).toBeVisible();

  await targetRow.getByRole('button', { name: '프로필 보기' }).click();
  await page.getByRole('button', { name: '조직 정보 수정' }).click();

  const dialog = page.getByRole('dialog', { name: '사용자 수정' });
  await expect(dialog).toBeVisible();
  const nameField = dialog.getByRole('textbox', { name: '이름' });
  await nameField.click();
  await nameField.clear();
  await nameField.pressSequentially(updatedName, { delay: 10 });
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('사용자 정보가 저장되었습니다.')).toBeVisible();
}

export async function countAllNotifications(request: APIRequestContext) {
  let total = 0;
  let cursor: string | null = null;

  for (let page = 0; page < 10; page += 1) {
    const query = cursor
      ? `/api/notifications?limit=50&cursor=${encodeURIComponent(cursor)}`
      : '/api/notifications?limit=50';
    const response = await request.get(query);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: {
        notifications?: unknown[];
        hasMore?: boolean;
        nextCursor?: string | null;
      };
    };
    total += body.data?.notifications?.length ?? 0;
    if (!body.data?.hasMore || !body.data.nextCursor) {
      break;
    }
    cursor = body.data.nextCursor;
  }

  return total;
}
