/**
 * The fictitious firm and users the backend seeds with the `demo` profile
 * (backend/src/main/java/ar/gestorpenal/demo/DemoData.java). They all share DEMO_PASSWORD.
 */
export const DEMO_FIRM = { slug: "estudio-demo", name: "Estudio Demo (ficticio)" } as const;

export interface DemoUser {
  email: string;
  displayName: string;
}

export const LUCIA: DemoUser = {
  email: "lucia.ejemplo@example.com",
  displayName: "Lucía Ejemplo",
};

export const MARTIN: DemoUser = {
  email: "martin.prueba@example.com",
  displayName: "Martín Prueba",
};

export const JULIAN: DemoUser = {
  email: "julian.muestra@example.com",
  displayName: "Julián Muestra",
};

/** The paralegal. No e2e test uses her, so the screenshot capture borrows her for the 2FA step. */
export const SOFIA: DemoUser = {
  email: "sofia.ficticia@example.com",
  displayName: "Sofía Ficticia",
};

/** Checked by playwright.demo.config.ts before any test runs. */
export function demoPassword(): string {
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error("DEMO_PASSWORD is not set (see docs/DEMO.md).");
  return password;
}

/** The demo case with two defendants (DemoDataSeeder). */
export const DEMO_CASE = {
  number: "DEMO-001",
  caption: "Fernández Ruiz, Tomás y otra s/ robo agravado (ficticio)",
  defendants: ["Fernández Ruiz, Tomás", "Soto Ejemplo, Gabriela"],
} as const;

/** Other demo cases the guided script (docs/DEMO.md) opens (DemoCases). */
export const DETAINEES_CASE = {
  number: "DEMO-004",
  caption: "Benítez Ejemplo, Carla y otros s/ homicidio (ficticio)",
} as const;

export const PROBATION_CASE = {
  number: "DEMO-005",
  caption: "Ledesma Prueba, Hernán s/ hurto (ficticio)",
} as const;

/** The laboral case of the "otros fueros" segment (DemoAreaCases): three parties, no defendants. */
export const LABORAL_CASE = {
  number: "DEMO-LAB-002",
  caption:
    "Arce Prueba, Nélida c/ Obras del Sur Ficticia S.A. y ART Muestra S.A. s/ accidente de trabajo (ficticio)",
  parties: ["Arce Prueba, Nélida", "Obras del Sur Ficticia S.A.", "ART Muestra S.A."],
} as const;

/** The firm's zone: the seed and the agenda count days in it. */
export const FIRM_TIME_ZONE = "America/Argentina/Buenos_Aires";
