import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HearingStatusBadge } from "@/components/hearing/hearing-status-badge";
import { HEARING_STATUSES, type HearingStatus } from "@/components/hearing/hearing-status";
import { Badge } from "@/components/ui/badge";

describe("HearingStatusBadge", () => {
  it.each<[HearingStatus, string, string]>([
    ["solicitada", "Solicitada", "programada"],
    ["programada", "Programada", "programada"],
    ["reprogramada", "Reprogramada", "reprogramada"],
    ["cuarto-intermedio", "Cuarto intermedio", "reprogramada"],
    ["efectiva", "Efectiva", "efectiva"],
    ["reconvertida", "Reconvertida", "efectiva"],
    ["suspendida", "Suspendida", "suspendida"],
    ["cancelada", "Cancelada", "suspendida"],
  ])("shows %s as the word %s with the %s tone", (status, label, tone) => {
    render(<HearingStatusBadge status={status} />);

    const badge = screen.getByText(label);
    expect(badge).toHaveAttribute("data-variant", tone);
    expect(badge).toHaveAttribute("data-status", status);
    expect(badge).toHaveClass(`text-status-${tone}`, `bg-status-${tone}-soft`);
  });

  it("covers every status of the catalog", () => {
    render(
      <>
        {HEARING_STATUSES.map((status) => (
          <HearingStatusBadge key={status} status={status} />
        ))}
      </>,
    );

    expect(document.querySelectorAll("[data-slot=badge]")).toHaveLength(HEARING_STATUSES.length);
  });
});

describe("Badge", () => {
  it("uses the reserved detained colors only for the detained variant", () => {
    render(
      <>
        <Badge variant="detained">En prisión preventiva</Badge>
        <Badge variant="deadline">Vence el lunes 14/12</Badge>
        <Badge>Archivado</Badge>
      </>,
    );

    expect(screen.getByText("En prisión preventiva")).toHaveClass(
      "text-detained",
      "bg-detained-soft",
    );
    expect(screen.getByText("Vence el lunes 14/12")).toHaveClass("text-deadline");
    expect(screen.getByText("Archivado")).toHaveAttribute("data-variant", "neutral");
  });
});
