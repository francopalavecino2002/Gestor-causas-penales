/*
 * The fees scale (a subset of jurisdictions/neuquen/fees.yml, ADR-0040) and fictitious JUS values
 * for the Vitest suite and the Playwright mock backend. The demo JUS value comes from
 * docs/domain/honorarios-neuquen.md and stays flagged [validar]. Relative imports only: the e2e
 * project (tsconfig.node.json) has no "@/" alias.
 */
import type {
  CalculationRequest,
  FeeCalculation,
  FeeMinimum,
  FeeScaleView,
  FeeStep,
  JusValueView,
} from "../features/fees/fee-types";

const OLD_PROCEDURE =
  "El texto usa el procedimiento escrito anterior (sumario y plenario). Validar cómo se aplica hoy en el proceso acusatorio.";

const minimum = (
  code: string,
  name: string,
  jus: number,
  article: string,
  areas: string[] = [],
  note: string | null = null,
): FeeMinimum => ({ code, name, jus, article, flags: ["validar"], note, areas });

export const MIN_CONOCIMIENTO = minimum("conocimiento", "Procesos de conocimiento", 10, "art. 9");
export const MIN_EXCARCELACION = minimum(
  "excarcelacion-pedido",
  "Pedido de excarcelación",
  10,
  "art. 9, I",
  ["penal"],
);
export const MIN_DEFENSA_PLENARIO = minimum(
  "defensa-criminal-plenario",
  "Juicio criminal, plenario: defensa (absorbe el sumario)",
  40,
  "art. 9, I, 16",
  ["penal"],
  OLD_PROCEDURE,
);
export const MIN_DIVORCIO = minimum("divorcio", "Divorcio", 60, "art. 9, I", ["familia"]);
export const MIN_INFORMACION = minimum(
  "informacion-sumaria",
  "Informaciones sumarias",
  10,
  "art. 9, I",
  ["civil", "laboral", "familia"],
);

export const FEE_SCALE: FeeScaleView = {
  law: "Ley 1594",
  source: "https://ejur.com.ar/normas/neuquen/ley-1594/",
  jusSource: "https://www.jusneuquen.gov.ar/valor-jus/",
  disclaimer: "Cálculo asistido: verificá con la norma",
  scale: {
    article: "art. 7",
    minPercent: 11,
    maxPercent: 20,
    losingPartyFloorFactor: 0.7,
    flags: ["validar"],
  },
  procurador: { article: "art. 10", factor: 0.4, flags: ["validar"] },
  sponsorAndAttorney: { article: "art. 10", factor: 1.4, flags: ["validar"] },
  appeal: {
    article: "art. 15",
    minPercent: 25,
    maxPercent: 35,
    fullyRevokedPercent: 35,
    flags: ["validar"],
  },
  minimums: [
    MIN_CONOCIMIENTO,
    minimum("ejecucion", "Procesos de ejecución", 7, "art. 9"),
    minimum("penal-general", "Procesos correccionales o penales", 10, "art. 9", ["penal"]),
    MIN_DIVORCIO,
    MIN_INFORMACION,
    MIN_EXCARCELACION,
    minimum("eximicion-pedido", "Pedido de eximición de prisión", 10, "art. 9, I", ["penal"]),
    MIN_DEFENSA_PLENARIO,
  ],
};

/** The demo value [validar: confirmá el valor vigente en la fuente], and an older fictitious one. */
export const JUS_JULY: JusValueView = {
  id: "00000000-0000-4000-c000-000000000702",
  value: 94963.25,
  validFrom: "2026-07-01",
  archived: false,
  createdAt: "2026-07-02T12:00:00Z",
};
export const JUS_MARCH: JusValueView = {
  id: "00000000-0000-4000-c000-000000000301",
  value: 81250,
  validFrom: "2026-03-01",
  archived: false,
  createdAt: "2026-03-03T12:00:00Z",
};
/** A typo the firm archived. */
export const JUS_TYPO: JusValueView = {
  id: "00000000-0000-4000-c000-000000000303",
  value: 8125,
  validFrom: "2026-03-01",
  archived: true,
  createdAt: "2026-03-02T12:00:00Z",
};

export const ALL_JUS_VALUES: JusValueView[] = [JUS_JULY, JUS_MARCH, JUS_TYPO];

const cents = (value: number) => Math.round(value * 100) / 100;
const money = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pesos = (value: number) => `$ ${money.format(value)}`;
const plain = (value: number) => new Intl.NumberFormat("es-AR").format(value);
const day = (iso: string) => iso.split("-").reverse().join("/");

/** The same steps as the backend's FeeCalculator, for the fake backends. */
export function calculationFor(
  scale: FeeScaleView,
  request: CalculationRequest,
  jus: { value: number; validFrom: string },
): FeeCalculation | undefined {
  const chosen = scale.minimums.find((candidate) => candidate.code === request.minimumCode);
  if (!chosen) return undefined;
  const steps: FeeStep[] = [];
  const minPesos = chosen.jus * jus.value;
  let low = minPesos;
  let high = minPesos;

  if (request.amount !== null) {
    const minPercent = request.clientLostEntirely
      ? scale.scale.minPercent * scale.scale.losingPartyFloorFactor
      : scale.scale.minPercent;
    low = (request.amount * minPercent) / 100;
    high = (request.amount * scale.scale.maxPercent) / 100;
    const reason = request.clientLostEntirely ? ", porque tu cliente perdió todo" : "";
    steps.push({
      description: `Escala sobre el monto de ${pesos(request.amount)}: del ${plain(minPercent)}% al ${plain(scale.scale.maxPercent)}%${reason}`,
      article: scale.scale.article,
      amount: cents(low),
      amountTo: cents(high),
    });
  }
  steps.push({
    description: `Mínimo de ${plain(chosen.jus)} JUS (${chosen.name}) por el valor del JUS de ${pesos(jus.value)}, vigente desde el ${day(jus.validFrom)}`,
    article: chosen.article,
    amount: cents(minPesos),
    amountTo: null,
  });
  if (request.amount === null) {
    steps.push({
      description: "Sin monto, el honorario es el mínimo",
      article: chosen.article,
      amount: cents(minPesos),
      amountTo: null,
    });
  } else if (low < minPesos || high < minPesos) {
    low = Math.max(low, minPesos);
    high = Math.max(high, minPesos);
    steps.push({
      description: "Lo que quedaba por debajo del mínimo se eleva al mínimo",
      article: chosen.article,
      amount: cents(low),
      amountTo: cents(high),
    });
  }
  if (request.role !== "SPONSOR") {
    const factor = request.role === "ATTORNEY" ? scale.procurador : scale.sponsorAndAttorney;
    low *= factor.factor;
    high *= factor.factor;
    steps.push({
      description:
        request.role === "ATTORNEY"
          ? `Como apoderado (procurador) cobrás el ${plain(factor.factor * 100)}% del honorario del patrocinante`
          : `Como apoderado y patrocinante a la vez cobrás el ${plain(factor.factor * 100)}% (100% + ${plain(factor.factor * 100 - 100)}%)`,
      article: factor.article,
      amount: cents(low),
      amountTo: cents(high),
    });
  }
  if (request.instance !== "FIRST") {
    const revoked = request.instance === "APPEAL_FULLY_REVOKED";
    const lowPercent = revoked ? scale.appeal.fullyRevokedPercent : scale.appeal.minPercent;
    const highPercent = revoked ? scale.appeal.fullyRevokedPercent : scale.appeal.maxPercent;
    low = (low * lowPercent) / 100;
    high = (high * highPercent) / 100;
    steps.push({
      description: revoked
        ? `Segunda instancia con todo revocado a favor del apelante: ${plain(highPercent)}% de lo regulado en primera`
        : `Segunda instancia: del ${plain(lowPercent)}% al ${plain(highPercent)}% de lo regulado en primera`,
      article: scale.appeal.article,
      amount: cents(low),
      amountTo: cents(high),
    });
  }
  return {
    minPesos: cents(low),
    maxPesos: cents(high),
    minJus: cents(low / jus.value),
    maxJus: cents(high / jus.value),
    jusValue: { value: jus.value, validFrom: jus.validFrom },
    minimum: chosen,
    steps,
    flags: ["validar"],
    disclaimer: scale.disclaimer,
    legalSource: scale.law,
  };
}

/** What the fake backends answer; `problem` names the problem type of an error. */
export interface FeeAnswer {
  status: number;
  json?: unknown;
  problem?: string;
}

/**
 * A stateful `/api/v1/fees` over a copy of the values: a new value, an archive or a restore shows
 * up in the next GET, and the calculation uses the value of the chosen day like the backend.
 * Answers undefined when the request is not one of its routes.
 */
export function feesBackend(
  initial: JusValueView[] = ALL_JUS_VALUES,
  options: { today?: string; role?: string } = {},
) {
  const values: JusValueView[] = structuredClone(initial);
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const canManage = !options.role || options.role === "OWNER" || options.role === "LAWYER";
  let next = 900;

  const active = () => values.filter((value) => !value.archived);
  const sorted = (list: JusValueView[]) =>
    [...list].sort(
      (a, b) => b.validFrom.localeCompare(a.validFrom) || b.createdAt.localeCompare(a.createdAt),
    );
  const valueOn = (date: string) => sorted(active()).find((value) => value.validFrom <= date);

  return (
    method: string,
    path: string,
    query: Record<string, string>,
    body: () => unknown,
  ): FeeAnswer | undefined => {
    if (!path.startsWith("/api/v1/fees/")) return undefined;
    if (method === "GET" && path === "/api/v1/fees/scale") return { status: 200, json: FEE_SCALE };
    if (method === "GET" && path === "/api/v1/fees/jus-values") {
      const list = query.includeArchived === "true" ? values : active();
      return { status: 200, json: { current: valueOn(today) ?? null, values: sorted(list) } };
    }
    if (method === "POST" && path === "/api/v1/fees/jus-values") {
      if (!canManage) return { status: 403, problem: "access-denied" };
      const data = body() as { value: number; validFrom: string };
      if (active().some((value) => value.validFrom === data.validFrom)) {
        return { status: 409, problem: "duplicate-jus-value" };
      }
      const created: JusValueView = {
        id: `00000000-0000-4000-c000-${String(next++).padStart(12, "0")}`,
        value: data.value,
        validFrom: data.validFrom,
        archived: false,
        createdAt: "2026-11-25T13:20:00Z",
      };
      values.push(created);
      return { status: 201, json: created };
    }
    if (method === "POST" && path === "/api/v1/fees/calculations") {
      const request = body() as CalculationRequest;
      const jus = valueOn(request.date ?? today);
      if (!jus) return { status: 409, problem: "jus-value-missing" };
      const result = calculationFor(FEE_SCALE, request, jus);
      return result
        ? { status: 200, json: result }
        : { status: 400, problem: "invalid-fee-data" };
    }
    const change = /^\/api\/v1\/fees\/jus-values\/([0-9a-f-]+)\/(archive|restore)$/.exec(path);
    if (method !== "POST" || !change) return undefined;
    if (!canManage) return { status: 403, problem: "access-denied" };
    const target = values.find((value) => value.id === change[1]);
    if (!target) return { status: 404, problem: "not-found" };
    if (change[2] === "restore" && target.archived) {
      if (active().some((value) => value.validFrom === target.validFrom)) {
        return { status: 409, problem: "duplicate-jus-value" };
      }
    }
    target.archived = change[2] === "archive";
    return { status: 204 };
  };
}
