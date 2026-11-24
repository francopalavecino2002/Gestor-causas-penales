import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FIRM_TIME_ZONE } from "@/features/agenda/agenda-dates";
import { useAgendaCache } from "@/features/agenda/agenda-queries";
import { useCatalogItemsByArea, useCatalogsSettled } from "@/features/catalogs/catalog-queries";
import type { CatalogId } from "@/features/catalogs/catalog-types";
import { CASE_PAGE_SIZE } from "@/features/cases/case-api";
import { CaseFormDialog } from "@/features/cases/case-form-dialog";
import { CaseCards, CaseTable } from "@/features/cases/case-list";
import { useCases } from "@/features/cases/case-queries";
import type { CaseListSearch } from "@/features/cases/case-search";
import { CaseListSkeleton, CasesEmpty, LoadError } from "@/features/cases/case-states";
import { useCanImport } from "@/features/imports/import-hooks";
import { AreaFilter } from "@/features/practice-areas/area-filter";
import { DEFAULT_AREA } from "@/features/practice-areas/practice-area-format";
import { useAreaDirectory } from "@/features/practice-areas/practice-area-queries";
import { cn } from "@/lib/utils";

const LIST_CATALOGS: CatalogId[] = ["stages", "hearing-types"];

/** Wait this long after the last keystroke before searching. */
export const SEARCH_DEBOUNCE_MS = 300;

/** "1 causa", "12 causas". */
function countCases(count: number): string {
  return `${count} ${count === 1 ? "causa" : "causas"}`;
}

function resultSummary(
  total: number,
  q: string | undefined,
  archived: boolean,
  areaName: string | undefined,
): string {
  const scope = [areaName && ` de ${areaName}`, archived && ", archivadas incluidas"]
    .filter(Boolean)
    .join("");
  if (q) {
    return total === 0
      ? `No hay resultados para «${q}»${scope}.`
      : `${countCases(total)} para «${q}»${scope}.`;
  }
  return total === 1 ? `1 causa en el estudio${scope}.` : `${total} causas en el estudio${scope}.`;
}

/**
 * The search box. It searches as you type (debounced) and keeps the text in the URL (`?q=`), so
 * back/forward and shared links bring the same results; Enter searches right away.
 */
function CaseSearchBox({
  value,
  onSearch,
}: {
  value: string | undefined;
  onSearch: (q: string | undefined) => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState(value ?? "");
  // What this box last put in the URL, to tell our own update from back/forward or a link.
  const [pushed, setPushed] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (value !== pushed) setDraft(value ?? "");
  }

  const next = draft.trim() || undefined;
  useEffect(() => {
    if (next === value) return;
    const timer = setTimeout(() => {
      setPushed(next);
      onSearch(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [next, value, onSearch]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (next === value) return;
    setPushed(next);
    onSearch(next);
  };

  return (
    <form role="search" onSubmit={submit} className="grid w-full gap-1.5 md:max-w-xl">
      <Label htmlFor={inputId}>Buscá una causa</Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-describedby={hintId}
          autoComplete="off"
          enterKeyHint="search"
          className="pl-11"
        />
      </div>
      <p id={hintId} className="text-small text-muted-foreground">
        Por carátula, legajo del MPF, número de la OFIJU o número interno.
      </p>
    </form>
  );
}

function Pagination({
  page,
  pageCount,
  search,
}: {
  page: number;
  pageCount: number;
  search: CaseListSearch;
}) {
  if (pageCount <= 1) return null;
  const to = (target: number): CaseListSearch => ({
    ...search,
    pagina: target > 1 ? target : undefined,
  });
  return (
    <nav aria-label="Páginas de resultados" className="flex flex-wrap items-center gap-3">
      {page > 1 ? (
        <Button variant="outline" asChild>
          <Link to="/causas" search={to(page - 1)}>
            <ChevronLeft aria-hidden="true" />
            Anterior
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
      )}
      <p className="text-meta text-muted-foreground">
        Página {page} de {pageCount}
      </p>
      {page < pageCount ? (
        <Button variant="outline" asChild>
          <Link to="/causas" search={to(page + 1)}>
            Siguiente
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Siguiente
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </nav>
  );
}

/**
 * `/causas`: every case the user can see (reserved ones only for their team), searchable, 20 per
 * page. Cards on phones and tablets, a docket table from 1024 px. Search, page and the archived
 * switch live in the URL (`?q`, `?pagina`, `?archivadas=si`).
 */
export function CaseListPage({ search }: { search: CaseListSearch }) {
  const navigate = useNavigate();
  const switchId = useId();
  const page = search.pagina ?? 1;
  const includeArchived = search.archivadas === "si";
  const canImport = useCanImport();
  const [creating, setCreating] = useState(false);
  const directory = useAreaDirectory();
  // A filter for an area the firm no longer works in is ignored, as if it were not in the URL.
  const area = directory.multiple ? directory.find(search.fuero) : undefined;
  const cases = useCases({ q: search.q, includeArchived, area: area?.code, page: page - 1 });
  const areasInPage = [DEFAULT_AREA, ...(cases.data?.items ?? []).map((item) => item.practiceArea)];
  const catalogs = {
    stages: useCatalogItemsByArea("stages", areasInPage),
    hearingTypes: useCatalogItemsByArea("hearing-types", areasInPage),
  };
  const catalogsSettled = useCatalogsSettled(LIST_CATALOGS);
  const timeZone = useAgendaCache().timeZone ?? FIRM_TIME_ZONE;

  const go = (next: CaseListSearch) => void navigate({ to: "/causas", search: next });

  // A new search always starts on the first page; replace, so typing does not fill the history.
  const archivadas = search.archivadas;
  const fuero = search.fuero;
  const onSearch = useCallback(
    (q: string | undefined) =>
      void navigate({ to: "/causas", search: { q, archivadas, fuero }, replace: true }),
    [navigate, archivadas, fuero],
  );

  const data = cases.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / CASE_PAGE_SIZE));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Causas">
          <p aria-live="polite" className="empty:hidden">
            {data ? resultSummary(total, search.q, includeArchived, area?.name) : null}
          </p>
        </PageHeader>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          Nueva causa
        </Button>
      </div>

      <div className="grid gap-4 md:flex md:items-start md:gap-6">
        <CaseSearchBox value={search.q} onSearch={onSearch} />
        {directory.multiple && (
          <AreaFilter
            areas={directory.areas}
            value={area?.code ?? ""}
            onChange={(code) => go({ ...search, pagina: undefined, fuero: code || undefined })}
            className="md:w-56 md:shrink-0"
          />
        )}
        <div className="flex min-h-11 items-center gap-3 md:mt-8 md:shrink-0">
          <Switch
            id={switchId}
            checked={includeArchived}
            onCheckedChange={(checked) =>
              go({ q: search.q, fuero: search.fuero, archivadas: checked ? "si" : undefined })
            }
          />
          <Label htmlFor={switchId} className="cursor-pointer">
            Incluí las archivadas
          </Label>
        </div>
      </div>

      {cases.isPending || !catalogsSettled ? (
        <CaseListSkeleton />
      ) : cases.isError ? (
        <LoadError
          title="No pudimos cargar las causas"
          error={cases.error}
          onRetry={() => void cases.refetch()}
        />
      ) : items.length === 0 ? (
        page > 1 && total > 0 ? (
          <CasesEmpty
            title="Esta página ya no tiene causas"
            description={`Hay ${countCases(total)} en total: volvé a la primera página para verlas.`}
          >
            <Button variant="outline" onClick={() => go({ ...search, pagina: undefined })}>
              Volvé a la primera página
            </Button>
          </CasesEmpty>
        ) : search.q ? (
          <CasesEmpty
            title={`No encontramos causas con «${search.q}»`}
            description="Probá con otra parte de la carátula, o con el legajo del MPF como figura en el expediente, por ejemplo MPFNQ 12345/2026."
          >
            <Button
              variant="outline"
              onClick={() => go({ archivadas: search.archivadas, fuero: search.fuero })}
            >
              Borrá la búsqueda
            </Button>
            {!includeArchived && (
              <Button
                variant="ghost"
                onClick={() => go({ q: search.q, fuero: search.fuero, archivadas: "si" })}
              >
                Buscá también en las archivadas
              </Button>
            )}
          </CasesEmpty>
        ) : area ? (
          <CasesEmpty
            title={`No hay causas de ${area.name}`}
            description="Cargá la primera de este fuero, o mirá las causas de todos los fueros."
          >
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Cargá una causa
            </Button>
            <Button variant="outline" onClick={() => go({ archivadas: search.archivadas })}>
              Mirá todos los fueros
            </Button>
          </CasesEmpty>
        ) : (
          <CasesEmpty
            title="Todavía no hay causas"
            description="Cuando cargues una causa o la importes desde una planilla, la vas a ver acá con sus imputados, el legajo y la próxima audiencia."
          >
            {!includeArchived && (
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" />
                Cargá la primera causa
              </Button>
            )}
            {canImport && !includeArchived && (
              <Button variant="outline" asChild>
                <Link to="/importar">Importá desde una planilla</Link>
              </Button>
            )}
            {!includeArchived && (
              <Button variant="outline" onClick={() => go({ archivadas: "si" })}>
                Mirá también las archivadas
              </Button>
            )}
          </CasesEmpty>
        )
      ) : (
        <div
          aria-busy={cases.isPlaceholderData}
          className={cn(
            "grid gap-5 transition-opacity duration-fast ease-out",
            cases.isPlaceholderData && "opacity-60",
          )}
        >
          <div className="lg:hidden">
            <CaseCards
              items={items}
              catalogs={catalogs}
              timeZone={timeZone}
              multipleAreas={directory.multiple}
            />
          </div>
          <div className="hidden lg:block">
            <CaseTable
              items={items}
              catalogs={catalogs}
              timeZone={timeZone}
              caption={`Causas, página ${page} de ${pageCount}`}
              multipleAreas={directory.multiple}
            />
          </div>
          <Pagination page={page} pageCount={pageCount} search={search} />
        </div>
      )}

      {creating && <CaseFormDialog area={area?.code} onClose={() => setCreating(false)} />}
    </>
  );
}
