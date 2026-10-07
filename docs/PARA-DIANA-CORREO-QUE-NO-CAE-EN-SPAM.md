# Que el correo deje de caer en spam · paso a paso

Diana: son **tres registros** y se hacen una sola vez. Cuando estén, los correos del CRM y los
del campus dejan de irse a la carpeta de no deseados.

Hoy el dominio `grupo-ae.com.co` **no tiene ninguno de los tres** —comprobado el 6 de octubre
contra los servidores de Google—, y por eso Gmail y Outlook desconfían de todo lo que sale con
ese remitente.

> **Antes de empezar, una pregunta para Ronald.** Hay que saber **por dónde sale el correo de
> `campusadecopria.com`**: si lo manda el servidor del campus por su cuenta o si lo manda por la
> cuenta de Google. Si fuera lo primero, el paso 2 de abajo tiene una línea de más, y publicarlo
> sin preguntarle **empeoraría** su correo en vez de arreglarlo. Es una frase: *«¿el correo del
> campus sale por el SMTP de Google Workspace o directo desde el servidor?»*.

---

## Dónde se hace cada cosa

Son **dos sitios distintos** y conviene tenerlo claro desde el principio:

| | |
|---|---|
| **La consola de Workspace** · `admin.google.com` | solo para **generar** la clave DKIM y activarla |
| **El panel de Arsys** · `arsys.net` | aquí se **publican** los tres registros |

**El dominio está en ARSYS, no en Cloudflare.** Si buscas «servidoresdns.net» el navegador te
manda a Arsys y parece un error: no lo es. `dns17.servidoresdns.net` es solo el **nombre** de
los servidores de Arsys, no una página donde se entre. El panel es el suyo.

Hace falta el usuario y la contraseña del **Área de clientes de Arsys**, que son los de quien
compró el dominio. Si no los tienes, pídeselos a Josse antes de empezar.

---

## Paso 1 · Llegar al editor de la zona DNS

1. Entra en **arsys.net** → arriba a la derecha, **Área de clientes**
2. **Panel de Control** → **Dominios** (o «Mis productos» → Dominios)
3. Clic en **`grupo-ae.com.co`**
4. Busca **DNS** / **Gestión DNS** / **Editar zona DNS**

> Arsys suele ofrecer **«DNS básico»** y **«DNS avanzado»**. Para añadir registros TXT hace
> falta el **avanzado**. Si solo ves el básico, ahí mismo hay un enlace para cambiar.

---

## Paso 2 · Crear el SPF — «quién puede mandar correo con nuestro nombre»

| | |
|---|---|
| Tipo | **TXT** |
| Nombre / Host | **`@`** |
| Valor | `v=spf1 include:_spf.google.com ~all` |
| TTL | el que traiga por defecto |

**Hoy no hay ningún TXT en el raíz**, así que este se crea limpio y no pisa nada. Lo
comprobamos antes de escribir esto.

**Y nunca dos SPF.** Si algún día hay que añadir otro servidor que mande correo, va dentro del
**mismo** registro con otro `include:`, nunca creando un segundo: dos registros SPF se anulan
entre sí y el dominio queda peor que sin ninguno.

Si Ronald responde que el campus manda por su cuenta, el valor sería:

```
v=spf1 include:_spf.google.com ip4:LA.IP.DEL.CAMPUS ~all
```

> Si el panel de Arsys no acepta `@` en el campo del nombre, déjalo **vacío** o escribe el
> dominio completo con punto final: `grupo-ae.com.co.`. Las tres formas significan lo mismo.

---

## Paso 3 · Generar la clave DKIM — el único paso en Workspace

1. Entra en **admin.google.com** con tu cuenta de administrador
2. Menú de la izquierda: **Aplicaciones → Google Workspace → Gmail**
3. Abajo del todo: **Autenticar correo electrónico**
4. Elige el dominio **`grupo-ae.com.co`**
5. Pulsa **Generar nuevo registro**. Si pregunta:
   - **Longitud de la clave: 2048 bits**
   - **Prefijo del selector: `google`** (déjalo como viene)
6. Te muestra dos cosas. **Cópialas**:
   - un **nombre de host**: `google._domainkey`
   - un **valor** muy largo que empieza por `v=DKIM1; k=rsa; p=…`

**No cierres esa pestaña.** Hace falta volver a ella en el paso 5.

---

## Paso 4 · Publicar la clave — de vuelta en Arsys

| | |
|---|---|
| Tipo | **TXT** |
| Nombre / Host | **`google._domainkey`** |
| Valor | el texto largo que copiaste, **entero** |

> **Si el campo no admite un valor tan largo** —a Arsys le pasa a veces—, hay que partirlo en
> trozos de 255 caracteres, cada uno entre comillas y separados por un espacio, así:
> `"v=DKIM1; k=rsa; p=MIIBIj…primer trozo" "…segundo trozo"`. **Se parte en cualquier punto, no
> hay que buscar un sitio concreto**, y el resultado es idéntico para quien lo lee. Si no te
> deja ni así, haz una captura y me la mandas.

---

## Paso 5 · Activar — vuelta a Workspace

Espera **una hora**. Vuelve a `admin.google.com` → Gmail → **Autenticar correo electrónico** y
pulsa **Iniciar autenticación**.

**Este es el paso que se olvida**, y sin él la clave está publicada pero Google **no firma
nada**. Si te dice que no encuentra el registro, es que el DNS aún no se ha propagado: espera y
vuelve a intentarlo. Puede tardar hasta 48 horas, aunque normalmente es menos de una.

---

## Paso 6 · Crear el DMARC — en Arsys

| | |
|---|---|
| Tipo | **TXT** |
| Nombre / Host | **`_dmarc`** |
| Valor | `v=DMARC1; p=none; rua=mailto:proyectosena@grupo-ae.com.co` |

**Fíjate en `p=none`, y no lo cambies todavía.** Significa «solo observa y avísame», y es a
propósito: si se pusiera `p=reject` de entrada con SPF o DKIM mal puestos, el correo bueno
empezaría a desaparecer **sin que nadie reciba un aviso de error**. Dentro de unas semanas, con
los informes en la mano y todo saliendo bien, se puede subir a `p=quarantine`.

A ese buzón empezarán a llegar informes automáticos en XML. Son feos y no hay que leerlos uno a
uno; solo sirven para confirmar que no quedó nada fuera.

---

## Paso 7 · Comprobar que quedó

Al día siguiente, en <https://mxtoolbox.com>:

- `grupo-ae.com.co` en **SPF Record Lookup** → debe aparecer el `v=spf1`
- `google._domainkey.grupo-ae.com.co` en **DKIM Lookup** → debe aparecer el `v=DKIM1`
- `grupo-ae.com.co` en **DMARC Lookup** → debe aparecer el `v=DMARC1`

**Y la prueba de verdad**, que es la que importa: manda un correo desde el CRM a un Gmail
cualquiera. Ábrelo, dale a los tres puntitos → **Mostrar original**. Arriba tiene que decir:

```
SPF:   PASS
DKIM:  PASS
DMARC: PASS
```

Si los tres dicen PASS, está hecho.

---

## Lo que NO arregla esto, para que no haya sorpresas

- **No recupera lo ya enviado.** Lo que está en la carpeta de spam de alguien sigue ahí.
- **La reputación tarda unos días en subir.** No esperes que se note en la hora siguiente:
  Gmail aprende poco a poco.
- **Y no tapa un correo que de verdad parezca spam.** Ayuda muchísimo, pero el asunto y el
  contenido siguen contando.

---

Si el panel de Arsys no deja hacer algo de lo de arriba, mándame una captura y lo vemos — casi
siempre es una limitación del formulario y tiene truco.
