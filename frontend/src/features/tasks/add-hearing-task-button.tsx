import { ListPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatShortDayLabel, formatTime, localDay } from "@/features/agenda/agenda-dates";
import { useTaskQuickAdd } from "@/features/tasks/task-quick-add-context";

/**
 * "Sumá una tarea" on a hearing card: opens "Nueva tarea" linked to the hearing (and so to its
 * case). Renders nothing where the screen offers no task form.
 */
export function AddHearingTaskButton({
  hearing,
  timeZone,
}: {
  hearing: { id: string; typeName: string; startsAt: string };
  timeZone: string;
}) {
  const quickAdd = useTaskQuickAdd();
  if (!quickAdd) return null;
  const when = `${formatShortDayLabel(localDay(hearing.startsAt, timeZone))} a las ${formatTime(hearing.startsAt, timeZone)}`;
  return (
    <Button
      variant="ghost"
      className="px-2 text-primary"
      aria-label={`Sumá una tarea para la audiencia ${hearing.typeName}`}
      onClick={() =>
        quickAdd({
          hearingId: hearing.id,
          context: `Para la audiencia ${hearing.typeName} del ${when}.`,
        })
      }
    >
      <ListPlus aria-hidden="true" />
      Sumá una tarea
    </Button>
  );
}
