---
status: draft
date: 2026-11-23
scope: Neuquén, fueros civil, laboral y familia (ADR-0032)
---

# Neuquén: otros fueros (borrador para configurar, no validado)

Este documento junta lo que se pudo verificar sobre los fueros no penales de Neuquén para armar
catálogos **genéricos y marcados**. No reemplaza una revisión legal: todo lo de acá va con
`[validar]`, y con `[no verificado]` cuando la fuente es periodística. **Ningún fuero de este
documento trae reglas de plazos calculadas**. Los plazos se cargan a mano como plazos judiciales
hasta que se lea y cite el texto oficial de cada ley.

## 1. Lo que encontramos

### Civil y comercial

- Neuquén promulgó el **Código Procesal Civil y Comercial adversarial (Ley 3551)** el 29/12/2025.
  Empezó a aplicarse el **1/8/2026**. [no verificado: fuente periodística]
  ([noticiasnqn, 29/12/2025](https://www.noticiasnqn.com.ar/noticias/2025/12/29/325784-neuquen-promulgo-el-primer-codigo-procesal-civil-adversarial-del-pais);
  [Río Negro, 3/8/2026](https://www.rionegro.com.ar/justicia/ya-rige-la-reforma-de-la-justicia-civil-en-neuquen-impacto-en-los-plazos-y-nuevo-rol-para-las-partes-4669917/?amp=1))
- Según la misma prensa, el código:
  - Distingue **procesos ordinarios** y **sumarísimos**.
  - Usa expediente digital, con mayor oralidad, y prevé acuerdos procedimentales.
  - Da a los jueces 10 días hábiles para sentenciar en los sumarísimos y 20 días hábiles en los
    ordinarios. El artículo no está citado: no se usa como regla.
- Las causas iniciadas con el código anterior (Ley 912) pasan por una etapa de transición. Hay que
  confirmar si conviene un catálogo para cada código. [validar]
- Las páginas oficiales del Poder Judicial (jusneuquen.gov.ar) no se pudieron leer de forma
  automática. Hay que leerlas a mano en la revisión.

### Laboral

- No se pudo leer de una fuente oficial el texto de la ley de procedimiento laboral de Neuquén
  (número, audiencias y plazos). Todo queda `[no verificado]`.

### Familia

- El **Código Procesal de Familia está en reforma**. A junio de 2026, una subcomisión de la
  Legislatura trabajaba sobre un anteproyecto que prevé mediación previa obligatoria, audiencias
  multipropósito y oralidad
  ([noticiasnqn, 21/6/2026](https://www.noticiasnqn.com.ar/amp/noticias/2026/06/21/340507-avanza-el-debate-para-crear-un-nuevo-codigo-procesal-de-familia-en-neuquen)).
  Hay que confirmar qué norma rige hoy. [validar]

## 2. Catálogos genéricos propuestos (todo `[validar]`)

Los códigos son estables: los nombres se pueden ajustar en la revisión sin romper datos.

| Catálogo | Civil | Laboral | Familia |
|---|---|---|---|
| Tipos de proceso (`action-types`) | ordinario, sumarísimo, ejecutivo, sucesorio, cautelar | ordinario, sumarísimo | contencioso, voluntario, cautelar |
| Roles (`party-roles`) | actor, demandado, tercero, perito, testigo | actor (trabajador), demandado (empleador), aseguradora (ART), tercero, perito, testigo | requirente, requerido, niño/niña/adolescente, defensoría, perito, testigo |
| Etapas (`stages`) | inicio, contestación, audiencia preliminar o de acuerdo, prueba, alegatos, sentencia, recursos, ejecución, cerrada | inicio, conciliación, contestación, prueba, sentencia, recursos, ejecución, cerrada | mediación previa, inicio, audiencia, prueba, resolución, recursos, ejecución o seguimiento, cerrada |
| Audiencias (`hearing-types`) | preliminar, de prueba o vista de causa, de conciliación o acuerdo, otra | de conciliación, de prueba o vista de causa, otra | multipropósito, de escucha del niño, de conciliación, de prueba, otra |
| Cierres (`closing-outcomes`) | sentencia, acuerdo, desistimiento, caducidad, otra | sentencia, acuerdo homologado, desistimiento, otra | resolución, acuerdo homologado, desistimiento, otra |

The hearing statuses and cancellation reasons start as a copy of the criminal ones without the
OFIJU-specific items. [validar]

## 3. Preguntas para la revisión legal

1. Civil: ¿qué audiencias y plazos del nuevo código (Ley 3551) usa un estudio todos los días, con
   qué artículo? ¿Conviene separar las causas que siguen con la Ley 912?
2. Laboral: ¿qué ley rige el procedimiento? ¿Qué audiencias hay y cuáles son los plazos clave?
3. Familia: ¿qué norma procesal rige hoy? ¿Cuándo se espera el nuevo código?
4. ¿Los tipos de proceso y los roles de la tabla alcanzan para el día a día?
