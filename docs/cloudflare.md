# Publicar reservasae.com con Cloudflare Tunnel

Guía completa: pasar el dominio de Squarespace a Cloudflare, enrutarlo al túnel
que ya corre en este servidor y dejar HTTPS funcionando.

**Datos del entorno**

| Dato | Valor |
|---|---|
| Túnel existente | `89a5adcb-ffba-4ee6-9399-3310f040f68b` |
| Config del túnel | `/etc/cloudflared/config.yml` |
| Puerto local de la app | `127.0.0.1:4600` |
| Dominio | `reservasae.com` (comprado en Squarespace) |

> **No se instala ningún certificado en el servidor.** El túnel sale hacia
> Cloudflare por conexión saliente y Cloudflare emite el certificado público.
> No hay que abrir puertos ni renovar nada a mano.

---

## Fase 1 — Añadir el dominio a Cloudflare

1. Entra a <https://dash.cloudflare.com> con tu cuenta (la misma donde ya está
   `ggpcsena.com`). Es importante que sea **la misma cuenta**: un túnel solo
   puede enrutar zonas de su propia cuenta.
2. **Add a domain** → escribe `reservasae.com` → selecciona el plan **Free** →
   *Continue*.
3. Cloudflare escanea el DNS actual. Va a encontrar los registros `A` de
   Squarespace (`198.185.159.144`, `198.185.159.145`, `198.49.23.144`,
   `198.49.23.145`). **Bórralos**: apuntan al parking de Squarespace y no
   sirven para nada.
   - Si tienes correo en ese dominio, conserva los registros `MX` y `TXT`.
     Si no lo tienes, no hay nada que conservar.
4. Cloudflare te muestra **dos nameservers** propios, con forma
   `algo.ns.cloudflare.com`. Cópialos, los necesitas en la fase 2.

## Fase 2 — Cambiar los nameservers en Squarespace

5. Entra a Squarespace → **Settings › Domains › reservasae.com**.
6. Busca **DNS** → **Nameservers** → cambia de *Squarespace nameservers* a
   **Use custom nameservers**.
7. Borra los cuatro `nsaX.squarespacedns.com` y pega los **dos** de Cloudflare.
8. Guarda.

Verifica desde el servidor cada tanto:

```bash
dig +short NS reservasae.com
```

Cuando responda `...ns.cloudflare.com` en vez de `squarespacedns.com`, listo.
Tarda entre 10 minutos y 24 horas; Cloudflare te manda un correo cuando la
zona queda **Active**.

> No sigas a la fase 3 hasta que la zona aparezca **Active** en el panel.

## Fase 3 — Autorizar el túnel para la zona nueva

El archivo `~/.cloudflared/cert.pem` de este servidor se generó cuando se
autorizó `ggpcsena.com`. Si quedó limitado a esa zona, no podrá crear registros
en `reservasae.com` y el comando de la fase siguiente dará un error de
autorización. Para evitarlo se vuelve a autenticar:

```bash
# Respaldo antes de sobrescribir: este archivo es el que autoriza al servidor
# a administrar DNS de tus zonas.
cp ~/.cloudflared/cert.pem ~/.cloudflared/cert.pem.bak

cloudflared tunnel login
```

Imprime una URL. Ábrela en tu navegador, inicia sesión y **selecciona
`reservasae.com`** en la lista de zonas. Eso regenera `cert.pem`.

Ahora crea los registros DNS. **No los crees a mano en el panel**: este comando
genera el `CNAME` correcto apuntando al túnel.

```bash
cloudflared tunnel route dns 89a5adcb-ffba-4ee6-9399-3310f040f68b reservasae.com
cloudflared tunnel route dns 89a5adcb-ffba-4ee6-9399-3310f040f68b www.reservasae.com
```

En el panel de Cloudflare deben aparecer dos registros `CNAME` con la nube
naranja activada (*Proxied*), apuntando a
`89a5adcb-ffba-4ee6-9399-3310f040f68b.cfargotunnel.com`.

## Fase 4 — Enrutar el hostname dentro del túnel

Edita la configuración del túnel:

```bash
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak
sudo nano /etc/cloudflared/config.yml
```

Añade los dos bloques nuevos **antes** de la última línea
(`- service: http_status:404`). El orden importa: cloudflared usa la primera
regla que coincide, y esa última línea captura todo.

```yaml
tunnel: 89a5adcb-ffba-4ee6-9399-3310f040f68b
credentials-file: /etc/cloudflared/89a5adcb-ffba-4ee6-9399-3310f040f68b.json
protocol: http2
ingress:
  - hostname: sep.ggpcsena.com
    service: http://localhost:8080
  - hostname: ssh.ggpcsena.com
    service: ssh://localhost:22
  - hostname: sepdb.ggpcsena.com
    service: tcp://localhost:1521

  # ── reservasae (Convoca) ──
  - hostname: reservasae.com
    service: http://localhost:4600
  - hostname: www.reservasae.com
    service: http://localhost:4600

  - hostname: ggpcsena.com
    service: http://localhost:4500
  - hostname: www.ggpcsena.com
    service: http://localhost:4500
  - service: http_status:404
```

Valida antes de aplicar (si hay un error de sintaxis, el reinicio dejaría
**todos** los sitios caídos):

```bash
sudo cloudflared tunnel ingress validate
```

Debe decir `OK`. Entonces:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager
```

> ⚠️ El reinicio corta **ggpcsena.com y sep.ggpcsena.com** unos 2–5 segundos.
> Hazlo en horario de bajo tráfico.

## Fase 5 — Certificados y HTTPS

Cloudflare emite el certificado solo. En el panel, con `reservasae.com`
seleccionado:

1. **SSL/TLS › Overview** → modo de cifrado: **Full (strict)**.
   Funciona con túnel porque cloudflared presenta un certificado válido al
   borde de Cloudflare. No uses *Flexible*.
2. **SSL/TLS › Edge Certificates** → verifica que **Universal SSL** esté
   *Active*. Cubre `reservasae.com` y `*.reservasae.com`. Puede tardar hasta
   24 h desde que la zona quedó activa; mientras tanto verás error 526 o un
   aviso de certificado.
3. En la misma pantalla activa:
   - **Always Use HTTPS**: `On` — redirige `http://` a `https://`.
   - **Automatic HTTPS Rewrites**: `On`.
   - **Minimum TLS Version**: `TLS 1.2`.

### Verificación final

```bash
# Desde el servidor
curl -s http://127.0.0.1:4600/health          # -> OK  (la app local responde)

# Desde cualquier parte
curl -I https://reservasae.com                # -> HTTP/2 200
curl -s https://reservasae.com/api/estado     # -> {"servicio":"reservasae-backend",...}
```

Y abre <https://reservasae.com> en el navegador: la tarjeta "Conexión con el
backend" debe salir en verde.

---

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| Error **1016** | El `CNAME` al túnel no existe | Repite `cloudflared tunnel route dns` |
| Error **502/504** | La app no responde en `4600` | `docker compose ps` y `docker compose logs nginx` |
| Error **526** | Universal SSL todavía no emitido | Espera; confirma modo *Full (strict)* |
| **404** de Cloudflare | Falta el `hostname` en el ingress, o quedó después del `http_status:404` | Revisa el orden en `config.yml` |
| `failed to find zone` al enrutar DNS | `cert.pem` no cubre la zona nueva | Repite la fase 3 (`cloudflared tunnel login`) |
