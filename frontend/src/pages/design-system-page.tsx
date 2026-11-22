import { Scale } from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ButtonsSection, FormsSection, StatusesSection } from "@/pages/design-system/controls";
import { ColorSection, ShapeSection, TypographySection } from "@/pages/design-system/foundations";
import {
  AlertsSection,
  CardsSection,
  NavigationSection,
  StatesSection,
} from "@/pages/design-system/patterns";

const CONTENTS = [
  { id: "color", label: "Color" },
  { id: "tipografia", label: "Tipografía" },
  { id: "forma", label: "Forma y espacio" },
  { id: "botones", label: "Botones" },
  { id: "formularios", label: "Formularios" },
  { id: "estados", label: "Estados y etiquetas" },
  { id: "alertas", label: "Alertas" },
  { id: "tarjetas", label: "Tarjetas" },
  { id: "pestanas", label: "Pestañas y diálogo" },
  { id: "carga", label: "Carga y vacío" },
];

/** Living style guide: every token and component of the "Limay" design system, in both themes. */
export function DesignSystemPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 md:px-8 md:py-10 lg:grid-cols-[15.5rem_1fr] lg:gap-10 lg:px-10">
      <header className="grid gap-5 lg:col-span-2 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-3">
          <p className="flex items-center gap-2.5 text-meta font-bold">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Scale aria-hidden="true" className="size-5" />
            </span>
            Gestor de causas penales
          </p>
          <h1 className="text-display font-bold">Sistema de diseño</h1>
          <p className="max-w-prose text-body text-muted-foreground">
            Las piezas con las que se arma cada pantalla de la agenda. Todo lo que ves acá usa datos
            ficticios.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <nav aria-label="Secciones" className="hidden lg:block">
        <ul className="sticky top-6 grid gap-0.5">
          {CONTENTS.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="flex min-h-11 items-center rounded-md px-3 text-meta font-semibold text-foreground transition-colors duration-fast ease-out hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="grid min-w-0 gap-10 lg:gap-12">
        <ColorSection />
        <TypographySection />
        <ShapeSection />
        <ButtonsSection />
        <FormsSection />
        <StatusesSection />
        <AlertsSection />
        <CardsSection />
        <NavigationSection />
        <StatesSection />
      </main>
    </div>
  );
}
