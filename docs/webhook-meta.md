# Leads de Meta (Facebook e Instagram)

> Para José, o para quien conecte esto. Qué está hecho, qué falta, y
> las tres cosas que si se cambian sin saber, dejan de llegar los
> leads que se están pagando.

## ⚠️ Lo primero: falta aplicar una migración

**La tabla `leads_entrantes` no existe en la base de pruebas.** La
migración que la crea está escrita y commiteada, pero sin aplicar:

```
prisma/migrations/20260828090000_mesa_de_entrada_de_leads
```

Quedó descolgada: las tres migraciones posteriores
(`20260828120000`, `20260828140000`, `20260828180000`) **sí** se
aplicaron, así que `prisma migrate dev` querría reiniciar la base
entera. **No la reinicies.** La forma correcta es:

```bash
pnpm exec prisma migrate deploy
```

que aplica solo la pendiente y no toca nada más.

**Por qué no la aplicó Claude:** en el equipo de Mauricio la
`DATABASE_URL` apunta a `localhost:5433`, y `db:guardia` clasifica ese
puerto como producción sin excepciones. Se comprobó que ahí lo que hay
es su PostgreSQL local (`PostgresPortable`, seis días levantado, sin
ningún proceso `ssh`), o sea que es un **falso positivo de la guardia
en ese equipo concreto** — pero el candado existe justo porque esa
deducción falló una vez, así que se respetó.

La salida limpia y permanente es que Mauricio mueva su Postgres local
al 5434 y apunte ahí `DATABASE_URL`; entonces la guardia vuelve a
decir la verdad y esto deja de estorbar.

**Hasta que se aplique**, todo lo demás funciona: los avisos de Meta
entran, se validan y se leen bien; solo que no hay dónde guardarlos.
La pantalla de Configuración lo dice con esas palabras, y la prueba de
«mandar un lead de mentira» contesta *«el aviso llegó entero; lo que
falta es la tabla»* en vez de un «0 guardados» que mandaría a buscar
el fallo donde no está.

---

## Qué es

Los leads que se pagan en Facebook e Instagram entran solos al CRM, en
vez de que alguien los baje de Meta a un Excel y los suba a mano.

Hay **dos puertas distintas**, y se autentican distinto a propósito:

| Ruta | Quién llama | Con qué se autentica |
|---|---|---|
| `POST /webhooks/leads` | Nuestro orquestador | `LEADS_WEBHOOK_SECRET` en una cabecera |
| `GET  /webhooks/leads/meta` | Meta, para encender el webhook | El `META_VERIFY_TOKEN_<GREMIO>` del subdominio |
| `POST /webhooks/leads/meta` | Meta, con cada lead | Su propia firma HMAC |

Juntarlas sería tener una ruta que acepta dos autenticaciones, y una
de las dos siempre sobra: quien tenga la más débil entra por ahí.

## Las tres cosas que no se pueden tocar sin saber

**1. La firma se calcula sobre el cuerpo CRUDO.** Sobre el JSON
parseado y vuelto a serializar nunca cuadra — un espacio de diferencia
y el HMAC cambia entero. Por eso `main.ts` arranca con
`NestFactory.create(AppModule, { rawBody: true })` y el handler lee
`req.rawBody`. Si alguien quita ese `rawBody: true` «porque no se usa»,
dejan de entrar todos los leads y no hay ningún error que lo diga.

**2. El payload de Meta NO pasa por el `ValidationPipe`.** El pipe
global rechaza con 400 cualquier campo que un DTO no declare, y el
cuerpo de Meta trae los suyos. Por eso el handler lee `req.body`
directamente en vez de usar `@Body()`. **Este era el motivo real por
el que parecía que «Meta no podía llamar esta ruta».**

**3. Se contesta 200 pase lo que pase con el contenido.** Meta
reintenta cuando no recibe 200, y si insiste sin éxito **apaga el
webhook**. Un aviso que no entendemos no puede costar que dejen de
llegar los que sí. Lo que no se pudo usar queda en el log y en la
tabla. Lo único que devuelve 401 es una firma inválida, que es cuando
de verdad no viene de Meta.

## Meta no manda los datos de la persona

Esto sorprende a todo el mundo la primera vez: el webhook trae un
`leadgen_id` y nada más. Para saber cómo se llama hay que volver a
llamar a la Graph API con un token de la página.

Por eso **el aviso se guarda igual, con o sin token**: queda
`PENDIENTE` con su `leadgen_id` y un motivo que lo explica, y
completarlo después es una consulta más. Un lead pagado que se pierde
porque a nosotros nos faltaba una credencial es plata tirada.

Esa segunda mitad —pedirle los datos a la Graph API— **está sin
hacer**. Es lo siguiente cuando haya app aprobada y token de página.

## Variables de entorno — **son de cada gremio**

Hay **una app de Meta por gremio**. Una app = una URL de
devolución = un gremio. Por eso las variables llevan sufijo:

| Variable | De dónde sale |
|---|---|
| `META_APP_SECRET_<GREMIO>` | Meta → app → Configuración → Básica → «Clave secreta de la app». **Cada app la suya.** |
| `META_VERIFY_TOKEN_<GREMIO>` | Se lo inventa usted. Va escrito **igual** aquí y en Meta |

El sufijo es el slug en mayúsculas con el guion cambiado por
raya baja: `britcham-adee` → `META_APP_SECRET_BRITCHAM_ADEE`.

> **Por qué esto no es un detalle de estilo.** Cada app firma
> sus avisos con **su** secreto. Si se verifica la firma de un
> gremio con el secreto del otro, se rechazan **todos** sus
> leads por «firma inválida» — y ese síntoma no se lee como un
> error de configuración: se lee como **«Meta no nos está
> mandando nada»**, que es de los más caros de diagnosticar
> porque no hay nada roto que mirar.
>
> `META_VERIFY_TOKEN` es menos grave y también rompe: el
> `hub.challenge` de cada app se compara con el suyo, así que
> con uno solo no se puede ni suscribir la segunda.

**No hay respaldo a las variables sin sufijo, a propósito.** Un
respaldo haría que el gremio mal configurado usara el secreto
del otro, y el fallo volvería a ser silencioso.

### `META_CONVENIO_SLUG` ya no existe

El gremio lo dice el **subdominio** por el que entra la
llamada, igual que en la puerta del orquestador. Además de
quitar una variable, levanta un tope real: con
`META_CONVENIO_SLUG` **solo un gremio podía recibir leads de
Meta, nunca los dos**.

`page_id` viaja en el cuerpo y se guarda; sirve como
comprobación cruzada, no como la llave.

## Qué pegar en Meta

En la app de **cada gremio**, en **Webhooks** de su página:

```
URL de devolución:  https://<gremio>.reservasae.com/api/webhooks/leads/meta
Token:              el META_VERIFY_TOKEN_<GREMIO> que corresponda
Campo suscrito:     leadgen
```

El `/api` delante lo pone nginx (`docker/nginx/*.conf`).

**El apretón de manos es donde se atasca todo el mundo.** Antes
de mandar nada, Meta llama con un `GET` y espera su
`hub.challenge` devuelto **tal cual, en texto plano**. Si se le
contesta un JSON, o entre comillas, o con un salto de línea, no
valida y no enciende — y no dice por qué: simplemente no llegan
leads. Por eso el handler usa `@Res()` sin passthrough, que es
la única forma de que Nest no serialice a JSON lo que devuelva.

## Cómo probarlo sin tener Meta conectado

**Panel → Configuración → Webhook de Meta.**

Existe porque conectar Meta necesita una app aprobada, una página con
permisos y un dominio público, y nada de eso depende de nosotros. Lo
que sí depende de nosotros se prueba entero desde ahí.

**Enseña una tarjeta POR GREMIO**, y eso es lo importante: el
estado de uno no dice nada del otro, y ver los dos juntos es lo
que hace que salte a la vista que a uno le falta el secreto.

Cada tarjeta va en el orden en que se rompen las cosas:

1. **Qué falta** — las variables que no están, con su nombre
   exacto para copiarlo y pegarlo.
2. **Lo que hay que pegar en Meta** — la URL y el campo, con botón de
   copiar. El token no se muestra: una credencial en pantalla es una
   credencial en una captura.
3. **El apretón de manos** — hace la llamada real contra sí mismo y
   compara el reto **letra por letra**. No escribe nada, así que se
   puede correr también en producción.
4. **Un lead de mentira** — arma el cuerpo de Meta, lo firma con el
   mismo secreto y lo manda a la misma ruta. Solo en `ENTORNO=prueba`.

Las pruebas se mandan **por HTTP a la propia ruta**, no llamando al
servicio. Es más lento y es a propósito: lo que se dudaba era si la
ruta se dejaba llamar, y saltársela para probarla sería probar otra
cosa. Van a `127.0.0.1:$PORT` y no a la URL pública, para que un `.env`
mal puesto no mande la prueba a otro servidor.

El botón **«Mandar tres de golpe»** es el que de verdad importa: Meta
agrupa varios avisos en un mismo envío, y quedarse con el primero es
un fallo que nadie nota hasta que faltan leads.

Los leads que salen de ahí se llaman `PRUEBA-<ms>-<n>` para que se vean
a un metro, y «Borrar los de prueba» solo se lleva esos y solo los que
no se convirtieron en ficha.

## Dónde está cada cosa

```
backend/src/leads/
├── meta.ts                     firma HMAC, lectura del payload, verificación
├── meta.spec.ts                17 pruebas
├── simulador-meta.ts           arma y firma un aviso de mentira
├── simulador-meta.spec.ts      13 pruebas — cierran el círculo contra meta.ts
├── meta-guardado.spec.ts       10 pruebas — qué queda en la tabla
├── meta-pruebas.controller.ts  el banco de pruebas del panel
├── leads.controller.ts         las dos puertas
├── leads.service.ts            deMeta() y entra()
├── cruzar-con-el-crm.ts        ¿esta persona ya está en Gestión de leads?
└── llave-de-leads.guard.ts     la llave del orquestador, en un guard

frontend/src/app/admin/integraciones/meta/page.tsx
frontend/src/lib/meta-api.ts
```

## Detalles que costaron un rato

**El `×1000` de la fecha.** Meta manda `created_time` en **segundos**;
JavaScript quiere milisegundos. Sin el `×1000` todos los leads salen
con fecha de 1970. Hay una prueba que lo fija.

**`timingSafeEqual` y no `===`.** Comparar firmas con `===` se corta en
el primer byte distinto, y de cuánto tarda en cortarse se puede deducir
la firma byte a byte. Aquí eso daría la llave para escribir leads
falsos en el CRM.

**`import type` en el controlador.** Con `emitDecoratorMetadata` +
`isolatedModules`, los tipos que aparecen en una firma decorada
(`@Req() req: RawBodyRequest<Request>`) **tienen** que importarse con
`import type`. Con un import normal no compila.

**`update: {}` en el upsert.** Meta reintenta, y un reintento no puede
pisar el nombre que ya se pidió a la Graph API.

**Cada aviso con su propio `try`.** Si el tercero falla, los dos
primeros ya están guardados. Un lote entero perdido por una fila mala
es lo que no puede pasar.

**`origen: FACEBOOK`.** No es cosmético: `CrmService.PAUTA` incluye
`FACEBOOK`, así que es lo que hace que el lead salga marcado como
**PAUTA** en la columna «Origen lead» de Gestión de leads cuando se
convierta en ficha.

## Lo que esto NO prueba

- **Que Meta llegue al dominio.** Depende del DNS y del certificado, y
  solo se sabe el día que se conecta.
- **Que lleguen los datos de la persona.** Falta la llamada a la Graph
  API (ver arriba).
