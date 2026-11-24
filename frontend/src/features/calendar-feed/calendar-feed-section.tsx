import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { CircleAlert, Copy, ExternalLink, KeyRound, Link2Off, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FIRM_TIME_ZONE } from "@/features/agenda/agenda-dates";
import { feedUrl, webcalUrl } from "@/features/calendar-feed/calendar-feed-api";
import { calendarFeedErrorMessage } from "@/features/calendar-feed/calendar-feed-errors";
import {
  useCalendarFeed,
  useCreateCalendarFeed,
  useRevokeCalendarFeed,
} from "@/features/calendar-feed/calendar-feed-queries";
import { CalendarInstructions } from "@/features/calendar-feed/calendar-instructions";
import { formatLongDateTime } from "@/features/cases/case-format";
import { useAnnouncement } from "@/features/settings/settings-hooks";
import { SavedStatus, SettingsPage } from "@/features/settings/settings-layout";

/** "lunes 23 de noviembre de 2026, 10:20", to read inside a sentence. */
function sinceLabel(instant: string): string {
  const label = formatLongDateTime(instant, FIRM_TIME_ZONE);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

type ConfirmAction = "regenerate" | "revoke";

/** The link just created: shown once, with a way to copy it and open it in the calendar app. */
function FreshLink({
  url,
  inputRef,
}: {
  url: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const [copyMessage, announceCopy] = useAnnouncement();
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    announceCopy(null);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      announceCopy("Copiado. Pegalo en tu calendario.");
    } catch {
      // No clipboard (an old browser, a page without permission): leave it selected to copy by hand.
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopyFailed(true);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-url`}>Tu enlace privado</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={inputRef}
            id={`${id}-url`}
            readOnly
            value={url}
            aria-describedby={`${id}-once`}
            onFocus={(event) => event.currentTarget.select()}
            className="sm:flex-1"
          />
          <Button onClick={() => void copy()}>
            <Copy aria-hidden="true" />
            Copiá el enlace
          </Button>
        </div>
        <SavedStatus message={copyMessage} />
        {copyFailed && (
          <p role="alert" className="text-meta font-semibold text-foreground">
            No pudimos copiarlo solo. El enlace quedó seleccionado: copialo con Ctrl+C, o en el
            celular mantenelo apretado y elegí Copiar.
          </p>
        )}
      </div>

      <Alert variant="deadline" id={`${id}-once`}>
        <KeyRound aria-hidden="true" />
        <AlertTitle>Guardalo ahora: se muestra una sola vez</AlertTitle>
        <AlertDescription>
          Por seguridad no lo podemos volver a mostrar. Quien tenga el enlace ve tu agenda: no lo
          compartas ni lo publiques. Si se filtra, generá uno nuevo.
        </AlertDescription>
      </Alert>

      <div className="grid gap-1.5">
        <Button variant="outline" asChild className="w-full sm:w-fit">
          <a href={webcalUrl(url)}>
            <ExternalLink aria-hidden="true" />
            Abrí en tu calendario
          </a>
        </Button>
        <p className="max-w-prose text-meta text-muted-foreground">
          En el iPhone, en una Mac o con Outlook instalado, se abre la app de calendario con el
          enlace listo para que te suscribas.
        </p>
      </div>
    </div>
  );
}

/** `/ajustes/calendario`: the member's private iCalendar link (ADR-0034). */
export function CalendarFeedSection() {
  const id = useId();
  const status = useCalendarFeed();
  const create = useCreateCalendarFeed();
  const revoke = useRevokeCalendarFeed();
  const [message, announce] = useAnnouncement();
  /** The full address, kept only in this screen: the server never answers it again. */
  const [url, setUrl] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** The last action asked for: kept while the dialog animates out so its text does not flip. */
  const [action, setAction] = useState<ConfirmAction>("regenerate");
  /** Set when the dialog closes by confirming: focus then goes where the result is, not back. */
  const confirmedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const pending = create.isPending || revoke.isPending;
  const failure = create.error ?? revoke.error;

  // A new address takes the reader to it, once it is on screen.
  useEffect(() => {
    if (url) urlRef.current?.focus();
  }, [url]);

  const askToConfirm = (next: ConfirmAction) => {
    confirmedRef.current = false;
    setAction(next);
    setConfirmOpen(true);
  };

  const createLink = (replacing: boolean) => {
    announce(null);
    revoke.reset();
    create.mutate(undefined, {
      onSuccess: ({ path }) => {
        setUrl(feedUrl(path));
        // The secret lives only in this screen's state, never in the mutation cache.
        create.reset();
        announce(
          replacing
            ? "Listo: generaste un enlace nuevo. El anterior ya no funciona."
            : "Listo: creaste tu enlace. Copialo y pegalo en tu calendario.",
        );
      },
    });
  };

  const revokeLink = () => {
    announce(null);
    create.reset();
    revoke.mutate(undefined, {
      onSuccess: () => {
        setUrl(null);
        announce(
          "Listo: desactivaste el enlace. Borrá la suscripción en cada calendario que lo usaba.",
        );
        headingRef.current?.focus();
      },
    });
  };

  const confirmAndRun = () => {
    confirmedRef.current = true;
    setConfirmOpen(false);
    // While the request runs, focus waits on the card's title; the result moves it on.
    headingRef.current?.focus();
    if (action === "regenerate") createLink(true);
    else revokeLink();
  };

  const data = status.data;

  return (
    <SettingsPage
      section="/ajustes/calendario"
      intro={
        <p>
          Sumá tu agenda a Google Calendar, Outlook o el iPhone y mirá tus audiencias junto al resto
          de tus compromisos. Cada persona del estudio maneja su propio enlace.
        </p>
      }
    >
      {status.isPending ? (
        <Skeleton className="h-48 max-w-3xl rounded-xl" />
      ) : status.isError || !data ? (
        <Alert variant="error" role="alert" className="max-w-3xl">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>No pudimos ver si tenés un enlace activo</AlertTitle>
          <AlertDescription>
            <p>Revisá tu conexión y volvé a intentar.</p>
            <Button variant="outline" className="mt-2 w-fit" onClick={() => void status.refetch()}>
              Volvé a intentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <section
          aria-labelledby={`${id}-title`}
          className="grid max-w-3xl gap-4 rounded-xl border bg-card p-4 md:p-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 ref={headingRef} id={`${id}-title`} tabIndex={-1} className="text-title font-bold">
              Sumá tu agenda a tu calendario
            </h2>
            {data.active ? (
              <Badge variant="efectiva">Enlace activo</Badge>
            ) : (
              <Badge variant="outline">Sin enlace</Badge>
            )}
          </div>
          <SavedStatus message={message} />

          {url ? (
            <FreshLink url={url} inputRef={urlRef} />
          ) : data.active ? (
            <div className="grid max-w-prose gap-2 text-body">
              <p>
                Tenés un enlace activo desde el{" "}
                {data.createdAt ? (
                  <time dateTime={data.createdAt} className="font-semibold">
                    {sinceLabel(data.createdAt)}
                  </time>
                ) : (
                  "día que lo creaste"
                )}
                .
              </p>
              <p className="text-muted-foreground">
                Por seguridad no lo podemos volver a mostrar. Si lo perdiste o querés sumarlo a otro
                calendario, generá uno nuevo: el actual deja de funcionar.
              </p>
            </div>
          ) : (
            <div className="grid max-w-prose gap-2 text-body">
              <p>
                Es un enlace privado que tu calendario consulta solo. Muestra las audiencias en las
                que participás, desde 90 días atrás, y es de solo lectura: lo que cambies en el
                calendario no vuelve al sistema.
              </p>
              <p className="text-muted-foreground">
                Cada app lo actualiza a su ritmo, no al instante: Google Calendar puede tardar
                varias horas en mostrar un cambio. Ante la duda, mirá la agenda del sistema.
              </p>
            </div>
          )}

          {failure && (
            <Alert variant="error" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{calendarFeedErrorMessage(failure)}</AlertDescription>
            </Alert>
          )}

          {data.active ? (
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => askToConfirm("regenerate")}
              >
                <RefreshCw aria-hidden="true" />
                Generá un enlace nuevo
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => askToConfirm("revoke")}>
                <Link2Off aria-hidden="true" />
                Desactivá el enlace
              </Button>
            </div>
          ) : (
            <Button
              className="w-full sm:w-fit"
              disabled={pending}
              onClick={() => createLink(false)}
            >
              Creá tu enlace
            </Button>
          )}
        </section>
      )}

      <CalendarInstructions />
      <CalendarPrivacy />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            // Confirmed: focus is already on the card and moves to the result; cancelled: back to
            // the button that opened the dialog (Radix's default).
            if (confirmedRef.current) event.preventDefault();
          }}
        >
          {action === "revoke" ? (
            <DialogHeader>
              <DialogTitle>¿Desactivás el enlace?</DialogTitle>
              <DialogDescription>
                Los calendarios que lo usan dejan de recibir tus audiencias. Después borrá la
                suscripción en cada uno, para que no queden audiencias viejas a la vista.
              </DialogDescription>
            </DialogHeader>
          ) : (
            <DialogHeader>
              <DialogTitle>¿Generás un enlace nuevo?</DialogTitle>
              <DialogDescription>
                El enlace actual deja de funcionar en los calendarios que lo usan. Vas a tener que
                sumar el nuevo en cada uno.
              </DialogDescription>
            </DialogHeader>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelá</Button>
            </DialogClose>
            {action === "revoke" ? (
              // Irreversible: a deactivated link never works again.
              <Button variant="destructive" onClick={confirmAndRun}>
                Desactivá el enlace
              </Button>
            ) : (
              <Button onClick={confirmAndRun}>Generá el enlace nuevo</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}

/** What reaches Google, Microsoft or Apple (ADR-0034, data minimisation). */
function CalendarPrivacy() {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid max-w-3xl gap-3">
      <h2 id={titleId} className="text-title font-bold">
        Qué datos ve tu calendario
      </h2>
      <ul className="grid max-w-prose list-disc gap-1.5 pl-5 text-body">
        <li>
          Cada audiencia lleva el tipo, el horario, la sala y el estado. Si la causa no es
          reservada, también la carátula, el juez o jueza y la referencia de la OFIJU.
        </li>
        <li>
          La carátula suele nombrar a la persona imputada, y ese dato queda guardado en Google,
          Microsoft o Apple.
        </li>
        <li>
          Una causa reservada aparece como «Causa reservada», sin carátula ni ningún dato que la
          identifique.
        </li>
        <li>Nunca salen los imputados, las notas, los resultados ni el equipo de la causa.</li>
        <li>Cada audiencia termina con un recordatorio: verificá los datos en la agenda.</li>
      </ul>
    </section>
  );
}
