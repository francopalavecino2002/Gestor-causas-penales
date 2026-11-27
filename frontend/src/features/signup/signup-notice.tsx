import { useEffect, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * A screen that replaces a form or a wait with news (sent, confirmed, not valid): an icon, the
 * heading and what to do next. The heading takes the focus so a screen reader reads it next.
 */
export function SignupNotice({
  id,
  icon: Icon,
  title,
  focus = true,
  children,
  actions,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  focus?: boolean;
  children: ReactNode;
  actions: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);

  return (
    <section aria-labelledby={id} className="grid gap-7">
      <header className="grid gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <h1
          id={id}
          ref={heading}
          tabIndex={-1}
          className="text-display font-bold text-balance outline-none"
        >
          {title}
        </h1>
        <div className="grid gap-3 text-body">{children}</div>
      </header>
      <div className="grid gap-3">{actions}</div>
    </section>
  );
}

/**
 * The firm's identifier, shown big: it is what the owner types as "Estudio" at every login, and
 * the one thing of the sign-up they must not lose.
 */
export function FirmSlug({ slug }: { slug: string }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-secondary px-4 py-3.5">
      <p className="text-meta text-muted-foreground">Tu estudio para ingresar</p>
      <p className="text-title font-bold wrap-break-word text-foreground">{slug}</p>
      <p className="text-small text-muted-foreground">
        Lo escribís en «Estudio» cada vez que ingresás.
      </p>
    </div>
  );
}
