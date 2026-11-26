import { formatWait, NETWORK_MESSAGE } from "@/features/auth/login-errors";
import { CSRF_UNAVAILABLE, isApiError, NETWORK_ERROR } from "@/lib/api";

/** Which request failed: each one says what was wrong in its own words. */
export type TwoFactorAction = "password" | "confirm" | "regenerate" | "disable";

/** A failure the screen can explain, and whether it points at what the user typed. */
export interface TwoFactorFailure {
  message: string;
  /** The password or the code was rejected (422): mark the fields and let the user retype. */
  invalidInput: boolean;
  /** The server is in another state (409): the step cannot go on as it is. */
  stateChanged: boolean;
}

const INVALID: Record<TwoFactorAction, string> = {
  password: "La contraseña no es correcta. Revisala y probá de nuevo.",
  confirm:
    "El código no es correcto o ya cambió. Escribí el que muestra ahora tu app de autenticación.",
  regenerate:
    "El código no es correcto. Escribí el que muestra ahora tu app o un código de recuperación sin usar.",
  disable: "El código o la contraseña no son correctos.",
};

const STATE: Record<TwoFactorAction, string> = {
  password:
    "La verificación en dos pasos ya está activada en tu cuenta, quizás desde otra pestaña. Actualizamos esta pantalla.",
  confirm:
    "La activación ya no está en curso: se completó o se reinició desde otra pestaña. Cerrá esta ventana y, si hace falta, empezá de nuevo.",
  regenerate:
    "La verificación en dos pasos ya no está activada en tu cuenta, quizás desde otra pestaña. Actualizamos esta pantalla.",
  disable:
    "La verificación en dos pasos ya estaba desactivada, quizás desde otra pestaña. Actualizamos esta pantalla.",
};

/** What a failed two-factor request means, and what to do next. */
export function twoFactorFailure(error: unknown, action: TwoFactorAction): TwoFactorFailure {
  const plain = (message: string): TwoFactorFailure => ({
    message,
    invalidInput: false,
    stateChanged: false,
  });
  if (!isApiError(error)) return plain("No pudimos completar el cambio. Probá de nuevo.");

  switch (error.type) {
    case NETWORK_ERROR:
      return plain(NETWORK_MESSAGE);
    case CSRF_UNAVAILABLE:
      return plain("No pudimos validar la sesión. Recargá la página y probá de nuevo.");
    case "invalid-confirmation":
      return { message: INVALID[action], invalidInput: true, stateChanged: false };
    case "two-factor-state":
      return { message: STATE[action], invalidInput: false, stateChanged: true };
    case "login-throttled":
      return plain(
        error.retryAfter
          ? `Demasiados intentos. Esperá ${formatWait(error.retryAfter)} y probá de nuevo.`
          : "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
      );
    default:
      return plain(
        error.status >= 500
          ? "El servidor tuvo un problema y no pudimos completar el cambio. Probá de nuevo en unos minutos."
          : "No pudimos completar el cambio. Probá de nuevo.",
      );
  }
}
