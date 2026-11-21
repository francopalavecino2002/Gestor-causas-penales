import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderApp } from "@/test/render-app";

describe("HomePage", () => {
  it("shows the product name and the under-construction notice", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Gestor de causas penales" }),
    ).toBeInTheDocument();
    expect(screen.getByText("En construcción")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
