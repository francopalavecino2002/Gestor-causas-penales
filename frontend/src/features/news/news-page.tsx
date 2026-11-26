import { useId, useState, type ReactNode } from "react";
import { CircleAlert, LoaderCircle, Newspaper } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FIRM_TIME_ZONE, todayIn } from "@/features/agenda/agenda-dates";
import { useAgendaCache } from "@/features/agenda/agenda-queries";
import { useNow } from "@/features/agenda/use-now";
import { useMe } from "@/features/auth/me-query";
import { CasesEmpty, LoadError } from "@/features/cases/case-states";
import { NewsComposer } from "@/features/news/news-composer";
import { NewsDueSoon } from "@/features/news/news-due-soon";
import { NewsTimelineEntry } from "@/features/news/news-entry";
import {
  dayHeading,
  groupNewsByDay,
  uniqueById,
  type NewsDay,
} from "@/features/news/news-format";
import { useNewsFeed, useSetPostArchived } from "@/features/news/news-queries";
import type { NewsItem } from "@/features/news/news-types";
import { isApiError, NETWORK_ERROR } from "@/lib/api";

function archiveError(error: unknown, archiving: boolean): string {
  const what = archiving ? "archivó" : "restauró";
  if (isApiError(error)) {
    if (error.type === NETWORK_ERROR) {
      return `No hay conexión con el servidor, así que no se ${what} la publicación. Revisá tu conexión y volvé a intentar.`;
    }
    if (error.status === 403) {
      return "Solo quien escribió la publicación o la persona titular del estudio pueden archivarla.";
    }
    if (error.status === 404) {
      return "Ya no encontramos esa publicación. Recargá la página para ver el muro al día.";
    }
  }
  return `El servidor no respondió como esperábamos y no se ${what} la publicación. Volvé a intentar en unos minutos.`;
}

export function NewsSkeleton({ label = "Cargando las novedades" }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid gap-6">
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid grid-cols-[2.5rem_1fr] gap-x-3.5">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid gap-2 pt-0.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DaySection({
  group,
  today,
  children,
}: {
  group: NewsDay;
  today: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      {/* Sticky under the top bar on phones and tablets, as the agenda's week days. */}
      <header className="sticky top-below-top-bar z-10 -mx-4 border-b bg-background px-4 py-2 sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-b-0 lg:px-0 lg:py-0">
        <h2 id={headingId} className="text-title font-bold">
          <time dateTime={group.day}>{dayHeading(group.day, today)}</time>
        </h2>
      </header>
      <ol className="grid">{children}</ol>
    </section>
  );
}

/**
 * `/novedades`: the firm's wall (T49, ADR-0039; the API is ADR-0038). What is due soon first, then a box to tell the
 * firm something, then what happened, newest first and grouped by day: cases opened, hearings
 * scheduled, moved or with a result, and posts. A post is archived (never deleted) with "Deshacé".
 */
export function NewsPage() {
  const { data: me } = useMe();
  const now = useNow();
  const timeZone = useAgendaCache().timeZone ?? FIRM_TIME_ZONE;
  const today = todayIn(timeZone, now);
  const feed = useNewsFeed();
  const setPostArchived = useSetPostArchived();
  const composerId = useId();

  const [archived, setArchived] = useState<ReadonlySet<string>>(new Set());
  const [busyPost, setBusyPost] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleArchived = async (item: NewsItem, archive: boolean) => {
    const postId = item.post?.id;
    if (!postId) return;
    setBusyPost(postId);
    setError(null);
    setAnnouncement("");
    try {
      await setPostArchived.mutateAsync({ postId, archived: archive });
      setArchived((current) => {
        const next = new Set(current);
        if (archive) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setAnnouncement(
        archive
          ? "Archivaste la publicación. Si fue sin querer, tocá Deshacé."
          : "La publicación volvió al muro.",
      );
    } catch (failure) {
      setError(archiveError(failure, archive));
    } finally {
      setBusyPost(null);
    }
  };

  const pages = feed.data?.pages ?? [];
  const items = uniqueById(pages.flatMap((page) => page.items));
  const dueSoon = pages[0]?.dueSoon ?? [];
  const days = groupNewsByDay(items, timeZone);

  let wall;
  if (feed.isPending) {
    wall = <NewsSkeleton />;
  } else if (feed.isError) {
    wall = (
      <LoadError
        title="No pudimos cargar las novedades"
        error={feed.error}
        onRetry={() => void feed.refetch()}
      />
    );
  } else if (items.length === 0 && !feed.hasNextPage) {
    // The total can count entries the backend then leaves out (a case that became reserved), so a
    // page can come back empty while more remain: then the wall shows "Mirá más novedades".
    wall = (
      <CasesEmpty
        title="Todavía no hay novedades"
        description="Acá vas a ver las causas nuevas, las audiencias que se cargan o se mueven y sus resultados, apenas pasen. Mientras tanto, contale algo al estudio."
        icon={Newspaper}
      >
        <Button onClick={() => document.getElementById(composerId)?.focus()}>
          Escribí la primera
        </Button>
      </CasesEmpty>
    );
  } else {
    wall = (
      <div className="grid gap-8">
        {days.map((group) => (
          <DaySection key={group.day} group={group} today={today}>
            {group.entries.map((entry) => (
              <NewsTimelineEntry
                key={entry.kind === "bulk" ? `bulk-${entry.items[0]?.id}` : entry.item.id}
                entry={entry}
                now={now}
                timeZone={timeZone}
                meId={me?.id}
                archivedPosts={archived}
                busyPost={busyPost}
                onArchive={(target) => void toggleArchived(target, true)}
                onRestore={(target) => void toggleArchived(target, false)}
              />
            ))}
          </DaySection>
        ))}
        {feed.hasNextPage && (
          <Button
            variant="outline"
            className="justify-self-start"
            disabled={feed.isFetchingNextPage}
            onClick={() => void feed.fetchNextPage()}
          >
            {feed.isFetchingNextPage && (
              <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            Mirá más novedades
          </Button>
        )}
        {feed.isFetchNextPageError && (
          <p role="alert" className="flex items-start gap-2 text-meta font-semibold text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            No pudimos traer más novedades. Volvé a tocar «Mirá más novedades».
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Novedades">
        <p>Lo que pasó en el estudio y lo que vence pronto.</p>
      </PageHeader>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Phones: due soon, the box, the wall. From 1280 px the deadlines move to the right column. */}
      <div className="grid gap-7 xl:grid-cols-with-aside xl:items-start xl:gap-x-10">
        <NewsDueSoon
          alerts={dueSoon}
          timeZone={timeZone}
          className="xl:sticky xl:top-10 xl:col-start-2 xl:row-start-1"
        />
        <div className="grid min-w-0 max-w-3xl gap-7 xl:col-start-1 xl:row-start-1">
          <NewsComposer
            textareaId={composerId}
            onPosted={() => {
              setError(null);
              setAnnouncement("Publicaste la novedad.");
            }}
          />
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-meta font-semibold text-destructive"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <span className="flex-1">{error}</span>
            </p>
          )}
          {wall}
        </div>
      </div>
    </>
  );
}
