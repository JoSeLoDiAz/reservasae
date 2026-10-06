# `jose/dv-tecleado` · lo que queda tras la 0.21.0

Josse: gracias por las dos de esta mañana, y por volver a meter BBDD Leads y la
bandeja sin que hiciera falta pedírtelo. Tu `dev` está fundida aquí y verde.

| | |
|---|---|
| Rama | `jose/dv-tecleado`, subida |
| Desplegado | `v0.21.0-JD` (6 oct, 9:42) |
| Sin desplegar | **6 commits**: 2 de contenido, y el resto merges, un revert y este documento |
| De lo tuyo que falte traer | **nada**: `origin/dev` fundida |
| Línea base | `tsc` limpio en backend y frontend · **267 suites, 2.834 pruebas**, verde |
| Migraciones nuevas | **ninguna** |

---

## 0 · Los dos que quedan

### a) El cargue de BBDD Leads se duplicaba con Gestión de leads

`dae9dd1`. **Esto es un defecto de lo que acabas de desplegar**, así que va primero.

El cruce del cargue mira la MESA ---`leads_entrantes`--- y no las fichas. Y las dos
poblaciones casi no se solapan: quien llega por el formulario público nace FICHA y no
deja fila en la mesa. En la base de pruebas, **de 1.480 fichas ninguna tiene lead en la
mesa**.

Así que subir una base con gente que ya está en Gestión de leads ---incluso ya
inscrita--- las da por NUEVAS y crea un lead de cada una: dos registros de la misma
persona y dos asesoras llamándola, que es justo el duplicado que la mesa existe para no
tener. Y el informe lo dice al revés ---«todas nuevas»---, que es lo que uno espera ver
en un cargue, así que nadie lo buscaría.

Lo encontró el cliente preguntando, no una prueba: «¿pero con Gestión de leads?».

Ahora, antes de crear, se mira también la ficha: documento, correo o celular, los
mismos tres del cruce de la mesa y en el mismo orden. La fila sale como «Ya está en
Gestión de leads», con por dónde se reconoció y **en qué etapa**.

**No se le toca nada a la ficha.** Misma frontera que ya pone el lead convertido:
rellenar campos de una ficha desde un archivo cambia lo que se le reportó al SENA sin
pasar por la ficha.

Lo que mirarías tú: **acotado al convenio**, con prueba sobre el `where` que sale hacia
Prisma; y el doble del arnés contesta al `where` como la base, porque uno que devolviera
todas las fichas daría por bueno un cruce que no filtra.

### b) Por dónde entró cada persona, en columnas separadas

`7b67734`. Cierra «si o sí el sistema debe decirme de qué link de formulario entró»
(cliente, 5 oct) y lo que dijo hoy viendo la 0.20.0 ya desplegada: «¿se debe separar,
ejemplo el Eduteka, para otra columna, porque no tengo opción de saber qué formulario?».

Tenía razón en la lectura: «Orgánico / eduteka» encima de «Formulario: Preinscripción
pública» hace pensar que *eduteka* es el formulario. No lo es ---es la campaña--- y eran
tres preguntas apretadas en dos columnas. Ahora son cuatro columnas pegadas: canal,
campaña, formulario y **enlace de entrada**, que es la que faltaba.

Con filtro en el servidor y en la dirección: `?enlace=` y `?formulario=` se pegan en un
chat y llevan a la lista, como ya hacen `?asesor=` y `?curso=`. Y `SIN_DATO` pide las
que no lo tienen, que es como se mide cuánto falta por saberse.

Endpoint nuevo: `GET /admin/participantes/por-donde-entraron`.

**La tabla se queda en `participantes-v2`.** La renombré por añadir la columna y tu
revisión de la mañana me corrigió lo mismo en la de asesores: para eso está
`nueva: true`. Deshecho antes de subirlo.

---

## 1 · Tres cosas que mirar al desplegar (de las 34 anteriores)

### a) Tres migraciones, las tres compatibles hacia atrás

Van en `backend/prisma/migrations/`, así que se aplican al arrancar el contenedor. En
orden:

**1. `20261002160000_cierre_de_inscripciones_por_grupo`** (de `17767a0`)

`Grupo.cierreInscripciones DateTime?`, nulo por defecto. **Nulo = el comportamiento de
siempre**: el cierre se sigue derivando de `fechaInicio`. Nada cambia hasta que alguien
corra el importador del cronograma, que es un comando aparte y no corre solo.

Rollback: `ALTER TABLE "grupos" DROP COLUMN "cierreInscripciones";`

**2. `20261005120000_caracterizacion_por_gremio`** (de `6573c37`)

Añade `CaracterizacionPersona.convenioId` y cambia la llave única de
`(persona, caracterización)` a `(persona, caracterización, convenio)`.

**Esta sí toca filas**: rellena el convenio desde la política que ampara cada
autorización, que es de donde se dedujo siempre, y **borra** las marcas cuya
autorización no exista, porque esas no se pueden reportar a nadie. Antes de desplegar,
mira cuántas son:

```sql
SELECT COUNT(*) FROM "caracterizaciones_persona" c
 WHERE NOT EXISTS (SELECT 1 FROM "autorizaciones_datos" a WHERE a."id" = c."autorizacionId");
```

En pruebas salió cero. Si en producción no sale cero, dímelo antes de seguir.

**3. `20261005140000_por_que_enlace_entro`** (de `816c3c9`)

Tres columnas nulables en `participantes` ---`formularioDeEntrada`,
`enlaceDeEntrada`, `visitaDeEntrada`--- y dos índices por convenio. **No toca ni una
fila**: lo de antes se queda en nulo a propósito, porque suponer de dónde vino alguien
sería decirlo sin que conste.

Rollback: soltar las tres columnas y los dos índices.

### b) Un commit de solo frontend

```
996e33f  Reservas: cupos reservados, el total de inscritos, y fuera el punto
```

Lo digo porque el del Excel en hora de Bogotá era igual y se quedó fuera dos veces. El
cliente pidió estos tres el 2 oct y los va a buscar.

### c) El informe de brechas da `EXPORT-UTC` por abierta y **no lo está**

El detector busca que `valor` devuelva la fecha de Bogotá; el arreglo vive en `exporta`.
Es el detector el que mira donde no es. Pendiente de corregir; que no te frene.

---

## 2 · Lo que entra, por riesgo

### Al SENA — lo que se entrega

- **El F7 contaba beneficiarios que el cargue excluye.** Tenía su propia consulta y
  filtraba distinto: solo por autorización revocada, mientras el cargue descarta además
  por completitud. Los dos archivos que se entregan **juntos** se contradecían. Ahora el
  F7 se construye sobre las filas que de verdad salen en el cargue — ya no es que los
  filtros coincidan hoy, es que no pueden dejar de coincidir. Como eso podía dejar una
  empresa fuera en silencio, el aviso dice ahora cuánta gente se quedó.
- **El orden del F7 no desempataba.** Sin `orderBy` y con un `sort` solo por razón social,
  la misma empresa con filas en dos acciones podía numerarse distinto entre dos
  exportaciones del mismo día. Orden total: razón social → acción → NIT → grupo.
- **El año de postulación entraba sin validar**: `?ano=12` ponía 12 en las 800 filas.
- **`TOTAL DE HORAS EVENTO` podía salir vacía** sin que nada avisara. Ahora la fila sale en
  «No exportados» con su motivo, agrupado por acción.
- Y de antes: **se podía reportar a un menor** (dos fechas para el mismo dato), **el NIT
  perdía los ceros de la izquierda**, y **la caracterización salía al azar** (las marcas de
  un envío empatan en `creadoEn` porque es la hora de la transacción).

### Datos personales

- **La puerta pública resucitaba autorizaciones revocadas.** `dejarConstancia` solo miraba
  las vivas, así que ante una revocada caía al `create`. Ruta **anónima y sin sesión**: un
  tercero reactivaba el tratamiento de datos de alguien que pidió que pararan. La
  conversión de un lead ya lo comprobaba; la pública no. Cerrado en `dejarConstancia`, que
  es el único sitio que escribe esa fila, y buscando por **convenio** y no por versión del
  texto.

### Permisos y gremios

- **`asignar-lote` repartía leads sin el candado de «quién reparte».** En ese mismo
  controlador `convertir-lote` ya lo tenía, y el gemelo de fichas también. Un gestor podía
  pasarle sus leads a otro o, con `asesorId: null`, vaciarle la cola a una compañera. Lo
  tapaba que el panel no pinta el botón: el candado vivía en la pantalla.
- **La llave de idempotencia de los leads no llevaba el gremio.** La misma persona pidiendo
  «AF1» en BRITCHAM encontraba su lead de ADECOPRIA: no se creaba nada y se devolvía el
  `id` y el `participanteId` de otro gremio.
- **La regla de «una sola acción» cruzaba gremios** en la conversión automática: un lead de
  BRITCHAM no se convertía nunca si esa persona ya estaba en ADECOPRIA, y el barrido lo
  rechazaba cada minuto sin síntoma.

> **Ojo con esto al revisar el diff de leads.** La llave **se guarda** en
> `LeadEntrante.externoId`. Cambiarle el formato, sin más, habría hecho que los leads ya
> guardados dejaran de reconocerse y el primer reintento del emisor los **duplicara** —en
> la puerta por la que entra la pauta pagada—. Por eso se buscan **las dos**, la nueva y la
> de antes; se escribe siempre la nueva, así que se apaga sola sin migración.

### Cupos y organizaciones

- **El sitio público prometía plazas que no existían**: `cuposOcupados` solo cuenta lo que
  aparta una empresa. La cuenta estaba copiada en siete sitios; ahora vive en
  `comun/plazas-de-la-oferta.ts`.
- **La organización se creaba aunque la reserva fallara**: `POST /reservas` público con un
  NIT inventado devolvía 409 y dejaba la fila. Ahora va dentro de la transacción.
- **`editar()` no comprobaba que la oferta siguiera abierta** y `crear()` sí: con el grupo
  cerrado se ampliaba una reserva y entraba gente que el cierre excluía. Bajar la cantidad
  sigue permitido y **cancelar nunca se bloquea**.
- **Las que el dígito pegado partió en dos** —Benedictino entre ellas—: cerradas las tres
  puertas y el guion `db:nit-pegado` para las de antes.
- **El listado de organizaciones no enseñaba las que no han reservado.** Quien entra por el
  formulario —una persona natural con RUT— no reserva: se inscribe. En pruebas, ADECOPRIA
  pasa de 13 a 18. Y el buscador rompía el ámbito: al escribir, el listado habría enseñado
  los dos gremios.

### Formulario público

- **Pisaba las correcciones del asesor** en cuatro campos escritos antes del candado —uno
  es columna del F7—, y la respuesta decía «en espera», que era mentira para esos cuatro.
- **Reescribía los datos de la organización que nominó**, compartida por todos sus
  nominados: una persona del Benedictino cambiaba el teléfono y el contacto de las 40
  fichas del colegio. Ahora, si la organización es suya escribe entera; si está nominada,
  solo rellena huecos.
- **`beneficiarioPrevio` aceptaba la cadena `"false"` como `true`**. Era el único booleano
  del módulo sin el `@Transform`; sus cuatro hermanos ya lo llevaban.
- **El doble clic daba un 500 crudo y anulaba el enlace** que el primero ya tenía en
  pantalla.

### Trazabilidad

- **El cronograma no podía auditarse aunque se quisiera**: `entidad` va tipada contra el
  catálogo y no existían `GRUPO` ni `COBERTURA`, así que no compilaba. Ampliado, y los tres
  caminos que escriben dejan huella.
- **De las 23 escrituras de `admin.service.ts`, ninguna dejaba rastro.** Quién crea una
  cuenta, quién cambia un rol, quién reparte concesiones y **quién le reinicia la
  contraseña a quién** —que es una toma de control— no constaba en ninguna parte.

### Gestión de leads y pantallas

- **NIT, nombre de empresa y formulario de entrada**, encendidas de entrada.
- **«Falta 1» decía lo que no era**, y el cliente lo señaló tres veces. La compuerta para
  inscribir pide tres cosas —curso con sede, un contacto y la autorización— y **no pide la
  organización ni los campos del SEP**; la columna contaba justo eso. Así que alguien
  inscrito, formándose o **certificado** arrastraba un «Falta 1» que nunca le impidió nada:
  18 de 18 inscritas, 24 de 24 certificadas y 93 de 95 fichas en etapa DATOS_COMPLETOS. No
  se deja de contar —hace falta para el SENA— pero ahora dice **para qué**: de 1.476 filas
  que decían «Falta N», 1.302 pasan a «para el SENA» y quedan 174 que un asesor sí tiene
  que trabajar.

### El cronograma

Lee la hoja de Drive del cliente —colores incluidos— y lleva a cada grupo su inicio, su fin
y **su propia fecha de cierre**. Una AF no cierra entera: seis de las siete cierran en dos o
más fechas y AF3 en cinco. La pantalla sigue mandando la más próxima y avisa «cierra por
partes».

`pnpm db:cronograma` **no escribe sin `--aplicar`**, no crea grupos, no borra lo que la hoja
no menciona, y comprueba la ciudad además del código y el número.

---

## 3 · Cuatro decisiones, y no son mías

1. **`AF2.G5` y `AF2.G6` están cruzados.** El cronograma dice que el G5 es Córdoba y Huila y
   el G6 Cauca y Santander; la base los tiene al revés. El importador lo detectó y **no los
   escribió**. O se renumeran los grupos, o se corrige la hoja.
2. **El formulario público deja sumar el foro a las presenciales** (AF3–AF6), cosa que el
   panel no permite. Catalina dijo «si es de las virtuales se puede inscribir al foro». Lo
   cerré, vi que `segunda-inscripcion.ts` dice que la puerta pública «se decide aparte
   porque es un cambio para el ciudadano», y **lo deshice**.
3. **La propuesta no admite campos de la participación.** Para que los cuatro campos del
   candado lleguen a la bandeja del asesor como propuesta decidible hay que tocar
   `ETIQUETA_CAMPO` y `resolverPropuesta`; hoy meterlos ahí **reventaría al aceptarla**.
   Descrito, no hecho.
4. **La credencial del cronograma.** Para que se lea solo hacen falta
   `GOOGLE_CUENTA_DE_SERVICIO` y `CRONOGRAMA_DRIVE_ID` en el servidor. Sin ellas funciona
   igual pasando `CRONOGRAMA_ARCHIVO`. El archivo **no está en el repositorio** a propósito.

---

## 4 · Lo que sigue bloqueado, y no es código

- **El LMS.** Nadie escribe el avance del aula y sin él `cambiarEtapa` impide certificar a
  cualquiera, que es lo que paga el SENA. La pregunta es una: ¿pueden mandar, por persona y
  actividad, si está completada y cuándo?
- **El SENA.** Quien se retira desaparece del cargue en vez de reportarse. El código ya dice
  dónde se añade; falta saber qué valor espera la columna ESTADO para un retiro.

---

## 5 · Lo que queda abierto de la auditoría

De los 23 hallazgos del 2 oct quedan **cinco**, todos de riesgo bajo o medio y ninguno
bloqueante:

- `PATCH /admin/tableros/empresas/:id` **no recalcula el dígito de verificación** al cambiar
  el NIT, ni valida los ids del SEP contra catálogo. La puerta gemela del CRM sí.
- Una **revocación en un gremio vacía la caracterización** del reporte del otro.
- El **alistamiento devuelve hasta 300 cédulas con permiso de solo VER**.
- **Cancelar una reserva** desde tableros pasa con nivel `VER`.
- `papelEnConvenio`, `clasificacion` y `sectorEconomico` son **globales de la empresa** pero
  el F7 es por convenio.
