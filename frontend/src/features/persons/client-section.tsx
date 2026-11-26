import { useId, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth/me-query";
import { formatNumericDate } from "@/features/cases/case-format";
import { LoadError } from "@/features/cases/case-states";
import { ClientFormDialog } from "@/features/persons/client-form-dialog";
import { ConflictMatches } from "@/features/persons/conflict-matches";
import { ContactFormDialog } from "@/features/persons/contact-form-dialog";
import type { ClientView, ContactView, PersonListItem } from "@/features/persons/person-api";
import { canArchivePeople, CLIENT_CONFLICT_NOTE } from "@/features/persons/person-format";
import {
  useArchiveContact,
  useClient,
  useSetClientArchived,
} from "@/features/persons/person-queries";
import { Missing, Section, TermList, type Term } from "@/features/persons/person-sections";
import { isApiError, NETWORK_ERROR } from "@/lib/api";

function actionError(error: unknown, what: string): string {
  if (isApiError(error)) {
    if (error.type === NETWORK_ERROR) {
      return `No hay conexión con el servidor, así que no se ${what}. Revisá tu conexión y volvé a intentar.`;
    }
    if (error.status === 403) {
      return "No tenés permiso para esto: archivan y restauran la persona titular y los abogados del estudio.";
    }
    if (error.status === 404) return "Ya no encontramos ese dato. Recargá la página.";
  }
  return `El servidor no respondió como esperábamos y no se ${what}. Volvé a intentar en unos minutos.`;
}

/** One authorized contact, with an inline confirmation before archiving (there is no undo). */
function ContactItem({
  contact,
  clientId,
  onEdit,
}: {
  contact: ContactView;
  clientId: string;
  onEdit: () => void;
}) {
  const titleId = useId();
  const archive = useArchiveContact(clientId);
  const [confirming, setConfirming] = useState(false);
  return (
    <Card asChild>
      <article aria-labelledby={titleId}>
        <div className="grid gap-0.5">
          <h3 id={titleId} className="text-card-title font-bold break-words">
            {contact.fullName}
          </h3>
          {contact.relationship && (
            <p className="text-meta text-muted-foreground">{contact.relationship}</p>
          )}
        </div>
        {(contact.phone || contact.email) && (
          <CardContent className="text-meta">
            {contact.phone && (
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex min-h-11 w-fit items-center gap-2 text-primary underline-offset-4 hover:underline"
              >
                <Phone aria-hidden="true" className="size-4.5 shrink-0" />
                <span className="tabular-nums">{contact.phone}</span>
              </a>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex min-h-11 w-fit min-w-0 items-center gap-2 break-all text-primary underline-offset-4 hover:underline"
              >
                <Mail aria-hidden="true" className="size-4.5 shrink-0" />
                {contact.email}
              </a>
            )}
          </CardContent>
        )}
        <div className="grid gap-0.5 rounded-lg bg-muted px-3.5 py-2.5 text-meta">
          <p className="font-semibold">Se le puede informar</p>
          <p className="break-words whitespace-pre-line">{contact.mayBeTold}</p>
        </div>
        {archive.isError && (
          <p role="alert" className="text-small font-semibold text-destructive">
            {actionError(archive.error, "archivó el contacto")}
          </p>
        )}
        {confirming ? (
          <div
            role="group"
            aria-label={`Confirmá que archivás a ${contact.fullName}`}
            className="grid gap-2 border-t pt-3"
          >
            <p className="text-meta">
              Deja de figurar como contacto autorizado. No se borra: queda en el historial.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={archive.isPending}
                onClick={() => archive.mutate(contact.id)}
              >
                <Archive aria-hidden="true" />
                Sí, archivá el contacto
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancelá
              </Button>
            </div>
          </div>
        ) : (
          <CardFooter>
            <Button variant="outline" aria-label={`Editá a ${contact.fullName}`} onClick={onEdit}>
              <Pencil aria-hidden="true" />
              Editá
            </Button>
            <Button
              variant="ghost"
              aria-label={`Archivá a ${contact.fullName}`}
              onClick={() => setConfirming(true)}
            >
              <Archive aria-hidden="true" />
              Archivá
            </Button>
          </CardFooter>
        )}
      </article>
    </Card>
  );
}

function consentTerms(client: ClientView): Term[] {
  if (!client.consentGivenOn) {
    return [
      {
        term: "Consentimiento",
        value: (
          <span className="text-muted-foreground">Sin registrar. Cargalo cuando lo firme.</span>
        ),
      },
    ];
  }
  return [
    {
      term: "Consentimiento dado el",
      value: <span className="tabular-nums">{formatNumericDate(client.consentGivenOn)}</span>,
    },
    { term: "Para qué", value: client.consentScope ?? <Missing /> },
    { term: "Formulario firmado", value: client.consentDocumentRef ?? <Missing /> },
  ];
}

type ClientDialog = { kind: "client" } | { kind: "contact"; contact?: ContactView } | null;

function ClientDetail({ client, person }: { client: ClientView; person: PersonListItem }) {
  const { data: me } = useMe();
  const canArchive = canArchivePeople(me);
  const setArchived = useSetClientArchived(client.id);
  const [dialog, setDialog] = useState<ClientDialog>(null);
  const close = () => setDialog(null);
  const terms: Term[] = [
    {
      term: "Llegó al estudio el",
      value: <span className="tabular-nums">{formatNumericDate(client.intakeDate)}</span>,
    },
    { term: "Cómo llegó", value: client.referralSource ?? <Missing /> },
  ];

  return (
    <>
      <Section
        title="Cliente"
        action={
          <Button variant="outline" onClick={() => setDialog({ kind: "client" })}>
            <Pencil aria-hidden="true" />
            Editá los datos de cliente
          </Button>
        }
      >
        {client.archived && (
          <Alert variant="info">
            <Archive aria-hidden="true" />
            <AlertTitle>La ficha de cliente está archivada</AlertTitle>
            <AlertDescription>Nada se borró: la ves como quedó al archivarla.</AlertDescription>
          </Alert>
        )}
        {client.conflicts.length > 0 && (
          <ConflictMatches
            matches={client.conflicts}
            disclaimer={CLIENT_CONFLICT_NOTE}
            title={
              client.conflicts.length === 1
                ? "Otra persona del estudio tiene el mismo documento"
                : `Otras ${client.conflicts.length} personas del estudio tienen el mismo documento`
            }
          />
        )}
        <Card>
          <CardContent asChild>
            <TermList className="grid gap-x-8 gap-y-3 text-meta sm:grid-cols-2" terms={terms} />
          </CardContent>
          <div className="grid gap-2.5 border-t pt-3">
            <h3 className="flex items-center gap-2 text-body font-bold">
              <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
              Consentimiento de tratamiento de datos
            </h3>
            <p className="text-small text-muted-foreground">
              Ley 25.326: cuándo autorizó a tratar sus datos personales y para qué.
            </p>
            <TermList terms={consentTerms(client)} />
          </div>
          {canArchive && (
            <CardFooter className="border-t pt-3">
              <Button
                variant="ghost"
                disabled={setArchived.isPending}
                onClick={() => setArchived.mutate(!client.archived)}
              >
                {client.archived ? (
                  <ArchiveRestore aria-hidden="true" />
                ) : (
                  <Archive aria-hidden="true" />
                )}
                {client.archived ? "Restaurá la ficha de cliente" : "Archivá la ficha de cliente"}
              </Button>
              {setArchived.isError && (
                <p role="alert" className="text-small font-semibold text-destructive">
                  {actionError(
                    setArchived.error,
                    client.archived ? "restauró la ficha" : "archivó la ficha",
                  )}
                </p>
              )}
            </CardFooter>
          )}
        </Card>
      </Section>

      <Section
        title="Contactos autorizados"
        action={
          <Button variant="outline" onClick={() => setDialog({ kind: "contact" })}>
            <Plus aria-hidden="true" />
            Agregá un contacto
          </Button>
        }
      >
        {client.contacts.length === 0 ? (
          <p className="max-w-prose text-meta text-muted-foreground">
            Todavía no hay contactos autorizados. Sumá a quien el cliente autorizó a recibir
            información, por ejemplo un familiar, y qué se le puede contar.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {client.contacts.map((contact) => (
              <li key={contact.id} className="grid">
                <ContactItem
                  contact={contact}
                  clientId={client.id}
                  onEdit={() => setDialog({ kind: "contact", contact })}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {dialog?.kind === "client" && (
        <ClientFormDialog
          personId={person.id}
          personName={person.displayName}
          client={client}
          onClose={close}
        />
      )}
      {dialog?.kind === "contact" && (
        <ContactFormDialog
          clientId={client.id}
          clientName={person.displayName}
          contact={dialog.contact}
          onClose={close}
        />
      )}
    </>
  );
}

/**
 * The person's client record: "Registrar como cliente" when there is none; otherwise the intake, the
 * consent to process their data (Ley 25.326), others sharing the document and the authorized
 * contacts.
 */
export function ClientSection({ person }: { person: PersonListItem }) {
  const client = useClient(person.clientId);
  const [making, setMaking] = useState(false);

  if (!person.clientId) {
    return (
      <Section title="Cliente">
        <Card>
          <p className="flex items-start gap-2.5 text-body">
            <UserCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              Todavía no es cliente del estudio. Al registrar como cliente anotás cuándo llegó al
              estudio, el consentimiento para tratar sus datos y a quién se le puede informar.
            </span>
          </p>
          <CardFooter>
            <Button disabled={person.archived} onClick={() => setMaking(true)}>
              <UserCheck aria-hidden="true" />
              Registrar como cliente
            </Button>
            {person.archived && (
              <span className="text-small text-muted-foreground">
                Para registrar como cliente, primero restaurá la ficha de la persona.
              </span>
            )}
          </CardFooter>
        </Card>
        {making && (
          <ClientFormDialog
            personId={person.id}
            personName={person.displayName}
            onClose={() => setMaking(false)}
          />
        )}
      </Section>
    );
  }

  if (client.isPending) {
    return (
      <Section title="Cliente">
        <div
          role="status"
          aria-busy="true"
          aria-label="Cargando los datos de cliente"
          className="grid gap-3"
        >
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </Section>
    );
  }
  if (client.isError) {
    return (
      <Section title="Cliente">
        <LoadError
          title="No pudimos cargar los datos de cliente"
          error={client.error}
          onRetry={() => void client.refetch()}
        />
      </Section>
    );
  }
  return <ClientDetail client={client.data} person={person} />;
}
