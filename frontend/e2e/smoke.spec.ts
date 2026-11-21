import { expect, test } from "@playwright/test";

test("home shows the placeholder in Spanish", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Gestor de causas penales");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
  await expect(
    page.getByRole("heading", { level: 1, name: "Gestor de causas penales" }),
  ).toBeVisible();
  await expect(page.getByText("En construcción")).toBeVisible();
});

test("serves a Spanish web app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "Gestor de causas penales", lang: "es-AR" });
});
