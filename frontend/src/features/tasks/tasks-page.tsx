import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ListChecks, Plus } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FIRM_TIME_ZONE, todayIn } from "@/features/agenda/agenda-dates";
import { useAgendaCache } from "@/features/agenda/agenda-queries";
import { useNow } from "@/features/agenda/use-now";
import { useMe } from "@/features/auth/me-query";
import { CasesEmpty } from "@/features/cases/case-states";
import type { FirmMember } from "@/features/members/member-api";
import { useFirmMembers } from "@/features/members/member-queries";
import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import { tasksSummary } from "@/features/tasks/task-format";
import { TaskList } from "@/features/tasks/task-list";
import { useTaskCount } from "@/features/tasks/task-queries";
import type { TaskSearch } from "@/features/tasks/task-search";
import type { TaskFilter } from "@/features/tasks/task-types";
import { cn } from "@/lib/utils";

type Who = "mine" | "person";

/** "Mías / Por persona": toggle buttons, since each one changes the URL. */
function WhoSwitch({ who, onChange }: { who: Who; onChange: (who: Who) => void }) {
  const labelId = useId();
  const options: { value: Who; label: string }[] = [
    { value: "mine", label: "Mías" },
    { value: "person", label: "Por persona" },
  ];
  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="text-meta font-semibold">
        Ver
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="inline-flex w-fit rounded-lg border bg-secondary p-0.75"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={who === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-meta font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-fast ease-out hover:text-foreground focus-visible:-outline-offset-3",
              "aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-segment",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function byName(members: FirmMember[]): FirmMember[] {
  return [...members].sort((a, b) => a.displayName.localeCompare(b.displayName, "es-AR"));
}

/**
 * Whose tasks the screen talks about, for its sentences: undefined for the user's own ("Tenés"),
 * else the member's name ("Paula Demo tiene"), or "Esa persona" for one no longer in the firm.
 */
function otherPersonName(
  personId: string | undefined,
  meId: string | undefined,
  person: FirmMember | undefined,
): string | undefined {
  if (!personId || personId === meId) return undefined;
  return person?.displayName ?? "Esa persona";
}

/**
 * `/tareas`: the tasks per responsible (T47). The user's own by default ("Mías"), or one
 * member's (`?persona`); pending ones unless `?hechas=si`. Overdue first, then the soonest due
 * day, as the backend orders them.
 */
export function TasksPage({ search }: { search: TaskSearch }) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const members = useFirmMembers();
  const now = useNow();
  const timeZone = useAgendaCache().timeZone ?? FIRM_TIME_ZONE;
  const today = todayIn(timeZone, now);
  const switchId = useId();
  const personId = useId();
  const [adding, setAdding] = useState(false);

  const who: Who = search.persona ? "person" : "mine";
  const showDone = search.hechas === "si";
  const sorted = byName(members.data ?? []);
  const person = sorted.find((member) => member.id === search.persona);
  const personName = otherPersonName(search.persona, me?.id, person);

  const go = (next: TaskSearch) => void navigate({ to: "/tareas", search: next });
  const chooseWho = (next: Who) => {
    if (next === "mine") return go({ ...search, persona: undefined });
    if (search.persona) return;
    // The first colleague by name; the user themself in a firm of one.
    const first = sorted.find((member) => member.id !== me?.id) ?? sorted[0];
    go({ ...search, persona: first?.id ?? me?.id });
  };

  const responsible: TaskFilter = search.persona
    ? { responsible: search.persona }
    : { scope: "mine" };
  const filter: TaskFilter = showDone ? responsible : { ...responsible, status: "PENDING" };
  const pending = useTaskCount({ ...responsible, status: "PENDING" });
  const overdue = useTaskCount({ ...responsible, overdue: true });

  const emptyTitle = personName
    ? `${personName} no tiene tareas${showDone ? "" : " pendientes"}`
    : `No tenés tareas${showDone ? "" : " pendientes"}`;

  return (
    <>
      <div className="grid gap-5 lg:flex lg:items-end lg:justify-between lg:gap-8">
        <PageHeader title="Tareas">
          <p aria-live="polite" className="empty:hidden">
            {pending.isSuccess && overdue.isSuccess
              ? tasksSummary({ pending: pending.data, overdue: overdue.data, personName })
              : null}
          </p>
        </PageHeader>
        <div className="hidden lg:block">
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Nueva tarea
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <WhoSwitch who={who} onChange={chooseWho} />
        {who === "person" && (
          <div className="grid w-full gap-1.5 sm:w-64">
            <Label htmlFor={personId}>Persona</Label>
            <Select
              id={personId}
              value={search.persona}
              disabled={members.isPending}
              onChange={(event) => go({ ...search, persona: event.target.value })}
            >
              {!person && search.persona && <option value={search.persona}>Esa persona</option>}
              {sorted.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.id === me?.id ? `${member.displayName} (vos)` : member.displayName}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex min-h-11 items-center gap-3">
          <Switch
            id={switchId}
            checked={showDone}
            onCheckedChange={(checked) => go({ ...search, hechas: checked ? "si" : undefined })}
          />
          <Label htmlFor={switchId} className="cursor-pointer">
            Mostrá las hechas
          </Label>
        </div>
      </div>

      {/* Same reading width as the day rail: a task is a line or two, not a table row. */}
      <div className="max-w-4xl">
        <TaskList
          filter={filter}
          today={today}
          timeZone={timeZone}
          showResponsible={false}
          keepPreviousWhileLoading
          loadingLabel="Cargando las tareas"
          errorTitle="No pudimos cargar las tareas"
          empty={
            <CasesEmpty
              title={emptyTitle}
              description={
                personName
                  ? "Cuando alguien le asigne una tarea, la vas a ver acá con su fecha y su causa."
                  : "Anotá lo que hay que hacer en cada causa o audiencia, con fecha y responsable, y marcalo cuando esté hecho."
              }
              icon={ListChecks}
            >
              <Button onClick={() => setAdding(true)}>
                <Plus aria-hidden="true" />
                {personName ? "Asignale una tarea" : "Nueva tarea"}
              </Button>
              {!showDone && (
                <Button variant="outline" onClick={() => go({ ...search, hechas: "si" })}>
                  Mostrá las hechas
                </Button>
              )}
            </CasesEmpty>
          }
        />
      </div>

      {/* Phones and tablets: the labeled floating button above the bottom navigation. */}
      <div aria-hidden="true" className="h-16 lg:hidden" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom)+0.75rem)] z-30 flex justify-end px-4 sm:px-8 lg:hidden">
        <Button size="fab" className="pointer-events-auto" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          Nueva tarea
        </Button>
      </div>

      {adding && (
        <TaskFormDialog defaultResponsible={search.persona} onClose={() => setAdding(false)} />
      )}
    </>
  );
}
