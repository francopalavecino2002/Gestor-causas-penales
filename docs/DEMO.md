# Demo local

Cómo mostrarle el producto a un abogado en 10 minutos, desde la compu o desde el celular, con
datos 100 % ficticios. No hace falta internet ni ninguna cuenta paga: todo corre en tu máquina.

## Qué necesitás

- Docker Desktop abierto (Postgres corre en un contenedor, puerto 5434).
- JDK 21 o superior.
- Node 22.12 o superior.
- Chrome o Firefox en la compu. En el celular sirve cualquier navegador.

La primera vez tarda unos minutos: Maven baja dependencias, compila el backend y `npm ci` instala
el frontend. Las siguientes veces arranca en menos de un minuto.

## Un solo comando

En Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
```

En Linux, macOS o Git Bash:

```bash
bash scripts/demo.sh
```

El script:

1. Revisa que estén Docker, Java y Node, y que los puertos 8081 y 5173 estén libres.
2. Levanta PostgreSQL con `docker compose` y **recrea la base `gestor_demo`**, así las audiencias
   de la semana y los plazos por vencer siempre caen alrededor de hoy. La base de desarrollo
   (`gestor_causas`) no se toca.
3. Arranca el backend en `:8081` con los perfiles `dev,demo`, que siembran un estudio ficticio
   con 25 causas penales (más 5 de civil y laboral), la agenda de la semana, dos detenidos con
   plazos que vencen en menos de 48 h y los ítems marcados `[validar]`.
4. Arranca el frontend en `:5173`, espera a que los dos respondan y abre el navegador en el login
   con el estudio ya cargado.
5. Imprime las direcciones, la clave y los usuarios de demo.

Para cortar: `Ctrl+C` detiene backend y frontend. Postgres sigue corriendo; lo apagás con
`docker compose down` (los datos quedan en el volumen de Docker).

## Usuarios de demo

Todos usan la misma clave, que el script imprime al final. La primera vez la genera al azar y la
guarda en `.env` como `DEMO_PASSWORD` (ese archivo no se sube al repo). Si preferís elegirla vos,
definí `DEMO_PASSWORD` en `.env` antes de correr el script (12 caracteres o más).

| Estudio        | Usuario                      | Rol         |
|----------------|------------------------------|-------------|
| `estudio-demo` | `lucia.ejemplo@example.com`  | Titular     |
| `estudio-demo` | `martin.prueba@example.com`  | Abogado     |
| `estudio-demo` | `julian.muestra@example.com` | Abogado     |
| `estudio-demo` | `sofia.ficticia@example.com` | Procuradora |

Las personas, causas y números son inventados (apellidos como Ficticio, Ejemplo o Prueba; correos
del dominio reservado `example.com`).

## Desde el celular

Por defecto el script también publica la app en la IP de tu compu dentro de la red local e imprime
la dirección, por ejemplo `http://192.168.0.23:5173/ingresar?estudio=estudio-demo`.

1. Conectá el celular a la **misma red Wi-Fi** que la compu.
2. Abrí esa dirección en el navegador del celular.
3. Si no carga, en Windows aceptá el aviso del firewall para Node.js en **redes privadas** (o
   revisá que la red Wi-Fi esté marcada como privada). Algunas redes de invitados aíslan a los
   dispositivos entre sí: en ese caso usá el punto de acceso del celular.

**Usalo solo en una red de confianza** (tu casa, la oficina). Cualquiera conectado a esa red puede
abrir la app, y la clave de demo queda a la vista en la pantalla. En un Wi-Fi público, o si vas a
proyectar la terminal, corré con `--local` / `-Local`.

En este modo la app viaja por HTTP plano dentro de tu red, así que el script apaga el atributo
`Secure` de las cookies de sesión (los navegadores las descartan fuera de `localhost`). Es solo
para la demo con datos ficticios ([ADR-0029](DECISIONS.md#adr-0029-one-command-local-demo-and-lan-access-t31)).
Si no vas a usar el celular, corré solo en la compu con las cookies como en producción:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1 -Local
```

```bash
bash scripts/demo.sh --local
```

## Guion de 10 minutos

Un recorrido para mostrarle el producto a un abogado o abogada penalista. Entrá como **Lucía
Ejemplo** (titular): ve todo el estudio y puede cambiar los ajustes. Las cifras entre paréntesis
son las de las capturas; cambian un poco según el día de la semana, porque las audiencias y los
plazos se siembran relativos a hoy (un sábado o domingo, "hoy" es el lunes siguiente: usá la
flecha `>` de la agenda).

La idea que tiene que quedar: **"esta es tu semana de audiencias, estos son tus detenidos y esto
vence"**. Todo lo demás es apoyo.

Las capturas de cada paso, en celular (390×844) y en compu (1440×900), están en
[`screenshots/demo/`](screenshots/demo/); el informe de la revisión visual, en su
[README](screenshots/demo/README.md).

### 0:00 a 1:00. Ingreso y segundo factor

- **Qué hacés:** abrí `http://localhost:5173/ingresar?estudio=estudio-demo` (el estudio ya viene
  cargado) y entrá con `lucia.ejemplo@example.com` y la clave de demo.
- **Qué decís:**
  - "Cada estudio tiene su espacio separado: nadie de otro estudio ve tus causas".
  - "Hay verificación en dos pasos con una app de códigos, como la del banco. Son datos de causas
    penales: aunque alguien sepa tu clave, sin el código no entra".
  - En los datos de demo nadie tiene el segundo factor activado (cada uno lo activa en **Ajustes >
    Usuarios y roles**): mostrá la captura del paso del código.
- **Capturas:** [ingreso, compu](screenshots/demo/01-login-desktop.png),
  [ingreso, celular](screenshots/demo/01-login-mobile.png),
  [código de verificación, celular](screenshots/demo/02-second-factor-mobile.png).

### 1:00 a 2:30. La agenda de hoy y los detenidos

- **Qué hacés:** quedás en **Audiencias de hoy**. Señalá el bloque rojo de avisos y una tarjeta
  con borde rojo ("Revisión de prisión preventiva", CPP art. 118). Tocá **Mirá el detalle** en
  una audiencia.
- **Qué decís:**
  - "Lo primero que ves al entrar es el día, no un expediente: hora, tipo de audiencia con su
    artículo, imputado y sala".
  - "Arriba de todo, los detenidos: la preventiva de Ramiro Acosta Ficticio vence mañana (art. 116)
    y tienen revisión mañana él y Carla Benítez Ejemplo (art. 118)".
  - "El rojo se usa solo para personas privadas de la libertad. Nada más en la app es rojo".
  - "Cada aviso dice *Cálculo asistido: verificá con la norma*: el sistema avisa, la decisión es
    tuya".
- **Capturas:** [hoy, compu](screenshots/demo/03-agenda-today-desktop.png) (7 audiencias, 2 con
  personas detenidas, 4 avisos), [hoy, celular](screenshots/demo/03-agenda-today-mobile.png).

### 2:30 a 3:30. La semana y el equipo

- **Qué hacés:** tocá **Semana**. Después, en **Abogado o abogada**, elegí **Julián Muestra** y
  volvé a **Todo el estudio**.
- **Qué decís:**
  - "La semana del estudio entero (11 audiencias en la captura, sacada un viernes; 4 con
    detenidos), día por día".
  - "Si sos titular, ves la agenda de cada abogado del estudio; cada uno ve la suya".
- **Capturas:** [semana, compu](screenshots/demo/04-agenda-week-desktop.png),
  [semana, celular](screenshots/demo/04-agenda-week-mobile.png).

### 3:30 a 4:30. Plazos por vencer

- **Qué hacés:** andá a **Plazos**. Mostrá el vencido de arriba y prendé **Solo personas
  detenidas**.
- **Qué decís:**
  - "Acá está todo lo que vence en los próximos 30 días (13 plazos, 7 de ellos de civil y
    laboral), agrupado: vencidos, vencen pronto, próximos".
  - "Cada plazo trae su norma (*Art. 158; 160 inc. 7, CPP de Neuquén*), cómo se cuenta, desde
    cuándo corre y qué pasa si vence. La jurisprudencia también: después de «Olave» el plazo de
    la investigación sigue, pero la consecuencia fue declarada inconstitucional".
  - "Lo que todavía no confirmamos con un abogado lo marcamos a la vista: **[validar]** y **[no
    verificado]**. Por eso estás acá".
  - Con el filtro: "Solo los dos de personas detenidas, que vencen mañana".
- **Capturas:** [plazos, compu](screenshots/demo/05-deadlines-desktop.png),
  [plazos, celular](screenshots/demo/05-deadlines-mobile.png),
  [solo detenidos, compu](screenshots/demo/06-deadlines-detainees-desktop.png),
  [solo detenidos, celular](screenshots/demo/06-deadlines-detainees-mobile.png).

### 4:30 a 6:00. Una causa con varios imputados

- **Qué hacés:** andá a **Causas** (30 en el estudio, 25 penales). Buscá `DEMO-004` y abrí *Benítez Ejemplo,
  Carla y otros s/ homicidio (ficticio)*. Bajá hasta **Imputados**.
- **Qué decís:**
  - "Una causa, tres imputados, y cada uno con su etapa, su estado y su situación de libertad:
    Carla en prisión preventiva, Diego Castro Prueba con presentación periódica, Elena Duarte
    Ficticia en la conclusión de la investigación".
  - "El resumen te dice cuántos detenidos hay, la etapa más atrasada y la próxima audiencia".
  - "Podés buscar por carátula, legajo del MPF, número de la OFIJU o número interno". Señalá el
    aviso **[validar]** de los formatos de la OFIJU y de Pehuén en *Datos de la causa*.
- **Capturas:** [lista, compu](screenshots/demo/07-case-list-desktop.png),
  [lista, celular](screenshots/demo/07-case-list-mobile.png),
  [resumen, compu](screenshots/demo/08-case-summary-desktop.png),
  [resumen, celular](screenshots/demo/08-case-summary-mobile.png),
  [imputados, compu](screenshots/demo/09-case-defendants-desktop.png),
  [imputados, celular](screenshots/demo/09-case-defendants-mobile.png).

### 6:00 a 7:00. Los plazos de un detenido, con su norma

- **Qué hacés:** abrí `DEMO-001` (*Fernández Ruiz, Tomás y otra s/ robo agravado*) y bajá a
  **Plazos**.
- **Qué decís:**
  - "Tomás está en preventiva: el sistema calcula la duración que fijó el juez (art. 116) y el
    máximo de un año (art. 119, todavía **[validar]**)".
  - "Todos los plazos dicen *Cálculo asistido: verificá con la norma*. El sistema propone la
    fecha; la decisión es tuya. No reemplaza leer la resolución".
- **Capturas:** [plazos de la causa, compu](screenshots/demo/10-case-deadlines-desktop.png),
  [plazos de la causa, celular](screenshots/demo/10-case-deadlines-mobile.png).

### 7:00 a 7:45. Una salida alternativa en período de prueba

- **Qué hacés:** abrí `DEMO-005` (*Ledesma Prueba, Hernán s/ hurto*) y bajá a **Plazos**.
- **Qué decís:**
  - "Hernán tiene el proceso suspendido: una suspensión de juicio a prueba (art. 108) con dos años
    de prueba. El vencimiento del período de prueba queda como plazo judicial, con las reglas de
    conducta en la nota".
  - "Las reglas de conducta del ejemplo están marcadas **[validar]**: queremos saber cómo las
    controlan ustedes".
- **Capturas:** [período de prueba, compu](screenshots/demo/11-case-probation-desktop.png),
  [período de prueba, celular](screenshots/demo/11-case-probation-mobile.png).

### 7:45 a 8:45. Lo que el estudio configura sin programar

- **Qué hacés:** andá a **Ajustes** (en el celular, desde el menú de tu cuenta, arriba a la
  derecha). Mostrá **Catálogos** (tipos de audiencia), **Campos propios**, **Reglas de plazos** y
  **Usuarios y roles**. Si hay tiempo, en **Campos propios** tocá **Agregá un campo** y creá uno
  en vivo (por ejemplo, "Juzgado de familia vinculado"): la demo arranca sin campos propios.
- **Qué decís:**
  - "Los tipos de audiencia vienen del paquete de Neuquén (28 ítems, fuente marcada
    **[validar]**). Los podés renombrar u ocultar como habla tu estudio; nada se borra".
  - "Si tu estudio necesita registrar algo que el sistema no pide, lo agregás vos: texto, número,
    fecha, sí o no, o una lista".
  - "Las reglas de plazos no se editan, porque son la ley: podés desactivar las que no usás y
    elegir con cuántos días de aviso las querés ver".
  - "Cada persona tiene un rol: titular, abogado, procuradora. Las causas reservadas solo las ve
    quien forma parte".
- **Capturas:** [ajustes](screenshots/demo/12-settings-desktop.png),
  [catálogos](screenshots/demo/13-settings-catalogs-desktop.png),
  [campos propios](screenshots/demo/14-settings-fields-desktop.png),
  [reglas de plazos, celular](screenshots/demo/15-settings-deadline-rules-mobile.png),
  [usuarios y roles](screenshots/demo/16-settings-users-desktop.png).

### 8:45 a 9:30. Empezar en una tarde: importar una planilla

- **Qué hacés:** desde **Ajustes**, **Importar planillas**. Elegí **Personas**, subí un CSV con
  una fila sin apellidos, mostrá el informe y subí la planilla corregida. Un ejemplo (separado
  por punto y coma, datos ficticios):

  ```csv
  tipo_persona;nombres;apellidos;telefono;domicilio
  humana;Clara;Captura Ficticia;2990000011;Calle Ficticia 300, Neuquén
  humana;Darío;;2990000012;Calle Ficticia 400, Neuquén
  ```

- **Qué decís:**
  - "Traés lo que ya tenés en Excel: primero las personas, después las causas y al final las
    audiencias".
  - "Antes de guardar, el sistema revisa cada fila y te dice qué corregir, con el número de fila
    de Excel. Si hay un error, no se guarda nada".
- **Capturas:** [qué importás, celular](screenshots/demo/17-import-kind-mobile.png),
  [fila para corregir, compu](screenshots/demo/18-import-errors-desktop.png),
  [listo, celular](screenshots/demo/19-import-done-mobile.png).

### 9:30 a 10:00. En el celular

- **Qué hacés:** abrí en el celular la dirección de la red local que imprimió el script (ver
  [Desde el celular](#desde-el-celular)) y entrá. Recorré **Agenda**, **Causas** y **Plazos** con
  la barra de abajo.
- **Qué decís:**
  - "Está hecha primero para el teléfono: la consultás en el pasillo, entre audiencia y
    audiencia. Letra grande, botones grandes y el aviso de detenidos arriba".
  - "Cerramos con las preguntas: son las que todavía no podemos responder sin vos".
- **Capturas:** [hoy, celular](screenshots/demo/03-agenda-today-mobile.png),
  [plazos, celular](screenshots/demo/05-deadlines-mobile.png),
  [personas, celular](screenshots/demo/20-persons-mobile.png).

### 10:00 a 11:00. Otros fueros (opcional)

Un minuto más si el estudio no es solo penal, o si te preguntan "¿y lo civil?".

- **Qué hacés:** andá a **Causas** y en **Fuero** elegí **Civil y comercial** (3 causas). Volvé a
  **Todos los fueros**, elegí **Laboral** y abrí `DEMO-LAB-002` (*Arce Prueba, Nélida c/ Obras del
  Sur Ficticia S.A. y ART Muestra S.A. s/ accidente de trabajo*). Si querés, mostrá **Ajustes >
  Fueros**.
- **Qué decís:**
  - "El mismo estudio lleva causas penales, civiles y laborales. Cada fuero trae sus etapas, sus
    tipos de audiencia y sus roles: actor, demandado, la ART".
  - "Una causa civil o laboral no tiene imputados: la etapa y el estado van en la causa".
  - "En estos fueros el sistema todavía no calcula plazos: los cargás a mano como plazos judiciales
    y te avisa igual. Los fueros nuevos están marcados **[validar]**: son un borrador para revisar
    con un abogado del fuero".
  - "Las audiencias civiles y laborales de la semana aparecen en la misma agenda, con su fuero
    al lado; el filtro **Fuero** de la agenda te deja ver uno solo".
- **Capturas:** [causas civiles, compu](screenshots/demo/21-case-list-civil-desktop.png),
  [causas civiles, celular](screenshots/demo/21-case-list-civil-mobile.png),
  [causa laboral, compu](screenshots/demo/22-case-laboral-desktop.png),
  [causa laboral, celular](screenshots/demo/22-case-laboral-mobile.png).

## Preguntas para el abogado

Tomadas de [`domain/neuquen-review.md`](domain/neuquen-review.md#preguntas-para-el-abogado-en-la-demo).
Anotá las respuestas: cada una confirma o corrige un ítem marcado `[validar]`.

- ¿Los 4 meses del art. 158 se cuentan desde la formulación de cargos o desde la apertura de la
  investigación? ¿Son hábiles o calendario?
- ¿Qué se hace hoy cuando vence el art. 87 o el 158: se plantea igual, o se da por perdido después
  de "Estarli" y "Olave"?
- ¿Qué tipos de audiencia usa hoy la Oficina Judicial y cuáles ven ustedes en el sistema de
  citación?
- ¿Cuál es el plazo real de la impugnación ordinaria y cómo se duplica en asuntos complejos?
- ¿Existe hoy la VI Circunscripción (Vaca Muerta) con Oficina Judicial propia?
- ¿Qué números identifican una causa en la práctica: legajo MPF, OFIJU, Pehuén?
- ¿Se sancionó la reforma del juicio directo (2023) y con qué número de ley la de reiterancia
  (2025)?
- ¿La mediación suspende todos los plazos o solo los de la investigación (Ley 2996)?

## Capturas de la demo

Las capturas de `docs/screenshots/demo/` se sacan contra el backend real con los datos de demo
(no contra respuestas simuladas):

```bash
bash scripts/e2e-demo.sh --screenshots
```

Usa la misma base descartable que las pruebas de punta a punta (`gestor_e2e`). Para mostrar el
paso del código, le activa el segundo factor a Sofía (procuradora) y se lo vuelve a desactivar al
final.

## Asistente de IA (opcional, gratis para la demo)

Completa una audiencia nueva a partir del texto de una notificación de la OFIJU o del SINE
(ADR-0033). Usa el plan gratis de Google Gemini, que puede usar los textos para mejorar sus
productos: **solo datos ficticios**.

1. Entrá a <https://aistudio.google.com/apikey> con una cuenta de Google y tocá «Create API key».
   No pide tarjeta.
2. En PowerShell: `setx GEMINI_API_KEY "la-clave-que-copiaste"`. Cerrá y abrí la terminal (setx
   vale para las ventanas nuevas) y corré la demo como siempre.
3. En la app, como titular: Ajustes > Asistente de IA > «Activado en el estudio».
4. Agenda > «Cargá una audiencia» > elegí la causa > «Pegá una notificación», pegá el texto de
   ejemplo de abajo y tocá «Completá con IA». Revisá los datos y guardá.

Texto de ejemplo (inventado):

```text
OFICINA JUDICIAL - I CIRCUNSCRIPCIÓN (texto ficticio de prueba)
Se notifica a la defensa que se fijó audiencia de control de acusación para el día
02/12/2026 a las 10:15 hs, en la Sala 4, con una duración estimada de 90 minutos.
Juez: Dr. Ejemplo Ficticio. Legajo OFIJU-0000/2026.
```

Sin clave, la sección de Ajustes dice «No disponible» y el resto de la app funciona igual. Si
aparece «El servicio de IA está ocupado», es el límite por minuto del plan gratis: esperá un
minuto.

## Si algo falla

| Síntoma | Qué hacer |
|---------|-----------|
| "el puerto 8081 está ocupado" | Quedó un backend corriendo: cerralo o reiniciá la terminal donde estaba. |
| "el puerto 5173 está ocupado" | Quedó un `npm run dev` abierto: cerralo. |
| "Docker no está corriendo" | Abrí Docker Desktop y esperá a que diga *Engine running*. |
| El backend no responde | Mirá `.demo-logs/backend.log`. |
| El login dice que los datos no son válidos | Usá la clave que imprimió el script (está en `.env`). |
| El login pide esperar después de varios errores | Todos los dispositivos pasan por el mismo proxy y cuentan como un solo cliente: tras 20 intentos fallidos hay que esperar 15 minutos (o reiniciar la demo). |
| En Git Bash falla `./mvnw` por `mktemp` | El script usa `mvn` si está instalado; si no, usá `demo.ps1`. |

Los logs del backend y del frontend quedan en `.demo-logs/` (ignorado por git).

## Pruebas de punta a punta

El recorrido de la demo también es una prueba automática (Playwright, en `frontend/e2e-demo/`):
login con clave y código de 2FA, agenda de hoy y de la semana (en compu y celular), buscar y abrir
una causa, los plazos de un imputado detenido con su norma y el aviso de cálculo asistido, e
importar una planilla CSV de personas. Corre contra el backend real con los datos ficticios, no
contra respuestas simuladas.

```bash
bash scripts/e2e-demo.sh
```

El script recrea la base **`gestor_e2e`** (no toca `gestor_causas` ni `gestor_demo`), arranca el
backend en `:8081` con los perfiles `dev,demo` y una clave de demo descartable, corre las pruebas
y apaga el backend. El puerto 8081 tiene que estar libre: si tenés la demo abierta, cortala antes.
Para correr una sola prueba: `bash scripts/e2e-demo.sh two-factor`. En CI corre el mismo script
(job `e2e-demo`).

Si una corrida se corta a mitad de la prueba de 2FA, el usuario Julián puede quedar con el segundo
factor activado: la próxima corrida del script lo arregla sola, porque recrea la base.
