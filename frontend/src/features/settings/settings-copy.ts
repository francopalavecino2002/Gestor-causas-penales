import {
  FolderCog,
  Hourglass,
  Landmark,
  ListChecks,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/features/auth/auth-api";
import type { AnyCatalogId } from "@/features/catalogs/catalog-types";
import { computationLabel } from "@/features/deadlines/deadline-format";
import type { Computation } from "@/features/deadlines/deadline-types";
import type {
  CustomFieldEntity,
  CustomFieldType,
  SuspensionKind,
} from "@/features/settings/settings-types";

/** The settings sections, in the order of the index and the section links. */
export interface SettingsSection {
  to:
    | "/ajustes/fueros"
    | "/ajustes/catalogos"
    | "/ajustes/campos"
    | "/ajustes/plazos"
    | "/ajustes/ia"
    | "/ajustes/usuarios";
  title: string;
  /** One line under the title in the index. */
  summary: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    to: "/ajustes/fueros",
    title: "Fueros",
    summary: "En qué fueros trabaja el estudio: penal, civil, laboral, familia.",
    icon: Landmark,
  },
  {
    to: "/ajustes/catalogos",
    title: "Catálogos",
    summary: "Tipos de audiencia, etapas, medidas y demás listas: renombrá, ocultá o agregá ítems.",
    icon: ListChecks,
  },
  {
    to: "/ajustes/campos",
    title: "Campos propios",
    summary: "Datos que tu estudio quiere registrar en cada causa o imputado.",
    icon: FolderCog,
  },
  {
    to: "/ajustes/plazos",
    title: "Reglas de plazos",
    summary: "Qué plazos calcula el sistema y con cuántos días de aviso.",
    icon: Hourglass,
  },
  {
    to: "/ajustes/ia",
    title: "Asistente de IA",
    summary: "Opcional: completá audiencias pegando la notificación. Viene desactivado.",
    icon: Sparkles,
  },
  {
    to: "/ajustes/usuarios",
    title: "Usuarios y roles",
    summary: "Tu cuenta, la verificación en dos pasos y qué puede hacer cada rol.",
    icon: UsersRound,
  },
];

/** How each catalog reads in the screen. */
export const CATALOG_TITLES: Record<AnyCatalogId, string> = {
  stages: "Etapas del proceso",
  "closing-outcomes": "Formas de cierre",
  "hearing-types": "Tipos de audiencia",
  "hearing-statuses": "Estados de audiencia",
  "cancellation-reasons": "Motivos de cancelación de audiencias",
  "coercive-measures": "Medidas de coerción",
  "procedural-risks": "Riesgos procesales",
  "liberty-situations": "Situaciones de libertad",
  "alternative-outcomes": "Salidas alternativas",
  circumscriptions: "Circunscripciones judiciales",
  "party-roles": "Roles en la causa",
  "action-types": "Tipos de acción o de proceso",
  "represented-sides": "A quién representa el estudio",
};

/** What the firm may do with a catalog, in one sentence. */
export function catalogRules(view: { hideable: boolean; extensible: boolean }): string {
  if (view.extensible) return "Podés renombrar y ocultar ítems, y agregar los de tu estudio.";
  if (view.hideable) {
    return "Podés renombrar y ocultar ítems. No se pueden agregar: es una lista cerrada de la norma.";
  }
  return "Podés renombrar ítems. No se pueden ocultar ni agregar: el sistema los usa para calcular y ordenar.";
}

export const ENTITY_LABELS: Record<CustomFieldEntity, string> = {
  CASE_FILE: "Causas",
  DEFENDANT: "Imputados",
};

/** The records a field belongs to, inside a sentence: "Agregá un campo a las causas". */
export const ENTITY_TARGETS: Record<CustomFieldEntity, string> = {
  CASE_FILE: "las causas",
  DEFENDANT: "los imputados",
};

/** What stops a rule's clock, with its source; review tags kept visible. */
export const SUSPENSION_LABELS: Record<SuspensionKind, string> = {
  REBELLION: "Rebeldía (CPP art. 52)",
  MEDIATION: "Mediación penal (Ley 2996) [validar]",
  FEDERAL_EXTRAORDINARY_APPEAL: "Recurso extraordinario federal (CPP art. 87)",
};

/** One extension the law allows: "Juez de garantías: hasta 4 meses". */
export function extensionAllowedLabel(
  extension: { grantedBy: string; maxAmount: number },
  computation: Computation,
): string {
  return `${extension.grantedBy}: hasta ${computationLabel(computation, extension.maxAmount)}`;
}

export const FIELD_TYPES: { type: CustomFieldType; label: string; hint: string }[] = [
  { type: "TEXT", label: "Texto", hint: "Hasta 1000 caracteres." },
  { type: "NUMBER", label: "Número", hint: "Por ejemplo, un monto o una cantidad." },
  { type: "DATE", label: "Fecha", hint: "Un día del calendario." },
  { type: "BOOLEAN", label: "Sí o no", hint: "Una casilla para marcar." },
  { type: "LIST", label: "Lista de opciones", hint: "Se elige una de las opciones que cargues." },
];

export const FIELD_TYPE_LABELS = Object.fromEntries(
  FIELD_TYPES.map(({ type, label }) => [type, label]),
) as Record<CustomFieldType, string>;

/**
 * What each role can do today, from the backend's checks (CasePermissions, person.Permissions and
 * the settings controllers). Keep in sync when the permissions change.
 */
export const ROLE_DESCRIPTIONS: Record<Role, string[]> = {
  OWNER: [
    "Ve todas las causas, también las reservadas.",
    "Cambia la configuración del estudio: fueros, catálogos, campos propios y reglas de plazos.",
    "Puede ser responsable de causas, archivarlas y restaurarlas.",
    "Archiva y restaura personas, e importa planillas.",
  ],
  LAWYER: [
    "Ve las causas del estudio y las reservadas de las que forma parte.",
    "Puede ser responsable de causas y, como responsable, arma su equipo.",
    "Archiva y restaura causas y personas, e importa planillas.",
  ],
  PARALEGAL: [
    "Ve las causas del estudio y las reservadas de las que forma parte.",
    "Carga y edita causas, imputados, personas y audiencias.",
    "No archiva ni restaura.",
  ],
  ADMIN_STAFF: [
    "Ve las causas del estudio y las reservadas de las que forma parte.",
    "Lleva la agenda y carga datos de causas y personas.",
    "No archiva ni restaura.",
  ],
};

export const ROLE_ORDER: Role[] = ["OWNER", "LAWYER", "PARALEGAL", "ADMIN_STAFF"];

/** "1 día", "3 días"; 0 is "el mismo día". */
export function alertDaysLabel(days: number): string {
  if (days === 0) return "el mismo día que vence";
  return days === 1 ? "1 día antes" : `${days} días antes`;
}
