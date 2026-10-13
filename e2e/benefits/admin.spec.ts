import { expect, test } from "@playwright/test";

test.describe("복지비 관리", () => {
  test("관리자는 최종 시안의 필터와 월별 조직 표를 본다", async ({ page }) => {
    await page.goto("/dashboard/benefits");

    await expect(page.getByRole("heading", { name: "복지비 관리" })).toBeVisible();
    await expect(page.getByText("총 지급 한도")).toBeVisible();
    await expect(page.getByText("월별 복지비 사용 추이")).toBeVisible();
    await expect(page.getByText("카테고리별 사용 비중")).toBeVisible();
    await expect(page.getByRole("tab", { name: "웨이크", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "산스", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "산스파운드리" })).toBeVisible();
    await expect(page.getByLabel("조회 월")).toBeVisible();
    await expect(page.getByPlaceholder("이름 검색")).toBeVisible();

    for (const column of [
      "구성원",
      "문서번호",
      "문서승인일",
      "사용 현황",
      "도서",
      "체력증진",
      "외부교육",
      "상태",
    ]) {
      await expect(page.getByRole("columnheader", { name: column })).toBeVisible();
    }

    await expect(page.getByRole("link", { name: "복지비 관리" })).toBeVisible();

    if (process.env.E2E_BENEFIT_INTEGRATION === "1") {
      const row = page.getByRole("row").filter({ hasText: "테스트 계정1" });
      await expect(row).toContainText("120,000원 / 100,000원");
      await expect(row).toContainText("한도 초과");
      await row.click();
      const detailRow = page.getByRole("row").filter({ hasText: "체력증진비 신청" }).first();
      await expect(detailRow).toBeVisible();
      const popupPromise = page.waitForEvent("popup");
      await detailRow.click();
      const popup = await popupPromise;
      await expect(popup.url()).toMatch(/flex/i);
      await popup.close();
    }
  });
});
