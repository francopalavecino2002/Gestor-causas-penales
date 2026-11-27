// Relative imports only: the e2e mock backend (tsconfig.node.json) uses this file too.
import type { Role } from "../features/auth/auth-api";
import type { FirmUser } from "../features/firm-users/firm-users-api";

/** Same id as DEMO_ME: the signed-in owner. */
export const OWNER_ID = "00000000-0000-4000-8000-000000000001";

/** Made-up temporary passwords, handed out in this order (the real ones are random). */
export const TEMPORARY_PASSWORDS = [
  "abcd-EFGH-2345-wxyz",
  "mnpq-RSTU-6789-vwxy",
  "hjkm-NPQR-3467-stuv",
];

const user = (
  fields: Partial<FirmUser> & Pick<FirmUser, "id" | "displayName" | "email" | "role">,
) =>
  ({
    twoFactorEnabled: false,
    passwordChangeRequired: false,
    archived: false,
    createdAt: "2026-03-02T12:00:00Z",
    ...fields,
  }) satisfies FirmUser;

/** The fictitious firm's people, by name as the backend lists them. */
export const FIRM_USERS: FirmUser[] = [
  user({
    id: "00000000-0000-4000-8000-000000000003",
    displayName: "Hugo Prueba",
    email: "hugo.prueba@ejemplo.test",
    role: "LAWYER",
    twoFactorEnabled: true,
  }),
  user({
    id: OWNER_ID,
    displayName: "Lucía Ejemplo",
    email: "lucia.ejemplo@example.com",
    role: "OWNER",
    twoFactorEnabled: true,
  }),
  user({
    id: "00000000-0000-4000-8000-000000000002",
    displayName: "Paula Demo",
    email: "paula.demo@ejemplo.test",
    role: "LAWYER",
  }),
  user({
    id: "00000000-0000-4000-8000-000000000005",
    displayName: "Sofía Muestra",
    email: "sofia.muestra@ejemplo.test",
    role: "ADMIN_STAFF",
    archived: true,
  }),
  user({
    id: "00000000-0000-4000-8000-000000000004",
    displayName: "Tomás Muestra",
    email: "tomas.muestra@ejemplo.test",
    role: "PARALEGAL",
    passwordChangeRequired: true,
  }),
];

export interface FirmUserAnswer {
  status: number;
  json?: unknown;
  /** Problem type, e.g. "user-duplicate-email". */
  problem?: string;
}

const ROLES: Role[] = ["OWNER", "LAWYER", "PARALEGAL", "ADMIN_STAFF"];

/**
 * `/api/v1/firm/users` with state, like FirmUserService: owner only, duplicate emails refused, the
 * owner never changes their own account, the firm always keeps an active owner, nobody is deleted.
 */
export function firmUsersBackend(
  initial: FirmUser[] = FIRM_USERS,
  options: { role?: string; actorId?: string } = {},
) {
  const users: FirmUser[] = structuredClone(initial);
  const actorId = options.actorId ?? OWNER_ID;
  let issued = 0;
  let next = 100;

  const sorted = () =>
    [...users].sort(
      (a, b) => a.displayName.localeCompare(b.displayName, "es") || a.id.localeCompare(b.id),
    );
  const nextPassword = () => TEMPORARY_PASSWORDS[issued++ % TEMPORARY_PASSWORDS.length]!;
  const activeOwners = () =>
    users.filter((candidate) => candidate.role === "OWNER" && !candidate.archived);
  const isLastOwner = (target: FirmUser) =>
    target.role === "OWNER" && !target.archived && activeOwners().length === 1;

  const answer = (
    method: string,
    path: string,
    body: () => unknown,
  ): FirmUserAnswer | undefined => {
    if (!path.startsWith("/api/v1/firm/users")) return undefined;
    if ((options.role ?? "OWNER") !== "OWNER") return { status: 403, problem: "access-denied" };

    if (path === "/api/v1/firm/users") {
      if (method === "GET") return { status: 200, json: sorted() };
      if (method !== "POST") return undefined;
      const request = body() as { displayName?: string; email?: string; role?: Role };
      const email = request.email?.trim().toLowerCase() ?? "";
      if (!request.displayName?.trim() || !email.includes("@") || !ROLES.includes(request.role!)) {
        return { status: 400, problem: "invalid-user-data" };
      }
      if (users.some((candidate) => candidate.email === email)) {
        return { status: 409, problem: "user-duplicate-email" };
      }
      const created = user({
        id: `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`,
        displayName: request.displayName.trim(),
        email,
        role: request.role!,
        passwordChangeRequired: true,
        createdAt: "2026-11-23T13:20:00Z",
      });
      users.push(created);
      return { status: 201, json: { user: created, temporaryPassword: nextPassword() } };
    }

    const match = /^\/api\/v1\/firm\/users\/([^/]+)\/(role|archive|restore|password-reset)$/.exec(
      path,
    );
    if (!match) return undefined;
    const [, id, action] = match;
    if (id === actorId) return { status: 409, problem: "own-account" };
    const target = users.find((candidate) => candidate.id === id);
    if (!target) return { status: 404, problem: "not-found" };

    switch (`${method} ${action}`) {
      case "PUT role": {
        const { role } = body() as { role: Role };
        if (role !== "OWNER" && isLastOwner(target)) return { status: 409, problem: "last-owner" };
        target.role = role;
        return { status: 200, json: target };
      }
      case "POST archive":
        if (isLastOwner(target)) return { status: 409, problem: "last-owner" };
        target.archived = true;
        return { status: 200, json: target };
      case "POST restore":
        target.archived = false;
        return { status: 200, json: target };
      case "POST password-reset":
        target.passwordChangeRequired = true;
        return { status: 200, json: { temporaryPassword: nextPassword() } };
      default:
        return undefined;
    }
  };

  return { answer, users };
}
