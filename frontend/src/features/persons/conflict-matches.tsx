import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { Info, ShieldCheck, ShieldExclamationPoint } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArchivedBadge } from "@/features/cases/case-badges";
import { CaseRoleList } from "@/features/persons/case-role-list";
import { ClientBadge } from "@/features/persons/person-badges";
import type { DocumentMatch } from "@/features/persons/person-api";
import { documentLabel } from "@/features/persons/person-format";

function MatchItem({ match, linkPersons }: { match: DocumentMatch; linkPersons: boolean }) {
  const titleId = useId();
  const document = documentLabel(match.documentType, match.documentNumber);
  return (
    <li>
      <article
        aria-labelledby={titleId}
        className="grid gap-2 rounded-lg border bg-card px-3.5 py-3"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 id={titleId} className="text-body font-bold">
            {linkPersons ? (
              <Link
                to="/personas/$personId"
                params={{ personId: match.personId }}
                className="text-primary underline-offset-4 hover:underline"
              >
                {match.displayName}
              </Link>
            ) : (
              match.displayName
            )}
          </h3>
          {match.client && <ClientBadge />}
          {match.archived && <ArchivedBadge />}
        </div>
        {document && <p className="text-meta text-muted-foreground tabular-nums">{document}</p>}
        <CaseRoleList roles={match.caseRoles} empty="No figura en ninguna causa del estudio." />
      </article>
    </li>
  );
}

/**
 * What the conflict check found: each person of the firm with the same document, whether they are
 * a client and their roles in cases; then the backend's disclaimer, verbatim. With no matches it
 * says so, still with the disclaimer: the check is an aid, the lawyer decides.
 */
export function ConflictMatches({
  matches,
  disclaimer,
  title,
  linkPersons = true,
  live = false,
}: {
  matches: DocumentMatch[];
  disclaimer: string;
  /** Overrides the default title, e.g. for the conflicts of a client. */
  title?: string;
  /** Link each person to their detail (off inside a form that would lose its data). */
  linkPersons?: boolean;
  /** Announce the result: it appears after an action. */
  live?: boolean;
}) {
  const found = matches.length > 0;
  const heading =
    title ??
    (found
      ? matches.length === 1
        ? "Ya hay 1 persona con este documento"
        : `Ya hay ${matches.length} personas con este documento`
      : "No hay otras personas con este documento");
  return (
    <div aria-live={live ? "polite" : undefined} className="grid gap-3">
      <Alert variant="info" className={found ? "border-border-strong" : undefined}>
        {found ? <ShieldExclamationPoint aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
        <AlertTitle>{heading}</AlertTitle>
        <AlertDescription>
          <p className="text-meta text-muted-foreground">
            {found
              ? "Mirá en qué causas figuran y con qué rol antes de seguir."
              : "Nadie del estudio tiene cargado ese número, archivadas incluidas."}
          </p>
        </AlertDescription>
      </Alert>
      {found && (
        <ul aria-label="Personas con el mismo documento" className="grid gap-2.5">
          {matches.map((match) => (
            <MatchItem key={match.personId} match={match} linkPersons={linkPersons} />
          ))}
        </ul>
      )}
      <p className="flex items-start gap-2 text-small text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
        <span>{disclaimer}</span>
      </p>
    </div>
  );
}
