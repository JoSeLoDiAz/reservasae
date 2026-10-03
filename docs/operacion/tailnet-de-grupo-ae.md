# Pasar los tres servidores a la tailnet de Grupo AE

> ## NO SE HIZO, Y LA DECISIÓN FUE MEJOR — 3 oct 2026
>
> Josse creó la tailnet `grupo-ae.com.co` y, al ver lo que costaba mover los tres
> servidores, **lo dio la vuelta**: dejó las máquinas donde están e **invitó a
> `proyectos@grupo-ae.com.co` a la tailnet que ya existe**, como Admin. Textual:
> *«tocó dejarlo así y más bien invitar»*.
>
> **Y eso ahorra la parte peligrosa entera.** Las IP `100.x` no cambian, así que
> no hay `PG_BIND` rancia, no hay que reescribir los dos `primary_conninfo`, no
> hay ventana sin replicación y no hay riesgo de dejar a El Socorro colgado entre
> dos tailnets. Comprobado después: las tres sedes siguen en la línea 18, el mismo
> LSN, `streaming`, y el dominio sirviendo.
>
> **Lo que la decisión deja a cambio, y conviene tenerlo escrito:**
>
> - **El Owner de la red privada es una cuenta personal**, `josediazd40z@gmail.com`,
>   desde el 14 ago 2026. `proyectos@grupo-ae.com.co` entró como **Admin**, que no
>   es lo mismo: si esa cuenta de Gmail se pierde o se cierra, la tailnet donde
>   viven las bases de producción se va con ella. Tailscale deja **transferir la
>   propiedad**; es el paso que falta y no se arregla solo.
> - **Queda una tailnet `grupo-ae.com.co` vacía**, creada ese día y con un ensayo
>   de 14 días. O se borra o se deja caducar, pero conviene decidirlo: dos tailnets
>   con nombres parecidos es como alguien acaba conectando un servidor al sitio
>   equivocado.
> - **Y la caducidad de llave de nodo pasa a importar.** El motivo para dejarla era
>   «primero va la tailnet nueva», y ese motivo desapareció. Sigue armada para el
>   **10 feb 2027** en las tres: cuando caduca, el nodo sale de la red, **la
>   replicación y las sondas se cortan y el sitio sigue sirviendo**, así que nadie
>   se entera. Se apaga en **Machines → cada servidor → Disable key expiry**.
>
> **Lo de abajo se conserva** por si algún día se retoma el traslado de verdad. No
> se ejecute sin leer la sección de la mina: hay dos sitios con la IP escrita a
> fuego y uno de ellos no se corrige solo.

Hoy las máquinas viven en una tailnet **personal**: los nodos salen como
`josediazd40z@` y el dominio es `tailab261a.ts.net`. La decisión de Josse (3 oct
2026) es crear una de **Grupo AE** y pasar **solo los tres servidores** —
`crm-nube`, `server-bogota` y `server-socorro` —; los equipos personales se quedan
donde están. Y él tiene que poder seguir entrando desde `josediazd40z@`.

> **Esto NO tumba el sitio.** El túnel de Cloudflare sale de la nube hacia fuera y
> no pasa por Tailscale, y nginx, el frontend, el backend y la base están todos
> dentro del mismo Docker. `reservasae.com` sigue sirviendo todo el rato. Lo que
> se corta es la **replicación** y las **sondas del failover**, unos minutos.

## La mina, y es la razón de que esto sea un procedimiento y no tres comandos

**Cada nodo recibe una IP `100.x` NUEVA**, y hay dos sitios donde la vieja está
escrita a fuego:

| Dónde | Qué pasa si no se toca |
|---|---|
| `PG_BIND` en el `.env` de la nube | el contenedor `db` muere con `cannot assign requested address` — es lo que dejó a Bogotá sin base el 18 ago 2026 |
| `primary_conninfo` de cada réplica | la puso `pg_basebackup -R` al engancharla. Hoy dice `host=100.122.176.9`. Las réplicas reintentan una dirección que ya no existe, **para siempre y sin avisar** |

Y `promover.sh:61` escribe `PG_BIND` **solo si falta**, así que un valor rancio no
se corrige solo. Hay que borrarlo a mano.

> **Y los puertos se fijan al CREAR el contenedor.** Cambiar `PG_BIND` no basta:
> hay que **recrear** `db` (`up -d --force-recreate db`), porque un `restart`
> conserva la publicación vieja.

## Por dónde se llega a cada máquina mientras no hay Tailscale

Esto decide el orden, y conviene tenerlo claro antes de empezar:

| Máquina | Camino que NO depende de Tailscale |
|---|---|
| `server-bogota` | **la LAN**: `192.168.100.10` (es lo que ya usa `~/.ssh/config`) |
| `crm-nube` | **el túnel IAP**: `gcloud compute start-iap-tunnel` |
| `server-socorro` | **ninguno** — solo se llega por Tailscale |

**Por eso El Socorro se cambia con una orden que no necesita que la sesión
sobreviva.** Si el `ssh` se cae a mitad entre el `logout` y el `up`, esa máquina
queda fuera de las dos tailnets y hay que ir físicamente.

---

# Paso 1 · Crear la tailnet (lo hace Josse)

1. Sesión **cerrada** de Tailscale en el navegador (o una ventana de incógnito).
2. `login.tailscale.com` → entrar con **`proyectos@grupo-ae.com.co`**.
3. Tailscale crea la tailnet atada al dominio `grupo-ae.com.co`.

# Paso 2 · Invitar a `josediazd40z@`

En la tailnet nueva: **Users → Invite external users** → `josediazd40z@gmail.com`.
Le llega un correo, lo acepta, y a partir de ahí **sus dispositivos y su sesión
entran en la tailnet de la empresa**.

> **Comprueba el plan antes.** El gratuito de Tailscale limita el número de
> **usuarios** (no de máquinas), y aquí ya van dos: `proyectos@` y
> `josediazd40z@`. Si después hay que meter a Camilo, Mauricio o Andrés, mira
> cuántos caben antes de prometerlo.

# Paso 3 · Una auth key REUSABLE

**Settings → Keys → Generate auth key**, y esta vez **sí reusable**: son tres
máquinas y una sola llave las cubre.

| | |
|---|---|
| Reusable | **sí** (la vez anterior fue de un solo uso, para una máquina) |
| Ephemeral | **no** — si lo fuera, el nodo desaparece al reiniciar y la replicación se queda sin destino |
| Pre-approved | sí |

# Paso 4 · Desarmar antes de tocar

Durante el cambio las sedes dejan de ver al principal. Con `AUTOPROMOVER=si`
puesto, una podría promoverse en mitad del traslado.

```bash
# en Bogotá y en El Socorro
cd /opt/sep/reservasae && sed -i '/^AUTOPROMOVER=/d' .env
```

Y **abrir el túnel IAP a la nube antes de empezar**, que es su única cuerda:

```powershell
gcloud compute start-iap-tunnel instance-grupo-ae-col-2026 22 `
  --local-host-port=localhost:2223 --zone=us-east4-b --project=proyecto-grupo-ae-col-2026
```

# Paso 5 · Mover los tres, y EL SOCORRO PRIMERO

Se mueve primero el que no tiene camino alternativo, mientras todavía se llega a
él. Y la orden va **atómica y desprendida de la sesión**, para que termine aunque
el `ssh` se corte:

```bash
# EL SOCORRO, desde Bogotá mientras aún lo ve
ssh sepadmin@server-socorro \
  "sudo systemd-run --no-block --unit=cambio-tailnet sh -c \
   'tailscale logout; tailscale up --auth-key=file:/tmp/ts.key --hostname=server-socorro'"
```

> La llave se deja antes en `/tmp/ts.key` de esa máquina, con `chmod 400` y de
> `root`: pasarla en la línea de órdenes la deja a la vista de cualquiera en un
> `ps`, y en estas máquinas hay más usuarios.

Después, en cualquier orden:

```bash
# BOGOTÁ, por la LAN (no se pierde el acceso)
sudo tailscale logout && sudo tailscale up --auth-key=file:/tmp/ts.key --hostname=server-bogota

# LA NUBE, por el túnel IAP
sudo tailscale logout && sudo tailscale up --auth-key=file:/tmp/ts.key --hostname=crm-nube
```

**Los `--hostname` tienen que ser EXACTAMENTE esos tres.** Es lo que llevan
`SEDE` y `OTRAS_SEDES` en los `.env`, y si no coinciden la sede se sonda a sí
misma, no levanta su túnel y `promover.sh` dice «✓ es ahora el principal» igual.

# Paso 6 · Arreglar las IP, que es donde esto se rompe

**En la nube:**

```bash
tailscale ip -4                                   # la NUEVA, apuntarla
cd /opt/sep/reservasae
sed -i '/^PG_BIND=/d' .env
echo "PG_BIND=<la nueva 100.x>" >> .env
docker compose up -d --force-recreate db          # RECREAR, no reiniciar
docker ps --filter name=reservasae_db --format '{{.Ports}}'   # tiene que decir la nueva
```

**En las dos réplicas**, lo más simple es rehacer el enganche: son 143 MB y
`rendirse.sh` reescribe `primary_conninfo` con la dirección buena.

```bash
cd /opt/sep/reservasae && scripts/rendirse.sh crm-nube
```

> Se podría arreglar sin copiar nada —`ALTER SYSTEM SET primary_conninfo` y
> `pg_reload_conf()`— pero `rendirse.sh` es el camino que el proyecto ya tiene
> probado, guarda un `pg_dump` antes y deja la ranura limpia. Con 143 MB no
> compensa inventar un atajo.

# Paso 7 · Comprobar, y solo entonces rearmar

```bash
scripts/estado.sh
```

Sano es: **un solo PRINCIPAL** (`crm-nube`), **un solo TUNEL en SI**, las tres en
la **misma línea**, las réplicas con el LSN del principal y `ENLACE` en
`streaming`. Y los cuatro `ssh` entre las tres, en los dos sentidos.

Solo cuando eso salga limpio:

```bash
# en Bogotá y en El Socorro
cd /opt/sep/reservasae && echo 'AUTOPROMOVER=si' >> .env
```

# Paso 8 · Cerrar la vieja

Cuando las tres estén en la nueva y `estado.sh` salga sano, en la tailnet
personal: **Machines** → quitar `server-bogota`, `server-socorro`, `crm-nube` y
`server-pc-dell`.

---

## Lo que NO hay que olvidar, porque no avisa

- **La caducidad de llave de nodo vuelve a empezar.** Los nodos nuevos la tienen
  otra vez, y cuando caduca el nodo sale de la red: la replicación y las sondas se
  cortan y **el sitio sigue sirviendo**, así que nadie se entera. En la tailnet
  nueva: **Machines → cada servidor → Disable key expiry**. Esta vez sí conviene,
  porque ya no hay otra migración por delante que lo haga irrelevante.
- **Los `authorized_keys` no se tocan**: van por llave, no por dirección. Lo único
  que viaja por IP es `PG_BIND` y `primary_conninfo`.
- **El dominio `.ts.net` cambia** y da igual: nada del proyecto usa el nombre
  largo, solo los cortos.
