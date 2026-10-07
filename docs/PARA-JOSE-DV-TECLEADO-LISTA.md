# `jose/dv-tecleado` · la ronda del 7 de octubre

Josse: nueve commits míos, **tu `origin/dev` ya fundida dentro**, una migración
---la tuya--- y la rama queda congelada desde aquí.

Rompí la congelación de ayer por lo de los nombres del cargue y te lo dije en su
momento; desde este documento no empujo nada más hasta que digas.

| | |
|---|---|
| Rama | `jose/dv-tecleado`, subida y **congelada** |
| Desplegado | `v0.23.0-JD` (6 oct, 14:57) |
| Sin desplegar | **21 commits**: tus 12 de `origin/dev` ---incluido el `v0.23.0-JD` que ya está arriba--- y mis 9 |
| **Migraciones** | **una, y es tuya**: `20261007180000_de_que_grupo_venia`. Dos columnas nuevas, `TEXT` y nulables, en `movimientos_participante`. Hacia atrás no rompe: el código de hoy no las mira. Yo no traigo ninguna. |
| De lo tuyo que falte traer | **nada**: `origin/dev` fundida hasta `7a75aad` |
| Línea base | `tsc` limpio en los dos lados · **277 suites, 2.910 pruebas**, verde |

---

## 0 · Lo que entra, por orden de lo que hace daño hoy

### a) `299dd74` · El jefe directo no llegaba a donde se busca

El formulario personalizado escribía el nombre, el cargo y el correo del jefe
directo **solo en la reserva**, y `faltaDeLaEmpresa` ---la regla que decide si una
ficha pasa a datos completos, y la que llena el F7--- los busca en la
**organización**.

La empresa los escribía, el sistema avisaba de la reserva, y todas las fichas de esa
empresa se quedaban en «Interesado» pidiendo «nombre del jefe directo» para siempre.
El dato estaba guardado a un palmo de donde se buscaba.

Ahora va a los dos sitios y **solo en hueco**: esa ruta es pública y sin sesión, así
que una reserva con el NIT de una empresa real no puede reescribirle su jefe directo
---que es el correo al que después va el reporte---. Misma regla que ya protegía la
razón social.

**Y hay un guion para lo ya escrito**: `pnpm db:jefe-directo`. Copia a cada
organización el contacto de su propia reserva más reciente, solo donde esté vacío.
Por defecto solo cuenta; `--aplicar` escribe. **Córrelo sin `--aplicar` primero y
mándame el número.**

### b) `75bf60a` · El aviso ahora dice qué falta

«Las personas están completando pero es como si no migrara la información», con un
aviso delante que decía «Marcela Acalo · Interesado — Completó los datos de su
organización». Las dos cosas eran ciertas: completó lo que el formulario le pidió, y
la ficha no avanzó por otra cosa. El sistema lo sabía y no lo decía.

`loQueLeFaltaALaFicha` usa **la misma** `faltaDeLaFicha` que la compuerta, y la
prueba fija que las dos consultas piden los mismos campos. Dos listas distintas
acabarían diciendo «no falta nada» mientras la compuerta no deja pasar.

### c) Las cifras de Control de inscritos

`474fda7`, `aed6a60`, `d1e5038`. Cada cifra medida por la fecha de su propio hecho,
que es la regla que pidió el cliente: «filtro por ayer, veo leads e inscritos de solo
ayer».

- **La conversión pasa a inscritos ÷ meta.** Dividiendo por los leads, las diez filas
  de los grupos de AF1 salían al 100 %. Tu guardia contra el «1.000 %» de `11f0494`
  ya no hace falta: con la meta debajo no puede salir, y pasarse del 100 % ahora sí
  es información ---sobrecupo, que su Excel tiene---.
- **Los inscritos del periodo exigen que la ficha siga inscrita**, por pedido suyo
  expreso. Yo lo había dejado al revés.
- **Seguimiento de asesores** tenía el mismo defecto que arreglamos ayer en la tabla:
  el periodo recortaba por `creadoEn`. Columna nueva, y la regla de acreditación en
  `acreditar-inscripcion.ts` con ocho pruebas que la ejercitan ---siguiendo lo que me
  corregiste en `acreditar-gestion.ts`---.

Medido contra el backend: Resumen General y la tabla del comité coinciden en las
cuatro ventanas que probé. Antes, sin ventana, decían 1.292 y 1.280.

### d) `b6f42b8` · Excel estropeaba identificadores

Los ids de campaña de Meta salían como `1,20E+17` ---pierde las cifras de en
medio--- y un documento que empiece por cero perdía el cero. Van como texto, solo
donde hace falta: once pruebas, y la mitad son de los casos que **no** hay que tocar.

### e) `bb4e5ba` · Las dos puertas de carga se nombran

El cliente subió por Carga de participantes y buscó los leads en BBDD Leads. No es un
fallo: una crea fichas y la otra leads, y nada lo decía.

### f) `8a75b7f` · La comprobación del «parece cerrado»

El formulario público dice «0 cupos» en AF1 Medellín y la tabla del comité dice 419
libres. Son dos números de sitios distintos ---la oferta, a mano; las coberturas de
los grupos, del cronograma--- y nada los obliga a cuadrar.

`pnpm db:cupos-vs-grupos` los compara. **Solo lee.** Mándame la salida: **no toco la
disponibilidad del formulario público sin verla**, porque equivocarme ahí cierra
inscripciones de verdad o promete plazas que no existen.

---

## 0.bis · Lo que te pido, además de desplegar

1. `pnpm db:cupos-vs-grupos` y mándame la salida.
2. `pnpm db:jefe-directo` sin `--aplicar`, y el número.
3. **Una llave nueva de la cuenta de servicio de Google**, como variable de entorno
   en el servidor. La que hay se pegó en un chat y está quemada; no la voy a usar.
   Con la nueva conecto el cronograma el mismo día, y es lo que mantiene los cupos de
   la oferta y los de los grupos diciendo lo mismo.

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
