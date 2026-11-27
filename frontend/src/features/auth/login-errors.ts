import { isApiError, NETWORK_ERROR } from "@/lib/api";

/** "30 segundos", "1 minuto", "5 minutos": the wait in words, rounded up to whole minutes. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return seconds === 1 ? "1 segundo" : `${seconds} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

export const NETWORK_MESSAGE =
  "No pudimos conectar con el servidor. Revisá tu conexión a internet y probá de nuevo.";

export const EXPIRED_MESSAGE =
  "Pasó demasiado tiempo desde que ingresaste la contraseña. Escribila de nuevo para seguir.";

/**
 * What to tell the user after a failed login step. Failed credentials get one generic message
 * on purpose: it never says whether the firm, the email or the password was wrong.
 */
export function loginErrorMessage(error: unknown, step: "password" | "totp" | "recovery"): string {
  if (!isApiError(error)) return "No pudimos completar el ingreso. Probá de nuevo.";

  switch (error.type) {
    case NETWORK_ERROR:
      return NETWORK_MESSAGE;
    case "invalid-credentials":
      return "Los datos no coinciden con una cuenta activa. Revisá el estudio, el email y la contraseña, y probá de nuevo.";
    // The data was right but the owner of a new firm has not opened the link yet (T72).
    case "email-not-verified":
      return "Todavía no confirmaste tu email. Te mandamos un enlace nuevo: abrilo y volvé a ingresar.";
    case "invalid-second-factor":
      return step === "recovery"
        ? "Ese código de recuperación no es válido o ya lo usaste. Probá con otro de tu lista."
        : "El código no es válido o ya cambió. Escribí el que muestra ahora tu app de autenticación.";
    case "second-factor-expired":
      return EXPIRED_MESSAGE;
    case "login-throttled":
      return error.retryAfter
        ? `Hubo demasiados intentos fallidos. Por seguridad, esperá ${formatWait(error.retryAfter)} y probá de nuevo.`
        : "Hubo demasiados intentos fallidos. Por seguridad, esperá unos minutos y probá de nuevo.";
    default:
      return error.status >= 500
        ? "El servidor tuvo un problema y no pudimos completar el ingreso. Probá de nuevo en unos minutos."
        : "No pudimos completar el ingreso. Probá de nuevo.";
  }
}
