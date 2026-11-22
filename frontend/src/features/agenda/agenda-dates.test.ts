import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  FIRM_TIME_ZONE,
  formatDayLabel,
  formatShortDayLabel,
  formatTime,
  formatWeekLabel,
  groupByDay,
  isIsoDate,
  localDay,
  todayIn,
  weekRange,
} from "@/features/agenda/agenda-dates";

const ZONE = FIRM_TIME_ZONE;

describe("agenda dates", () => {
  it("accepts only real calendar days", () => {
    expect(isIsoDate("2026-11-23")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-11-3")).toBe(false);
    expect(isIsoDate("hoy")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it("adds days across months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-11-23", 7)).toBe("2026-11-30");
  });

  it("builds Monday-to-Sunday weeks", () => {
    expect(weekRange("2026-11-23")).toEqual({ from: "2026-11-23", to: "2026-11-29" }); // Monday
    expect(weekRange("2026-11-26")).toEqual({ from: "2026-11-23", to: "2026-11-29" }); // Thursday
    expect(weekRange("2026-11-29")).toEqual({ from: "2026-11-23", to: "2026-11-29" }); // Sunday
    expect(weekRange("2026-12-31")).toEqual({ from: "2026-12-28", to: "2027-01-03" }); // across years
  });

  it("lists every day of a range, both ends included", () => {
    expect(daysBetween("2026-11-29", "2026-12-02")).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
  });

  it("places an instant on its local day in the firm's zone, not in UTC", () => {
    // 01:30 UTC on the 24th is still 22:30 on the 23rd in Neuquén.
    expect(localDay("2026-11-24T01:30:00Z", ZONE)).toBe("2026-11-23");
    expect(localDay("2026-11-24T03:00:00Z", ZONE)).toBe("2026-11-24");
    expect(todayIn(ZONE, new Date("2026-11-24T02:59:00Z"))).toBe("2026-11-23");
  });

  it("formats times on a 24-hour clock in the firm's zone", () => {
    expect(formatTime("2026-11-23T12:30:00Z", ZONE)).toBe("09:30");
    expect(formatTime("2026-11-23T19:05:00Z", ZONE)).toBe("16:05");
    expect(formatTime("2026-11-24T03:00:00Z", ZONE)).toBe("00:00");
  });

  it("writes days and weeks in Spanish", () => {
    expect(formatDayLabel("2026-11-23")).toBe("Lunes 23 de noviembre");
    expect(formatDayLabel("2026-11-23", { year: true })).toBe("Lunes 23 de noviembre de 2026");
    expect(formatShortDayLabel("2026-11-25")).toBe("miércoles 25/11");
    expect(formatShortDayLabel("2026-12-04")).toBe("viernes 4/12");
    expect(formatWeekLabel("2026-11-23", "2026-11-29")).toBe("Del 23 al 29 de noviembre");
    expect(formatWeekLabel("2026-11-30", "2026-12-06")).toBe(
      "Del 30 de noviembre al 6 de diciembre",
    );
    expect(formatWeekLabel("2026-12-28", "2027-01-03")).toBe(
      "Del 28 de diciembre de 2026 al 3 de enero de 2027",
    );
  });

  it("groups by local day, keeps empty days and sorts by start", () => {
    const items = [
      { id: "late-monday", startsAt: "2026-11-24T01:30:00Z" }, // Monday 22:30 local
      { id: "tuesday", startsAt: "2026-11-24T12:00:00Z" },
      { id: "early-monday", startsAt: "2026-11-23T11:30:00Z" },
      { id: "outside", startsAt: "2026-11-30T12:00:00Z" },
    ];
    const groups = groupByDay(items, daysBetween("2026-11-23", "2026-11-25"), ZONE);

    expect(groups.map((group) => [group.day, group.items.map((item) => item.id)])).toEqual([
      ["2026-11-23", ["early-monday", "late-monday"]],
      ["2026-11-24", ["tuesday"]],
      ["2026-11-25", []],
    ]);
  });
});
