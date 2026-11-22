---
status: draft
source: project document "Modelo de datos base" (stage 0 review in progress)
---

# Modelo de datos base: gestor de causas penales (Neuquén)

Versión inicial basada en el CPP de Neuquén (Ley 2784), la organización
del fuero penal neuquino y lo que guardan los sistemas de gestión para
penalistas (Clio, Filevine, Lex-Doctor y similares). Lo marcado
[validar] se confirma con abogados al mostrar el prototipo.

## Principios
- Lo esencial viene de fábrica; lo demás lo configura cada estudio sin
  programar:
  - Campos personalizados en causas, personas, imputados, audiencias,
    medidas y documentos.
  - Catálogos editables: tipos de audiencia, etapas, estados,
    resultados, delitos, medidas, lugares de detención, organismos y
    etiquetas.
  - Plantillas por tipo de causa (por ejemplo violencia de género,
    estupefacientes o siniestro vial), que suman sus propios campos.
  - Reglas de plazos con su fuente normativa.
- Los valores por defecto vienen de un paquete de jurisdicción
  (Neuquén). Otra provincia es otro paquete, no otro código.
- Historial de todo cambio (quién, cuándo, valor anterior y nuevo).
  Nada se borra: se archiva.
- Una causa puede tener varios imputados; cada imputado, varios cargos
  y su propia situación de libertad.

## 1. Estudio y usuarios
- Estudio: nombre, CUIT, domicilio, logo, jurisdicción y configuración.
- Usuario: nombre, email, matrícula y colegio, rol (titular, abogado,
  procurador, administrativo), 2FA, activo.
- Permisos por causa: equipo asignado; las causas reservadas solo las
  ve su equipo.

## 2. Personas (una ficha por persona, reutilizable entre causas)
- Tipo: humana o jurídica.
- Identidad: nombres, apellidos, alias o apodos, tipo y número de
  documento, CUIL o CUIT, fecha de nacimiento, nacionalidad, género.
- Contacto: domicilios (real, legal, procesal), teléfonos, WhatsApp,
  emails, medio preferido.
- Datos sensibles (salud, adicciones, situación socioeconómica)
  separados y con acceso restringido [validar alcance legal].
- Relaciones entre personas: familiar, pareja, empleador, etc.
- Roles en causas: cliente, imputado, coimputado, víctima, querellante,
  testigo, perito, fiscal, defensor, juez, familiar de contacto,
  garante.

## 3. Cliente (relación del estudio con una persona)
- Fecha de alta y cómo llegó (recomendación, derivación, etc.).
- Contactos autorizados (familiares) y qué se les puede informar.
- Consentimiento para el tratamiento de datos: fecha, alcance y archivo
  firmado.
- Control de conflicto de intereses: alerta si la persona ya figura
  como víctima o contraparte en otra causa del estudio.

## 4. Causa (legajo)
Identificación
- Carátula (por ejemplo "Pérez, Juan s/ robo agravado").
- Identificadores: legajo del MPF, número de la OFIJU, número en Pehuén
  y número interno del estudio [validar formatos].
- Fuero: penal de adultos o penal juvenil.
- Circunscripción (Confluencia, de la Comarca, del Pehuén, Lagos del
  Sur, Alto Neuquén, Vaca Muerta) y ciudad.
- Fiscalía o unidad fiscal y fiscal a cargo; defensor oficial previo si
  lo hubo.
- A quién representa el estudio: defensa de imputados o querella
  (víctima).
Estado
- Etapa (catálogo): investigación preliminar, investigación
  preparatoria (desde la formulación de cargos), etapa intermedia
  (control de acusación), juicio técnico o por jurados, determinación
  de pena, impugnación, ejecución, cerrada.
- Estado: activa, suspendida (por ejemplo por suspensión de juicio a
  prueba), en mediación, archivada, finalizada.
- Resultado al cerrar (catálogo): sobreseimiento, absolución, condena,
  acuerdo pleno o procedimiento abreviado, conciliación o reparación,
  criterio de oportunidad, suspensión de juicio a prueba cumplida,
  prescripción, otro.
- Prioridad, etiquetas y reservada (sí o no).
Hecho
- Fecha y hora, lugar y ciudad, relato y circunstancias.
Fechas clave (cada una puede disparar plazos)
- Hecho, denuncia, detención, apertura de la investigación,
  formulación de cargos, acusación, control de acusación, auto de
  apertura a juicio, inicio del juicio, veredicto, sentencia, firmeza.
Equipo y vínculos
- Abogado responsable, colaboradores y procurador.
- Causas conexas o acumuladas; coimputados (defendidos o no por el
  estudio).

## 5. Imputado en la causa (uno por cada persona imputada)
- Persona, si es cliente del estudio y quién defiende a cada
  coimputado.
- Cargos (lista), cada uno con:
  - Delito (catálogo del Código Penal y leyes especiales, por ejemplo
    la Ley 23.737 para narcomenudeo): artículo, inciso, nombre.
  - Calificación legal completa, agravantes y atenuantes.
  - Participación: autor, coautor, partícipe primario o secundario,
    instigador.
  - Grado (consumado o tentativa) y concurso (real o ideal).
  - Escala penal mínima y máxima (del catálogo, editable).
  - Historial de calificación: en la formulación de cargos, en la
    acusación y en la sentencia.
- Antecedentes informados en la causa [validar alcance legal].
- Teoría del caso y notas estratégicas, privadas del equipo.

## 6. Situación de libertad y medidas de coerción (historial por imputado)
- Situación actual: en libertad, con medidas, aprehendido o detenido,
  prisión preventiva, arresto domiciliario, cumpliendo condena.
- Lugar de detención (catálogo de unidades y comisarías) y fecha de
  ingreso.
- Medidas (lista), cada una con: tipo (catálogo: presentación
  periódica, prohibición de salir de la ciudad, prohibición de
  acercamiento o contacto, restricción de ingreso a lugares, caución,
  monitoreo electrónico, arresto domiciliario, prisión preventiva,
  otras), condiciones, persona protegida y distancia, fecha de inicio,
  plazo, vencimiento, próxima revisión, audiencia que la dispuso y
  estado.
- Alertas prioritarias para todo vencimiento en causas con detenidos.

## 7. Audiencias (el centro del sistema)
- Tipo (catálogo configurable; base Neuquén): control de detención,
  formulación de cargos, medidas de coerción, revisión o modificación
  de medidas, prisión preventiva, suspensión de juicio a prueba,
  acuerdo pleno o procedimiento abreviado, conciliación, control de
  acusación, juicio técnico, juicio por jurados (incluida la selección
  de jurados), determinación de pena, impugnación, revisión, ejecución,
  otras [validar contra los tipos que usa la OFIJU].
- Fecha y hora, duración estimada, circunscripción, ciudad, sala y
  modalidad (presencial, o virtual con link).
- Juez o tribunal, fiscal y otras partes citadas.
- Origen: citación de la OFIJU, solicitud propia vía Pehuén o pedido de
  otra parte. Identificador de la audiencia en la OFIJU.
- Estado: solicitada, programada, reprogramada, suspendida, cancelada,
  realizada.
- Preparación: checklist según el tipo de audiencia (configurable),
  documentos y prueba a llevar, quién asiste del estudio y aviso al
  cliente y a su familia.
- Resultado: qué se resolvió, resumen, medidas dispuestas o
  modificadas, plazos generados, próxima audiencia, link al registro
  audiovisual y notas.
- Choques: alerta si un abogado tiene audiencias superpuestas o en
  ciudades distintas sin tiempo para viajar.

## 8. Plazos y vencimientos
- Regla (catálogo por jurisdicción): nombre, fuente normativa o
  jurisprudencial, evento que la dispara, duración, unidad (horas, días
  hábiles, días corridos, meses), causas de suspensión (por ejemplo la
  mediación penal, Ley 2996) y notas de criterio. Ejemplo base: cuatro
  meses desde la formulación de cargos para acusar (art. 158) [validar
  vigencia y jurisprudencia del TSJ].
- Plazo concreto: causa, imputado, regla aplicada, fecha de inicio,
  vencimiento calculado, vencimiento confirmado por el abogado, estado
  (pendiente, cumplido, vencido, suspendido), responsable y alertas
  (por ejemplo 7, 3 y 1 día antes, y el mismo día).
- Calendario judicial por jurisdicción: feriados nacionales y
  provinciales, ferias judiciales, asuetos e inhábiles por
  circunscripción.
- Siempre visible: "Cálculo asistido: verificá con la norma."

## 9. Actuaciones (línea de tiempo de la causa)
- Fecha, tipo (catálogo: notificación recibida por SINE, presentación
  vía Pehuén, resolución, escrito, reunión con el cliente, visita a
  detenido, llamada, novedad de la fiscalía, otro), descripción,
  documentos adjuntos, plazos generados y autor.

## 10. Prueba, testigos y peritos
- Prueba: tipo (testimonial, documental, pericial, material,
  informativa, audiovisual), descripción, quién la ofrece (fiscalía,
  defensa, querella), estado (a producir, producida, ofrecida, admitida,
  excluida en el control de acusación), dónde está y archivos.
- Testigos y peritos: persona, de cargo o de descargo, perito oficial o
  de parte, qué aporta, si fue entrevistado, citación y disponibilidad.

## 11. Salidas alternativas, acuerdos, sentencia y recursos
- Salida o acuerdo: tipo (criterio de oportunidad, mediación,
  conciliación, reparación, suspensión de juicio a prueba, acuerdo
  pleno o parcial, procedimiento abreviado), fecha, condiciones o
  reglas de conducta, monto de reparación, período de prueba con su
  vencimiento y seguimiento del cumplimiento.
- Sentencia: veredicto, pena (prisión efectiva o condicional, multa,
  inhabilitación), monto, fecha y firmeza.
- Recursos e impugnaciones: tipo, resolución recurrida, fecha de
  presentación, plazo, tribunal y resultado.
- Ejecución (más adelante): cómputo de pena y fechas de beneficios
  [validar].

## 12. Honorarios y cobros
- Acuerdo de honorarios: modalidad (fijo, por etapa, por audiencia),
  monto en pesos o en JUS, cuotas y archivo firmado.
- Cuotas (vencimiento y estado), pagos (fecha, medio, comprobante),
  gastos de la causa, regulación judicial en JUS (cantidad y valor del
  JUS a la fecha) y saldo del cliente.
- Valor del JUS con historial por jurisdicción, actualizable.

## 13. Documentos y plantillas
- Archivo: nombre, tipo (catálogo), causa, persona, versión, autor,
  fecha, etiquetas, reservado.
- Plantillas de escritos con variables de la causa (carátula, imputado,
  fiscal, audiencia, etc.).

## 14. Tareas y comunicaciones
- Tarea: título, causa, responsable, vencimiento, prioridad, estado y
  checklist.
- Registro de contactos con clientes y familiares: fecha, canal
  (WhatsApp, llamada, reunión, visita) y resumen.

## 15. Auditoría y portabilidad
- Registro de accesos y cambios por usuario, con fecha, IP y entidad.
- Exportación completa de los datos del estudio.

## 16. Campos personalizados (diseño técnico sugerido)
- Definición: entidad a la que aplica, clave, etiqueta, ayuda, tipo
  (texto corto, texto largo, número, moneda, JUS, fecha, fecha y hora,
  sí o no, lista, lista múltiple, persona, documento), opciones,
  obligatorio, sección, orden, roles que lo ven, plantillas de causa en
  las que aparece y activo.
- Valores en una columna JSONB por entidad, validados contra las
  definiciones e indexados para búsqueda. Las definiciones se versionan;
  desactivar un campo no borra sus valores.
- Catálogos en una estructura genérica, con ítems por jurisdicción y
  por estudio.
- MVP implementado (ADR-0018): campos de la causa y del imputado, de tipo
  texto, número, fecha, sí o no y lista; valores en la columna `custom_fields`
  de `case_file` y `defendant`. El resto del diseño (ayuda, secciones, roles,
  plantillas, otros tipos y búsqueda) queda para más adelante.