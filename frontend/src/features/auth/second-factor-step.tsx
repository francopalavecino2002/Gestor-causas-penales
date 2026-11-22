import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CircleAlert, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CODE_MAX,
  recoverySchema,
  totpSchema,
  type CodeFormInput,
  type CodeFormOutput,
} from "@/features/auth/login-schemas";

export type CodeMode = "totp" | "recovery";

interface SecondFactorStepProps {
  email: string;
  tenant: string;
  error: string | undefined;
  /** Failed attempts so far: a new one remounts the form (empty field, focus, new alert). */
  attempt: number;
  onSubmit: (code: string, mode: CodeMode) => Promise<void>;
  onBack: () => void;
  onModeChange: () => void;
}

export function SecondFactorStep({
  email,
  tenant,
  error,
  attempt,
  onSubmit,
  onBack,
  onModeChange,
}: SecondFactorStepProps) {
  const [mode, setMode] = useState<CodeMode>("totp");

  const toggleMode = () => {
    setMode((current) => (current === "totp" ? "recovery" : "totp"));
    onModeChange();
  };

  return (
    <div className="grid gap-7">
      <header className="grid gap-2">
        <h1 className="text-display font-bold text-balance">Confirmá que sos vos</h1>
        <p className="text-body text-muted-foreground">
          {mode === "totp"
            ? "Abrí tu app de autenticación y escribí el código de 6 números."
            : "Escribí uno de los códigos de recuperación que guardaste al activar la verificación en dos pasos. Cada código sirve una sola vez."}
        </p>
        <p className="text-meta break-all text-muted-foreground">
          Cuenta <span className="font-semibold text-foreground">{email}</span> en{" "}
          <span className="font-semibold whitespace-nowrap text-foreground">{tenant}</span>
        </p>
      </header>

      {/* One form per mode: each has its own schema, field and error. */}
      <CodeForm
        key={`${mode}-${attempt}`}
        mode={mode}
        error={error}
        onSubmit={(code) => onSubmit(code, mode)}
      />

      <div className="grid gap-1 border-t pt-4">
        <Button variant="link" className="justify-start px-0" onClick={toggleMode}>
          {mode === "totp" ? "Usar un código de recuperación" : "Usar el código de la app"}
        </Button>
        <Button variant="ghost" className="-ml-2 w-fit justify-start px-2" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Volver a la contraseña
        </Button>
      </div>
    </div>
  );
}

function CodeForm({
  mode,
  error,
  onSubmit,
}: {
  mode: CodeMode;
  error: string | undefined;
  onSubmit: (code: string) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CodeFormInput, unknown, CodeFormOutput>({
    resolver: zodResolver(mode === "totp" ? totpSchema : recoverySchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    setFocus("code");
  }, [setFocus]);

  const isTotp = mode === "totp";
  const id = isTotp ? "login-totp" : "login-recovery";

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onSubmit(values.code))}
      className="grid gap-5"
    >
      {error && (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Field>
        <Label htmlFor={id}>{isTotp ? "Código de verificación" : "Código de recuperación"}</Label>
        <Input
          id={id}
          type="text"
          inputMode={isTotp ? "numeric" : "text"}
          autoComplete={isTotp ? "one-time-code" : "off"}
          autoCapitalize={isTotp ? "none" : "characters"}
          autoCorrect="off"
          spellCheck={false}
          maxLength={isTotp ? 6 : CODE_MAX}
          placeholder={isTotp ? undefined : "XXXX-XXXX-XXXX-XXXX"}
          className="text-title font-bold tabular-nums"
          aria-invalid={errors.code ? true : undefined}
          aria-describedby={errors.code ? `${id}-help ${id}-error` : `${id}-help`}
          {...register("code")}
        />
        <FieldDescription id={`${id}-help`}>
          {isTotp
            ? "El código cambia cada 30 segundos. Si vence mientras lo escribís, usá el nuevo."
            : "Podés escribirlo con o sin guiones."}
        </FieldDescription>
        <FieldError id={`${id}-error`}>{errors.code?.message}</FieldError>
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
        {isSubmitting ? "Verificando…" : "Verificá el código"}
      </Button>
    </form>
  );
}
