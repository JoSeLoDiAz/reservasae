# Migrar el principal a la nube, sin tumbar el servicio

Decisión de Josse (3 oct 2026): **la VM de Google Cloud pasa a ser el principal, y
Bogotá y El Socorro se quedan como réplicas en ese orden de preferencia. El PC Dell
sale del esquema.** La condición que manda sobre todo lo demás es que
`reservasae.com` siga respondiendo.

Esto es un procedimiento, no una propuesta: cada paso está comprobado contra el
guion que lo ejecuta, y los números salen de medir las tres sedes el 3 oct 2026.

## La máquina, medida

`instance-grupo-ae-col-2026` · proyecto `proyecto-grupo-ae-col-2026` · zona
`us-east4-b` · `c3d-standard-16` (16 vCPU, 62 GB de RAM) · Ubuntu 26.04 ·
**sin IP pública**: solo sale, no entra, y se entra por el túnel IAP.

**No está vacía.** Ya sirve `adecopria`, `grupoadvanced` y `advance-pruebas` con el
nginx del sistema en el puerto 80, tiene un PostgreSQL 18 nativo en el 5432, y hay
seis cuentas de personas más dos de sistema (`adecopria`, `grupoadvanced`). Todo eso
se queda como está.

Cinco discos, **2.500 GB sin formatear y sin montar**, y ninguno en `/etc/fstab`:

| Disco | Tamaño | Destino que dice su nombre |
|---|---|---|
| `instance-20260922-162902` | 500 GB | arranque, `/` (12 GB usados) |
| `var-lib-docker` | 200 GB | `/var/lib/docker` |
| `var-lib-postgresql` | 300 GB | `/var/lib/postgresql` |
| `var-lib-mysql` | 500 GB | `/var/lib/mysql` — de Moodle |
| `var-moodledata` | 1,5 TB | `/var/moodledata` — de Moodle |

> **Los 2,5 TB se pidieron para el LMS, no para reservasae.** Moodle necesita
> `moodledata` y su MySQL; reservasae cabe en 143 MB. Montar los discos de Moodle no
> es parte de esta migración y conviene no mezclarlo.

**La salida está abierta a todo lo que hace falta**, comprobado: Tailscale (443 y
**UDP 41641**, o sea conexión directa y no relevo), el túnel de Cloudflare (7844),
SMTP de Google (587 y 465), el RUES y GitHub. Y los puertos 4600, 5433, 3000 y 4000
están libres: la pila no choca con lo que ya corre.

## Lo que hay que mover, en números

| | |
|---|---|
| La base `reservasae` | **41 MB** |
| El directorio de datos entero | **143,5 MB** |
| `pg_basebackup` a la nube | segundos |
| Ranuras de replicación hoy | **una sola**, `server_socorro` |
| Línea temporal actual | **17** |
| `wal_level` / `max_wal_senders` / `max_replication_slots` | `replica` / 10 / 10 — **no hay que cambiar nada** |

**El PC Dell ya está fuera de la replicación**: no tiene ranura. Sacarlo es limpiar
guiones y listas, no cirugía.

---

# FASE 0 · Desarmar los automatismos. Esto va PRIMERO

**Si se salta esta fase, la migración se deshace sola y no hace falta que nadie se
equivoque.** Medido en producción el 3 oct 2026:

```
Bogotá:      SEDE_PREFERIDA=server-bogota   recuperar-mando.timer  enabled
             ESPERA_RECUPERAR=60            AUTOPROMOVER=si        autopromover.timer enabled
             ESPERA_PROMOCION=60

El Socorro:  AUTOPROMOVER=si                autopromover.timer     enabled
             ESPERA_PROMOCION=60            recuperar-mando.timer  no instalado
```

Dos automatismos armados, y los dos disparan contra esta migración:

**1 · `recuperar-mando.sh` le devuelve el mando a Bogotá en 60 segundos.** Sus dos
únicas puertas son `SEDE_PREFERIDA` puesta y que coincida con `SEDE`
(`recuperar-mando.sh:20-21`), y las dos se cumplen hoy. En cuanto Bogotá sea una
réplica sana y al día, espera `ESPERA_RECUPERAR` —que aquí es **60 s**, no los 600
por omisión— y ejecuta:

```
FORZAR=si exec scripts/promover.sh          # recuperar-mando.sh:85
```

Y `FORZAR=si` es exactamente lo que anula el guardia que impide dos principales:

```
echo "✗ el principal sigue atendiendo"
[ "${FORZAR:-}" = si ] || exit 1             # promover.sh:34-37
```

El resultado no es que el dominio se caiga —`arrancar-tunel.sh:34` se niega a
levantar el túnel mientras la nube sirva, así que el sitio sigue respondiendo—, es
que **hay dos bases escribiendo** y Bogotá salta de línea temporal. Y después el
`autorendirse` de la nube ve a Bogotá en línea mayor y ejecuta `rendirse.sh`, que
hace `docker volume rm` de la base de la nube. Ese sí corta.

**2 · `autopromover.sh` promueve una réplica 60 s después del corte.** La ventana del
cambio de principal dura más que eso, así que El Socorro se promovería en mitad de la
mudanza.

> Ojo: **`CLAUDE.md` dice que `ESPERA_PROMOCION` son 300 s por omisión, y producción
> corre 60.** El valor por defecto del guion es 300 (`autopromover.sh:11`); el `.env`
> lo baja. No se puede planear la ventana contra el número del documento.

## Qué hacer, en las tres sedes

```bash
# en Bogotá y en El Socorro
sudo systemctl disable --now autopromover.timer autorendirse.timer
sudo systemctl disable --now recuperar-mando.timer     # solo existe en Bogotá

# y quitar la mina del .env de Bogotá
sed -i '/^SEDE_PREFERIDA=/d' /opt/sep/reservasae/.env
```

`arrancar-tunel.timer`, `asegurar-base.timer` y `seguir-al-principal.timer` **se
quedan encendidos**: el primero es lo que mantiene el dominio en pie, el segundo
levanta la base si el arranque la dejó caída, y el tercero es cómo las réplicas
siguen al principal.

**Comprobar antes de seguir:**

```bash
systemctl is-enabled autopromover.timer autorendirse.timer recuperar-mando.timer
grep -c '^SEDE_PREFERIDA=' /opt/sep/reservasae/.env     # tiene que decir 0
```

**Marcha atrás de la fase 0:** volver a habilitar los tres temporizadores y devolver
la línea `SEDE_PREFERIDA=server-bogota`. No se ha tocado nada más.

---

# FASE 1 · La nube se vuelve réplica. El servicio no se entera

Bogotá sigue siendo principal y sirviendo todo el tiempo. Nada de esta fase toca el
dominio.

## 1.1 · Tailscale, y va primero

Todo lo que una sede le pregunta a otra va por `ssh sepadmin@<nombre>` con
`BatchMode=yes` y **sin `ProxyCommand`** (`comun.sh:46`); el `curl` al 4600 se hace
*dentro* de ese ssh. O sea que **no hace falta ningún puerto de entrada**: una VM sin
IP pública sirve, pero **Tailscale es obligatorio y es el único camino**.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --hostname=<el-nombre-que-ira-en-OTRAS_SEDES>
tailscale ip -4                      # tiene que devolver una 100.x
```

> **El nombre de Tailscale es el que manda, no el `hostname` de la VM.** Ver 1.4.

## 1.2 · El usuario `sepadmin`

`sepadmin` está escrito a fuego en 18 líneas de 8 guiones y en los seis servicios de
systemd. **Se crea el usuario en la VM; no se editan los guiones** — es un cambio en
una máquina contra un cambio en `comun.sh`, `autopromover.sh`, `promover.sh`,
`rendirse.sh`, `autorendirse.sh`, `seguir-al-principal.sh`, `arrancar-tunel.sh` y
`estado.sh`.

```bash
sudo useradd -m -s /bin/bash sepadmin
sudo usermod -aG docker sepadmin          # todos los guiones llaman a docker compose
sudo install -d -o sepadmin -g sepadmin -m 700 /home/sepadmin/.ssh
# las públicas de Bogotá y El Socorro en su authorized_keys, y la de la nube allá
```

**Las llaves van en los DOS sentidos.** Comprobar las cuatro direcciones:

```bash
ssh -o BatchMode=yes sepadmin@<nube> true          # desde Bogotá y desde El Socorro
ssh -o BatchMode=yes sepadmin@server-bogota true   # desde la nube
ssh -o BatchMode=yes sepadmin@server-socorro true  # desde la nube
```

## 1.3 · El clon, y la ruta no es negociable

`/opt/sep/reservasae` está a fuego en 11 líneas de 8 guiones, siempre dentro de un
`ssh ... 2>/dev/null`. Si el clon vive en otro sitio, esas llamadas devuelven cadena
vacía y **los guiones lo leen como «no me responde»**, no como un error. Y un enlace
simbólico no sirve: `seguir-al-principal.sh:42` hace
`git fetch "$PRINCIPAL:/opt/sep/reservasae"` y necesita el `.git` de verdad ahí.

```bash
sudo install -d -o sepadmin -g sepadmin /opt/sep
sudo -u sepadmin git clone <repo> /opt/sep/reservasae
sudo -u sepadmin git -C /opt/sep/reservasae checkout main
```

## 1.4 · Los DOS `.env`, que es donde más fácil se rompe esto

**Hay dos por sede y el de la raíz no tiene plantilla en ninguna parte** — ni en git
ni en `docs/`. `git ls-files | grep env` solo da `backend/.env.example`. Así que lo
primero es copiarse los dos de Bogotá para tenerlos de referencia:

```bash
ssh sepadmin@server-bogota 'cat /opt/sep/reservasae/.env'        # el de la raíz
ssh sepadmin@server-bogota 'cat /opt/sep/reservasae/backend/.env'
```

### El `.env` de la RAÍZ, en la nube

```
SEDE=<el nombre de Tailscale, el mismo que en OTRAS_SEDES>
OTRAS_SEDES="<nube> server-bogota server-socorro"
PREFERENCIA_PROMOCION="<nube> server-bogota server-socorro"
PRINCIPAL=sepadmin@server-bogota
PG_REPL_PASSWORD=<EL MISMO VALOR que Bogotá>
TUNEL_TOKEN=<el mismo que Bogotá: es el token del túnel convoca>
ESPERA_PROMOCION=60
```

Y lo que **NO** lleva mientras sea réplica:

| | |
|---|---|
| `PG_BIND` | sin poner. Así la base no se asoma a Tailscale todavía. `promover.sh:61-64` la escribe sola con `tailscale ip -4` al promover |
| `SEDE_ACTIVA` | **nunca a mano.** La pone `promover.sh:88` y la quita `rendirse.sh` |
| `AUTOPROMOVER` | sin poner, para que no releve a Bogotá en medio del traslado |
| `SEDE_PREFERIDA` | sin poner todavía. Al final de todo se pone, y solo aquí |
| `COMPOSE_PROFILES` | **jamás.** Ver el aviso de abajo |

> **Las comillas de `OTRAS_SEDES` no son estilo.** El `.env` no se parsea
> clave=valor: se **sourcea como bash** (`comun.sh:5-6`). Sin comillas, bash intenta
> ejecutar `server-bogota` como una orden con prefijo de asignación. Comprobarlo con
> `bash -c '. /opt/sep/reservasae/.env; echo "$OTRAS_SEDES"'`.

> **`SEDE` tiene que estar puesta, y es el defecto que más caro sale.**
> `SEDE=${SEDE:-$(hostname)}` (`arrancar-tunel.sh:8`), y el `hostname` de la VM es
> `instance-grupo-ae-col-2026`, que **no** es el nombre con el que las otras sedes la
> van a llamar. Con los dos descuadrados la sede se sonda **a sí misma**, se ve
> `SIRVE` y entra en `[ "$est" = SIRVE ] && bajar` (`arrancar-tunel.sh:34`): no
> levanta su propio túnel, y `promover.sh` —que no tiene `set -e`— imprime
> «✓ es ahora el principal» igualmente. **El dominio queda sin conector y la
> promoción se reporta exitosa.** Se comprueba así, y no con `estado.sh`, que no lo
> distingue:
>
> ```bash
> grep -E '^(SEDE|OTRAS_SEDES)=' /opt/sep/reservasae/.env
> ```

> **NO copiar el `.env` de raíz del portátil de Josse.** Trae
> `COMPOSE_PROFILES=tunel`, que es la puerta lateral que `CLAUDE.md` da por cerrada:
> con ella puesta, **cualquier** `docker compose up -d` levanta el túnel saltándose
> `arrancar-tunel.sh` y todos sus guardias. Comprobar que no esté en ninguna de las
> tres con `grep -n COMPOSE_PROFILES /opt/sep/reservasae/.env`.

### El `backend/.env`, en la nube

Se copia **entero** de Bogotá. Tres variables **tumban el arranque** si faltan o si
traen el valor de ejemplo: `ADMIN_JWT_SECRET`, `LEADS_WEBHOOK_SECRET` y
`DATABASE_URL`. Y `arrancar.sh` corre `prisma migrate deploy` **antes** de
`node dist/main.js`, así que un fallo aquí deja la base migrada y la aplicación
muerta.

Cuatro tienen que ser **las mismas de Bogotá, literales**, y por motivos distintos:

| | |
|---|---|
| `ADMIN_JWT_SECRET` | si se genera una nueva, **todas las sesiones abiertas del panel caen** al cambiar de sede |
| `LEADS_WEBHOOK_SECRET` | la manda el orquestador de Mauricio en `x-clave-leads`: una clave nueva le contesta **401** a sus leads |
| `POSTGRES_USER` / `POSTGRES_DB` | `reservasae` y `reservasae`, **no negociables**: `rendirse.sh:77` los lleva escritos a fuego |
| `POSTGRES_PASSWORD` | el mismo: el directorio de datos llega por `pg_basebackup` y trae dentro las credenciales del clúster |

Y las que no tumban el arranque pero dejan medio sistema inerte: `SMTP_*`,
`RUI_WORKER=1`, `RUI_PROVEEDOR=VENTANILLA`, `EDITORES_DE_MARCA`,
`PANEL_GENERAL_SOLO_SUPERADMIN=si`, `LUCID_WEBHOOK_SECRET`, `NUA_WEBHOOK_SECRET`,
`META_*`, `WEB_WORKER`, `CORREO_AUTOMATICO`.

**`CORREO_REDIRIGIR_A` tiene que ir VACÍA**, como en producción. Un valor copiado por
descuido deja a todos los inscritos sin sus correos sin que nadie se entere.

> **`WEB_PROVEEDOR=RUES` en la nube.** Es el que no usa navegador, ni pantalla, ni
> captcha. Lo único que el repositorio dice sobre la IP del servidor es que el
> buscador de Google puede rechazarla por reputación (`backend/.env.example:210`), y
> una IP de datacenter es justo ese caso. **Sobre bloqueo por país no dice nada ni el
> código ni ningún documento**: no se asume.

> **Chromium no se instala en la máquina**: lo trae la imagen del backend
> (`backend/Dockerfile:33-43`, por `apk`) y lo anuncia en `CHROMIUM_RUTA`. Lo que hay
> que comprobar es que `docker compose build backend` corra allí.

## 1.5 · Docker en su disco, y el orden importa

`var-lib-docker` (200 GB) está crudo, y **Docker ya está corriendo con sus datos en el
disco de arranque**. Montar encima no mueve nada: **tapa** lo que hay debajo.

```bash
sudo mkfs.ext4 -L docker /dev/disk/by-id/google-var-lib-docker
sudo systemctl stop docker docker.socket containerd
sudo mv /var/lib/docker /var/lib/docker.antes
sudo install -d /var/lib/docker
echo 'LABEL=docker /var/lib/docker ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo mount -a && sudo rsync -aHAX /var/lib/docker.antes/ /var/lib/docker/
sudo systemctl start containerd docker
docker ps -a                                  # tiene que ver lo de antes
# y solo cuando se compruebe:  sudo rm -rf /var/lib/docker.antes
```

> **`nofail` en el `fstab` no es opcional.** Sin él, un disco que no aparezca a tiempo
> deja la VM sin arrancar, y aquí no hay consola física: se entra por IAP.

> `/etc/fstab` hoy solo tiene las tres entradas de arranque. Un disco montado a mano y
> sin escribir en `fstab` desaparece en el siguiente reinicio.

**`var-lib-postgresql` no se monta.** La base de reservasae es el contenedor `db` del
compose y sus datos viven en el volumen `reservasae-pgdata`, que está dentro de
`/var/lib/docker`. Ese disco es para el PostgreSQL 18 nativo, que no participa en
esto.

## 1.6 · Crear el contenedor de la base ANTES de enganchar

`rendirse.sh` saca el volumen a reemplazar preguntándole al contenedor `db`
(`docker compose ps -aq db`) y **se muere en la línea 87 si no existe**. En un clon
recién hecho sale vacío.

```bash
cd /opt/sep/reservasae
docker compose up -d db            # crea el contenedor y el volumen
docker compose ps -aq db           # no puede salir vacío
```

## 1.7 · Enganchar la réplica

**No existe guion para añadir una réplica.** El único `pg_basebackup` del repositorio
está dentro de `rendirse.sh:95-96`, así que la forma de enganchar la nube es rendirse
a Bogotá *mientras Bogotá sigue siendo el principal*. Bogotá no se entera y sigue
sirviendo.

```bash
cd /opt/sep/reservasae
scripts/rendirse.sh server-bogota
```

> **Desde una terminal, nunca desde un temporizador.** Si el `pg_dump` de respaldo
> sale vacío —y en la primera corrida sobre una base recién creada lo estará—
> `rendirse.sh:66` borra el archivo y **pide confirmación por stdin**.
> `autorendirse.sh:34` lo llama con `< /dev/null`, que en automático es un
> «cancelado». **No instalar `autorendirse.timer` en la nube hasta que ya replique.**

> `rendirse.sh` lo primero que hace es leer `PG_REPL_PASSWORD` del `.env` **del
> destino** por ssh (`rendirse.sh:21`) y aborta si no está. Por eso 1.4 va antes.

**La versión mayor tiene que coincidir.** La pila es `postgres:17-alpine`
(`docker-compose.yml:29`) y `rendirse.sh` hace la copia base con esa misma imagen. El
PostgreSQL **18** nativo de la VM no participa: se queda en el 5432 y el del proyecto
publica en el 5433. La replicación física no cruza versiones mayores.

## 1.8 · Construir las imágenes antes del cambio

`promover.sh:72` hace `docker compose up -d --build` **dentro de la ventana de
corte**. Con las capas en caché eso son segundos; sin caché son los cuatro minutos de
un build completo.

```bash
scripts/seguir-al-principal.sh      # a mano la primera vez
sudo systemctl enable --now seguir-al-principal.timer
```

**Marcha atrás de la fase 1:** apagar la pila de la nube (`docker compose down`) y
olvidarla. Bogotá y El Socorro no se han tocado: siguen exactamente como estaban.

---

# FASE 2 · Comprobar, antes de tocar el dominio

```bash
scripts/estado.sh
```

Sano es: **un solo PRINCIPAL** (Bogotá), **un solo TUNEL en SI** (Bogotá), las tres en
la **línea 17**, y la nube y El Socorro con el LSN del principal y `ENLACE` en
`streaming`.

```bash
# en la nube: tiene que rechazar una escritura
docker compose exec -T db psql -U reservasae -d reservasae \
  -c 'CREATE TABLE prueba_de_replica (x int);'
#   -> cannot execute CREATE TABLE in a read-only transaction
```

```bash
# en Bogotá: tiene que haber DOS ranuras ahora
docker compose exec -T db psql -U reservasae -d reservasae -c \
  'SELECT slot_name, active, wal_status FROM pg_replication_slots ORDER BY 1;'
```

Y el ensayo del failover, que recorre todos los guardias y **se para justo antes de
promover**:

```bash
SIMULAR=si scripts/autopromover.sh
```

---

# FASE 3 · El cambio de principal. Aquí está la única ventana

**El orden es obligado y no se puede invertir**, porque `arrancar-tunel.sh:34` se
niega a levantar el túnel mientras otra sede siga atendiendo. La nube no puede
empezar a servir hasta que Bogotá deje de hacerlo.

Y por el mismo motivo **no se usa `FORZAR=si`**: el guardia de `promover.sh:34` se
cumple solo retirando la aplicación de Bogotá primero.

```bash
# 1 · EN BOGOTÁ: soltar el tráfico y la aplicación, DEJANDO la base en pie
cd /opt/sep/reservasae
docker compose --profile tunel rm -sf cloudflared
docker compose rm -sf backend frontend nginx
sed -i '/^SEDE_ACTIVA=/d' .env

# 2 · EN LA NUBE: promover, y llamar al túnel a mano en vez de esperar el minuto
cd /opt/sep/reservasae
scripts/promover.sh
scripts/arrancar-tunel.sh
```

**El dominio deja de atender solo el hueco entre el paso 1 y el paso 2.** Hecho a mano
y seguido son segundos; esperando el temporizador de `arrancar-tunel.timer` serían
hasta un minuto más.

> **Lo que NO se puede hacer para evitar el corte:** levantar el túnel en la nube
> antes de bajar el de Bogotá. Dos conectores del mismo túnel reparten el tráfico
> entre dos bases que ya divergen, y eso ya pasó una vez: la mitad de las visitas
> veían datos de la otra base sin que nada fallara.

**Comprobar en el acto:**

```bash
curl -s https://reservasae.com/api/estado          # versión, y que responda
scripts/estado.sh                                  # un PRINCIPAL, un TUNEL, línea 18
```

**Marcha atrás de la fase 3**, si la nube no levanta: volver a Bogotá, poner
`SEDE_ACTIVA=si` en su `.env` y `scripts/arrancar-tunel.sh`. Su base **no se ha
tocado** y sigue en la línea 17; lo que hay que deshacer es la promoción de la nube,
con `scripts/rendirse.sh server-bogota` allí. Mientras Bogotá no haya pasado por
`rendirse.sh`, esta marcha atrás es barata.

---

# FASE 4 · Bogotá y El Socorro siguen a la nube

```bash
# en Bogotá y en El Socorro, en ese orden y una por una
cd /opt/sep/reservasae
scripts/rendirse.sh <nube>
```

`rendirse.sh` guarda un `pg_dump` de lo que había antes de reemplazar el volumen —y en
Bogotá eso **sí** tiene datos: es la sede que pudo tener escrituras que nadie más vio,
porque la replicación es asíncrona. **No borrar ese dump.**

Después, en las dos:

```
PRINCIPAL=sepadmin@<nube>
OTRAS_SEDES="<nube> server-bogota server-socorro"
PREFERENCIA_PROMOCION="<nube> server-bogota server-socorro"
```

> `PRINCIPAL` cae a `sepadmin@server-bogota` por defecto en **tres** guiones
> (`autopromover.sh:9`, `promover.sh:9`, `seguir-al-principal.sh:13`). Una réplica sin
> esa variable le pide el commit marcado a Bogotá —que ya es réplica y cuya marca
> borró `rendirse.sh`—, así que el despliegue se queda detenido en silencio.
> `rendirse.sh:106` la escribe al rendirse, pero conviene comprobarla.

---

# FASE 5 · El PC Dell sale

Es lo más barato de todo: **ya no tiene ranura de replicación**, así que no hay nada
que desenchufar de la base.

1. En las tres sedes, `OTRAS_SEDES` y `PREFERENCIA_PROMOCION` **ya no lo nombran**
   (fase 4). Eso es lo único que hace falta: sin esas variables los guiones usan la
   lista escrita a fuego de `comun.sh:104`, que **sí lo incluye**.
2. En el PC Dell, si alguna vez vuelve a contestar: `systemctl disable --now` de sus
   seis temporizadores y quitar `AUTOPROMOVER` de su `.env`.
3. Sacarlo de la tailnet cuando se decida que no vuelve.

> **El quórum cambia y hay que saberlo.** Con tres sedes, ante un principal
> `INALCANZABLE` se pedía una tercera opinión. Con **dos** réplicas vivas ese quórum
> no existe: `CLAUDE.md` ya lo dice —«con dos sedes vivas el failover no puede
> actuar»— y la salida es `promover.sh` a mano. Sacar el PC Dell lo hace permanente.
> Si se quiere conservar el failover automático, hace falta una tercera sede.

---

# FASE 6 · Rearmar los automatismos, con la topología nueva

Esto va **al final**, y solo cuando `estado.sh` salga sano.

| Dónde | Qué |
|---|---|
| la nube | `AUTOPROMOVER` **sin poner** (es el principal, no promueve), `SEDE_PREFERIDA=<nube>`, y `recuperar-mando.timer` instalado: es lo que le devuelve el mando cuando vuelva de una caída |
| Bogotá y El Socorro | `AUTOPROMOVER=si`, `autopromover.timer` y `autorendirse.timer` encendidos, **`SEDE_PREFERIDA` fuera** |
| la nube | `autorendirse.timer` encendido solo ahora |

```bash
systemctl is-enabled arrancar-tunel.timer asegurar-base.timer \
  autopromover.timer autorendirse.timer seguir-al-principal.timer
```

---

# Lo que queda abierto, y es decisión

**La VM no tiene IP pública, así que Tailscale pasa a ser el único camino de
entrada.** Por ahí van las réplicas a buscar el WAL y por ahí preguntan las sondas del
failover. Si Tailscale se cae en esa máquina queda un principal sirviendo y dos
réplicas que no pueden seguirlo, y no se enteran de inmediato. Se puede mitigar con
una IP pública y el firewall cerrado salvo a las dos sedes, pero es una decisión.

**`prueba.reservasae.com` se queda en Bogotá.** Tiene su propio túnel
(`convoca-prueba`) y su propia pila, y nada de esto lo toca. Pero si Bogotá deja de
ser principal, el entorno de pruebas sigue viviendo solo allí: no gana nada en
disponibilidad.

**El ingress del túnel `convoca` vive en el panel de Cloudflare**, no en un archivo:
corre con `--token`. No hay que tocarlo para esta migración —el token es el mismo y el
destino es `nginx:80` dentro de la red del compose—, pero conviene saber dónde está.
