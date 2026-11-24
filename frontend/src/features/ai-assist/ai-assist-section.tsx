import { useId } from "react";
import { CircleAlert, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAiAssist, useChangeAiAssist } from "@/features/ai-assist/ai-assist-queries";
import { settingsErrorMessage } from "@/features/settings/settings-errors";
import { useAnnouncement, useCanEditSettings } from "@/features/settings/settings-hooks";
import { SavedStatus, SettingsPage } from "@/features/settings/settings-layout";

/** What the assistance does and what it never does, written for a lawyer. */
function Rules({ provider }: { provider: string }) {
  return (
    <ul className="grid max-w-prose list-disc gap-1.5 pl-5 text-body">
      <li>
        Hoy hace una sola cosa: al cargar una audiencia, pegás la notificación de la OFIJU o del
        SINE y completa el formulario.
      </li>
      <li>Nunca guarda nada sola: vos revisás cada dato y guardás.</li>
      <li>
        Solo se envía el texto que pegás y los nombres de tus tipos de audiencia, a {provider}. El
        texto no se guarda en el sistema.
      </li>
      <li>Cada uso queda registrado: quién, cuándo y en qué causa.</li>
      <li>No redacta escritos ni busca jurisprudencia.</li>
    </ul>
  );
}

/** `/ajustes/ia`: the firm's switch for the optional AI assistance (ADR-0033). */
export function AiAssistSection() {
  const id = useId();
  const canEdit = useCanEditSettings();
  const status = useAiAssist();
  const change = useChangeAiAssist();
  const [message, announce] = useAnnouncement();
  const data = status.data;

  const toggle = (enabled: boolean) => {
    announce(null);
    change.mutate(enabled, {
      onSuccess: () =>
        announce(
          enabled
            ? "Guardado: el asistente de IA está activado."
            : "Guardado: el asistente de IA está desactivado.",
        ),
    });
  };

  return (
    <SettingsPage
      section="/ajustes/ia"
      intro={
        <p>
          Una ayuda opcional para no cargar dos veces lo que ya dice una notificación. Viene
          desactivada: la persona titular decide si el estudio la usa.
        </p>
      }
    >
      {status.isPending ? (
        <Skeleton className="h-40 max-w-3xl rounded-xl" />
      ) : status.isError || !data ? (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>
            No pudimos cargar esta configuración. Recargá la página.
          </AlertDescription>
        </Alert>
      ) : (
        <section
          aria-labelledby={`${id}-title`}
          className="grid max-w-3xl gap-4 rounded-xl border bg-card p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 id={`${id}-title`} className="text-title font-bold">
              Cargar audiencias desde una notificación
            </h2>
            {!data.available ? (
              <Badge variant="neutral">No disponible</Badge>
            ) : data.enabled ? (
              <Badge variant="efectiva">Activado</Badge>
            ) : (
              <Badge variant="outline">Desactivado</Badge>
            )}
          </div>
          <Rules provider={data.provider} />

          <Alert variant="deadline">
            <ShieldAlert aria-hidden="true" />
            <AlertTitle>Solo con datos ficticios por ahora</AlertTitle>
            <AlertDescription>
              Los antecedentes penales son datos sensibles (Ley 25.326, art. 7). Hasta tener la
              consulta legal y un plan pago del proveedor que no use los textos para entrenar, usalo
              solo para probar con datos inventados.
            </AlertDescription>
          </Alert>

          {data.available ? (
            <div className="flex min-h-11 items-center gap-3">
              <Switch
                id={`${id}-enabled`}
                checked={data.enabled}
                disabled={!canEdit || change.isPending}
                onCheckedChange={toggle}
              />
              <Label htmlFor={`${id}-enabled`} className="cursor-pointer">
                Activado en el estudio
              </Label>
            </div>
          ) : (
            <p className="max-w-prose text-meta text-muted-foreground">
              Esta instalación no tiene un proveedor de IA configurado, así que no se puede activar.
            </p>
          )}

          <SavedStatus message={message} />
          {change.isError && (
            <Alert variant="error" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{settingsErrorMessage(change.error)}</AlertDescription>
            </Alert>
          )}
        </section>
      )}
    </SettingsPage>
  );
}
