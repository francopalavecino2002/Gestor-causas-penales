import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, CircleAlert, FolderCog, LoaderCircle, Pencil, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CasesEmpty, LoadError } from "@/features/cases/case-states";
import { CustomFieldDialog } from "@/features/settings/custom-field-form";
import {
  ENTITY_LABELS,
  ENTITY_TARGETS,
  FIELD_TYPE_LABELS,
} from "@/features/settings/settings-copy";
import { settingsErrorMessage } from "@/features/settings/settings-errors";
import { useAnnouncement, useCanEditSettings } from "@/features/settings/settings-hooks";
import { SavedStatus, SettingsPage } from "@/features/settings/settings-layout";
import { useArchiveCustomField, useCustomFields } from "@/features/settings/settings-queries";
import { entityOf, type FieldSearch } from "@/features/settings/settings-search";
import type { CustomField, CustomFieldEntity } from "@/features/settings/settings-types";
import { cn } from "@/lib/utils";

/** Segmented "Causas / Imputados": toggle buttons, since each one changes the URL. */
function EntitySwitch({
  entity,
  onChange,
}: {
  entity: CustomFieldEntity;
  onChange: (entity: CustomFieldEntity) => void;
}) {
  const labelId = useId();
  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="text-meta font-semibold">
        Campos de
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="inline-flex w-fit rounded-lg border bg-secondary p-0.75"
      >
        {(["CASE_FILE", "DEFENDANT"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={entity === option}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-meta font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-fast ease-out hover:text-foreground focus-visible:-outline-offset-3",
              "aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-segment",
            )}
          >
            {ENTITY_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  canEdit,
  onEdit,
  onArchive,
  onRestore,
  restoring,
}: {
  field: CustomField;
  canEdit: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  restoring: boolean;
}) {
  const nameId = useId();
  const visible = field.options.filter((option) => !option.hidden);
  const hidden = field.options.filter((option) => option.hidden);
  return (
    <li aria-labelledby={nameId} className="grid gap-2 px-4 py-3.5 sm:flex sm:items-start sm:gap-4">
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span id={nameId} className="text-body font-bold">
            {field.label}
          </span>
          <Badge variant="neutral">{FIELD_TYPE_LABELS[field.type]}</Badge>
          {field.required && <Badge variant="outline">Obligatorio</Badge>}
        </p>
        {field.type === "LIST" && (
          <p className="text-meta text-muted-foreground">
            Opciones: {visible.map((option) => option.label).join(", ") || "ninguna visible"}
            {hidden.length > 0 && (
              <> (ocultas: {hidden.map((option) => option.label).join(", ")})</>
            )}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
          {field.archived ? (
            <Button
              variant="outline"
              onClick={onRestore}
              disabled={restoring}
              aria-describedby={nameId}
            >
              {restoring ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <ArchiveRestore aria-hidden="true" />
              )}
              Restaurá
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onEdit} aria-describedby={nameId}>
                <Pencil aria-hidden="true" />
                Editá
              </Button>
              <Button variant="outline" onClick={onArchive} aria-describedby={nameId}>
                <Archive aria-hidden="true" />
                Archivá
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** Archiving hides the field from every record; the values stay and come back on restore. */
function ArchiveDialog({
  field,
  onClose,
  onArchived,
}: {
  field: CustomField;
  onClose: () => void;
  onArchived: () => void;
}) {
  const archive = useArchiveCustomField();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Archivás el campo {field.label}?</DialogTitle>
          <DialogDescription>
            Deja de aparecer en las fichas y no se pide más. Los valores que ya se cargaron no se
            borran: vuelven si lo restaurás.
          </DialogDescription>
        </DialogHeader>
        {archive.isError && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{settingsErrorMessage(archive.error)}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelá</Button>
          </DialogClose>
          <Button
            disabled={archive.isPending}
            onClick={() =>
              archive.mutate(
                { id: field.id, archive: true },
                {
                  onSuccess: () => {
                    onArchived();
                    onClose();
                  },
                },
              )
            }
          >
            {archive.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Archive aria-hidden="true" />
            )}
            Archivá el campo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando los campos"
      className="grid gap-3 rounded-xl border bg-card p-4"
    >
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid gap-1.5">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ))}
    </div>
  );
}

type Editing = { mode: "create" } | { mode: "edit"; field: CustomField } | null;

/** `/ajustes/campos`: the firm's own fields for cases (default) or defendants (`?para=imputados`). */
export function CustomFieldsSection({ search }: { search: FieldSearch }) {
  const navigate = useNavigate();
  const canEdit = useCanEditSettings();
  const entity = entityOf(search);
  const fields = useCustomFields(entity);
  const restore = useArchiveCustomField();
  const [message, announce] = useAnnouncement();
  const [editing, setEditing] = useState<Editing>(null);
  const [archiving, setArchiving] = useState<CustomField | null>(null);
  const activeId = useId();
  const archivedId = useId();

  const all = [...(fields.data ?? [])].sort((a, b) => a.position - b.position);
  const active = all.filter((field) => !field.archived);
  const archived = all.filter((field) => field.archived);
  const target = ENTITY_TARGETS[entity];

  const switchEntity = (next: CustomFieldEntity) => {
    announce(null);
    restore.reset();
    void navigate({
      to: "/ajustes/campos",
      search: { para: next === "DEFENDANT" ? "imputados" : undefined },
      replace: true,
    });
  };

  const rowProps = (field: CustomField) => ({
    field,
    canEdit,
    onEdit: () => {
      announce(null);
      setEditing({ mode: "edit", field });
    },
    onArchive: () => {
      announce(null);
      setArchiving(field);
    },
    onRestore: () => {
      announce(null);
      restore.mutate(
        { id: field.id, archive: false },
        { onSuccess: () => announce(`Restaurado: ${field.label}.`) },
      );
    },
    restoring: restore.isPending && restore.variables?.id === field.id,
  });

  return (
    <SettingsPage
      section="/ajustes/campos"
      intro="Datos que tu estudio quiere registrar además de los del sistema, por ejemplo el juzgado de familia vinculado o si hay querella. Nada se borra: un campo que no usás más se archiva."
    >
      <div className="grid max-w-3xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <EntitySwitch entity={entity} onChange={switchEntity} />
          {canEdit && (
            <Button
              onClick={() => {
                announce(null);
                setEditing({ mode: "create" });
              }}
            >
              <Plus aria-hidden="true" />
              Agregá un campo
            </Button>
          )}
        </div>

        <SavedStatus message={message} />
        {restore.isError && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>No pudimos restaurar el campo</AlertTitle>
            <AlertDescription>{settingsErrorMessage(restore.error)}</AlertDescription>
          </Alert>
        )}

        {fields.isPending ? (
          <FieldsSkeleton />
        ) : fields.isError ? (
          <LoadError
            title="No pudimos cargar los campos"
            error={fields.error}
            onRetry={() => void fields.refetch()}
          />
        ) : (
          <>
            {active.length === 0 ? (
              <CasesEmpty
                title={`Todavía no hay campos propios para ${target}`}
                description={
                  canEdit
                    ? "Agregá uno si tu estudio necesita registrar algo que el sistema no pide."
                    : "Cuando la persona titular agregue uno, lo vas a ver en cada ficha."
                }
                icon={FolderCog}
              >
                {canEdit && (
                  <Button variant="outline" onClick={() => setEditing({ mode: "create" })}>
                    <Plus aria-hidden="true" />
                    Agregá el primero
                  </Button>
                )}
              </CasesEmpty>
            ) : (
              <section aria-labelledby={activeId} className="grid gap-3">
                <h2 id={activeId} className="text-title font-bold">
                  En uso
                </h2>
                <ul className="divide-y rounded-xl border bg-card">
                  {active.map((field) => (
                    <FieldRow key={field.id} {...rowProps(field)} />
                  ))}
                </ul>
              </section>
            )}

            {archived.length > 0 && (
              <section aria-labelledby={archivedId} className="grid gap-3">
                <h2 id={archivedId} className="text-title font-bold">
                  Archivados
                </h2>
                <p className="max-w-prose text-meta text-muted-foreground">
                  No aparecen en las fichas. Sus valores se guardan y vuelven al restaurarlos.
                </p>
                <ul className="divide-y rounded-xl border bg-card">
                  {archived.map((field) => (
                    <FieldRow key={field.id} {...rowProps(field)} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {editing && (
        <CustomFieldDialog
          entity={entity}
          field={editing.mode === "edit" ? editing.field : undefined}
          onClose={() => setEditing(null)}
          onSaved={(label) =>
            announce(editing.mode === "edit" ? `Guardado: ${label}.` : `Agregado: ${label}.`)
          }
        />
      )}
      {archiving && (
        <ArchiveDialog
          field={archiving}
          onClose={() => setArchiving(null)}
          onArchived={() => announce(`Archivado: ${archiving.label}.`)}
        />
      )}
    </SettingsPage>
  );
}
