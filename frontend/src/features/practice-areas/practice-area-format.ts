import type { PracticeArea, PracticeModule } from "@/features/practice-areas/practice-area-types";

/** The area every firm starts with, and the one a record without an area belongs to. */
export const DEFAULT_AREA = "penal";

/** Whether a case (or an area) has the module; a list that has not loaded has none. */
export function hasModule(
  modules: readonly PracticeModule[] | undefined,
  module: PracticeModule,
): boolean {
  return modules?.includes(module) ?? false;
}

/**
 * The area a new record starts in: the default one when the firm works in it, else the first
 * enabled one; the default while the list loads or if it failed.
 */
export function initialArea(areas: PracticeArea[]): string {
  if (areas.some((area) => area.code === DEFAULT_AREA)) return DEFAULT_AREA;
  return areas[0]?.code ?? DEFAULT_AREA;
}

/** A draft area: flagged as a whole until a lawyer reviews it. */
export function isDraftArea(area: Pick<PracticeArea, "flags">): boolean {
  return area.flags.length > 0;
}

/** What a module adds, in the lawyer's words, for the settings screen. */
export const MODULE_LABELS: Record<PracticeModule, string> = {
  defendants: "Imputados, cada uno con su etapa",
  "coercive-measures": "Medidas de coerción",
  "detainee-alerts": "Alertas de personas detenidas",
  "alternative-outcomes": "Salidas alternativas",
  "mpf-legajo": "Legajo del MPF, OFIJU y Pehuén",
};
