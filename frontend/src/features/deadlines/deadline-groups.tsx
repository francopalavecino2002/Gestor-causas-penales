import { useId } from "react";
import {
  CalendarX,
  CircleAlert,
  CircleCheck,
  CirclePause,
  Hourglass,
  type LucideIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { DeadlineCard } from "@/features/deadlines/deadline-card";
import {
  countDeadlines,
  GROUP_TITLES,
  groupDeadlines,
  type DeadlineGroup,
} from "@/features/deadlines/deadline-format";
import type { DeadlineStatus, DeadlineView } from "@/features/deadlines/deadline-types";
import { cn } from "@/lib/utils";

const GROUP_ICONS: Record<DeadlineStatus, LucideIcon> = {
  OVERDUE: CircleAlert,
  DUE_SOON: Hourglass,
  RUNNING: Hourglass,
  NOT_CALCULABLE: CalendarX,
  SUSPENDED: CirclePause,
  MET: CircleCheck,
};

/** One line under the groups that need it, so the lawyer knows what they are looking at. */
const GROUP_NOTES: Partial<Record<DeadlineStatus, string>> = {
  OVERDUE: "Ya terminaron y no figuran como cumplidos. Revisá cada uno en su causa.",
  NOT_CALCULABLE: "Falta el calendario judicial para contarlos: contalos a mano con la norma.",
  SUSPENDED: "Una suspensión cargada en la causa los detuvo.",
};

function Group({
  group,
  timeZone,
  headingLevel,
  showCase,
  columns,
}: {
  group: DeadlineGroup;
  timeZone: string;
  headingLevel: "h2" | "h3";
  showCase: boolean;
  columns: boolean;
}) {
  const headingId = useId();
  const Heading = headingLevel;
  const Icon = GROUP_ICONS[group.status];
  const note = GROUP_NOTES[group.status];
  const urgent = group.status === "OVERDUE" || group.status === "DUE_SOON";
  return (
    <section aria-labelledby={headingId} className="grid content-start gap-3">
      <div className="grid gap-0.5">
        <Heading
          id={headingId}
          className={cn(
            "flex flex-wrap items-baseline gap-x-2.5 font-bold",
            headingLevel === "h2" ? "text-title" : "text-card-title",
          )}
        >
          <span className="inline-flex items-center gap-2 self-center">
            <Icon
              aria-hidden="true"
              className={cn("size-5 shrink-0", urgent ? "text-deadline" : "text-muted-foreground")}
            />
            {GROUP_TITLES[group.status]}
          </span>
          <span className="text-meta font-semibold text-muted-foreground">
            {countDeadlines(group.items.length)}
          </span>
        </Heading>
        {note && <p className="max-w-prose text-meta text-muted-foreground">{note}</p>}
      </div>
      <ol className={cn("grid gap-3.5", columns && "xl:grid-cols-2")}>
        {group.items.map((deadline) => (
          <li key={deadline.id} className="grid">
            <DeadlineCard
              deadline={deadline}
              timeZone={timeZone}
              headingLevel={headingLevel === "h2" ? "h3" : "h4"}
              showCase={showCase}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Deadlines grouped by urgency (Vencidos, Vencen pronto, Próximos, Sin calcular, Suspendidos,
 * Cumplidos), people deprived of liberty first inside each group. Empty groups are left out.
 */
export function DeadlineGroups({
  deadlines,
  timeZone,
  headingLevel = "h2",
  showCase = true,
  columns = true,
}: {
  deadlines: DeadlineView[];
  timeZone: string;
  /** `h2` on the deadlines screen; `h3` inside the case's "Plazos" section. */
  headingLevel?: "h2" | "h3";
  showCase?: boolean;
  /** Two columns of cards from 1280 px. */
  columns?: boolean;
}) {
  return (
    <div className="grid gap-7">
      {groupDeadlines(deadlines).map((group) => (
        <Group
          key={group.status}
          group={group}
          timeZone={timeZone}
          headingLevel={headingLevel}
          showCase={showCase}
          columns={columns}
        />
      ))}
    </div>
  );
}

/** The shape of a few deadline cards while they load. */
export function DeadlinesSkeleton({
  count = 3,
  label = "Cargando los plazos",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid gap-3.5">
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid gap-2.5 rounded-xl border bg-card px-4 pt-3.5 pb-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
