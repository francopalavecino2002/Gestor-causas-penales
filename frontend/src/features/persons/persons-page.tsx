import { useCallback, useId, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, ShieldCheck, Users } from "lucide-react";

import { SearchBox } from "@/components/forms/search-box";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CasesEmpty, LoadError } from "@/features/cases/case-states";
import { useCanImport } from "@/features/imports/import-hooks";
import { ConflictCheckDialog } from "@/features/persons/conflict-check-dialog";
import { PERSON_PAGE_SIZE } from "@/features/persons/person-api";
import { PersonFormDialog } from "@/features/persons/person-form-dialog";
import { countPersons } from "@/features/persons/person-format";
import { PersonCards, PersonTable } from "@/features/persons/person-list";
import { usePersonList } from "@/features/persons/person-queries";
import { looksLikeDocument, type PersonListSearch } from "@/features/persons/person-search";
import { PersonListSkeleton } from "@/features/persons/person-states";
import { cn } from "@/lib/utils";

function resultSummary(total: number, q: string | undefined, archived: boolean): string {
  const scope = archived ? ", archivadas incluidas" : "";
  if (q) {
    return total === 0
      ? `No hay resultados para «${q}»${scope}.`
      : `${countPersons(total)} para «${q}»${scope}.`;
  }
  return `${total === 1 ? "1 persona" : `${total} personas`} en el estudio${scope}.`;
}

function Pagination({
  page,
  pageCount,
  search,
}: {
  page: number;
  pageCount: number;
  search: PersonListSearch;
}) {
  if (pageCount <= 1) return null;
  const to = (target: number): PersonListSearch => ({
    ...search,
    pagina: target > 1 ? target : undefined,
  });
  const previous = (
    <>
      <ChevronLeft aria-hidden="true" />
      Anterior
    </>
  );
  const next = (
    <>
      Siguiente
      <ChevronRight aria-hidden="true" />
    </>
  );
  return (
    <nav aria-label="Páginas de resultados" className="flex flex-wrap items-center gap-3">
      {page > 1 ? (
        <Button variant="outline" asChild>
          <Link to="/personas" search={to(page - 1)}>
            {previous}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          {previous}
        </Button>
      )}
      <p className="text-meta text-muted-foreground">
        Página {page} de {pageCount}
      </p>
      {page < pageCount ? (
        <Button variant="outline" asChild>
          <Link to="/personas" search={to(page + 1)}>
            {next}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          {next}
        </Button>
      )}
    </nav>
  );
}

type Dialog = "create" | "conflict" | null;

/**
 * `/personas`: everyone the firm has loaded (defendants, victims, witnesses, companies), with
 * their document and their roles in cases, searchable by name, alias or document. 20 per page;
 * cards on phones and tablets, a table from 1024 px. Search, page and the archived switch live in
 * the URL (`?q`, `?pagina`, `?archivadas=si`). From here: a new person and the conflict check.
 */
export function PersonsPage({ search }: { search: PersonListSearch }) {
  const navigate = useNavigate();
  const switchId = useId();
  const page = search.pagina ?? 1;
  const includeArchived = search.archivadas === "si";
  const [dialog, setDialog] = useState<Dialog>(null);
  const canImport = useCanImport();
  // A document number searched for stays here, never in the URL or the history.
  const [documentQuery, setDocumentQuery] = useState<string | undefined>();
  const q = documentQuery ?? search.q;
  const persons = usePersonList({ q, includeArchived, page: page - 1 });

  const go = (next: PersonListSearch) => void navigate({ to: "/personas", search: next });
  const archivadas = search.archivadas;
  const onSearch = useCallback(
    (next: string | undefined) => {
      const document = next !== undefined && looksLikeDocument(next);
      setDocumentQuery(document ? next : undefined);
      void navigate({
        to: "/personas",
        search: { q: document ? undefined : next, archivadas },
        replace: true,
      });
    },
    [navigate, archivadas],
  );
  const clearSearch = () => {
    setDocumentQuery(undefined);
    go({ archivadas: search.archivadas });
  };

  const data = persons.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PERSON_PAGE_SIZE));
  const create = () => setDialog("create");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Personas">
          <p aria-live="polite" className="empty:hidden">
            {data ? resultSummary(total, q, includeArchived) : null}
          </p>
        </PageHeader>
        {/* Phones: the main action first; wider screens: on the right, as in other headers. */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={create} className="sm:order-last">
            <Plus aria-hidden="true" />
            Nueva persona
          </Button>
          <Button variant="outline" onClick={() => setDialog("conflict")}>
            <ShieldCheck aria-hidden="true" />
            Control de conflicto
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:flex md:items-start md:gap-6">
        <SearchBox
          label="Buscá por nombre o documento"
          hint="Por apellido, nombre, razón social, apodo o número de documento."
          value={q}
          onSearch={onSearch}
        />
        <div className="flex min-h-11 items-center gap-3 md:mt-8 md:shrink-0">
          <Switch
            id={switchId}
            checked={includeArchived}
            onCheckedChange={(checked) =>
              go({ q: search.q, archivadas: checked ? "si" : undefined })
            }
          />
          <Label htmlFor={switchId} className="cursor-pointer">
            Incluí las archivadas
          </Label>
        </div>
      </div>

      {persons.isPending ? (
        <PersonListSkeleton />
      ) : persons.isError ? (
        <LoadError
          title="No pudimos cargar las personas"
          error={persons.error}
          onRetry={() => void persons.refetch()}
        />
      ) : items.length === 0 ? (
        page > 1 && total > 0 ? (
          <CasesEmpty
            icon={Users}
            title="Esta página ya no tiene personas"
            description={`Hay ${countPersons(total)} en total: volvé a la primera página para verlas.`}
          >
            <Button variant="outline" onClick={() => go({ ...search, pagina: undefined })}>
              Volvé a la primera página
            </Button>
          </CasesEmpty>
        ) : q ? (
          <CasesEmpty
            icon={Users}
            title={`No encontramos personas con «${q}»`}
            description="Probá con el apellido solo, con un apodo o con el número de documento sin puntos. Si no está en el estudio, cargá una persona nueva."
          >
            <Button onClick={create}>
              <Plus aria-hidden="true" />
              Cargá una persona nueva
            </Button>
            <Button variant="outline" onClick={clearSearch}>
              Borrá la búsqueda
            </Button>
            {!includeArchived && (
              <Button variant="ghost" onClick={() => go({ q: search.q, archivadas: "si" })}>
                Buscá también en las archivadas
              </Button>
            )}
          </CasesEmpty>
        ) : (
          <CasesEmpty
            icon={Users}
            title="Todavía no hay personas"
            description="Cuando cargues a un defendido, una víctima o un testigo (desde acá o desde una causa), lo vas a ver acá con su documento y sus causas."
          >
            <Button onClick={create}>
              <Plus aria-hidden="true" />
              Cargá la primera persona
            </Button>
            {canImport && (
              <Button variant="outline" asChild>
                <Link to="/importar">Importá desde una planilla</Link>
              </Button>
            )}
          </CasesEmpty>
        )
      ) : (
        <div
          aria-busy={persons.isPlaceholderData}
          className={cn(
            "grid gap-5 transition-opacity duration-fast ease-out",
            persons.isPlaceholderData && "opacity-60",
          )}
        >
          <div className="lg:hidden">
            <PersonCards items={items} />
          </div>
          <div className="hidden lg:block">
            <PersonTable items={items} caption={`Personas, página ${page} de ${pageCount}`} />
          </div>
          <Pagination page={page} pageCount={pageCount} search={search} />
        </div>
      )}

      {dialog === "create" && (
        <PersonFormDialog
          onClose={() => setDialog(null)}
          onCreated={(person) =>
            void navigate({ to: "/personas/$personId", params: { personId: person.id } })
          }
        />
      )}
      {dialog === "conflict" && <ConflictCheckDialog onClose={() => setDialog(null)} />}
    </>
  );
}
