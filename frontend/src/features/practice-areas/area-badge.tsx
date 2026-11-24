import { Landmark } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAreaDirectory } from "@/features/practice-areas/practice-area-queries";
import { cn } from "@/lib/utils";

/**
 * The practice area of a case or hearing ("Civil y comercial"). Only shown when the firm works
 * in more than one area (`always` shows it anyway, e.g. on the case header of another area):
 * with one area it would repeat the same word on every row.
 */
export function AreaBadge({
  code,
  always = false,
  className,
}: {
  code: string | null | undefined;
  always?: boolean;
  className?: string;
}) {
  const directory = useAreaDirectory();
  if (!code || directory.isPending || (!always && !directory.multiple)) return null;
  const name = directory.find(code)?.name ?? code;
  return (
    <Badge variant="outline" className={cn("whitespace-normal", className)}>
      <Landmark aria-hidden="true" />
      <span>
        <span className="sr-only">Fuero: </span>
        {name}
      </span>
    </Badge>
  );
}
