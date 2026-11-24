import { CalendarPlus, CircleAlert, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hearingIcsErrorMessage } from "@/features/calendar-feed/calendar-feed-errors";
import { useHearingIcsDownload } from "@/features/calendar-feed/calendar-feed-queries";
import { cn } from "@/lib/utils";

/**
 * "Agregá al calendario": downloads the hearing as `audiencia.ics`, which Google Calendar,
 * Outlook and the iPhone open to add one event. Meant for a wrapping row of card actions: a
 * failure shows below the row, on a line of its own.
 */
export function AddToCalendarButton({
  hearingId,
  typeName,
  className,
}: {
  hearingId: string;
  /** Names the hearing for screen readers, as the other card actions do. */
  typeName: string;
  className?: string;
}) {
  const download = useHearingIcsDownload();
  return (
    <>
      <Button
        variant="ghost"
        className={cn("px-2 text-primary", className)}
        aria-label={`Agregá al calendario la audiencia ${typeName}`}
        disabled={download.isPending}
        onClick={() => download.mutate(hearingId)}
      >
        {download.isPending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <CalendarPlus aria-hidden="true" />
        )}
        Agregá al calendario
      </Button>
      {download.isError && (
        <p
          role="alert"
          className="flex basis-full items-start gap-2 px-2 pb-2 text-meta font-semibold text-destructive"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span>{hearingIcsErrorMessage(download.error)}</span>
        </p>
      )}
    </>
  );
}
