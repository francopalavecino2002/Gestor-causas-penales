# Capturas de la demo (T33)

Cada pantalla del [guion de 10 minutos](../../DEMO.md#guion-de-10-minutos), en celular
(390×844) y en compu (1440×900), tema claro. Se sacan contra el backend real con los datos
ficticios de demo, no contra respuestas simuladas:

```bash
bash scripts/e2e-demo.sh --screenshots
```

El spec es `frontend/e2e-demo/screenshots.capture.ts` (configuración
`playwright.demo-screenshots.config.ts`); la suite de punta a punta no lo corre. Los nombres
siguen el orden del guion: `NN-pantalla-{mobile,desktop}.png`.

| Paso | Pantalla |
|---|---|
| 01, 02 | Ingreso y código de verificación (2FA) |
| 03, 04 | Agenda de hoy y de la semana |
| 05, 06 | Plazos, y solo los de personas detenidas |
| 07 a 11 | Causas: lista, resumen e imputados de DEMO-004, plazos de DEMO-001, período de prueba de DEMO-005 |
| 12 a 16 | Ajustes: índice, catálogos, campos propios, reglas de plazos, usuarios y roles |
| 17 a 19 | Importar: qué importás, fila para corregir, listo |
| 20 | Personas |
| 21, 22 | Otros fueros: causas civiles y una causa laboral con sus partes (T63) |

## Revisión visual contra `docs/design/DESIGN.md`

Revisadas paleta, tipografía (nada por debajo de 15 px), espaciado, contraste, densidad en el
celular, desborde horizontal y textos en castellano rioplatense.

### Corregido

| Problema | Arreglo |
|---|---|
| **Agenda en el celular:** con tres avisos de detenidos, el bloque rojo ocupaba toda la primera pantalla y no se veía ninguna audiencia. DESIGN.md pide el aviso y dos audiencias. | En teléfonos (menos de 768 px) el aviso muestra el primero y "Mirá los N avisos"; desde 768 px sigue mostrando tres. El aviso de cálculo asistido queda siempre (`detainee-alerts.tsx`, test en `home-page.test.tsx`). |
| **Plazos sin sus notas:** el plazo judicial de una salida alternativa guarda en la nota la suspensión de juicio a prueba, sus reglas de conducta y la marca `[validar]`, pero la tarjeta no la mostraba. El paso del guion no tenía nada que mostrar. | La tarjeta de plazo muestra "Notas: …" cuando hay (`deadline-card.tsx`, tests en `deadlines-page.test.tsx`). |
| **Lista de causas en la compu:** sin legajo cargado, "Sin legajo MPF" se partía en tres renglones en una columna angosta y el encabezado "Legajo MPF" en dos. | En la tabla dice "Sin cargar" (como la ficha de la causa) y ni la celda ni el encabezado se parten; las tarjetas del celular siguen diciendo "Sin legajo MPF" porque no tienen encabezado (`case-list.tsx`, test en `case-list-page.test.tsx`). |
| **Campos propios en la compu:** el estado vacío terminaba 96 px antes que el botón "Agregá un campo" de arriba, y el borde derecho quedaba desalineado. | El estado vacío ocupa el mismo ancho que la barra de arriba (`CasesEmpty` acepta `className`; `custom-fields-section.tsx`). |

### Revisado y sin cambios

- Contraste: solo se usan los tokens medidos en DESIGN.md; el rojo aparece únicamente en
  personas detenidas y el ámbar en plazos.
- Sin desborde horizontal a 390 px en ninguna pantalla; los textos largos (carátulas, normas) se
  parten sin cortar palabras.
- Todo plazo y todo aviso de detenidos muestra la norma y "Cálculo asistido: verificá con la
  norma"; las marcas `[validar]` y `[no verificado]` quedan a la vista.
- La lista de plazos usa dos columnas desde la compu: un grupo con un solo plazo ocupa media
  fila. Es coherente con los grupos de dos y no se cambió.
- Pendiente fuera de esta tarea: la sección **Personas** es un "Próximamente" (el guion no la
  abre) y no hay pantalla para activar el segundo factor (la captura 02 lo activa por API).
