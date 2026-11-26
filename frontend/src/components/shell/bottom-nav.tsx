import { BOTTOM_NAV } from "@/components/shell/nav-items";
import { SectionLink } from "@/components/shell/nav-link";

/** Phone and tablet navigation (< 1024 px): five sections, 64 px targets, above the home bar. */
export function BottomNav() {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-safe lg:hidden"
    >
      {/* Flex, not five equal columns: each item takes its label's width plus an equal share of
        the rest, so "Novedades" fits a 360 px phone without shrinking the text. */}
      <ul className="mx-auto flex max-w-xl">
        {BOTTOM_NAV.map((item) => (
          <li key={item.to} className="flex-auto">
            <SectionLink item={item} variant="bottom" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
