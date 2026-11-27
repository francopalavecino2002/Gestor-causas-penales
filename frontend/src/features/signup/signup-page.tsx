import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle, Mail, MailCheck, RotateCw } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { NEW_PASSWORD_MIN } from "@/features/account/password-schema";
import { SecretField } from "@/features/account/secret-field";
import { AuthLayout } from "@/features/auth/auth-layout";
import { EMAIL_MAX } from "@/features/auth/login-schemas";
import { LOGIN_PATH } from "@/features/auth/redirect";
import { rememberFirm } from "@/features/firms/remembered-firms";
import {
  signUp,
  signupSettingsQueryOptions,
  type SignedUp,
  type SignupSettings,
} from "@/features/signup/signup-api";
import { isSignupDisabled, signupFailure, type SignupFailure } from "@/features/signup/signup-errors";
import { FirmSlug, SignupNotice } from "@/features/signup/signup-notice";
import {
  FIRM_NAME_MAX,
  OWNER_NAME_MAX,
  signupSchema,
  type SignupValues,
} from "@/features/signup/signup-schema";
import { ServerError } from "@/features/two-factor/two-factor-fields";

const SERVER_ERROR_ID = "signup-server-error";

const textLink = "font-semibold text-primary underline underline-offset-4 hover:decoration-2";

const areaCard =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3.5 py-3 transition-colors duration-fast ease-out hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

/**
 * "Probá gratis" (T72): a new firm signs up by itself. The owner gets an email to confirm the
 * address, and logs in with the firm's identifier once confirmed.
 */
export function SignupPage() {
  const settings = useQuery(signupSettingsQueryOptions);
  const [signedUp, setSignedUp] = useState<SignedUp | null>(null);
  const [disabledOnSubmit, setDisabledOnSubmit] = useState(false);

  if (signedUp) {
    return (
      <AuthLayout>
        <SentNotice signedUp={signedUp} />
      </AuthLayout>
    );
  }
  if (settings.isPending) {
    return (
      <AuthLayout>
        <SignupSkeleton />
      </AuthLayout>
    );
  }
  if (settings.isError) {
    return (
      <AuthLayout>
        <SettingsError
          retrying={settings.isFetching}
          onRetry={() => void settings.refetch()}
        />
      </AuthLayout>
    );
  }
  if (!settings.data.enabled || settings.data.practiceAreas.length === 0 || disabledOnSubmit) {
    return (
      <AuthLayout>
        <DisabledNotice focus={disabledOnSubmit} />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout>
      <SignupForm
        settings={settings.data}
        onSignedUp={setSignedUp}
        onDisabled={() => setDisabledOnSubmit(true)}
      />
    </AuthLayout>
  );
}

function SignupForm({
  settings,
  onSignedUp,
  onDisabled,
}: {
  settings: SignupSettings;
  onSignedUp: (result: SignedUp) => void;
  onDisabled: () => void;
}) {
  const [failure, setFailure] = useState<SignupFailure | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firmName: "",
      // Penal comes first and is the one most firms start with.
      practiceAreas: settings.practiceAreas.slice(0, 1).map((area) => area.code),
      ownerName: "",
      email: "",
      newPassword: "",
      repeatPassword: "",
      hpCheck: "",
    },
  });

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const result = await signUp({
        firmName: values.firmName,
        practiceAreas: values.practiceAreas,
        ownerName: values.ownerName,
        email: values.email,
        password: values.newPassword,
        website: values.hpCheck,
      });
      // The login on this device then offers the new firm with its email already written.
      rememberFirm({ slug: result.tenant, name: values.firmName, lastEmail: result.email });
      onSignedUp(result);
    } catch (error) {
      if (isSignupDisabled(error)) {
        onDisabled();
        return;
      }
      const next = signupFailure(error);
      setFailure(next);
      if (next.field === "newPassword") {
        resetField("newPassword");
        resetField("repeatPassword");
        setFocus("newPassword");
      }
    }
  });

  const areasErrorId = "signup-areas-error";

  return (
    <div className="grid gap-7">
      <header className="grid gap-2">
        <h1 className="text-display font-bold text-balance">
          Probá gratis {settings.trialDays} días
        </h1>
        <p className="text-body text-muted-foreground">
          Creá la cuenta de tu estudio. Vas a ser la persona titular y después podés sumar a tu
          equipo.
        </p>
      </header>

      <form noValidate onSubmit={submit} className="grid gap-5">
        <ServerError id={SERVER_ERROR_ID}>{failure?.message}</ServerError>

        <Field>
          <Label htmlFor="signup-firm">Nombre del estudio</Label>
          <Input
            id="signup-firm"
            autoComplete="organization"
            maxLength={FIRM_NAME_MAX}
            aria-invalid={errors.firmName ? true : undefined}
            aria-describedby={
              errors.firmName ? "signup-firm-help signup-firm-error" : "signup-firm-help"
            }
            {...register("firmName")}
          />
          <FieldDescription id="signup-firm-help">
            Con este nombre armamos el identificador con el que vas a ingresar.
          </FieldDescription>
          <FieldError id="signup-firm-error">{errors.firmName?.message}</FieldError>
        </Field>

        <Controller
          control={control}
          name="practiceAreas"
          render={({ field }) => (
            <fieldset
              className="grid gap-2"
              aria-describedby={errors.practiceAreas ? areasErrorId : undefined}
            >
              <legend className="mb-1.5 text-body font-semibold">Fueros</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {settings.practiceAreas.map((area, index) => (
                  <label key={area.code} className={areaCard}>
                    <input
                      // The first box takes the focus when no area was chosen.
                      ref={index === 0 ? field.ref : undefined}
                      type="checkbox"
                      name={field.name}
                      value={area.code}
                      checked={field.value.includes(area.code)}
                      aria-invalid={errors.practiceAreas ? true : undefined}
                      className="size-4.5 shrink-0 accent-primary focus-visible:outline-none"
                      onBlur={field.onBlur}
                      onChange={(event) =>
                        field.onChange(
                          event.target.checked
                            ? [...field.value, area.code]
                            : field.value.filter((code) => code !== area.code),
                        )
                      }
                    />
                    <span className="text-body font-semibold">{area.name}</span>
                  </label>
                ))}
              </div>
              <FieldDescription>Podés sumar o sacar fueros después, en Ajustes.</FieldDescription>
              <FieldError id={areasErrorId}>{errors.practiceAreas?.message}</FieldError>
            </fieldset>
          )}
        />

        <Field>
          <Label htmlFor="signup-owner">Tu nombre</Label>
          <Input
            id="signup-owner"
            autoComplete="name"
            maxLength={OWNER_NAME_MAX}
            aria-invalid={errors.ownerName ? true : undefined}
            aria-describedby={errors.ownerName ? "signup-owner-error" : undefined}
            {...register("ownerName")}
          />
          <FieldError id="signup-owner-error">{errors.ownerName?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={EMAIL_MAX}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "signup-email-error" : undefined}
            {...register("email")}
          />
          <FieldError id="signup-email-error">{errors.email?.message}</FieldError>
        </Field>

        <SecretField
          id="signup-password"
          label="Contraseña"
          toggleLabel="Mostrar la contraseña"
          autoComplete="new-password"
          registration={register("newPassword")}
          error={errors.newPassword?.message}
          serverErrorId={failure?.field === "newPassword" ? SERVER_ERROR_ID : undefined}
          help={`Al menos ${NEW_PASSWORD_MIN} caracteres. Una frase de cuatro o cinco palabras es fácil de recordar y difícil de adivinar.`}
        />
        <SecretField
          id="signup-repeat"
          label="Repetí la contraseña"
          toggleLabel="Mostrar la contraseña repetida"
          autoComplete="new-password"
          registration={register("repeatPassword")}
          error={errors.repeatPassword?.message}
        />

        {/* Honeypot: people never see nor reach it, so only a bot fills it. */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor="signup-hp-check">No completes este campo</label>
          <input
            id="signup-hp-check"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            {...register("hpCheck")}
          />
        </div>

        <p className="flex items-start gap-2.5 text-meta text-muted-foreground">
          <Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>Te vamos a mandar un email para confirmar que es tuyo.</span>
        </p>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
          {isSubmitting ? "Creando tu estudio…" : "Crear mi estudio"}
        </Button>
      </form>

      <p className="text-meta text-muted-foreground">
        ¿Tu estudio ya usa el gestor?{" "}
        <Link to={LOGIN_PATH} className={textLink}>
          Ingresá
        </Link>
      </p>
    </div>
  );
}

/** The firm exists; the owner confirms the email and then logs in with the identifier. */
function SentNotice({ signedUp }: { signedUp: SignedUp }) {
  return (
    <SignupNotice
      id="signup-sent"
      icon={MailCheck}
      title="Revisá tu email"
      actions={
        <Button asChild size="lg" className="w-full">
          <Link to={LOGIN_PATH} search={{ estudio: signedUp.tenant }}>
            Ir a ingresar
          </Link>
        </Button>
      }
    >
      <p>
        Te mandamos un enlace a <span className="font-semibold wrap-break-word">{signedUp.email}</span>.
        Abrilo para confirmar que el email es tuyo: vence en 24 horas.
      </p>
      <FirmSlug slug={signedUp.tenant} />
      <p className="text-muted-foreground">
        Si no lo ves en unos minutos, mirá en la carpeta de correo no deseado.
      </p>
    </SignupNotice>
  );
}

function DisabledNotice({ focus }: { focus: boolean }) {
  return (
    <SignupNotice
      id="signup-disabled"
      icon={CircleAlert}
      title="El registro no está disponible por ahora"
      focus={focus}
      actions={
        <Button asChild size="lg" className="w-full">
          <Link to={LOGIN_PATH}>Ir a ingresar</Link>
        </Button>
      }
    >
      <p>
        Por el momento no se pueden crear estudios nuevos desde acá. Si tu estudio ya usa el gestor,
        ingresá con tu cuenta.
      </p>
    </SignupNotice>
  );
}

function SettingsError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <SignupNotice
      id="signup-error"
      icon={CircleAlert}
      title="No pudimos abrir el registro"
      focus={false}
      actions={
        <>
          <Button size="lg" className="w-full" disabled={retrying} onClick={onRetry}>
            {retrying ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <RotateCw aria-hidden="true" />
            )}
            Probá de nuevo
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to={LOGIN_PATH}>Ir a ingresar</Link>
          </Button>
        </>
      }
    >
      <p>
        El servidor no respondió. Revisá tu conexión a internet y probá de nuevo en unos minutos.
      </p>
    </SignupNotice>
  );
}

function SignupSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-7">
      <span className="sr-only">Cargando…</span>
      <div className="grid gap-3">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="grid gap-5">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="grid gap-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
