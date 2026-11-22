/** "Lucía Ejemplo" → "LE"; falls back to the first letter of the email. */
export function initialsOf(displayName: string, email: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0];
  const last = words.length >= 2 ? words[words.length - 1]?.[0] : undefined;
  const letters = first ? `${first}${last ?? ""}` : (email[0] ?? "?");
  return letters.toLocaleUpperCase("es-AR");
}
