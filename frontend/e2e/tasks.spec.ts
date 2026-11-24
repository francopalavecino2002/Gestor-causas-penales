/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { FIXTURE_NOW, WEEK_HEARINGS } from "../src/test/agenda-fixtures";
import { ALL_TASKS, TASK_LEGAJO_COPY, TASK_REVIEW_BRIEF } from "../src/test/task-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

for (const viewport of [
  { name: "phone", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`${viewport.name}: a lawyer sees today's tasks, adds one and marks one done`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, { signedIn: true, hearings: WEEK_HEARINGS, tasks: ALL_TASKS });

    await page.goto("/");
    const today = page.getByRole("region", { name: "Tareas de hoy" });
    await expect(today.getByRole("checkbox", { name: TASK_REVIEW_BRIEF.title })).toBeVisible();
    await expect(today.getByText("Tenés 1 tarea vencida.")).toBeVisible();
    await today.getByRole("link", { name: "Mirá todas tus tareas" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Tareas" })).toBeVisible();
    const late = page.getByRole("article", { name: TASK_LEGAJO_COPY.title });
    await expect(late.getByText("Vencida")).toBeVisible();

    await page.getByRole("button", { name: "Nueva tarea" }).locator("visible=true").first().click();
    const dialog = page.getByRole("dialog", { name: "Nueva tarea" });
    await dialog.getByLabel("Qué hay que hacer").fill("Pedir el informe del registro");
    await dialog.getByLabel("Vence el").fill("2026-11-26");
    await dialog.getByRole("button", { name: "Guardá la tarea" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("article", { name: "Pedir el informe del registro" }),
    ).toContainText("Vence el jueves 26/11");

    await late.getByRole("checkbox").click();
    await expect(page.getByText(`«${TASK_LEGAJO_COPY.title}» quedó hecha.`)).toBeVisible();
    await expect(late).toBeHidden();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}

test("the five-item bottom nav fits a 360 px phone: no label is cut", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockBackend(page, { signedIn: true });
  await page.goto("/tareas");

  const nav = page.locator("nav.fixed").getByRole("link");
  await expect(nav).toHaveText(["Agenda", "Causas", "Plazos", "Tareas", "Personas"]);
  for (const link of await nav.all()) {
    // The label's box stays inside its link's box, and the text is not wider than the label.
    const fits = await link.evaluate((element) => {
      const label = element.querySelector("span:last-child");
      if (!(label instanceof HTMLElement)) return false;
      const outer = element.getBoundingClientRect();
      const inner = label.getBoundingClientRect();
      return (
        label.scrollWidth <= label.clientWidth + 1 &&
        inner.left >= outer.left &&
        inner.right <= outer.right
      );
    });
    expect(fits, (await link.textContent()) ?? "").toBe(true);
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
});
