import { useEffect, useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Copy, ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader } from "@/components/ui/dialog";
import type { CodeFormInput, CodeFormOutput } from "@/features/auth/login-schemas";
import { SavedStatus } from "@/features/settings/settings-layout";
import { useAnnouncement } from "@/features/settings/settings-hooks";
import { holdOpen, type CloseGuard } from "@/features/two-factor/close-guard";
import { RecoveryCodesPanel } from "@/features/two-factor/recovery-codes-panel";
import type { TwoFactorEnrollment } from "@/features/two-factor/two-factor-api";
import { StepProgress, StepTitle } from "@/features/two-factor/two-factor-dialog";
import { twoFactorFailure, type TwoFactorFailure } from "@/features/two-factor/two-factor-errors";
import { CodeField, PasswordField, ServerError } from "@/features/two-factor/two-factor-fields";
import { groupSecret } from "@/features/two-factor/two-factor-format";
import { useConfirmEnrollment, useStartEnrollment } from "@/features/two-factor/two-factor-queries";
import {
  enrollCodeSchema,
  passwordSchema,
  type PasswordValues,
} from "@/features/two-factor/two-factor-schemas";

type Step = "password" | "scan" | "code" | "codes";

const STEPS: Step[] = ["password", "scan", "code", "codes"];

const TITLES: Record<Step, string> = {
  password: "Confirmá que sos vos",
  scan: "Agregá tu cuenta a la app",
  code: "Escribí el código de la app",
  codes: "Guardá tus códigos de recuperación",
};

/**
 * The four steps to turn on the second factor. Lives inside the dialog's content, so the secret
 * and the codes disappear with it when the dialog closes: nothing is kept anywhere else.
 */
export function EnrollFlow({
  closeGuardRef,
  onEnabled,
  onClose,
}: {
  closeGuardRef: CloseGuard;
  /** Two-factor is on: the screen behind can say so. */
  onEnabled: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("password");
  /** Only after the first step: the opening focus belongs to the password field. */
  const [moved, setMoved] = useState(false);
  const [enrollment, setEnrollment] = useState<TwoFactorEnrollment | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const go = (next: Step) => {
    setMoved(true);
    setStep(next);
  };

  return (
    <>
      <DialogHeader className="gap-3">
        <StepProgress current={STEPS.indexOf(step)} total={STEPS.length} />
        {/* The code step focuses its own field instead (CodeStep's effect), so the title must
            not take the focus there; on the first step the dialog focuses the password. */}
        <StepTitle key={step} focusOnMount={moved && step !== "code"}>
          {TITLES[step]}
        </StepTitle>
      </DialogHeader>

      {step === "password" && (
        <PasswordStep
          onStarted={(started) => {
            setEnrollment(started);
            go("scan");
          }}
        />
      )}
      {step === "scan" && enrollment && (
        <ScanStep enrollment={enrollment} onNext={() => go("code")} />
      )}
      {step === "code" && (
        <CodeStep
          closeGuardRef={closeGuardRef}
          onBack={() => go("scan")}
          onRestart={() => {
            setEnrollment(null);
            go("password");
          }}
          onConfirmed={(recoveryCodes) => {
            // The secret is not needed any more: drop it before showing the codes.
            setEnrollment(null);
            setCodes(recoveryCodes);
            go("codes");
            onEnabled();
          }}
        />
      )}
      {step === "codes" && codes && (
        <div className="grid gap-4">
          <SavedStatus message="Activaste la verificación en dos pasos." />
          <RecoveryCodesPanel codes={codes} closeGuardRef={closeGuardRef} onDone={onClose} />
        </div>
      )}
    </>
  );
}

function PasswordStep({ onStarted }: { onStarted: (enrollment: TwoFactorEnrollment) => void }) {
  const id = useId();
  const start = useStartEnrollment();
  const [failure, setFailure] = useState<TwoFactorFailure | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  const submit = handleSubmit(async ({ password }) => {
    setFailure(null);
    try {
      onStarted(await start.mutateAsync(password));
    } catch (error) {
      const next = twoFactorFailure(error, "password");
      setFailure(next);
      if (next.invalidInput) {
        resetField("password");
        setFocus("password");
      }
    } finally {
      // The password and the secret must not linger in the mutation cache.
      start.reset();
    }
  });

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <DialogDescription>
        Antes de cambiar cómo ingresás, escribí la contraseña con la que entraste hoy.
      </DialogDescription>
      <ServerError id={`${id}-server`}>{failure?.message}</ServerError>
      <PasswordField
        id={`${id}-password`}
        registration={register("password")}
        error={errors.password?.message}
        serverErrorId={failure?.invalidInput ? `${id}-server` : undefined}
      />
      <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
        {isSubmitting ? "Verificando…" : "Continuá"}
      </Button>
    </form>
  );
}

function ScanStep({ enrollment, onNext }: { enrollment: TwoFactorEnrollment; onNext: () => void }) {
  const id = useId();
  const [copyMessage, announceCopy] = useAnnouncement();
  const [copyFailed, setCopyFailed] = useState(false);
  const groups = groupSecret(enrollment.secret);

  const copy = async () => {
    announceCopy(null);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(groups.join(""));
      announceCopy("Copiaste la clave. Pegala en tu app de autenticación.");
    } catch {
      const key = document.getElementById(`${id}-key`);
      if (key) window.getSelection()?.selectAllChildren(key);
      setCopyFailed(true);
    }
  };

  return (
    <div className="grid gap-5">
      <DialogDescription>
        Abrí en tu celular una app de autenticación: Google Authenticator, Microsoft Authenticator o
        cualquier app de códigos de 6 números (TOTP). Si no tenés ninguna, instalala desde la tienda
        de tu celular.
      </DialogDescription>

      <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        {/* On a phone the app is on the same screen: the button and the key come first. */}
        <figure className="order-last grid justify-items-center gap-2 sm:order-none sm:justify-items-start">
          {/* Drawn here from the otpauth address: the secret never goes to an image service. */}
          <div className="rounded-lg border bg-qr-surface text-qr-ink">
            <QRCodeSVG
              value={enrollment.otpauthUri}
              size={200}
              level="M"
              marginSize={4}
              fgColor="currentColor"
              bgColor="transparent"
              role="img"
              aria-label="Código QR para agregar tu cuenta a la app de autenticación"
            />
          </div>
          <figcaption className="max-w-52 text-center text-small text-muted-foreground sm:text-left">
            Desde la computadora: en la app, elegí agregar una cuenta y escaneá este código.
          </figcaption>
        </figure>

        <div className="grid content-start gap-4">
          <div className="grid gap-2 sm:hidden">
            <Button variant="outline" asChild className="w-full">
              <a href={enrollment.otpauthUri}>
                <ExternalLink aria-hidden="true" />
                Abrí la app de autenticación
              </a>
            </Button>
            <p className="text-small text-muted-foreground">
              Desde este celular: tocá el botón y la app agrega la cuenta sola. Si no se abre, usá
              la clave de abajo.
            </p>
          </div>

          <div className="grid gap-2">
            <p className="text-meta font-semibold" id={`${id}-key-label`}>
              Si no podés usar el código QR, escribí esta clave en la app
            </p>
            <div
              id={`${id}-key`}
              role="group"
              aria-labelledby={`${id}-key-label`}
              className="flex flex-wrap gap-x-2.5 gap-y-1 rounded-lg border bg-secondary px-3.5 py-2.5 text-title font-bold tracking-wide tabular-nums"
            >
              {groups.map((group, index) => (
                <span key={index}>{group}</span>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full sm:w-fit"
              aria-describedby={`${id}-key`}
              onClick={() => void copy()}
            >
              <Copy aria-hidden="true" />
              Copiá la clave
            </Button>
            <SavedStatus message={copyMessage} />
            {copyFailed && (
              <p role="alert" className="text-meta font-semibold text-foreground">
                No pudimos copiarla sola. La clave quedó seleccionada: copiala con Ctrl+C, o en el
                celular mantenela apretada y elegí Copiar.
              </p>
            )}
            <p className="text-small text-muted-foreground">
              Si la app pregunta el tipo, elegí «Basada en el tiempo».
            </p>
          </div>
        </div>
      </div>

      <Button size="lg" className="w-full sm:w-fit" onClick={onNext}>
        Ya la agregué, continuá
      </Button>
    </div>
  );
}

function CodeStep({
  closeGuardRef,
  onBack,
  onRestart,
  onConfirmed,
}: {
  closeGuardRef: CloseGuard;
  onBack: () => void;
  onRestart: () => void;
  onConfirmed: (codes: string[]) => void;
}) {
  const id = useId();
  const confirm = useConfirmEnrollment();
  const [failure, setFailure] = useState<TwoFactorFailure | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<CodeFormInput, unknown, CodeFormOutput>({
    resolver: zodResolver(enrollCodeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    setFocus("code");
  }, [setFocus]);

  const submit = handleSubmit(async ({ code }) => {
    setFailure(null);
    const release = holdOpen(closeGuardRef);
    try {
      const { recoveryCodes } = await confirm.mutateAsync(code);
      onConfirmed(recoveryCodes);
    } catch (error) {
      const next = twoFactorFailure(error, "confirm");
      setFailure(next);
      if (next.invalidInput) {
        resetField("code");
        setFocus("code");
      }
    } finally {
      release();
      // The recovery codes live only in the dialog's state, never in the mutation cache.
      confirm.reset();
    }
  });

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <DialogDescription>
        La app ya muestra un código de 6 números para esta cuenta. Escribilo para comprobar que
        quedó bien agregada.
      </DialogDescription>
      <ServerError id={`${id}-server`}>{failure?.message}</ServerError>
      {failure?.stateChanged ? (
        <Button variant="outline" className="w-full sm:w-fit" onClick={onRestart}>
          <RotateCcw aria-hidden="true" />
          Volvé a empezar
        </Button>
      ) : (
        <>
          <CodeField
            id={`${id}-code`}
            mode="totp"
            registration={register("code")}
            error={errors.code?.message}
            serverErrorId={failure?.invalidInput ? `${id}-server` : undefined}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button
              variant="ghost"
              className="w-full sm:w-fit"
              disabled={isSubmitting}
              onClick={onBack}
            >
              <ArrowLeft aria-hidden="true" />
              Volvé al código QR
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-full sm:ml-auto sm:w-fit"
              disabled={isSubmitting}
            >
              {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {isSubmitting ? "Activando…" : "Activá la verificación"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
