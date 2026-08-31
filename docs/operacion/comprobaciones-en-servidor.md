# Comprobaciones en el servidor

Tres preguntas que el repositorio **no puede** contestar solo, y los comandos exactos para
contestarlas en la máquina real. Todo lo de aquí es **de solo lectura**: no hay un solo
comando que escriba, migre o borre.

Se escribió porque el dueño del proyecto no construyó la infraestructura y necesita saber qué
hay. Da por supuesto que **no hay nada** —ni respaldo, ni cargues previos— y sirve para
comprobar si esa suposición pesimista es cierta.

> **Método.** Cada apartado trae primero **lo que el repositorio ya demuestra** (con
> `ruta:línea`, y eso no hace falta comprobarlo) y después **lo que solo se ve en el
> servidor**. La frontera entre las dos cosas es lo más importante de este documento: no
> confundir "el código no lo prevé" con "en la máquina no ocurre".

---

## 1 · ¿Pueden estar dos backends escribiendo a la vez?

Importa porque `Matricula` (cada 1 h) y `VigiaDeCupos` (cada 12 h) **arrancan siempre y no
tienen interruptor**, a diferencia de los tres workers. Si hay dos backends vivos, los dos
relojes corren duplicados sobre dos bases divergidas.

### Lo que el repositorio ya demuestra

`CONFIRMADO EN CÓDIGO`

- **Tres sedes**: `server-bogota`, `server-socorro`, `server-pc-dell` — valor por defecto en
  `scripts/comun.sh:82`, no fijo: el `.env` de cada máquina puede cambiarlo.
- **En régimen normal solo la principal levanta la aplicación.** Al rendirse, una sede
  **elimina** los contenedores, no los para: `docker compose rm -sf backend frontend nginx`
  (`scripts/rendirse.sh:51`). Un `rm -sf` hace que `restart: unless-stopped` ya no pueda
  revivirlos.
- La réplica **construye pero no arranca**: `scripts/seguir-al-principal.sh:49-50`, con el
  comentario *"se construye, no se arranca: la base es de solo lectura"*.
- **Los dos relojes no tienen guarda alguna**: `backend/src/crm/matricula.ts:35-38` y
  `backend/src/crm/vigia-de-cupos.ts:34-37`, registrados como providers incondicionales en
  `crm.module.ts:41` y `:43`. Los tres workers sí leen una variable y se abstienen
  (`campanas.worker.ts:18`, `rui.worker.ts:18`, `web.worker.ts:18`).

### Y esto es lo que abre la ventana

**No hay quorum, ni fencing, ni testigo.** El propio `promover.sh` lo dice en voz alta
(`:97-103`), y lo deja como **tarea manual**:

```
  PENDIENTE en las otras dos sedes, y no es opcional:
    ssh <otra> → cd /opt/sep/reservasae && ./scripts/rendirse.sh <nueva>
  la sede caída seguirá escribiendo en su propia base hasta que se rinda,
  y la otra réplica se congela sin avisar: su ranura ya no existe aquí
```

Es decir: **promover no apaga a nadie.** Entre que una sede se promueve y que un humano entra
por ssh a rendir a las otras, hay dos backends escribiendo. La ventana la acota
`autorendirse.timer` (cada 2 min) **si está instalado**; si no, es indefinida.

Y hay un camino automático que fuerza la promoción saltándose el guardia:
`scripts/recuperar-mando.sh:85` ejecuta `FORZAR=si exec scripts/promover.sh`, y `FORZAR=si`
es justo lo que anula el `✗ el principal sigue atendiendo` de `promover.sh:33-39`. Está
justificado en el comentario —solo fuerza tras comprobar cero bytes de atraso— pero el
guardia que anula es el que impide **dos bases aceptando escrituras**.

### Lo que hay que mirar en el servidor

**a) ¿Cuántas sedes tienen la aplicación arrancada ahora mismo?** Es la comprobación directa.

```bash
cd /opt/sep/reservasae && ./scripts/estado.sh
```

> Sano: **una sola fila con `APP=si`**, un solo `PRINCIPAL`, un solo `TUNEL=si`, y las tres en
> la misma `LÍNEA`. La regla la trae el propio guion al pie (`scripts/estado.sh:33-35`).
> **Dos filas con `APP=si` son dos backends vivos**, y por tanto los dos relojes duplicados.

**b) ¿Está instalado `recuperar-mando.timer`, y dónde?** Es el único camino automático que
promueve con `FORZAR=si`.

```bash
for s in server-bogota server-socorro server-pc-dell; do
  echo "== $s"
  ssh sepadmin@$s 'systemctl list-timers --all | grep -E "autopromover|autorendirse|recuperar-mando|arrancar-tunel|asegurar-base|seguir-al-principal"; systemctl is-enabled recuperar-mando.timer 2>&1'
done
```

> Si sale `enabled` **y** esa sede tiene `SEDE_PREFERIDA` puesta, existe un camino sin humano
> que fuerza una promoción contra un principal que sigue sirviendo.

**c) ¿Qué variables tienen de verdad?** Los valores por defecto del código pueden no ser los
reales. Ninguna de estas claves es un secreto.

```bash
for s in server-bogota server-socorro server-pc-dell; do
  echo "== $s"
  ssh sepadmin@$s 'grep -E "^(AUTOPROMOVER|SEDE|SEDE_PREFERIDA|PRINCIPAL|PREFERENCIA_PROMOCION|OTRAS_SEDES|ESPERA_RECUPERAR)=" /opt/sep/reservasae/.env'
done
```

> `AUTOPROMOVER=si` **no debe aparecer en `server-pc-dell`**:
> `docs/systemd/autopromover.service:1-6` dice *"Instalar en Bogotá y El Socorro, NUNCA en el
> PC Dell"*.

**d) La prueba definitiva de si hay dos bases aceptando escrituras.** La escribe el propio
repositorio en `CLAUDE.md:3058-3060`: *"una réplica sana rechaza cualquier escritura con
`cannot execute INSERT in a read-only transaction`"*.

```bash
for s in server-bogota server-socorro server-pc-dell; do
  echo -n "$s: "
  ssh sepadmin@$s 'cd /opt/sep/reservasae && docker compose exec -T db psql -tAU reservasae -d reservasae -c "SELECT pg_is_in_recovery(), (SELECT timeline_id FROM pg_control_checkpoint())"'
done
```

> Sano: **una sola fila con `f`** (principal) y las otras con `t` (réplica), y el **mismo
> `timeline_id` en las tres**.
> Dos filas con `f` = split-brain **activo ahora**.
> Dos `timeline_id` distintos con ambas en `f` = las dos promovieron y **las escrituras ya
> divergieron**. Eso deja de ser un riesgo y pasa a ser un incidente de datos.

**e) ¿Hubo rendiciones en el pasado?** Cada una es la huella de una sede que estuvo
escribiendo por su cuenta.

```bash
for s in server-bogota server-socorro server-pc-dell; do
  echo "== $s"; ssh sepadmin@$s 'ls -la ~/rendicion-*.sql 2>/dev/null || echo "sin respaldos"'
done
```

**f) ¿Hay un backend en ciclo de reinicios?** Sería la firma de uno arrancado contra una base
de solo lectura.

```bash
for s in server-bogota server-socorro server-pc-dell; do
  echo "== $s"; ssh sepadmin@$s 'docker ps -a --filter name=reservasae --format "{{.Names}}\t{{.Status}}"'
done
```

> Un `reservasae_backend` en `Restarting` **no** ejecuta los relojes: muere en
> `backend/arrancar.sh:29` (`prisma migrate deploy` con `set -e`) antes de llegar a
> `node dist/main.js`. Es lo que anticipa `scripts/desplegar.sh:8-15`.
> **Matiz honesto:** que muera ahí es lo que el repo *espera*, no lo que el repo *demuestra*.
> Solo se confirma viéndolo.

---

## 2 · ¿Existe respaldo de la base de datos?

### Lo que el repositorio ya demuestra

`CONFIRMADO EN CÓDIGO` — **no hay ningún respaldo programado.**

- **Ninguno de los seis `.timer` usa `OnCalendar`**, y ninguno respalda nada. Son de
  infraestructura: túnel, base, conmutación.
- **El único `pg_dump` del repositorio** está en `scripts/rendirse.sh:57-63`. Y tiene cuatro
  problemas, cada uno suficiente por su cuenta:
  1. **Lo dispara un failover, no el reloj.** Si no hay conmutación, no hay copia. Nunca.
  2. Escribe un `.sql` **sin comprimir en el home de la misma máquina** cuyo volumen de datos
     se borra pocas líneas después (`:90-92`).
  3. **Si sale vacío, se borra**: `rm -f "$respaldo"` en `:63`, guardado por
     `[ -s "$respaldo" ]` en `:60`. O sea: justo cuando más falta haría saber que falló, no
     queda ni el archivo vacío como pista.
  4. Sin retención, sin copia externa, sin verificación de que se pueda restaurar.
- **`NO ENCONTRADO`: archivado de WAL, PITR, `pgbackrest`, `barman`, `wal-g`.**
- **`NO ENCONTRADO`: una sola línea de documentación sobre cómo restaurar.**

### La replicación NO es un respaldo, y aquí está el porqué

Es la confusión más cara que se puede tener con este sistema.

La replicación en streaming es **física**: replica también el DDL. El propio `CLAUDE.md:2804-2806`
lo dice —*las migraciones se propagan solas, comprobado creando y borrando una tabla*—.

Por tanto: **un `DROP TABLE` o un `DELETE` llega a las tres sedes en segundos.** La
replicación protege contra que se queme un servidor. No protege contra un error humano, ni
contra una migración mala, ni contra el borrado de participante que arrastra el historial.

Y la operación más destructiva del repositorio —`docker volume rm` sobre el volumen de
Postgres, `rendirse.sh:90-92`— puede ocurrir **de forma automática y desatendida** si
`autorendirse.timer` está instalado. El único salvavidas sería ese `pg_dump` de la línea 57.

### Lo que hay que mirar en el servidor

**a) ¿Hay algún temporizador o unidad de respaldo instalada, aunque esté parada?**

```bash
systemctl list-timers --all --no-pager
systemctl list-unit-files --type=service --type=timer --no-pager \
  | grep -iE 'respald|backup|dump|copia|pgback|barman|wal'
```

> En las **tres** sedes. Sin salida en el segundo = no hay ninguna unidad de respaldo, ni
> siquiera apagada. Compara el primero con los seis del repo: `arrancar-tunel`,
> `asegurar-base`, `autopromover`, `autorendirse`, `recuperar-mando`, `seguir-al-principal`.

**b) ¿Hay un cron fuera del repo?** Es el hueco número uno que el repositorio no puede cerrar.

```bash
sudo cat /etc/crontab
sudo ls -la /etc/cron.d/ /etc/cron.hourly/ /etc/cron.daily/ /etc/cron.weekly/
for u in root sepadmin postgres; do
  echo "== crontab de $u"; sudo crontab -l -u $u 2>/dev/null || echo "(sin crontab)"
done
```

> Busca cualquier línea con `pg_dump`, `docker compose exec db`, `.sql`, `.gz`, `rsync` o
> `scp`. Si las tres sedes dan "(sin crontab)" y los `cron.*` solo traen lo de fábrica
> (`0anacron`, `e2scrub_all`, `logrotate`, `man-db`), **queda confirmado que no hay respaldo**.

**c) ¿Existen volcados en disco, de qué fecha y de qué tamaño?**

```bash
ls -lh --time-style=long-iso ~/rendicion-*.sql ~/reservasae-antes-del-crm-*.sql.gz 2>/dev/null
du -shc ~/*.sql ~/*.sql.gz 2>/dev/null | tail -1
```

> Mira **fecha** y **tamaño**. Si el más nuevo es de hace meses, no hay nada actual que sirva.
> Un archivo de pocos kilobytes es un volcado fallido, no una copia.

**d) ¿Hay algún volcado en otro sitio que nadie documentó?**

```bash
sudo find / -xdev -type f \( -name '*.sql' -o -name '*.sql.gz' -o -name '*.dump' \) \
  -size +100k -printf '%TY-%Tm-%Td %10s %p\n' 2>/dev/null | sort -r | head -40
```

> Ignora lo que caiga en `backend/prisma/migrations` — son migraciones, no respaldos.

**e) ¿La configuración viva de Postgres permite volver a un instante anterior?**

```bash
docker compose exec -T db psql -U reservasae -d reservasae -c \
  "SELECT name, setting, source FROM pg_settings WHERE name IN
   ('archive_mode','archive_command','wal_level','max_slot_wal_keep_size','synchronous_commit');"
```

> **`archive_mode = off` confirma que NO hay recuperación a un punto en el tiempo.** Sin
> archivado de WAL, el único camino de vuelta sería un `pg_dump` que hoy no se toma.

**f) ¿El anfitrión Windows tiene checkpoints o tareas de copia?** Es la única red de seguridad
plausible que quedaría fuera del repositorio.

```powershell
Get-VM | Get-VMSnapshot | Format-Table VMName, Name, SnapshotType, CreationTime -AutoSize
Get-ScheduledTask | Where-Object {$_.TaskName -match 'backup|respald|copia|veeam|vhdx'} |
  Format-Table TaskName, State, TaskPath -AutoSize
```

> En PowerShell como administrador, en los tres anfitriones. Sin salida en ambos = no existe
> esa red de seguridad.

---

## 3 · ¿Se ha usado alguna vez el cargue masivo de reservas?

Es el hallazgo crítico nº 1 de Fase 0. Si nunca se usó, es un riesgo futuro; si se usó, es un
descuadre presente.

### Lo que el repositorio ya demuestra

`CONFIRMADO EN CÓDIGO`

El cargue deja **una fila** en `registros_auditoria` por cargue completo, identificable por
`entidad='reserva'` y `entidadId='cargue-masivo'` (`plantillas.service.ts:407-414`).

**Pero esa fila es una cota inferior, no una prueba.** Por dos motivos, y los dos importan:

1. Se escribe **después del `for` y fuera de transacción**. Un cargue que reventó a mitad
   **ya pisó filas** y no deja rastro ninguno.
2. `AuditoriaService.registrar` **se traga sus propias excepciones**
   (`auditoria.service.ts:116-135`, *"no revienta la operación que audita"*). Así que incluso
   un cargue que terminó bien puede no dejar fila si falló el `insert` de auditoría.

> **Por eso un cero en la consulta 1 no cierra la pregunta.** Hay que correr también la 4.

### Las consultas. Todas de solo lectura

Se ejecutan en la sede **principal**:
`cd /opt/sep/reservasae && docker compose exec -T db psql -U reservasae -d reservasae`

**Consulta 1 — ¿se usó, y cuántas veces?**

```sql
SELECT COUNT(*) AS veces, MIN("creadoEn") AS primera, MAX("creadoEn") AS ultima
  FROM "registros_auditoria"
 WHERE "entidadId" = 'cargue-masivo'
   AND lower("entidad") IN ('reserva', 'reservas');
```

> El `lower()` no es por si acaso: **hasta cierto commit el código escribía la grafía en
> mayúscula**, así que hay filas viejas con otra caja.
> `veces = 0` → ningún cargue **completado con éxito**. Sigue con la 4.

**Consulta 2 — si se usó: quién, cuándo y cuántas filas.**

```sql
SELECT "creadoEn", "actorNombre", "adminId", "resumen", "camposTocados", "convenioId", "ip"
  FROM "registros_auditoria"
 WHERE "entidadId" = 'cargue-masivo'
   AND lower("entidad") IN ('reserva', 'reservas')
 ORDER BY "creadoEn" DESC;
```

> `resumen` trae literalmente *"Cargue por plantilla: N reservas"* — ese N son las filas
> pisadas.
> **Cuidado con `camposTocados`:** refleja **las columnas que traía el archivo**, no las que
> cambiaron de valor. Que aparezca `cuposSolicitados` significa que la columna venía en el
> `.xlsx` —siempre viene, es la plantilla—, no que se modificara.

**Consulta 3 — ¿el contador de cupos cuadra?** Reutiliza el SQL de
`backend/prisma/verificar-invariantes.ts`.

```sql
SELECT o."id", o."cuposOcupados" AS contador,
       COALESCE(SUM(r."cuposConfirmados"), 0)::int AS suma
  FROM "ofertas" o
  LEFT JOIN "reservas" r ON r."ofertaId" = o."id" AND r."estado" <> 'CANCELADA'
 GROUP BY o."id", o."cuposOcupados"
HAVING o."cuposOcupados" <> COALESCE(SUM(r."cuposConfirmados"), 0);
```

> **Aviso, y es el más importante del documento:** lo más probable es que esto salga **vacío
> aunque el cargue se haya usado y haya hecho daño**. La plantilla escribe
> `cuposSolicitados`, y esta consulta compara `cuposConfirmados`. Sirve para detectar *otros*
> descuadres —como el de la cascada que borra reservas—, no este.

**Consulta 4 — la que de verdad detecta este cargue.** Es la firma que sobrevive incluso a un
cargue que reventó a mitad.

```sql
SELECT date_trunc('minute', r."actualizadoEn") AS minuto,
       COUNT(*) AS reservas_tocadas,
       MIN(r."actualizadoEn") AS desde, MAX(r."actualizadoEn") AS hasta
  FROM "reservas" r
 WHERE r."actualizadoEn" > r."creadoEn" + interval '2 seconds'
   AND NOT EXISTS (
         SELECT 1 FROM "movimientos_reserva" m
          WHERE m."reservaId" = r."id"
            AND m."creadoEn" BETWEEN r."actualizadoEn" - interval '2 minutes'
                                 AND r."actualizadoEn" + interval '2 minutes')
 GROUP BY 1 HAVING COUNT(*) >= 3
 ORDER BY 1 DESC;
```

> Cada fila es un minuto en el que **tres o más reservas se tocaron sin dejar
> `MovimientoReserva`**. La edición normal sí escribe movimiento; **la plantilla no escribe
> ninguno** (`grep 'movimiento' plantillas.service.ts` → sin resultados). Un grupo grande en
> un mismo minuto es un cargue masivo, lo haya registrado la auditoría o no.

**Consulta 5 — ¿están puestos los CHECK en producción?** De esto depende cómo se lee todo lo
anterior.

```sql
SELECT conname, pg_get_constraintdef(oid) AS definicion
  FROM pg_constraint
 WHERE conrelid = '"reservas"'::regclass AND contype = 'c'
 ORDER BY conname;
```

> Deben aparecer `reservas_cupos_no_negativos`, `reservas_reparto_coherente` y
> `reservas_cancelada_sin_cupos`.
> **Si `reparto_coherente` está** → la base rechazó cada `update` malo, así que el modo de
> fallo real es el **cargue a medias** (mira la consulta 4), y al usuario le salió un
> **500 crudo** porque no hay `ExceptionFilter`.
> **Si NO está** → la base aceptó todo, y hay que revisar los datos en serio.

**Consulta 6 — contraste: ¿se usó el cargue de empresas o instituciones?**

```sql
SELECT lower("entidad") AS entidad, COUNT(*) AS veces,
       MIN("creadoEn") AS primera, MAX("creadoEn") AS ultima
  FROM "registros_auditoria"
 WHERE "entidadId" = 'cargue-masivo'
 GROUP BY 1 ORDER BY veces DESC;
```

> Si los otros cargues sí se usaron y el de reservas no, la función se conoce y se usa: el
> riesgo de que alguien llegue al de reservas es real, no teórico.

---

## Lo que este documento NO puede contestar

Con honestidad, para que nadie lo dé por cerrado antes de tiempo:

- **Si alguien intentó un cargue que reventó al principio**, antes de escribir una sola fila,
  no queda rastro de ninguna clase. Ni auditoría ni `actualizadoEn`.
- **Cuánto tiempo estuvieron dos backends vivos** en una conmutación pasada. Solo se puede
  acotar por las fechas de los `rendicion-*.sql` y por `journalctl`.
- **Si un respaldo restaura de verdad.** Un `pg_dump` que existe no es un respaldo probado.
  Eso solo se sabe restaurándolo en una máquina aparte, y ese es un ejercicio de Fase 5.

---

## Qué hacer con los resultados

| Si sale… | Entonces |
|---|---|
| Dos filas con `APP=si`, o dos `f` en `pg_is_in_recovery` | **Incidente activo.** Split-brain. Para y escala antes de tocar nada |
| `timeline_id` distintos entre sedes en `f` | **Los datos ya divergieron.** No se arregla solo; hay que decidir qué base manda |
| Sin cron, sin timers de respaldo, `archive_mode = off` | **Confirmado: no hay respaldo.** Es el P0 del plan de migración |
| `veces > 0` en la consulta 1, o filas en la 4 | El hallazgo crítico nº 1 **ya ocurrió**. Hay que cuadrar los cupos afectados |
| Todo limpio | Los supuestos pesimistas se confirman como riesgo futuro, no presente. Sigue el plan |

Ver [`docs/arquitectura/00-mapa-actual.md`](../arquitectura/00-mapa-actual.md) para el
contexto completo de cada hallazgo.
