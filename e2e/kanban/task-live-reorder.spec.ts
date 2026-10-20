import { expect, test, type Page } from '@playwright/test';
import {
  beginTaskPointerDrag,
  createTask,
  createTasklist,
  deleteNonDefaultTasklists,
  fetchTasklists,
  endTaskPointerDrag,
  getActiveTaskTitlesInColumn,
  gotoKanban,
  kanbanColumnLocator,
  moveTaskPointer,
  taskDragHandle
} from './helpers';

test.describe.configure({ mode: 'serial' });

function isMovePost(url: string, method: string) {
  return url.includes('/api/google-tasks/tasks/move') && method === 'POST';
}

async function pointerAboveFirstTaskInColumn(page: Page, columnTitle: string) {
  const column = kanbanColumnLocator(page, columnTitle);
  const firstCard = column.getByTestId('kanban-task-card').first();
  const box = await firstCard.boundingBox();
  if (!box) {
    throw new Error(`no task card in column ${columnTitle}`);
  }
  return { x: box.x + box.width / 2, y: box.y - 8 };
}

async function pointerAtSecondSlotInColumn(page: Page, columnTitle: string) {
  const column = kanbanColumnLocator(page, columnTitle);
  const cards = column.getByTestId('kanban-task-card');
  const count = await cards.count();
  if (count === 0) {
    const add = column.getByTestId('kanban-add-task-trigger');
    const box = await add.boundingBox();
    if (!box) {
      throw new Error(`no drop target in column ${columnTitle}`);
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  if (count === 1) {
    const box = await cards.first().boundingBox();
    if (!box) {
      throw new Error('card box missing');
    }
    return { x: box.x + box.width / 2, y: box.y + box.height + 12 };
  }
  const second = cards.nth(1);
  const box = await second.boundingBox();
  if (!box) {
    throw new Error('second card box missing');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('칸반 task 리얼타임 DnD (plan 85)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-L00: 완료·추가·열 메뉴는 리얼타임 DnD 범위 밖 · 완료 카드 grip 없음', async ({
    page,
    request
  }) => {
    await deleteNonDefaultTasklists(request);
    const list = await createTasklist(request, '범위열');
    await createTask(request, list.id, { title: '미완료 항목' });
    await createTask(request, list.id, { title: '완료될 항목' });
    await gotoKanban(page);
    const scopeColumn = kanbanColumnLocator(page, '범위열');
    await scopeColumn
      .getByTestId('kanban-task-card')
      .filter({ hasText: '완료될 항목' })
      .getByTestId('kanban-task-complete-checkbox')
      .click();
    await expect(scopeColumn.getByTestId('kanban-completed-section-trigger')).toContainText(
      '완료됨(1개)',
      { timeout: 15_000 }
    );

    await expect(scopeColumn.getByTestId('kanban-add-task-trigger')).toBeVisible();
    await expect(scopeColumn.getByTestId('kanban-column-menu-trigger')).toBeVisible();
    await scopeColumn.getByTestId('kanban-completed-section-trigger').click();
    const completedCard = scopeColumn.getByTestId('kanban-completed-task-card').filter({
      hasText: '완료될 항목'
    });
    await expect(completedCard).toBeVisible();
    await expect(
      completedCard.getByRole('button', { name: '완료될 항목 카드 이동' })
    ).toHaveCount(0);
    await expect(page.getByTestId('kanban-task-card-overlay')).toHaveCount(0);
  });

  test('AC-L00b: 열 헤더 가로 DnD는 localStorage만 · task move API 0회', async ({
    page,
    request
  }) => {
    await deleteNonDefaultTasklists(request);
    const listA = await createTasklist(request, '열순서 A');
    const listB = await createTasklist(request, '열순서 B');
    await createTask(request, listA.id, { title: 'A 고정' });
    await createTask(request, listB.id, { title: 'B 고정' });
    const allLists = await fetchTasklists(request);
    const tailIds = allLists
      .filter((item) => item.id !== listA.id && item.id !== listB.id)
      .map((item) => item.id);
    await gotoKanban(page);
    await page.evaluate(
      ({ key, order }) => {
        localStorage.setItem(key, JSON.stringify(order));
      },
      { key: 'wakeone-kanban-tasklist-order', order: [listA.id, listB.id, ...tailIds] }
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '칸반' })).toBeVisible({ timeout: 30_000 });
    await expect(kanbanColumnLocator(page, '열순서 A').getByTestId('kanban-task-card')).toHaveCount(1);
    await expect(kanbanColumnLocator(page, '열순서 B').getByTestId('kanban-task-card')).toHaveCount(1);

    const titlesBeforeA = await getActiveTaskTitlesInColumn(page, '열순서 A');
    const titlesBeforeB = await getActiveTaskTitlesInColumn(page, '열순서 B');

    let moveCalls = 0;
    page.on('request', (req) => {
      if (isMovePost(req.url(), req.method())) {
        moveCalls += 1;
      }
    });

    const handleB = kanbanColumnLocator(page, '열순서 B').getByTestId('kanban-column-drag-handle');
    const columnA = kanbanColumnLocator(page, '열순서 A');
    const boxHandleB = await handleB.boundingBox();
    const boxColumnA = await columnA.boundingBox();
    expect(boxHandleB && boxColumnA).toBeTruthy();
    await page.mouse.move(boxHandleB!.x + boxHandleB!.width / 2, boxHandleB!.y + boxHandleB!.height / 2);
    await page.mouse.down();
    await page.mouse.move(boxColumnA!.x + 8, boxColumnA!.y + 40, { steps: 24 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const raw = await page.evaluate(() =>
          localStorage.getItem('wakeone-kanban-tasklist-order')
        );
        if (!raw) {
          return '';
        }
        const ids = JSON.parse(raw) as string[];
        return ids.slice(0, 2).join('|');
      })
      .toBe(`${listB.id}|${listA.id}`);
    expect(moveCalls).toBe(0);
    expect(await getActiveTaskTitlesInColumn(page, '열순서 A')).toEqual(titlesBeforeA);
    expect(await getActiveTaskTitlesInColumn(page, '열순서 B')).toEqual(titlesBeforeB);
  });

  test('AC-L01: 같은 열 reorder · 드래그 중 hole·미리보기 순서', async ({ page, request }) => {
    await deleteNonDefaultTasklists(request);
    const list = await createTasklist(request, '리얼 A');
    await createTask(request, list.id, { title: 'T1' });
    await createTask(request, list.id, { title: 'T2' });
    await createTask(request, list.id, { title: 'T3' });
    await gotoKanban(page);

    await beginTaskPointerDrag(page, 'T3');
    await expect(page.getByTestId('kanban-task-card-overlay')).toBeVisible();
    const draggingCard = page
      .getByTestId('kanban-task-card')
      .filter({ hasText: 'T3' })
      .first();
    await expect(draggingCard).toHaveClass(/opacity-0/);

    const target = await pointerAboveFirstTaskInColumn(page, '리얼 A');
    await moveTaskPointer(page, target.x, target.y);
    await expect
      .poll(async () => getActiveTaskTitlesInColumn(page, '리얼 A'))
      .toEqual(['T3', 'T1', 'T2']);
    await page.keyboard.press('Escape');
    await page.mouse.up();
  });

  test('AC-L02: AC-L01 드롭 · T3,T1,T2 · move 1회', async ({ page, request }) => {
    test.setTimeout(60_000);
    await deleteNonDefaultTasklists(request);
    const list = await createTasklist(request, '리얼 A');
    await createTask(request, list.id, { title: 'T1' });
    await createTask(request, list.id, { title: 'T2' });
    await createTask(request, list.id, { title: 'T3' });
    await gotoKanban(page);
    await expect(kanbanColumnLocator(page, '리얼 A').getByTestId('kanban-task-card')).toHaveCount(3);

    let moveCalls = 0;
    page.on('request', (req) => {
      if (isMovePost(req.url(), req.method())) {
        moveCalls += 1;
      }
    });
    const moveDone = page.waitForResponse(
      (response) => isMovePost(response.url(), response.request().method()) && response.status() === 200,
      { timeout: 20_000 }
    );

    await beginTaskPointerDrag(page, 'T3');
    const target = await pointerAboveFirstTaskInColumn(page, '리얼 A');
    await moveTaskPointer(page, target.x, target.y);
    await expect
      .poll(async () => getActiveTaskTitlesInColumn(page, '리얼 A'))
      .toEqual(['T3', 'T1', 'T2']);
    await endTaskPointerDrag(page);
    await moveDone;

    expect(moveCalls).toBe(1);
    await expect
      .poll(async () => getActiveTaskTitlesInColumn(page, '리얼 A'), { timeout: 15_000 })
      .toEqual(['T3', 'T1', 'T2']);
    await expect
      .poll(async () => {
        const tasksResponse = await request.get(
          `/api/google-tasks/tasklists/${list.id}/tasks?showCompleted=true`
        );
        const body = (await tasksResponse.json()) as { tasks?: Array<{ title: string; status?: string }> };
        return (body.tasks ?? [])
          .filter((task) => task.status !== 'completed')
          .map((task) => task.title);
      })
      .toEqual(['T3', 'T1', 'T2']);
  });

  test('AC-L03: Esc 취소 · 순서 원복 · move 0회', async ({ page, request }) => {
    await deleteNonDefaultTasklists(request);
    const list = await createTasklist(request, 'Esc열');
    await createTask(request, list.id, { title: '앞' });
    await createTask(request, list.id, { title: '뒤' });
    await gotoKanban(page);

    let moveCalls = 0;
    page.on('request', (req) => {
      if (isMovePost(req.url(), req.method())) {
        moveCalls += 1;
      }
    });

    await beginTaskPointerDrag(page, '뒤');
    const firstHandle = taskDragHandle(page, '앞');
    const box = await firstHandle.boundingBox();
    expect(box).toBeTruthy();
    await moveTaskPointer(page, box!.x + box!.width / 2, box!.y - 6);
    await page.keyboard.press('Escape');
    await page.mouse.up();

    expect(moveCalls).toBe(0);
    await expect
      .poll(async () => getActiveTaskTitlesInColumn(page, 'Esc열'))
      .toEqual(['앞', '뒤']);
    await expect(page.getByTestId('kanban-task-card-overlay')).toHaveCount(0);
  });

  test('AC-L04: 열 간 드래그 중 B 삽입 미리보기 · A에서 제거', async ({ page, request }) => {
    await deleteNonDefaultTasklists(request);
    const listA = await createTasklist(request, '소스 A');
    const listB = await createTasklist(request, '대상 B');
    await createTask(request, listA.id, { title: 'A1' });
    await createTask(request, listA.id, { title: 'A2' });
    await createTask(request, listB.id, { title: 'B1' });
    await createTask(request, listB.id, { title: 'B2' });
    await gotoKanban(page);

    await beginTaskPointerDrag(page, 'A1');
    const slot = await pointerAtSecondSlotInColumn(page, '대상 B');
    await moveTaskPointer(page, slot.x, slot.y);

    await expect
      .poll(async () => getActiveTaskTitlesInColumn(page, '소스 A'))
      .toEqual(['A2']);
    await expect
      .poll(async () => getActiveTaskTitlesInColumn(page, '대상 B'))
      .toEqual(['B1', 'A1', 'B2']);
    await page.keyboard.press('Escape');
    await page.mouse.up();
  });

  test('AC-L05: cross-list drop · move 1회', async ({ page, request }) => {
    await deleteNonDefaultTasklists(request);
    const listA = await createTasklist(request, 'DnD 소스');
    const listB = await createTasklist(request, 'DnD 대상');
    await createTask(request, listA.id, { title: '이동할 카드' });
    await createTask(request, listB.id, { title: '대상 카드' });
    await gotoKanban(page);

    let moveCalls = 0;
    page.on('request', (req) => {
      if (isMovePost(req.url(), req.method())) {
        moveCalls += 1;
      }
    });
    const moveResponse = page.waitForResponse(
      (response) =>
        isMovePost(response.url(), response.request().method()) && response.status() === 200
    );

    await beginTaskPointerDrag(page, '이동할 카드');
    const drop = kanbanColumnLocator(page, 'DnD 대상').getByTestId('kanban-add-task-trigger');
    const dropBox = await drop.boundingBox();
    expect(dropBox).toBeTruthy();
    await moveTaskPointer(page, dropBox!.x + dropBox!.width / 2, dropBox!.y + dropBox!.height / 2);
    await endTaskPointerDrag(page);
    await moveResponse;
    expect(moveCalls).toBe(1);

    await expect
      .poll(async () => {
        const tasksResponse = await request.get(
          `/api/google-tasks/tasklists/${listB.id}/tasks?showCompleted=true`
        );
        const tasksBody = (await tasksResponse.json()) as { tasks?: Array<{ title: string }> };
        return tasksBody.tasks?.some((task) => task.title === '이동할 카드') ?? false;
      })
      .toBe(true);
    await expect(page.getByTestId('kanban-task-card').filter({ hasText: '이동할 카드' })).toHaveCount(1);
  });

  test('AC-L06: 드래그 중 move POST 0회', async ({ page, request }) => {
    await deleteNonDefaultTasklists(request);
    const list = await createTasklist(request, '네트워크');
    await createTask(request, list.id, { title: 'N1' });
    await createTask(request, list.id, { title: 'N2' });
    await createTask(request, list.id, { title: 'N3' });
    await gotoKanban(page);

    let moveCalls = 0;
    page.on('request', (req) => {
      if (isMovePost(req.url(), req.method())) {
        moveCalls += 1;
      }
    });

    await beginTaskPointerDrag(page, 'N3');
    const top = await pointerAboveFirstTaskInColumn(page, '네트워크');
    await moveTaskPointer(page, top.x, top.y);
    const mid = await pointerAtSecondSlotInColumn(page, '네트워크');
    await moveTaskPointer(page, mid.x, mid.y);
    await moveTaskPointer(page, top.x, top.y);
    expect(moveCalls).toBe(0);
    await page.keyboard.press('Escape');
    await page.mouse.up();
  });

  test('AC-L07: drop 시 move POST 정확히 1회', async ({ page, request }) => {
    await deleteNonDefaultTasklists(request);
    const list = await createTasklist(request, '드롭');
    await createTask(request, list.id, { title: 'D1' });
    await createTask(request, list.id, { title: 'D2' });
    await gotoKanban(page);

    let moveCalls = 0;
    page.on('request', (req) => {
      if (isMovePost(req.url(), req.method())) {
        moveCalls += 1;
      }
    });
    const moveDone = page.waitForResponse(
      (response) => isMovePost(response.url(), response.request().method()) && response.status() === 200,
      { timeout: 20_000 }
    );

    await beginTaskPointerDrag(page, 'D2');
    const target = await pointerAboveFirstTaskInColumn(page, '드롭');
    await moveTaskPointer(page, target.x, target.y);
    await endTaskPointerDrag(page);
    await moveDone;
    expect(moveCalls).toBe(1);
  });

  test('AC-L08: move 500 · 한국어 에러 · 순서 복구', async ({ page, request }) => {
    await deleteNonDefaultTasklists(request);
    const listA = await createTasklist(request, '실패 A');
    const listB = await createTasklist(request, '실패 B');
    await createTask(request, listA.id, { title: '실패 이동' });
    await createTask(request, listB.id, { title: 'B 대상' });
    await page.route('**/api/google-tasks/tasks/move', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });
    await gotoKanban(page);
    await expect(kanbanColumnLocator(page, '실패 A').getByTestId('kanban-task-card')).toHaveCount(1);

    const orderBefore = await getActiveTaskTitlesInColumn(page, '실패 A');
    const failedMove = page.waitForResponse(
      (response) => isMovePost(response.url(), response.request().method()) && response.status() === 500,
      { timeout: 20_000 }
    );

    await beginTaskPointerDrag(page, '실패 이동');
    const targetColumn = kanbanColumnLocator(page, '실패 B');
    const columnBox = await targetColumn.boundingBox();
    expect(columnBox).toBeTruthy();
    await moveTaskPointer(
      page,
      columnBox!.x + columnBox!.width / 2,
      columnBox!.y + columnBox!.height / 2
    );
    await endTaskPointerDrag(page);
    await failedMove;

    await expect(page.getByText('할 일 이동에 실패했습니다.')).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => getActiveTaskTitlesInColumn(page, '실패 A'))
      .toEqual(orderBefore);
  });

  test('AC-L09: plan 81 AC-19·AC-20 회귀 (드롭 동기화)', async ({ page, request }) => {
    await deleteNonDefaultTasklists(request);
    const listA = await createTasklist(request, 'DnD A');
    const listB = await createTasklist(request, 'DnD B');
    await createTask(request, listA.id, { title: '이동할 카드' });
    await gotoKanban(page);

    const moveResponse = page.waitForResponse(
      (response) =>
        isMovePost(response.url(), response.request().method()) && response.status() === 200
    );
    await beginTaskPointerDrag(page, '이동할 카드');
    const drop = kanbanColumnLocator(page, 'DnD B').getByTestId('kanban-add-task-trigger');
    const dropBox = await drop.boundingBox();
    expect(dropBox).toBeTruthy();
    await moveTaskPointer(page, dropBox!.x + dropBox!.width / 2, dropBox!.y + dropBox!.height / 2);
    await endTaskPointerDrag(page);
    await moveResponse;
    await expect
      .poll(async () => {
        const tasksResponse = await request.get(
          `/api/google-tasks/tasklists/${listB.id}/tasks?showCompleted=true`
        );
        const tasksBody = (await tasksResponse.json()) as { tasks?: Array<{ title: string }> };
        return tasksBody.tasks?.some((task) => task.title === '이동할 카드') ?? false;
      })
      .toBe(true);

    await deleteNonDefaultTasklists(request);
    const reorderList = await createTasklist(request, 'Reorder');
    await createTask(request, reorderList.id, { title: '첫 번째' });
    await createTask(request, reorderList.id, { title: '두 번째' });
    await gotoKanban(page);
    await beginTaskPointerDrag(page, '두 번째');
    const reorderTarget = kanbanColumnLocator(page, 'Reorder')
      .getByTestId('kanban-task-card')
      .filter({ hasText: '첫 번째' });
    const reorderBox = await reorderTarget.boundingBox();
    expect(reorderBox).toBeTruthy();
    await moveTaskPointer(page, reorderBox!.x + 20, reorderBox!.y + 4);
    await endTaskPointerDrag(page);
    const cards = page.getByTestId('kanban-task-card');
    await expect(cards.nth(0)).toContainText('두 번째');
    await expect(cards.nth(1)).toContainText('첫 번째');
  });
});
