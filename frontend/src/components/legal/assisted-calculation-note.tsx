import { Info } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * The disclaimer every computed deadline carries (CLAUDE.md rule 6): the system assists, the
 * lawyer controls. Show it next to the legal source of the rule.
 */
export function AssistedCalculationNote({ className }: { className?: string }) {
  return (
    <Alert variant="disclaimer" className={className}>
      <Info aria-hidden="true" />
      <AlertDescription>
        <p>
          <strong className="font-bold">Cálculo asistido: verificá con la norma.</strong> El sistema
          propone la fecha; la decisión es tuya.
        </p>
      </AlertDescription>
    </Alert>
  );
}
