import { useId } from "react";
import { CircleAlert, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { LoadError } from "@/features/cases/case-states";
import { FLAG_LABELS } from "@/features/deadlines/deadline-format";
import { MODULE_LABELS } from "@/features/practice-areas/practice-area-format";
import {
  useAvailablePracticeAreas,
  useReplaceEnabledPracticeAreas,
} from "@/features/practice-areas/practice-area-queries";
import type { PracticeAreaOption } from "@/features/practice-areas/practice-area-types";
import { settingsErrorMessage } from "@/features/settings/settings-errors";
import { useAnnouncement, useCanEditSettings } from "@/features/settings/settings-hooks";
import { SavedStatus, SettingsPage } from "@/features/settings/settings-layout";
import { isApiError } from "@/lib/api";

function AreasSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando los fueros" className="grid gap-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid gap-2 rounded-xl border bg-card p-4">
          <Skeleton className="h-6 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/** What the area brings, in one line: its modules, or the generic course of a case. */
function AreaContents({ area }: { area: PracticeAreaOption }) {
  if (area.modules.length > 0) {
    return (
      <p className="text-meta">
        Incluye: {area.modules.map((module) => MODULE_LABELS[module]).join(", ")}.
      </p>
    );
  }
  return (
    <p className="text-meta">
      Cada causa lleva su propia etapa y estado, con las partes y sus roles (actor, demandado…). Sin
      plazos calculados: los cargás a mano como plazos judiciales.
    </p>
  );
}

function AreaRow({
  area,
  canEdit,
  lastOne,
  busy,
  onToggle,
}: {
  area: PracticeAreaOption;
  canEdit: boolean;
  /** The only area on: it cannot be turned off. */
  lastOne: boolean;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const nameId = useId();
  const switchId = useId();
  const hintId = useId();
  return (
    <li aria-labelledby={nameId} className="grid gap-3 px-4 py-4 sm:flex sm:items-start sm:gap-6">
      <div className="grid min-w-0 flex-1 gap-1.5">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span id={nameId} className="text-card-title font-bold">
            {area.name}
          </span>
          {area.flags.map((flag) => (
            <span key={flag} className="text-small font-bold whitespace-nowrap text-deadline">
              {FLAG_LABELS[flag]}
            </span>
          ))}
          {!canEdit && (
            <Badge variant={area.enabled ? "outline" : "neutral"}>
              {area.enabled ? "Habilitado" : "No habilitado"}
            </Badge>
          )}
        </p>
        <p className="text-meta text-muted-foreground">{area.law}</p>
        <AreaContents area={area} />
        {area.note && (
          <p className="flex max-w-prose items-start gap-2 text-small text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
            <span>{area.note}</span>
          </p>
        )}
      </div>
      {canEdit && (
        <div className="grid gap-1 sm:w-44 sm:shrink-0 sm:justify-items-end">
          <div className="flex min-h-11 items-center gap-3">
            <Switch
              id={switchId}
              checked={area.enabled}
              disabled={area.enabled && lastOne}
              // Stays focusable while a change is saving, so keyboard users keep their place.
              aria-disabled={busy || undefined}
              aria-describedby={area.enabled && lastOne ? hintId : undefined}
              onCheckedChange={(checked) => {
                if (!busy) onToggle(checked);
              }}
            />
            <Label htmlFor={switchId} className="cursor-pointer">
              <span className="sr-only">{area.name}: </span>
              {area.enabled ? "Habilitado" : "No habilitado"}
            </Label>
          </div>
          {area.enabled && lastOne && (
            <p id={hintId} className="text-small text-muted-foreground sm:text-right">
              Tiene que quedar al menos un fuero.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Why a change did not go through, naming the area when it still has cases. */
function changeError(error: unknown, areaName: string | undefined): string {
  if (isApiError(error) && error.type === "practice-area-in-use") {
    return `No podés deshabilitar ${areaName ?? "ese fuero"}: tiene causas activas. Archivalas primero o dejalo habilitado.`;
  }
  if (isApiError(error) && error.type === "invalid-practice-areas") {
    return "Tiene que quedar al menos un fuero habilitado, de los que trae tu jurisdicción.";
  }
  return settingsErrorMessage(error);
}

/**
 * `/ajustes/fueros`: the practice areas of the firm's jurisdiction package and which ones the
 * firm works in (ADR-0032). Every member sees them; only the owner turns them on and off. An
 * area with active cases stays on.
 */
export function PracticeAreasSection() {
  const canEdit = useCanEditSettings();
  const areas = useAvailablePracticeAreas();
  const replace = useReplaceEnabledPracticeAreas();
  const [message, announce] = useAnnouncement();
  const enabled = (areas.data ?? []).filter((area) => area.enabled);
  const changing = areas.data?.find((area) => area.code === replace.variables?.changed);

  const toggle = (area: PracticeAreaOption, on: boolean) => {
    announce(null);
    const codes = on
      ? [...enabled.map((item) => item.code), area.code]
      : enabled.map((item) => item.code).filter((code) => code !== area.code);
    replace.mutate(
      { codes, changed: area.code },
      {
        onSuccess: () =>
          announce(on ? `Habilitado: ${area.name}.` : `Deshabilitado: ${area.name}.`),
      },
    );
  };

  return (
    <SettingsPage
      section="/ajustes/fueros"
      intro="Los fueros en los que trabaja tu estudio. Cada uno trae sus etapas, tipos de audiencia y roles; al cargar una causa elegís el fuero entre los habilitados."
    >
      {areas.isPending ? (
        <AreasSkeleton />
      ) : areas.isError ? (
        <LoadError
          title="No pudimos cargar los fueros"
          error={areas.error}
          onRetry={() => void areas.refetch()}
        />
      ) : (
        <div className="grid max-w-3xl gap-4">
          <SavedStatus message={message} />
          {replace.isError && (
            <Alert variant="error" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>No pudimos guardar el cambio</AlertTitle>
              <AlertDescription>{changeError(replace.error, changing?.name)}</AlertDescription>
            </Alert>
          )}
          <ul aria-label="Fueros" className="divide-y rounded-xl border bg-card">
            {areas.data.map((area) => (
              <AreaRow
                key={area.code}
                area={area}
                canEdit={canEdit}
                lastOne={enabled.length === 1}
                busy={replace.isPending}
                onToggle={(on) => toggle(area, on)}
              />
            ))}
          </ul>
          <p className="flex max-w-prose items-start gap-2 text-small text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
            <span>
              Deshabilitar un fuero no borra nada: sus causas archivadas se siguen viendo. Un fuero
              con causas activas no se puede deshabilitar.
            </span>
          </p>
        </div>
      )}
    </SettingsPage>
  );
}
