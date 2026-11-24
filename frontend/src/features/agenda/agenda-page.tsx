import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/me-query";
import {
  addDays,
  FIRM_TIME_ZONE,
  formatDayLabel,
  formatWeekLabel,
  todayIn,
  weekRange,
} from "@/features/agenda/agenda-dates";
import { agendaSummary, lawyerOptions, type AgendaScope } from "@/features/agenda/agenda-format";
import { useAgenda, useAgendaCache } from "@/features/agenda/agenda-queries";
import { viewMode, type AgendaSearch, type AgendaViewMode } from "@/features/agenda/agenda-search";
import { AgendaEmpty, AgendaError, AgendaSkeleton } from "@/features/agenda/agenda-states";
import { AgendaToolbar } from "@/features/agenda/agenda-toolbar";
import type { IsoDate } from "@/features/agenda/agenda-types";
import { DayRail } from "@/features/agenda/day-rail";
import { DetaineeAlerts } from "@/features/agenda/detainee-alerts";
import { hasModule } from "@/features/practice-areas/practice-area-format";
import { useNow } from "@/features/agenda/use-now";
import { WeekList } from "@/features/agenda/week-list";
import { localDay } from "@/features/agenda/agenda-dates";
import type { HearingDetail } from "@/features/hearings/hearing-api";
import { HearingEditContext } from "@/features/hearings/hearing-edit-context";
import { HearingFormDialog } from "@/features/hearings/hearing-form-dialog";
import { AreaFilter } from "@/features/practice-areas/area-filter";
import { useAreaDirectory } from "@/features/practice-areas/practice-area-queries";

/** Which hearing form is open: a new one, or the edit of one hearing. */
type HearingDialog = { mode: "new" } | { mode: "edit"; hearingId: string } | null;

function scopeOf(view: AgendaViewMode, from: IsoDate, to: IsoDate, today: IsoDate): AgendaScope {
  if (view === "semana") return from <= today && today <= to ? "esta semana" : "esa semana";
  if (from === today) return "hoy";
  if (from === addDays(today, 1)) return "mañana";
  return "ese día";
}

const TITLES: Record<AgendaScope, string> = {
  hoy: "Audiencias de hoy",
  mañana: "Audiencias de mañana",
  "ese día": "Audiencias del día",
  "esta semana": "Audiencias de esta semana",
  "esa semana": "Audiencias de la semana",
};

/**
 * Home: the hearing agenda (DESIGN.md, direction A). Day view on a rail with the "Ahora" line,
 * week view grouped by day. View, date and lawyer live in the URL (`?vista`, `?fecha`,
 * `?abogado`) so any view can be bookmarked or shared.
 */
export function AgendaPage({ search }: { search: AgendaSearch }) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const now = useNow();
  const cache = useAgendaCache();

  // "Today" in the zone the API last reported; the backend's default zone until it answers.
  const firmZone = cache.timeZone ?? FIRM_TIME_ZONE;
  const today = todayIn(firmZone, now);
  const view = viewMode(search);
  const anchor = search.fecha ?? today;
  const range = view === "semana" ? weekRange(anchor) : { from: anchor, to: anchor };
  const agenda = useAgenda({ ...range, lawyerId: search.abogado });
  const timeZone = agenda.data?.timeZone ?? firmZone;
  const scope = scopeOf(view, range.from, range.to, today);

  // `today` is the one of this render: useNow refreshes it every minute, so after midnight the
  // next render drops the new day from the URL instead of the old one.
  const go = (next: AgendaSearch) => {
    void navigate({
      to: "/",
      search: {
        vista: next.vista,
        fecha: next.fecha === today ? undefined : next.fecha,
        abogado: next.abogado,
        fuero: next.fuero,
      },
    });
  };
  const step = view === "semana" ? 7 : 1;
  const current = {
    vista: search.vista,
    fecha: anchor,
    abogado: search.abogado,
    fuero: search.fuero,
  };

  // The area filter only exists when the firm works in more than one; an area it no longer works
  // in is ignored. The agenda is one request per range, so the filter applies here.
  const directory = useAreaDirectory();
  const area = directory.multiple ? directory.find(search.fuero) : undefined;
  const items = (agenda.data?.items ?? []).filter(
    (item) => !area || item.practiceArea === area.code,
  );
  const meId = me?.id;
  const personal = !search.abogado || (meId !== undefined && search.abogado === meId);
  const otherLawyer = personal
    ? undefined
    : cache.lawyers.find((lawyer) => lawyer.id === search.abogado);

  const [dialog, setDialog] = useState<HearingDialog>(null);
  // After a new hearing, show its day (or its week) so the lawyer sees it in place.
  const showSaved = (hearing: HearingDetail) => {
    const day = localDay(hearing.startsAt, timeZone);
    const shown = view === "semana" ? range.from <= day && day <= range.to : day === anchor;
    if (!shown) go({ ...current, fecha: day });
  };
  const newHearingButton = (
    <Button onClick={() => setDialog({ mode: "new" })}>
      <Plus aria-hidden="true" />
      Cargá una audiencia
    </Button>
  );

  return (
    <HearingEditContext.Provider value={(hearingId) => setDialog({ mode: "edit", hearingId })}>
      <div className="grid gap-5 lg:flex lg:items-end lg:justify-between lg:gap-8">
        <header className="grid gap-1 lg:shrink-0">
          <p className="text-meta text-muted-foreground">
            {view === "semana" ? (
              formatWeekLabel(range.from, range.to)
            ) : (
              <time dateTime={anchor}>{formatDayLabel(anchor, { year: true })}</time>
            )}
          </p>
          <h1 className="text-display font-bold text-balance">{TITLES[scope]}</h1>
          <p aria-live="polite" className="text-body text-muted-foreground empty:hidden">
            {agenda.isSuccess && items.length > 0
              ? agendaSummary({
                  count: items.length,
                  detained: items.filter((item) => item.detainee).length,
                  scope,
                  lawyerName: personal ? undefined : (otherLawyer?.name ?? "Esa persona"),
                })
              : null}
          </p>
        </header>
        <div className="grid gap-4 lg:justify-items-end">
          <div className="hidden lg:block">{newHearingButton}</div>
          <AgendaToolbar
            view={view}
            onViewChange={(vista) =>
              go({ ...current, vista: vista === "semana" ? "semana" : undefined })
            }
            onPrevious={() => go({ ...current, fecha: addDays(anchor, -step) })}
            onToday={() => go({ ...current, fecha: undefined })}
            onNext={() => go({ ...current, fecha: addDays(anchor, step) })}
            lawyer={search.abogado ?? ""}
            lawyerOptions={lawyerOptions(meId, cache.lawyers, search.abogado)}
            onLawyerChange={(abogado) => go({ ...current, abogado: abogado || undefined })}
            filters={
              directory.multiple && (
                <AreaFilter
                  areas={directory.areas}
                  value={area?.code ?? ""}
                  onChange={(code) => go({ ...current, fuero: code || undefined })}
                  className="sm:w-56"
                />
              )
            }
          />
        </div>
      </div>

      {/* The alerts are about criminal defendants: an area without them filters them out. */}
      {(!area || hasModule(area.modules, "detainee-alerts")) && <DetaineeAlerts />}

      {agenda.isPending ? (
        <AgendaSkeleton />
      ) : agenda.isError ? (
        <AgendaError error={agenda.error} onRetry={() => void agenda.refetch()} />
      ) : items.length === 0 ? (
        <AgendaEmpty
          title={`${personal ? "No tenés" : "No hay"} audiencias ${area ? `de ${area.name} ` : ""}${scope}`}
          description={
            view === "semana"
              ? "Cuando cargues una audiencia o la Oficina Judicial fije una fecha, la vas a ver acá, en su día."
              : "Cuando cargues una audiencia o la Oficina Judicial fije una fecha, la vas a ver acá, en orden."
          }
        >
          <Button onClick={() => setDialog({ mode: "new" })}>
            <Plus aria-hidden="true" />
            Cargá una audiencia
          </Button>
          {view === "semana" ? (
            <Button variant="outline" onClick={() => go({ ...current, fecha: addDays(anchor, 7) })}>
              Mirá la semana siguiente
            </Button>
          ) : (
            <Button variant="outline" onClick={() => go({ ...current, vista: "semana" })}>
              Mirá toda la semana
            </Button>
          )}
          {search.abogado && (
            <Button variant="ghost" onClick={() => go({ ...current, abogado: undefined })}>
              Mirá todo el estudio
            </Button>
          )}
          {area && (
            <Button variant="ghost" onClick={() => go({ ...current, fuero: undefined })}>
              Mirá todos los fueros
            </Button>
          )}
        </AgendaEmpty>
      ) : view === "semana" ? (
        <WeekList
          from={range.from}
          to={range.to}
          items={items}
          timeZone={timeZone}
          today={today}
          lawyerId={search.abogado}
          areaCode={area?.code}
        />
      ) : (
        <div className="max-w-4xl">
          <DayRail items={items} timeZone={timeZone} now={now} isToday={anchor === today} />
        </div>
      )}

      {/* Phones and tablets: the labeled floating button above the bottom navigation, with room
          below the list so the last hearing can scroll clear of it. */}
      <div aria-hidden="true" className="h-16 lg:hidden" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom)+0.75rem)] z-30 flex justify-end px-4 sm:px-8 lg:hidden">
        <Button
          size="fab"
          className="pointer-events-auto"
          onClick={() => setDialog({ mode: "new" })}
        >
          <Plus aria-hidden="true" />
          Cargá una audiencia
        </Button>
      </div>

      {dialog?.mode === "new" && (
        <HearingFormDialog
          defaultDate={view === "semana" ? undefined : anchor}
          onClose={() => setDialog(null)}
          onSaved={showSaved}
        />
      )}
      {dialog?.mode === "edit" && (
        <HearingFormDialog hearingId={dialog.hearingId} onClose={() => setDialog(null)} />
      )}
    </HearingEditContext.Provider>
  );
}
