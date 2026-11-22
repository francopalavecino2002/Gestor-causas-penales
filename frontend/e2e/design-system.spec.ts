/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

test("style guide renders and switches theme", async ({ page }) => {
  await page.goto("/design-system");

  await expect(page.getByRole("heading", { level: 1, name: "Sistema de diseño" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Estados y etiquetas" })).toBeVisible();

  const html = page.locator("html");
  await page.getByText("Oscuro", { exact: true }).click();
  await expect(html).toHaveClass(/dark/);

  // The choice survives a reload and is applied before first paint.
  await page.reload();
  await expect(html).toHaveClass(/dark/);

  await page.getByText("Claro", { exact: true }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test("style guide follows the system theme by default", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/design-system");

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("radio", { name: "Según el sistema" })).toBeChecked();
  await context.close();
});

test("style guide fits a 360 px phone without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/design-system");

  await expect(page.getByRole("heading", { level: 1, name: "Sistema de diseño" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
