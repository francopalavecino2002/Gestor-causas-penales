import { describe, expect, it, vi } from "vitest";

import { feedUrl, webcalUrl } from "@/features/calendar-feed/calendar-feed-api";
import { apiFetchBlob, ApiError, NETWORK_ERROR } from "@/lib/api";
import { mockFetch, problem } from "@/test/mock-api";

const ICS = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n";

describe("apiFetchBlob", () => {
  it("downloads the file with the session and asks for its type", async () => {
    const requests = mockFetch({
      "GET /api/v1/hearings/1/calendar.ics": () =>
        new Response(ICS, { status: 200, headers: { "Content-Type": "text/calendar" } }),
    });

    const blob = await apiFetchBlob("/api/v1/hearings/1/calendar.ics", {
      accept: "text/calendar",
    });

    expect(await blob.text()).toBe(ICS);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
      method: "GET",
    });
    expect(requests[0]?.headers.accept).toBe("text/calendar, application/problem+json");
  });

  it("reads an error answer as problem+json", async () => {
    mockFetch({ "GET /api/v1/hearings/1/calendar.ics": () => problem(404, "not-found") });

    const error = await apiFetchBlob("/api/v1/hearings/1/calendar.ics", {
      accept: "text/calendar",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, type: "not-found" });
  });

  it("reports a network failure", async () => {
    mockFetch({
      "GET /api/v1/hearings/1/calendar.ics": () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await expect(
      apiFetchBlob("/api/v1/hearings/1/calendar.ics", { accept: "text/calendar" }),
    ).rejects.toMatchObject({ status: 0, type: NETWORK_ERROR });
  });
});

describe("feed addresses", () => {
  const path = "/api/v1/calendar-feed/secreto-ficticio.ics";

  it("builds the full address from the page's origin", () => {
    expect(feedUrl(path, "https://causas.example.com")).toBe(
      "https://causas.example.com/api/v1/calendar-feed/secreto-ficticio.ics",
    );
    expect(feedUrl(path)).toBe(`${window.location.origin}${path}`);
  });

  it("swaps http and https for webcal, and nothing else", () => {
    expect(webcalUrl("https://causas.example.com/a.ics")).toBe("webcal://causas.example.com/a.ics");
    expect(webcalUrl("http://localhost:5173/a.ics")).toBe("webcal://localhost:5173/a.ics");
    expect(webcalUrl("https://x.example.com/https://y.ics")).toBe(
      "webcal://x.example.com/https://y.ics",
    );
  });
});
