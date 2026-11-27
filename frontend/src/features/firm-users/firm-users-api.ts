// Relative imports only: the shared fictitious backend (also used by the e2e mock,
// tsconfig.node.json) imports these types and has no "@/" alias.
import type { Role } from "../auth/auth-api";
import { apiFetch } from "../../lib/api";

/** A user of the firm as the owner sees them (backend `FirmUserController.FirmUserView`). */
export interface FirmUser {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  /** Still has a temporary password: has to choose their own at the next login. */
  passwordChangeRequired: boolean;
  archived: boolean;
  createdAt: string;
}

export interface NewFirmUser {
  displayName: string;
  email: string;
  role: Role;
}

/** Answered once: the owner hands the password over, the server never shows it again. */
export interface CreatedFirmUser {
  user: FirmUser;
  temporaryPassword: string;
}

const BASE = "/api/v1/firm/users";

/** Everyone in the firm, archived included, by name. Owner only. */
export function fetchFirmUsers(signal?: AbortSignal): Promise<FirmUser[]> {
  return apiFetch<FirmUser[]>(BASE, { signal });
}

export function createFirmUser(user: NewFirmUser): Promise<CreatedFirmUser> {
  return apiFetch<CreatedFirmUser>(BASE, { method: "POST", body: user });
}

/** Ends that user's sessions: they sign in again with the new role. */
export function changeFirmUserRole(id: string, role: Role): Promise<FirmUser> {
  return apiFetch<FirmUser>(`${BASE}/${id}/role`, { method: "PUT", body: { role } });
}

/** They can no longer sign in, and their open sessions end. Nothing is deleted. */
export function archiveFirmUser(id: string): Promise<FirmUser> {
  return apiFetch<FirmUser>(`${BASE}/${id}/archive`, { method: "POST" });
}

/** Access comes back with the password they had. */
export function restoreFirmUser(id: string): Promise<FirmUser> {
  return apiFetch<FirmUser>(`${BASE}/${id}/restore`, { method: "POST" });
}

/** Replaces their password with a temporary one, shown once, and ends their sessions. */
export function resetFirmUserPassword(id: string): Promise<{ temporaryPassword: string }> {
  return apiFetch<{ temporaryPassword: string }>(`${BASE}/${id}/password-reset`, {
    method: "POST",
  });
}
