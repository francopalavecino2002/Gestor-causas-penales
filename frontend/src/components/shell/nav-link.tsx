import { Link } from "@tanstack/react-router";

import type { NavItem } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";

/**
 * Link to a section. TanStack Router sets aria-current="page" on the active one; the styles key
 * off that attribute so the visual state and what screen readers hear never disagree.
 * Agenda ("/") only matches exactly, otherwise it would look active everywhere.
 */
export function SectionLink({
  item,
  variant,
  onNavigate,
}: {
  item: NavItem;
  variant: "sidebar" | "bottom";
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.to === "/" }}
      onClick={onNavigate}
      className={cn(
        variant === "sidebar"
          ? "flex min-h-11 items-center gap-3 rounded-lg px-3 text-body font-semibold text-sidebar-foreground transition-colors duration-fast ease-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-bold aria-[current=page]:text-sidebar-accent-foreground"
          : "group relative flex h-bottom-nav flex-col items-center justify-center gap-0.5 text-small font-semibold text-muted-foreground transition-colors duration-fast ease-out aria-[current=page]:font-bold aria-[current=page]:text-primary",
      )}
    >
      {variant === "bottom" && (
        <span
          aria-hidden="true"
          className="absolute top-0 h-0.75 w-10 rounded-b-full bg-transparent group-aria-[current=page]:bg-primary"
        />
      )}
      <Icon aria-hidden="true" className={variant === "bottom" ? "size-6" : "size-5"} />
      <span>{item.label}</span>
    </Link>
  );
}
