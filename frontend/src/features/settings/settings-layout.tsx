import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CircleCheck, Eye, LayoutTemplate } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SETTINGS_SECTIONS } from "@/features/settings/settings-copy";
import { useCanEditSettings } from "@/features/settings/settings-hooks";
import { cn } from "@/lib/utils";

/** The result of the last change, kept on screen and announced politely. */
export function SavedStatus({ message }: { message: string | null }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 text-meta font-semibold text-status-efectiva empty:hidden"
    >
      {message && (
        <>
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span>{message}</span>
        </>
      )}
    </p>
  );
}

function ReadOnlyNote() {
  return (
    <Alert>
      <Eye aria-hidden="true" />
      <AlertDescription>
        Podés ver esta configuración. Solo la persona titular del estudio puede cambiarla, porque
        vale para todo el equipo.
      </AlertDescription>
    </Alert>
  );
}

/** Links between the sections from 768 px; on phones, a link back to the index instead. */
function SectionNav({ current }: { current: string }) {
  return (
    <>
      <Link
        to="/ajustes"
        className="inline-flex min-h-11 w-fit items-center gap-1 rounded-lg pr-2 text-meta font-semibold text-primary underline-offset-4 hover:underline md:hidden"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
        Ajustes
      </Link>
      <nav aria-label="Secciones de ajustes" className="hidden md:block">
        <ul className="inline-flex w-fit rounded-lg border bg-secondary p-0.75">
          {SETTINGS_SECTIONS.map((section) => (
            <li key={section.to}>
              <Link
                to={section.to}
                aria-current={section.to === current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-md px-3.5 text-meta font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-fast ease-out hover:text-foreground focus-visible:-outline-offset-3",
                  "aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-segment",
                )}
              >
                <section.icon aria-hidden="true" className="size-5" />
                {section.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/** Frame of every settings section: navigation, title, intro and the read-only note. */
export function SettingsPage({
  section,
  intro,
  children,
}: {
  section: (typeof SETTINGS_SECTIONS)[number]["to"];
  intro: ReactNode;
  children: ReactNode;
}) {
  const canEdit = useCanEditSettings();
  const title = SETTINGS_SECTIONS.find((item) => item.to === section)?.title ?? "Ajustes";
  return (
    <>
      <div className="grid gap-3 md:gap-6">
        <SectionNav current={section} />
        <PageHeader title={title}>
          <div className="max-w-prose">{intro}</div>
        </PageHeader>
      </div>
      {!canEdit && section !== "/ajustes/usuarios" && <ReadOnlyNote />}
      {children}
    </>
  );
}

/** `/ajustes`: what can be configured, one row per section. */
export function SettingsHomePage() {
  const canEdit = useCanEditSettings();
  return (
    <>
      <PageHeader title="Ajustes">
        <p className="max-w-prose">
          {canEdit
            ? "Configurá cómo trabaja tu estudio. Los cambios valen para todo el equipo."
            : "Mirá cómo está configurado tu estudio. Solo la persona titular puede cambiarlo."}
        </p>
      </PageHeader>

      <nav aria-label="Secciones de ajustes" className="max-w-3xl">
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {SETTINGS_SECTIONS.map(({ to, title, summary, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex min-h-11 items-center gap-4 px-4 py-4 transition-colors duration-fast ease-out hover:bg-accent focus-visible:-outline-offset-3"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-card-title font-bold">{title}</span>
                  <span className="text-meta text-muted-foreground">{summary}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
          <li className="flex items-center gap-4 px-4 py-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <LayoutTemplate aria-hidden="true" className="size-6" />
            </span>
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-card-title font-bold">Plantillas por tipo de causa</span>
                <Badge variant="outline">Todavía no disponible</Badge>
              </span>
              <span className="text-meta text-muted-foreground">
                Van a preseleccionar los campos propios según el tipo de causa. Llegan en una
                próxima versión; mientras tanto, los campos propios valen para todas las causas.
              </span>
            </span>
          </li>
        </ul>
      </nav>
    </>
  );
}
