import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("does not submit forms by default", () => {
    render(<Button>Guardá</Button>);

    expect(screen.getByRole("button", { name: "Guardá" })).toHaveAttribute("type", "button");
  });

  it("keeps an explicit submit type", () => {
    render(<Button type="submit">Ingresá</Button>);

    expect(screen.getByRole("button", { name: "Ingresá" })).toHaveAttribute("type", "submit");
  });

  it("renders its child without a type when used as a link", () => {
    render(
      <Button asChild>
        <a href="/agenda">Ver agenda</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Ver agenda" });
    expect(link).not.toHaveAttribute("type");
  });
});
