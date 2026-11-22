import { useId, type ReactNode } from "react";
import { CircleAlert, Lock, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { IsoDate } from "@/features/agenda/agenda-types";
import { cppArticle } from "@/features/agenda/agenda-format";
import { useCatalogItems } from "@/features/catalogs/catalog-queries";
import {
  custodialMismatch,
  DEFENDANT_STATUS_LABELS,
  defenceCounsel,
  formatNumericDate,
  isCustodial,
  LIBERTY_SITUATION_FALLBACK,
  libertySituation,
  measuresInForce,
} from "@/features/cases/case-format";
import { useCoerciveMeasures } from "@/features/cases/case-queries";
import type { CoerciveMeasure, DefendantView } from "@/features/cases/case-types";

function MeasureLine({ measure }: { measure: CoerciveMeasure }) {
  const article = cppArticle(measure.measureArticle);
  const dates = [
    measure.endsOn && `hasta el ${formatNumericDate(measure.endsOn)}`,
    measure.nextReviewOn && `revisión el ${formatNumericDate(measure.nextReviewOn)}`,
  ].filter(Boolean);
  return (
    <li>
      <span className="font-semibold">{measure.measureName}</span>
      {article && <span className="text-muted-foreground"> ({article})</span>}
      {dates.length > 0 && <span className="tabular-nums">, {dates.join(", ")}</span>}
      {measure.detentionPlace && <span>. {measure.detentionPlace}</span>}
    </li>
  );
}

/**
 * Liberty first: the computed situation as a badge (red only when the person is deprived of
 * liberty), its CPP article, and the measures in force it comes from.
 */
function LibertyBlock({
  defendant,
  measures,
  today,
}: {
  defendant: DefendantView;
  measures: ReturnType<typeof useCoerciveMeasures>;
  today: IsoDate;
}) {
  const situations = useCatalogItems("liberty-situations");

  if (measures.isPending) {
    return (
      <div role="status" aria-label="Cargando la situación de libertad">
        <Skeleton className="h-7 w-48 rounded-full" />
      </div>
    );
  }
  if (measures.isError) {
    return (
      <p className="grid justify-items-start gap-1 text-meta">
        <span>
          No pudimos cargar las medidas de coerción, así que no mostramos su situación de libertad.
        </span>
        <Button variant="link" className="-mx-1 px-1" onClick={() => void measures.refetch()}>
          Volvé a intentar
        </Button>
      </p>
    );
  }

  const situation = libertySituation(defendant, measures.data, today);
  const item = situations.get(situation);
  const name = item?.name ?? LIBERTY_SITUATION_FALLBACK[situation];
  const article = cppArticle(item?.article);
  const inForce = measuresInForce(measures.data, today);
  const custodial = isCustodial(situation);

  return (
    <div className="grid gap-1.5">
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="sr-only">Situación de libertad: </span>
        <Badge variant={custodial ? "detained" : "outline"} className="whitespace-normal">
          {custodial ? (
            <Lock aria-hidden="true" />
          ) : situation === "profugo-o-rebelde" ? (
            <ShieldAlert aria-hidden="true" />
          ) : null}
          {name}
        </Badge>
        {article && (
          <span className="text-small text-muted-foreground tabular-nums">{article}</span>
        )}
      </p>
      {inForce.length > 0 && (
        <ul aria-label="Medidas de coerción vigentes" className="grid gap-0.5 text-meta">
          {inForce.map((measure) => (
            <MeasureLine key={measure.id} measure={measure} />
          ))}
        </ul>
      )}
      {custodialMismatch(defendant, situation) && (
        <p className="flex items-start gap-2 text-meta">
          <CircleAlert aria-hidden="true" className="mt-0.75 size-4.5 shrink-0 text-primary" />
          <span>
            Su proceso figura como «
            {DEFENDANT_STATUS_LABELS[defendant.status].toLocaleLowerCase("es-AR")}» pero la medida
            sigue vigente en el sistema. Revisá si hay que cargar su levantamiento.
          </span>
        </p>
      )}
      <p className="text-small text-muted-foreground">
        Calculada con las medidas cargadas en el sistema. Verificala con la última resolución.
      </p>
    </div>
  );
}

interface Row {
  term: string;
  value: ReactNode;
}

function rows(defendant: DefendantView, stageArticle: string | null): Row[] {
  const list: Row[] = [
    {
      term: "Etapa",
      value: (
        <>
          {defendant.stageName}
          {stageArticle && (
            <span className="text-muted-foreground tabular-nums"> ({stageArticle})</span>
          )}
        </>
      ),
    },
    { term: "Estado", value: DEFENDANT_STATUS_LABELS[defendant.status] },
  ];
  if (defendant.closingOutcomeName) {
    list.push({ term: "Resultado", value: defendant.closingOutcomeName });
  }
  list.push(
    {
      term: "Formulación de cargos",
      value: defendant.chargesFormulatedOn ? (
        <time dateTime={defendant.chargesFormulatedOn} className="tabular-nums">
          {formatNumericDate(defendant.chargesFormulatedOn)}
        </time>
      ) : (
        "Todavía no"
      ),
    },
    { term: "Defensa", value: defenceCounsel(defendant) },
  );
  if (defendant.rebellionDeclaredOn) {
    // neuquen-review.md §1 and §3: rebellion (art. 52) suspends the maximum duration of the
    // process (art. 87) only for the rebel. Not tagged [validar] there.
    list.push({
      term: "Rebeldía (CPP art. 52)",
      value: (
        <span className="tabular-nums">
          Declarada el {formatNumericDate(defendant.rebellionDeclaredOn)}
          {defendant.rebellionLiftedOn
            ? `, levantada el ${formatNumericDate(defendant.rebellionLiftedOn)}.`
            : ". Mientras dure, suspende solo para esta persona el plazo de duración máxima del proceso (CPP art. 87)."}
        </span>
      ),
    });
  }
  return list;
}

/** One defendant: liberty, stage and status, defence, rebellion, charges and outcome. */
export function DefendantCard({ defendant, today }: { defendant: DefendantView; today: IsoDate }) {
  const titleId = useId();
  const stages = useCatalogItems("stages");
  const stageArticle = cppArticle(stages.get(defendant.stageCode)?.article);
  const measures = useCoerciveMeasures(defendant.id);
  const deprived =
    measures.isSuccess && isCustodial(libertySituation(defendant, measures.data, today));
  return (
    <Card asChild edge={deprived ? "detained" : "none"}>
      <article aria-labelledby={titleId}>
        <CardHeader>
          <div className="grid min-w-0">
            <CardTitle as="h3" id={titleId}>
              {defendant.displayName}
            </CardTitle>
            {defendant.personArchived && (
              <CardDescription>Ficha de la persona archivada</CardDescription>
            )}
          </div>
        </CardHeader>
        <LibertyBlock defendant={defendant} measures={measures} today={today} />
        <CardContent asChild>
          <dl className="grid gap-x-6 gap-y-2 text-meta sm:grid-cols-2">
            {rows(defendant, stageArticle).map(({ term, value }) => (
              <div key={term} className="grid min-w-0 content-start">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
        <div className="grid gap-1">
          <h4 className="text-meta font-bold">Cargos</h4>
          {defendant.charges.length > 0 ? (
            <ul className="grid gap-1 text-meta">
              {defendant.charges.map((charge) => (
                <li key={charge.id}>
                  {charge.offence}
                  {charge.legalReference && (
                    <span className="text-muted-foreground"> ({charge.legalReference})</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-meta text-muted-foreground">Todavía no tiene cargos cargados.</p>
          )}
        </div>
      </article>
    </Card>
  );
}
