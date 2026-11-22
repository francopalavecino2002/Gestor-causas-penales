import { Archive, EyeOff, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { countDetainees } from "@/features/cases/case-format";
import { cn } from "@/lib/utils";

/** Only its team sees a reserved case: say so wherever the case shows. */
export function ReservedBadge() {
  return (
    <Badge variant="outline">
      <EyeOff aria-hidden="true" />
      Reservada
    </Badge>
  );
}

export function ArchivedBadge() {
  return (
    <Badge variant="neutral">
      <Archive aria-hidden="true" />
      Archivada
    </Badge>
  );
}

/** Red, with the lock and the count: people deprived of liberty matter most. */
export function DetaineeBadge({ count, className }: { count: number; className?: string }) {
  return (
    <Badge variant="detained" className={cn("whitespace-normal", className)}>
      <Lock aria-hidden="true" />
      {countDetainees(count)}
    </Badge>
  );
}
