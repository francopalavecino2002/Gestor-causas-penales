import { useEffect, useRef, type ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const IMPORT_STEPS = ["Qué importás", "Subí la planilla", "Revisá y confirmá", "Listo"] as const;

/**
 * Where the user is in the four steps. Phones get a bar per step and one line of text; from
 * 768 px each step shows its number and name. The current step carries aria-current="step".
 */
export function ImportStepper({ current }: { current: number }) {
  return (
    <div className="grid gap-2">
      <p aria-hidden="true" className="text-meta font-semibold text-muted-foreground md:hidden">
        Paso {current + 1} de {IMPORT_STEPS.length}: {IMPORT_STEPS[current]}
      </p>
      <ol
        aria-label="Pasos de la importación"
        className="grid grid-cols-4 gap-1.5 md:flex md:gap-3"
      >
        {IMPORT_STEPS.map((label, index) => {
          const state = index < current ? "done" : index === current ? "current" : "todo";
          return (
            <li
              key={label}
              aria-current={state === "current" ? "step" : undefined}
              className="md:flex md:flex-1 md:items-center md:gap-3 md:last:flex-none"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block h-1.5 rounded-full md:hidden",
                  state === "todo" ? "bg-border" : "bg-primary",
                )}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "hidden size-8 shrink-0 items-center justify-center rounded-full border-2 text-meta font-bold tabular-nums md:inline-flex",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "current" && "border-primary text-primary",
                  state === "todo" && "border-border-strong text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-4.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "sr-only md:not-sr-only md:text-meta md:whitespace-nowrap",
                  state === "current" ? "md:font-bold" : "md:text-muted-foreground",
                )}
              >
                {label}
                {state === "done" && <span className="sr-only"> (hecho)</span>}
              </span>
              {index < IMPORT_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="hidden h-px min-w-4 flex-1 bg-border md:block"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The step's title. After the user moves to another step it takes the focus, so keyboard and
 * screen-reader users land on the new content instead of a button that is gone.
 */
export function StepHeading({
  id,
  focusOnMount,
  children,
}: {
  id: string;
  focusOnMount: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <h2 id={id} ref={ref} tabIndex={-1} className="text-title font-bold text-balance">
      {children}
    </h2>
  );
}
