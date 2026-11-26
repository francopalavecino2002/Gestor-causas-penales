---
status: draft
date: 2026-11-25
scope: Neuquén, honorarios de abogados y procuradores (Ley 1594), calculadora en JUS (T50)
---

# Honorarios en JUS: Neuquén, Ley 1594 (borrador, no validado)

Este documento junta lo que se leyó de la **Ley 1594** (honorarios profesionales de abogados y
procuradores de Neuquén) para armar una calculadora **asistida**. No reemplaza la lectura de la
ley ni la regulación del juez: todo lo de acá va con `[validar]`. La calculadora siempre muestra el
artículo, la fecha del valor del JUS que usó y el aviso **"Cálculo asistido: verificá con la norma"**.

## 1. Fuentes

- Texto por artículo de la Ley 1594 en EJUR, tomado del texto ordenado no oficial del Poder
  Judicial "con las modificatorias incorporadas" (extraído el 3/8/2026):
  [ejur.com.ar/normas/neuquen/ley-1594](https://ejur.com.ar/normas/neuquen/ley-1594/).
  Se leyeron los arts. 7, 8, 9, 10, 15, 37, 45 y 46.
- Texto ordenado 2025 del Colegio de Abogados y Procuradores de Neuquén
  ([PDF](https://abognqn.org/wp-content/uploads/2025/10/LEY-1594-texto-ordenado-2025.pdf)). No se
  pudo leer el texto de forma automática: **no se comparó** con EJUR. [no verificado]
- Valor del JUS: lo publica el Poder Judicial de Neuquén en
  [jusneuquen.gov.ar/valor-jus](https://www.jusneuquen.gov.ar/valor-jus/).
- Se menciona una Ley 3532 (2025) que modifica la Ley 1594. Por lo que se encontró, trata el
  carácter alimentario de los honorarios y su embargabilidad, no las escalas. [no verificado]

## 2. Qué es el JUS (art. 8)

- El JUS es "la unidad de honorario profesional del abogado o procurador".
- Equivale al **1% de la remuneración total del cargo de Juez Letrado de Primera Instancia** de
  Neuquén.
- El Tribunal Superior de Justicia informa el valor "del 1 al 5 de cada mes". En la práctica se
  publican valores nuevos por resolución de la Administración General, con fecha de vigencia.
  [validar]
- **El sistema no busca el valor en internet.** Cada estudio carga el valor y la fecha desde la
  que rige, copiándolo de la fuente oficial. Se guarda el historial: no se borra, se agrega un valor
  nuevo.
- Valor de ejemplo usado en la demo: **$94.963,25 desde el 1/7/2026**, según la página del Poder
  Judicial leída el 25/11/2026. [validar: confirmá el valor vigente en la fuente]

## 3. Reglas que usa la calculadora

| Regla | Artículo | Qué dice | Marca |
|---|---|---|---|
| Escala de primera instancia | art. 7 | Entre el **11% y el 20%** del monto del proceso. | [validar] |
| Parte totalmente vencida | art. 7 | Mínimo del **70% del mínimo de la escala** (7,7%) y máximo del máximo (20%). | [validar] |
| Honorario mínimo | art. 9 | El honorario nunca baja del mínimo en JUS del tipo de proceso (lista del §4). | [validar] |
| Procurador | art. 10 | **40%** de lo que corresponde al abogado patrocinante. Si actúa como apoderado y patrocinante, cobra ambos (100% + 40%). | [validar] |
| Segunda instancia | art. 15 | Entre el **25% y el 35%** de lo regulado en primera instancia, por cada instancia. Si se revoca todo a favor del apelante, **35%**. | [validar] |

Cómo calcula, paso a paso:

1. Si hay monto: rango = monto × 11% a monto × 20% (o 7,7% a 20% si la parte cliente perdió todo).
2. Mínimo en pesos = JUS del tipo de proceso × valor del JUS vigente a la fecha elegida.
3. Cada extremo del rango se eleva al mínimo si queda por debajo. Sin monto (asuntos no
   apreciables en dinero), el resultado es el mínimo.
4. Rol: procurador × 40%; apoderado y patrocinante × 140%.
5. Segunda instancia: el rango de primera instancia × 25% a 35% (o 35% fijo si se revocó todo).
   Se aplica sobre el resultado del paso 4, ya elevado al mínimo y con el rol aplicado: se toma eso
   como "lo regulado en primera instancia". [validar: ¿el apoderado y patrocinante suma el 40% también
   en la alzada?]
6. Se muestra en pesos y en JUS, con cada paso y su artículo.

Lo que **no** hace: no aplica las pautas del art. 6 (complejidad, resultado, trascendencia), no
divide por etapas (arts. 37 a 46), no suma intereses ni IVA y no regula honorarios de peritos. Eso
lo decide el juez y lo controla el abogado.

## 4. Mínimos en JUS (art. 9)

Pisos generales (art. 9, primer párrafo):

| Código | Tipo | JUS | Marca |
|---|---|---|---|
| `conocimiento` | Procesos de conocimiento | 10 | [validar] |
| `ejecucion` | Procesos de ejecución | 7 | [validar] |
| `voluntarios-incidentes` | Voluntarios, incidentes, exhortos y oficios de otra jurisdicción | 5 | [validar] |
| `penal-general` | Procesos correccionales o penales | 10 | [validar] |

Asuntos judiciales no apreciables en dinero (art. 9, I):

| Código | Tipo | JUS | Marca |
|---|---|---|---|
| `divorcio` | Divorcio | 60 | [validar: el texto distingue por causal, anterior al Código Civil y Comercial de 2015] |
| `divorcio-conjunto` | Divorcio por presentación conjunta | 30 | [validar] |
| `adopcion` | Adopción | 20 | [validar] |
| `tutela-curatela` | Tutela y curatela | 15 | [validar] |
| `insania-filiacion` | Insania y filiación | 30 | [validar] |
| `tenencia-visitas` | Tenencia y régimen de visitas | 15 | [validar] |
| `informacion-sumaria` | Informaciones sumarias | 10 | [validar] |
| `denuncia-penal` | Denuncia penal con firma de abogado | 10 | [validar] |
| `excarcelacion-pedido` | Pedido de excarcelación | 10 | [validar] |
| `excarcelacion-concedida` | Excarcelación concedida (no se suma al pedido) | 12 | [validar] |
| `eximicion-pedido` | Pedido de eximición de prisión | 10 | [validar] |
| `eximicion-concedida` | Eximición de prisión concedida (no se suma al pedido) | 12 | [validar] |

Defensas penales (art. 9, I, 16). **El texto usa el procedimiento escrito anterior (sumario y
plenario, sobreseimiento provisorio).** Neuquén aplica hoy el proceso acusatorio (CPP, Ley 2784):
la equivalencia entre etapas no es directa. [validar: cómo se aplican hoy]

| Código | Tipo | JUS | Marca |
|---|---|---|---|
| `defensa-contravencion` | Contravenciones o faltas: defensa | 12 | [validar] |
| `defensa-correccional-sumario` | Juicio correccional, sumario: defensa | 22 | [validar] |
| `defensa-criminal-sumario` | Juicio criminal, sumario: defensa | 30 | [validar] |
| `defensa-correccional-plenario` | Juicio correccional, plenario: defensa (absorbe el sumario) | 25 | [validar] |
| `defensa-correccional-absolucion` | Juicio correccional, plenario: sentencia absolutoria | 55 | [validar] |
| `defensa-criminal-plenario` | Juicio criminal, plenario: defensa (absorbe el sumario) | 40 | [validar] |
| `defensa-criminal-absolucion` | Juicio criminal, plenario: sentencia absolutoria | 60 | [validar] |
| `querella-condena` | Querellante: condena o revocación de sobreseimiento definitivo | 30 | [validar] |

Se dejaron afuera, por ahora, los mínimos "con pruebas" y los sobreseimientos de la etapa sumaria,
los trámites registrales y los trabajos extrajudiciales del art. 9, II (consultas, contratos,
testamentos). Se agregan sin código nuevo en el YAML si un abogado los pide.

## 5. Preguntas para el abogado

1. ¿El texto de EJUR coincide con el texto ordenado 2025 del Colegio? ¿Hay mínimos actualizados?
2. ¿Cómo se aplican hoy los mínimos de "sumario" y "plenario" en el proceso acusatorio?
3. ¿Usan el valor del JUS vigente a la fecha de la regulación o a la del pago?
4. ¿Qué otros mínimos usan todos los días y conviene sumar?
5. En segunda instancia, ¿el 25% a 35% se calcula sobre lo regulado en primera con el rol ya aplicado
   (procurador 40%, apoderado y patrocinante 140%)?
