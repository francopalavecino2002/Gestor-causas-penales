import {
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
  to: "/" | "/causas" | "/plazos" | "/tareas" | "/novedades" | "/personas" | "/ajustes";
  label: string;
  icon: LucideIcon;
}

const PERSONS_NAV: NavItem = { to: "/personas", label: "Personas", icon: Users };

/** Main sections, in the order of the sidebar (icons from DESIGN.md). */
export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Agenda", icon: Calendar },
  { to: "/causas", label: "Causas", icon: Folder },
  { to: "/plazos", label: "Plazos", icon: Hourglass },
  { to: "/tareas", label: "Tareas", icon: ListChecks },
  { to: "/novedades", label: "Novedades", icon: Newspaper },
  PERSONS_NAV,
];

/**
 * The phone's bottom nav: five items are what fits from 360 px (ADR-0037), so Personas (still a
 * placeholder screen) moves to the account menu there (ADR-0039).
 */
export const BOTTOM_NAV: NavItem[] = MAIN_NAV.filter((item) => item !== PERSONS_NAV);

/** Sections the phone reaches from the account menu instead of the bottom nav. */
export const MENU_NAV: NavItem[] = [PERSONS_NAV];

/** Shown apart from the main sections: in the sidebar footer and in the mobile user menu. */
export const SETTINGS_NAV: NavItem = { to: "/ajustes", label: "Ajustes", icon: Settings };
