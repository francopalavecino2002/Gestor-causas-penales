import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  CalendarClock,
  CalendarPlus,
  ClipboardCheck,
  Folder,
  FolderInput,
  FolderPlus,
  MessageSquareText,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { HEARING_STATUS_DISPLAY, type HearingStatus } from "@/components/hearing/hearing-status";
import { Button } from "@/components/ui/button";
import { localDay } from "@/features/agenda/agenda-dates";
import {
  actorName,
  bulkOpenedSentence,
  newsSentence,
  timeLabel,
  type NewsEntry,
} from "@/features/news/news-format";
import type { NewsItem, NewsKind } from "@/features/news/news-types";
import { cn } from "@/lib/utils";

/** A link inside the wall's text: primary, underlined (same as the tasks' links). */
export const NEWS_LINK_CLASS = "text-primary underline underline-offset-4 hover:decoration-2";

const KIND_ICONS: Record<NewsKind, LucideIcon> = {
  CASE_OPENED: FolderPlus,
  HEARING_SCHEDULED: CalendarPlus,
  HEARING_RESCHEDULED: CalendarClock,
  HEARING_RESULT: ClipboardCheck,
  POST: MessageSquareText,
};

/** Status tones for the hearing entries; the rest sit on the quiet accent. */
const TONE_CLASSES = {
  accent: "bg-accent text-accent-foreground",
  post: "bg-secondary text-secondary-foreground",
  programada: "bg-status-programada-soft text-status-programada",
  reprogramada: "bg-status-reprogramada-soft text-status-reprogramada",
  efectiva: "bg-status-efectiva-soft text-status-efectiva",
  suspendida: "bg-status-suspendida-soft text-status-suspendida",
} as const;

function toneOf(item: NewsItem): keyof typeof TONE_CLASSES {
  switch (item.kind) {
    case "CASE_OPENED":
      return "accent";
    case "POST":
      return "post";
    case "HEARING_SCHEDULED":
      return "programada";
    case "HEARING_RESCHEDULED":
      return "reprogramada";
    case "HEARING_RESULT": {
      const status = item.hearing?.statusCode;
      return status && status in HEARING_STATUS_DISPLAY
        ? HEARING_STATUS_DISPLAY[status as HearingStatus].tone
        : "programada";
    }
  }
}

/** The round icon of an entry. Decorative: the sentence says what happened. */
export function EntryIcon({
  entry,
  size = "md",
}: {
  entry: NewsEntry;
  size?: "sm" | "md";
}) {
  const Icon = entry.kind === "bulk" ? FolderInput : KIND_ICONS[entry.item.kind];
  const tone = entry.kind === "bulk" ? "accent" : toneOf(entry.item);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "md" ? "size-10" : "size-8",
        TONE_CLASSES[tone],
      )}
    >
      <Icon className={size === "md" ? "size-5" : "size-4.5"} />
    </span>
  );
}

/** "10:05" or "Hace 15 minutos", with the full instant for machines. */
export function EntryTime({
  occurredAt,
  now,
  timeZone,
  withDay = false,
}: {
  occurredAt: string;
  now: Date;
  timeZone: string;
  withDay?: boolean;
}) {
  return (
    <time dateTime={occurredAt} className="tabular-nums">
      {timeLabel(occurredAt, now, timeZone, { withDay })}
    </time>
  );
}

/** The case of an entry, on its own line: the folder and its caption as a link. */
export function CaseLine({ caseId, caption }: { caseId: string; caption: string }) {
  return (
    <p className="flex min-w-0 items-start gap-2 text-meta">
      <Folder aria-hidden="true" className="mt-0.75 size-4.5 shrink-0 text-muted-foreground" />
      <span className="sr-only">Causa:</span>
      <Link to="/causas/$caseId" params={{ caseId }} className={cn(NEWS_LINK_CLASS, "break-words")}>
        {caption}
      </Link>
    </p>
  );
}

/** One row of the wall's timeline: the icon on the rail, then what happened. */
function TimelineRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="group relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3.5 pb-6 last:pb-0">
      {/* The rail joins the icons of the day; it stops at the last one. */}
      <span
        aria-hidden="true"
        className="absolute top-12 bottom-2 left-5 w-0.5 -translate-x-1/2 bg-border group-last:hidden"
      />
      {icon}
      <div className="grid min-w-0 content-start gap-1.5 pt-0.5">{children}</div>
    </li>
  );
}

function EventEntry({
  item,
  now,
  timeZone,
  meId,
}: {
  item: NewsItem;
  now: Date;
  timeZone: string;
  meId: string | undefined;
}) {
  const hearingDay = item.hearing ? localDay(item.hearing.startsAt, timeZone) : null;
  return (
    <TimelineRow icon={<EntryIcon entry={{ kind: "item", item }} />}>
      <p className="text-small text-muted-foreground">
        <EntryTime occurredAt={item.occurredAt} now={now} timeZone={timeZone} />
      </p>
      <p className="text-body text-pretty">{newsSentence(item, timeZone, meId)}</p>
      {item.caseLink && <CaseLine caseId={item.caseLink.id} caption={item.caseLink.caption} />}
      {hearingDay && (
        <p className="text-meta">
          <Link to="/" search={{ fecha: hearingDay }} className={NEWS_LINK_CLASS}>
            Mirá ese día en la agenda
          </Link>
        </p>
      )}
    </TimelineRow>
  );
}

function BulkEntry({
  entry,
  now,
  timeZone,
  meId,
}: {
  entry: Extract<NewsEntry, { kind: "bulk" }>;
  now: Date;
  timeZone: string;
  meId: string | undefined;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [first] = entry.items;
  if (!first) return null;
  return (
    <TimelineRow icon={<EntryIcon entry={entry} />}>
      <p className="text-small text-muted-foreground">
        <EntryTime occurredAt={first.occurredAt} now={now} timeZone={timeZone} />
      </p>
      <p className="text-body text-pretty">
        {bulkOpenedSentence(entry.actor, entry.items.length, meId)}
      </p>
      <Button
        variant="link"
        className="-mx-1 justify-self-start px-1"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Ocultá las causas" : `Mirá las ${entry.items.length} causas`}
      </Button>
      <ul id={listId} hidden={!open} className="grid gap-1.5">
        {entry.items.map((item) =>
          item.caseLink ? (
            <li key={item.id}>
              <CaseLine caseId={item.caseLink.id} caption={item.caseLink.caption} />
            </li>
          ) : null,
        )}
      </ul>
    </TimelineRow>
  );
}

/**
 * A post: who wrote it, when, and the text as written (plain text: React escapes it, and line
 * breaks are kept). Its author or the owner can archive it; once archived it stays in place as
 * "Archivaste esta publicación" with "Deshacé" until the wall is read again.
 */
function PostEntry({
  item,
  now,
  timeZone,
  meId,
  archived,
  busy,
  onArchive,
  onRestore,
}: {
  item: NewsItem;
  now: Date;
  timeZone: string;
  meId: string | undefined;
  archived: boolean;
  busy: boolean;
  onArchive: (item: NewsItem) => void;
  onRestore: (item: NewsItem) => void;
}) {
  const archiveRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  /** Set while an archive or undo the user started is in flight: its button is disabled. */
  const awaitingFocus = useRef(false);

  // Once the request settles, focus the button now on screen: "Deshacé" after an archive, "Archivá"
  // after an undo, or the same button again when the request failed and nothing changed.
  useEffect(() => {
    if (busy || !awaitingFocus.current) return;
    awaitingFocus.current = false;
    (archived ? undoRef : archiveRef).current?.focus();
  }, [archived, busy]);

  const post = item.post;
  if (!post) return null;
  const author = item.actor ? actorName(item.actor) : "El sistema";
  const mine = item.actor !== null && item.actor.id === meId;

  return (
    <TimelineRow icon={<EntryIcon entry={{ kind: "item", item }} />}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-small text-muted-foreground">
        <span className="text-body font-bold text-foreground">{mine ? `${author} (vos)` : author}</span>
        <EntryTime occurredAt={item.occurredAt} now={now} timeZone={timeZone} />
      </p>
      {archived ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed border-border-strong py-1 pr-1 pl-4 text-meta">
          <p className="min-w-0 flex-1 py-2 text-muted-foreground">Archivaste esta publicación.</p>
          <Button
            ref={undoRef}
            variant="ghost"
            className="px-3 text-primary"
            disabled={busy}
            onClick={() => {
              awaitingFocus.current = true;
              onRestore(item);
            }}
          >
            <Undo2 aria-hidden="true" />
            Deshacé
          </Button>
        </div>
      ) : (
        <div className="grid gap-1 rounded-xl border bg-card px-4 pt-3 pb-3.5">
          <p className="text-body break-words whitespace-pre-line">{post.body}</p>
          {post.canArchive && (
            <Button
              ref={archiveRef}
              variant="ghost"
              className="-mx-2 -mb-2 justify-self-start px-2 text-primary"
              aria-label={`Archivá la publicación de ${author}`}
              disabled={busy}
              onClick={() => {
                awaitingFocus.current = true;
                onArchive(item);
              }}
            >
              <Archive aria-hidden="true" />
              Archivá
            </Button>
          )}
        </div>
      )}
    </TimelineRow>
  );
}

/** One entry of the wall's timeline, whatever its kind. */
export function NewsTimelineEntry({
  entry,
  now,
  timeZone,
  meId,
  archivedPosts,
  busyPost,
  onArchive,
  onRestore,
}: {
  entry: NewsEntry;
  now: Date;
  timeZone: string;
  meId: string | undefined;
  archivedPosts: ReadonlySet<string>;
  busyPost: string | null;
  onArchive: (item: NewsItem) => void;
  onRestore: (item: NewsItem) => void;
}) {
  if (entry.kind === "bulk") {
    return <BulkEntry entry={entry} now={now} timeZone={timeZone} meId={meId} />;
  }
  const { item } = entry;
  if (item.kind === "POST" && item.post) {
    return (
      <PostEntry
        item={item}
        now={now}
        timeZone={timeZone}
        meId={meId}
        archived={archivedPosts.has(item.post.id)}
        busy={busyPost === item.post.id}
        onArchive={onArchive}
        onRestore={onRestore}
      />
    );
  }
  return <EventEntry item={item} now={now} timeZone={timeZone} meId={meId} />;
}
