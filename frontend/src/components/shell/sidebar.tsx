import { BrandMark } from "@/components/shell/brand-mark";
import { FirmSwitcher, type FirmSwitchRequest } from "@/components/shell/firm-switcher";
import { MAIN_NAV, SETTINGS_NAV } from "@/components/shell/nav-items";
import { SectionLink } from "@/components/shell/nav-link";
import { UserMenu } from "@/components/shell/user-menu";
import type { Me } from "@/features/auth/auth-api";

/** Desktop navigation (≥ 1024 px): brand, sections, then settings, firm and user at the foot. */
export function Sidebar({
  me,
  onSwitchFirm,
  onLogout,
}: {
  me: Me;
  onSwitchFirm: (request: FirmSwitchRequest) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-top-bar items-center px-5">
        <BrandMark />
      </div>

      <nav aria-label="Secciones" className="flex-1 overflow-y-auto px-3 pt-4">
        <ul className="grid gap-1">
          {MAIN_NAV.map((item) => (
            <li key={item.to}>
              <SectionLink item={item} variant="sidebar" />
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-3 border-t border-sidebar-border px-3 pt-3 pb-4">
        <nav aria-label="Configuración">
          <SectionLink item={SETTINGS_NAV} variant="sidebar" />
        </nav>
        <FirmSwitcher me={me} variant="sidebar" onSwitch={onSwitchFirm} />
        <UserMenu me={me} variant="sidebar" onLogout={onLogout} />
      </div>
    </aside>
  );
}
