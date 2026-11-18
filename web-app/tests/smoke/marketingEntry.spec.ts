import { expect, type Page, test } from "@playwright/test";

/*
 * Sticky marketing entry (#165, docs/kid-kestral/165-...md §2): Celestine's
 * six steps, against an environment where MARKETING_PAGE and
 * MARKETING_STICKY_ENTRY are both T1 (Test; Prod after the dial-up).
 */

/** marketingEntry.ts's keys, copied so this spec doesn't load React into Playwright's Node runtime. */
const MARKETING_ENTERED_AT_KEY = "nyc311.marketing.enteredAt";
const DAY_MS = 24 * 60 * 60 * 1000;

async function expectMarketing(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: /Enter fleet/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "About", exact: true })).toHaveCount(0);
}

async function expectShell(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "About", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Enter fleet/ })).toHaveCount(0);
}

const storedEntry = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), MARKETING_ENTERED_AT_KEY);

test("entering once is remembered across tabs and a browser restart", async ({ browser, context, page }) => {
  /* 1. A fresh visitor sees the marketing page. */
  await page.goto("/");
  await expectMarketing(page);

  /* 2. Enter fleet opens the shell and stores the entry. */
  await page.getByRole("button", { name: /Enter fleet/ }).first().click();
  await expectShell(page);
  expect(await storedEntry(page)).not.toBeNull();

  /* 3. A new tab in the same browser goes straight to the shell. */
  const tab = await context.newPage();
  await tab.goto("/");
  await expectShell(tab);

  /* 4. A restarted browser (localStorage kept, sessionStorage gone) goes straight to the shell. */
  const restarted = await browser.newContext({ storageState: await context.storageState(), baseURL: test.info().project.use.baseURL });
  const restartedPage = await restarted.newPage();
  await restartedPage.goto("/");
  await expectShell(restartedPage);
  await restarted.close();
});

test("an entry more than 7 days old shows the marketing page again and is removed", async ({ page }) => {
  /* 5. Seed the stored entry 8 days back, before the app's own scripts run. */
  await page.addInitScript(
    ([key, value]) => {
      if (window.sessionStorage.getItem("smoke.seeded") === null) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.setItem("smoke.seeded", "1");
      }
    },
    [MARKETING_ENTERED_AT_KEY, new Date(Date.now() - 8 * DAY_MS).toISOString()] as const,
  );
  await page.goto("/");
  await expectMarketing(page);
  expect(await storedEntry(page)).toBeNull();
});

test("About's Back to the intro returns to the marketing page and forgets the entry", async ({ page }) => {
  /* 6. Enter, then take the way back from the About drawer. */
  await page.goto("/");
  await expectMarketing(page);
  await page.getByRole("button", { name: /Enter fleet/ }).first().click();
  await expectShell(page);
  await page.getByRole("button", { name: "About", exact: true }).click();
  await page.getByRole("button", { name: "Back to the intro" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expectMarketing(page);
  expect(await storedEntry(page)).toBeNull();
});
