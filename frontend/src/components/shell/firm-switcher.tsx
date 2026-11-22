import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Eraser, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Me } from "@/features/auth/auth-api";
import { forgetFirm, readRememberedFirms } from "@/features/firms/remembered-firms";
import { cn } from "@/lib/utils";

export interface FirmSwitchRequest {
  /** Firm to prefill on the login; omitted for "Ingresar a otro estudio". */
  estudio?: string;
  /** Runs after the session is closed. */
  onSignedOut?: () => void;
}

/**
 * The firm this session belongs to, and the way to another one. An account belongs to one firm
 * (ADR-0022), so switching closes this session and opens the login with the other firm filled in.
 */
export function FirmSwitcher({
  me,
  variant,
  onSwitch,
}: {
  me: Me;
  variant: "bar" | "sidebar";
  onSwitch: (request: FirmSwitchRequest) => void;
}) {
  const [confirmForget, setConfirmForget] = useState(false);
  // Read when the menu opens so a firm remembered in another tab shows up too.
  const [others, setOthers] = useState(() => otherFirms(me.tenant.slug));
  const { name, slug } = me.tenant;

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && setOthers(otherFirms(slug))}>
        <DropdownMenuTrigger
          aria-label={`Estudio: ${name}. Cambiar de estudio`}
          className={cn(
            "flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg text-left transition-colors duration-fast ease-out hover:bg-accent",
            variant === "bar" ? "px-2" : "w-full border px-3 py-2",
          )}
        >
          {variant === "sidebar" && (
            <Building2 aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          )}
          <span className="grid min-w-0 flex-1">
            {variant === "sidebar" && (
              <span className="text-small text-muted-foreground">Estudio</span>
            )}
            <span
              className={cn(
                "text-meta font-bold",
                // The sidebar has room for two lines; firm names are often long.
                variant === "sidebar" ? "line-clamp-2 break-words" : "truncate",
              )}
            >
              {name}
            </span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side={variant === "sidebar" ? "top" : "bottom"}>
          <DropdownMenuLabel>Estudio actual</DropdownMenuLabel>
          <div className="flex items-start gap-3 rounded-md px-3 py-2">
            <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="grid min-w-0">
              <span className="text-meta font-bold">{name}</span>
              <span className="text-small break-all text-muted-foreground">{slug}</span>
            </span>
          </div>

          {others.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Otros estudios en este dispositivo</DropdownMenuLabel>
              {others.map((firm) => (
                <DropdownMenuItem
                  key={firm.slug}
                  onSelect={() => onSwitch({ estudio: firm.slug })}
                  className="items-start"
                >
                  <Building2 aria-hidden="true" className="mt-0.5 text-muted-foreground" />
                  <span className="grid min-w-0">
                    <span className="font-semibold">{firm.name}</span>
                    <span className="text-small break-all text-muted-foreground">
                      {firm.lastEmail || firm.slug}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onSwitch({})}>
            <LogIn aria-hidden="true" />
            Ingresar a otro estudio
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmForget(true)}>
            <Eraser aria-hidden="true" />
            Olvidar este estudio en este dispositivo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmForget} onOpenChange={setConfirmForget}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Olvidar este estudio en este dispositivo</DialogTitle>
            <DialogDescription>
              Se cierra la sesión y este dispositivo deja de recordar {name} y tu email. Tu cuenta y
              los datos del estudio no cambian. Usalo en un equipo prestado o compartido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setConfirmForget(false);
                onSwitch({ onSignedOut: () => forgetFirm(slug) });
              }}
            >
              Cerrá la sesión y olvidá el estudio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function otherFirms(currentSlug: string) {
  return readRememberedFirms().filter((firm) => firm.slug !== currentSlug);
}
