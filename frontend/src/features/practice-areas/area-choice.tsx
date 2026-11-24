import { Info } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { reviewTags } from "@/features/catalogs/catalog-format";
import type { PracticeArea } from "@/features/practice-areas/practice-area-types";

const card =
  "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card px-3.5 py-3 transition-colors duration-fast ease-out hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

/**
 * "¿De qué fuero es?": one radio card per enabled area, with its law and review tags. The caller
 * only shows it when the firm works in more than one area.
 */
export function AreaChoice({
  areas,
  field,
  legend = "Fuero",
}: {
  areas: PracticeArea[];
  field: UseFormRegisterReturn;
  legend?: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-body font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {areas.map((area) => {
          const tags = reviewTags(area.flags);
          return (
            <label key={area.code} className={card}>
              <input
                type="radio"
                value={area.code}
                className="mt-1 size-4.5 shrink-0 accent-primary focus-visible:outline-none"
                {...field}
              />
              <span className="grid min-w-0 gap-0.5">
                <span className="text-body font-semibold">{area.name}</span>
                <span className="text-small text-muted-foreground">
                  {area.law}
                  {tags && (
                    <>
                      {" "}
                      <span className="font-bold whitespace-nowrap text-deadline">{tags}</span>
                    </>
                  )}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The caveat of a draft area ("Borrador sin validar..."), kept visible next to its records. */
export function AreaDraftNote({ area }: { area: PracticeArea | undefined }) {
  if (!area?.note) return null;
  const tags = reviewTags(area.flags);
  return (
    <p className="flex max-w-prose items-start gap-2 text-small text-muted-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
      <span>
        {area.note}
        {tags && (
          <>
            {" "}
            <span className="font-bold whitespace-nowrap text-deadline">{tags}</span>
          </>
        )}
      </span>
    </p>
  );
}
