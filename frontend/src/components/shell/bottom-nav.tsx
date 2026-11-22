import { MAIN_NAV } from "@/components/shell/nav-items";
import { SectionLink } from "@/components/shell/nav-link";

/** Phone and tablet navigation (< 1024 px): four sections, 64 px targets, above the home bar. */
export function BottomNav() {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-safe lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {MAIN_NAV.map((item) => (
          <li key={item.to}>
            <SectionLink item={item} variant="bottom" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
