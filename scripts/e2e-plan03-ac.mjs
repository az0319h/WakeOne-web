/**
 * Plan 03 AC runner for Playwright MCP browser_run_code_unsafe (filename).
 * Reads credentials from project .env (local only).
 */
import fs from 'node:fs';
import path from 'node:path';

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/\r$/, '').trim();
  }
  return out;
}

const env = loadEnv(path.join(process.cwd(), '.env'));
const creds = {
  adminEmail: env.E2E_ADMIN_EMAIL,
  adminPassword: env.E2E_ADMIN_PASSWORD,
  userEmail: env.E2E_USER_EMAIL,
  userPassword: env.E2E_USER_PASSWORD,
  user2Email: env.E2E_USER2_EMAIL,
  user2Password: env.E2E_USER2_PASSWORD
};

export default async function run(page) {
  const results = [];
  const base = env.E2E_BASE_URL || 'http://localhost:3000';

  async function login(email, password) {
    await page.goto(`${base}/auth/sign-in`);
    await page.getByRole('textbox', { name: '이메일' }).fill(email);
    await page.getByRole('textbox', { name: '비밀번호' }).fill(password);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  }

  async function waitToast(text, timeout = 8000) {
    const locator = page.getByText(text, { exact: false });
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  }

  // --- Admin login ---
  await login(creds.adminEmail, creds.adminPassword);
  results.push({ ac: 'setup', pass: true, note: 'admin logged in' });

  // AC #1: duplicate invite (active user email)
  await page.goto(`${base}/dashboard/users`);
  await page.getByRole('button', { name: '사용자 초대' }).click();
  await page.getByRole('textbox', { name: '이메일' }).fill(creds.userEmail);
  await page.getByRole('button', { name: '초대 보내기' }).click();
  try {
    await waitToast('이미 등록된 이메일입니다');
    results.push({ ac: 1, pass: true });
  } catch (e) {
    results.push({ ac: 1, pass: false, error: String(e) });
  }
  await page.keyboard.press('Escape');

  // AC #6b: admin own row — no deactivate
  await page.goto(`${base}/dashboard/users`);
  const adminRow = page.getByRole('row').filter({ hasText: creds.adminEmail });
  await adminRow.getByRole('button').last().click();
  const adminMenu = page.getByRole('menu');
  const adminHasDeactivate = await adminMenu.getByText('비활성화').count();
  await page.keyboard.press('Escape');
  results.push({
    ac: '6b-admin-self',
    pass: adminHasDeactivate === 0,
    note: `deactivate items: ${adminHasDeactivate}`
  });

  // Open second context for AC #4 (user session while admin deactivates)
  const browser = page.context().browser();
  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();
  try {
    await userPage.goto(`${base}/auth/sign-in`);
    await userPage.getByRole('textbox', { name: '이메일' }).fill(creds.userEmail);
    await userPage.getByRole('textbox', { name: '비밀번호' }).fill(creds.userPassword);
    await userPage.getByRole('button', { name: '로그인' }).click();
    await userPage.waitForURL(/\/dashboard/, { timeout: 15000 });

    // AC #3: deactivate user A
    await page.goto(`${base}/dashboard/users`);
    const userRow = page.getByRole('row').filter({ hasText: creds.userEmail });
    await userRow.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: '비활성화' }).click();
    await page.getByRole('button', { name: '확인' }).click();
    try {
      await waitToast('비활성화');
      results.push({ ac: 3, pass: true });
    } catch (e) {
      results.push({ ac: 3, pass: false, error: String(e) });
    }

    // AC #4: user session ends
    await userPage.waitForTimeout(2000);
    await userPage.goto(`${base}/dashboard/overview`);
    await userPage.waitForTimeout(1500);
    const userUrl = userPage.url();
    const ac4Pass =
      userUrl.includes('/auth/sign-in') || userUrl.includes('accountDisabled');
    results.push({ ac: 4, pass: ac4Pass, note: `url=${userUrl}` });

    // AC #2: invite inactive email
    await page.goto(`${base}/dashboard/users`);
    await page.getByRole('button', { name: '사용자 초대' }).click();
    await page.getByRole('textbox', { name: '이메일' }).fill(creds.userEmail);
    await page.getByRole('button', { name: '초대 보내기' }).click();
    try {
      await waitToast('이미 등록된 이메일입니다');
      results.push({ ac: 2, pass: true });
    } catch (e) {
      results.push({ ac: 2, pass: false, error: String(e) });
    }
    await page.keyboard.press('Escape');

    // AC #5: inactive sign-in
    await userPage.goto(`${base}/auth/sign-in`);
    await userPage.getByRole('textbox', { name: '이메일' }).fill(creds.userEmail);
    await userPage.getByRole('textbox', { name: '비밀번호' }).fill(creds.userPassword);
    await userPage.getByRole('button', { name: '로그인' }).click();
    try {
      await waitToast('비활성화된 계정입니다');
      results.push({ ac: 5, pass: true });
    } catch (e) {
      results.push({ ac: 5, pass: false, error: String(e) });
    }

    // AC #6: inactive badge
    await page.goto(`${base}/dashboard/users`);
    const inactiveBadge = userRow.getByText('비활성');
    const ac6Pass = (await inactiveBadge.count()) > 0;
    results.push({ ac: 6, pass: ac6Pass });

    // AC #6c: inactive row — no edit menu
    await userRow.getByRole('button').last().click();
    const editCount = await page.getByRole('menuitem', { name: '수정' }).count();
    await page.keyboard.press('Escape');
    results.push({ ac: '6c', pass: editCount === 0, note: `edit items: ${editCount}` });

    // AC #6b: other row has deactivate
    const otherRow = page.getByRole('row').filter({ hasText: creds.user2Email }).first();
    if ((await otherRow.count()) > 0) {
      await otherRow.getByRole('button').last().click();
      const deactivateCount = await page.getByRole('menuitem', { name: '비활성화' }).count();
      await page.keyboard.press('Escape');
      results.push({
        ac: '6b-other',
        pass: deactivateCount > 0,
        note: `deactivate items: ${deactivateCount}`
      });
    } else {
      results.push({ ac: '6b-other', pass: null, note: 'no other user row' });
    }
  } finally {
    await userContext.close();
  }

  // AC #9: profile layout (admin)
  await page.goto(`${base}/dashboard/profile`);
  const hasProfile = (await page.getByText('프로필', { exact: false }).count()) > 0;
  const hasAccount = (await page.getByText('계정', { exact: false }).count()) > 0;
  const hasSecurity = (await page.getByText('보안', { exact: false }).count()) > 0;
  const tabCount = await page.getByRole('tab').count();
  results.push({
    ac: 9,
    pass: hasProfile && hasAccount && hasSecurity && tabCount === 0,
    note: `sections profile=${hasProfile} account=${hasAccount} security=${hasSecurity} tabs=${tabCount}`
  });

  // AC #8: logout from Security
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL(/\/auth\/sign-in/, { timeout: 10000 });
  results.push({ ac: 8, pass: page.url().includes('/auth/sign-in') });

  // AC #7: password change (admin re-login, change, re-login)
  await login(creds.adminEmail, creds.adminPassword);
  await page.goto(`${base}/dashboard/profile`);
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  const newPw = `${creds.adminPassword}a`;
  await page.getByRole('textbox', { name: '현재 비밀번호' }).fill(creds.adminPassword);
  await page.getByRole('textbox', { name: '새 비밀번호' }).fill(newPw);
  await page.getByRole('textbox', { name: '비밀번호 확인' }).fill(newPw);
  await page.getByRole('button', { name: '변경' }).click();
  try {
    await waitToast('비밀번호');
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 15000 });
    await page.getByRole('textbox', { name: '이메일' }).fill(creds.adminEmail);
    await page.getByRole('textbox', { name: '비밀번호' }).fill(newPw);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    // revert password
    await page.goto(`${base}/dashboard/profile`);
    await page.getByRole('button', { name: '비밀번호 변경' }).click();
    await page.getByRole('textbox', { name: '현재 비밀번호' }).fill(newPw);
    await page.getByRole('textbox', { name: '새 비밀번호' }).fill(creds.adminPassword);
    await page.getByRole('textbox', { name: '비밀번호 확인' }).fill(creds.adminPassword);
    await page.getByRole('button', { name: '변경' }).click();
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 15000 });
    await login(creds.adminEmail, creds.adminPassword);
    results.push({ ac: 7, pass: true });
  } catch (e) {
    results.push({ ac: 7, pass: false, error: String(e) });
  }

  return JSON.stringify(results, null, 2);
}
