import type { Role } from "@/features/auth/auth-api";

/** How each role reads in the UI. Gender-inclusive with "/a", as firms write it. */
export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Titular",
  LAWYER: "Abogado/a",
  PARALEGAL: "Procurador/a",
  ADMIN_STAFF: "Administrativo/a",
};
