import { BrandMark } from "@/components/shell/brand-mark";
import { FirmSwitcher, type FirmSwitchRequest } from "@/components/shell/firm-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import type { Me } from "@/features/auth/auth-api";

/** Phone and tablet header (< 1024 px): brand tile, the firm (switcher) and the account menu. */
export function TopBar({
  me,
  onSwitchFirm,
  onLogout,
}: {
  me: Me;
  onSwitchFirm: (request: FirmSwitchRequest) => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-card pt-safe lg:hidden">
      <div className="flex h-top-bar items-center gap-1 px-2 sm:px-6">
        <BrandMark withName={false} className="ml-2 sm:ml-0" />
        <div className="min-w-0 flex-1">
          <FirmSwitcher me={me} variant="bar" onSwitch={onSwitchFirm} />
        </div>
        <UserMenu me={me} variant="bar" onLogout={onLogout} />
      </div>
    </header>
  );
}
