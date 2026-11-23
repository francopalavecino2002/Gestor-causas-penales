import { expect, test, type Page } from "@playwright/test";

import { horizontalOverflow, signIn } from "./api";
import { FIRM_TIME_ZONE, LUCIA } from "./demo-users";

test.use({ locale: "es-AR", timezoneId: FIRM_TIME_ZONE });

/** Today in the firm's zone, as YYYY-MM-DD. */
function todayInFirm(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FIRM_TIME_ZONE }).format(new Date());
}

/**
 * The day the seed calls "today": on a weekend it is the next Monday (DemoCalendar), so the day
 * view of a Saturday is empty on purpose. Undefined when it is today.
 */
function demoDay(): string | undefined {
  const today = todayInFirm();
  const date = new Date(`${today}T12:00:00Z`);
  const weekday = date.getUTCDay();
  if (weekday !== 0 && weekday !== 6) return undefined;
  date.setUTCDate(date.getUTCDate() + (weekday === 6 ? 2 : 1));
  return date.toISOString().slice(0, 10);
}

async function openTodayWithHearings(page: Page) {
  await signIn(page, LUCIA);
  const day = demoDay();
  if (day) await page.goto(`/?fecha=${day}`);
  await expect(page.getByRole("heading", { level: 1, name: /^Audiencias de/ })).toBeVisible();
}

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`today's hearings and the week of the firm (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openTodayWithHearings(page);

    // The seed puts several hearings on the demo day, two preventive prison reviews among them.
    await expect(page.getByText(/tenés \d+ audiencias/)).toBeVisible();
    const review = page.getByRole("article", { name: "Revisión de prisión preventiva" }).first();
    await expect(review).toBeVisible();
    await expect(review).toContainText("CPP art. 118");
    expect(await page.getByRole("article").count()).toBeGreaterThanOrEqual(3);
    // Two detainees have a deadline within 48 h: the agenda warns first.
    await expect(
      page.getByRole("region", { name: /\d+ avisos sobre personas detenidas/ }),
    ).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Semana", exact: true }).click();
    await expect(page).toHaveURL(/vista=semana/);
    await expect(
      page.getByRole("heading", { level: 1, name: /^Audiencias de (esta|la) semana$/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(7);
    // Hearings spread across the days of the week, not only one.
    const daysWithHearings = page
      .getByRole("region")
      .filter({ has: page.getByRole("heading", { level: 2 }) })
      .filter({ has: page.getByRole("article") });
    await expect.poll(() => daysWithHearings.count()).toBeGreaterThanOrEqual(2);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
}

test("the week filtered by another lawyer of the firm", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTodayWithHearings(page);
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(7);

  const lawyer = page.getByLabel("Abogado o abogada");
  await expect(lawyer.locator("option", { hasText: "Julián Muestra" })).toHaveCount(1);
  await lawyer.selectOption({ label: "Julián Muestra" });
  await expect(page).toHaveURL(/abogado=/);
  await expect(
    page.getByText(/^Julián Muestra tiene \d+ audiencias? (esta|esa) semana/),
  ).toBeVisible();

  await lawyer.selectOption({ label: "Mis audiencias" });
  await expect(page.getByText(/(Esta|Esa) semana tenés \d+ audiencias?/)).toBeVisible();
});
