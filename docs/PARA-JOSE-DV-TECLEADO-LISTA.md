# `jose/dv-tecleado` · lista para validar y desplegar

Josse: esto sustituye a todo lo anterior. Tus seis están cerradas, tu `v0.19.0` está
fundida aquí y verde, y encima van **25 commits** que el corte de la 0.19.0 dejó fuera
más la auditoría completa.

| | |
|---|---|
| Rama | `jose/dv-tecleado`, subida |
| Desplegado hoy | `v0.19.0-JD` (2 oct) |
| Sin desplegar | **25 commits** |
| De lo tuyo que falte traer | **nada** |
| Línea base | `tsc` limpio en backend y frontend · **249 suites, 2.664 pruebas** |
| Migraciones nuevas | **1** — `20261002160000_cierre_de_inscripciones_por_grupo` |

---

## 1 · Tres cosas que mirar al desplegar

### a) Una migración, compatible hacia atrás

`Grupo.cierreInscripciones DateTime?`, nulo por defecto. **Nulo = el comportamiento de
siempre**: el cierre se sigue derivando de `fechaInicio`. Nada cambia hasta que alguien
corra el importador del cronograma, que es un comando aparte y no corre solo.

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
