import { NETWORK_MESSAGE } from "@/features/auth/login-errors";
import { CSRF_UNAVAILABLE, isApiError, NETWORK_ERROR } from "@/lib/api";

/** What a failed change to a user means, and whether the email field is the cause. */
export interface FirmUserFailure {
  message: string;
  /** The email is already used in this firm (409). */
  duplicateEmail?: boolean;
}

/** In the screen's words, never the server's raw text: what happened and what to do. */
export function firmUserFailure(error: unknown): FirmUserFailure {
  if (!isApiError(error)) return { message: "No pudimos guardar el cambio. Probá de nuevo." };
  switch (error.type) {
    case NETWORK_ERROR:
      return { message: NETWORK_MESSAGE };
    case CSRF_UNAVAILABLE:
      return { message: "No pudimos validar la sesión. Recargá la página y probá de nuevo." };
    case "access-denied":
      return { message: "Solo la persona titular del estudio maneja las cuentas del equipo." };
    case "user-duplicate-email":
      return {
        duplicateEmail: true,
        message:
          "Ya hay una cuenta con ese email en el estudio. Si es de alguien que dejó el estudio, buscala entre las archivadas y restaurala.",
      };
    case "last-owner":
      return {
        message:
          "El estudio necesita al menos una persona titular activa. Antes, dale el rol de titular a otra persona.",
      };
    case "own-account":
      return {
        message:
          "Tu propia cuenta no se cambia desde acá: pedíselo a otra persona titular del estudio. Actualizamos la lista.",
      };
    case "not-found":
      return { message: "Ya no encontramos esa cuenta. Actualizamos la lista." };
    case "invalid-user-data":
      return {
        message:
          "Revisá los datos: el nombre no puede quedar vacío y el email tiene que tener la forma nombre@dominio.com.",
      };
  }
  if (error.status === 400) return { message: "Revisá los datos y probá de nuevo." };
  return {
    message:
      error.status >= 500
        ? "El servidor tuvo un problema y no pudimos guardar el cambio. Probá de nuevo en unos minutos."
        : "No pudimos guardar el cambio. Probá de nuevo.",
  };
}
