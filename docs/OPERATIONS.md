# Operación: respaldos y restauración

Cómo respaldar la base de datos del estudio, cómo programar el respaldo diario en Windows y cómo
volver a un respaldo. Sirve para la instalación local con Docker Compose (Postgres en el puerto
5434); un hosting con base administrada trae sus propios respaldos (ver `docs/HOSTING.md` cuando
exista).

> **Los respaldos tienen todos los datos del estudio**, incluidos los sensibles (causas penales,
> Ley 25.326, art. 7). Guardalos en un disco cifrado (BitLocker en Windows) y nunca en el
> repositorio: la carpeta `backups/` y los archivos `.dump` están en `.gitignore`.

## Qué hace el respaldo

- Corre `pg_dump` dentro del contenedor de Postgres, en el formato propio de Postgres
  (comprimido), y copia el archivo a la carpeta de respaldos.
- El nombre lleva la base y la fecha: `gestor_causas-20261127-230000.dump`.
- Guarda los **últimos 14** de cada base y borra los más viejos. Un archivo a medio copiar nunca
  cuenta como respaldo (se escribe primero como `.partial`).
- Si Postgres no estaba levantado, lo levanta.

## Respaldar a mano

En Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1 -Dir D:\copias\gestor -Keep 30
```

En Linux, macOS o Git Bash:

```bash
bash scripts/backup.sh
bash scripts/backup.sh --dir /mnt/copias/gestor --keep 30
```

| Opción | Variable (entorno o `.env`) | Por defecto |
|--------|-----------------------------|-------------|
| `-Dir` / `--dir` | `BACKUP_DIR` | `backups/` en la carpeta del proyecto |
| `-Keep` / `--keep` | `BACKUP_KEEP` | `14` |
| `-Db` / `--db` | `DB_NAME` | `gestor_causas` |

Una carpeta relativa en `--dir` / `-Dir` se toma desde donde corrés el comando; en `BACKUP_DIR`,
desde la carpeta del proyecto. Dos respaldos en el mismo segundo comparten nombre y el segundo
reemplaza al primero.

Lo ideal es que `BACKUP_DIR` apunte a **otro disco** (o a una carpeta que se sincronice con otro
lugar): si se rompe el disco de la compu, el respaldo en el mismo disco se pierde con ella.

## Programarlo todos los días en Windows

Con el Programador de tareas, desde una terminal de PowerShell (cambiá la ruta del proyecto):

```powershell
schtasks /Create /TN "Gestor - respaldo diario" /SC DAILY /ST 23:00 /F `
  /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\gestor\scripts\backup.ps1"
```

- Si la ruta del proyecto tiene espacios (`C:\Mis documentos\gestor`), encerrala entre `\"`:
  `/TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"C:\Mis documentos\gestor\scripts\backup.ps1\""`.
  Probala con `/Run` (abajo) antes de confiar en ella.
- Corre todos los días a las 23:00 con tu usuario, **solo si iniciaste sesión** (Docker Desktop
  tiene que estar abierto). Si la compu suele estar apagada a esa hora, elegí otra.
- Para probarla ya: `schtasks /Run /TN "Gestor - respaldo diario"` y fijate que aparezca el
  archivo nuevo en la carpeta.
- Para ver si falló: abrí el Programador de tareas, buscá la tarea y mirá **Último resultado**
  (`0x0` es que salió bien).
- Para borrarla: `schtasks /Delete /TN "Gestor - respaldo diario" /F`.

En Linux o macOS, con `cron` (`crontab -e`):

```cron
0 23 * * * cd /ruta/al/proyecto && mkdir -p backups && bash scripts/backup.sh >> backups/backup.log 2>&1
```

## Restaurar un respaldo

1. **Cerrá el backend** (y la demo, si está abierta). La restauración corta sus conexiones.
2. Corré el script con el archivo:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 backups\gestor_causas-20261127-230000.dump
   ```

   ```bash
   bash scripts/restore.sh backups/gestor_causas-20261127-230000.dump
   ```

3. Te pide que escribas el nombre de la base para confirmar. Si no coincide, no hace nada.
4. Arrancá el backend de nuevo.

Cómo lo hace, para que un error no te deje sin datos:

- Carga el respaldo en una base nueva (`gestor_causas_restaurando`). Si el archivo está dañado o
  no es un respaldo, se detiene ahí y **tu base queda como estaba**.
- Solo si la carga salió bien, cambia las bases: la que tenías queda guardada como
  **`gestor_causas_previa`** y la restaurada pasa a ser `gestor_causas`.
- `gestor_causas_previa` se reemplaza en la próxima restauración. Si te equivocaste de archivo,
  todavía podés volver a ella (ver abajo).

Para otra base, por ejemplo la de la demo: `--db gestor_demo` / `-Db gestor_demo`. Sin terminal
(un script), `--yes` / `-Yes` omite la confirmación: usalo solo si sabés lo que hacés.

### Volver a la base anterior a la restauración

Con el backend cerrado:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres'
```

```sql
ALTER DATABASE gestor_causas RENAME TO gestor_causas_descartada;
ALTER DATABASE gestor_causas_previa RENAME TO gestor_causas;
```

## Probar que los respaldos sirven

Un respaldo que nunca se restauró no es un respaldo. Una vez por mes, restaurá el último en una
base de prueba y abrila:

```bash
bash scripts/restore.sh backups/<el-último>.dump --db gestor_prueba
```

Para abrirla, arrancá el backend apuntando a esa base (con el de siempre cerrado):
`DB_URL=jdbc:postgresql://localhost:5434/gestor_prueba` en el entorno, y entrá como siempre.

Además, CI lo prueba en cada cambio de los scripts: `scripts/backup-smoke.sh` respalda la base
con los datos ficticios de la demo, la modifica, comprueba que un archivo dañado no la toca, la
restaura y verifica que vuelve a tener las mismas causas y que la anterior quedó como `_previa`.
