import { useId, type Ref } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, Coins, ExternalLink, Info, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { reviewTags } from "@/features/catalogs/catalog-format";
import {
  formatDay,
  formatJusRange,
  formatPesos,
  INSTANCE_LABELS,
  jusSentence,
  ROLE_LABELS,
} from "@/features/fees/fee-format";
import type { CalculationRequest, FeeCalculation } from "@/features/fees/fee-types";

/**
 * Always on screen next to the calculator (CLAUDE.md rule 6): the system assists, the judge sets
 * the fee and the lawyer controls it.
 */
export function FeeDisclaimer() {
  return (
    <Alert variant="disclaimer">
      <Info aria-hidden="true" />
      <AlertDescription>
        <p>
          <strong className="font-bold">Cálculo asistido: verificá con la norma.</strong> El
          honorario lo regula el juez; esto es una estimación para orientarte. No aplica las pautas
          del art. 6, las etapas, intereses ni IVA.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/** A range whose amounts never break between "$" and the number; the line breaks at "a". */
function Range({ from, to }: { from: number; to: number | null }) {
  if (to === null || from === to) {
    return <span className="whitespace-nowrap">{formatPesos(from)}</span>;
  }
  return (
    <>
      <span className="whitespace-nowrap">{formatPesos(from)}</span> a{" "}
      <span className="whitespace-nowrap">{formatPesos(to)}</span>
    </>
  );
}

/** Before the first calculation: what the panel will show. */
export function FeeResultPlaceholder() {
  return (
    <section
      aria-label="Resultado"
      className="grid justify-items-start gap-3 rounded-xl border border-dashed border-border-strong bg-card px-5 py-6"
    >
      <Calculator aria-hidden="true" className="size-6 text-primary" />
      <p className="max-w-prose text-body text-muted-foreground">
        Elegí el tipo de asunto y tocá «Calculá el honorario». Vas a ver el rango en pesos y en JUS,
        y cada paso con su artículo.
      </p>
      <FeeDisclaimer />
    </section>
  );
}

/**
 * No JUS value applies: the firm loads it (it is never fetched automatically). Owners and lawyers
 * get the way to Ajustes; everyone else, who to ask.
 */
export function JusMissing({
  canManage,
  day,
}: {
  canManage: boolean;
  /** The day the calculation asked for; undefined when the firm has no value at all. */
  day?: string;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="grid justify-items-start gap-3 rounded-xl border border-dashed border-border-strong bg-card px-5 py-6"
    >
      <Coins aria-hidden="true" className="size-6 text-primary" />
      <h2 id={titleId} className="text-title font-bold">
        Cargá el valor del JUS
      </h2>
      <p className="max-w-prose text-body text-muted-foreground">
        {day
          ? `No hay un valor del JUS vigente al ${formatDay(day)}. Para pasar de JUS a pesos, el estudio tiene que cargar el valor que regía ese día, o elegí otra fecha.`
          : "Para pasar de JUS a pesos, el estudio tiene que cargar el valor que publica el Poder Judicial y la fecha desde la que rige. El sistema no lo busca solo."}
      </p>
      {canManage ? (
        <Button asChild>
          <Link to="/ajustes/jus">Cargá el valor del JUS</Link>
        </Button>
      ) : (
        <p className="text-body font-semibold">Pedile a un titular o abogado que lo cargue.</p>
      )}
      <FeeDisclaimer />
    </section>
  );
}

/**
 * The estimate: the range in pesos first (what the lawyer came for), then in JUS with the value
 * used, then every step with its article, the review tags and the disclaimer.
 */
export function FeeResult({
  result,
  request,
  lawSource,
  headingRef,
}: {
  result: FeeCalculation;
  request: CalculationRequest;
  /** Where the text of the law can be read. */
  lawSource?: string;
  /** The title gets focus after a calculation, so the reader lands on the result. */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const titleId = useId();
  const tags = reviewTags(result.flags);
  const facts = [
    result.minimum.name,
    ROLE_LABELS[request.role].toLowerCase(),
    INSTANCE_LABELS[request.instance].toLowerCase(),
    request.amount === null ? "sin monto" : `monto de ${formatPesos(request.amount)}`,
  ];

  return (
    <section
      aria-labelledby={titleId}
      className="grid min-w-0 gap-5 rounded-xl border bg-card px-4 py-5 md:px-6"
    >
      <div className="grid gap-1.5">
        <h2
          ref={headingRef}
          id={titleId}
          tabIndex={-1}
          className="text-meta font-semibold text-muted-foreground"
        >
          Honorario estimado
        </h2>
        <p className="text-display font-bold tabular-nums">
          <Range from={result.minPesos} to={result.maxPesos} />
        </p>
        <p className="text-body font-semibold tabular-nums">
          {formatJusRange(result.minJus, result.maxJus)}
        </p>
        <p className="text-meta text-muted-foreground tabular-nums">
          {jusSentence(result.jusValue)}.
        </p>
        <p className="text-meta text-muted-foreground">Para {facts.join(", ")}.</p>
      </div>

      <div className="grid gap-3 border-t pt-4">
        <h3 className="text-card-title font-bold">Cómo se calculó</h3>
        <ol className="grid gap-3">
          {result.steps.map((step, index) => (
            <li
              key={`${index}-${step.article}`}
              className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-small font-bold text-accent-foreground tabular-nums"
              >
                {index + 1}
              </span>
              <div className="grid min-w-0 gap-0.5">
                <p className="text-body text-pretty">{step.description}</p>
                <p className="flex flex-wrap gap-x-3 text-meta text-muted-foreground">
                  <span>
                    Ley 1594, {step.article}
                    {tags && (
                      <>
                        {" "}
                        <span className="font-bold whitespace-nowrap text-deadline">{tags}</span>
                      </>
                    )}
                  </span>
                  {step.amount !== null && (
                    <span className="font-semibold text-foreground tabular-nums">
                      <Range from={step.amount} to={step.amountTo} />
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {result.minimum.note && (
        <p className="flex max-w-prose items-start gap-2 text-meta">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-deadline" />
          <span>
            {result.minimum.note}{" "}
            <span className="font-bold whitespace-nowrap text-deadline">
              {reviewTags(result.minimum.flags)}
            </span>
          </span>
        </p>
      )}
      {tags && (
        <p className="max-w-prose text-meta text-muted-foreground">
          <span className="font-bold text-deadline">{tags}</span> Las reglas que usó este cálculo
          todavía tienen que confirmarse con un abogado.
        </p>
      )}

      <div className="grid gap-2 border-t pt-4">
        <FeeDisclaimer />
        {lawSource && (
          <a
            href={lawSource}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-meta font-semibold text-primary underline underline-offset-4 hover:decoration-2"
          >
            Leé la {result.legalSource}
            <ExternalLink aria-hidden="true" className="size-4.5" />
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        )}
      </div>
    </section>
  );
}
