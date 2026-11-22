import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps a product font size next to a text color", () => {
    expect(cn("text-meta", "text-primary")).toBe("text-meta text-primary");
  });

  it("lets a later product font size win over an earlier one", () => {
    expect(cn("text-small", "text-body")).toBe("text-body");
  });
});
