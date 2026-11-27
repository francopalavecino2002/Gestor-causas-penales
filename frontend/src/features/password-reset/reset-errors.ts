import { formatWait, NETWORK_MESSAGE } from "@/features/auth/login-errors";
import { CSRF_UNAVAILABLE, isApiError, NETWORK_ERROR } from "@/lib/api";

/** What to tell the user when asking for the link failed. It never hints whether the account exists. */
export function resetRequestMessage(error: unknown): string {
  if (!isApiError(error)) return "No pudimos pedir el enlace. Probá de nuevo.";
  switch (error.type) {
    case NETWORK_ERROR:
      return NETWORK_MESSAGE;
    case CSRF_UNAVAILABLE:
      return "No pudimos preparar el pedido. Recargá la página y probá de nuevo.";
    case "password-reset-throttled":
      return error.retryAfter
        ? `Ya pediste varios enlaces. Por seguridad, esperá ${formatWait(error.retryAfter)} antes de pedir otro. Mientras tanto, revisá tu correo: puede que ya te haya llegado.`
        : "Ya pediste varios enlaces. Por seguridad, esperá unos minutos antes de pedir otro. Mientras tanto, revisá tu correo: puede que ya te haya llegado.";
    default:
      if (error.status >= 500) {
        return "El servidor tuvo un problema y no pudimos pedir el enlace. Probá de nuevo en unos minutos.";
      }
      return error.status === 400
        ? "Revisá el estudio y el email, y probá de nuevo."
        : "No pudimos pedir el enlace. Probá de nuevo.";
  }
}
