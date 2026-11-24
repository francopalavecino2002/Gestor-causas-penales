import { useId } from "react";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { PracticeArea } from "@/features/practice-areas/practice-area-types";
import { cn } from "@/lib/utils";

/** "Fuero: Todos / Penal / Civil y comercial…": the filter of the case list and the agenda. */
export function AreaFilter({
  areas,
  value,
  onChange,
  className,
}: {
  areas: PracticeArea[];
  /** The chosen area's code; empty for every area. */
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("grid w-full gap-1.5", className)}>
      <Label htmlFor={id}>Fuero</Label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos los fueros</option>
        {areas.map((area) => (
          <option key={area.code} value={area.code}>
            {area.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
