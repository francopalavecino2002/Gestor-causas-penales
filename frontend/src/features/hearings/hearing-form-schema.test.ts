import { describe, expect, it } from "vitest";

import { FIRM_TIME_ZONE } from "@/features/agenda/agenda-dates";
import type { HearingDetail } from "@/features/hearings/hearing-api";
import {
  durationLabel,
  hearingFormDefaults,
  hearingFormSchema,
  hearingRequestOf,
  offeredStatus,
  rescheduleBlock,
} from "@/features/hearings/hearing-form-schema";
import { CASE_MODELO, HEARINGS_BY_CASE } from "@/test/case-fixtures";

const HELD: HearingDetail = {
  ...HEARINGS_BY_CASE[CASE_MODELO.id]![1]!,
  requestedBy: null,
  clashes: [],
};
const SCHEDULED: HearingDetail = {
  ...HEARINGS_BY_CASE[CASE_MODELO.id]![0]!,
  statusCode: "programada",
  requestedBy: null,
  clashes: [],
};

describe("hearing form rules", () => {
  it("keeps the result while the status allows it and drops it otherwise", () => {
    const values = hearingFormSchema.parse(
      hearingFormDefaults({ hearing: HELD, timeZone: FIRM_TIME_ZONE }),
    );
    expect(hearingRequestOf(values, FIRM_TIME_ZONE, HELD)).toEqual({
      data: expect.objectContaining({
        startsAt: HELD.startsAt,
        statusCode: "efectiva",
        resultSummary: HELD.resultSummary,
      }),
    });
    const suspended = {
      ...values,
      statusCode: "suspendida",
      cancellationReasonCode: "pedido-del-fiscal",
    };
    expect(hearingRequestOf(suspended, FIRM_TIME_ZONE, HELD).data).toMatchObject({
      resultSummary: null,
      cancellationReasonCode: "pedido-del-fiscal",
    });
  });

  it("keeps the saved date in an edit that does not move it", () => {
    const values = hearingFormSchema.parse(
      hearingFormDefaults({ hearing: SCHEDULED, timeZone: FIRM_TIME_ZONE }),
    );
    const request = hearingRequestOf(values, FIRM_TIME_ZONE, SCHEDULED);
    expect(request.reschedule).toBeUndefined();
    expect(request.data).toMatchObject({ startsAt: SCHEDULED.startsAt, statusCode: "programada" });
  });

  it("moves the date with a reschedule, and the edit after it says what the backend holds", () => {
    const values = hearingFormSchema.parse({
      ...hearingFormDefaults({ hearing: SCHEDULED, timeZone: FIRM_TIME_ZONE }),
      date: "2026-11-24",
      time: "10:15",
    });
    const request = hearingRequestOf(values, FIRM_TIME_ZONE, SCHEDULED);
    expect(request.reschedule).toEqual({ startsAt: "2026-11-24T13:15:00.000Z", reason: null });
    expect(request.data).toMatchObject({
      startsAt: "2026-11-24T13:15:00.000Z",
      statusCode: "reprogramada",
      cancellationReasonCode: null,
    });
  });

  it("does not move a hearing whose status cannot be rescheduled or is changing too", () => {
    expect(rescheduleBlock("programada", SCHEDULED)).toBeNull();
    // A suspended hearing gets a new date and becomes «reprogramada».
    expect(rescheduleBlock("suspendida", { ...SCHEDULED, statusCode: "suspendida" })).toBeNull();
    expect(rescheduleBlock("efectiva", HELD)).toMatch(/ya tiene resultado no se reprograma/);
    expect(rescheduleBlock("cancelada", { ...SCHEDULED, statusCode: "cancelada" })).toMatch(
      /cancelada no se reprograma/,
    );
    for (const status of [
      "efectiva",
      "cuarto-intermedio",
      "suspendida",
      "cancelada",
      "solicitada",
    ]) {
      expect(rescheduleBlock(status, SCHEDULED)).toMatch(/dejá el estado como estaba/);
    }
  });

  it("offers neither «reprogramada» nor «reconvertida» unless it is the current status", () => {
    expect(offeredStatus("programada")).toBe(true);
    expect(offeredStatus("reprogramada")).toBe(false);
    expect(offeredStatus("reprogramada", "reprogramada")).toBe(true);
    expect(offeredStatus("reconvertida", "programada")).toBe(false);
  });

  it("reads durations as lawyers say them", () => {
    expect(durationLabel(45)).toBe("45 minutos");
    expect(durationLabel(60)).toBe("1 hora");
    expect(durationLabel(90)).toBe("1 hora y 30 minutos");
    expect(durationLabel(480)).toBe("8 horas");
  });
});
