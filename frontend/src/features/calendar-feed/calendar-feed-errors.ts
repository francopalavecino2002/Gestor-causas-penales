import { CSRF_UNAVAILABLE, isApiError, NETWORK_ERROR } from "@/lib/api";

/** What a failed change of the calendar link means, in the screen's words. */
export function calendarFeedErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.type === NETWORK_ERROR) {
      return "No hay conexión con el servidor. Revisá tu conexión a internet y volvé a intentar.";
    }
    if (error.type === CSRF_UNAVAILABLE) {
      return "No pudimos validar la sesión. Recargá la página y volvé a intentar.";
    }
  }
  return "No pudimos cambiar tu enlace. Volvé a intentar en unos minutos.";
}

/** Why a hearing's `.ics` did not download, and what to do. */
export function hearingIcsErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.type === NETWORK_ERROR) {
      return "No pudimos descargar el archivo: no hay conexión. Revisá tu internet y volvé a intentar.";
    }
    if (error.status === 404) {
      return "No pudimos descargar el archivo: la audiencia ya no está disponible. Recargá la página.";
    }
  }
  return "No pudimos descargar el archivo del calendario. Volvé a intentar en unos minutos.";
}
