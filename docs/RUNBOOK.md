# Runbook de operación · TaskFlow

Todos los comandos se ejecutan en el servidor como usuario `deploy`, en `/opt/app`, salvo que se
indique lo contrario. Alias útil: `alias dc='docker compose -f docker-compose.prod.yml'`.

## Estado rápido

```bash
dc ps                                   # contenedores, estado y health
dc logs -f --tail=200 backend           # logs JSON del backend (todas las réplicas)
grep IMAGE_TAG .env; tail -5 .deploy-history
curl -s https://$DOMAIN/api/version     # versión servida
```

## Despliegues

| Acción | Cómo |
|---|---|
| Desplegar | Merge a `main` (automático a staging; production tras aprobación). |
| Redesplegar o fijar una versión | GitHub → Actions → **Deploy** → Run workflow → entorno + tag (`sha-<commit>` o `1.2.0`). |
| Rollback inmediato | `bash scripts/rollback.sh` (vuelve al tag anterior) o `bash scripts/rollback.sh <tag>`. |
| Desplegar a mano (emergencia) | `bash scripts/deploy.sh <tag>` (requiere `docker login ghcr.io` si las imágenes son privadas). |

`deploy.sh` es seguro de reintentar: usa un lock por host, no cambia `.env` hasta terminar bien y,
si falla después de cambiar de versión, restaura la anterior automáticamente.

**Rollback y base de datos:** el rollback no revierte migraciones. Por diseño son compatibles hacia
atrás (expand/contract), así que la versión anterior funciona con el esquema nuevo. Si una migración
corrompió datos, restaura un backup (abajo).

## Backups

- Automáticos: cada día a las 03:15 UTC (`/etc/cron.d/taskflow-backup`), y antes de cada despliegue.
- Locales en `/var/backups/taskflow` (retención `BACKUP_RETENTION_DAYS`), copia en S3 si `BACKUP_S3_BUCKET` está definido.
- Snapshots EBS diarios del disco completo (Data Lifecycle Manager).
- Log: `/var/log/taskflow/backup.log`.

```bash
bash scripts/backup.sh manual                              # backup a demanda
ls -lh /var/backups/taskflow/
bash scripts/restore.sh /var/backups/taskflow/<fichero>.dump   # DESTRUCTIVO: pide confirmación y hace backup previo
```

Desde S3 (desde una máquina con permisos de lectura; la instancia solo puede escribir):

```bash
aws s3 cp s3://<bucket>/postgres/<fichero>.dump .
scp <fichero>.dump deploy@<ip>:/var/backups/taskflow/
```

**Prueba la restauración cada mes** en staging: un backup que nunca se ha restaurado no es un backup.

## Secretos

| Secreto | Dónde | Rotación |
|---|---|---|
| Contraseña de PostgreSQL | `secrets/db_password` | Ver abajo |
| Admin de Grafana | `secrets/grafana_admin_password` | Editar el fichero y `dc up -d --force-recreate grafana` (solo aplica al primer arranque; después cámbiala desde la UI) |
| Webhook de Slack | `secrets/alert_webhook_url` | Editar y `dc restart alertmanager` |
| Clave SSH de deploy | GitHub Environment + `~deploy/.ssh/authorized_keys` | Generar nueva, añadirla al servidor, actualizar el secreto, quitar la antigua |

Rotar la contraseña de PostgreSQL sin downtime perceptible:

```bash
new=$(openssl rand -hex 24)
dc exec -T db psql -U taskflow -d taskflow -c "ALTER USER taskflow PASSWORD '$new';"
printf '%s' "$new" > secrets/db_password
bash scripts/deploy.sh "$(grep ^IMAGE_TAG= .env | cut -d= -f2)"    # blue/green con el secreto nuevo
```

## Acceso

- SSH administración: `ssh ubuntu@<ip>`. Sin SSH: `aws ssm start-session --target <instance-id>`.
- Grafana: `ssh -L 3001:127.0.0.1:3001 deploy@<ip>` → http://localhost:3001.
- Prometheus (ad hoc): `ssh deploy@<ip> 'docker compose -f /opt/app/docker-compose.prod.yml exec prometheus wget -qO- localhost:9090/api/v1/alerts'`.

## Respuesta a alertas

### EndpointDown
La URL pública no responde desde el blackbox exporter.
1. `dc ps` — ¿está `proxy` arriba? `dc logs --tail=100 proxy` (errores de certificado ACME, bind de puertos).
2. ¿Responde la app por dentro? `dc exec proxy wget -qO- http://backend:3000/readyz`.
3. Comprueba DNS (`dig +short $DOMAIN`) y el security group.
4. Si empezó tras un despliegue: `bash scripts/rollback.sh`.

### BackendDown
Ninguna réplica del backend pasa el scrape.
1. `dc ps backend`, `dc logs --tail=200 backend` (¿error de arranque? ¿OOM?).
2. `docker inspect <id> --format '{{.State.OOMKilled}}'` → subir el límite de memoria en el compose.
3. `dc exec db pg_isready` — si la DB está caída, el backend falla readiness.
4. Rollback si coincide con un despliegue.

### HighErrorRate
Más del 5% de respuestas 5xx durante 5 minutos.
1. Dashboard → *Peticiones por ruta* para localizar el endpoint.
2. `dc logs --since=15m backend | grep '"level":50'` (errores de pino).
3. ¿Coincide con un despliegue? → `bash scripts/rollback.sh`. ¿Con la DB? → ver BackendDown punto 3.

### HighLatencyP95
1. Dashboard → *Event loop lag* (CPU en Node) y *CPU/Memoria por contenedor*.
2. DB: `dc exec db psql -U taskflow -c "select pid, now()-query_start as t, query from pg_stat_activity where state<>'idle' order by t desc limit 10;"`.
3. Si es carga legítima: más réplicas (`deploy.replicas`) o instancia mayor (`instance_type` en Terraform).

### TLSCertExpiringSoon
Caddy renueva solo a 30 días del vencimiento; si salta, la renovación está fallando.
1. `dc logs proxy | grep -i -E 'acme|certificate|error'`.
2. Causas típicas: el puerto 80 no es accesible, el DNS no apunta a la IP, rate limits de Let's Encrypt.

### HostDiskSpaceLow
1. `df -h /`, `docker system df`.
2. `docker image prune -af --filter until=168h`, `docker builder prune -af`.
3. Revisa `/var/backups/taskflow` y la retención; amplía `root_volume_size_gb` en Terraform si hace falta (gp3 se amplía en caliente; luego `sudo growpart /dev/nvme0n1 1 && sudo resize2fs /dev/nvme0n1p1`).

## Recuperación ante desastres

Servidor perdido o corrupto (RTO objetivo ~30 min):

1. `terraform apply` del entorno (recrea la instancia; la IP elástica se reasocia).
   Alternativa más rápida: crear el volumen desde el último snapshot EBS.
2. Primer arranque del servidor (README, paso 4) con los mismos secretos si los conservas.
3. Lanzar **Deploy** con el último tag bueno.
4. Restaurar el último backup de S3 con `bash scripts/restore.sh`.
5. Verificar con `deploy/scripts/smoke-test.sh https://<dominio>` y el dashboard.
