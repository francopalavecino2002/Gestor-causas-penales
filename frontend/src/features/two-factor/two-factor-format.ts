/** The id of the section in Ajustes → Usuarios, which the Ajustes prompt links to. */
export const TWO_FACTOR_ANCHOR = "verificacion-en-dos-pasos";

/** At or below this many unused recovery codes, the screen suggests new ones. */
export const LOW_RECOVERY_CODES = 3;

/** The name of the downloaded list: generic, so it says nothing about whose account it is. */
export const RECOVERY_CODES_FILE_NAME = "codigos-recuperacion-gestor.txt";

/** "JBSWY3DPEHPK3PXP" reads as "JBSW Y3DP EHPK 3PXP": easier to copy by hand into the app. */
export function groupSecret(secret: string, size = 4): string[] {
  const clean = secret.replace(/\s/g, "").toUpperCase();
  const groups: string[] = [];
  for (let i = 0; i < clean.length; i += size) groups.push(clean.slice(i, i + size));
  return groups;
}

/** The recovery codes as plain text: what "Copiar" puts on the clipboard. */
export function recoveryCodesList(codes: string[]): string {
  return codes.map((code, index) => `${index + 1}. ${code}`).join("\r\n");
}

/**
 * The downloaded file: who it belongs to, when it was made, how the codes work and the list.
 * CRLF line ends so it opens well in any notepad.
 */
export function recoveryCodesFile(
  codes: string[],
  account: { email: string; firm: string },
  generatedAt: Date,
): string {
  const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(generatedAt);
  return [
    "Códigos de recuperación: verificación en dos pasos",
    `Cuenta: ${account.email} (${account.firm})`,
    `Generados el ${date}`,
    "",
    "Cada código sirve una sola vez para ingresar si no tenés tu app de autenticación.",
    "Si generás códigos nuevos, estos dejan de funcionar.",
    "Guardá este archivo en un lugar seguro, fuera del celular.",
    "",
    recoveryCodesList(codes),
    "",
  ].join("\r\n");
}
