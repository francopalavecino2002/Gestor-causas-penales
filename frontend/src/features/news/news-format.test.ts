import { describe, expect, it } from "vitest";

import { FIRM_TIME_ZONE } from "@/features/agenda/agenda-dates";
import {
  bulkOpenedSentence,
  collapseBulk,
  dayHeading,
  detaineeFirst,
  dueText,
  groupNewsByDay,
  newsSentence,
  remainingText,
  timeLabel,
  uniqueById,
} from "@/features/news/news-format";
import type { NewsItem } from "@/features/news/news-types";
import { FIXTURE_NOW, LAWYER_LUCIA } from "@/test/agenda-fixtures";
import {
  ALL_DUE_SOON,
  ALL_NEWS,
  DUE_SOON_CONTROL,
  DUE_SOON_EVIDENCE,
  NEWS_IMPORTED,
  NEWS_OPENED,
  NEWS_POST_MEETING,
  NEWS_RESCHEDULED,
  NEWS_RESULT,
  NEWS_SCHEDULED,
  NEWS_SEEDED,
} from "@/test/news-fixtures";

const ZONE = FIRM_TIME_ZONE;
const ME = LAWYER_LUCIA.id;
const NOW = new Date(FIXTURE_NOW); // Monday 23 November 2026, 10:20 in Neuquén
const PAULA_ACTOR = NEWS_IMPORTED[0]?.actor ?? null;

describe("newsSentence", () => {
  it("says who did what, in the firm's zone", () => {
    expect(newsSentence(NEWS_OPENED, ZONE, ME)).toBe("Hugo Prueba abrió una causa nueva.");
    expect(newsSentence(NEWS_RESULT, ZONE, ME)).toBe(
      "Hugo Prueba cargó el resultado de la audiencia de revisión de prisión preventiva del lunes 23/11: Efectiva.",
    );
    expect(newsSentence(NEWS_RESCHEDULED, ZONE, ME)).toBe(
      "Paula Demo reprogramó la audiencia de control de acusación del jueves 3/12 a las 10:00 al jueves 10/12 a las 11:00.",
    );
    expect(newsSentence(NEWS_POST_MEETING, ZONE, ME)).toBe("Paula Demo publicó:");
  });

  it("talks to the user with vos, and stays impersonal without a member", () => {
    expect(newsSentence(NEWS_SCHEDULED, ZONE, ME)).toBe(
      "Cargaste la audiencia de formulación de cargos para el lunes 30/11 a las 10:00.",
    );
    expect(newsSentence(NEWS_SEEDED, ZONE, ME)).toBe("Se abrió una causa nueva.");
    expect(newsSentence({ ...NEWS_RESULT, actor: null }, ZONE, ME)).toMatch(
      /^Se cargó el resultado de la audiencia/,
    );
  });

  it("says only the hours when a hearing moved within the same day", () => {
    const sameDay: NewsItem = {
      ...NEWS_RESCHEDULED,
      actor: null,
      hearing: NEWS_RESCHEDULED.hearing && {
        ...NEWS_RESCHEDULED.hearing,
        previousStartsAt: "2026-12-03T13:00:00Z",
        newStartsAt: "2026-12-03T14:30:00Z",
      },
    };
    expect(newsSentence(sameDay, ZONE, ME)).toBe(
      "Se reprogramó la audiencia de control de acusación del jueves 3/12: pasó de las 10:00 a las 11:30.",
    );
  });

  it("names a member whose record is gone neutrally", () => {
    const gone = { ...NEWS_OPENED, actor: { id: "x", displayName: null } };
    expect(newsSentence(gone, ZONE, ME)).toBe("Alguien del estudio abrió una causa nueva.");
  });
});

describe("collapseBulk", () => {
  it("collapses three or more cases opened by the same member within a minute", () => {
    const entries = collapseBulk([NEWS_POST_MEETING, ...NEWS_IMPORTED, NEWS_OPENED]);
    expect(entries.map((entry) => entry.kind)).toEqual(["item", "bulk", "item"]);
    const bulk = entries[1];
    expect(bulk?.kind === "bulk" && bulk.items).toHaveLength(4);
    expect(bulkOpenedSentence(PAULA_ACTOR, 4, ME)).toBe("Paula Demo abrió 4 causas nuevas.");
    expect(bulkOpenedSentence(null, 4, ME)).toBe("Se abrieron 4 causas nuevas.");
    expect(bulkOpenedSentence({ id: ME, displayName: "Lucía Ejemplo" }, 4, ME)).toBe(
      "Abriste 4 causas nuevas.",
    );
  });

  it("keeps two cases, other members and later cases as separate entries", () => {
    const [a, b, c] = NEWS_IMPORTED;
    if (!a || !b || !c) throw new Error("fixtures");
    expect(collapseBulk([a, b]).map((entry) => entry.kind)).toEqual(["item", "item"]);
    const other = { ...c, actor: { id: "otra", displayName: "Hugo Prueba" } };
    expect(collapseBulk([a, b, other]).map((entry) => entry.kind)).toEqual([
      "item",
      "item",
      "item",
    ]);
    const later = { ...c, occurredAt: "2026-11-19T15:05:00Z" };
    expect(collapseBulk([later, a, b]).map((entry) => entry.kind)).toEqual([
      "item",
      "item",
      "item",
    ]);
  });
});

describe("uniqueById", () => {
  it("keeps the first copy of each entry, in order", () => {
    expect(
      uniqueById([NEWS_RESULT, NEWS_OPENED, NEWS_RESULT, NEWS_SEEDED]).map((item) => item.id),
    ).toEqual([NEWS_RESULT.id, NEWS_OPENED.id, NEWS_SEEDED.id]);
  });
});

describe("groupNewsByDay", () => {
  it("groups by the local day, newest first, with imports collapsed", () => {
    const days = groupNewsByDay(ALL_NEWS, ZONE);
    expect(days.map((group) => group.day)).toEqual([
      "2026-11-23",
      "2026-11-22",
      "2026-11-19",
      "2026-11-18",
      "2026-11-02",
    ]);
    expect(days[0]?.entries).toHaveLength(4);
    // 21:30 UTC is still Sunday 18:30 in Neuquén.
    expect(days[1]?.entries).toHaveLength(1);
    expect(days[2]?.entries.map((entry) => entry.kind)).toEqual(["bulk"]);
  });
});

describe("dayHeading and timeLabel", () => {
  it("says today and yesterday in words, other days in full", () => {
    expect(dayHeading("2026-11-23", "2026-11-23")).toBe("Hoy");
    expect(dayHeading("2026-11-22", "2026-11-23")).toBe("Ayer");
    expect(dayHeading("2026-11-19", "2026-11-23")).toBe("Jueves 19 de noviembre");
    expect(dayHeading("2025-12-30", "2026-11-23")).toBe("Martes 30 de diciembre de 2025");
  });

  it("is relative within the hour and the local time after it", () => {
    expect(timeLabel("2026-11-23T13:20:00Z", NOW, ZONE)).toBe("Recién");
    expect(timeLabel("2026-11-23T13:19:00Z", NOW, ZONE)).toBe("Hace 1 minuto");
    expect(timeLabel(NEWS_POST_MEETING.occurredAt, NOW, ZONE)).toBe("Hace 15 minutos");
    expect(timeLabel(NEWS_SCHEDULED.occurredAt, NOW, ZONE)).toBe("08:40");
  });

  it("adds the day for lists without day headings", () => {
    expect(timeLabel(NEWS_SCHEDULED.occurredAt, NOW, ZONE, { withDay: true })).toBe("08:40");
    expect(timeLabel("2026-11-22T21:30:00Z", NOW, ZONE, { withDay: true })).toBe("Ayer, 18:30");
    expect(timeLabel("2026-11-19T15:00:00Z", NOW, ZONE, { withDay: true })).toBe(
      "jueves 19/11, 12:00",
    );
  });
});

describe("deadlines due soon", () => {
  it("counts hour-based terms in hours and the rest in days", () => {
    expect(remainingText(DUE_SOON_CONTROL, ZONE)).toBe("Quedan 15 horas");
    expect(remainingText(DUE_SOON_EVIDENCE, ZONE)).toBe("Quedan 4 días");
    expect(remainingText({ ...DUE_SOON_EVIDENCE, daysLeft: 1 }, ZONE)).toBe("Vence mañana");
    expect(remainingText({ ...DUE_SOON_EVIDENCE, daysLeft: 0 }, ZONE)).toBe("Vence hoy");
    expect(remainingText({ ...DUE_SOON_EVIDENCE, daysLeft: null }, ZONE)).toBeNull();
  });

  it("says when it ends: the hour for hour-based terms, 24 h for the rest", () => {
    expect(dueText(DUE_SOON_CONTROL, ZONE)).toBe("Vence el martes 24/11 a las 02:00");
    expect(dueText(DUE_SOON_EVIDENCE, ZONE)).toBe("Vence el viernes 27/11 (hasta las 24)");
  });

  it("puts the deadlines of detained clients first", () => {
    expect(detaineeFirst(ALL_DUE_SOON)).toEqual([DUE_SOON_CONTROL, DUE_SOON_EVIDENCE]);
  });
});
