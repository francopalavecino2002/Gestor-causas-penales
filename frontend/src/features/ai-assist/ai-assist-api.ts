import { apiFetch } from "@/lib/api";

/** The optional AI assistance (ADR-0033): it works only when both flags are true. */
export interface AiAssistStatus {
  /** This installation has a provider configured. */
  available: boolean;
  /** The firm's owner turned it on. */
  enabled: boolean;
  /** Who processes the text, to say it plainly on screen. */
  provider: string;
}

/** A hearing read from a notification: every field may be missing, nothing is saved. */
export interface HearingDraft {
  typeCode: string | null;
  /** yyyy-MM-dd, Neuquén time. */
  date: string | null;
  /** HH:mm, Neuquén time. */
  time: string | null;
  durationMinutes: number | null;
  room: string | null;
  judge: string | null;
  ofijuReference: string | null;
  /** The fields above that could not be read. */
  missing: string[];
}

export const NOTIFICATION_TEXT_MAX = 20_000;

export function fetchAiAssist(signal?: AbortSignal): Promise<AiAssistStatus> {
  return apiFetch<AiAssistStatus>("/api/v1/ai-assist", { signal });
}

export function changeAiAssist(enabled: boolean): Promise<AiAssistStatus> {
  return apiFetch<AiAssistStatus>("/api/v1/ai-assist", { method: "PUT", body: { enabled } });
}

export function requestHearingDraft(caseId: string, text: string): Promise<HearingDraft> {
  return apiFetch<HearingDraft>(`/api/v1/cases/${caseId}/hearing-drafts`, {
    method: "POST",
    body: { text },
  });
}
