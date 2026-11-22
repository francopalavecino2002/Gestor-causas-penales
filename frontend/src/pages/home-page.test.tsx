import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { signedIn } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

describe("HomePage", () => {
  it("shows today's agenda frame inside the shell", async () => {
    signedIn();
    renderApp("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { level: 1 }));
  });
});
