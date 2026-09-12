# Para José — lo que hay que hacer

**Una sola lista.** Solo está aquí lo que **no puedo hacer yo**: ejecutar migraciones, y
decisiones o datos que solo tú tienes. Todo lo demás ya está hecho y commiteado.

Rama: `arq/crm-hardening`.
Estado hoy: **`tsc` limpio en backend y frontend · 1490 pruebas en 127 suites, verde.**

---

## Parte 0 · Desplegar la entrega del 12 de septiembre de 2026

**Es la más fácil de todas: solo frontend.**

### 1 · No hay migraciones y no hay que tocar el backend

Son 38 ficheros y **todos están bajo `frontend/src`**. Comprobado con
`git diff --name-only 7b80c82..HEAD`: no aparece `schema.prisma`, ni
`backend/prisma/migrations/`, ni un solo fichero de `backend/`. Por tanto:

- **no** se corre `prisma migrate deploy`,
- **no** hace falta reconstruir el backend,
- y el orden no importa: este frontend contra el backend que ya está corriendo
  funciona igual. Es justo lo contrario de la entrega del 4 de septiembre, que sí
  exigía backend primero.

```bash
git checkout arq/crm-hardening && git pull
docker compose build frontend
docker compose up -d frontend
```

### 2 · Lo que va a notar el equipo el primer día

| Qué cambió | Dónde se ve |
|---|---|
| La cabecera bajó de 127 px a 88 | En todas: la tabla gana 38 px de alto |
| El lema «Relaciones que generan resultados» **ya no sale en el panel** | Cabecera. Sigue en el acceso y en el pie público |
| Catálogo y Cronograma son **dos entradas del menú Calendario**, cada una con su URL | Antes eran pestañas dentro de una pantalla |
| Seguimiento y Tablero académico, igual, en el menú Académica | El tablero volvió a ser una pantalla |
| Los botones de exportar a PDF son **rojos y sin icono** | Resumen, Calendario, Cronograma, fichas, respuestas |
| «Todavía no se le ha preguntado» ahora dice **«Sin registro de caracterización»** | Ficha de un lead. Dice lo que el sistema sabe, no lo que supone |
| El panel ya no desplaza el documento | Antes, en ventanas bajas, la cabecera se iba de la pantalla y no volvía |

### 3 · Dos rutas nuevas, y una que dejó de redirigir

- `/admin/acciones/cronograma` — nueva.
- `/admin/participantes/academico/tablero` — **llevaba un año redirigiendo** a su
  padre y ahora pinta el tablero. Quien tenga ese enlace guardado va a ver lo que
  esperaba cuando lo guardó.

No hay rutas eliminadas, así que ningún enlace antiguo se rompe.

### 4 · Antes de cargar personas de verdad

`PANEL_POR_TUNEL=si` sigue activo en `frontend/.env.local` (ese fichero está
fuera de git, es local de cada máquina). Con eso el panel queda **abierto a
cualquiera que tenga el enlace**, y la cookie de sesión viaja sin `Secure`. Es
cómodo para revisar por túnel y es inaceptable con datos de personas dentro:
hay que quitarlo antes de la primera carga real.

### 5 · Lo que está pendiente de DECISIÓN, no de trabajo

Tres cosas que Mauricio pidió y que no se hicieron porque tocan cifras que se
reportan al SENA o porque el arreglo obvio empeora otra cosa:

- **«Cupos con dueño»** sigue llamándose así en el Resumen. El cambio de rótulo
  es trivial; lo que hay que confirmar es que nadie dependa del nombre.
- **El avance grande va sobre la META** (14,6 %) y él lo quiere **sobre el TOPE**
  (11,2 %). Son dos denominadores distintos, no un redondeo: hay que decidir cuál
  es el número oficial antes de tocarlo.
- **Las tarjetas de cifra en un renglón** (rótulo izquierda, cifra derecha).
  Medido: 14 de las 16 llevan un pie, así que se ganan ~7 px por tarjeta y no la
  mitad; y subir el ancho mínimo para que quepan las dos cosas **parte la fila de
  cinco del cronograma en un portátil de 1280**, con lo que el bloque queda más
  alto. Hace falta decidir qué pasa con el pie.

### 6 · Un fallo de contraste real, y su arreglo toca backend y datos

Medido con canvas sobre el color compuesto, en las 30 pantallas y en los dos
temas: **el texto secundario de 12 px da 4,39:1 sobre las bandas tintadas** y el
mínimo es 4,5. Sale en once pantallas (Apariencia, Control, Cuenta de correo,
Seguimiento, Habeas Data, Reportes al SENA, el tablero académico y las cabeceras
de grupo de las dos listas de acciones). **El tema oscuro está limpio: cero
fallos.**

Lo que hay que saber antes de tocarlo, porque yo me equivoqué primero:

- **No se arregla en `globals.css`.** Lo intenté y no cambió ni una décima. Ese
  token lo pisa la **paleta del gremio**, que se inyecta en el `<head>` y viene
  **guardada en la base**: en ADECOPRIA `--texto-suave` vale `#687573`.
- El valor nace en `backend/src/admin/derivar.ts`, en la receta
  `textoSuave: { l: 0.55, c: 0.015 }` — se deriva del color de marca en OKLCH, de
  ahí que sea un gris verdoso y no un gris.
- En `backend/src/admin/temas.ts` **sí** hay comprobación de contraste para ese
  token, pero solo contra `superficie` (blanco), donde pasa con 4,76:1. El par que
  falla —contra la banda tintada— **no está en la lista**, y por eso nadie lo vio.

Así que el arreglo son tres pasos, y el tercero es el que pide tu decisión:

1. bajar la `l` de la receta (backend),
2. añadir el par que falta a las comprobaciones para que no se repita (backend),
3. **re-derivar la paleta de cada gremio**, porque la actual está guardada. Eso
   recolorea el texto secundario de todos los convenios a la vez.

Lo dejé sin hacer a propósito: son 0,11 de contraste en un texto de apoyo, y el
paso 3 cambia el aspecto de dieciséis plantillas de tema. Prefiero que lo decidas
tú antes de mover la paleta de nadie.

---

## Parte 0 bis · Desplegar la entrega del 4 de septiembre de 2026 (si aún no se hizo)

**Rama `arq/crm-hardening`. Ya trae `origin/dev` fusionado** (fusión limpia, sin
conflictos) y verificado después de fusionar: `tsc` limpio en los dos lados,
1322 pruebas verdes y `next build` correcto.

### 1 · No hay migraciones

No se tocó `schema.prisma` ni se añadió nada en `backend/prisma/migrations/`.
**No hay que correr `prisma migrate deploy` para esta entrega.** Lo de la
Parte 1 de este documento sigue pendiente y es aparte.

### 2 · Hay que reconstruir el BACKEND, no solo el frontend

Es lo único que puede salir mal, y sale mal en silencio. Cambiaron
`crm.service.ts`, `tableros.service.ts`, `proyeccion.ts` y `etapas.ts`, y el
backend corre desde `dist/`. Si se despliega el frontend contra el backend
viejo:

- la columna **Grupo** de Gestión de leads sale vacía,
- los grupos desplegados en el Resumen salen en **NaN**,
- la proyección contra el cronograma no aparece.

Pasó en local exactamente así.

### 3 · El orden importa: backend primero

Frontend nuevo contra backend viejo es el fallo de arriba. Al revés no rompe
nada.

```bash
git checkout arq/crm-hardening && git pull
docker compose build backend frontend
docker compose up -d backend      # primero
docker compose up -d frontend     # después
```

### 4 · Avisar al equipo de un cambio de comportamiento

**El grupo de un participante ya no se puede cambiar una vez asignado.** Es lo
que viaja al SENA junto a la persona, y moverlo después de reportarla deja dos
verdades. Hoy **no tiene escape**: si alguien lo pone mal, solo se corrige
desde la base de datos. Si eso estorba en la operación, la salida limpia es
dejar que un líder pueda corregirlo.

---

## Parte 1 · Aplicar migraciones (4 pasos)

Están escritas, con SQL, rollback y verificación, en
[`docs/arquitectura/migraciones-propuestas/`](arquitectura/migraciones-propuestas/).

**No están en `backend/prisma/migrations/` a propósito**: ahí el arranque del contenedor las
ejecutaría solas. Se mueven a mano, una a una.

### El procedimiento, igual para todas

```
1. Mover el .sql a backend/prisma/migrations/<nombre>/migration.sql
2. Aplicar el cambio de schema.prisma EN LA MISMA ENTREGA
   (si no, el siguiente `migrate dev` ve drift y genera la migración que las tira)
3. Correr la VERIFICACIÓN PREVIA que trae el fichero. Si no da lo que dice, no desplegar.
4. Desplegar.
5. Correr la VERIFICACIÓN POSTERIOR. Si no cuadra, revertir con el rollback del fichero.
```

> ⚠️ **Antes de nada, renumerar.** Las mías empiezan en `20260831090000` y tú ya metiste
> `20260831230000_lead_con_su_accion` y `20260901180000_lead_con_su_ubicacion`. Prisma aplica
> por orden alfabético: hay que ponerles fecha posterior a la tuya más reciente.

### 1.1 · La que más rinde, y ya puedes

**`09-…_lead_por_participante_deja_de_ser_unico.sql`**

Quita el `participanteId String? @unique` de `LeadEntrante` (`schema.prisma:820`).

**Por qué importa, y por qué ahora es más urgente que antes:** tu `llave-del-lead.ts` mete el
código del curso en la llave **a propósito**, para que la misma persona pida AF1 y después AF2.
Esas dos filas cruzan **FIRME** contra la misma ficha, y **la segunda viola el único** → P2002 →
**500 crudo**, porque no hay `ExceptionFilter`.

Y se autooculta: el reintento entra por la guarda de idempotencia y contesta **200 con
`repetido: true`**. El emisor cree que quedó bien. El lead queda PENDIENTE para siempre.

**Su único requisito de código —el ramificado por `firme`— lo pusiste tú ayer.** Ya está.

> Las 1047 pruebas no pueden ver esto: `solo-lo-firme-ata.spec.ts:31-37` falsea
> `leadEntrante.update` con un `push` a un array, y ahí no hay índice único. No es un fallo del
> spec: es que este tipo de bug necesita base real.

### 1.2 · La bitácora (dos ficheros, en este orden)

**`01-…_bitacora_de_cambios.sql`** → la tabla y las funciones. Segura.
**`02-…_bitacora_colgar_en_las_tablas.sql`** → los 43 triggers.

De estas dependen **cuatro problemas graves**. Sin ellas, escribir por SQL directo no deja
rastro y la bitácora se puede vaciar.

> ⚠️ **La 02 necesita ventana tranquila.** Toma `ACCESS EXCLUSIVE` sobre las 43 tablas y
> **los acumula hasta el `COMMIT`** — no es "un instante", como decía mi documento anterior;
> me corrijo. Con una transacción larga abierta, espera; y **si alguien la mata a medias**,
> Prisma deja la fila sin `finished_at`, el siguiente arranque da **P3009** y con `set -e` eso
> sí es ciclo de reinicios. Corre antes la verificación previa que trae el fichero.

**Y una decisión que es tuya**, no mía: a partir de la 02 la bitácora es **`fail-closed`** —un
fallo al apuntar tumba la escritura del usuario—. Eso es **lo contrario** de lo que hay hoy:
`AuditoriaService.registrar()` es `fail-open` a propósito y su comentario explica por qué.
Si prefieres mantener `fail-open`, dilo y ajusto el trigger.

### 1.3 · Las nueve restantes

Cupos, papelera, hold con TTL. Cada una con su ficha. **Ninguna corre riesgo de tumbar el
arranque salvo la 11**, que va marcada y detrás de un paso manual — y que, si prefieres, **se
puede no poner**: lo que resuelve ya lo cierra la 08.

---

## Parte 2 · Tres preguntas que solo tú puedes contestar

### 2.1 · 🔴 ¿Dónde se pone `sepProyectoId`?

**El cargue al SEP no se puede generar. Ninguno.**

`sep.service.ts:368` aborta si `convenio.sepProyectoId` es `null` — *"Póngalo en Formación antes
de exportar"*. **Ese campo no se puede escribir en ningún sitio**: no hay pantalla, ni ruta, ni
seed que lo ponga.

Es el entregable contractual con el SENA. Si esto lleva así desde el principio, alguien lo está
haciendo por fuera; si no, es que nunca se ha entregado.

**Es la pregunta que más rinde de todo el documento.**

### 2.2 · ¿Qué valores admite la columna `ESTADO` del cargue?

Hoy `formato-cargue-sep.ts:171` escribe `'ACTIVO'` **a fuego**, y `sep.service.ts:188` filtra
por `ETAPAS_DEL_REPORTE`, que no incluye las cuatro salidas del aula.

Resultado: **cuando alguien se retira, su fila desaparece del siguiente cargue**. Al SENA le
consta que estaba activo y después se evapora. Desde fuera es indistinguible de un error nuestro.

**La columna `ESTADO` ya existe en el formato.** Si el SENA admite un `RETIRADO` o equivalente,
avisar del retiro **no exige tocar ni un título ni una prueba**.

### 2.3 · Cuatro más del SENA, del mismo bloque

- ¿Existe ya un formato oficial para reportar retiros? Si sí, mi borrador se tira y se copian
  sus columnas.
- ¿El motivo va como texto libre o como causal de lista cerrada?
- ¿Exigen **horas efectivamente cursadas**? Si sí, **no es trabajo de formato: es un módulo de
  asistencia que no existe**.
- ¿Piden soporte firmado? La ficha no admite adjuntos de ningún tipo.

---

## Parte 3 · Cosas de tu código, cortas

Ninguna es grave. Las hago yo si prefieres, pero son tuyas y las conoces mejor.

| Qué | Dónde | Por qué |
|---|---|---|
| El `estado` del filtro llega al `where` sin validar, con `as never` | `mesa-de-entrada.controller.ts:50` | El resto del panel usa `@IsEnum` |
| El texto crudo de la excepción sale al cliente | `lote.service.ts:158` | Con la base caída, el mensaje de Prisma incluye el host |
| La conversión no es atómica: tres transacciones | `conversion.service.ts:232` | Si corta en medio, queda ficha creada y lead `PENDIENTE` |
| El lote no crea `CargaDeParticipantes` ni pone `cargaId` | `lote.service.ts:117` | El cargue de participantes sí lo hace, para saber qué pasó si se cae a la mitad |
| La mesa pagina en el servidor y no en la pantalla | `frontend/.../mesa/page.tsx:235` | Con más de 50 leads, los demás son inalcanzables |
| La mesa enseña el filtro `DESCARTADO` y nadie escribe ese estado | enum vs `backend/src` | Un contador que siempre dice 0 enseña a desconfiar de la pantalla |
| Al asesor se le dice "confirme antes de unirlos" y no se le da con qué | `leads.service.ts` + mesa | El motivo no nombra a la otra persona, y no hay ruta que ate el lead tras confirmar |

---

## Lo que ya está hecho, para que no lo busques

Cuatro commits en la rama, cada uno con su prueba y **comprobado que falla sin el arreglo**:

| Commit | Qué |
|---|---|
| `e90a185` | `PATCH /admin/leads/:id` normaliza el documento. Era la octava puerta y la única que no lo hacía — el mismo agujero que cerraste en preinscripción |
| `bb3cba7` | La coincidencia floja ya no escribe en la ficha ajena. Tu `if (firme)` cubría el `update`; las tres escrituras siguientes corrían igual |
| `9229f98` | La mesa dice `CC` y no `1` |
| `a9bc9fd` | Crear una ficha emite `PARTICIPANTE_CREADO`. Estaba en el catálogo y no lo emitía nadie, por ninguna de las cuatro puertas |

**Y retiro una pega que puse yo:** dije que la mesa devolvía la cédula en claro y había que
taparla. Me equivoqué. `taparDocumento` se escribió **para los logs** —lo dice su propio
comentario— y el listado de participantes devuelve la cédula entera igual. Además la mesa
**busca por documento**: taparlo dejaría al asesor sin comprobar lo que acaba de buscar.

---

## Y una cosa que no es una tarea

Tres de los cuatro arreglos de arriba son cosas que **tú ya habías arreglado en otro sitio** y
que se colaron otra vez por una puerta nueva. No es descuido: es que el sistema tiene ocho
puertas que escriben un documento y ninguna barrera que las obligue a todas.

Por eso la Fase 2 propone la capa 3 —un `CHECK` en la base— y no solo la llamada correcta en
cada servicio. **Es la diferencia entre una convención y una garantía.** Está en
[`borradores/llave-de-identidad-y-lms.md`](arquitectura/borradores/llave-de-identidad-y-lms.md),
con el aviso de que hay que limpiar los datos antes.
