import { TOO_LONG_MESSAGE } from "@/features/account/password-schema";
import { formatWait, NETWORK_MESSAGE } from "@/features/auth/login-errors";
import { CSRF_UNAVAILABLE, isApiError, NETWORK_ERROR } from "@/lib/api";

/** What a failed password change means, and which field it points at, if any. */
export interface PasswordFailure {
  message: string;
  field?: "currentPassword" | "newPassword";
}

/** The backend's English details for a rejected new password, in the screen's words. */
const INVALID_DETAILS: [RegExp, string][] = [
  [/different/i, "La contraseña nueva tiene que ser distinta de la que tenés ahora."],
  [/at least/i, "La contraseña nueva tiene que tener al menos 12 caracteres."],
  [/bytes/i, TOO_LONG_MESSAGE],
];

export function passwordFailure(
  error: unknown,
  currentLabel: "actual" | "temporal",
): PasswordFailure {
  if (!isApiError(error)) return { message: "No pudimos cambiar la contraseña. Probá de nuevo." };
  switch (error.type) {
    case NETWORK_ERROR:
      return { message: NETWORK_MESSAGE };
    case CSRF_UNAVAILABLE:
      return { message: "No pudimos validar la sesión. Recargá la página y probá de nuevo." };
    case "invalid-confirmation":
      return {
        field: "currentPassword",
        message:
          currentLabel === "temporal"
            ? "La contraseña temporal no es correcta. Escribila tal como te la dio la persona titular, con los guiones."
            : "La contraseña actual no es correcta. Revisala y probá de nuevo.",
      };
    case "invalid-password": {
      const known = INVALID_DETAILS.find(([pattern]) => pattern.test(error.detail ?? ""));
      return {
        field: "newPassword",
        message:
          known?.[1] ?? "Revisá la contraseña nueva: tiene que tener al menos 12 caracteres.",
      };
    }
    case "login-throttled":
      return {
        message: error.retryAfter
          ? `Demasiados intentos. Por seguridad, esperá ${formatWait(error.retryAfter)} y probá de nuevo.`
          : "Demasiados intentos. Por seguridad, esperá unos minutos y probá de nuevo.",
      };
    default:
      return {
        message:
          error.status >= 500
            ? "El servidor tuvo un problema y no pudimos cambiar la contraseña. Probá de nuevo en unos minutos."
            : "No pudimos cambiar la contraseña. Revisá los datos y probá de nuevo.",
      };
  }
}
