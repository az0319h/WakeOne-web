async (page) => {
  const creds = __CREDS__;
  const base = __BASE__;
  const results = [];

  async function login(email, password) {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
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
  results.push({ ac: 'setup', pass: true });

  await page.goto(base + '/dashboard/users');
  await page.getByRole('button', { name: '사용자 초대' }).click();
  await page.getByLabel('이메일').fill(creds.userEmail);
  await page.getByRole('button', { name: '초대 보내기' }).click();
  try {
    await waitToast('이미 등록된 이메일입니다');
    results.push({ ac: 1, pass: true });
  } catch (e) {
    results.push({ ac: 1, pass: false, error: e.message });
  }
  await page.keyboard.press('Escape');

  await page.goto(base + '/dashboard/users');
  const adminRow = page.getByRole('row').filter({ hasText: creds.adminEmail });
  await adminRow.getByRole('button').last().click();
  const deactivateOnSelf = await page.getByRole('menuitem', { name: '비활성화' }).count();
  await page.keyboard.press('Escape');
  results.push({ ac: '6b-self', pass: deactivateOnSelf === 0 });

  const browser = page.context().browser();
  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();

  try {
    await userPage.goto(base + '/auth/sign-in');
    await userPage.getByRole('textbox', { name: '이메일' }).fill(creds.userEmail);
    await userPage.getByRole('textbox', { name: '비밀번호' }).fill(creds.userPassword);
    await userPage.getByRole('button', { name: '로그인' }).click();
    await userPage.waitForURL(/\/dashboard/, { timeout: 20000 });

    await page.goto(base + '/dashboard/users');
    const userRow = page.getByRole('row').filter({ hasText: creds.userEmail });
    await userRow.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: '비활성화' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '비활성화' }).click();
    try {
      await waitToast('비활성화');
      results.push({ ac: 3, pass: true });
    } catch (e) {
      results.push({ ac: 3, pass: false, error: e.message });
    }

    try {
      await userPage.waitForURL(/\/auth\/sign-in/, { timeout: 15000 });
      results.push({ ac: 4, pass: true, note: userPage.url() });
    } catch (e) {
      await userPage.goto(base + '/dashboard/overview');
      const userUrl = userPage.url();
      results.push({
        ac: 4,
        pass: userUrl.includes('/auth/sign-in') || userUrl.includes('accountDisabled'),
        note: userUrl,
        error: e.message
      });
    }

    await page.goto(base + '/dashboard/users');
    await page.getByRole('button', { name: '사용자 초대' }).click();
    await page.getByLabel('이메일').fill(creds.userEmail);
    await page.getByRole('button', { name: '초대 보내기' }).click();
    try {
      await waitToast('이미 등록된 이메일입니다');
      results.push({ ac: 2, pass: true });
    } catch (e) {
      results.push({ ac: 2, pass: false, error: e.message });
    }
    await page.keyboard.press('Escape');

    await userPage.goto(base + '/auth/sign-in');
    await userPage.getByRole('textbox', { name: '이메일' }).fill(creds.userEmail);
    await userPage.getByRole('textbox', { name: '비밀번호' }).fill(creds.userPassword);
    await userPage.getByRole('button', { name: '로그인' }).click();
    await userPage.waitForTimeout(1500);
    const ac5OnSignIn = userPage.url().includes('/auth/sign-in');
    const ac5Toast =
      (await userPage.getByText('비활성화된 계정입니다').count()) > 0 ||
      (await userPage.locator('[data-sonner-toast]').filter({ hasText: '비활성화' }).count()) > 0;
    results.push({
      ac: 5,
      pass: ac5OnSignIn && ac5Toast,
      note: `url=${userPage.url()} toast=${ac5Toast}`
    });

    await page.goto(base + '/dashboard/users');
    const badgeCount = await userRow.getByText('비활성', { exact: true }).count();
    results.push({ ac: 6, pass: badgeCount > 0 });

    const actionButtons = await userRow.getByRole('button').count();
    results.push({ ac: '6c', pass: actionButtons === 0, note: 'actionButtons=' + actionButtons });

    const otherRow = page.getByRole('row').filter({ hasText: 'aaz19087@gmail.com' });
    await otherRow.getByRole('button', { name: 'Open menu' }).click();
    const otherDeactivate = (await page.getByRole('menuitem', { name: '비활성화' }).count()) > 0;
    await page.keyboard.press('Escape');
    results.push({ ac: '6b-other', pass: otherDeactivate, note: String(otherDeactivate) });
  } finally {
    await userContext.close();
  }

  await page.goto(base + '/dashboard/profile');
  const h2Texts = await page.locator('h2').allTextContents();
  const ac9Pass =
    h2Texts.includes('프로필') &&
    h2Texts.includes('계정 정보') &&
    h2Texts.includes('보안') &&
    (await page.getByRole('tab').count()) === 0;
  results.push({ ac: 9, pass: ac9Pass, note: h2Texts.join('|') });

  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL(/\/auth\/sign-in/, { timeout: 15000 });
  results.push({ ac: 8, pass: page.url().includes('/auth/sign-in') });

  try {
    await login(creds.adminEmail, creds.adminPassword);
    await page.goto(base + '/dashboard/profile');
    await page.getByRole('button', { name: '비밀번호 변경' }).click();
    const newPw = creds.adminPassword + 'X1';
    await page.getByLabel('현재 비밀번호').fill(creds.adminPassword);
    await page.getByLabel('새 비밀번호', { exact: true }).fill(newPw);
    await page.getByLabel('비밀번호 확인').fill(newPw);
    await page.getByRole('button', { name: '변경 저장' }).click();
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 20000 });
    const ac7Toast =
      (await page.getByText('비밀번호가 변경되었습니다').count()) > 0 ||
      (await page.locator('[data-sonner-toast]').filter({ hasText: '비밀번호' }).count()) > 0;
    if (!ac7Toast) {
      throw new Error('password change toast not shown');
    }
    await page.getByRole('textbox', { name: '이메일' }).fill(creds.adminEmail);
    await page.getByRole('textbox', { name: '비밀번호' }).fill(newPw);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    await page.goto(base + '/dashboard/profile');
    await page.getByRole('button', { name: '비밀번호 변경' }).click();
    await page.getByLabel('현재 비밀번호').fill(newPw);
    await page.getByLabel('새 비밀번호', { exact: true }).fill(creds.adminPassword);
    await page.getByLabel('비밀번호 확인').fill(creds.adminPassword);
    await page.getByRole('button', { name: '변경 저장' }).click();
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 20000 });
    await login(creds.adminEmail, creds.adminPassword);
    results.push({ ac: 7, pass: true });
  } catch (e) {
    results.push({ ac: 7, pass: false, error: e.message });
  }

  return JSON.stringify(results, null, 2);
}
