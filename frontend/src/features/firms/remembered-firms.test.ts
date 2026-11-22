import { describe, expect, it, vi } from "vitest";

import {
  findRememberedFirm,
  forgetFirm,
  readRememberedFirms,
  rememberFirm,
  REMEMBERED_FIRMS_KEY,
} from "@/features/firms/remembered-firms";

const firm = (n: number) => ({
  slug: `estudio-${n}`,
  name: `Estudio Ficticio ${n}`,
  lastEmail: `persona${n}@example.com`,
});

describe("remembered firms", () => {
  it("puts the last firm first, without duplicates, and keeps five", () => {
    for (let n = 1; n <= 6; n++) rememberFirm(firm(n));
    rememberFirm({ ...firm(3), lastEmail: "otra@example.com" });

    const slugs = readRememberedFirms().map((item) => item.slug);
    expect(slugs).toEqual(["estudio-3", "estudio-6", "estudio-5", "estudio-4", "estudio-2"]);
    expect(findRememberedFirm("ESTUDIO-3 ")?.lastEmail).toBe("otra@example.com");
  });

  it("stores only slug, name and email", () => {
    rememberFirm({ ...firm(1), password: "nunca" } as ReturnType<typeof firm>);

    expect(JSON.parse(window.localStorage.getItem(REMEMBERED_FIRMS_KEY) ?? "")).toEqual([firm(1)]);
  });

  it("forgets one firm", () => {
    rememberFirm(firm(1));
    rememberFirm(firm(2));

    forgetFirm("estudio-1");

    expect(readRememberedFirms()).toEqual([firm(2)]);
  });

  it("reads corrupted or blocked storage as an empty list", () => {
    window.localStorage.setItem(REMEMBERED_FIRMS_KEY, "{not json");
    expect(readRememberedFirms()).toEqual([]);

    window.localStorage.setItem(REMEMBERED_FIRMS_KEY, JSON.stringify([{ slug: 1 }, firm(1)]));
    expect(readRememberedFirms()).toEqual([firm(1)]);

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readRememberedFirms()).toEqual([]);
    expect(() => rememberFirm(firm(2))).not.toThrow();
    vi.restoreAllMocks();
  });
});
