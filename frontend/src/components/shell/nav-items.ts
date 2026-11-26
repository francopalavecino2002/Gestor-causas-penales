import {
  Calculator,
  Calendar,
  Folder,
  Hourglass,
  ListChecks,
  Newspaper,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to:
    | "/"
    | "/causas"
    | "/plazos"
    | "/tareas"
    | "/novedades"
    | "/personas"
    | "/honorarios"
    | "/ajustes";
  label: string;
  icon: LucideIcon;
}

const PERSONS_NAV: NavItem = { to: "/personas", label: "Personas", icon: Users };
const FEES_NAV: NavItem = { to: "/honorarios", label: "Honorarios", icon: Calculator };

/** Main sections, in the order of the sidebar (icons from DESIGN.md). */
export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Agenda", icon: Calendar },
  { to: "/causas", label: "Causas", icon: Folder },
  { to: "/plazos", label: "Plazos", icon: Hourglass },
  { to: "/tareas", label: "Tareas", icon: ListChecks },
  { to: "/novedades", label: "Novedades", icon: Newspaper },
  PERSONS_NAV,
  FEES_NAV,
];

/** Sections the phone reaches from the account menu instead of the bottom nav. */
export const MENU_NAV: NavItem[] = [PERSONS_NAV, FEES_NAV];

/**
 * The phone's bottom nav: five items are what fits from 360 px (ADR-0037), so Personas (still a
 * placeholder screen, ADR-0039) and Honorarios (a tool, not a daily section; T50) move to the
 * account menu there.
 */
export const BOTTOM_NAV: NavItem[] = MAIN_NAV.filter((item) => !MENU_NAV.includes(item));

/** Shown apart from the main sections: in the sidebar footer and in the mobile user menu. */
export const SETTINGS_NAV: NavItem = { to: "/ajustes", label: "Ajustes", icon: Settings };
