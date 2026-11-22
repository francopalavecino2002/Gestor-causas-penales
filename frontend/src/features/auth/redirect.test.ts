import { describe, expect, it } from "vitest";

import { loginSearchFor, safeRedirect } from "@/features/auth/redirect";

describe("safeRedirect", () => {
  it.each([
    ["/causas", "/causas"],
    ["/causas?estado=abierta#lista", "/causas?estado=abierta#lista"],
  ])("keeps the in-app path %s", (value, expected) => {
    expect(safeRedirect(value)).toBe(expected);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["absolute URL", "https://evil.example/x"],
    ["protocol-relative URL", "//evil.example/x"],
    ["backslash trick", "/\\evil.example/x"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path", "causas"],
    ["tab before slash", "/\t/evil.example"],
    ["newline before slash", "/\n/evil.example"],
    ["the login itself", "/ingresar"],
    ["the login with params", "/ingresar?estudio=estudio-demo"],
  ])("falls back to the home for a %s", (_case, value) => {
    expect(safeRedirect(value)).toBe("/");
  });
});

describe("loginSearchFor", () => {
  it("adds no redirect for the home and keeps any other page", () => {
    expect(loginSearchFor("/")).toEqual({});
    expect(loginSearchFor("/plazos?dias=7")).toEqual({ redirect: "/plazos?dias=7" });
  });
});
