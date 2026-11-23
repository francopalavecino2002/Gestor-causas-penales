import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const FIELDS =
  "[data-autofocus], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])";

function firstField(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(FIELDS);
}

/**
 * A form that floats over the screen (DESIGN.md, "sheets and dialogs"): a full-height sheet on
 * phones, so the keyboard and long forms have room, and a centered dialog from 640 px. The
 * header stays on top and the actions stay at the bottom while the fields scroll between them.
 * Radix traps the focus inside, closes on Escape and gives the focus back on close. On open the
 * first field gets the focus; while the form is `busy` loading, the sheet itself holds it and
 * hands it to the first field once the fields appear.
 */
export function FormSheet({
  title,
  description,
  onClose,
  footer,
  children,
  className,
  busy = false,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** The actions (cancel, save); rendered sticky at the bottom. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** The fields are not there yet (catalogs or the record still loading). */
  busy?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  // The button that opened the sheet: rendered on demand, the dialog has no Radix trigger to
  // give the focus back to, so it is remembered here on the first render.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  useEffect(() => {
    const content = contentRef.current;
    // Only take the focus from the sheet itself: never from a field the user is already in.
    if (!busy && content && document.activeElement === content) firstField(content)?.focus();
  }, [busy]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        // The form's first field gets the focus instead of the close button.
        ref={contentRef}
        onCloseAutoFocus={(event) => {
          if (opener?.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
        onOpenAutoFocus={(event) => {
          const content = event.currentTarget as HTMLElement;
          event.preventDefault();
          (firstField(content) ?? content).focus();
        }}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl sm:p-0",
          // Phones: the whole screen, no rounded corners, rising from the bottom.
          "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=open]:slide-in-from-bottom-6",
          className,
        )}
      >
        <DialogHeader className="border-b px-4 pt-4 pb-3.5 sm:px-6 sm:pt-5">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer && (
          <DialogFooter className="border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
