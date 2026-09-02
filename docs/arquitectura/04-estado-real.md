# 04 · Estado real, tras el trabajo de José

**Validación contra el código de hoy, con su rama ya fusionada.** No es una auditoría nueva:
es comprobar cuáles de los 119 hallazgos siguen vivos, y qué procesos empiezan y no terminan.

| | |
|---|---|
| Método | 5 frentes en paralelo + 5 refutadores, con la pregunta cargada hacia un lado |
| Coste | 10 agentes, 0 fallos |
| Línea base | `tsc` limpio · **1022 pruebas en 92 suites, todas en verde** (eran 853) |

> **La pregunta que se les puso a los refutadores**, y a propósito con peso asimétrico:
> *¿hay algún hallazgo dado por cerrado que en realidad siga vivo?* Decir que algo está
> arreglado cuando no lo está hace que se deje de mirar. Lo contrario solo cuesta trabajo.

---

## Primero, una corrección mía

Te dije que **A-02 estaba arreglado**. Está arreglado **a medias**, y el matiz importa.

El ternario de `firme` cubre **solo** el `leadEntrante.update`
(`leads.service.ts:484-501`). Las tres escrituras que vienen después, **dentro de la misma
transacción**, usan `coincide.participanteId` **en las dos ramas**:

```ts
await registrarToqueDeOrigen(tx, coincide.participanteId, …)   // :506-510
await tx.participante.updateMany({ where: { id: coincide.participanteId … } })  // :516-519
await tx.propuestaDeDatos.create({ data: { participanteId: coincide.participanteId … } })  // :529-534
```

Así que un lead que coincide **solo por correo** ya no se *ata* a esa ficha —eso sí se
arregló—, pero **le sigue estampando un toque de pauta, le fija el `origenLead` y le crea una
propuesta**. La ficha ajena se sigue tocando.

Es el patrón *"se cierra el camino principal y queda otro abierto"*, y dentro de la misma
función. Cerrarlo es mover tres líneas dentro del `if` que ya existe.

---

## Lo que José cerró de verdad

**A-01 — la mesa de entrada.** Cerrado, y bien: `@Get()` con `@Requiere('inscripciones')` en
**VER, no ESCRIBIR**, bajo `AdminGuard`, y —el detalle que importa— **el ámbito acota con un
`AND`, no con un spread** (`mesa-de-entrada.service.ts:43-49`), así que un `convenioId` de fuera
devuelve vacío en vez de devolverlo todo.

**La normalización del documento** en la puerta pública. Cerrada y seguida hasta su uso.

Y de paso: **el documento ya se normaliza en las siete puertas**, con prueba que lo vigila.

---

## Los 14 críticos, hoy

| | |
|---|---|
| Cerrados | **1** (A-01) |
| Cambio de forma, siguen críticos | **1** (A-03) |
| Vivos e intactos | **12** |

Doce están idénticos: `E-02`, `F-02` y `G-01` conservan **hasta los mismos números de línea**.

### A-03 · Y ahora es más probable que antes

`participanteId String? @unique` sigue en `schema.prisma:808`. Arreglar A-02 **acotó quién lo
dispara** —antes cualquier coincidencia, ahora solo el documento— pero **no lo cerró**.

Y aquí está lo que no habíamos visto: **la propia funcionalidad que José construyó lo hace más
probable.** `llave-del-lead.ts:47-58` mete el código del curso en la llave **a propósito**,
*"lo que permite que la misma persona se inscriba en varias formaciones"*.

Esa persona genera **dos filas `LeadEntrante`**, las dos cruzan **FIRME** contra la misma
ficha, y **la segunda viola el único**. Sin captura de `P2002` (grep en `src/leads`: cero) y sin
`ExceptionFilter` global → **500 crudo**.

Y se autooculta: el reintento entra por la guarda de idempotencia y contesta **200 con
`repetido: true`**. Como el `update` es la primera sentencia de la transacción, **el rollback se
lleva también el toque de origen, el `origenLead` y la propuesta**. El asesor nunca se entera de
que hay una ficha a la que parecerse.

> **Las 1022 pruebas verdes no pueden verlo.** `solo-lo-firme-ata.spec.ts:31-37` falsea
> `leadEntrante.update` con un `push` a un array. **Ahí no existe ningún índice único.** Es el
> mismo patrón que ya tenían `cambiar-etapa.spec.ts` y `cupos-editables.spec.ts`: la prueba es
> correcta para lo que prueba, y ciega para esto.

**La migración que lo cierra ya está escrita** (`migraciones-propuestas/09-…`) y tenía un solo
requisito de código: que el ramificado por `firme` estuviera en la misma imagen. **José acaba de
ponerlo.** El requisito está cumplido.

---

## La auditoría empeoró, y hay que decirlo

**C-01 y C-14 no solo siguen vivos: hoy tienen dos puertas más.**

`grep -c auditoria` da **0** en `lote.service.ts`, `mesa-de-entrada.service.ts`,
`conversion.service.ts` y `leads.service.ts`.

> **`POST /admin/leads/convertir-lote` crea hasta 100 `Persona`, 100 `Participante` y 100
> `AutorizacionDatos` en una sola llamada y no deja UNA sola fila en `registros_auditoria`.**
> El único rastro es un `this.log.log` a stdout.

El recuento, rehecho hoy con el mismo grep: **el denominador sigue en 71; el numerador en 13.
José añadió cero.**

Y algo que la auditoría original no decía: **cinco de las catorce acciones del catálogo no las
emite nadie** — `PARTICIPANTE_CREADO`, `ASESOR_ASIGNADO`, `NIT_ALTA_MANUAL`,
`RUI_RECONSULTADO`, `ESTADO_FORZADO`. **Crear una ficha —por el panel, por preinscripción, por
conversión o por lote— no deja bitácora en ningún sitio.** La palabra existe en el catálogo y no
la escribe nadie.

---

## 36 procesos incompletos

Caminos que empiezan y no llegan. No dan error: por eso nadie los nota hasta que hacen falta.
**Los cuatro que más pesan, y tres son nuevos:**

### 🔴 El cargue al SEP no se puede generar. Ninguno.

`sep.service.ts:368` aborta si `convenio.sepProyectoId` es `null` — *"Póngalo en Formación antes
de exportar"*. **Y ese campo no se puede poner en ningún sitio.** No hay pantalla, no hay ruta,
no hay seed que lo escriba.

Es el entregable contractual con el SENA, y está bloqueado por un campo que nadie puede rellenar.

### 🔴 El F7: seis columnas se leen y ninguna se puede llenar

`faltaEnF7` exige `tamanoSepId`, `departamentoSepId` y `municipioSepId` de `Empresa` — y **no
hay dónde ponerlos**.

### 🔴 El cargue masivo crea fichas sin autorización de datos

`crm.service.ts:2843` llama a `crear()` con `origen: 'EMPRESA'` y nada más. **`crm.crear` no
crea ninguna `AutorizacionDatos`.** Fichas de personas reales sin la constancia de habeas data
que hay que poder demostrar.

### El lote de José repite el defecto que el propio repositorio ya había resuelto

`lote.service.ts:117` convierte fila por fila y **no crea `CargaDeParticipantes` ni pone
`cargaId`**. El cargue de participantes sí lo hace —abre la fila antes de crear y la cierra
después— precisamente para saber qué pasó si se cae a la mitad.

### Y cosas que están construidas a medias en la propia mesa nueva

- **Con más de 50 leads, los demás son inalcanzables.** El servidor pagina bien; la pantalla
  lee `paginas > 1` solo para escribir *"viendo N"* y **no tiene ni un botón**.
- **La mesa enseña un filtro `DESCARTADO` y su contador, y nadie escribe ese estado.** Un
  contador que siempre dice 0 enseña a desconfiar de la pantalla entera.
- **Al asesor se le dice "confirme antes de unirlos" y no se le da con qué**: el motivo no
  nombra a la otra persona, la fila no trae el id de la ficha sospechosa, y **no existe ninguna
  ruta que ate el lead tras la confirmación**.
- `POST /admin/leads/:id/convertir` **sigue sin llamarse desde el frontend**. Ya no es código
  muerto por falta de `id` —la mesa lo devuelve—, pero sigue sin usarse.

### Columnas que ningún código de producción nombra

`Persona.tieneWhatsapp`, `whatsappRevisadoEn`, `Participante.revisarDocumento`,
`cargadoEnSepEn`, `Grupo.sedeUbicacionId`. **Cero apariciones** en los 297 ficheros de
producción. Procesos diseñados y nunca construidos.

---

## Riesgos que trae el código nuevo

Se le pasó el mismo rasero que al resto. La mayoría está bien hecho; esto es lo que no:

1. **PII en claro.** `mesa-de-entrada.service.ts:142-143` devuelve el documento sin tapar.
   `taparDocumento()` existe y **no se usa en ninguna respuesta de API** — solo en logs.
2. **Un parámetro sin validar llega al `where` de Prisma.** `mesa-de-entrada.controller.ts:50`
   recoge `estado` como string libre y el servicio lo mete con `as never`. El resto del panel
   valida los enums con `@IsEnum`.
3. **El texto crudo de la excepción sale al cliente en un 200.** `lote.service.ts:158` devuelve
   `e.message` por fila. Con la base caída, el mensaje de Prisma incluye el host.
4. **La conversión no es atómica.** Tres escrituras en tres transacciones distintas: si corta en
   medio, existe el `Participante` y el lead sigue `PENDIENTE`.

---

## Las 12 migraciones

**Ninguna se ha aplicado**, y el problema de fechas es real: José añadió
`20260831230000_lead_con_su_accion` y `20260901120000_convoca_crm`. Las mías empiezan en
`20260831090000`. Hay que renumerar.

La **09** —la que cierra A-03— es hoy la más valiosa de las doce: su único requisito de código
ya está cumplido.

---

## Balance

**Nada de lo que llevamos documentado es trabajo perdido**, pero tampoco está el sistema
arreglado. Lo que cambió:

- **1 crítico cerrado** de 14. Los otros 13 siguen.
- **La auditoría empeoró**: dos servicios nuevos, cero bitácora.
- **Aparecieron tres procesos rotos que no sabíamos**, y uno bloquea el entregable al SENA.
- **1022 pruebas en verde** — y la que más importa hoy **no puede ver** el fallo que busca.

Lo más barato y lo que más cierra, por este orden:

| Qué | Coste |
|---|---|
| Mover tres líneas dentro del `if` de `firme` | minutos |
| Aplicar la migración 09 (quita el `@unique`) — cierra **A-03** | ya escrita |
| `taparDocumento()` en la mesa · `@IsEnum` en el filtro | minutos |
| Emitir `PARTICIPANTE_CREADO`, que ya está en el catálogo | horas |
| Averiguar dónde se pone `sepProyectoId` | **desconocido, y bloquea el SEP** |
