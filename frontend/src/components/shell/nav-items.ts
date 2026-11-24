import {
  Calendar,
  Folder,
  Hourglass,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: "/" | "/causas" | "/plazos" | "/tareas" | "/personas" | "/ajustes";
  label: string;
  icon: LucideIcon;
}

/** Main sections, in the order of the bottom nav and the sidebar (icons from DESIGN.md). */
export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Agenda", icon: Calendar },
  { to: "/causas", label: "Causas", icon: Folder },
  { to: "/plazos", label: "Plazos", icon: Hourglass },
  { to: "/tareas", label: "Tareas", icon: ListChecks },
  { to: "/personas", label: "Personas", icon: Users },
];

/** Shown apart from the main sections: in the sidebar footer and in the mobile user menu. */
export const SETTINGS_NAV: NavItem = { to: "/ajustes", label: "Ajustes", icon: Settings };
