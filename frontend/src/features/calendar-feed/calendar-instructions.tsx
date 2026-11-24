import { useId, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** A path through an app's menus, e.g. Ajustes › Calendario › Cuentas, read as a list. */
function MenuPath({ items, label }: { items: string[]; label: string }) {
  return (
    <ol aria-label={label} className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5">
      {items.map((item, index) => (
        <li key={item} className="inline-flex items-center gap-x-1">
          {index > 0 && (
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          )}
          <strong className="font-semibold">{item}</strong>
        </li>
      ))}
    </ol>
  );
}

/** The words a button shows in the app, in bold so they are easy to find on screen. */
function Ui({ children }: { children: ReactNode }) {
  return <strong className="font-semibold">{children}</strong>;
}

/** One step; the list already tells assistive tech its number, so the badge is visual only. */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] items-start gap-x-3">
      <span
        aria-hidden="true"
        className="inline-flex size-8 items-center justify-center rounded-full bg-accent text-meta font-bold text-accent-foreground tabular-nums"
      >
        {n}
      </span>
      <div className="min-w-0 pt-1">{children}</div>
    </li>
  );
}

interface AppGuide {
  value: string;
  name: string;
  steps: ReactNode[];
}

/**
 * Kept generic: menus change names between versions, so each step names what the button says
 * today and the app's own help covers the rest.
 */
const GUIDES: AppGuide[] = [
  {
    value: "google",
    name: "Google Calendar",
    steps: [
      <>
        En una computadora, abrí <Ui>calendar.google.com</Ui>. Desde la app del celular no se puede
        sumar un calendario con un enlace.
      </>,
      <>
        <span>En la columna de la izquierda, tocá:</span>
        <MenuPath
          label="Menú de Google Calendar"
          items={["Otros calendarios", "+ (Agregar)", "Desde URL"]}
        />
      </>,
      <>
        Pegá el enlace y tocá <Ui>Agregar calendario</Ui>.
      </>,
      <>
        Aparece también en la app del celular con la misma cuenta. Google lo actualiza por su cuenta
        y puede tardar varias horas en mostrar un cambio.
      </>,
    ],
  },
  {
    value: "outlook",
    name: "Outlook",
    steps: [
      <>
        Abrí Outlook en la web (<Ui>outlook.com</Ui> o el de tu cuenta de Microsoft 365) y entrá al
        calendario.
      </>,
      <>
        <span>Tocá:</span>
        <MenuPath
          label="Menú de Outlook"
          items={["Agregar calendario", "Suscribirse desde la web"]}
        />
      </>,
      <>
        Pegá el enlace, ponele un nombre (por ejemplo, Audiencias) y tocá <Ui>Importar</Ui>.
      </>,
      <>
        Lo ves en Outlook de la computadora y del celular con la misma cuenta. Outlook lo actualiza
        por su cuenta, no al instante.
      </>,
    ],
  },
  {
    value: "iphone",
    name: "iPhone",
    steps: [
      <>
        Lo más simple: creá el enlace desde el iPhone y tocá <Ui>Abrí en tu calendario</Ui>. Si ya
        lo copiaste, seguí con el paso 2.
      </>,
      <>
        <span>Andá a:</span>
        <MenuPath
          label="Ajustes del iPhone"
          items={["Ajustes", "Calendario", "Cuentas", "Agregar cuenta", "Otra"]}
        />
        <span className="mt-1 block text-meta text-muted-foreground">
          En las versiones nuevas, Calendario está dentro de Ajustes, en Apps.
        </span>
      </>,
      <>
        Tocá <Ui>Agregar calendario suscripto</Ui>, pegá el enlace, tocá <Ui>Siguiente</Ui> y
        después <Ui>Guardar</Ui>.
      </>,
    ],
  },
];

/** How to subscribe in each app, one tab per app. */
export function CalendarInstructions() {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid max-w-3xl gap-4">
      <h2 id={titleId} className="text-title font-bold">
        Cómo sumarlo a tu calendario
      </h2>
      <Tabs defaultValue={GUIDES[0]!.value}>
        <TabsList aria-label="Elegí tu calendario">
          {GUIDES.map((guide) => (
            <TabsTrigger key={guide.value} value={guide.value}>
              {guide.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {GUIDES.map((guide) => (
          <TabsContent
            key={guide.value}
            value={guide.value}
            className="rounded-xl border bg-card p-4 md:p-5"
          >
            <ol aria-label={`Pasos en ${guide.name}`} className="grid max-w-prose gap-4 text-body">
              {guide.steps.map((step, index) => (
                <Step key={index} n={index + 1}>
                  {step}
                </Step>
              ))}
            </ol>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
