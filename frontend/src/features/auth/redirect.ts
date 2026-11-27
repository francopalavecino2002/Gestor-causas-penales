export const LOGIN_PATH = "/ingresar";

/** Messages the login shows on arrival, from `?aviso=`. */
export const LOGIN_NOTICES = {
  "contrasena-cambiada": "Listo. Ingresá con tu contraseña nueva.",
} as const;

export type LoginNotice = keyof typeof LOGIN_NOTICES;

export function parseLoginNotice(value: unknown): LoginNotice | undefined {
  return typeof value === "string" && Object.hasOwn(LOGIN_NOTICES, value)
    ? (value as LoginNotice)
    : undefined;
}

// Tabs and newlines are dropped by URL parsing, so "/\t/evil" would become "//evil".
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * The in-app path to open after signing in. Only same-origin paths are accepted, so a crafted
 * `?redirect=https://...` or `//evil.example` link cannot send the user elsewhere.
 */
export function safeRedirect(value: string | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    CONTROL_CHARACTERS.test(value)
  ) {
    return "/";
  }
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) return "/";
  return value;
}

/** Search params of the login that bring the user back to `href` (nothing for the home). */
export function loginSearchFor(href: string): { redirect?: string } {
  return href === "/" ? {} : { redirect: href };
}
