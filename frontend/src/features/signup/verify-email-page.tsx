import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CircleCheck, LinkIcon, LoaderCircle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/features/auth/auth-layout";
import { LOGIN_PATH } from "@/features/auth/redirect";
import { verifyEmail, type VerifiedEmail } from "@/features/signup/signup-api";
import { verificationFailure } from "@/features/signup/signup-errors";
import { FirmSlug, SignupNotice } from "@/features/signup/signup-notice";
import { ServerError } from "@/features/two-factor/two-factor-fields";

export interface VerifyEmailPageProps {
  /** Firm slug from the link, to prefill the login. */
  estudio?: string;
  /** The token of the link, already taken out of the address bar; undefined when missing. */
  token: string | undefined;
}

type Verification =
  | { status: "verifying" }
  | { status: "verified"; result: VerifiedEmail }
  | { status: "invalid" }
  | { status: "failed"; message: string };

/**
 * Where the sign-up's email link lands (T72): it confirms the owner's email on arrival, once, and
 * opens the way to the login with the firm prefilled.
 */
export function VerifyEmailPage({ estudio, token }: VerifyEmailPageProps) {
  const firm = estudio?.trim().toLowerCase() || undefined;
  const [verification, setVerification] = useState<Verification>(
    token ? { status: "verifying" } : { status: "invalid" },
  );
  // A token is used up by the first request: StrictMode's second effect run must not send it again.
  const sent = useRef(false);

  const confirm = useCallback(async (value: string) => {
    try {
      setVerification({ status: "verified", result: await verifyEmail(value) });
    } catch (error) {
      const failure = verificationFailure(error);
      setVerification(
        failure === "invalid" ? { status: "invalid" } : { status: "failed", message: failure },
      );
    }
  }, []);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    void confirm(token);
  }, [token, confirm]);

  return (
    <AuthLayout>
      {verification.status === "verifying" && <Verifying />}
      {verification.status === "verified" && <Verified result={verification.result} />}
      {verification.status === "invalid" && <InvalidLink estudio={firm} focus={Boolean(token)} />}
      {verification.status === "failed" && token && (
        <Failed
          message={verification.message}
          onRetry={() => {
            setVerification({ status: "verifying" });
            void confirm(token);
          }}
        />
      )}
    </AuthLayout>
  );
}

function Verifying() {
  return (
    <section aria-labelledby="verify-pending" aria-busy="true" className="grid gap-4">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
        <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
      </span>
      <h1 id="verify-pending" role="status" className="text-display font-bold text-balance">
        Confirmando tu email…
      </h1>
    </section>
  );
}

function Verified({ result }: { result: VerifiedEmail }) {
  return (
    <SignupNotice
      id="verify-done"
      icon={CircleCheck}
      title="¡Listo! Ya confirmaste tu email."
      actions={
        <Button asChild size="lg" className="w-full">
          <Link to={LOGIN_PATH} search={{ estudio: result.tenant }}>
            Ingresá a tu estudio
          </Link>
        </Button>
      }
    >
      <p>
        <span className="font-semibold">{result.firmName}</span> ya está listo para usar.
      </p>
      <FirmSlug slug={result.tenant} />
    </SignupNotice>
  );
}

/** Missing, used or expired: the next login with the right data mails a new link. */
function InvalidLink({ estudio, focus }: { estudio: string | undefined; focus: boolean }) {
  return (
    <SignupNotice
      id="verify-invalid"
      icon={LinkIcon}
      title="El enlace no es válido o ya venció"
      focus={focus}
      actions={
        <Button asChild size="lg" className="w-full">
          <Link to={LOGIN_PATH} search={estudio ? { estudio } : {}}>
            Ir a ingresar
          </Link>
        </Button>
      }
    >
      <p>Ingresá con tu email y contraseña y te mandamos uno nuevo.</p>
    </SignupNotice>
  );
}

/** Too many tries, or the server did not answer: the same link can be tried again. */
function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section aria-labelledby="verify-failed" className="grid gap-7">
      <h1 id="verify-failed" className="text-display font-bold text-balance">
        No pudimos confirmar tu email
      </h1>
      <ServerError id="verify-error">{message}</ServerError>
      <Button size="lg" className="w-full" onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        Probá de nuevo
      </Button>
    </section>
  );
}
