---
status: draft
source: https://claude.ai/artifact/CAm26oj1Ux4YUhm6wD5ncY (rev 7, 2026-11-21)
precedence: overrides data-model.md wherever they differ
---

> Agents: this document is the authoritative domain reference for Milestone 1. Keep every
> `[validar]` and `[no verificado]` tag visible in catalogs, seed data and UI copy.

# Etapa 0: revisión del modelo de datos y catálogos de Neuquén

2026-11-21 · @Franco

## Resumen

El modelo base está bien orientado (audiencias al centro, varios imputados por causa, nada se borra), pero tiene tres errores de fondo que conviene corregir antes de diseñar pantallas:

1. **La etapa, el estado y los plazos son de cada imputado, no de la causa.** En una causa con dos imputados, uno puede firmar un acuerdo pleno mientras el otro sigue a juicio, y los 4 meses del art. 158 corren desde la formulación de cargos de cada uno. Hoy el modelo los guarda en la causa.
2. **Un plazo no es solo una duración: también tiene una consecuencia legal y un estado jurisprudencial.** El TSJ declaró inconstitucional, caso por caso, la consecuencia (sobreseimiento) de los arts. 87 y 158, pero no el plazo. El sistema tiene que mostrar el vencimiento y avisar que su efecto está en discusión, sin decidir por el abogado.
3. **El cómputo depende del tipo de plazo** (art. 79): por horas corren sin parar, por días se cuentan solo días hábiles, y en medidas cautelares se cuentan días corridos. El modelo tiene "unidad" pero no esta distinción.

El resto son agregados y recortes: catálogos alineados con los artículos del CPP, tipos de audiencia que registra la Oficina Judicial, y sacar del MVP lo que tiene riesgo legal (antecedentes, datos sensibles) o no es núcleo (honorarios, ejecución, penal juvenil).

**Cómo leerlo.** Cada dato lleva su artículo o su fuente. **[validar]** marca lo que conviene confirmar con un abogado al mostrar el prototipo. **[no verificado]** marca lo que no pude leer en el texto del código: las copias públicas del CPP que encontré se cortan en el art. 155, así que los arts. 156 a 272 (acusación, juicio, impugnación, ejecución) salen de fuentes secundarias.

**Glosario mínimo.** *Formulación de cargos*: audiencia en la que el fiscal le comunica al imputado de qué lo acusa; desde ahí corre la investigación formal. *Medida de coerción*: restricción a la libertad mientras dura el proceso (presentarse a firmar, prisión preventiva, etc.). *Salida alternativa*: forma de terminar el caso sin juicio (conciliación, suspensión de juicio a prueba). *Cesura*: el juicio se parte en dos; primero se decide la culpabilidad y después, en otra audiencia, la pena. *Sobreseimiento*: cierre definitivo del caso a favor del imputado, antes del juicio.

## 1. Revisión del modelo de datos base

La tabla resume los cambios por sección del documento original; debajo está el porqué de los más importantes.

| Sección | Qué está mal | Qué falta | Qué sobra o se posterga |
| --- | --- | --- | --- |
| 1. Estudio y usuarios | Nada grave | Rol "solo lectura" (cliente o pasante) | — |
| 2. Personas | — | Víctima con sus derechos de notificación (art. 61); querellante institucional (Defensoría de los Derechos del Niño, art. 65) | Datos sensibles y relaciones entre personas: fuera del MVP por riesgo legal y peso |
| 4. Causa | Etapa, estado, resultado y fechas clave están en la causa; deberían estar en el imputado | Tipo de acción (pública, dependiente de instancia privada, privada: arts. 99 a 101); defensor/fiscal por imputado; sede de la Oficina Judicial | — |
| 4. Circunscripción | La Ley 2891 organiza dos Colegios de Jueces (I con sede en Neuquén; II a V con sede en Zapala y subsedes). "Vaca Muerta" no aparece en la Ley 2891 [validar si existe hoy como VI Circunscripción] | Colegio de Jueces y sede como datos aparte de la circunscripción | — |
| 4. Identificadores | — | Formato verificado del legajo MPF: `MPF` + sede + número/año (ej. MPFNQ 123989/2018, MPFZA 22478/2017). Número de OFIJU y de Pehuén [validar] | — |
| 5. Imputado | — | Etapa, estado, fecha de formulación de cargos, rebeldía (art. 52, suspende el plazo de duración), defensor (público o privado), resultado final | "Antecedentes informados": fuera del MVP (Ley 25.326, art. 7 inc. 4) |
| 6. Coerción | La lista de medidas no sigue el art. 113 (faltan "cuidado o vigilancia" y "abandono del domicilio"; "monitoreo electrónico" es una modalidad, no una medida) | Riesgo procesal invocado (fuga, entorpecimiento, riesgo para la víctima, reiterancia desde 2025 [validar ley]); duración fijada por el juez y plazo de investigación fijado (art. 116); revisión (art. 118) | — |
| 7. Audiencias | El catálogo no coincide con los tipos que registra la Oficina Judicial (ver catálogo) | Artículo del CPP por tipo; quién la pidió; resultado según la Oficina Judicial (efectiva, reconvertida, suspendida, cancelada, cuarto intermedio) y motivo de cancelación; imputados alcanzados | — |
| 8. Plazos | La regla de ejemplo dice "cuatro meses desde la formulación de cargos para acusar (art. 158)": el plazo existe, pero es prorrogable dos veces y su consecuencia fue declarada inconstitucional en un caso del TSJ | Tipo de cómputo (art. 79), consecuencia legal, estado jurisprudencial, prórrogas encadenadas, plazos judiciales fijados por el juez o el fiscal, suspensiones | — |
| 10. Prueba | — | Anticipo jurisdiccional de prueba (art. 155) | Detalle de testigos y peritos: después del MVP |
| 11. Salidas y sentencia | "Acuerdo pleno o procedimiento abreviado" mezcla cosas: en Neuquén el procedimiento abreviado agrupa acuerdo pleno, acuerdo parcial y juicio directo (arts. 217 a 222) | Desestimación y archivo (art. 131); extinción por vencimiento de plazo; cesura (determinación de pena separada) | Ejecución y cómputo de pena: después |
| 12. Honorarios | — | — | Todo el módulo: después del MVP |
| 16. Campos personalizados | Bien diseñado, pero es mucho para el MVP | — | En el MVP, solo en causa e imputado y con 5 tipos |

### Por qué la etapa va en el imputado

El CPP trata a cada imputado por separado: la formulación de cargos es personal (art. 133), la suspensión de juicio a prueba la pide cada imputado (art. 108), el criterio de oportunidad extingue la acción "respecto del participante beneficiado" (art. 107) y la rebeldía suspende el plazo solo para el rebelde (art. 52). La causa muestra un resumen (la etapa más atrasada, cuántos detenidos, la próxima audiencia), pero la verdad vive en el imputado.

### Por qué el plazo necesita consecuencia y estado jurisprudencial

El art. 87 dice que el proceso dura como máximo 3 años y que, vencido, se extingue la acción. El art. 158 dice lo mismo para la investigación (4 meses, prorrogables). El TSJ no derogó esos plazos: declaró inconstitucional la consecuencia en casos concretos, siguiendo a la Corte Suprema en "Price" (2021), porque las provincias no pueden crear causas de extinción de la acción penal. Mientras tanto el Fiscal General instruye a cumplirlos y los jueces del Tribunal de Impugnación votan distinto según el caso. Para un defensor, el vencimiento sigue siendo un argumento; para un querellante, un riesgo. El sistema lo muestra así, con la fuente a la vista.

### Organización del fuero penal (para modelar las partes)

- **Colegio de Jueces**: todos los jueces penales de la circunscripción; actúan como jueces de garantías, de juicio (unipersonal o tribunal de 3) o de jurados (Ley 2891, arts. 32 y 36; CPP art. 34). El juez que intervino en garantías no puede juzgar (CPP art. 5).
- **Oficina Judicial (OFIJU)**: organiza audiencias, cita a las partes y graba todo en audio o video; depende del TSJ (Ley 2891, arts. 43 y 44).
- **Tribunal de Impugnación**: sede en Neuquén, competencia provincial; revisa impugnaciones ordinarias (CPP art. 33).
- **TSJ, Sala Penal**: impugnación extraordinaria, queja y revisión de condenas (CPP art. 32).
- **Jueces de Ejecución**: uno para la I Circunscripción y uno para el interior (Ley 2891, art. 42); controlan penas, suspensión de juicio a prueba y condenas condicionales (CPP art. 37).
- **Jurado popular**: 12 titulares y 4 suplentes, obligatorio en delitos contra las personas o la integridad sexual, o con resultado de muerte o lesiones gravísimas, cuando el fiscal pide más de 15 años (CPP art. 35). Ojo: no es "cualquier delito con más de 15 años", como dicen las instrucciones del proyecto.

## 2. Catálogos base de Neuquén

Estos son los valores que vienen de fábrica en el paquete de jurisdicción Neuquén. Cada estudio puede renombrar, ocultar o agregar ítems, pero el artículo de origen queda guardado.

### 2.1 Etapas (por imputado)

1. **Averiguación preliminar y valoración inicial** (arts. 129 a 132). El fiscal tiene 60 días para decidir: desestimar, aplicar un criterio de oportunidad, derivar a mediación, archivar o abrir la investigación. El modelo la llamaba "investigación preliminar".
2. **Investigación preparatoria** (arts. 133 a 158). Empieza con la formulación de cargos. Si no hay imputado identificado es "investigación genérica" (art. 134), sin medidas de coerción.
3. **Conclusión de la investigación** (arts. 159 a 163): acusación, sobreseimiento o salida alternativa. [no verificado]
4. **Etapa intermedia o control de acusación** (arts. 164 a 173).
5. **Preparación del juicio** (art. 174): la hace el director de la Oficina Judicial, sin juez.
6. **Juicio**: técnico unipersonal, técnico colegiado o por jurados (arts. 34, 35 y 181 a 212).
7. **Determinación de la pena o cesura** (arts. 178, 179 y 196; con jurados, 202 y 211).
8. **Impugnación**: ordinaria ante el Tribunal de Impugnación (art. 245), extraordinaria ante el TSJ (arts. 248 y 249), queja (arts. 250 a 253) y revisión de condena (arts. 254 a 258).
9. **Ejecución** (arts. 259 a 266), ante el juez de Ejecución.
10. **Cerrada** (con su resultado).

Resultados de cierre: desestimación, archivo, criterio de oportunidad, conciliación o mediación cumplida, suspensión de juicio a prueba cumplida, sobreseimiento (con causal), extinción por vencimiento de plazo, acuerdo pleno, absolución, condena, prescripción, rebeldía sin captura (suspendido), otro.

### 2.2 Tipos de audiencia

La base es el registro oficial de las Oficinas Judiciales del primer año de la reforma, con su artículo y la cantidad realizada en 2014 en toda la provincia ([Audiencias en números 2014](https://pensamientopenal.com.ar/index.php/system/files/2015/04/miscelaneas40845.pdf)). Sirve para ordenar el catálogo por frecuencia: lo que más se usa va primero en la pantalla.

| Grupo | Tipo de audiencia | Artículo | Realizadas 2014 |
| --- | --- | --- | --- |
| Investigación | Formulación de cargos | 133 | 1.346 |
| Investigación | Detención y medida de coerción (incluye control de detención) | 112, 113, 116 | 250 |
| Investigación | Revisión de prisión preventiva | 118 | 126 |
| Investigación | Modificación y revisión de medidas cautelares | 117 | 125 |
| Investigación | Anticipo jurisdiccional de prueba | 155 | 163 |
| Investigación | Control de la investigación | 36 inc. 1 | 62 |
| Investigación | Prórroga de la investigación preparatoria | 158 | sin dato propio [validar] |
| Investigación | Revisión de desestimación o criterio de oportunidad | 132 | sin dato propio |
| Salidas | Suspensión de juicio a prueba | 108 | 407 |
| Salidas | Acuerdo pleno o parcial | 217 a 221 | dentro de "Otras" [validar] |
| Salidas | Juicio directo (flagrancia) | 222 | dentro de "Otras" [validar] |
| Conclusión | Petición de sobreseimiento | 161 | 196 |
| Intermedia | Control de acusación | 167 a 169 | 1.009 |
| Juicio | Preparación del juicio (sin juez) | 174 | 66 |
| Juicio | Juicio técnico (cuenta jornadas, no juicios) | 181 a 196 | 274 |
| Juicio | Selección de jurados | 197, 198 | sin dato propio |
| Juicio | Juicio por jurados | 203 a 212 | sin dato propio |
| Juicio | Determinación de la pena (cesura) | 178, 179, 196 | 104 |
| Juicio | Audiencia de conciliación en acción privada | 213 a 216 | sin dato propio |
| Impugnación | Impugnación ordinaria | 245 | 326 |
| Impugnación | Definición sobre prueba en el recurso | 244 | 97 |
| Impugnación | Prueba en caso de reenvío (nuevo juicio) | 247 | 4 |
| Impugnación | Control extraordinario (TSJ) | 249 | 6 |
| Ejecución | Ejecución, sustitución, modificación o extinción | 262 | 1.167 |
| Ejecución | Revisión de decisiones de ejecución | 266 | 40 |
| Ejecución | Revocación de instituto concedido | 263 | 30 |
| Ejecución | Revisión de sentencia | 257 | 0 |
| — | Otra | — | 319 |

El informe 2014 nombra 20 tipos (más "Otras" y "Sin clasificar"), no 37; los 37 de las instrucciones del proyecto probablemente cuentan subtipos internos de la OFIJU [validar con la lista actual de la Oficina Judicial]. Penal juvenil (Ley 2302) tiene sus propias audiencias de plenario y abreviado: queda para después.

Estados y resultados de la audiencia, tomados de la gestión de la Oficina Judicial ([informe Zapala 2018](https://www.rionegro.com.ar/wp-content/uploads/2019/04/informe-final-AUDIENCIAS-v2_ZAPALA.pdf)): solicitada, programada, reprogramada, realizada ("efectiva"), reconvertida (se hizo, pero como otro tipo), cuarto intermedio o continuación, suspendida por el juez, cancelada. Motivos de cancelación de ese informe: pedido de la defensa, pedido del fiscal, terminación anticipada, ausencia del imputado en libertad, domicilio inexacto, notificación incorrecta, medidas de fuerza, fallas técnicas.

### 2.3 Medidas de coerción (art. 113)

| # | Medida | Datos propios | Notas |
| --- | --- | --- | --- |
| 1 | Cuidado o vigilancia de una persona o institución | Quién la ejerce, informes | — |
| 2 | Presentación periódica | Ante quién, frecuencia | La más común en la práctica [validar] |
| 3 | Prohibición de salir de un ámbito, visitar lugares o comunicarse con personas | Lugar o persona protegida, distancia | Se notifica a la víctima (art. 61 inc. 4) |
| 4 | Abandono del domicilio si la víctima convive con el imputado | Domicilio | Se notifica a la víctima |
| 5 | Caución económica | Monto, tipo, quién la presta | — |
| 6 | Detención domiciliaria | Domicilio, con o sin vigilancia, monitoreo electrónico | Se notifica a la víctima |
| 7 | Prisión preventiva | Lugar de detención, riesgo invocado, duración fijada (art. 116) | Máximo 1 año salvo complejos (art. 119); revisión en 5 días (art. 118) |
| — | Internación provisional | Institución | Art. 121, por alteración mental |
| — | Embargo o inhibición | Bienes, monto | Art. 122, para garantizar la multa |

Riesgos procesales que justifican la prisión preventiva (art. 114 y 114 bis a quater, según la Ley 3021): peligro de fuga, entorpecimiento de la investigación, riesgo para la víctima o su familia y, desde la reforma aprobada el 11/06/2025, reiterancia con otras causas con cargos formulados ([nota](https://www.noticiasnqn.com.ar/noticias/2025/06/11/314997-la-legislatura-de-neuquen-aprobo-un-paquete-de-leyes-para-reforzar-la-seguridad-prision-preventiva-por-reiterancia-nueva-ley-policial-y-mas)) [validar número de ley y texto]. No procede prisión preventiva en acción privada, si cabe condena condicional, ni para mayores de 70, embarazadas, madres en el primer año de lactancia o enfermos graves (art. 115).

Situación de libertad (dato calculado del imputado): en libertad sin medidas, en libertad con medidas, aprehendido (menos de 24 h), detenido en domiciliaria, en prisión preventiva, condenado cumpliendo pena, prófugo o rebelde.

### 2.4 Salidas alternativas y procedimientos abreviados

| Salida | Artículo | Cuándo procede (resumen) | Qué se registra |
| --- | --- | --- | --- |
| Criterio de oportunidad: hecho insignificante | 106 inc. 1 | No afecta gravemente el interés público | Decisión fiscal, revisión de la víctima (5 días, art. 132) |
| Criterio de oportunidad: participación menor | 106 inc. 2 | Salvo pena mayor a 6 años | Ídem |
| Criterio de oportunidad: pena natural | 106 inc. 3 | El imputado sufrió un daño grave que hace innecesaria la pena | Ídem |
| Criterio de oportunidad: pena irrelevante | 106 inc. 4 | La pena no importa frente a otra ya impuesta o esperable | Ídem |
| Conciliación o mediación penal | 106 inc. 5, 131 inc. 3; Ley 2879 | Sin interés público prevalente o con reparación; excluye violencia doméstica o de género y delitos de funcionarios (Ley 2879, art. 3) | Fecha de derivación, acuerdo, cumplimiento |
| Suspensión de juicio a prueba | 108 | Si cabe condena condicional; se pide hasta la apertura a juicio; requiere conformidad fiscal | Reglas de conducta, plazo de prueba, control del juez de Ejecución |
| Acuerdo pleno | 217 a 220 | Acuerdo sobre hechos y pena; lo homologa el juez de garantías (art. 36 inc. 2) | Pena acordada [no verificado: límites de pena] |
| Acuerdo parcial | 221 | Acuerdo sobre los hechos; se discute la pena | [no verificado] |
| Juicio directo | 222 | Flagrancia; reforma de 2023 para pedirlo sin acuerdo de la defensa ([nota](https://www.rionegro.com.ar/?p=3287872)) | [validar si se sancionó] |

Ninguna salida aplica a delitos dolosos de funcionarios públicos en ejercicio del cargo (arts. 106 y 108). Pueblos indígenas: se aplica el art. 9.2 del Convenio 169 OIT (art. 109); conviene un campo "pertenencia a pueblo indígena" en el imputado [validar].

## 3. Reglas de plazos

La tabla trae 19 reglas; 13 entran al MVP porque cubren lo que más le importa a un penalista: detenidos, investigación, prisión preventiva e impugnación. Todas se cuentan según el art. 79: por horas, sin interrupción; por días, solo días hábiles, salvo medidas cautelares (días corridos); el plazo vence a las 24 h del último día. Las partes pueden acordar prórrogas o abreviarlos (art. 79 inc. 7).

| Regla | Art. | Dispara | Duración | Cómputo | Consecuencia si vence | Estado jurisprudencial | MVP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Detención sin control judicial | 112; 49 inc. 5 | Detención | 24 h | Horas corridas | Libertad | Vigente. En 2025 se pidió llevarlo a 48 h en narcomenudeo [validar si se aprobó] | Sí |
| Audiencia de medidas con detenido | 113 | Detención | 24 h | Horas corridas | Libertad | Vigente | Sí |
| Audiencia de medidas sin detenido | 113 | Pedido fiscal | 72 h | Horas corridas | — | Vigente | Sí |
| Formulación de cargos con detenido | 133 | Detención | 24 h | Horas corridas | Libertad | Vigente | Sí |
| Valoración inicial del fiscal | 129, 131 | Denuncia | 60 días | Hábiles | Sin consecuencia expresa | Vigente; ordenatorio en la práctica [validar] | Después |
| Revisión de desestimación o criterio de oportunidad (víctima) | 132 | Notificación | 5 días | Hábiles | Caduca el derecho | Vigente | Sí (querella) |
| Investigación preparatoria | 158; 160 inc. 7 | Apertura de la investigación o formulación de cargos [validar desde cuándo] | 4 meses + prórroga del juez (hasta 4) + prórroga del Colegio (hasta 4) | Meses calendario | Extinción y sobreseimiento | TSJ "Olave" (07/09/2024) declaró inconstitucional la consecuencia; el plazo sigue | Sí |
| Duración máxima del proceso | 87 | Apertura de la investigación | 3 años improrrogables | Años calendario; no cuenta el recurso extraordinario federal; la rebeldía suspende (art. 52) | Extinción y sobreseimiento | TSJ "Estarli" (Acuerdo 5/2023) y otros dos casos de 2023: inconstitucional la consecuencia en el caso; el Tribunal de Impugnación está dividido (Garro 2024 vs. Monsalve 2025) | Sí |
| Duración máxima de la prisión preventiva | 119 | Inicio de la prisión preventiva | 1 año, salvo asuntos complejos | Calendario (cautelar: corridos) | Cese; no se puede dictar otra medida privativa | Vigente. En disputa si corre después de la condena no firme (Instrucción General 7/2015 del MPF) [validar] | Sí |
| Duración fijada en la resolución de prisión preventiva | 116 | Resolución | La que fije el juez | Corridos | Revisión o cese | Plazo judicial: se carga a mano | Sí |
| Audiencia de revisión de prisión preventiva | 118 | Pedido de la defensa | 5 días | Corridos (cautelar) [validar] | Pronto despacho y, a las 24 h, libertad (art. 120) | Vigente | Sí |
| Resolución sin audiencia | 76 | Pedido | 3 días | Hábiles | Pronto despacho; queja por retardo a las 48 h (art. 88) | Vigente | Después |
| Aclaratoria | 78 | Notificación | 3 días | Hábiles | Suspende el plazo para impugnar | Vigente | Después |
| Recusación | 42 | Conocimiento de la causal | 3 días | Hábiles | Caduca | Vigente | Después |
| Revisión del rechazo como querellante | 64 | Rechazo fiscal | 3 días | Hábiles | Caduca | Vigente | Sí (querella) |
| Abandono de querella en acción privada | 68 | Último acto de impulso | 30 días | Hábiles | Querella abandonada | Vigente | Después |
| Impugnación ordinaria | 242 [no verificado] | Notificación de la decisión | 5 días [no verificado]; doble en asuntos complejos (art. 224) [no verificado] | Hábiles | Caduca | [validar] | Sí, con aviso |
| Resolución del Tribunal de Impugnación | 89 | Pronto despacho | 5 días | Hábiles | Se tiene por admitida la solución del recurrente si favorece al imputado | Vigente | Después |
| Suspensión por mediación penal | Ley 2996 [validar] | Derivación a mediación | 60 días + 30 | Corridos [validar] | Suspende los plazos procesales | Ley aprobada en 2016 según la prensa; no pude leer el texto oficial | Sí, como suspensión |

### Línea de tiempo de la jurisprudencia sobre plazos

- **12/08/2021, Corte Suprema, "Price"** (Chubut): las provincias no pueden crear causas de extinción de la acción penal; es materia del Congreso ([nota](https://www.rionegro.com.ar/?p=1918603)).
- **25/09/2023, TSJ Neuquén, "Estarli", Acuerdo 5/2023**: de oficio, declara inconstitucional el art. 87 "en su aplicación al caso" y revoca la extinción dictada por el Tribunal de Impugnación. Un vocal aclara que el plazo de 3 años no está en discusión, sino su consecuencia ([fallo](https://www.rionegro.com.ar/wp-content/uploads/2023/09/MPFNQ-Leg.-123.989-Ano-2018-ESTARLI-Acuerdo-5-de-fecha-25.09.23.pdf)).
- **Diciembre de 2023**: dos fallos más del TSJ en causas de abuso sexual, con el mismo criterio ([nota](https://www.rionegro.com.ar/?p=3336013)). El Fiscal General responde que los plazos siguen vigentes porque el fallo no tiene alcance general.
- **Abril de 2024**: el TSJ rechaza el recurso extraordinario federal de la Defensa Pública, así que la cuestión no llegó por esa vía a la Corte ([nota](https://www.rionegro.com.ar/?p=3543909)).
- **07/09/2024, TSJ, "Olave"**: declara inconstitucionales los arts. 158 y 160 inc. 7 (sobreseimiento por vencimiento de la investigación) y mantiene al imputado sujeto a proceso ([nota](https://www.rionegro.com.ar/justicia/el-tsj-de-neuquen-demolio-otro-plazo-para-las-investigaciones-penales-3780038/)).
- **19/12/2024, Tribunal de Impugnación, "Garro"**: confirma la inconstitucionalidad del art. 87. **Marzo de 2025, "Monsalve"**: otro Tribunal de Impugnación aplica el art. 87 y sobresee ([nota](https://www.rionegro.com.ar/?p=4062012)).

No encontré fallos posteriores a marzo de 2025 ni una reforma legislativa de estos plazos [validar con un abogado: estado al día de hoy].

### Cómo modelar la regla

Campos que hay que agregar a la regla del modelo base: tipo de cómputo (horas corridas, días hábiles, días corridos, meses o años calendario); consecuencia legal; estado jurisprudencial (texto corto + link + fecha de revisión); prórrogas permitidas (cantidad, quién la concede, duración máxima); eventos que suspenden (rebeldía, mediación, recurso extraordinario federal); alcance (imputado o causa); y si es un plazo legal o judicial. El plazo concreto guarda además las prórrogas concedidas y la audiencia que las dio. En la pantalla, cada vencimiento muestra la regla, el artículo y la leyenda "Cálculo asistido: verificá con la norma"; los de detenidos van primero y en rojo.

## 4. Qué entra en el MVP y qué queda para después

El MVP tiene que ganar una demo en 10 minutos con un abogado: "esta es tu semana de audiencias, estos son tus detenidos y esto vence". Todo lo que no sirve a esa frase se posterga.

| Módulo | MVP | Después | Por qué |
| --- | --- | --- | --- |
| Estudio, usuarios, roles, 2FA, auditoría | Completo | — | Seguridad desde el día uno; sin esto no hay venta ni consulta legal |
| Multi-estudio y paquete de jurisdicción | En el modelo de datos; solo el paquete Neuquén | Otras provincias | Cambiarlo después es carísimo; cargar otra provincia no |
| Personas y clientes | Ficha básica, roles en causas, contactos autorizados, consentimiento | Datos sensibles, relaciones entre personas | Riesgo legal (Ley 25.326) y poco valor en la demo |
| Conflicto de intereses | Alerta simple por documento | Coincidencias por nombre aproximado | Barato y muy valorado por abogados |
| Causa e imputados | Carátula, legajo MPF, circunscripción, partes, varios imputados con etapa y estado propios, cargos simples | Historial de calificación, escalas penales, teoría del caso estructurada | El núcleo; la calificación detallada no cambia la demo |
| Audiencias | Agenda semanal y diaria, catálogo de la sección 2.2, estados y resultados de la OFIJU, choques de horario, checklist por tipo, resultado con próxima audiencia | Aviso automático al cliente por WhatsApp, link al registro audiovisual | Es el eje del producto |
| Medidas de coerción | Las 7 del art. 113, prisión preventiva con duración y revisión, alertas de detenidos | Internación y embargo | Lo que más angustia a un penalista |
| Plazos | 13 reglas marcadas "Sí", calendario de hábiles de Neuquén, prórrogas, suspensiones, estado jurisprudencial | Editor visual de reglas para el estudio | Valor diferencial frente a Lex-Doctor |
| Salidas alternativas | Registro con reglas de conducta y vencimiento del período de prueba | Seguimiento de cuotas de reparación | Las SJP son la 3.ª audiencia más frecuente |
| Actuaciones, tareas y documentos | Línea de tiempo, tareas, adjuntos | Plantillas de escritos con variables, versionado | Plantillas requieren mucho trabajo de redacción jurídica |
| Catálogos editables | Sí | — | Principio del producto y bajo costo |
| Campos personalizados | En causa e imputado, 5 tipos (texto, número, fecha, sí o no, lista) | Resto de entidades, plantillas por tipo de causa, permisos por campo | El motor completo es un proyecto en sí mismo |
| Importación | CSV o Excel de causas, personas y audiencias | Importadores de Lex-Doctor | "Empezar en una tarde" |
| PWA y celular | Agenda, ficha del imputado y vencimientos usables en el teléfono | Modo sin conexión, notificaciones push | El penalista vive entre audiencias |
| Prueba, testigos y peritos | — | Todo | Importa en juicio, no en el día a día inicial |
| Sentencia, impugnación | Resultado y plazo de impugnación | Detalle de recursos | Se cubre con audiencias y plazos |
| Ejecución de la pena | — | Cómputo de pena y fechas de beneficios | Es otro producto dentro del producto |
| Honorarios y JUS | — | Todo el módulo | Útil, pero no es lo que vende la demo |
| Penal juvenil (Ley 2302) | — | Paquete propio | Otro procedimiento y más riesgo con datos de menores |
| Integración con Pehuén, MEV o SINE | — | Solo si lo legal y los términos de uso lo permiten | Restricción del proyecto |
| IA | — | Opcional y con revisión del abogado | Hubo sanciones en Neuquén por escritos con IA |

**Donde no estoy de acuerdo con el plan actual.** Las instrucciones del proyecto dicen que "todo lo que no es núcleo es configurable" desde el inicio. Para el MVP propongo lo contrario en dos puntos: los campos personalizados quedan limitados a causa e imputado, y las reglas de plazos vienen de fábrica sin editor visual (el estudio solo puede desactivarlas o cambiar los avisos). Un motor de reglas configurable por el usuario multiplica los casos de error en cálculos que tienen consecuencias legales, y no lo vas a poder probar bien antes de la demo.

### Preguntas para el abogado en la demo

- ¿Los 4 meses del art. 158 se cuentan desde la formulación de cargos o desde la apertura de la investigación? ¿Son hábiles o calendario?
- ¿Qué se hace hoy cuando vence el art. 87 o el 158: se plantea igual, o se da por perdido después de "Estarli" y "Olave"?
- ¿Qué tipos de audiencia usa hoy la Oficina Judicial y cuáles ven ustedes en el sistema de citación?
- ¿Cuál es el plazo real de la impugnación ordinaria y cómo se duplica en asuntos complejos?
- ¿Existe hoy la VI Circunscripción (Vaca Muerta) con Oficina Judicial propia?
- ¿Qué números identifican una causa en la práctica: legajo MPF, OFIJU, Pehuén?
- ¿Se sancionó la reforma del juicio directo (2023) y con qué número de ley la de reiterancia (2025)?
- ¿La mediación suspende todos los plazos o solo los de la investigación (Ley 2996)?

## Fuentes

No pude leer el texto oficial completo de la Ley 2784: el sitio del Poder Judicial bloquea lectores automáticos y las copias públicas se cortan en el art. 155. Conviene bajar el texto consolidado vigente desde el [sitio de leyes del Poder Judicial](https://www.jusneuquen.gov.ar/leyes-provinciales/) y repasar los arts. 156 a 272 antes de programar los plazos.

- [CPP de Neuquén, Ley 2784, con nota de la Ley 3021 (Universidad de Palermo)](https://www.palermo.edu/derecho/inejep/documentacion-archivos/legislacion-y-derecho-comparado/ARGENTINA/2-Codigo-Procesal-Penal-de-la-Provincia-de-Neuquen.pdf): arts. 1 a 155 e índice.
- [CPP de Neuquén, compilación del Poder Judicial, junio de 2015 (INECIP)](https://inecip.org/wp-content/uploads/2016/08/Neuqu%C3%A9n-C%C3%B3digo-Procesal-Penal.pdf): arts. 1 a 106 e índice.
- [Ley 2891, Orgánica de la Justicia Penal](https://www.palermo.edu/derecho/inejep/documentacion-archivos/legislacion-y-derecho-comparado/ARGENTINA/6-Ley-N-2891-Ley-Organica-de-la-Justicia-Penal-de-la-Provincia-de-Neuquen.pdf).
- [Ley 2879, Programa de Mediación Penal](https://www.cnaj.gob.ar/cnaj/docs/ley2879.pdf).
- [Proyecto 9388 y nota sobre la Ley 2996 (Pensamiento Penal)](https://pensamientopenal.com.ar/index.php/legislacion/43365-neuquen-mediacion-suspension-plazos-procesales) y [Diario Judicial](https://www.diariojudicial.com/news-75024-freno-a-plazos-procesales-durante-las-mediaciones).
- [Audiencias en números 2014, Oficinas Judiciales de Neuquén](https://pensamientopenal.com.ar/index.php/system/files/2015/04/miscelaneas40845.pdf).
- [Informe de gestión de audiencias, Oficina Judicial de Zapala, 2018](https://www.rionegro.com.ar/wp-content/uploads/2019/04/informe-final-AUDIENCIAS-v2_ZAPALA.pdf).
- [TSJ, Acuerdo 5/2023, "Estarli"](https://www.rionegro.com.ar/wp-content/uploads/2023/09/MPFNQ-Leg.-123.989-Ano-2018-ESTARLI-Acuerdo-5-de-fecha-25.09.23.pdf).
- Diario Río Negro sobre plazos: [Price](https://www.rionegro.com.ar/?p=1918603), [reacciones a Estarli](https://www.rionegro.com.ar/?p=3166608), [tercer fallo](https://www.rionegro.com.ar/?p=3336013), [REF rechazado](https://www.rionegro.com.ar/?p=3543909), [Olave](https://www.rionegro.com.ar/justicia/el-tsj-de-neuquen-demolio-otro-plazo-para-las-investigaciones-penales-3780038/), [Garro y Monsalve](https://www.rionegro.com.ar/?p=4062012).
- [Batagelj y Eusebio (2025), Escuela de la Defensa Pública](https://repositorio.mpd.gov.ar/jspui/bitstream/123456789/6159/1/Batagelj%20%26%20Eusebio%20%282025%2c%2049-72%29.pdf): texto citado del art. 158 y sus prórrogas.
- [Instrucción General 7/2015 de la Fiscalía General sobre el art. 119](https://mail.pensamientopenal.com.ar/system/files/2015/04/miscelaneas40859.pdf).
- Reformas: [reiterancia, 2025](https://www.noticiasnqn.com.ar/noticias/2025/06/11/314997-la-legislatura-de-neuquen-aprobo-un-paquete-de-leyes-para-reforzar-la-seguridad-prision-preventiva-por-reiterancia-nueva-ley-policial-y-mas), [debate en comisión](https://www.rionegro.com.ar/?p=4134781), [juicio directo, 2023](https://www.rionegro.com.ar/?p=3287872), [narcomenudeo](https://www.noticiasnqn.com.ar/noticias/2025/06/03/314524-gerez-defendio-ante-diputados-las-nuevas-herramientas-para-investigar-microtrafico).

