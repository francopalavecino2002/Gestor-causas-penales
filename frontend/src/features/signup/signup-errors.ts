import { passwordFailure } from "@/features/account/password-errors";
import { formatWait, NETWORK_MESSAGE } from "@/features/auth/login-errors";
import { CSRF_UNAVAILABLE, isApiError, NETWORK_ERROR } from "@/lib/api";

/** What a failed sign-up means, and whether it points at the password. */
export interface SignupFailure {
  message: string;
  field?: "newPassword";
}

/** True when the server says sign-up is off (it answers 404 while disabled). */
export function isSignupDisabled(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

export function signupFailure(error: unknown): SignupFailure {
  if (!isApiError(error)) return { message: "No pudimos crear el estudio. Probá de nuevo." };
  switch (error.type) {
    case NETWORK_ERROR:
      return { message: NETWORK_MESSAGE };
    case CSRF_UNAVAILABLE:
      return { message: "No pudimos preparar el pedido. Recargá la página y probá de nuevo." };
    case "invalid-password":
      return { field: "newPassword", message: passwordFailure(error, "actual").message };
    case "invalid-signup":
      // The detail is in English and for developers: the screen says what to check.
      return {
        message:
          "Revisá los datos: el nombre del estudio, los fueros, tu nombre y el email. Después probá de nuevo.",
      };
    case "signup-throttled":
      return {
        message: error.retryAfter
          ? `Hubo varios registros seguidos. Por seguridad, esperá ${formatWait(error.retryAfter)} y probá de nuevo. Si ya te registraste, revisá tu email.`
          : "Hubo varios registros seguidos. Por seguridad, esperá unos minutos y probá de nuevo. Si ya te registraste, revisá tu email.",
      };
    default:
      return {
        message:
          error.status >= 500
            ? "El servidor tuvo un problema y no pudimos crear el estudio. Probá de nuevo en unos minutos."
            : "No pudimos crear el estudio. Revisá los datos y probá de nuevo.",
      };
  }
}

/**
 * Why the email could not be confirmed: "invalid" when the link is not usable anymore (a new one
 * is mailed at the next login), otherwise what to tell the user before trying again.
 */
export function verificationFailure(error: unknown): "invalid" | string {
  if (!isApiError(error)) return "No pudimos confirmar tu email. Probá de nuevo.";
  switch (error.type) {
    case "invalid-verification-token":
      return "invalid";
    case "login-throttled":
      return error.retryAfter
        ? `Hubo demasiados intentos. Por seguridad, esperá ${formatWait(error.retryAfter)} y probá de nuevo.`
        : "Hubo demasiados intentos. Por seguridad, esperá unos minutos y probá de nuevo.";
    case NETWORK_ERROR:
      return NETWORK_MESSAGE;
    default:
      return error.status >= 500
        ? "El servidor tuvo un problema y no pudimos confirmar tu email. Probá de nuevo en unos minutos."
        : "No pudimos confirmar tu email. Probá de nuevo.";
  }
}
