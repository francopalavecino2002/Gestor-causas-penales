import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { Hourglass } from "lucide-react";

import { BrandMark } from "@/components/shell/brand-mark";
import { login, verifySecondFactor, type Credentials } from "@/features/auth/auth-api";
import { EXPIRED_MESSAGE, loginErrorMessage } from "@/features/auth/login-errors";
import { LoginPanel } from "@/features/auth/login-panel";
import { meQueryOptions } from "@/features/auth/me-query";
import { PasswordStep } from "@/features/auth/password-step";
import { safeRedirect } from "@/features/auth/redirect";
import { SecondFactorStep, type CodeMode } from "@/features/auth/second-factor-step";
import {
  findRememberedFirm,
  readRememberedFirms,
  rememberFirm,
} from "@/features/firms/remembered-firms";
import { PUBLIC_CALCULATOR_PATH } from "@/features/public-deadlines/public-deadline-format";
import { isApiError } from "@/lib/api";

export interface LoginSearch {
  /** In-app path to open after signing in. */
  redirect?: string;
  /** Firm slug to prefill (from the firm switcher). */
  estudio?: string;
}

interface Step {
  name: "password" | "second-factor";
  tenant: string;
  email: string;
  error?: string;
  /**
   * Bumped on every failed attempt: the form remounts, so the secret field starts empty, gets
   * the focus and the error is announced again even when the text did not change.
   */
  attempt: number;
}

/** Two-step login: firm + email + password, then the TOTP or a recovery code when enabled. */
export function LoginPage({ redirect, estudio }: LoginSearch) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rememberedFirms] = useState(readRememberedFirms);
  const [step, setStep] = useState<Step>(() => ({
    name: "password",
    tenant: estudio?.trim().toLowerCase() ?? "",
    email: findRememberedFirm(estudio)?.lastEmail ?? "",
    attempt: 0,
  }));

  const fail = (next: Omit<Step, "attempt">) =>
    setStep((current) => ({ ...next, attempt: current.attempt + 1 }));

  const finishSignIn = async () => {
    const me = await queryClient.fetchQuery({ ...meQueryOptions, staleTime: 0 });
    if (!me) throw new Error("Signed in but /me answered 401");
    rememberFirm({ slug: me.tenant.slug, name: me.tenant.name, lastEmail: me.email });
    router.history.push(safeRedirect(redirect));
  };

  const submitCredentials = async (credentials: Credentials) => {
    try {
      const result = await login(credentials);
      if (result === "second-factor-required") {
        setStep((current) => ({
          name: "second-factor",
          tenant: credentials.tenant,
          email: credentials.email,
          attempt: current.attempt,
        }));
        return;
      }
      await finishSignIn();
    } catch (error) {
      fail({
        name: "password",
        tenant: credentials.tenant,
        email: credentials.email,
        error: loginErrorMessage(error, "password"),
      });
    }
  };

  const submitCode = async (code: string, mode: CodeMode) => {
    const { tenant, email } = step;
    try {
      await verifySecondFactor(code);
      await finishSignIn();
    } catch (error) {
      const expired = isApiError(error) && error.type === "second-factor-expired";
      fail({
        name: expired ? "password" : "second-factor",
        tenant,
        email,
        error: expired ? EXPIRED_MESSAGE : loginErrorMessage(error, mode),
      });
    }
  };

  const backToPassword = () =>
    setStep((current) => ({ ...current, name: "password", error: undefined }));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <LoginPanel />
      <main
        id="contenido"
        className="flex min-h-dvh flex-col px-4 pt-6 pb-10 sm:px-8 lg:justify-center lg:px-10"
      >
        <div className="mx-auto grid w-full max-w-md gap-10">
          <BrandMark className="lg:hidden" />
          {step.name === "password" ? (
            <PasswordStep
              key={step.attempt}
              defaultValues={{ tenant: step.tenant, email: step.email }}
              rememberedFirms={rememberedFirms}
              error={step.error}
              onSubmit={submitCredentials}
            />
          ) : (
            <SecondFactorStep
              email={step.email}
              tenant={step.tenant}
              error={step.error}
              attempt={step.attempt}
              onSubmit={submitCode}
              onModeChange={() => setStep((current) => ({ ...current, error: undefined }))}
              onBack={backToPassword}
            />
          )}
          <p className="flex items-start gap-2.5 border-t pt-6 text-meta text-muted-foreground">
            <Hourglass aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              ¿Tenés que contar un plazo del CPP de Neuquén? Usá la{" "}
              <Link
                to={PUBLIC_CALCULATOR_PATH}
                className="font-semibold text-primary underline underline-offset-4 hover:decoration-2"
              >
                calculadora de plazos gratuita
              </Link>
              , sin cuenta.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}
