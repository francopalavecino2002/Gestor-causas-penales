import { LoadError } from "@/features/cases/case-states";
import { DeadlineGroups, DeadlinesSkeleton } from "@/features/deadlines/deadline-groups";
import { useCaseDeadlines } from "@/features/deadlines/deadline-queries";

/**
 * The case's deadlines, with the same cards and urgency groups as `/plazos`, plus the
 * suspended and met ones (the case shows them all; the deadlines screen only what needs
 * attention). Archived deadlines are left out.
 */
export function CaseDeadlines({ caseId, timeZone }: { caseId: string; timeZone: string }) {
  const deadlines = useCaseDeadlines(caseId);

  if (deadlines.isPending) {
    return <DeadlinesSkeleton count={1} label="Cargando los plazos de la causa" />;
  }
  if (deadlines.isError) {
    return (
      <LoadError
        title="No pudimos cargar los plazos de la causa"
        error={deadlines.error}
        onRetry={() => void deadlines.refetch()}
      />
    );
  }
  if (deadlines.data.length === 0) {
    return (
      <p className="text-body text-muted-foreground">
        Esta causa todavía no tiene plazos cargados. Cuando cargues uno, lo vas a ver acá con su
        fuente legal y en la pantalla de plazos.
      </p>
    );
  }
  return (
    <DeadlineGroups
      deadlines={deadlines.data}
      timeZone={timeZone}
      headingLevel="h3"
      showCase={false}
      columns={false}
    />
  );
}
