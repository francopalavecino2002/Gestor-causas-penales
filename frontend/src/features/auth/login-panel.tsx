import { BrandMark } from "@/components/shell/brand-mark";
import { cn } from "@/lib/utils";

/** A sketch of the day rail (DESIGN.md, direction "Limay"): what the user is about to open. */
const SKETCH = [
  { time: "08:30", title: "Control de la detención", done: true },
  { time: "10:00", title: "Formulación de cargos", done: true },
  { time: "11:30", title: "Revisión de medida cautelar", done: false },
  { time: "13:00", title: "Audiencia de juicio", done: false },
];

/**
 * Brand panel of the login on wide screens (≥ 1024 px). Decorative: the rail is hidden from
 * assistive technology; the only content that matters is in the form next to it.
 */
export function LoginPanel() {
  return (
    <aside className="hidden min-h-dvh flex-col justify-between gap-10 bg-primary px-10 py-10 text-primary-foreground lg:flex xl:px-14 dark:border-r dark:bg-card dark:text-card-foreground">
      <BrandMark inverted />

      <div aria-hidden="true" className="grid max-w-sm gap-6">
        <p className="text-title font-bold">Hoy</p>
        <ol className="relative grid gap-5 border-l-2 border-primary-foreground/35 pl-6 dark:border-border-strong">
          {SKETCH.map((item, index) => (
            <li key={item.time} className="relative grid gap-0.5">
              <span
                className={cn(
                  "absolute top-1.5 -left-[1.95rem] size-3 rounded-full border-2",
                  item.done
                    ? "border-primary-foreground/60 bg-primary dark:border-border-strong dark:bg-card"
                    : "border-primary-foreground bg-primary-foreground dark:border-primary dark:bg-primary",
                )}
              />
              <time className="text-time font-bold">{item.time}</time>
              <span
                className={cn(
                  "text-meta",
                  item.done
                    ? "text-primary-foreground/75 dark:text-muted-foreground"
                    : "font-semibold",
                )}
              >
                {item.title}
              </span>
              {index === 1 && (
                <span className="absolute -bottom-3 -left-7 flex w-[calc(100%+1.75rem)] items-center gap-2">
                  <span className="h-0.5 flex-1 bg-primary-foreground dark:bg-primary" />
                  <span className="text-small font-bold">Ahora</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <p className="max-w-sm text-body text-primary-foreground/85 dark:text-muted-foreground">
        La agenda de audiencias de tu estudio, pensada para la defensa penal en el sistema
        acusatorio de Neuquén.
      </p>
    </aside>
  );
}
