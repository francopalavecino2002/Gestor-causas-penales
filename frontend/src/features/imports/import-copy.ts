import type { Role } from "@/features/auth/auth-api";
import type { ImportCreated, ImportKind } from "@/features/imports/import-types";

/** Same rule as the backend (ImportService.requireCanImport): a bulk load creates many records. */
export const IMPORT_ROLES: readonly Role[] = ["OWNER", "LAWYER"];

/** Same limits as the backend (ADR-0019): 2 MB and 1000 data rows, .csv or .xlsx. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_DATA_ROWS = 1000;
export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"] as const;
export const ACCEPT_ATTRIBUTE =
  ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface ImportKindOption {
  kind: ImportKind;
  title: string;
  /** The records inside a sentence: "las personas". */
  plural: string;
  description: string;
  /** An optional column worth knowing about before filling the file in. */
  columnNote?: string;
  /** Where the imported records live, for the last step. */
  area: { to: "/personas" | "/causas" | "/"; label: string };
}

/** In the order they have to be imported: each kind finds the records of the one before. */
export const IMPORT_KINDS: ImportKindOption[] = [
  {
    kind: "persons",
    title: "Personas",
    plural: "las personas",
    description:
      "Defendidos, víctimas, testigos y demás personas, con su documento. Una fila por persona.",
    area: { to: "/personas", label: "Mirá las personas" },
  },
  {
    kind: "cases",
    title: "Causas",
    plural: "las causas",
    description:
      "Una fila por causa e imputado. Cada imputado se busca por su documento; si no está, se crea.",
    columnNote:
      "Columna opcional «fuero»: penal, civil, laboral o familia (vacía es penal). Las causas de un fuero sin imputados dejan vacías las columnas del imputado.",
    area: { to: "/causas", label: "Mirá las causas" },
  },
  {
    kind: "hearings",
    title: "Audiencias",
    plural: "las audiencias",
    description:
      "Una fila por audiencia. Cada una nombra su causa por legajo MPF o número interno.",
    area: { to: "/", label: "Mirá la agenda" },
  },
];

export function kindOption(kind: ImportKind): ImportKindOption {
  return IMPORT_KINDS.find((option) => option.kind === kind) ?? IMPORT_KINDS[0]!;
}

/** The kind that usually comes next, if any. */
export function nextKind(kind: ImportKind): ImportKindOption | undefined {
  const index = IMPORT_KINDS.findIndex((option) => option.kind === kind);
  return IMPORT_KINDS[index + 1];
}

function count(amount: number, one: string, many: string): string {
  return `${amount} ${amount === 1 ? one : many}`;
}

/** "3 personas", "2 causas, 3 imputados y 1 persona"; empty when nothing is created. */
export function createdLabel(created: ImportCreated): string {
  const parts = [
    created.cases > 0 ? count(created.cases, "causa", "causas") : null,
    created.defendants > 0 ? count(created.defendants, "imputado", "imputados") : null,
    created.hearings > 0 ? count(created.hearings, "audiencia", "audiencias") : null,
    created.persons > 0 ? count(created.persons, "persona", "personas") : null,
  ].filter((part): part is string => part !== null);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

export function rowsLabel(amount: number): string {
  return count(amount, "fila", "filas");
}

/** "245 KB", "1,2 MB": how a lawyer reads a file size. */
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}

/** What is wrong with the chosen file before sending it, or null when it can go. */
export function fileProblem(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return name.endsWith(".xls")
      ? "Los archivos .xls viejos no se pueden leer. Abrilo en Excel y guardalo como .xlsx o como CSV."
      : "El archivo tiene que ser una planilla .csv o .xlsx.";
  }
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_FILE_BYTES) {
    return `El archivo pesa ${fileSizeLabel(file.size)} y el máximo es 2 MB. Dividilo en partes y subilas de a una.`;
  }
  return null;
}
