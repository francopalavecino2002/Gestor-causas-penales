import { Badge } from "@/components/ui/badge";
import { HEARING_STATUS_DISPLAY, type HearingStatus } from "@/components/hearing/hearing-status";

/** The OFIJU status of a hearing, with its word and its tone. */
export function HearingStatusBadge({
  status,
  className,
}: {
  status: HearingStatus;
  className?: string;
}) {
  const { label, tone } = HEARING_STATUS_DISPLAY[status];
  return (
    <Badge variant={tone} data-status={status} className={className}>
      {label}
    </Badge>
  );
}
