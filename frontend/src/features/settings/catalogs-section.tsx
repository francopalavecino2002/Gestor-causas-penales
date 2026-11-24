import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, Eye, EyeOff, Info, Pencil, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cppArticle } from "@/features/agenda/agenda-format";
import { LoadError } from "@/features/cases/case-states";
import type { AnyCatalogId, CatalogItem, CatalogView } from "@/features/catalogs/catalog-types";
import { FLAG_LABELS } from "@/features/deadlines/deadline-format";
import { AddItemDialog, RenameItemDialog } from "@/features/settings/catalog-item-dialogs";
import { CATALOG_TITLES, catalogRules } from "@/features/settings/settings-copy";
import { settingsErrorMessage } from "@/features/settings/settings-errors";
import { useAnnouncement, useCanEditSettings } from "@/features/settings/settings-hooks";
import { SavedStatus, SettingsPage } from "@/features/settings/settings-layout";
import { useAllCatalogs, useUpdateCatalogItem } from "@/features/settings/settings-queries";
import { AreaDraftNote } from "@/features/practice-areas/area-choice";
import { DEFAULT_AREA, initialArea } from "@/features/practice-areas/practice-area-format";
import { useAreaDirectory } from "@/features/practice-areas/practice-area-queries";
import {
  catalogOf,
  DEFAULT_CATALOG,
  type CatalogSearch,
} from "@/features/settings/settings-search";

/** Review tags exactly as the domain docs write them, always visible. */
function Flags({ flags }: { flags: CatalogItem["flags"] }) {
  return flags.map((flag) => (
    <span key={flag} className="font-bold whitespace-nowrap text-deadline">
      {FLAG_LABELS[flag]}
    </span>
  ));
}

function CatalogItemRow({
  item,
  view,
  canEdit,
  onRename,
  onToggleHidden,
  busy,
}: {
  item: CatalogItem;
  view: CatalogView;
  canEdit: boolean;
  onRename: () => void;
  onToggleHidden: () => void;
  busy: boolean;
}) {
  const nameId = useId();
  const article = cppArticle(item.article);
  const renamed = item.sourceName !== null && item.sourceName !== item.name;
  return (
    <li aria-labelledby={nameId} className="grid gap-2 px-4 py-3.5 sm:flex sm:items-start sm:gap-4">
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span
            id={nameId}
            className={
              item.hidden ? "text-body font-bold text-muted-foreground" : "text-body font-bold"
            }
          >
            {item.name}
          </span>
          {item.hidden && (
            <Badge variant="neutral">
              <EyeOff aria-hidden="true" />
              Oculto
            </Badge>
          )}
          {item.origin === "FIRM" && <Badge variant="outline">Agregado por el estudio</Badge>}
        </p>
        {(article || item.flags.length > 0) && (
          <p className="flex flex-wrap gap-x-2 text-small font-medium text-muted-foreground tabular-nums">
            {article && <span>{article}</span>}
            <Flags flags={item.flags} />
          </p>
        )}
        {renamed && (
          <p className="text-small text-muted-foreground">Nombre en la norma: {item.sourceName}</p>
        )}
        {item.note && <p className="max-w-prose text-small text-muted-foreground">{item.note}</p>}
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
          <Button variant="outline" onClick={onRename} aria-describedby={nameId}>
            <Pencil aria-hidden="true" />
            Renombrá
          </Button>
          {view.hideable && (
            <Button
              variant="outline"
              onClick={onToggleHidden}
              disabled={busy}
              aria-describedby={nameId}
            >
              {item.hidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
              {item.hidden ? "Mostrá" : "Ocultá"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function CatalogSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando los catálogos" className="grid gap-3">
      <Skeleton className="h-11 w-full max-w-sm" />
      <div className="grid gap-3 rounded-xl border bg-card p-4">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="grid gap-1.5">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The chosen catalog: where it comes from, what can change, and its items. */
function CatalogPanel({
  view,
  area,
  canEdit,
}: {
  view: CatalogView;
  area: string;
  canEdit: boolean;
}) {
  const titleId = useId();
  const [message, announce] = useAnnouncement();
  const [renaming, setRenaming] = useState<CatalogItem | null>(null);
  const [adding, setAdding] = useState(false);
  const update = useUpdateCatalogItem(view.catalog, area);
  const title = CATALOG_TITLES[view.catalog];

  const toggleHidden = (item: CatalogItem) => {
    announce(null);
    // The current name goes back as is: for a built-in item, sending null would undo a rename.
    update.mutate(
      { code: item.code, name: item.name, hidden: !item.hidden },
      {
        onSuccess: () =>
          announce(item.hidden ? `Mostrado: ${item.name}.` : `Oculto: ${item.name}.`),
      },
    );
  };

  const shown = view.items.filter((item) => !item.hidden).length;

  return (
    <section aria-labelledby={titleId} className="grid gap-4">
      <div className="grid gap-1.5">
        <h2 id={titleId} className="text-title font-bold">
          {title}
        </h2>
        <p className="flex flex-wrap gap-x-2 text-meta text-muted-foreground">
          <span>
            {view.source ?? "Paquete de la jurisdicción"} (versión {view.packageVersion})
          </span>
          <Flags flags={view.flags} />
        </p>
        {view.note && <p className="max-w-prose text-meta text-muted-foreground">{view.note}</p>}
        <p className="max-w-prose text-meta">
          {catalogRules(view)}{" "}
          {view.hideable &&
            "Un ítem oculto no se ofrece en registros nuevos; los que ya lo usan lo conservan."}
        </p>
        <p className="flex max-w-prose items-start gap-2 text-small text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
          El artículo y las marcas de revisión vienen de la norma y no se editan.
        </p>
      </div>

      {canEdit && view.extensible && (
        <Button className="w-fit" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          Agregá un ítem
        </Button>
      )}

      <SavedStatus message={message} />
      {update.isError && (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>No pudimos guardar el cambio</AlertTitle>
          <AlertDescription>{settingsErrorMessage(update.error)}</AlertDescription>
        </Alert>
      )}

      <p className="text-meta text-muted-foreground">
        {view.items.length === shown
          ? `${view.items.length} ítems.`
          : `${view.items.length} ítems, ${view.items.length - shown} ${view.items.length - shown === 1 ? "oculto" : "ocultos"}.`}
      </p>
      <ul aria-label={`Ítems de ${title}`} className="divide-y rounded-xl border bg-card">
        {view.items.map((item) => (
          <CatalogItemRow
            key={item.code}
            item={item}
            view={view}
            canEdit={canEdit}
            busy={update.isPending && update.variables?.code === item.code}
            onRename={() => {
              announce(null);
              setRenaming(item);
            }}
            onToggleHidden={() => toggleHidden(item)}
          />
        ))}
      </ul>

      {renaming && (
        <RenameItemDialog
          catalog={view.catalog}
          area={area}
          item={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(name) => announce(`Guardado: ahora se llama ${name}.`)}
        />
      )}
      {adding && (
        <AddItemDialog
          catalog={view.catalog}
          area={area}
          title={title}
          onClose={() => setAdding(false)}
          onSaved={(name) => announce(`Agregado: ${name}.`)}
        />
      )}
    </section>
  );
}

/**
 * `/ajustes/catalogos`: one catalog at a time, picked from a list (`?catalogo=`), of one practice
 * area (`?fuero=`, offered only when the firm works in more than one).
 */
export function CatalogsSection({ search }: { search: CatalogSearch }) {
  const navigate = useNavigate();
  const selectId = useId();
  const areaSelectId = useId();
  const canEdit = useCanEditSettings();
  const directory = useAreaDirectory();
  const area = directory.find(search.fuero) ?? directory.find(initialArea(directory.areas));
  const areaCode = area?.code ?? DEFAULT_AREA;
  const catalogs = useAllCatalogs(areaCode);
  const current = catalogOf(search);
  const view = catalogs.data?.find((catalog) => catalog.catalog === current);

  const choose = (next: { catalogo: AnyCatalogId; fuero: string }) =>
    void navigate({
      to: "/ajustes/catalogos",
      search: {
        catalogo: next.catalogo === DEFAULT_CATALOG ? undefined : next.catalogo,
        fuero: next.fuero === initialArea(directory.areas) ? undefined : next.fuero,
      },
      replace: true,
    });

  return (
    <SettingsPage
      section="/ajustes/catalogos"
      intro="Las listas que usás para cargar causas y audiencias. Vienen del paquete de Neuquén y las podés adaptar a cómo habla tu estudio."
    >
      {catalogs.isPending || (search.fuero && directory.isPending) ? (
        <CatalogSkeleton />
      ) : catalogs.isError ? (
        <LoadError
          title="No pudimos cargar los catálogos"
          error={catalogs.error}
          onRetry={() => void catalogs.refetch()}
        />
      ) : (
        <div className="grid max-w-3xl gap-6">
          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            {directory.multiple && (
              <div className="grid gap-1.5">
                <Label htmlFor={areaSelectId}>Fuero</Label>
                <Select
                  id={areaSelectId}
                  value={areaCode}
                  onChange={(event) => choose({ catalogo: current, fuero: event.target.value })}
                >
                  {directory.areas.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="grid max-w-sm gap-1.5">
              <Label htmlFor={selectId}>Catálogo</Label>
              <Select
                id={selectId}
                value={current}
                onChange={(event) =>
                  choose({ catalogo: event.target.value as AnyCatalogId, fuero: areaCode })
                }
              >
                {catalogs.data.map((catalog) => (
                  <option key={catalog.catalog} value={catalog.catalog}>
                    {CATALOG_TITLES[catalog.catalog] ?? catalog.catalog}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {directory.multiple && area && area.flags.length > 0 && <AreaDraftNote area={area} />}
          {view ? (
            <CatalogPanel
              key={`${areaCode}-${view.catalog}`}
              view={view}
              area={areaCode}
              canEdit={canEdit}
            />
          ) : (
            <p className="text-body text-muted-foreground">
              {directory.multiple
                ? "Este fuero no usa este catálogo. Elegí otro de la lista."
                : "Este catálogo no está en el paquete de tu jurisdicción. Elegí otro de la lista."}
            </p>
          )}
        </div>
      )}
    </SettingsPage>
  );
}
