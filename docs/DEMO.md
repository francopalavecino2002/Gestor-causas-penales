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
   con 25 causas, la agenda de la semana, dos detenidos con plazos que vencen en menos de 48 h y
   los ítems marcados `[validar]`.
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
