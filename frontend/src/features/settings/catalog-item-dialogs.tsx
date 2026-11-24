import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cppArticle } from "@/features/agenda/agenda-format";
import type { AnyCatalogId, CatalogItem } from "@/features/catalogs/catalog-types";
import { settingsErrorMessage } from "@/features/settings/settings-errors";
import { useAddCatalogItem, useUpdateCatalogItem } from "@/features/settings/settings-queries";

// Same limits as the backend (JurisdictionPackageLoader).
const ITEM_NAME_MAX = 200;
const ITEM_ARTICLE_MAX = 120;

const nameSchema = z
  .string()
  .trim()
  .min(1, "Escribí el nombre.")
  .max(ITEM_NAME_MAX, `El nombre tiene como máximo ${ITEM_NAME_MAX} caracteres.`);

const renameSchema = z.object({ name: nameSchema });

const newItemSchema = z.object({
  name: nameSchema,
  article: z
    .string()
    .trim()
    .max(ITEM_ARTICLE_MAX, `El artículo tiene como máximo ${ITEM_ARTICLE_MAX} caracteres.`),
});

function ServerError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert variant="error" role="alert">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{settingsErrorMessage(error)}</AlertDescription>
    </Alert>
  );
}

/** Renames an item; a built-in one can go back to the name of the norm. */
export function RenameItemDialog({
  catalog,
  area,
  item,
  onClose,
  onSaved,
}: {
  catalog: AnyCatalogId;
  /** The practice area whose catalog this is; the criminal one when not given. */
  area?: string;
  item: CatalogItem;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const update = useUpdateCatalogItem(catalog, area);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: item.name },
  });
  const renamed = item.sourceName !== null && item.sourceName !== item.name;
  const article = cppArticle(item.article);

  const save = (name: string | null) =>
    update.mutate(
      { code: item.code, name, hidden: item.hidden },
      {
        onSuccess: (saved) => {
          onSaved(saved.name);
          onClose();
        },
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrá el ítem</DialogTitle>
          <DialogDescription>
            {item.sourceName
              ? `En la norma se llama «${item.sourceName}»${article ? ` (${article})` : ""}. El nuevo nombre se ve en todo el estudio; el artículo no cambia.`
              : "El nuevo nombre se ve en todo el estudio y en las causas que ya lo usan."}
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(({ name }) => save(name))} className="grid gap-5">
          <ServerError error={update.error} />
          <Field>
            <Label htmlFor="catalog-item-name">Nombre</Label>
            <Input
              id="catalog-item-name"
              maxLength={ITEM_NAME_MAX}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "catalog-item-name-error" : undefined}
              {...register("name")}
            />
            <FieldError id="catalog-item-name-error">{errors.name?.message}</FieldError>
          </Field>
          <DialogFooter>
            {renamed && (
              <Button
                variant="ghost"
                className="sm:mr-auto"
                disabled={update.isPending}
                onClick={() => save(null)}
              >
                Volvé al nombre de la norma
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="outline">Cancelá</Button>
            </DialogClose>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {update.isPending ? "Guardando…" : "Guardá"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Adds a firm item to an extensible catalog. */
export function AddItemDialog({
  catalog,
  area,
  title,
  onClose,
  onSaved,
}: {
  catalog: AnyCatalogId;
  area?: string;
  title: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const add = useAddCatalogItem(catalog, area);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof newItemSchema>>({
    resolver: zodResolver(newItemSchema),
    defaultValues: { name: "", article: "" },
  });

  const submit = handleSubmit(({ name, article }) =>
    add.mutate(
      { name, article: article || null },
      {
        onSuccess: (saved) => {
          onSaved(saved.name);
          onClose();
        },
      },
    ),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregá un ítem</DialogTitle>
          <DialogDescription>
            Se suma a {title.toLocaleLowerCase("es-AR")} de tu estudio, después de los de la norma.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-5">
          <ServerError error={add.error} />
          <Field>
            <Label htmlFor="new-item-name">Nombre</Label>
            <Input
              id="new-item-name"
              maxLength={ITEM_NAME_MAX}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "new-item-name-error" : undefined}
              {...register("name")}
            />
            <FieldError id="new-item-name-error">{errors.name?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="new-item-article">Artículo del CPP (opcional)</Label>
            <Input
              id="new-item-article"
              inputMode="text"
              maxLength={ITEM_ARTICLE_MAX}
              aria-invalid={errors.article ? true : undefined}
              aria-describedby={
                errors.article
                  ? "new-item-article-help new-item-article-error"
                  : "new-item-article-help"
              }
              {...register("article")}
            />
            <FieldDescription id="new-item-article-help">
              Solo el número, por ejemplo 118 o 167 a 169. Después no se puede cambiar.
            </FieldDescription>
            <FieldError id="new-item-article-error">{errors.article?.message}</FieldError>
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelá</Button>
            </DialogClose>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {add.isPending ? "Agregando…" : "Agregá el ítem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
