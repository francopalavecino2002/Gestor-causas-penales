import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { CloseGuard } from "@/features/two-factor/close-guard";
import { cn } from "@/lib/utils";

/**
 * A dialog that may refuse to close: while a request runs, or while the recovery codes are on
 * screen and not saved, the guard keeps it open for "Cerrar", Escape and a tap outside.
 */
export function GuardedDialog({
  open,
  onOpenChange,
  closeGuardRef,
  onCloseAutoFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closeGuardRef: CloseGuard;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && closeGuardRef.current?.()) return;
        onOpenChange(next);
      }}
    >
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="sm:max-w-xl">
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The step's title, which is the dialog's title. After moving to another step it takes the focus,
 * so keyboard and screen-reader users land on the new content instead of a button that is gone.
 */
export function StepTitle({
  focusOnMount,
  children,
}: {
  focusOnMount: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <DialogTitle ref={ref} tabIndex={-1}>
      {children}
    </DialogTitle>
  );
}

/** "Paso 2 de 4" with one bar per step: the enrollment is a sequence and this says where you are. */
export function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="grid gap-2">
      <p className="text-meta font-semibold text-muted-foreground tabular-nums">
        Paso {current + 1} de {total}
      </p>
      <div aria-hidden="true" className="grid grid-flow-col gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              "block h-1.5 rounded-full",
              index <= current ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
