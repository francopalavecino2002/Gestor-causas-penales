import { isApiError, NETWORK_ERROR } from "@/lib/api";

/** Why a draft could not be made, in the screen's words. Never the server's raw text. */
export function hearingDraftErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    switch (error.type) {
      case NETWORK_ERROR:
        return "No hay conexión con el servidor. Revisá tu conexión y volvé a intentar.";
      case "ai-assist-rate-limited":
      case "ai-provider-busy":
        return "El servicio de IA está ocupado. Esperá un minuto y volvé a intentar, o cargá los datos a mano.";
      case "ai-provider-failed":
        return "El servicio de IA no pudo leer la notificación. Cargá los datos a mano.";
      case "ai-assist-disabled":
        return "La persona titular del estudio desactivó el asistente de IA.";
      case "ai-assist-unavailable":
        return "El asistente de IA no está configurado en esta instalación.";
      case "not-found":
        return "Ya no encontramos la causa. Recargá la página.";
    }
    if (error.status === 400) return "Pegá el texto de la notificación (hasta 20.000 caracteres).";
  }
  return "No pudimos completar la audiencia. Cargá los datos a mano.";
}
