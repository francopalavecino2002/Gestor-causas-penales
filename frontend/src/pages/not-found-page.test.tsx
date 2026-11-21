import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderApp } from "@/test/render-app";

describe("NotFoundPage", () => {
  it("explains the page does not exist and links back home", async () => {
    renderApp("/no-existe");

    expect(
      await screen.findByRole("heading", { level: 1, name: "No encontramos esta página" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });
});
