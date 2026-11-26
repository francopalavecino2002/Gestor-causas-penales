import type { Role } from "@/features/auth/auth-api";
import { useMe } from "@/features/auth/me-query";

/** Who enters, archives and restores a JUS value; the backend enforces the same rule (403). */
export const JUS_MANAGER_ROLES: readonly Role[] = ["OWNER", "LAWYER"];

/** The signed-in layout already awaited `me`, so `false` never flashes for a manager. */
export function useCanManageJus(): boolean {
  const { data: me } = useMe();
  return me ? JUS_MANAGER_ROLES.includes(me.role) : false;
}
