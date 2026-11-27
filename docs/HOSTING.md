# Publicar el gestor en internet (preparación, sin deploy)

Esta guía deja todo listo para publicar el producto en un hosting barato. **Todavía no hay nada
publicado ni cuentas creadas**: elegir el proveedor y abrir las cuentas es una decisión de Franco.
La decisión técnica está en [ADR-0046](DECISIONS.md#adr-0046-hosting-readiness-one-image-same-origin-render--neon-recommended-t65).

> Precios relevados el **27/11/2026**, en dólares o euros y **sin impuestos**. Cambian seguido
> (Hetzner subió sus precios en junio de 2026): confirmalos en la página de cada proveedor antes de
> contratar. Los marcados `[validar]` son supuestos que hay que confirmar.

## Qué se publica

Una sola imagen Docker (`backend/Dockerfile`) con el backend **y** el frontend ya compilado: el
backend sirve la PWA en el mismo dominio que la API. Por eso no hace falta CORS ni un CDN aparte, y
las cookies de sesión y CSRF funcionan igual que en desarrollo.

```bash
docker build -f backend/Dockerfile -t gestor-causas .
```

La imagen arranca con el perfil `prod`, que:

- exige cookies `Secure` (solo HTTPS), y se niega a arrancar si alguien lo desactiva;
- cambia el esquema **solo con Flyway** (Hibernate valida, `flyway clean` deshabilitado);
- **no crea datos de demo**: si se activa `demo` o `dev` junto con `prod`, no arranca;
- rechaza la clave TOTP de desarrollo;
- confía en los encabezados `X-Forwarded-*` del proxy HTTPS de la plataforma;
- escucha en el puerto de la variable `PORT` (8081 si no está);
- comprime las respuestas y termina las peticiones en curso antes de apagarse.

CI construye la imagen y la prueba en cada PR (`scripts/docker-smoke.sh`): salud, frontend, API
protegida, cookies `Secure`, sin usuarios de demo y que `prod,demo` no arranque. **No la publica.**

### Variables de entorno

Se cargan en la sección de secretos de la plataforma, nunca en un archivo del repositorio. La
referencia completa está en [`.env.example`](../.env.example).

| Variable | Obligatoria | Para qué |
|----------|-------------|----------|
| `DB_URL` | sí | `jdbc:postgresql://<host>:5432/<base>?sslmode=require`. Las plataformas dan una URL `postgres://usuario:clave@host/base`: hay que pasarla a la forma JDBC y separar usuario y clave. |
| `DB_USERNAME`, `DB_PASSWORD` | sí | Usuario y clave de la base. |
| `TOTP_ENCRYPTION_KEY` | sí | 32 bytes al azar en base64 (`openssl rand -base64 32`). **Guardá una copia fuera de la plataforma**: si se pierde, nadie puede volver a usar su segundo factor. |
| `DB_POOL_SIZE` | no (5) | Conexiones a la base. Los planes chicos permiten pocas. |
| `PORT` | no (8081) | La mayoría de las plataformas la define sola. |
| `GEMINI_API_KEY` | no | Asistencia con IA. Dejala vacía con causas reales hasta la revisión legal (ADR-0033). |
| `MAIL_SMTP_*`, `MAIL_FROM` | no | Correo saliente: ver *Correo saliente*. Sin ellas no se manda ningún correo. |
| `APP_PUBLIC_URL` | sí, con correo | `https://<dominio>`: los enlaces de los correos (recuperar la contraseña). Ver *Correo saliente*. |

`SPRING_PROFILES_ACTIVE=prod` ya viene en la imagen.

### Salud (health checks)

| Ruta | Responde `UP` cuando |
|------|----------------------|
| `/actuator/health/liveness` | el proceso está vivo. Usala para que la plataforma lo reinicie. |
| `/actuator/health/readiness` | además llega a la base. Usala para mandarle tráfico. |

No muestran detalles internos. El resto de `/actuator` pide sesión.

### Alta del primer estudio y su titular

`prod` arranca sin estudios ni usuarios, y no hay ninguna pantalla ni endpoint para crearlos. El
primer estudio se crea **una sola vez** con la misma imagen y el perfil `bootstrap`
([ADR-0047](DECISIONS.md#adr-0047-first-firm-bootstrap-a-one-time-command-on-an-empty-database-t66)):

```bash
docker run --rm \
  -e SPRING_PROFILES_ACTIVE=prod,bootstrap \
  -e DB_URL='jdbc:postgresql://<host>:5432/<base>?sslmode=require' \
  -e DB_USERNAME='<usuario>' -e DB_PASSWORD='<clave>' -e TOTP_ENCRYPTION_KEY='<la misma clave de la app>' \
  -e BOOTSTRAP_FIRM_NAME='Estudio Ejemplo' -e BOOTSTRAP_FIRM_SLUG='estudio-ejemplo' \
  -e BOOTSTRAP_OWNER_EMAIL='titular@ejemplo.test' -e BOOTSTRAP_OWNER_NAME='Titular Ejemplo' \
  gestor-causas
```

- Corre desde cualquier máquina con Docker que llegue a la base (por ejemplo la de Franco contra
  Neon). En una plataforma con *one-off jobs* o consola, es el mismo comando con esas variables
  `[validar]` con el proveedor elegido.
- Aplica las migraciones de Flyway, crea el estudio y su titular **en una sola transacción**,
  muestra la contraseña temporal **una vez** en la consola (no en el log) y termina. No abre ningún
  puerto.
- **Se niega si ya existe algún estudio**, aunque esté archivado: no sirve para agregar estudios ni
  titulares a una base en uso, y dos corridas al mismo tiempo crean uno solo. Si falla por un dato
  inválido, no deja nada creado: se corrige y se vuelve a correr.
- El slug (`BOOTSTRAP_FIRM_SLUG`) es lo que los usuarios escriben como "estudio" para entrar:
  minúsculas, números y guiones, hasta 63 caracteres. No se puede cambiar después.
- El alta queda en el historial del estudio sin autor (lo hizo el sistema).
- Después: entregale la contraseña temporal al titular por un canal seguro. Al entrar el sistema le
  pide elegir su propia contraseña; que active el segundo factor en *Ajustes* y cree a los demás
  usuarios desde ahí (ADR-0044). Las variables `BOOTSTRAP_*` no se cargan en la plataforma.

## Las opciones

Un solo despliegue sirve a varios estudios (es multi-estudio desde el día uno), así que el costo se
reparte entre todos los estudios que lo usen.

### A. Render (contenedor) + Neon (Postgres administrado) — recomendada

- **App:** Render, servicio web *Starter*: 0,5 vCPU y 512 MB, siempre encendido, HTTPS y dominio
  propio incluidos. **US$ 7/mes**. ([Render, precios](https://render.com/pricing),
  [planes de cómputo](https://render.com/docs/compute-plans)). El plan gratis se duerme a los 15
  minutos sin uso: sirve para mostrar la demo, no para un estudio.
- **Base:** Neon. Plan *Free*: 1 GB de almacenamiento y 100 horas de cómputo por proyecto, se apaga
  sola a los 5 minutos sin uso (la primera consulta después tarda un poco más), sin tarjeta.
  Plan *Launch* (pago por uso, sin mínimo): US$ 0,106 por hora de cómputo y US$ 0,35 por GB al mes.
  ([Neon, precios](https://neon.com/pricing), [límites del plan gratis](https://neon.com/docs/introduction/plans)).
- **Región:** app y base en **la misma región** (por ejemplo Render *Virginia* y Neon
  *AWS us-east-1*). Neon tiene São Paulo ([regiones](https://neon.com/docs/introduction/regions)),
  pero Render no tiene región en Sudamérica: separarlas suma latencia en cada consulta.
- **Costo estimado:**
  - Demo o piloto con datos ficticios: **≈ US$ 7/mes** (Render Starter + Neon Free).
  - Primer estudio real: **≈ US$ 13/mes**. Supuesto: Neon Launch con 0,25 de cómputo encendido unas
    10 h por día hábil (220 h × 0,25 ≈ 55 horas de cómputo/mes ≈ US$ 6) y 1 GB de datos
    (US$ 0,35), más Render US$ 7.
- **Memoria:** la imagen está ajustada para 512 MB y CI la prueba con ese límite. Si con uso real
  no alcanza, el escalón siguiente de Render sube el costo `[validar]`.
    `[validar]` con el consumo real del primer mes.
- **A favor:** nadie administra servidores; copias y restauración a un punto en el tiempo las da
  Neon; si crece, se sube de plan sin migrar.
- **En contra:** dos proveedores y dos facturas; datos en EE. UU. (ver *Datos personales*).

### B. Render (contenedor) + Render Postgres

- **App:** igual que A, **US$ 7/mes**.
- **Base:** Render Postgres *Basic-256mb* (0,1 CPU, 256 MB) **US$ 6/mes** más US$ 0,30 por GB al mes.
  La base gratis de Render **se borra a los 30 días**: no sirve para datos de un estudio.
  ([Render Postgres, planes](https://render.com/docs/postgresql-refresh),
  [precios de Postgres](https://render.com/articles/managed-postgresql-pricing-2026)).
- **Costo estimado:** **≈ US$ 14,50/mes** con 5 GB (US$ 13 con lo mínimo).
- **A favor:** un solo proveedor, una factura, app y base en la misma red.
- **En contra:** la base más chica es muy justa (0,1 CPU); el escalón siguiente (*Basic-1gb*) cuesta
  ≈ US$ 19/mes. Datos en EE. UU. o Fráncfort.

### C. Un servidor propio chico (Hetzner) con Docker Compose

- **Servidor:** Hetzner Cloud *CX23* (2 vCPU, 4 GB, 40 GB) entre **€ 5,49 y € 5,99/mes** según
  se cuente la IPv4 (€ 0,50), después de la suba del 15/06/2026. Las copias automáticas del
  servidor suman el 20 %. `[validar]` disponibilidad: una guía de octubre de 2026 informa que el
  CX23 no se podía contratar y que la alternativa (CPX22) cuesta ≈ € 20/mes.
  ([Hetzner, ajuste de precios](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/),
  [planes cost-optimized](https://www.hetzner.com/cloud/cost-optimized),
  [análisis de precios 2026](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/)).
- **Cómo:** la misma imagen más Postgres en Docker Compose, un proxy HTTPS (por ejemplo Caddy) y
  los scripts de copias de T64 ([OPERATIONS.md](OPERATIONS.md)) programados con cron. Poné
  `stop_grace_period: 30s` al servicio de la app: el apagado ordenado espera hasta 20 s y Docker
  corta a los 10 s por defecto.
- **Costo estimado:** **≈ € 7/mes** (≈ US$ 8) con las copias del servidor.
- **A favor:** lo más barato por recurso (4 GB de memoria), todo en un lugar, datos en la Unión
  Europea (Alemania o Finlandia).
- **En contra:** alguien tiene que mantener el servidor: actualizaciones de seguridad, el proxy, las
  copias fuera del servidor y la restauración. Es trabajo que A y B no tienen.

### Descartada: Supabase

El plan gratis **pausa el proyecto a la semana sin uso** y tiene 500 MB de base; el plan *Pro* que
lo evita cuesta US$ 25/mes más cómputo: más caro que A o B para lo que se usa (solo Postgres).
([Supabase, precios](https://supabase.com/pricing)).

## Resumen

| Opción | Demo / piloto | Primer estudio real | Quién mantiene | Datos |
|--------|---------------|---------------------|----------------|-------|
| **A. Render + Neon** | ≈ US$ 7 | ≈ US$ 13 | la plataforma | EE. UU. (o São Paulo, con más latencia) |
| B. Render + Render Postgres | ≈ US$ 13 | ≈ US$ 14,50 | la plataforma | EE. UU. o Fráncfort |
| C. Hetzner + Compose | ≈ € 7 | ≈ € 7 | nosotros | Unión Europea |

**Recomendación: A.** Es la más barata sin administrar servidores, arranca gratis para la demo y
pasa a un estudio real cambiando de plan, no de proveedor. C queda como alternativa si en algún
momento hay quien mantenga el servidor, o si la ubicación de los datos lo exige.

## Correo saliente

El gestor manda correos (recuperar la contraseña, el resumen diario de la agenda) por **SMTP**, así
que sirve cualquier proveedor y cambiarlo es cambiar variables, no código
([ADR-0048](DECISIONS.md#adr-0048-outbound-email-behind-a-port-smtp-adapter-off-when-unset-t70)).
Sin `MAIL_SMTP_HOST` no se manda nada: cada correo queda en el log (sin el cuerpo) y en el registro
del estudio como `LOGGED`.

| Variable | Obligatoria | Para qué |
|----------|-------------|----------|
| `MAIL_SMTP_HOST` | no (vacía = sin envío) | Servidor SMTP del proveedor. |
| `MAIL_SMTP_PORT` | no (587) | 587 con STARTTLS o 465 con TLS directo. |
| `MAIL_SMTP_SECURITY` | no (`STARTTLS`) | `STARTTLS`, `TLS` (puerto 465) o `NONE` (solo Mailpit local). |
| `MAIL_SMTP_USERNAME`, `MAIL_SMTP_PASSWORD` | según el proveedor | Credenciales SMTP. Van en los secretos de la plataforma, nunca en un archivo. |
| `MAIL_FROM` | sí, si hay SMTP | Remitente, de un dominio verificado en el proveedor (por ejemplo `avisos@<dominio>`). El nombre visible es el del estudio. |
| `APP_PUBLIC_URL` | sí, si hay SMTP | La dirección con la que se entra al gestor (`https://<dominio>`), para armar los enlaces de los correos. Con `MAIL_SMTP_HOST` y sin `https://` la app no arranca. Nunca se toma del pedido, que un visitante puede falsear. |

**Recuperar la contraseña** ("¿Olvidaste tu contraseña?" en el ingreso,
[ADR-0049](DECISIONS.md#adr-0049-password-recovery-by-email-t71)): llega un enlace que vence en 30
minutos y sirve una vez; la respuesta es la misma exista o no la cuenta; se pueden pedir 3 por hora
por estudio y correo y 10 por hora desde una misma dirección. Al cambiarla se cierran todas las
sesiones y el segundo factor se sigue pidiendo. Sin SMTP el enlace no llega a nadie: el titular le
da una clave temporal desde Ajustes → Usuarios.

Para probar: el titular entra y llama a `POST /api/v1/mail/test` (le llega un "Correo de prueba" a
su propio correo; hasta 5 por hora).

### Dos proveedores con plan gratis

Precios consultados el 27/11/2026.

| | Brevo | Resend |
|---|---|---|
| Plan gratis | **300 correos por día**, sin vencimiento ([Brevo, planes](https://help.brevo.com/hc/en-us/articles/208589409), [SMTP gratis](https://www.brevo.com/free-smtp-server)) | **3.000 por mes con tope de 100 por día** ([Resend, cuotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [precios](https://resend.com/docs/knowledge-base/what-is-resend-pricing)) |
| Primer plan pago | *Starter* desde **US$ 9/mes**, sin tope diario ([Brevo, precios](https://www.brevo.com/pricing/)) | *Pro* **US$ 20/mes** por 50.000 correos ([Resend, precios](https://resend.com/pricing)) |
| SMTP | `smtp-relay.brevo.com`, puerto 587, usuario y **clave SMTP** (no la clave de API) ([Brevo, SMTP](https://developers.brevo.com/docs/smtp-integration)) | `smtp.resend.com`, puerto 465 (TLS) o 587, usuario `resend` y la clave de API como contraseña ([Resend, SMTP](https://resend.com/docs/send-with-smtp)) |
| Empresa y datos | Francia (Unión Europea) | EE. UU. |
| En contra | El plan gratis tiene un solo usuario y soporte limitado. | El tope de 100 por día se alcanza con pocos estudios usando el resumen diario. |

Los dos piden verificar el dominio del remitente (registros SPF y DKIM en el DNS) antes de mandar.

**Recomendación: Brevo.** El tope diario del plan gratis es el triple, el primer plan pago es más
barato y la empresa está en la Unión Europea, lo que simplifica la parte de *Datos personales*: los
correos llevan nombres de clientes y fechas de audiencias. `[validar]` con un abogado igual que el
hosting, y leer los términos del plan gratis antes de usarlo con un estudio real.

Para desarrollo, `docker compose --profile mail up -d mailpit` levanta Mailpit, que atrapa todos los
correos sin mandarlos: `MAIL_SMTP_HOST=localhost`, `MAIL_SMTP_PORT=1025`, `MAIL_SMTP_SECURITY=NONE`, y
se leen en <http://localhost:8025>.

## Datos personales

Los antecedentes penales son datos sensibles (Ley 25.326, art. 7). Guardarlos en un servidor fuera
del país es una transferencia internacional (art. 12). La Unión Europea figura entre los destinos
con protección adecuada para la autoridad argentina; EE. UU. no, y requiere cláusulas contractuales
con el proveedor. `[validar]` con un abogado antes de cargar la primera causa real, y elegir la
región según esa respuesta.

## Antes de publicar (pendientes)

1. Elegir proveedor y región según *Datos personales*; Franco abre las cuentas.
2. Generar `TOTP_ENCRYPTION_KEY` y guardar una copia offline.
3. Configurar los health checks con las rutas de arriba.
4. Probar una restauración de la base del proveedor antes del primer estudio real.
5. Dominio propio con HTTPS (lo dan Render y Caddy sin costo).
6. Crear el primer estudio y su titular con el comando de *Alta del primer estudio* (una sola vez).
7. Elegir el proveedor de correo (*Correo saliente*), verificar el dominio, cargar las variables
   `MAIL_*` y mandar el correo de prueba.
