import { useEffect, useState } from "react";

import { useTheme } from "@/components/theme/theme-context";
import { GuideSection } from "@/pages/design-system/section";

interface ColorToken {
  name: string;
  use: string;
}

const COLOR_GROUPS: { title: string; tokens: ColorToken[] }[] = [
  {
    title: "Superficies y texto",
    tokens: [
      { name: "background", use: "Fondo de la página" },
      { name: "card", use: "Tarjetas, menús, diálogos" },
      { name: "foreground", use: "Texto principal" },
      { name: "muted-foreground", use: "Texto secundario, artículo del CPP" },
      { name: "border", use: "Bordes de tarjetas y divisores" },
      { name: "border-strong", use: "Bordes de campos, puntos del riel" },
    ],
  },
  {
    title: "Marca y acciones",
    tokens: [
      { name: "primary", use: "Acción principal, enlaces, foco, línea «Ahora»" },
      { name: "primary-hover", use: "Acción principal al pasar o presionar" },
      { name: "accent", use: "Fila seleccionada, ítem activo del menú" },
      { name: "secondary", use: "Pista de controles segmentados" },
    ],
  },
  {
    title: "Privación de libertad",
    tokens: [
      { name: "detained", use: "Texto de la alerta y la etiqueta de detenido" },
      { name: "detained-soft", use: "Fondo de la alerta y la etiqueta" },
      { name: "detained-edge", use: "Borde izquierdo de 6 px" },
    ],
  },
  {
    title: "Plazos",
    tokens: [
      { name: "deadline", use: "Fecha de vencimiento" },
      { name: "deadline-soft", use: "Fondo de la etiqueta de plazo" },
      { name: "deadline-edge", use: "Borde izquierdo de 6 px" },
    ],
  },
  {
    title: "Estados de audiencia",
    tokens: [
      { name: "status-programada", use: "Solicitada, programada" },
      { name: "status-reprogramada", use: "Reprogramada, cuarto intermedio" },
      { name: "status-efectiva", use: "Efectiva, reconvertida" },
      { name: "status-suspendida", use: "Suspendida, cancelada" },
    ],
  },
];

/**
 * Reads the rendered value of each token from the stylesheet, so the guide can never drift from
 * index.css. Re-reads after the theme class changes (next frame, once <html> is updated).
 */
function useTokenValues(names: string[]) {
  const { resolvedTheme } = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});
  const key = names.join(",");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const styles = getComputedStyle(document.documentElement);
      setValues(
        Object.fromEntries(
          key.split(",").map((name) => [name, styles.getPropertyValue(`--${name}`).trim()]),
        ),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [key, resolvedTheme]);

  return values;
}

const ALL_TOKENS = COLOR_GROUPS.flatMap((group) => group.tokens.map((token) => token.name));

export function ColorSection() {
  const values = useTokenValues(ALL_TOKENS);

  return (
    <GuideSection
      id="color"
      title="Color"
      intro="Un solo azul de río sobre papel frío. El rojo significa una sola cosa: un cliente privado de su libertad. El ámbar, un plazo. Los valores cambian con el tema."
    >
      <div className="grid gap-6">
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className="grid gap-3">
            <h3 className="text-card-title font-bold">{group.title}</h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.tokens.map((token) => (
                <li
                  key={token.name}
                  className="grid grid-cols-[3.5rem_1fr] items-center gap-3 rounded-xl border bg-card p-3"
                >
                  <span
                    aria-hidden="true"
                    className="size-14 rounded-lg border"
                    style={{ backgroundColor: `var(--${token.name})` }}
                  />
                  <span className="grid min-w-0">
                    <code className="truncate text-meta font-bold">--{token.name}</code>
                    <span className="text-small text-muted-foreground">{token.use}</span>
                    {values[token.name] ? (
                      <span className="text-small font-semibold text-muted-foreground uppercase tabular-nums">
                        {values[token.name]}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </GuideSection>
  );
}

const TYPE_SCALE = [
  {
    token: "text-display",
    spec: "28 px en el teléfono, 32 px desde 768 px. Peso 700.",
    sample: "Hoy tenés 5 audiencias",
    className: "text-display font-bold",
  },
  {
    token: "text-title",
    spec: "20 px, interlineado 26 px. Peso 700.",
    sample: "Plazos que vencen",
    className: "text-title font-bold",
  },
  {
    token: "text-time",
    spec: "18 px en el teléfono, 21 px desde 768 px. Peso 700, cifras tabulares.",
    sample: "08:30  11:00  12:30",
    className: "text-time font-bold tabular-nums whitespace-pre",
  },
  {
    token: "text-card-title",
    spec: "18 px, interlineado 24 px. Peso 700.",
    sample: "Revisión de prisión preventiva",
    className: "text-card-title font-bold",
  },
  {
    token: "text-body",
    spec: "17 px, interlineado 25 px. Peso 400 a 600.",
    sample: "Carla Modelo está en prisión preventiva y tiene audiencia hoy a las 11:00.",
    className: "text-body",
  },
  {
    token: "text-meta",
    spec: "16 px, interlineado 24 px. Peso 400.",
    sample: "Sala 5, Ciudad Judicial. Legajo DEMO-0098/2026.",
    className: "text-meta tabular-nums",
  },
  {
    token: "text-small",
    spec: "15 px, interlineado 22 px. Peso 500 a 700. Es el mínimo: nada va más chico.",
    sample: "CPP arts. 167 a 169",
    className: "text-small font-medium",
  },
];

export function TypographySection() {
  return (
    <GuideSection
      id="tipografia"
      title="Tipografía"
      intro="Atkinson Hyperlegible Next, una sola familia para todo. La jerarquía sale del tamaño y el peso. Distingue I l 1, 5 S y 0 O, clave en legajos y horarios."
    >
      <ol className="grid divide-y rounded-xl border bg-card">
        {TYPE_SCALE.map((step) => (
          <li
            key={step.token}
            className="grid gap-1 px-4 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6 sm:px-6"
          >
            <div className="grid content-start">
              <code className="text-meta font-bold">{step.token}</code>
              <span className="text-small text-muted-foreground">{step.spec}</span>
            </div>
            <p className={step.className}>{step.sample}</p>
          </li>
        ))}
      </ol>
    </GuideSection>
  );
}

const RADII = [
  {
    token: "rounded-md",
    value: "8 px",
    use: "Controles chicos, ítems segmentados",
    className: "rounded-md",
  },
  { token: "rounded-lg", value: "10 px", use: "Botones, campos, alertas", className: "rounded-lg" },
  {
    token: "rounded-xl",
    value: "14 px",
    use: "Tarjetas de audiencia y plazo",
    className: "rounded-xl",
  },
  {
    token: "rounded-full",
    value: "Píldora",
    use: "Etiquetas de estado y botón flotante",
    className: "rounded-full",
  },
];

export function ShapeSection() {
  return (
    <GuideSection
      id="forma"
      title="Forma, espacio y elevación"
      intro="Base de 4 px. Márgenes de página de 16, 32 y 40 px. Todo es plano con borde de 1 px; solo flota con sombra lo que está encima del contenido."
    >
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {RADII.map((radius) => (
          <li key={radius.token} className="grid gap-2 rounded-xl border bg-card p-3">
            <span
              aria-hidden="true"
              className={`h-12 border-2 border-primary bg-accent ${radius.className}`}
            />
            <code className="text-meta font-bold">{radius.token}</code>
            <span className="text-small text-muted-foreground">
              {radius.value}. {radius.use}
            </span>
          </li>
        ))}
      </ul>
    </GuideSection>
  );
}
