import { Building, UserCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PersonKind } from "@/features/persons/person-api";
import { PERSON_KIND_LABELS } from "@/features/persons/person-format";

/** The person has a client record in the firm. */
export function ClientBadge() {
  return (
    <Badge variant="outline">
      <UserCheck aria-hidden="true" />
      Cliente
    </Badge>
  );
}

/** The kind's icon: a person, or a building for a legal entity. */
export function PersonKindIcon({ kind, className }: { kind: PersonKind; className?: string }) {
  const Icon = kind === "LEGAL" ? Building : UserRound;
  return <Icon aria-hidden="true" className={className} />;
}

/** "Persona jurídica" in words, for a legal entity; humans are the default and say nothing. */
export function LegalEntityBadge({ kind }: { kind: PersonKind }) {
  if (kind !== "LEGAL") return null;
  return (
    <Badge variant="neutral">
      <Building aria-hidden="true" />
      {PERSON_KIND_LABELS.LEGAL}
    </Badge>
  );
}
