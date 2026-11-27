import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

/** A practice area a new firm can start with, from the public sign-up settings. */
export interface SignupArea {
  code: string;
  name: string;
}

/** GET /api/v1/public/signup: whether "Probá gratis" is offered, and with what. */
export interface SignupSettings {
  enabled: boolean;
  trialDays: number;
  practiceAreas: SignupArea[];
}

export interface SignupForm {
  firmName: string;
  practiceAreas: string[];
  ownerName: string;
  email: string;
  password: string;
  /** The honeypot: people never see it, so it travels empty unless a bot filled it. */
  website: string;
}

/** The firm's slug (what the owner types as "Estudio") and the email the link went to. */
export interface SignedUp {
  tenant: string;
  email: string;
}

export interface VerifiedEmail {
  tenant: string;
  firmName: string;
}

export const signupSettingsQueryOptions = queryOptions({
  queryKey: ["public", "signup"] as const,
  queryFn: ({ signal }) => apiFetch<SignupSettings>("/api/v1/public/signup", { signal }),
  // It only changes with the server's configuration.
  staleTime: Infinity,
});

/** Creates the firm and its owner, and emails the owner a link to confirm the address (202). */
export async function signUp(form: SignupForm): Promise<SignedUp> {
  return apiFetch<SignedUp>("/api/v1/auth/signup", { method: "POST", body: form });
}

/** Confirms the owner's email with the token of the link; afterwards they can log in. */
export async function verifyEmail(token: string): Promise<VerifiedEmail> {
  return apiFetch<VerifiedEmail>("/api/v1/auth/email-verification", {
    method: "POST",
    body: { token },
  });
}
