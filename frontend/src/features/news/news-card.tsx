import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { Hourglass, Lock, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth/me-query";
import { EntryIcon, EntryTime, NEWS_LINK_CLASS } from "@/features/news/news-entry";
import {
  bulkOpenedSentence,
  collapseBulk,
  dueSoonCount,
  newsSentence,
  type NewsEntry,
} from "@/features/news/news-format";
import { useNewsPreview } from "@/features/news/news-queries";
import { cn } from "@/lib/utils";

/** How many of the latest entries the card asks for. */
export const NEWS_CARD_SIZE = 5;

function CompactEntry({
  entry,
  now,
  timeZone,
  meId,
}: {
  entry: NewsEntry;
  now: Date;
  timeZone: string;
  meId: string | undefined;
}) {
  const item = entry.kind === "bulk" ? entry.items[0] : entry.item;
  if (!item) return null;
  const sentence =
    entry.kind === "bulk"
      ? bulkOpenedSentence(entry.actor, entry.items.length, meId)
      : newsSentence(item, timeZone, meId);
  return (
    <li className="flex items-start gap-3 py-1">
      <EntryIcon entry={entry} size="sm" />
      <div className="grid min-w-0 gap-0.5">
        <p className="text-meta text-pretty">
          {sentence}
          {entry.kind === "item" && item.post && (
            <span className="line-clamp-2 break-words whitespace-pre-line text-muted-foreground">
              {item.post.body}
            </span>
          )}
        </p>
        {entry.kind === "item" && item.caseLink && (
          <Link
            to="/causas/$caseId"
            params={{ caseId: item.caseLink.id }}
            className="justify-self-start text-meta break-words text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            {item.caseLink.caption}
          </Link>
        )}
        <p className="text-small text-muted-foreground">
          <EntryTime occurredAt={item.occurredAt} now={now} timeZone={timeZone} withDay />
        </p>
      </div>
    </li>
  );
}

/**
 * The agenda home's "Novedades": how many deadlines are due soon (and whether a detained client
 * is among them), the latest entries of the wall, and the way to all of it. A failure here never
 * blocks the agenda.
 */
export function NewsCard({
  now,
  timeZone,
  className,
}: {
  now: Date;
  timeZone: string;
  className?: string;
}) {
  const titleId = useId();
  const { data: me } = useMe();
  const preview = useNewsPreview(NEWS_CARD_SIZE);

  const entries = collapseBulk(preview.data?.items ?? []);
  const dueSoon = preview.data?.dueSoon ?? [];
  const detained = dueSoon.filter((alert) => alert.detainee).length;

  let body;
  if (preview.isPending) {
    body = (
      <div
        role="status"
        aria-busy="true"
        aria-label="Cargando las novedades"
        className="grid gap-2"
      >
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-6 w-3/5" />
      </div>
    );
  } else if (preview.isError) {
    body = (
      <div role="alert" className="grid justify-items-start gap-1">
        <p className="text-meta">No pudimos cargar las novedades.</p>
        <Button variant="outline" onClick={() => void preview.refetch()}>
          Volvé a intentar
        </Button>
      </div>
    );
  } else if (entries.length === 0) {
    body = (
      <p className="text-meta text-muted-foreground">Todavía no hay novedades en el estudio.</p>
    );
  } else {
    body = (
      <ul aria-label="Últimas novedades" className="grid gap-1.5">
        {entries.map((entry) => (
          <CompactEntry
            key={entry.kind === "bulk" ? `bulk-${entry.items[0]?.id}` : entry.item.id}
            entry={entry}
            now={now}
            timeZone={timeZone}
            meId={me?.id}
          />
        ))}
      </ul>
    );
  }

  return (
    <Card asChild className={cn("gap-3", className)}>
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className="flex items-center gap-2 text-title font-bold">
          <Newspaper aria-hidden="true" className="size-5.5 text-primary" />
          Novedades
        </h2>
        {dueSoon.length > 0 && (
          <div className="grid gap-0.5 text-meta font-semibold">
            <p>
              <Link
                to="/novedades"
                className="-my-1 inline-flex min-h-11 items-center gap-2 text-deadline underline underline-offset-4 hover:decoration-2"
              >
                <Hourglass aria-hidden="true" className="size-5 shrink-0" />
                {dueSoonCount(dueSoon.length)}.
              </Link>
            </p>
            {detained > 0 && (
              <p className="flex items-center gap-2 text-detained">
                <Lock aria-hidden="true" className="size-5 shrink-0" />
                {dueSoon.length === 1
                  ? "Es de una persona detenida."
                  : detained === 1
                    ? "Uno es de una persona detenida."
                    : `${detained} son de personas detenidas.`}
              </p>
            )}
          </div>
        )}
        {body}
        <Link
          to="/novedades"
          className={cn(
            NEWS_LINK_CLASS,
            "-my-1 inline-flex min-h-11 items-center justify-self-start text-meta font-semibold",
          )}
        >
          Mirá todas las novedades
        </Link>
      </section>
    </Card>
  );
}
