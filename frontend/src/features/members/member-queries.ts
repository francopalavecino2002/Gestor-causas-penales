import { queryOptions, useQuery } from "@tanstack/react-query";

import type { Role } from "@/features/auth/auth-api";
import { fetchFirmMembers, type FirmMember } from "@/features/members/member-api";

/** Same rule as the backend (CasePermissions.canBeResponsible). */
export const RESPONSIBLE_ROLES: readonly Role[] = ["OWNER", "LAWYER"];

export function canBeResponsible(member: Pick<FirmMember, "role">): boolean {
  return RESPONSIBLE_ROLES.includes(member.role);
}

/** The firm's members change rarely: one fetch per few minutes is plenty for the forms. */
export const firmMembersQueryOptions = queryOptions({
  queryKey: ["firm-members"] as const,
  queryFn: ({ signal }) => fetchFirmMembers(signal),
  staleTime: 5 * 60_000,
});

export function useFirmMembers() {
  return useQuery(firmMembersQueryOptions);
}
