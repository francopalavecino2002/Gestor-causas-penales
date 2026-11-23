import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { CasesEmpty } from "@/features/cases/case-states";
import { DoneStep } from "@/features/imports/done-step";
import { FileStep } from "@/features/imports/file-step";
import { kindOption } from "@/features/imports/import-copy";
import {
  importProblem,
  isImportForbidden,
  reportOfFailedCommit,
} from "@/features/imports/import-errors";
import { useCanImport } from "@/features/imports/import-hooks";
import { useCommitImport, usePreviewImport } from "@/features/imports/import-queries";
import { ImportStepper } from "@/features/imports/import-stepper";
import type { ImportKind, ImportReport } from "@/features/imports/import-types";
import { KindStep } from "@/features/imports/kind-step";
import { ReviewStep } from "@/features/imports/review-step";

type WizardState =
  | { step: "kind" }
  | { step: "file"; kind: ImportKind }
  | { step: "review"; kind: ImportKind; file: File; report: ImportReport }
  | { step: "done"; kind: ImportKind; report: ImportReport };

const STEP_INDEX: Record<WizardState["step"], number> = { kind: 0, file: 1, review: 2, done: 3 };

function Header() {
  return (
    <PageHeader title="Importar planillas">
      <p className="max-w-prose">
        Traé las personas, causas y audiencias que ya tenés en Excel. Antes de guardar revisamos
        cada fila y te decimos qué corregir.
      </p>
    </PageHeader>
  );
}

function NotAllowed() {
  return (
    <>
      <Header />
      <CasesEmpty
        icon={Lock}
        title="No tenés permiso para importar planillas"
        description="Importar crea muchos registros de una vez, por eso solo pueden hacerlo la persona titular y los abogados del estudio. Pedile a alguno de ellos que suba la planilla."
      >
        <Button asChild variant="outline">
          <Link to="/">Volvé a la agenda</Link>
        </Button>
      </CasesEmpty>
    </>
  );
}

/**
 * The four steps. The file stays in memory between the check and the confirmation and is sent
 * again to save: the server keeps nothing of a preview (ADR-0019).
 */
function ImportWizard() {
  const [kind, setKind] = useState<ImportKind | null>(null);
  const [state, setState] = useState<WizardState>({ step: "kind" });
  // The first step keeps the focus where the page put it; later steps take it.
  const [moved, setMoved] = useState(false);
  // Bumped on every move so a replaced report remounts its step and takes the focus again.
  const [revision, setRevision] = useState(0);
  const [checking, setChecking] = useState<File | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const preview = usePreviewImport();
  const commit = useCommitImport();

  const go = (next: WizardState) => {
    setMoved(true);
    setRevision((current) => current + 1);
    setState(next);
  };

  const onDenied = (error: unknown) => {
    if (isImportForbidden(error)) setForbidden(true);
  };

  const check = (importKind: ImportKind, file: File) => {
    commit.reset();
    setChecking(file);
    preview.mutate(
      { kind: importKind, file },
      {
        onSuccess: (report) => go({ step: "review", kind: importKind, file, report }),
        onError: onDenied,
        onSettled: () => setChecking(null),
      },
    );
  };

  const confirm = (importKind: ImportKind, file: File) => {
    commit.mutate(
      { kind: importKind, file },
      {
        onSuccess: (report) => go({ step: "done", kind: importKind, report }),
        onError: (error) => {
          onDenied(error);
          const report = reportOfFailedCommit(error);
          if (report) go({ step: "review", kind: importKind, file, report });
        },
      },
    );
  };

  const toFile = (importKind: ImportKind) => {
    preview.reset();
    commit.reset();
    setKind(importKind);
    go({ step: "file", kind: importKind });
  };

  if (forbidden) return <NotAllowed />;

  // On the review step: a failed confirmation, or a failed new check of the same file.
  const reviewError = commit.error ?? preview.error;

  return (
    <>
      <Header />
      <div className="grid max-w-3xl gap-6">
        <ImportStepper current={STEP_INDEX[state.step]} />

        {state.step === "kind" && (
          <KindStep
            value={kind}
            focusOnMount={moved}
            onChange={setKind}
            onContinue={() => kind && toFile(kind)}
          />
        )}

        {state.step === "file" && (
          <FileStep
            option={kindOption(state.kind)}
            focusOnMount={moved}
            checking={checking}
            serverProblem={preview.isError ? importProblem(preview.error) : null}
            onFile={(file) => check(state.kind, file)}
            onBack={() => {
              preview.reset();
              go({ step: "kind" });
            }}
          />
        )}

        {state.step === "review" && (
          <ReviewStep
            key={revision}
            option={kindOption(state.kind)}
            file={state.file}
            report={state.report}
            focusOnMount={moved}
            committing={commit.isPending}
            rechecking={checking !== null}
            commitProblem={reviewError ? importProblem(reviewError) : null}
            canRecheck={reviewError !== null && !reportOfFailedCommit(reviewError)}
            onConfirm={() => confirm(state.kind, state.file)}
            onRecheck={() => check(state.kind, state.file)}
            onReupload={() => toFile(state.kind)}
          />
        )}

        {state.step === "done" && (
          <DoneStep
            option={kindOption(state.kind)}
            report={state.report}
            onNext={(next) => toFile(next.kind)}
            onRestart={() => {
              preview.reset();
              commit.reset();
              setKind(null);
              go({ step: "kind" });
            }}
          />
        )}
      </div>
    </>
  );
}

/** `/importar`: bulk load from CSV or Excel. Only the owner and lawyers (ADR-0019). */
export function ImportPage() {
  const canImport = useCanImport();
  return canImport ? <ImportWizard /> : <NotAllowed />;
}
