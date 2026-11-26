import { Link } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";

import { MENU_NAV } from "@/components/shell/nav-items";
import { initialsOf } from "@/components/shell/user-initials";
import { useTheme, type ThemePreference } from "@/components/theme/theme-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Me } from "@/features/auth/auth-api";
import { ROLE_LABELS } from "@/features/auth/roles";
import { cn } from "@/lib/utils";

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Según el sistema", icon: Monitor },
];

function Initials({ me }: { me: Me }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-meta font-bold text-accent-foreground"
    >
      {initialsOf(me.displayName, me.email)}
    </span>
  );
}

/** Account menu: who is signed in and with which role, theme, settings and "Cerrar sesión". */
export function UserMenu({
  me,
  variant,
  onLogout,
}: {
  me: Me;
  /** "bar": round initials in the mobile top bar. "sidebar": a full row at the sidebar foot. */
  variant: "bar" | "sidebar";
  onLogout: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const role = ROLE_LABELS[me.role];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tu cuenta: ${me.displayName}, ${role}`}
        className={cn(
          "inline-flex cursor-pointer items-center rounded-lg transition-colors duration-fast ease-out hover:bg-accent",
          variant === "bar"
            ? "size-11 justify-center"
            : "min-h-14 w-full gap-3 px-2 py-1.5 text-left",
        )}
      >
        <Initials me={me} />
        {variant === "sidebar" && (
          <>
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-meta font-bold">{me.displayName}</span>
              <span className="truncate text-small text-muted-foreground">{role}</span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side={variant === "sidebar" ? "top" : "bottom"}>
        <div className="grid gap-0.5 px-3 pt-2 pb-2.5">
          <p className="text-body font-bold">{me.displayName}</p>
          <p className="text-small break-all text-muted-foreground">{me.email}</p>
          <p className="text-small font-semibold text-muted-foreground">{role}</p>
        </div>
        <DropdownMenuSeparator />
        {/* On phones these sections do not fit in the bottom nav; the sidebar lists them. */}
        {variant === "bar" &&
          MENU_NAV.map(({ to, label, icon: Icon }) => (
            <DropdownMenuItem key={to} asChild>
              <Link to={to}>
                <Icon aria-hidden="true" />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
        <DropdownMenuItem asChild>
          <Link to="/ajustes">
            <Settings aria-hidden="true" />
            Ajustes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel aria-hidden="true">Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label="Tema"
          value={theme}
          onValueChange={(value) => setTheme(value as ThemePreference)}
        >
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
