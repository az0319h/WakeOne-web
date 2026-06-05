async (page) => {
  const creds = __CREDS__;
  const base = 'http://localhost:3000';
  const results = [];

  async function login(email, password) {
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* cross-origin */
      }
    });
    await page.goto(base + '/auth/sign-in');
    await page.getByRole('textbox', { name: '이메일' }).fill(email);
    await page.getByRole('textbox', { name: '비밀번호' }).fill(password);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  }

  async function waitToast(substring, timeout = 10000) {
    await page
      .locator('[data-sonner-toast]')
      .filter({ hasText: substring })
      .first()
      .waitFor({ state: 'visible', timeout });
  }

  await login(creds.adminEmail, creds.adminPassword);
  await page.goto(base + '/dashboard/users');
  const userRow = page.getByRole('row').filter({ hasText: creds.userEmail });

  // AC #3: deactivate → badge without reload
  let badgeBefore = await userRow.getByText('비활성', { exact: true }).count();
  if (badgeBefore === 0) {
    await userRow.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: '비활성화' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '비활성화' }).click();
    await waitToast('비활성화');
    await page.waitForTimeout(500);
  }
  const ac3Badge = (await userRow.getByText('비활성', { exact: true }).count()) > 0;
  results.push({ ac: 3, pass: ac3Badge, note: 'badge after deactivate' });

  const apiInactive = await page.evaluate(
    async ({ userId }) => {
      const res = await fetch('/api/users/' + userId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' })
      });
      return { status: res.status, json: await res.json() };
    },
    { userId: creds.userId }
  );
  results.push({
    ac: 5,
    pass: apiInactive.status === 200 && apiInactive.json?.success === true,
    note: JSON.stringify(apiInactive)
  });

  // AC #1: reactivate → badge gone, edit menu available
  try {
    await userRow.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: '활성화' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '활성화' }).click();
    await waitToast('활성화');
    const badgeAfter = await userRow.getByText('비활성', { exact: true }).count();
    await userRow.getByRole('button').last().click();
    const hasEdit = (await page.getByRole('menuitem', { name: '수정' }).count()) > 0;
    const hasDeactivate = (await page.getByRole('menuitem', { name: '비활성화' }).count()) > 0;
    await page.keyboard.press('Escape');
    results.push({
      ac: 1,
      pass: badgeAfter === 0 && hasEdit && hasDeactivate,
      note: `badge=${badgeAfter} edit=${hasEdit} deactivate=${hasDeactivate}`
    });
  } catch (e) {
    results.push({ ac: 1, pass: false, error: e.message });
  }

  // AC #2: user can sign in
  const browser = page.context().browser();
  const userCtx = await browser.newContext();
  const userPage = await userCtx.newPage();
  try {
    await userPage.goto(base + '/auth/sign-in');
    await userPage.getByRole('textbox', { name: '이메일' }).fill(creds.userEmail);
    await userPage.getByRole('textbox', { name: '비밀번호' }).fill(creds.userPassword);
    await userPage.getByRole('button', { name: '로그인' }).click();
    await userPage.waitForURL(/\/dashboard/, { timeout: 20000 });
    const badToast =
      (await userPage.getByText('비활성화된 계정입니다').count()) > 0;
    results.push({ ac: 2, pass: !badToast && userPage.url().includes('/dashboard') });
  } catch (e) {
    results.push({ ac: 2, pass: false, error: e.message });
  } finally {
    await userCtx.close();
  }

  // AC #4: edit user → list updates without reload
  try {
    await page.goto(base + '/dashboard/users');
    const row = page.getByRole('row').filter({ hasText: creds.userEmail });
    const marker = 'E2E' + Date.now().toString().slice(-4);
    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: '수정' }).click();
    await page.getByLabel('이름').fill(marker);
    await page.getByRole('button', { name: '저장' }).click();
    await waitToast('저장되었습니다');
    const rowText = await row.innerText();
    results.push({ ac: 4, pass: rowText.includes(marker), note: rowText.slice(0, 80) });
  } catch (e) {
    results.push({ ac: 4, pass: false, error: e.message });
  }

  const apiActive = await page.evaluate(
    async ({ userId }) => {
      const res = await fetch('/api/users/' + userId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' })
      });
      return { status: res.status, json: await res.json() };
    },
    { userId: creds.userId }
  );
  results.push({
    ac: 6,
    pass:
      apiActive.status === 400 &&
      String(apiActive.json?.message || '').includes('이미 활성화'),
    note: JSON.stringify(apiActive)
  });

  return JSON.stringify(results, null, 2);
}
