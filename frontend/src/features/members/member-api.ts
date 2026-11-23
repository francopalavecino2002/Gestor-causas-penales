import type { Role } from "@/features/auth/auth-api";
import { apiFetch } from "@/lib/api";

/** An active member of the firm (backend `FirmMemberController.MemberView`). */
export interface FirmMember {
  id: string;
  displayName: string;
  role: Role;
}

/** The firm's active members, by name. */
export function fetchFirmMembers(signal?: AbortSignal): Promise<FirmMember[]> {
  return apiFetch<FirmMember[]>("/api/v1/users", { signal });
}
