import type { BadgeVariant } from "@/components/ui/badge";

/** Codes of the `hearing-statuses` catalog (backend HearingRules), in OFIJU's words. */
export const HEARING_STATUSES = [
  "solicitada",
  "programada",
  "reprogramada",
  "efectiva",
  "reconvertida",
  "cuarto-intermedio",
  "suspendida",
  "cancelada",
] as const;

export type HearingStatus = (typeof HEARING_STATUSES)[number];

/**
 * Label and color tone of each status (DESIGN.md, Tokens). "Cuarto intermedio" uses the
 * reprogramada tone until a lawyer confirms how they read it [validar].
 */
export const HEARING_STATUS_DISPLAY: Record<
  HearingStatus,
  {
    label: string;
    tone: Extract<BadgeVariant, "programada" | "reprogramada" | "efectiva" | "suspendida">;
  }
> = {
  solicitada: { label: "Solicitada", tone: "programada" },
  programada: { label: "Programada", tone: "programada" },
  reprogramada: { label: "Reprogramada", tone: "reprogramada" },
  efectiva: { label: "Efectiva", tone: "efectiva" },
  reconvertida: { label: "Reconvertida", tone: "efectiva" },
  "cuarto-intermedio": { label: "Cuarto intermedio", tone: "reprogramada" },
  suspendida: { label: "Suspendida", tone: "suspendida" },
  cancelada: { label: "Cancelada", tone: "suspendida" },
};
