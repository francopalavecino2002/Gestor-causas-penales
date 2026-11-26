import { reviewTags } from "@/features/catalogs/catalog-format";
import type { FeeInstance, FeeMinimum, FeeRole, FeeScaleView } from "@/features/fees/fee-types";

const MONEY = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PLAIN = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/**
 * "$ 94.963,25": dot for thousands, comma for cents, as in Argentina. A no-break space keeps the
 * sign with the number when a sentence wraps.
 */
export function formatPesos(value: number): string {
  return `$\u00a0${MONEY.format(value)}`;
}

/** "10" or "11,23": JUS with up to two decimals. */
export function formatJus(value: number): string {
  return PLAIN.format(value);
}

/** "11" or "7,7" for a percentage. */
export function formatPercent(value: number): string {
  return PLAIN.format(value);
}

/** "01/07/2026" from "2026-07-01". */
export function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split("-");
  return `${day}/${month}/${year}`;
}

/** "JUS de $ 94.963,25, vigente desde el 01/07/2026". */
export function jusSentence(jus: { value: number; validFrom: string }): string {
  return `JUS de ${formatPesos(jus.value)}, vigente desde el ${formatDay(jus.validFrom)}`;
}

/** "$ 949.632,50 a $ 1.139.559,00", or one amount when both ends are the same. */
export function formatRange(from: number, to: number | null): string {
  if (to === null || from === to) return formatPesos(from);
  return `${formatPesos(from)} a ${formatPesos(to)}`;
}

/** "Entre 10 y 12 JUS", or "10 JUS". */
export function formatJusRange(from: number, to: number): string {
  if (from === to) return `${formatJus(from)} JUS`;
  return `Entre ${formatJus(from)} y ${formatJus(to)} JUS`;
}

/**
 * Pesos as a lawyer types them: dots for thousands, a comma for cents ("1.500.000,50"). Spaces
 * and a leading "$" are ignored. Returns null when it is not a number with at most two decimals.
 */
export function parsePesos(text: string): number | null {
  const cleaned = text.replace(/[\s$]/g, "");
  if (!/^\d{1,3}(\.?\d{3})*(,\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** The digits before the decimal comma, to check the backend's limits. */
export function integerDigits(value: number): number {
  return Math.trunc(Math.abs(value)).toString().length;
}

/** What the amount field shows once the lawyer leaves it: "1500000" becomes "1.500.000,00". */
export function formatPesosInput(text: string): string {
  const value = parsePesos(text);
  return value === null ? text : MONEY.format(value);
}

/** "Pedido de excarcelación: 10 JUS (art. 9, I) [validar]", for an <option>. */
export function minimumOptionLabel(minimum: FeeMinimum): string {
  const tags = reviewTags(minimum.flags);
  return [`${minimum.name}: ${formatJus(minimum.jus)} JUS (${minimum.article})`, tags]
    .filter(Boolean)
    .join(" ");
}

export interface MinimumGroup {
  /** Area code, or "" for the minimums of every area. */
  area: string;
  label: string;
  minimums: FeeMinimum[];
}

/**
 * The minimums by practice area, for <optgroup>s: one group per enabled area (only the areas the
 * firm works in, or just `filter` when given), then the ones that apply to every area.
 */
export function groupMinimums(
  minimums: FeeMinimum[],
  areas: { code: string; name: string }[],
  filter: string,
): MinimumGroup[] {
  const shown = filter ? areas.filter((area) => area.code === filter) : areas;
  const groups: MinimumGroup[] = shown.map((area) => ({
    area: area.code,
    label: area.name,
    minimums: minimums.filter((minimum) => minimum.areas.includes(area.code)),
  }));
  groups.push({
    area: "",
    label: "Para todos los fueros",
    minimums: minimums.filter((minimum) => minimum.areas.length === 0),
  });
  return groups.filter((group) => group.minimums.length > 0);
}

export const ROLE_LABELS: Record<FeeRole, string> = {
  SPONSOR: "Patrocinante",
  ATTORNEY: "Apoderado (procurador)",
  SPONSOR_AND_ATTORNEY: "Apoderado y patrocinante",
};

export const INSTANCE_LABELS: Record<FeeInstance, string> = {
  FIRST: "Primera instancia",
  APPEAL: "Segunda instancia",
  APPEAL_FULLY_REVOKED: "Segunda, con todo revocado",
};

/** One line under each role, from the scale: "40% del patrocinante (art. 10)". */
export function roleHint(role: FeeRole, scale: FeeScaleView | undefined): string {
  if (role === "SPONSOR") return "El honorario base.";
  if (!scale) return "";
  if (role === "ATTORNEY") {
    return `El ${formatPercent(scale.procurador.factor * 100)}% de lo del patrocinante (${scale.procurador.article}).`;
  }
  return `Cobrás los dos: el ${formatPercent(scale.sponsorAndAttorney.factor * 100)}% (${scale.sponsorAndAttorney.article}).`;
}

/** One line under each instance, from the scale: "Del 25% al 35% de lo de primera (art. 15)". */
export function instanceHint(instance: FeeInstance, scale: FeeScaleView | undefined): string {
  if (instance === "FIRST") return "Lo regulado en primera.";
  if (!scale) return "";
  const { appeal } = scale;
  if (instance === "APPEAL") {
    return `Del ${formatPercent(appeal.minPercent)}% al ${formatPercent(appeal.maxPercent)}% de lo de primera (${appeal.article}).`;
  }
  return `El ${formatPercent(appeal.fullyRevokedPercent)}% de lo de primera, si se revocó todo a favor del apelante (${appeal.article}).`;
}
