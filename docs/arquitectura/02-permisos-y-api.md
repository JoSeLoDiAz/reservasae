# 02 · Matriz de permisos y contratos de API

**Fase 2 — diseño. Solo lectura: no se modificó ni una línea de código de producción.**

| | |
|---|---|
| Estado | Tercera pasada. La segunda se devolvió con `NO APROBAR TAL CUAL`: ocho choques nuevos y siete correcciones |
| Se conserva | **Parte 1** (estado actual) y **Parte 3** (guardias condicionales), aprobadas por el crítico |
| Se rehízo en la segunda | **§2.0**, **§2.2**, **§4.4**, **§5.1**, más los 11 choques y las 22 correcciones de la primera |
| Se corrige aquí | **§2.1** (dos filas de gate), **§2.2(b)**, **§2.4(a)**, **§4.4**, **§4.5**, **§4.6.B**, más las citas que faltaba rematar (lista al final) |
| Se añade | La fila que faltaba en la matriz: los controladores sin gate de cuenta (§1.6) |

## Cómo leer las marcas

- **`CONFIRMADO`** — se abrió el archivo y se leyó la línea. Las citas van `ruta:línea` **desde la raíz del repositorio la primera vez de cada sección** y abreviadas al nombre del archivo dentro de esa misma sección. Donde dos archivos comparten nombre —`plantillas.controller.ts` y `plantillas-correo.controller.ts`, `crm.service.ts` del servidor y `crm-api.ts` del cliente— la ruta va completa siempre.
- **`INFERIDO`** — se deduce de varias evidencias, ninguna concluyente por sí sola.
- **`NUEVO`** — no existe hoy. Es propuesta, y va marcada como tal en cada celda.
- **`NO ENCONTRADO`** — con el comando que usé, no con un silencio.

## Las siete reglas del dominio, y dónde las toca este documento

| Regla | Dónde la toca | Cómo queda |
|---|---|---|
| 1 · Nada se borra | §6.2 | Se escribe la **excepción nombrada** para configuración, en vez de dejar seis borrados vivos marcados «=». Y uno de los seis ni siquiera borra: el `DELETE` de plantillas de correo apaga |
| 2 · El sobrecupo es deliberado | §2.3 | La firma `AUTORIZAN_SOBRECUPO` va marcada **NUEVO y pendiente de aprobación**. Por defecto **no cambia nada**: `crm.service.ts:979-987` y `:3467-3475` se quedan tal cual |
| 3 · La lista de espera es deliberada | §0.1 | **Este documento no añade ni un valor al enum `EstadoReserva`.** No hay migración de enum en toda la entrega |
| 4 · Los títulos del SEP son el contrato | §4.6.E | `formato-cargue-sep.ts` y `formatos.spec.ts:97,:112,:153` no se tocan. El único cambio en `admin/sep` es de permiso, no de columna |
| 5 · El webhook responde 200 | §4.3 | **200 pase lo que pase con el contenido**, que es como lo dice el código. El 202 de la primera versión está retirado. La firma HMAC inválida sigue siendo `401` (`leads.controller.ts:173`) |
| 6 · Las migraciones corren solas | §2.4, §4.5, §5.1, §6.1 | **Los pasos 1 a 9 de §6.3 no llevan ninguna migración.** Ni `ALTER TYPE`, ni `GRANT`, ni `REVOKE`. Los dos catálogos que crecen son arrays de TypeScript. La única que sí hace falta es el almacén de la `Idempotency-Key` (§4.5): `CREATE TABLE` aditivo, y **por eso queda fuera de ese tramo** |
| 7 · Un valor de enum rompe los `Record` del frontend | §6.1 | Comprobado: `ACCIONES` y `ENTIDADES` no tienen espejo en `frontend/src` (§6.1, con el comando) |

---

# PARTE 0 · Qué se retiró de la primera versión

Once choques. Lo que sigue es qué se hizo con cada uno, para que el dueño no tenga que
cotejar dos documentos.

| # | Choque | Qué se hizo |
|---|---|---|
| 1 | `@Roles(SUPERADMIN)` en `CronogramaController` completo mataba el calendario para todo `GESTOR` | **Retirado.** Va por método (§2.2) |
| 2 | `@Firma` de ruta cerraba `PATCH :id/etapa` entero | **Retirado.** La firma se queda dentro del servicio (§2.0) |
| 3 | «`@Firma` recorta el ámbito» convertía un 403 explicado en un 404 mentiroso | **Retirado.** Ámbito y firma quedan separados (§2.0) |
| 4 | El 202 del webhook | **Retirado.** 200 (§4.3) |
| 5 | `soloLectura` a `cuposSolicitados` | **Retirado.** La columna se queda; lo que cambia es por dónde escribe el cargue (§2.4) |
| 6 | `Idempotency-Key` como clave natural | **Retirado.** Es cabecera de cliente por intento (§4.5) |
| 7 | `TOPE_POR_PAGINA = 300` universal | **Retirado.** Tres techos, cada uno en su sitio (§4.4) |
| 8 | `APP_FILTER` inyectando `AuditoriaService`; migración de `REVOKE` | **Retirados los dos.** El filtro no inyecta nada (§5.1). No hay `GRANT` ni `REVOKE` en ninguna parte del documento (§2.5) |
| 9 | Descarga de plantilla y verificación de Meta fuera de los carve-outs | **Corregido.** Los 12 handlers que escriben la respuesta, listados uno a uno (§5.4) |
| 10 | Retirar `DELETE admin/participantes/:id` con pantalla viva colgando | **Retirado.** La ruta se queda; cambia por dentro y se la llama por su nombre (§6.2) |
| 11 | Once acciones nuevas sin entrada en `ACCIONES` | **Corregido, y es peor de lo dicho:** también hay que ampliar `ENTIDADES` (§6.1) |

## §0.1 · Lo que este documento NO hace

Se dice de entrada porque en Fase 1 y en la primera pasada de Fase 2 se retiraron diseños
por esto:

- **No añade ni un valor a ningún enum de Postgres.** `EstadoReserva` (`backend/prisma/schema.prisma:257-261`), `EtapaParticipante` (`:711-725`) y `EstadoLeadEntrante` (`:738-745`) quedan exactamente como están. Los predicados que preguntan «¿no es `CANCELADA`?» no se tocan —`grep -rn "CANCELADA" --include=*.ts backend/src | grep -v spec` → **29 líneas**—, y `promoverListaDeEspera` (`backend/src/reservas/reservas.service.ts:384`) tampoco.
- **No lleva migración lo que entra por los pasos 1 a 9 de §6.3.** `backend/arrancar.sh:7` es `set -e` y `:29` es `pnpm exec prisma migrate deploy` en cada arranque: una migración que pueda fallar deja el backend en ciclo de reinicios. Los dos catálogos que crecen (§6.1) son arrays de TypeScript, y la columna que los guarda es `String`, no enum: `backend/prisma/schema.prisma:1560-1562` dice literalmente *«Validado contra un catálogo en código, no enum de PG»*. **CONFIRMADO**
- **La única excepción está dicha con su nombre:** el almacén de la `Idempotency-Key` (§4.5) es una tabla, y una tabla es una migración. Va en el paso 10 de §6.3 con la suya —un `CREATE TABLE`, sin `ALTER TYPE` ni columna `NOT NULL` sobre filas existentes— y **no** en el tramo que este documento declara sin migraciones. Decirlo importa: la versión anterior llevaba el contrato de idempotencia y la promesa de «cero migraciones» en el mismo documento, sin ver que se contradecían.
- **No toca `backend/src/crm/rui/`.**
- **No toca los títulos de columna del SEP.**

---

# PARTE 1 · El estado actual `CONSERVADA`

Esta parte la aprobó el crítico y se conserva. Se ha vuelto a verificar entera; los
recuentos siguen cuadrando. La única adición es **§1.6**, que el crítico pidió por escrito.

## §1.1 · Hay DOS cerraduras, y son independientes

`CONFIRMADO`

Toda ruta del panel pasa por `AdminGuard` (`backend/src/admin/admin.guard.ts:84`). Dentro
se resuelven dos preguntas distintas, en este orden:

| | Pregunta | Enum | Decorador | Dónde se resuelve |
|---|---|---|---|---|
| **Cuenta** | ¿Qué clase de cuenta es? | `RolAdmin` — `SUPERADMIN`, `GESTOR`, `CONSULTA` (`schema.prisma:1131-1135`) | `@Roles(...)` | `admin.guard.ts:214-220` |
| **Área** | ¿Qué área del proceso y con qué nivel? | `RolConvenio` — seis valores (`schema.prisma:1181-1188`) | `@Requiere(area, nivel)` | `admin.guard.ts:135-148` y `:228-237` |

**Las dos se resuelven con `getAllAndOverride([handler, class])`**, así que un decorador de
método **pisa** al de clase, y un decorador de clase alcanza a todos los métodos que no
tengan el suyo. Es exactamente el mecanismo que hizo que la primera versión de §2.2 matara
el calendario.

Y son **independientes**: `@Roles` niega en `:218-220`, **antes y aparte** del área. Tener
`inscripciones: ESCRIBIR` no salva de un `@Roles` que no incluya tu `RolAdmin`, y al revés,
ser `SUPERADMIN` no da área ninguna — `alcance` se calcula solo de `AdminConvenio`
(`:120-148`).

Además, el ámbito de convenios se recorta **una vez, en el guard** (`:118-119`, con el
motivo escrito: *«olvidarlo en una sola deja escapar el otro convenio»*), y la cabecera
`x-gremio` **recorta y nunca amplía** (`:150-161`).

## §1.2 · La matriz de áreas vigente

`CONFIRMADO` · `backend/src/admin/permisos.ts:28-80`

| `RolConvenio` | reserva | inscripciones | inscritos | reportes | academico | configuracion |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GESTOR_INSCRIPCION` | 👁 VER | ✅ ESCRIBIR | 👁 VER | 👁 VER | 👁 VER | — |
| `LIDER_INSCRIPCION` | ✅ ESCRIBIR | ✅ ESCRIBIR | 👁 VER | ✅ ESCRIBIR | 👁 VER | — |
| `GESTOR_ACADEMICO` | 👁 VER | 👁 VER | 👁 VER | — | ✅ ESCRIBIR | — |
| `LIDER_ACADEMICO` | 👁 VER | 👁 VER | 👁 VER | — | ✅ ESCRIBIR | — |
| `LIDER_SISTEMAS` | ✅ ESCRIBIR | ✅ ESCRIBIR | 👁 VER | ✅ ESCRIBIR | ✅ ESCRIBIR | ✅ ESCRIBIR |
| `CONSULTA` | 👁 VER | 👁 VER | 👁 VER | — | 👁 VER | — |

Varias filas en el mismo convenio **suman**: manda la mayor (`permisos.ts:89-96`).
`reportes` va aparte de `inscritos` con el motivo escrito en `:25-26`: *«el archivo del SEP
lleva 800 cédulas»*.

## §1.3 · Las tres listas de FIRMA que ya existen

`CONFIRMADO`

El par área/nivel **no distingue** a un gestor de un líder: los dos tienen
`inscripciones: ESCRIBIR`. Para eso hay tres listas aparte, y el código lo dice con esas
mismas palabras en `backend/src/admin/admin.controller.ts:135-138`.

| Lista | Definición | Helper por convenio | Quiénes |
|---|---|---|---|
| `CIERRAN_FORMACION` | `permisos.ts:102` | `conveniosQueCierran` `:106-109` | `LIDER_ACADEMICO`, `LIDER_SISTEMAS` |
| `MUEVEN_INSCRITO` | `permisos.ts:125-129` | `conveniosQueMuevenInscrito` `:131-136` | `LIDER_INSCRIPCION`, `LIDER_ACADEMICO`, `LIDER_SISTEMAS` |
| `REPARTEN_FICHAS` | `permisos.ts:149-153` | `conveniosQueReparten` `:155-158` | `LIDER_INSCRIPCION`, `LIDER_ACADEMICO`, `LIDER_SISTEMAS` |

> **`CIERRAN_FORMACION` es subconjunto de `MUEVEN_INSCRITO`.** Exigir «las dos» es un no-op:
> es exactamente `CIERRAN_FORMACION`. Se dice así y no de la otra manera.

**Se responden por convenio, no en general** (`permisos.ts:104-105`): se puede liderar
académico en un gremio y solo digitar en el otro. Por eso los tres helpers devuelven una
**lista de `convenioId`**, no un booleano.

## §1.4 · Las invariantes que hay escritas como prueba

`CONFIRMADO` · `backend/src/admin/permisos.spec.ts`

1. `:22-26` — todos ven la pre-reserva: es el contexto común.
2. `:28-33` — solo `LIDER_SISTEMAS` escribe `configuracion`.
3. `:35-38` — el gestor de inscripciones ve el alistamiento y **no** descarga.
4. `:40-43` — el área académica **no toca** el archivo con las cédulas.
5. `:45-48` — **cada gestor ve el área del otro sin poder tocarla**: `GESTOR_INSCRIPCION.academico` es `VER` y `GESTOR_ACADEMICO.inscripciones` es `VER`.
6. `:50-52` — `CONSULTA` (el `RolConvenio`) no escribe en ningún sitio.

Más `:15-20`, que exige fila para **todos** los valores del enum: *«un rol sin fila daría
NADA en silencio»*.

**Son SIETE `it` en ese `describe` (`:13`), no seis**, y cualquier cambio a §1.2 tiene que
pasarlos todos. Las de §2 los pasan: no se toca la tabla de áreas. La quinta importa más de
lo que parece para la nota de §2.1 sobre `PATCH :id/etapa`: es la que fija por escrito que un
gestor de inscripciones **ve** el área académica y al revés, y que ver no es tocar.

## §1.5 · El censo de decoradores

`CONFIRMADO`

```
find backend/src -name "*.controller.ts" | wc -l        →  19
grep -rn "@Requiere(" --include=*.ts backend/src | wc -l →  61
grep -rn "@Roles("    --include=*.ts backend/src | wc -l →  32
```

## §1.6 · LA FILA QUE FALTABA · `RolAdmin.CONSULTA` no está cerrado `NUEVA`

`CONFIRMADO`

La primera versión dio esto por cerrado. No lo está. **Siete controladores con `AdminGuard`
no tienen `@Roles` de clase**, así que su gate de cuenta lo pone —o no lo pone— cada método:

| Controlador | Línea | Gate de área de la clase | Qué alcanza una cuenta `RolAdmin.CONSULTA` |
|---|---|---|---|
| `backend/src/plantillas/plantillas.controller.ts` | `:31-33` | *(ninguno en la clase)* | Con `LIDER_INSCRIPCION` o `LIDER_SISTEMAS` (`reserva: ESCRIBIR`): **corre el cargue masivo**, `:96-97` |
| `backend/src/correo/campanas/campanas.controller.ts` | `:40-43` | `@Requiere('inscripciones','ESCRIBIR')` | Con **cualquier** rol de inscripciones —gestor incluido—: **lanza campañas**, `:206-208` |
| `backend/src/tableros/tableros.controller.ts` | `:39-44` | `@Requiere('reserva')` | Lecturas. Los tres export llevan su `@Roles` propio (`:144`, `:224`, `:300`) |
| `backend/src/instituciones/instituciones.controller.ts` | `:26-29` | `@Requiere('reserva','VER')` | Con `reserva: ESCRIBIR`: verifica, desverifica y aplica propuestas (`:81-126`) |
| `backend/src/correo/correo.controller.ts` | `:25-28` | `@Requiere('configuracion','ESCRIBIR')` | Con `LIDER_SISTEMAS`: manda correo de prueba (`:64`) |
| `backend/src/correo/plantillas/plantillas-correo.controller.ts` | `:24-27` | `@Requiere('configuracion','ESCRIBIR')` | Con `LIDER_SISTEMAS`: crea, edita y **apaga** plantillas (`:41`, `:50`, `:61`) |
| `backend/src/leads/meta-pruebas.controller.ts` | `:76-78` | *(ninguno en la clase)* | Con `LIDER_SISTEMAS`: `:267-269` y `:410-412` |

El de campañas es el peor, y es peor de lo que se había dicho: **no hace falta ser líder**.
`GESTOR_INSCRIPCION` ya tiene `inscripciones: ESCRIBIR` (`permisos.ts:31`), así que una
cuenta `RolAdmin.CONSULTA` con el rol de convenio más bajo que escribe algo **lanza una
campaña de correo a la base entera**.

> Es el hallazgo crítico nº 1 de Fase 0, y sigue abierto. La corrección va en **§2.2**, y
> **no** es poner siete `@Roles` de clase.

`AdminController` (`:65-67`) tampoco tiene `@Roles` de clase, pero es un caso distinto y no
va en esta lista: sus escrituras sin `@Roles` son de autoservicio sobre la propia cuenta
—`POST admin/clave` (`:169-171`) y `PATCH admin/perfil` (`:176`)— y dos calculadoras sin
estado, `POST admin/apariencia/derivar` y `/corregir` (`:356-370`). Ninguna lleva
`@Requiere`. **CONFIRMADO**

## §1.7 · Los 17 CHECK que hay en la base

`CONFIRMADO` · `grep -rn "CHECK (" backend/prisma/migrations/ | wc -l` → **17**

| # | Nombre | Fichero:línea |
|---|---|---|
| 1 | `ofertas_cupos_dentro_del_tope` | `backend/prisma/migrations/20260729000000_modelo_inicial/migration.sql:389` |
| 2 | `ofertas_tope_no_negativo` | `…20260729000000_modelo_inicial/migration.sql:393` |
| 3 | `reservas_cupos_no_negativos` | `…20260729000000_modelo_inicial/migration.sql:397` |
| 4 | `reservas_reparto_coherente` | `…20260729000000_modelo_inicial/migration.sql:404` |
| 5 | `reservas_cancelada_sin_cupos` | `…20260729000000_modelo_inicial/migration.sql:411` |
| 6 | `politicas_datos_version_positiva` | `…20260814120000_politica_por_destinatario/migration.sql:25` |
| 7 | `politicas_datos_vigencia_coherente` | `…20260814120000_politica_por_destinatario/migration.sql:29` |
| 8 | `participantes_asistencia_valida` | `…20260814140000_crm_personas_y_participantes/migration.sql:214` |
| 9 | `participantes_nota_valida` | `…20260814140000_crm_personas_y_participantes/migration.sql:219` |
| 10 | **`participantes_sobrecupo_justificado`** | `…20260814140000_crm_personas_y_participantes/migration.sql:224` |
| 11 | `participantes_retiro_fechado` | `…20260814140000_crm_personas_y_participantes/migration.sql:229` |
| 12 | `avances_calificacion_valida` | `…20260814160000_lms_actividades_y_avance/migration.sql:69` |
| 13 | `avances_completada_fechada` | `…20260814160000_lms_actividades_y_avance/migration.sql:74` |
| 14 | `actividades_orden_positivo` | `…20260814160000_lms_actividades_y_avance/migration.sql:79` |
| 15 | `personas_estrato_valido` | `…20260815040000_campos_del_sep/migration.sql:55` |
| 16 | `personas_tipo_documento_conocido` | `…20260815060000_documento_por_id_del_sep/migration.sql:32` |
| 17 | `carga_recuentos_no_negativos` | `…20260830140000_historico_de_importaciones/migration.sql:28` |

El nº 10 es el del sobrecupo: `("sobrecupoPorId" IS NULL) = ("sobrecupoMotivo" IS NULL)`,
con el comentario *«un sobrecupo sin motivo no es una autorización»*. **Nada en este
documento lo toca.**

> **Cómo se comprueba esta tabla, y por qué el regex ingenuo no vale.** Solo **3** de los 17
> llevan el `ADD CONSTRAINT` y el `CHECK (` en el mismo renglón: los nº 6, 14 y 17. Los **14**
> restantes parten el `CHECK` en la línea siguiente —por eso la columna «Fichero:línea» de
> arriba apunta al `ADD CONSTRAINT`, que es donde está el nombre—. Un regex por línea casaría
> tres y la prueba pasaría en vano. Hay que leer el `.sql` entero y casar multilínea (§5.3).

---

# PARTE 2 · La matriz objetivo `REHECHA`

## §2.0 · Qué es una FIRMA, y dónde vive `REHECHO`

**La primera versión proponía un decorador `@Firma` en la ruta. Está retirado**, por dos
razones que se sostienen la una a la otra:

1. **Un decorador es incondicional; las tres listas de hoy no lo son.** `MUEVEN_INSCRITO`
   solo bloquea si `saleDelCupo(p.etapa, dto.etapa)` (`backend/src/crm/crm.service.ts:2114-2116`).
   `CIERRAN_FORMACION` solo si `CIERRES_DE_FORMACION.includes(dto.etapa)` (`:2192-2194`).
   `REPARTEN_FICHAS` solo sobre las fichas **de verdad** del lote, no sobre lo que venga en
   el cuerpo (`:1658-1660`). Un decorador en `crm.controller.ts:432-433` no ve `dto.etapa`
   ni la etapa actual: cerraría `PATCH admin/participantes/:id/etapa` entero y le quitaría a
   `GESTOR_INSCRIPCION` el `INTERESADO → CONTACTADO` — justo lo que `permisos.ts:120-123`
   promete por escrito que conserva: *«Al gestor no se le quita el trabajo: mueve todo lo de
   antes»*.
2. **Recortar el ámbito con la firma cambia un 403 explicado por un 404 mentiroso.** Si la
   firma filtrara `ambito.convenios`, `exigirParticipante` (`crm.service.ts:3631-3638`)
   contestaría *«Ese participante no existe»* donde hoy contesta el texto de `:2118-2123`
   (*«…lo hace un líder. Pídalo con el motivo y queda registrado»*). Son dos preguntas
   distintas: **el ámbito pregunta «¿de qué gremio?»; la firma, «¿con qué rango?»**. El 404
   de `exigirParticipante` es deliberado y se queda (Fase 1: *«un 403 confirmaría que esa
   persona existe»*).

### Lo que sí se propone: nombrar el patrón que ya existe

`CONFIRMADO` — el mecanismo entero está construido y no tiene nombre:

```
crm.controller.ts:447-448   conveniosQueCierran(ambito.roles),
                            conveniosQueMuevenInscrito(ambito.roles)   → parámetros del servicio
crm.controller.ts:382       conveniosQueReparten(ambito.roles)         → parámetro del servicio
crm.service.ts:2116, :2194  cierran.includes(p.convenioId)             → decisión CONDICIONAL, dentro
admin.controller.ts:144-147 puede: { repartirFichas, sacarDeInscrito } → lo mismo, para la pantalla
```

Y el comentario de `admin.controller.ts:135-143` ya dice, palabra por palabra, la distinción
que este documento necesita:

> *«Hay cosas que un gestor y un líder NO comparten y que el par área/nivel no distingue:
> los dos tienen `inscripciones: ESCRIBIR`. […] Esto es para que la PANTALLA no ofrezca lo
> que el servidor va a rechazar. La cerradura sigue estando en el servidor.»*

**La propuesta, entera:**

| | Qué | Marca |
|---|---|---|
| **F1** | Un decorador de **parámetro** `@Firmas()`, hermano de `@AmbitoActual()` (`backend/src/admin/admin-actual.decorator.ts:19-27`), que devuelve `{ cierran, muevenInscrito, reparten }` resueltos de `peticion.ambito.roles`. Sustituye las tres llamadas a mano del controlador. **No niega nada**: solo transporta. | `NUEVO` |
| **F2** | La decisión **se queda donde está**: `crm.service.ts:2114-2123`, `:2192-2200`, `:1658-1666`. Ni una línea se mueve. | `=` |
| **F3** | El ámbito **no se toca**. `ambito.convenios` sigue siendo lo que es, y los mensajes de `:2118-2123` y `:2196-2199` se quedan. | `=` |
| **F4** | Rellenar el bloque `puede` de `GET /admin/yo` con la tercera firma, `cerrarFormacion`, que hoy no está (`admin.controller.ts:144-147` tiene dos de tres). **Atado a que la pantalla lea las tres**: hoy `sacarDeInscrito` se calcula y no lo lee nadie (ver abajo), y añadir una tercera clave muerta es sembrar más de lo mismo. Entra con su consumidor o no entra. | `NUEVO` |

> **Y un defecto que sale al mirar esto:** `puede.sacarDeInscrito` se calcula
> (`admin.controller.ts:146`), se declara en el cliente (`frontend/src/lib/admin-api.ts:95`)
> y **no lo lee ninguna pantalla**. `grep -rn "sacarDeInscrito" frontend/src` devuelve solo
> esa declaración; `repartirFichas` sí se usa (`frontend/src/app/admin/participantes/[id]/page.tsx:378`
> y `:2023`). O sea que el botón de sacar de INSCRITO se le ofrece al gestor y el servidor
> se lo niega — el error que el propio comentario de `:140-143` dice querer evitar. Es una
> línea de frontend, y va fuera del alcance de solo-lectura de esta fase. **CONFIRMADO**

## §2.1 · La matriz rol × entidad × acción

Filas: entidad · acción. Columnas: los seis `RolConvenio`. Leyenda:

- ✅ puede — 👁 solo ve — **—** no puede
- **🖊 firma** — puede, pero además tiene que estar en la lista de firma que dice la columna «Firma»
- Columna **«Gate de cuenta»**: qué `RolAdmin` deja pasar la ruta. `T` = los tres.

### A · Reserva de cupos (empresa)

| Entidad · acción | Ruta | GI | LI | GA | LA | LS | CONS | Firma | Gate cuenta | Dónde se comprueba |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|---|---|
| Reserva · crear | `POST /reservas` | *pública, sin sesión* | | | | | | — | *ninguno* | `backend/src/reservas/reservas.controller.ts:27-28`, throttle 10/min |
| Reserva · consultar por NIT | `GET /reservas` | *pública* | | | | | | — | *ninguno* | `reservas.controller.ts:38-39`, throttle 15/min |
| Reserva · editar cupos | `PATCH /reservas/:id` | *pública, con NIT* | | | | | | — | *ninguno* | `reservas.controller.ts:44-45`, throttle 20/min |
| Reserva · cancelar | `POST /reservas/:id/cancelar` | *pública, con NIT* | | | | | | — | *ninguno* | `reservas.controller.ts:56-58`, throttle 20/min |
| Reserva · ver en tablero | `GET /admin/tableros/reservas` | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 | — | `T` · **`=`** | `tableros.controller.ts:135` bajo `@Requiere('reserva')` `:43` |
| Reserva · cancelar desde el panel | `POST /admin/tableros/reservas/:id/cancelar` | — | — | — | — | — | — | — | `SA` | `tableros.controller.ts:112-115` |
| Reserva · corregir cupos/contacto por cargue | `POST /admin/plantillas/reservas/cargar` | — | ✅ | — | — | ✅ | — | — | `T` → **`SA`+`G`** `NUEVO` | `plantillas.controller.ts:96-97`, `@Requiere('reserva','ESCRIBIR')` |

> `POST /admin/tableros/reservas/:id/cancelar` lleva `@Roles(SUPERADMIN)` y
> `@Requiere('reserva','VER')` (`:114-115`). El gate de cuenta es el que manda ahí: **el de
> área pide solo VER**, y por eso ningún `RolConvenio` abre esa fila por sí solo.

> **Y una fila que NO cambia de gate, aunque la versión anterior de esta tabla dijera que sí.**
> `GET /admin/tableros/reservas` es una lectura: su clase pide `@Requiere('reserva')` —nivel
> `VER`— en `tableros.controller.ts:43`. La regla de §2.2(b) **solo dispara con `ESCRIBIR`**,
> así que ahí no llega, y §2.2(b) promete por escrito que los tableros se siguen viendo.
> Marcarla `T` → `SA`+`G` era hacer que la matriz contradijera al párrafo que la explica —el
> mismo defecto del choque 1 de la primera versión, en otra tabla—. **Se queda en `T`.** Lo
> mismo con `GET /admin/instituciones*` (§2.1.F), bajo `@Requiere('reserva','VER')`
> (`instituciones.controller.ts:28`). **CONFIRMADO**

### B · Participante — la ficha de la persona

Gate de cuenta de todo `admin/participantes`: `@Roles(SUPERADMIN, GESTOR)` en
`backend/src/crm/crm.controller.ts:119`, con el motivo escrito en `:117-118`
(*«aquí viven cédulas, celulares y correos de terceros»*). Gate de área de clase:
`@Requiere('inscripciones')` (`:120`).

| Entidad · acción | Ruta | GI | LI | GA | LA | LS | CONS | Firma | Dónde se comprueba |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|---|
| Participante · listar | `GET /admin/participantes` | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 | — | `crm.controller.ts:284` |
| Participante · ver ficha | `GET /admin/participantes/:id` | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 | — | `:386`, ámbito por `exigirParticipante` (`crm.service.ts:3631-3638`) |
| Participante · crear | `POST /admin/participantes` | ✅ | ✅ | — | — | ✅ | — | — | `:391-392` |
| Participante · editar datos | `PATCH /admin/participantes/:id` | ✅ | ✅ | — | — | ✅ | — | — | `:402-403` |
| Participante · **mover etapa (antes de INSCRITO)** | `PATCH /admin/participantes/:id/etapa` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | `:432-433`, `@Requiere(['inscripciones','academico'],'ESCRIBIR')` |
| Participante · **sacar del cupo** (`saleDelCupo`) | *(la misma ruta)* | 🖊 | 🖊 | 🖊 | 🖊 | 🖊 | — | `MUEVEN_INSCRITO` | `crm.service.ts:2114-2123` — **condicional a la transición** |
| Participante · **certificar / no aprobar** | *(la misma ruta)* | 🖊 | 🖊 | 🖊 | 🖊 | 🖊 | — | `CIERRAN_FORMACION` | `crm.service.ts:2192-2200` — **condicional al destino** |
| Participante · asignar formación/grupo | `PATCH /admin/participantes/:id/formacion` | ✅ | ✅ | — | — | ✅ | — | — | `:452-453` |
| Participante · **autorizar sobrecupo** | *(en `POST` y en `PATCH :id/formacion`)* | ✅ | ✅ | — | — | ✅ | — | `AUTORIZAN_SOBRECUPO` `NUEVO` · **pendiente de aprobación** | `crm.service.ts:979-987` y `:3467-3475` |
| Participante · repartir asesor (lote) | `PATCH /admin/participantes/lote/asesor` | 🖊 | 🖊 | 🖊 | 🖊 | 🖊 | — | `REPARTEN_FICHAS` | `crm.controller.ts:369-370` + `crm.service.ts:1658-1666` |
| Participante · quitar de este curso | `DELETE /admin/participantes/:id` | — | — | — | — | — | — | — | `:415-417`, `@Roles(SUPERADMIN)` |
| Participante · notas | `POST /admin/participantes/:id/notas` | ✅ | ✅ | — | — | ✅ | — | — | `:599-600` |
| Participante · histórico y restablecer | `GET :id/historico` · `POST :id/historico/:valorId/restablecer` | 👁 / ✅ | 👁 / ✅ | 👁 / — | 👁 / — | 👁 / ✅ | 👁 / — | — | `:523`, `:530-531` |
| Participante · revocar autorización | `POST /admin/participantes/:id/revocar-autorizacion` | ✅ | ✅ | — | — | ✅ | — | — | `:587-588` |
| Participante · cargue masivo (previsualizar/confirmar) | `POST :carga/previsualizar` · `carga/archivo` · `carga/confirmar` | ✅ | ✅ | — | — | ✅ | — | — | `:292-293`, `:304-305`, `:357-358` |
| Participante · control / cumplimiento | `GET /admin/participantes/control*` | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 | — | `:177-178`, `:202-203`, `:224-225` — `@Requiere('inscritos')` |
| Participante · tablero académico | `GET /admin/participantes/academico*` | 👁 | 👁 | ✅ | ✅ | ✅ | 👁 | — | `:244-245`, `:254-255` — `@Requiere('academico')` |

> **Sobre las celdas 🖊 de «mover etapa».** Nada en el código distingue hoy a
> `inscripciones:ESCRIBIR` de `academico:ESCRIBIR` en esa ruta: `crm.controller.ts:433` es un
> único `@Requiere(['inscripciones','academico'], 'ESCRIBIR')`, que el guard resuelve como un
> **OR comprobado una vez** (`admin.guard.ts:140-148`, con el comentario de `:142-143`:
> *«varias areas = basta con alcanzar en una»*). Lo que separa a un rol de otro en esa ruta son **las firmas y
> la escalera**, no el área. Cualquier lectura de esta tabla que dé por hecha una
> comprobación por área dentro de la ruta está leyendo de más.

### C · Persona (los datos personales) y el enlace público

| Entidad · acción | Ruta | Quién | Marca |
|---|---|---|---|
| Persona · preinscribirse | `POST /preinscripcion/:slug` | cualquiera, sin sesión | `backend/src/preinscripcion/preinscripcion.controller.ts:22`, con `/** Público: no lleva guard. */` en `:12` |
| Persona · completar su propia ficha | `PATCH /completar/:token` | el titular, con su token | `preinscripcion.controller.ts:56` |
| Persona · corregir su organización | `PATCH /completar/:token/empresa` | el titular | `:65` |
| Persona · buscar NIT | `GET /directorio/nit/:nit` | público a propósito, razonado en `:33-36` | `:41` |

### D · Cronograma — fechas y cupos de los grupos

Gate de clase hoy: `@Roles(SUPERADMIN, GESTOR)` + `@Requiere('reserva')`
(`backend/src/cronograma/cronograma.controller.ts:12-13`).

| Entidad · acción | Ruta | GI | LI | GA | LA | LS | CONS | Gate cuenta | Marca |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|---|
| Cronograma · **ver el calendario** | `GET /admin/cronograma` | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 | `SA`+`G` | **`=` · no se toca** |
| Grupo · cambiar fechas y horario | `PATCH /admin/cronograma/grupos/:id` | — | — | — | — | ✅ | — | `SA`+`G` → **`SA`** `NUEVO` | §2.2 |
| Cobertura · repartir cupos | `PATCH /admin/cronograma/coberturas/:id/cupos` | — | — | — | — | ✅ | — | `SA`+`G` → **`SA`** `NUEVO` | §2.2 |

### E · Reportes al SENA

| Entidad · acción | Ruta | GI | LI | GA | LA | LS | CONS | Gate cuenta |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| SEP · ver alistamiento | `GET /admin/sep/alistamiento` · `alistamiento-f7` | 👁 | 👁 | — | — | 👁 | — | `SA`+`G` (`sep.controller.ts:20`) |
| SEP · **descargar el archivo con las cédulas** | `GET /admin/sep/exportar` | — | ✅ | — | — | ✅ | — | `SA`+`G` |

Es la invariante 3 y la 4 de §1.4, y **está bien resuelta hoy**: el gestor ve cuántos entran,
el archivo lo saca su líder (`sep.controller.ts:42-45`).

### F · Instituciones / empresas

| Entidad · acción | Ruta | GI | LI | GA | LA | LS | CONS | Gate cuenta |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Institución · listar / ver | `GET /admin/instituciones*` | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 | `T` · **`=`** — es `VER` |
| Institución · editar | `PATCH /admin/instituciones/:id` | — | ✅ | — | — | ✅ | — | `T` → **`SA`+`G`** `NUEVO` |
| Institución · verificar / desverificar | `POST :id/verificar` · `:id/desverificar` | — | ✅ | — | — | ✅ | — | idem |
| Institución · aplicar propuesta | `POST /admin/instituciones/propuestas/:id/aplicar` | — | ✅ | — | — | ✅ | — | idem |
| Institución · corregir por cargue | `POST /admin/plantillas/instituciones/cargar` | — | ✅ | — | — | ✅ | — | idem |

`backend/src/instituciones/instituciones.controller.ts:26-29`, `:68-69`, `:81-88`, `:100-101`, `:125-126`.

### G · Campañas y correo

| Entidad · acción | Ruta | GI | LI | GA | LA | LS | CONS | Gate cuenta |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Campaña · listar / segmentos / variables | `GET /admin/campanas*` | ✅ | ✅ | — | — | ✅ | — | `T` → **`SA`+`G`** `NUEVO` |
| Campaña · crear y editar | `POST /admin/campanas` · `PATCH :id` | ✅ | ✅ | — | — | ✅ | — | idem |
| Campaña · **lanzar** | `POST /admin/campanas/:id/lanzar` | ✅ | ✅ | — | — | ✅ | — | idem — **hoy la alcanza `RolAdmin.CONSULTA`** |
| Plantilla de correo · crear / editar / **apagar** | `POST` · `PATCH :id` · `DELETE :id` (que **no borra**: `apagar`) | — | — | — | — | ✅ | — | `T` → **`SA`+`G`** `NUEVO` |
| Correo · estado y prueba | `GET /admin/correo/estado` · `POST probar` | — | — | — | — | ✅ | — | idem |

`campanas.controller.ts:40-43`, `:206-208`; `plantillas-correo.controller.ts:24-27`,
`:41`, `:50`, `:61`; `correo.controller.ts:25-28`, `:38`, `:64`.

> **Por qué en estas tres filas el gate nuevo alcanza también a los `GET`.** Las clases de
> campañas, correo y plantillas de correo piden `ESCRIBIR` (`campanas.controller.ts:42`,
> `correo.controller.ts:27`, `plantillas-correo.controller.ts:26`), y un `@Requiere` de clase
> alcanza a todos los métodos que no traigan el suyo (§1.1). Así que aquí «`T` → `SA`+`G`»
> vale también para lo que solo se lee. Es el precio declarado de la regla, y va desarrollado
> en §2.2(b).
>
> **Y el `DELETE :id` de plantillas de correo no borra:** el método se llama `apagar` y hace
> `update … { activa: false }` (`plantillas-correo.service.ts:153-159`). Ver §6.2.

### H · Configuración: formularios, políticas, marca, acciones

| Entidad · acción | Ruta | GI | LI | GA | LA | LS | CONS | Gate cuenta |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Formulario · leer / crear / editar | `GET·POST·PATCH /admin/formularios*` | — | — | — | — | ✅ | — | `SA`+`G` (`formularios.controller.ts:34`) |
| Formulario · duplicar / borrar / apariencia | `POST :id/duplicar` · `DELETE :id` · `PATCH :id/apariencia` | — | — | — | — | ✅ | — | `SA` (`:79`, `:102`, `:110`) |
| Sección / opción · borrar | `DELETE secciones/:id` · `DELETE opciones/:id` | — | — | — | — | ✅ | — | `SA` (`:130`, `:174`) |
| Política de datos · crear / editar | `POST` · `PATCH :id` | — | — | — | — | ✅ | — | `SA`+`G` (`politicas.controller.ts:24-25`) |
| Política de datos · borrar | `DELETE /admin/politicas/:id` | — | — | — | — | ✅ | — | `SA` (`:59`) — y el servicio se niega si alguien la aceptó (`politicas.service.ts:188-192`) |
| Marca / tema / logos | `PATCH admin/marca*` · `admin/logos*` | — | — | — | — | ✅ | — | `SA` (`admin.controller.ts:221,:266,:277,:299,:309,:332,:343`) |
| Acción de formación · publicar | `PATCH /admin/acciones/:id` | — | — | — | — | ✅ | — | `SA`+`G` (`admin.controller.ts:385-386`) |
| Cuentas · listar / crear / editar / clave | `admin/usuarios*` | *(sin área)* | | | | | | `SA` (`admin.controller.ts:184,:190,:196,:206`) |

### I · Leads

| Entidad · acción | Ruta | GI | LI | GA | LA | LS | CONS | Gate cuenta |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Lead · entra por el orquestador | `POST /webhooks/leads` | *llave propia, sin sesión* | | | | | | `LlaveDeLeadsGuard` (`leads.controller.ts:67`) |
| Lead · entra por Meta | `POST /webhooks/leads/meta` | *firma HMAC del gremio* | | | | | | `leads.controller.ts:166-174` |
| Lead · verificación de Meta | `GET /webhooks/leads/meta` | *token de verificación* | | | | | | `:105-135` |
| Lead · convertir en ficha | `POST /admin/leads/:id/convertir` | ✅ | ✅ | — | — | ✅ | — | `SA`+`G` (`conversion.controller.ts:24-25`, `:30-31`) |
| Lead · **listar la mesa de entrada** | *(no existe ruta)* | | | | | | | **`NO ENCONTRADO`** — es A-01 de Fase 1 |

### J · Auditoría

| Entidad · acción | Ruta | Quién | Marca |
|---|---|---|---|
| Registro de auditoría · leer el historial de una ficha | `GET /admin/participantes/:id/historico` | quien vea la ficha | `crm.controller.ts:523` |
| Registro de auditoría · escribir | *(nunca por HTTP)* | solo el servidor | `comun/auditoria.service.ts:116-135` |
| Registro de auditoría · **borrar** | — | **nadie debería** — hoy la app es dueña del esquema | C-06 de Fase 1. Fuera del alcance de este documento: exige rol de aplicación aparte y su propio ADR (§2.5) |

## §2.2 · El gate de cuenta: dos cambios, y ninguno de clase-entera `REHECHO`

### (a) Cronograma — por método, nunca por clase

**Retirado** el `@Roles(RolAdmin.SUPERADMIN)` sobre `CronogramaController` completo. El guard
resuelve `@Roles` con `getAllAndOverride([handler, class])` (`admin.guard.ts:214-217`) y
niega en `:218-220`, **antes y aparte del área**, así que un decorador de clase también
alcanza al `@Get()` de `cronograma.controller.ts:17-20`. Pantalla viva que se caía:
`frontend/src/app/admin/acciones/page.tsx:10` (`CronogramaVista`) contra
`frontend/src/lib/admin-api.ts:377`.

```
cronograma.controller.ts:12   @Roles(SUPERADMIN, GESTOR)   ← la clase se queda como está
cronograma.controller.ts:17   @Get()                       ← el calendario, intacto
cronograma.controller.ts:25   @Patch('grupos/:id')         ← + @Roles(RolAdmin.SUPERADMIN)   NUEVO
cronograma.controller.ts:42   @Patch('coberturas/:id/cupos') ← + @Roles(RolAdmin.SUPERADMIN) NUEVO
```

> **Cambia el comportamiento y hay que aprobarlo.** Hoy una cuenta `RolAdmin.GESTOR` con
> `LIDER_SISTEMAS` puede mover fechas; con esto ya no. El pedido escrito era *«nadie puede
> modificar fechas de cronograma si no es administrador»* (Fase 1, E-01), pero conviene que
> el dueño diga si «administrador» quiere decir `SUPERADMIN` o quiere decir `LIDER_SISTEMAS`.
> **Si dice lo segundo, este cambio no va y el hueco real de cronograma es solo el de
> auditoría** (E-01: *«el permiso sí se exige — pero no queda constancia»*), que se resuelve
> en §6.1.

> **Y si se aprueba, la pantalla entra con él: hoy se quedaría ofreciendo lo que el servidor
> va a negar.** `frontend/src/components/admin/cronograma-vista.tsx:95` decide con
> `alcanza(admin.permisos?.configuracion, 'ESCRIBIR')` — **solo el área** —, y el comentario
> de `:93-94` dice que es a propósito: *«por el permiso, no por el rol de cuenta: quien
> configura la formacion es el lider de sistemas»*. Con el `@Roles(SUPERADMIN)` por método,
> una cuenta `RolAdmin.GESTOR` con `LIDER_SISTEMAS` seguiría viendo los controles (`:443`,
> `:555`, `:638`) y se llevaría un 403 al guardar (`:589`, fechas; `:750`, cupos). El dato ya
> viaja: `admin.rol` sale de `vistaAdmin` (`backend/src/admin/admin.service.ts:51`) y está
> tipado en `frontend/src/lib/admin-api.ts:79`. Es una línea de frontend y va fuera del
> alcance de solo-lectura de esta fase, pero **no puede ir en otra entrega distinta que el
> decorador**. **CONFIRMADO**

### (b) `RolAdmin.CONSULTA` — UNA regla en el guard, no siete `@Roles` de clase

Poner `@Roles(SUPERADMIN, GESTOR)` en los siete controladores de §1.6 sería **repetir el
error de cronograma a mayor escala**: `TablerosController` sirve las lecturas del panel bajo
`@Requiere('reserva')` (`tableros.controller.ts:43`), e `InstitucionesController` bajo
`@Requiere('reserva','VER')` (`:28`). Una cuenta de solo consulta se quedaría sin los
tableros, que es exactamente para lo que existe.

Lo que hay que cerrar no es «esos siete controladores». Es una frase:
**una cuenta `RolAdmin.CONSULTA` no puede alcanzar una escritura.** Y eso se dice una vez, en
el sitio donde este repositorio ya resuelve el ámbito una vez y por la misma razón escrita
(`admin.guard.ts:118-119`).

En `backend/src/admin/admin.guard.ts`, después de resolver `exigido` (`:135-138`) y de
comprobar `@Roles` (`:214-220`):

```ts
/// Una cuenta de SOLO CONSULTA no escribe, tenga el rol de
/// convenio que tenga. Va aquí y no en siete controladores
/// porque una ruta nueva no puede nacer con el hueco abierto:
/// olvidarlo en una sola es todo lo que hace falta.
if (exigido?.nivel === 'ESCRIBIR' && admin.rol === 'CONSULTA') {
  throw new ForbiddenException(
    'Su cuenta es de solo consulta: puede ver esta sección, no modificarla.',
  );
}
```

**Qué cierra**, comprobado ruta por ruta contra §1.6:

| Antes | Después |
|---|---|
| `CONSULTA` + `GESTOR_INSCRIPCION` → **lanza campañas** (`campanas.controller.ts:206`) | 403 |
| `CONSULTA` + `LIDER_INSCRIPCION` → **corre el cargue masivo** (`plantillas.controller.ts:96-97`) | 403 |
| `CONSULTA` + `LIDER_SISTEMAS` → apaga plantillas de correo, manda correo de prueba, toca `meta-pruebas` | 403 |
| `CONSULTA` + `reserva:ESCRIBIR` → verifica instituciones | 403 |

**Qué NO toca** — y hay que decirlo con el criterio exacto, porque «todas las lecturas» es
falso y la primera redacción de este párrafo lo decía así:

- **Toda ruta cuyo `@Requiere` pida `VER`**, y las que no llevan `@Requiere`: los tableros (`tableros.controller.ts:43`), el calendario (`cronograma.controller.ts:13`), el directorio de instituciones (`instituciones.controller.ts:28`) y las fichas siguen viéndose.
- **El autoservicio.** `POST /admin/clave` (`admin.controller.ts:169-171`) y `PATCH /admin/perfil` (`:176`) no llevan `@Requiere`, así que `exigido` es `undefined` y la regla no corre. Una cuenta de consulta sigue pudiendo cambiar su propia contraseña — que es obligatorio: `debeCambiarClave` nace en `true` (`schema.prisma:1146`) y bloquea el panel entero (`frontend/src/components/admin/marco-admin.tsx:220`).
- **Las calculadoras de apariencia** (`admin.controller.ts:356-370`), tampoco: sin `@Requiere`.
- **`POST /admin/tableros/reservas/:id/cancelar`**: pide `@Requiere('reserva','VER')` (`:115`), nivel VER, así que la regla no la ve. Ya la cierra su `@Roles(SUPERADMIN)` de `:114`.

### Lo que sí se pierde, y son lecturas `CONFIRMADO`

Donde el `@Requiere` de **clase** pide `ESCRIBIR`, los `GET` de esa clase también lo piden, y
la regla los cierra. Son estos cuatro sitios, y conviene tenerlos escritos antes de aplicarla,
no después:

| `GET` que la regla cierra para una cuenta `RolAdmin.CONSULTA` | Por qué |
|---|---|
| Los siete de campañas — `:46` segmentos, `:56` cuándo sale, `:68` variables, `:73` listar, `:169` formato base, `:221` resultados, `:226` destinatarios | clase `@Requiere('inscripciones','ESCRIBIR')` (`backend/src/correo/campanas/campanas.controller.ts:42`) |
| `GET /admin/correo/estado` (`backend/src/correo/correo.controller.ts:38`) | clase `@Requiere('configuracion','ESCRIBIR')` (`:27`) |
| `GET /admin/plantillas-correo` (`:36`) y `…/variables` (`:31`) | clase `@Requiere('configuracion','ESCRIBIR')` (`backend/src/correo/plantillas/plantillas-correo.controller.ts:26`) |
| `GET /admin/plantillas/:entidad/formato` (`backend/src/plantillas/plantillas.controller.ts:60-61`) | el método pide `ESCRIBIR` |

Ninguna de las cuatro es una consulta: tres son la pantalla de **configurar** campañas y
plantillas, y la cuarta **descarga el archivo del cargue**. Perderlas es el precio declarado
de la regla, no un efecto secundario — y **es lo único de §2.2(b) que hay que confirmar con el
dueño antes de aplicarla**: hoy una cuenta `RolAdmin.CONSULTA` con el rol de convenio adecuado
puede abrir esas pantallas, y con la regla puesta deja de poder. Todo lo demás que cierra la
regla son escrituras que nadie ha defendido nunca.

Y dos que parecen del mismo grupo y **no** cambian, porque ya estaban cerradas por
`@Roles` de clase: `GET /admin/sep/exportar` (`backend/src/crm/sep/sep.controller.ts:44-45`,
bajo `@Roles(SUPERADMIN, GESTOR)` de `:20`) y `GET /admin/participantes/carga/plantilla`
(`backend/src/crm/crm.controller.ts:298-299`, bajo el `@Roles` de `:119`). Una cuenta de solo
consulta nunca las alcanzó.

### Y la pantalla, en la misma entrega `NUEVO`

`GET /admin/yo` calcula `permisos` con `resumenDePermisos(ambito.roles)`
(`admin.controller.ts:127-131` → `permisos.ts:174-186`) y `puede` con las listas de firma
(`admin.controller.ts:144-147`). **Las dos miran solo `RolConvenio`: el `RolAdmin` no sale por
ahí.** Con la regla puesta y nada más, una cuenta `RolAdmin.CONSULTA` con
`GESTOR_INSCRIPCION` seguiría recibiendo `inscripciones: 'ESCRIBIR'` y la pantalla le seguiría
ofreciendo los botones que el guard va a rechazar — exactamente el error que
`admin.controller.ts:140-143` dice existir para evitar, y el mismo que §2.0 denuncia con
`sacarDeInscrito`. Casos vivos: instituciones, campañas y el cargue de plantillas.

| | Qué | Marca |
|---|---|---|
| **P1** | Si `admin.rol === 'CONSULTA'`, `permisos` sale recortado a `VER`: ningún área se manda como `ESCRIBIR` | `NUEVO` |
| **P2** | Si `admin.rol === 'CONSULTA'`, `puede.repartirFichas` y `puede.sacarDeInscrito` salen en `false`: las dos rutas que gobiernan piden `ESCRIBIR` (`crm.controller.ts:369-370` y `:432-433`) | `NUEVO` |

Van donde se arma la respuesta, no dentro de `resumenDePermisos`: esa función también la usa
`permisos.spec.ts:70-77` y no sabe de cuentas. No añaden ningún valor nuevo a ningún tipo, así
que la regla 7 no se toca — bajan los que ya hay.

Coste: **una regla en el guard y dos recortes en `GET /admin/yo`; un fichero y medio, cero
migraciones, cero decoradores nuevos.** No rompe `backend/src/admin/permisos.spec.ts` (no
toca `PERMISOS`) ni `backend/src/arranque-di.spec.ts` (no toca el grafo de dependencias).

## §2.3 · El sobrecupo: qué cambia (nada, por defecto)

`CONFIRMADO`

Hay **dos políticas de cupo** en el código y este documento **no las funde**:

| Camino | Con motivo | Sin motivo |
|---|---|---|
| `crear` — `crm.service.ts:979-987` | **pasa** y sella `sobrecupoPorId` + `sobrecupoMotivo` (`:986`) | `409` |
| `asignar` — `crm.service.ts:3467-3475` | **pasa** y sella los dos campos (`:3474`, escritos en `:3510-3511`) | `409` |
| El recuento bajo candado de `cambiarEtapa` — `crm.service.ts:2270-2275` | *no mira el motivo* — **bloquea** | bloquea |

La firma `AUTORIZAN_SOBRECUPO` va **marcada `NUEVO` y pendiente de aprobación**, y su
comportamiento por defecto es **no existir**. Hoy cualquiera con `inscripciones: ESCRIBIR`
firma un sobrecupo, porque `:986` y `:3474` toman `admin.id` sin comprobar nada. Restringirlo
a los líderes es coherente con el resto (`permisos.ts:114-118`: *«a partir de ahí la persona
cuenta en el cupo, entra en el reporte al SENA»*), pero **le quita a `GESTOR_INSCRIPCION` una
capacidad que hoy tiene**, y eso lo decide el dueño, no este documento. Va en la lista de
aprobaciones.

Lo que **no** se propone en ningún caso: un CHECK duro de aforo. Mataría el sobrecupo
autorizado, y ya se retiró por eso en Fase 1.

## §2.4 · Cargue masivo: dos correcciones

### (a) `cuposSolicitados` **no** se marca `soloLectura`

**Retirado.** `backend/src/plantillas/catalogo.ts:117-119` declara que la plantilla de
reservas existe **para** *«corregir la cantidad de cupos»*, y `:120` (`admiteNuevas: false`)
confirma que solo edita. Ponerle `soloLectura` a la columna de `:134-139` **elimina el
propósito declarado de la plantilla**, y su reemplazo iba marcado `NUEVO` en la fila de al
lado: si no entran a la vez, la capacidad desaparece. Fase 0 dejó evidencia de que se usa
(filas de auditoría con `entidadId: 'cargue-masivo'`, `plantillas.service.ts:407-414`).

**Lo que sí hay que arreglar es por dónde escribe.** Hoy el cargue hace un
`reserva.update` suelto dentro de un `for`, sin candado y sin condición
(`plantillas.service.ts:400-405`). Bajar `cuposSolicitados` por debajo de
`cuposConfirmados + cuposEnEspera` viola `reservas_reparto_coherente`
(`…20260729000000_modelo_inicial/migration.sql:404`) y hoy sale como **500 crudo**, porque no
hay `ExceptionFilter` (§5.1).

| Orden obligatorio | Qué |
|---|---|
| 1 | El `reserva.update` suelto de `plantillas.service.ts:400-405` se cambia por un **`UPDATE` con la condición dentro de la sentencia**. El molde está escrito en la casa: `backend/src/reservas/reservas.service.ts:362-380` (`moverContador`). **Es el patrón, no la función** — ver el aviso de abajo |
| 2 | La condición que va dentro es la del CHECK en riesgo, `reservas_reparto_coherente` (`backend/prisma/migrations/20260729000000_modelo_inicial/migration.sql:404-405`): `… WHERE "id" = $1 AND $2 >= "cuposConfirmados" + "cuposEnEspera"`. Cero filas tocadas = **reparo de esa fila**, no excepción |
| 3 | Con eso, el fallo deja de ser un 500 y pasa a ser un reparo por fila, que es lo que la pantalla de previsualización sabe pintar (`plantillas.controller.ts:90-95`) |
| 4 | La columna **se queda escribible**. `soloLectura` no entra ni antes ni después |

> **Se copia el patrón, no se llama a la función. Y hay que decirlo, porque escrito al revés
> no es implementable.** `moverContador` y `bloquearOferta` son **privados**
> (`reservas.service.ts:362` y `:344`), `ReservasModule` **no exporta** `ReservasService`
> (`backend/src/reservas/reservas.module.ts:11`: `providers` sin `exports`) y
> `PlantillasModule` ni siquiera lo importa (`backend/src/plantillas/plantillas.module.ts:9-19`:
> solo `JwtModule`). Prescribir «que pase por `moverContador`» es pedir exactamente lo que se
> retiró con el `APP_FILTER` de §5.1: una dependencia que el grafo no puede resolver, y que
> `backend/src/arranque-di.spec.ts:22-28` cazaría al compilar el `AppModule`.
> **Y además mueven otra tabla:** `moverContador` toca `ofertas."cuposOcupados"`
> (`reservas.service.ts:370-374`), mientras que aquí la columna que se escribe —y cuyo CHECK
> está en riesgo— es `reservas."cuposSolicitados"`. Lo que se toma prestado es la **forma**:
> condición dentro del `UPDATE`, cero filas tocadas = reparo. **CONFIRMADO**

> **Y una corrección concreta deja de poder hacerse por cargue. Con todas las letras.** Bajar
> `cuposSolicitados` por debajo de `cuposConfirmados + cuposEnEspera` es justo lo que
> `catalogo.ts:117-119` declara como propósito de la plantilla (*«se corrige la cantidad de
> cupos»*), y con esto pasa a salir como reparo de fila: *«esta reserva ya tiene N cupos
> repartidos; para bajar de ahí, cancele o edite la reserva»*. Es deliberado. Rebajar el
> reparto de verdad exige devolverle cupos al contador de la oferta **y promover la lista de
> espera** —`promoverListaDeEspera`, `reservas.service.ts:384`—, y eso es la regla 3: no se
> hace desde un `for` sin candado. La ruta que sí sabe hacerlo, entera, es
> `PATCH /reservas/:id` (`reservas.service.ts:173` el candado, `:186` el contador, `:213` la
> lista de espera). **Quien necesite bajar cupos, entra por ahí.**

### (b) Las dos filas de cargue son la MISMA ruta

`POST /admin/plantillas/:entidad/cargar` es **un solo handler**
(`plantillas.controller.ts:96-106`) con `:entidad` como parámetro. El catálogo tiene tres
entidades: `instituciones`, `empresas` y `reservas` (`catalogo.ts:26`, `:78`, `:116`). Darles
celdas distintas en la matriz es pedirle a un decorador estático algo que no puede expresar.

**Corrección:** la matriz de §2.1 les da a las tres el **mismo** permiso —
`@Requiere('reserva','ESCRIBIR')`, que es el que hay — y si mañana hay que separarlas, se
separan **partiendo la ruta por entidad**, no con decoradores.

## §2.5 · Lo que NO entra en esta entrega, y por qué

| Idea | Por qué se queda fuera |
|---|---|
| `REVOKE` sobre `registros_auditoria` como migración | La app se conecta como `reservasae`, dueño del esquema (`backend/.env.example:9` y `:17`): un `REVOKE` desde el dueño se lo devuelve él mismo, y revocarle el `INSERT` la deja sin poder auditar. Y `prisma migrate deploy` corre en **cada arranque** con `set -e` (`backend/arrancar.sh:7`, `:29`): un `GRANT`/`REVOKE` que nombre un rol inexistente en cualquiera de las tres sedes deja el backend sin arrancar y sin rollback. **Necesita rol de aplicación aparte y su propio ADR.** |
| Auditoría dentro del `ExceptionFilter` | §5.1 |
| `archivadoEn` / papelera | D-02 de Fase 1: no hay embudo único de lectura. Va antes el embudo |

---

# PARTE 3 · Las guardias condicionales `CONSERVADA` + corrección de §3.1

Esta parte la aprobó el crítico. Se conserva, con la corrección que pidió sobre el criterio
de §3.1.

## §3.1 · El criterio NO es `OCUPAN_SILLA` `CORREGIDO`

La primera versión enumeraba cuatro etapas «que no ocupan silla». El enum tiene **once**
(`backend/prisma/schema.prisma:711-725`), y las cuatro salidas del aula — `RETIRADO`,
`NO_APROBO`, `DESERTO`, `ABANDONO` (`:719-724`) — **no ocupan silla**
(`backend/src/crm/etapas.ts:30-34`, que solo lista `INSCRITO`, `EN_FORMACION`,
`CERTIFICADO`). Con `OCUPAN_SILLA` como criterio, esas cuatro caen en el casillero «ninguna
firma»: un `GESTOR_INSCRIPCION` podría mover de acción de formación a un `NO_APROBO`, que es
justo el resultado que `permisos.ts:98-102` reserva al líder académico: *«es lo que el SENA
paga, y no lo firma quien digita»*.

**El criterio correcto es `ETAPAS_DEL_AULA` (`etapas.ts:53-60`) más `INSCRITO`.**

| Etapa | ¿Ocupa silla? (`etapas.ts:30-34`) | ¿Es del aula? (`etapas.ts:53-60`) | ¿La toca una firma? |
|---|:--:|:--:|---|
| `INTERESADO` | no | no | no |
| `CONTACTADO` | no | no | no |
| `DATOS_COMPLETOS` | no | no | *no es etapa a mano* — `crm.service.ts:2203-2208` la rechaza |
| `INSCRITO` | **sí** | no | **sí** — salir de ella es `MUEVEN_INSCRITO` |
| `EN_FORMACION` | **sí** | **sí** | sí |
| `CERTIFICADO` | **sí** | **sí** | **`CIERRAN_FORMACION`** |
| `PERDIDO` | no | no | no |
| `RETIRADO` | no | **sí** | **sí** — es del área académica |
| `NO_APROBO` | no | **sí** | **`CIERRAN_FORMACION`** |
| `DESERTO` | no | **sí** | **sí** |
| `ABANDONO` | no | **sí** | **sí** |

## §3.2 · Las guardias son condicionales, y el orden importa

`CONFIRMADO` · `backend/src/crm/crm.service.ts`

| # | Guardia | Línea | Condicional a |
|---|---|---|---|
| G1 | poner la etapa que ya tiene no es transición | `:2096` | `p.etapa === dto.etapa` |
| G2 | **`MUEVEN_INSCRITO`** | `:2114-2123` | `saleDelCupo(p.etapa, dto.etapa)` |
| G3 | escalera: transición imposible | `:2134-2135` | `motivoDeTransicionImposible` |
| G4 | cupo (mensajes buenos, fuera del candado) | `:2138-2142` | `exigeCupo(p.etapa, dto.etapa)` |
| G5 | 80 % para certificar | `:2147-2188` | `dto.etapa === 'CERTIFICADO'` |
| G6 | **`CIERRAN_FORMACION`** | `:2192-2200` | `CIERRES_DE_FORMACION.includes(dto.etapa)` |
| G7 | `DATOS_COMPLETOS` no se pone a mano | `:2203-2208` | `dto.etapa === 'DATOS_COMPLETOS'` |
| G8 | motivo obligatorio al salir | `:2210-2214` | `ETAPAS_CON_MOTIVO.includes(dto.etapa)` |
| G9 | datos de la persona para el aula | `:2217-2234` | `exigeDatosParaElAula` |
| G10 | **recuento autoritativo, bajo `FOR UPDATE`** | `:2250-2277` | `exigeCupo(...) && p.ofertaId !== null` |

La escalera vive en `backend/src/crm/escalera.ts`: `exigeDatosParaElAula` `:86-91`,
`exigeCupo` `:110-115`, `saleDelCupo` `:131-136`, `esRegresoAlAula` `:151-153`,
`motivoDeTransicionImposible` `:156-176`.

> **El orden es una decisión escrita, no un accidente.** `crm.service.ts:2236-2249` lo
> explica: comprobaciones baratas primero y **fuera** del candado, por los mensajes; el
> `FOR UPDATE` en `:2254`; el recuento autoritativo en `:2262-2268`. Cualquier rediseño que
> arme un contexto único antes del candado devuelve G10 a fuera del candado —la carrera que
> ese comentario dice haber cerrado— y si lo arma después, serializa cada inscripción detrás
> de `estadoDeDatos` y `faltantesParaMatricular` en un `$transaction` que en `:2252` **no
> pasa `timeout`** (5 s por defecto), al revés que `reservas.service.ts`, que sí pasa
> `{ timeout: 15_000 }`. **Cualquier tabla de guardias necesita DOS listas: `previas` y
> `bajoCandado`.**

## §3.3 · Las dos listas de etapas a mano NO coinciden

`CONFIRMADO` — y el defecto no es el que se contó la primera vez.

| Lado | Lista | Valores |
|---|---|---|
| Servidor | `backend/src/crm/crm.service.ts:149-158` | `INTERESADO`, `CONTACTADO`, `INSCRITO`, **`EN_FORMACION`**, `PERDIDO` (5) |
| Cliente | `frontend/src/lib/crm-api.ts:86-91` | `INTERESADO`, `CONTACTADO`, `INSCRITO`, `PERDIDO` (4) |

El servidor manda la suya en `crm.service.ts:470` (`etapasAMano: ETAPAS_A_MANO`) y
**nadie la lee**:

```
grep -rn "etapasAMano" frontend/src   →  0 resultados
```

O sea: **dos listas escritas a mano que discrepan, y un payload muerto**. La conclusión de
fondo se sostiene —**no hay validación de servidor de `CambiarEtapaDto.etapa` contra ninguna
lista**— pero la cadena de evidencia es esta y no otra.

> **Y por qué no se cierra validando contra `ETAPAS_A_MANO`:** esa lista **no tiene**
> `CERTIFICADO`, `NO_APROBO`, `RETIRADO`, `DESERTO` ni `ABANDONO`. `crm.service.ts:160-161`
> lo dice de `SALIDAS_DEL_AULA`: *«Lo que gobierna el académico y NO sale en Inscripciones»*.
> Son listas **complementarias por rol**. Validar contra una sola **cierra el área académica
> entera**. Cualquier validación tiene que ser por rol, no contra una lista.

---

# PARTE 4 · Contratos de API `REHECHA en §4.3, §4.4 y §4.5`

## §4.0 · Las reglas que valen para todas las rutas

| | Regla | Evidencia |
|---|---|---|
| R1 | Autenticación por **cookie** `convoca_sesion`, JWT verificado en cada petición y la cuenta releída de la base | `admin.guard.ts:18`, `:99-115` |
| R2 | El gremio va por **cabecera `x-gremio`**, no por parámetro de consulta, y **recorta, nunca amplía** | `admin.guard.ts:79`, `:150-161`; el cliente la pone en un solo sitio: `frontend/src/lib/pedir.ts:52` |
| R3 | Si la **dirección** afirma un gremio, manda sobre la cabecera y **no se ignora en silencio** | `admin.guard.ts:163-175` |
| R4 | Todo cuerpo pasa por `ValidationPipe` global (`backend/src/main.ts:98-99`); un campo que el DTO no declare es `400` |
| R5 | Throttle general **60/min por IP real**; las cuatro rutas públicas de reservas llevan el suyo | `app.module.ts:30`, `:49`; `reservas.controller.ts:28,:39,:45,:58` |
| R6 | Un id de otro convenio contesta **404, no 403**, y es deliberado | `crm.service.ts:3626-3638` |

## §4.1 · El sobre de error

Hoy Nest contesta su forma por defecto: `{ statusCode, message, error }`, con `message` como
texto **o como lista** (el cliente lo normaliza en `frontend/src/lib/pedir.ts:60-62`).

Hay exactamente **tres** sitios que devuelven un objeto con claves de más:

| Sitio | Claves extra |
|---|---|
| `backend/src/admin/admin.guard.ts:208-212` | `debeCambiarClave` |
| `backend/src/reservas/reservas.service.ts:87-93` | `reservaId`, `cuposSolicitados` |
| `backend/src/formularios/formularios.service.ts:469-472` | `problemas` |

**Corrección de la primera versión.** Se dijo que el frontend usaba esas claves. **No es
cierto**: `ErrorApi` las guarda en `cuerpo` (`pedir.ts:13-21`, `:63-67`) y **ningún consumidor
lo lee**. La pantalla de cambio de clave se pinta desde `GET /admin/yo`
(`frontend/src/components/admin/marco-admin.tsx:220` ← `admin.controller.ts:116-118` ←
`admin.service.ts:53`), **no** desde el cuerpo del 403.

```
grep -rn "\.cuerpo" frontend/src
→ 16 resultados en TRES archivos, todos ajenos: el cuerpo de la plantilla
  de correo (app/admin/plantillas-correo/page.tsx, 6) y su vista previa
  (components/admin/enviar-correo.tsx:212), y el tamaño de letra T.cuerpo
  (components/admin/secciones.tsx, 9). Ninguno lee ErrorApi.cuerpo.
```

**La consecuencia real es la contraria a la que se dijo:** ampliar el sobre no rompe nada, y
tampoco sirve de nada mientras no se toque `pedir.ts:63-67`. Por eso el contrato de error
propuesto es este, **y con la condición escrita**:

```jsonc
{
  "statusCode": 409,
  "message": "…",             // el texto de hoy, sin cambios
  "codigo": "AFORO_LLENO",    // NUEVO — estable, para el cliente
  "detalle": { },             // NUEVO — las claves extra de los tres sitios, aquí
  "peticionId": "…"           // NUEVO — para cruzar con el log
}
```

> **Condición:** `codigo`, `detalle` y `peticionId` llegan **inalcanzables** hasta que
> `frontend/src/lib/pedir.ts:63-67` los exponga. O entra el cambio de cliente, o el sobre
> nuevo es decoración. Y `message` **no se toca**: es lo único que las pantallas leen hoy.

## §4.2 · Códigos de estado, por familia

`CONFIRMADO` — esto es lo que el código hace hoy, no una propuesta.

| Situación | Hoy | Ejemplo |
|---|---|---|
| Falta sesión / expiró / cuenta inactiva | `401` | `admin.guard.ts:101`, `:108`, `:114` |
| Gremio que su cuenta no trabaja | `403` | `admin.guard.ts:171-174` |
| Debe cambiar la clave | `403` **con cuerpo de objeto** | `admin.guard.ts:208-212` |
| Rol de cuenta insuficiente | `403` | `admin.guard.ts:219` |
| Área insuficiente | `403`, con **dos textos** según el nivel pedido | `admin.guard.ts:232-236` |
| Firma insuficiente | `403`, con el texto que dice **cómo hacerlo bien** | `crm.service.ts:2118-2123`, `:2196-2199`, `:1662-1665` |
| Id de otro convenio | `404` | `crm.service.ts:3637` |
| Transición imposible | `400` | `crm.service.ts:2134-2135` |
| Cupo lleno sin motivo de sobrecupo | `409` | `crm.service.ts:981-984`, `:3469-3472` |
| Persona repetida en la misma acción | `409` | `crm.service.ts:1031-1034`, `:3452-3454` |
| Faltan datos para matricular | `409` | `crm.service.ts:2223-2225`, `:2230-2232` |
| Cupos cambiaron durante la operación | `409` | `reservas.service.ts:377-379` |
| Archivo que no es `.xlsx` | `400` | `plantillas.controller.ts:118-123`; `campanas.controller.ts:191-196` |
| Archivo demasiado grande | `400` | `campanas.controller.ts:197-202` — **es `BadRequestException`, no 413** |

> **Corrección de citas.** `campanas.controller.ts:191` es la comprobación de **mimetype**, no
> el límite de Multer (eso es `:182-184`), y el chequeo de tamaño explícito (`:197-202`) lanza
> `400`. Y no es cierto que plantillas sea más estricto: `plantillas.controller.ts:115-117` es
> un **OR** (`mimetype === XLSX || originalname.endsWith('.xlsx')`), así que ahí basta
> renombrar el archivo. Cada una es laxa por un lado distinto, y conviene no pasarse de
> frenada al revés: **en `mimetype`, campañas SÍ es más estricta** —`:191` exige el tipo
> exacto y no mira el nombre—, mientras que plantillas acepta por extensión. Lo que era falso
> del veto original, y sigue siéndolo, es que plantillas fuera la estricta.

## §4.3 · Webhooks: 200, siempre `REHECHO`

**El 202 de la primera versión está retirado.** El código lo dice, y es una decisión escrita:

```
backend/src/leads/leads.controller.ts:176-181
  «Se contesta 200 pase lo que pase con el contenido. Meta reintenta cuando
   no recibe 200, y si insiste sin éxito APAGA el webhook. Un aviso que no
   entendemos no puede costar que dejen de llegar los que sí.»
```

Y la otra puerta razona su 200 aparte (`:62-64`): *«200 y no 201: se contesta lo mismo cuando
el lead es nuevo y cuando ya estaba, y `repetido` lo dice. Un 201 en el segundo caso sería
mentir sobre lo que pasó»*.

**Tres palabras del comentario hacen falta y no se pueden perder: «con el contenido».** Una
firma que no cuadra **sí** se rechaza, y con `401`: `leads.controller.ts:166-174` lanza
`UnauthorizedException('Firma inválida.')` en `:173`. Lo que nunca se contesta con otra cosa
que un 200 es un aviso **bien firmado** que no sepamos interpretar. Escrito como «200 pase lo
que pase» a secas, alguien puede leer que hay que tragarse una firma mala. La regla 5 se
cumple igual, y con el matiz puesto.

| Ruta | Estado | Cuerpo | Autenticación |
|---|---|---|---|
| `POST /webhooks/leads` | **200** `=` | `{ …, repetido: boolean }` | `LlaveDeLeadsGuard` (`:67`), comparación en tiempo constante |
| `GET /webhooks/leads/meta` | **200 texto plano**, o **403 vacío** | el `hub.challenge` **tal cual** | token de verificación por gremio (`:105-135`) |
| `POST /webhooks/leads/meta` | **200 pase lo que pase _con el contenido_** `=` · **401** si la firma no cuadra (`:173`) | lo que devuelva `deMeta` | firma HMAC-SHA256 sobre `rawBody`, **secreto por gremio** (`:163-174`) |

> El `GET` de verificación **tiene que seguir contestando texto plano**. `:97-100` lo avisa:
> *«Si se le contesta un JSON, o entre comillas, no valida y no enciende — y no dice por qué:
> simplemente no llegan leads»*. Va en los carve-outs de §5.4, y es el más caro de todos
> porque **no da síntoma**.

## §4.4 · Paginación: el sobre ya existe en la casa `REHECHO`

**La primera versión decía que ningún endpoint expone `porPagina` y `paginas` a la vez, y
señalaba `GET /admin/tableros/empresas` como el peor de los tres. Las dos cosas son falsas, y
eso tira el mejor argumento que la propuesta tenía.**

`backend/src/tableros/tableros.service.ts:638-657` devuelve **exactamente** el sobre de cinco
campos que la primera versión proponía, `filas` incluido:

```ts
// tableros.service.ts:650-656
return {
  total,
  pagina: pag,
  porPagina: tamano,
  paginas: Math.max(1, Math.ceil(total / tamano)),
  filas,
};
```

Y `tableros.controller.ts:96-101` **no calcula nada**: pasa `pagina` y `porPagina` al
servicio. El `{ skip, take }` de `:647` es interno, lo que se le pasa al helper privado
`porEmpresa`, no la forma de la respuesta.

**La propuesta, reescrita — y ahora con el coste dicho.** `paginaDeEmpresas` es el
**precedente de la casa** para los cinco campos. Lo que **no** es cierto es que extenderlo
salga gratis: hay **tres nombres de array vivos**, y dos tienen consumidor en el cliente.

| Listado | Qué devuelve hoy | Le falta | Quién lee el nombre del array |
|---|---|---|---|
| Tableros · empresas | `{total, pagina, porPagina, paginas, filas}` (`tableros.service.ts:650-656`) | nada — **es el molde** | — |
| CRM · participantes | `{total, pagina, paginas, participantes}` (`backend/src/crm/crm.service.ts:434-446`) | `porPagina` | `frontend/src/lib/crm-api.ts:304-309` (`type Listado`), y tres usos vivos: `frontend/src/app/admin/inscritos/page.tsx:76` y `:90`, `frontend/src/app/admin/participantes/page.tsx:108` y `:125` |
| Instituciones | `{instituciones, total, pagina, porPagina}` (`backend/src/instituciones/instituciones.service.ts:102-107`) | `paginas` | `frontend/src/lib/instituciones-api.ts:144-149`, y `frontend/src/app/admin/instituciones/page.tsx:138`, `:139` y `:156` |

**Entonces se propone lo aditivo y nada más:** `porPagina` al sobre del CRM y `paginas` al de
instituciones —dos campos nuevos, ningún consumidor roto—, y **el nombre del array se queda
como está en cada uno**. Renombrar `participantes` e `instituciones` a `filas` es un cambio
incompatible con siete usos vivos, y no compra nada que el cliente no tenga ya. Si algún día
se quiere un solo nombre, se hace **con el cliente en la misma entrega** y se dice que se
hace. Hoy no está en el alcance. **CONFIRMADO**

### Los techos son TRES, y cada uno se queda donde está

| Techo | Valor | Fichero |
|---|---|---|
| CRM · participantes | `POR_PAGINA = 30`, `TOPE_POR_PAGINA = 300` | `backend/src/crm/crm.service.ts:88-90` |
| Instituciones | `POR_PAGINA = 50` | `backend/src/instituciones/instituciones.service.ts:34` |
| Tableros · empresas | `POR_PAGINA_EMPRESAS = 200`, `TOPE_EMPRESAS = 500` | `backend/src/tableros/tableros.service.ts:40-41` |

**Retirado** el `TOPE_POR_PAGINA = 300` como techo universal: recortaba la rejilla de empresas
de 500 a 300 por página. La fila es corta y por eso caben más — está escrito en
`tableros.service.ts:39`: *«Las organizaciones caben de a más: la fila es corta»*.

## §4.5 · Idempotencia: cabecera de cliente, no clave natural `REHECHO`

**Retirada** la clave `(tipoDocumentoSepId, numeroDocumento, convenioId)` con TTL de 24 h.
Prohibía un caso legítimo: **la segunda ficha de la misma persona en otra acción de formación
del mismo convenio**, que el esquema permite a propósito. `schema.prisma:955` es
`@@unique([accionFormacionId, personaId])` — por **acción**, no por convenio — y
`crm.service.ts:1022-1035` solo bloquea la repetición **dentro de la misma acción**, con el
texto *«Nadie cuenta dos veces contra la meta»*. Lo mismo en `asignar`, `:3441-3455`.

> Una clave natural **no es** una `Idempotency-Key`. La cabecera la pone el cliente **por
> intento**, no por identidad. Confundirlas convierte un mecanismo de reintento en una regla
> de negocio que nadie pidió.

> **Y en memoria no vale — conviene decir por qué antes de que alguien lo intente.** El
> almacén tiene que sobrevivir al reinicio, y el reinicio es rutina: `backend/arrancar.sh:29`
> corre `prisma migrate deploy` en **cada** arranque y `:31` es `exec node dist/main.js`. Un
> proceso solo, sí, pero reiniciado en cada despliegue — y justo después del reinicio es
> cuando el cliente reintenta. Un mapa en memoria contestaría «no lo he visto» precisamente
> ahí.

### El contrato propuesto `NUEVO`

```
grep -rni "idempotency" backend/src frontend/src  →  0 resultados
```
No existe nada hoy. **CONFIRMADO**

| | Qué |
|---|---|
| Cabecera | `Idempotency-Key: <opaca, la pone el cliente>` |
| Alcance | Solo `POST` que crean o disparan algo caro: `POST /admin/participantes`, `POST /admin/campanas/:id/lanzar`, `POST /admin/plantillas/:entidad/cargar`, `POST /admin/leads/:id/convertir` |
| Guardado | Una tabla propia, `claves_de_idempotencia`: la clave, el `adminId`, el método y la ruta, el **hash del cuerpo**, el estado y la respuesta que se dio, y `creadoEn`. `@@unique([adminId, clave])` |
| Retención | Se purga por antigüedad —24 h—. Sin purga, esa tabla es una copia de todas las respuestas del panel |
| **Migración** | **Sí, y es la única de todo el documento.** Un `CREATE TABLE`: no hay `ALTER TYPE` ni columna `NOT NULL` sobre filas existentes, que es el modo de fallo que nombra la regla 6. Aun así rompe la promesa de «cero migraciones» de §0.1, y por eso este contrato **no entra en el tramo 1–9 de §6.3**: va en el paso 10, con la suya |
| Repetición con el mismo cuerpo | Se devuelve la respuesta guardada, con el mismo estado |
| Repetición con **otro** cuerpo | `409` — la clave se reutilizó para otra cosa |
| Ausencia de la cabecera | Se atiende normal. **No es obligatoria**: hacerla obligatoria rompe a todo cliente que hoy funciona |
| Idempotencias que ya existen y **no se tocan** | `(origenSistema, externoId)` de leads (`schema.prisma:791`), el doble clic de reservas (`reservas.service.ts:77-94` sobre el `@@unique([empresaId, ofertaId])` de `schema.prisma:303`), y las dos de persona-por-acción |

## §4.6 · Los contratos, ruta por ruta

Solo se listan las claves que cambian o que hay que fijar. Donde dice `=`, el contrato es el
de hoy y no se toca.

### A · Público (sin sesión)

| Ruta | Entrada | Salida | Estado | Marca |
|---|---|---|---|---|
| `POST /reservas` | `CrearReservaDto` + IP + `user-agent` | vista de la reserva | 201 / 409 con `{reservaId, cuposSolicitados}` | `=` |
| `GET /reservas?nit=` | `nit` | reservas de ese NIT, **sin datos de contacto** | 200 | `=` — el contacto no sale a propósito (Fase 1) |
| `PATCH /reservas/:id` | `nit` + `cuposSolicitados` | vista | 200 / 409 | `=` |
| `POST /reservas/:id/cancelar` | `nit` | vista | **200** (`@HttpCode(200)`, `:57`) | `=` |
| `GET /preinscripcion/:slug` · `POST /preinscripcion/:slug` | — | catálogo · ficha creada | 200 / 201 | `=` |
| `GET /completar/:token` · `PATCH /completar/:token` · `PATCH :token/empresa` · `POST :token/cerrar` | token en la URL | — | 200 | `=` |
| `GET /directorio/nit/:nit` | `nit` | razón social + NIT | 200 | `=` — público razonado en `preinscripcion.controller.ts:33-36` |
| `GET /catalogo` · `GET /catalogo/:slug` | — | ofertas visibles | 200 | `=` |
| `GET /formularios/:slug` · `GET /politicas/:slug/:destinatario` · `GET /marca*` | — | — | 200 | `=` |
| `GET /estado` | — | salud | 200 | `=` |

### B · Panel — `admin/participantes`

Gate: `@Roles(SUPERADMIN, GESTOR)` + `@Requiere('inscripciones')` de clase
(`crm.controller.ts:119-120`). Ámbito inyectado por `@AmbitoActual()`.

| Ruta | Nivel de área | Salida | Marca |
|---|---|---|---|
| `GET /admin/participantes` | VER | `{total, pagina, paginas, participantes}` **+ `porPagina`** (§4.4). El array **sigue llamándose `participantes`**: lo leen `crm-api.ts:304-309` y tres pantallas | `=` más un campo `NUEVO` |
| `GET /admin/participantes/:id` | VER | ficha | `=` |
| `POST /admin/participantes` | ESCRIBIR | ficha creada · admite `sobrecupoMotivo` | `=` + `Idempotency-Key` `NUEVO` |
| `PATCH /admin/participantes/:id` | ESCRIBIR | ficha | `=` |
| `PATCH /admin/participantes/:id/etapa` | ESCRIBIR (`inscripciones` **o** `academico`) | ficha · **firmas condicionales** (§3.2) | `=` |
| `PATCH /admin/participantes/:id/formacion` | ESCRIBIR | ficha · admite `sobrecupoMotivo` | `=` |
| `PATCH /admin/participantes/lote/asesor` | ESCRIBIR + `REPARTEN_FICHAS` | `{cambiadas, fuera, sinCambio}` | `=` |
| `DELETE /admin/participantes/:id` | ESCRIBIR + `@Roles(SUPERADMIN)` | `{borrado, nombre, documento, avancesBorrados, notasBorradas}` | `=` — ver §6.2 |
| `GET /admin/participantes/carga/plantilla` | ESCRIBIR | **`.xlsx` por `@Res()`** | `=` · **carve-out** (§5.4) |
| `POST /admin/participantes/carga/archivo` | ESCRIBIR | previsualización | `=` |
| `POST /admin/participantes/carga/confirmar` | ESCRIBIR | recuentos | `=` + `Idempotency-Key` `NUEVO` |
| `GET /admin/participantes/control*` | VER de `inscritos` | cifras de cumplimiento | `=` |
| `GET /admin/participantes/academico*` | VER de `academico` | tablero | `=` |

### C · Panel — `admin/tableros`

| Ruta | Gate | Marca |
|---|---|---|
| `GET /admin/tableros/{resumen,analisis,acciones,ubicaciones,proyeccion,formularios,serie,reservas}` | `@Requiere('reserva')` VER | `=` |
| `GET /admin/tableros/empresas` | VER | `=` — **es el molde de §4.4** |
| `POST /admin/tableros/reservas/:id/cancelar` | `@Roles(SUPERADMIN)` + `@Requiere('reserva','VER')` | `=` |
| `GET /admin/tableros/exportar/{reservas,ocupacion,empresas}` | `@Roles(SUPERADMIN, GESTOR)` | `=` · **carve-out** |

### D · Panel — `admin/cronograma`

| Ruta | Gate hoy | Gate propuesto | Marca |
|---|---|---|---|
| `GET /admin/cronograma` | `@Roles(SA,G)` + `@Requiere('reserva')` | **igual** | `=` |
| `PATCH /admin/cronograma/grupos/:id` | + `@Requiere('configuracion','ESCRIBIR')` | **+ `@Roles(SUPERADMIN)` por método** | `NUEVO` · §2.2 |
| `PATCH /admin/cronograma/coberturas/:id/cupos` | idem | **+ `@Roles(SUPERADMIN)` por método** | `NUEVO` · §2.2 |

Las dos escrituras **tienen que dejar auditoría** y hoy no la dejan (E-01). Ver §6.1.

### E · Panel — `admin/sep`

| Ruta | Gate | Contrato | Marca |
|---|---|---|---|
| `GET /admin/sep/alistamiento` · `alistamiento-f7` | `@Requiere('reportes')` VER | cifras | `=` |
| `GET /admin/sep/exportar?formato=` | `@Requiere('reportes','ESCRIBIR')` | **`.xlsx` por `@Res()`**, y el error en **HTML**, no en JSON | `=` · **no se toca** |

> **Los títulos de columna no se tocan.** `backend/src/crm/sep/formatos.spec.ts` los fija con
> `toEqual` en `:97` (27 columnas del uso directo), `:112` (54 del cargue) y `:153` (18 del
> F7), espacios raros incluidos (`:100-103`, `:156-158`, `:160`). Este documento no propone ni
> una columna nueva.
>
> **Y `sep.controller.ts:79-121` es el precedente de §5.4**: ya sabe que un error en una
> descarga navegada no puede ser JSON, y pinta una página HTML mínima con el motivo
> (`:53-63` lo razona: *«un 400 con cuerpo JSON no es un aviso: es la pantalla del panel
> sustituida por `{"message":…}`»*).

### F · Panel — `admin/plantillas` (cargue masivo)

| Ruta | Gate | Contrato | Marca |
|---|---|---|---|
| `GET /admin/plantillas` | **ninguno** salvo `AdminGuard` | catálogo de las tres entidades, con `soloLectura` por columna | `=` |
| `GET /admin/plantillas/:entidad/formato` | `@Requiere('reserva','ESCRIBIR')` | **`.xlsx` por `@Res()`**, con los datos dentro | `=` · **carve-out** |
| `POST /admin/plantillas/:entidad/cargar?ensayo=1` | `@Requiere('reserva','ESCRIBIR')` | recuentos + reparos | `=` + escribir por el `UPDATE` condicional (§2.4) |

### G · Panel — instituciones, campañas, correo, configuración, cuentas, leads

Contratos `=` en todos. El único cambio es el gate de cuenta de §2.2(b), que se aplica en el
guard y **no** en estos ficheros.

---

# PARTE 5 · Errores tipados `REHECHA en §5.1`

## §5.1 · El filtro global: sin inyección, sin `APP_FILTER` `REHECHO`

**Retirado** el `APP_FILTER` con `AuditoriaService` inyectado. No resuelve y rompe el
arranque:

```
ls backend/src/comun/                          →  ningún .module.ts
grep -rn "AuditoriaService" --include=*.module.ts backend/src
  → 8 líneas en cuatro módulos: el `import` y el `providers` de cada uno
    crm.module.ts:4 y :48        · instituciones.module.ts:4 y :44
    plantillas.module.ts:4 y :17 · preinscripcion.module.ts:3 y :24
    — los cuatro como provider suelto, ninguno con `exports`
```
Un provider `APP_FILTER` en `app.module.ts` no puede resolverlo, y
`backend/src/arranque-di.spec.ts:22-28` lo cazaría al compilar el `AppModule` entero
(*«Nest can't resolve dependencies»*), que es exactamente para lo que ese spec existe
(`:3-13`). **CONFIRMADO**

**Lo que se propone en su lugar:**

| | Qué |
|---|---|
| 1 | Un `@Catch()` **sin dependencias inyectadas**: usa `new Logger()`, igual que `auditoria.service.ts:109`. |
| 2 | Se registra con **`app.useGlobalFilters(...)` en `main.ts`**, junto al `useGlobalPipes` de `:98`. Sin `APP_FILTER`, sin módulo, sin tocar el grafo de DI. |
| 3 | **La auditoría no entra en el filtro.** Si mañana se quiere auditar los fallos, hace falta un `ComunModule` `@Global` que exporte `AuditoriaService`, y eso es su propio ADR. Con esto fuera, la «razón concreta» que la primera versión daba para usar `APP_FILTER` desaparece. |
| 4 | El filtro **traduce**, no inventa: `P2002` → `409`, `P2003` → `409`. Todo lo demás pasa tal cual. |

Hoy **no hay ninguno**: `grep -rn "useGlobalFilters|ExceptionFilter|@Catch" backend/src` →
**0 resultados**. Es el hallazgo 9 de Fase 1, y es por lo que violar
`reservas_reparto_coherente` desde el cargue masivo sale como 500 crudo (§2.4).

## §5.2 · El censo de `P2002` y `P2003`, completo

`CONFIRMADO` — son **cuatro servicios pero ocho sitios**, y uno es `P2003`:

| Fichero:línea | Código |
|---|---|
| `backend/src/admin/admin.service.ts:242` | `P2002` |
| `backend/src/formularios/formularios.service.ts:311` | `P2002` |
| `backend/src/formularios/formularios.service.ts:314` | **`P2003`** |
| `backend/src/formularios/formularios.service.ts:450` | `P2002` |
| `backend/src/formularios/formularios.service.ts:630` | `P2002` |
| `backend/src/formularios/formularios.service.ts:746` | `P2002` |
| `backend/src/instituciones/instituciones.service.ts:404` | `P2002` |
| `backend/src/reservas/reservas.service.ts:521` | `P2002` |

**Quién manda:** el `catch` local, siempre. Los ocho dan mensajes con contexto que el filtro
no puede reconstruir. El filtro es **la red de abajo**, para lo que hoy sale como 500 crudo.
Ninguno de los ocho se retira.

## §5.3 · La prueba que ata el mapa al esquema

La prueba tiene que **leer el `.sql` entero y casar multilínea**. Un regex por línea de
`ADD CONSTRAINT … CHECK` encuentra **3 de 17** (§1.7) y pasa en vano. En las migraciones el
`ADD CONSTRAINT` y el `CHECK (…)` van en líneas distintas — por ejemplo
`…20260729000000_modelo_inicial/migration.sql:388-390`, `:392-394`, `:396-398`, `:403-405`,
`:410-412`.

## §5.4 · Los carve-outs: 12 handlers escriben la respuesta ellos mismos

`CONFIRMADO` · `grep -rn "@Res(" --include=*.controller.ts backend/src` → 17 líneas, de las
que **3 son comentarios** (`campanas.controller.ts:166`, `plantillas.controller.ts:62`,
`leads.controller.ts:102`). Quedan **14 decoradores**, de los que **2 son `passthrough`**
(esos sí los ve el filtro). **Los 12 que hay que eximir:**

| # | Ruta | Fichero:línea | Qué escribe | Caller vivo |
|---|---|---|---|---|
| 1 | `GET /marca/logos/:id` | `admin.controller.ts:425` | bytes del logo | público |
| 2 | `GET /admin/campanas/formato-base` | `campanas.controller.ts:170` | `.xlsx` | panel |
| 3 | `GET /campanas/:id/banner` | `campanas.controller.ts:250` | imagen | correo |
| 4 | `GET /campanas/:id/abierto/:destinatarioId` | `campanas.controller.ts:278` | **píxel** | correo |
| 5 | `GET /campanas/:id/clic/:destinatarioId` | `campanas.controller.ts:306` | redirección | correo |
| 6 | **`GET /admin/participantes/carga/plantilla`** | `crm.controller.ts:300` | `.xlsx` | **`href` navegado**: `frontend/src/app/admin/participantes/carga/page.tsx:317` |
| 7 | `GET /admin/sep/exportar` | `sep.controller.ts:51` | `.xlsx`, y el error en **HTML** | panel |
| 8 | **`GET /webhooks/leads/meta`** | `leads.controller.ts:111` | **texto plano** y un **403 vacío** | **Meta** |
| 9 | `GET /admin/plantillas/:entidad/formato` | `plantillas.controller.ts:73` | `.xlsx` | panel |
| 10 | `GET /admin/tableros/exportar/reservas` | `tableros.controller.ts:148` | `.xlsx` | panel |
| 11 | `GET /admin/tableros/exportar/ocupacion` | `tableros.controller.ts:225` | `.xlsx` | panel |
| 12 | `GET /admin/tableros/exportar/empresas` | `tableros.controller.ts:304` | `.xlsx` | panel |

Los dos `passthrough` (`admin.controller.ts:83` y `:111`, sesión) sí pasan por el filtro:
solo ponen y quitan la cookie.

> **El nº 8 es el más caro y no da síntoma.** Si el filtro le pone JSON encima, la
> verificación de Meta deja de validar y **no llegan leads**, sin nada roto que mirar. El
> propio comentario de `leads.controller.ts:96-104` avisa de eso.
>
> **El nº 6 se navega con un `href`**, no con `fetch`: un JSON de error sustituye la pantalla
> del panel. Es el mismo caso que `sep.controller.ts` ya resolvió a mano (`:53-63`), y ese
> es el molde: **carve-out más página de error en HTML**, no carve-out a secas.

---

# PARTE 6 · Vocabulario y orden de aplicación

## §6.1 · El catálogo de auditoría: hay que ampliar DOS listas, no una

`CONFIRMADO` · `backend/src/comun/auditoria.service.ts`

`ACCIONES` (`:10-40`) tiene **14** valores y es `as const`; `Entrada.accion` está tipado
contra él (`:42`, `:71`). **Ninguna acción nueva compila hasta que se añada ahí.**

**Y hay una segunda lista que la primera versión no vio:** `ENTIDADES` (`:57-63`) tiene
**cinco** valores — `participante`, `persona`, `institucion`, `reserva`, `empresa` — y
`Entrada.entidad` está tipado contra él (`:65`, `:73`), con el comentario de `:44-56`
contando qué pasó la última vez que el vocabulario se duplicó (*«llegaron a SEIS grafías para
cuatro cosas»*, y el historial de una ficha *«llevaba tiempo enseñando media historia sin que
nadie lo notara»*). **Auditar una campaña o un grupo de cronograma tampoco compila hoy.**

### Lo que hay que añadir

**A `ACCIONES` — once:**

| Acción | Para qué | Dónde iría el `registrar()` |
|---|---|---|
| `PARTICIPANTE_ARCHIVADO` | papelera | *(cuando exista; D-01)* |
| `PARTICIPANTE_RESTAURADO` | papelera | *(idem)* |
| `SOBRECUPO_AUTORIZADO` | quién firmó pasarse del cupo | `crm.service.ts:986` y `:3474` |
| `RESERVA_CANCELADA` | hoy no deja rastro | `reservas.service.ts` (cancelar) y `tableros.service.ts` (`cancelarReserva`) |
| `RESERVA_EDITADA` | idem | `reservas.service.ts` (editar) |
| `CAMPANA_LANZADA` | quién mandó correo a cuántos | `campanas.controller.ts:206-208` |
| `CRONOGRAMA_FECHAS_CAMBIADAS` | **E-01** | `cronograma.service.ts:160-168` |
| `CRONOGRAMA_CUPOS_CAMBIADOS` | **E-01** | `cronograma.service.ts` (`actualizarCupos`) |
| `LEAD_CONVERTIDO` | el webhook no audita | `conversion.controller.ts:30-31` |
| `LEAD_DESCARTADO` | `EstadoLeadEntrante.DESCARTADO` existe y no lo escribe nadie (`schema.prisma:744`) | *(cuando exista)* |
| `CARGUE_MASIVO_APLICADO` | hoy se audita reusando `PARTICIPANTE_EDITADO` (`plantillas.service.ts:409`) | `plantillas.service.ts:407-414` |

**A `ENTIDADES` — cinco:** `CAMPANA: 'campana'`, `GRUPO: 'grupo'`,
`COBERTURA: 'cobertura'`, `LEAD: 'lead'`, `OFERTA: 'oferta'`.

### Por qué esto NO viola las reglas 6 ni 7

| Regla | Comprobación |
|---|---|
| **6** · migraciones desatendidas | **No hay migración.** `RegistroAuditoria.accion` y `.entidad` son `String`, no enums de PG: `backend/prisma/schema.prisma:1560-1562` dice *«Validado contra un catálogo en código, no enum de PG»*, y `auditoria.service.ts:7-9` lo razona: *«añadir una acción no debería costar una migración»*. **Cero `ALTER TYPE`.** |
| **7** · `Record` exhaustivos del frontend | `grep -rn "ETAPA_CAMBIADA\|NOTA_CREADA\|PARTICIPANTE_CREADO" frontend/src` → **0 resultados**. No hay espejo de este catálogo en el cliente. |

**Y el otro tipo `Accion`:** `auditoria.service.ts:42` ya exporta uno. La primera versión
exportaba un segundo desde `permisos.ts`. **Retirado**: `permisos.ts` no exporta ningún tipo
`Accion`; si hace falta nombrar las acciones de la matriz, se llama `AccionDePermiso` y se
dice en el comentario que no es la de auditoría.

## §6.2 · «Nada se borra»: dónde aplica y dónde no

La primera versión retiraba `DELETE /admin/participantes/:id` invocando la regla, y a la vez
dejaba marcados «=» seis borrados de configuración —uno de los cuales, se ve más abajo, ni
siquiera borra—. O la regla aplica a todos, o se escribe la excepción. **Se escribe:**

> **La regla protege lo que le pasó a una PERSONA y lo que se le reportó al SENA.** No
> protege la configuración. Un formulario, una opción de una pregunta o una plantilla de
> correo son herramientas, no constancias: borrarlas no borra el rastro de nada que ocurrió,
> porque el rastro vive en `movimientos_participante`, en `valores_anteriores` y en
> `registros_auditoria`.
>
> **La excepción de la excepción ya está escrita y es el molde:**
> `backend/src/politicas/politicas.service.ts:188-192` se niega a borrar una política que
> alguien aceptó — *«es la prueba de lo que leyó»* — y `:193-197` se niega a borrar la
> vigente. Cuando una fila de configuración se convierte en evidencia, deja de poder
> borrarse. **Esa es la prueba que hay que exigirle a cada borrado de configuración, no una
> regla ciega.**

Borrados de configuración que se quedan como están, con esa justificación:
`backend/src/formularios/formularios.controller.ts:101-102`, `:129-130`, `:173-174`;
`backend/src/admin/admin.controller.ts:341-343` (logos);
`backend/src/politicas/politicas.controller.ts:58-59` (con su guardia de servicio).

**Son cinco, no seis — y el sexto es la buena noticia.** El `DELETE` de plantillas de correo
(`backend/src/correo/plantillas/plantillas-correo.controller.ts:61`) **no borra**: el método
se llama `apagar` y hace `update … { activa: false }`
(`backend/src/correo/plantillas/plantillas-correo.service.ts:153-159`), con el motivo escrito
justo encima, en `plantillas-correo.controller.ts:59-60`: *«No borra: apaga. Una plantilla que
ya se usó es parte de lo que se le dijo a alguien.»* Es la regla 1 **ya aplicada** a una fila
de configuración que se convirtió en evidencia — el mismo criterio que
`politicas.service.ts:188-192` —, así que vale como segundo molde y no como excepción. Donde
las versiones anteriores de este documento decían «borra plantillas» (§1.6, §2.1.G), ahora
dicen «apaga». **CONFIRMADO**

### `DELETE /admin/participantes/:id` — la ruta se queda, y se la llama por su nombre

**Retirada** la propuesta de quitarla. Tiene caller vivo:
`frontend/src/lib/crm-api.ts:988-995`, desde
`frontend/src/app/admin/participantes/[id]/page.tsx:1035`, con un diálogo de confirmación que
ya dice lo correcto (`:1029-1030`: *«La persona no se borra: si está inscrita en otro
convenio, ahí sigue»*).

**Y el nombre importa.** El código la llama otra cosa:

- `backend/src/crm/crm.controller.ts:414` — *«Quita a la persona de este curso. No la borra.»*
- `backend/src/crm/crm.service.ts:1720-1724` — *«Borra la participación, no a la persona: la misma cédula puede estar en el otro convenio.»*

Llamarla «borrado físico» en la matriz deforma la conversación con el dueño. **Se llama
«quitar de este curso»**, y lo que hay que arreglar por dentro es lo que se lleva:
`crm.service.ts:1749-1756` borra avances, notas y **los movimientos de etapa —su propio
historial—** antes de borrar la fila. La huella que queda (`:1758-1775`) es buena y está
razonada, pero es una línea de auditoría, no el historial. Eso es D-01/C-10 y va con la
papelera, después del embudo único de lectura (D-02).

## §6.3 · Orden de aplicación

| # | Qué | Riesgo | Depende de |
|---|---|---|---|
| 1 | **La regla de `CONSULTA` en el guard**, con los dos recortes de `GET /admin/yo` (§2.2b, P1 y P2) | bajo — una regla y dos recortes, cero migraciones. **Los tres van juntos**: la regla sola deja botones muertos | el sí del dueño a los cuatro `GET` que se pierden (§2.2b) |
| 2 | **Ampliar `ACCIONES` y `ENTIDADES`** (§6.1) | nulo — arrays de TS, columna `String` | nada |
| 3 | **Auditar cronograma** (E-01) | bajo | (2) |
| 4 | **`useGlobalFilters` + los 12 carve-outs** (§5.1, §5.4) | medio — el nº 8 no da síntoma | nada |
| 5 | **El cargue de reservas por el `UPDATE` condicional** (§2.4a) | medio | (4), para que el reparo se vea |
| 6 | **`@Firmas()` como decorador de parámetro** (§2.0 F1) | bajo — solo transporta | nada |
| 7 | **`puede.cerrarFormacion`** y leer `puede.sacarDeInscrito` en la pantalla (§2.0 F4) | bajo | (6) |
| 8 | **`@Roles(SUPERADMIN)` por método en cronograma** (§2.2a), **y `cronograma-vista.tsx:95` con él** | **necesita aprobación** | decisión del dueño |
| 9 | **Sobre de error + `pedir.ts`** (§4.1) | bajo, pero **backend y frontend a la vez** | (4) |
| 10 | **`Idempotency-Key`** (§4.5) | medio — lleva **la única migración del documento**, un `CREATE TABLE` aditivo | (9) |
| 11 | **`AUTORIZAN_SOBRECUPO`** (§2.3) | **necesita aprobación** | decisión del dueño |
| 12 | Papelera, embudo único, rol de aplicación para la bitácora | alto | fuera de esta entrega |

---

# Anexo · NO ENCONTRADO

Con el comando, no con un silencio.

| Qué se buscó | Comando | Resultado |
|---|---|---|
| Lectura de `etapasAMano` en el cliente | `grep -rn "etapasAMano" frontend/src` | 0 resultados — el payload de `crm.service.ts:470` está muerto |
| Cualquier idempotencia por cabecera | `grep -rni "idempotency" backend/src frontend/src` | 0 resultados |
| Un `ExceptionFilter` | `grep -rn "useGlobalFilters\|ExceptionFilter\|@Catch" --include=*.ts backend/src` | 0 resultados |
| Un `ComunModule` | `ls backend/src/comun/` | ningún `.module.ts` |
| Lector de `ErrorApi.cuerpo` | `grep -rn "\.cuerpo" frontend/src` | 16 resultados en **tres** archivos, **todos ajenos** (cuerpo y vista previa de la plantilla de correo, y `T.cuerpo` de tipografía) |
| Lector de `puede.sacarDeInscrito` | `grep -rn "sacarDeInscrito" frontend/src` | 1 resultado, y es la **declaración del tipo** (`lib/admin-api.ts:95`). Ninguna pantalla |
| Espejo del catálogo de auditoría en el cliente | `grep -rn "ETAPA_CAMBIADA\|NOTA_CREADA\|PARTICIPANTE_CREADO" frontend/src` | 0 resultados |
| Ruta para listar la mesa de entrada de leads | inventario de los 19 controladores | **no existe** — es A-01 de Fase 1 |
| Ruta de escritura para `Oferta.abierta` | Fase 0 | **no existe** |

## Erratas de cita corregidas

`crm.service.ts:469` → **`:470`** · `crm.service.ts:2298-2308` → **`:2299-2308`** ·
`directorio.service.ts:74-89` → **`backend/src/crm/directorio.service.ts:74-89`** ·
`plantillas-correo.controller.ts:26` → **`backend/src/correo/plantillas/plantillas-correo.controller.ts:26`** ·
`matricula.ts:97` → **`backend/src/crm/matricula.ts:97`** ·
«`@Requiere` son 62» → **61** (`@Roles` 32 sí es exacto) ·
«cinco rutas de descarga» → **12 handlers**, 14 decoradores `@Res()`, 3 de las 17 líneas son comentarios ·
«cuatro servicios de `P2002`» → **ocho sitios**, uno de ellos `P2003`.

### En esta tercera pasada

Todas se comprobaron abriendo el archivo, una por una:

| Decía | Dice |
|---|---|
| §1.4: «estas **seis**» pruebas | **siete** `it` en el `describe` de `permisos.spec.ts:13`; faltaba `:45-48`, «cada gestor ve el área del otro sin poder tocarla» |
| §1.6 y §2.1.G: el `DELETE` de plantillas de correo **borra** | **apaga** — `plantillas-correo.service.ts:153-159` hace `activa: false` |
| §1.7: «**caben** en una línea» | «llevan el `ADD CONSTRAINT` y el `CHECK (` en el mismo renglón» — el nº 17 abre el `CHECK` ahí pero sigue en la siguiente |
| §0.1: «los **~20** predicados» | sin número inventado: `grep -rn "CANCELADA" --include=*.ts backend/src \| grep -v spec` → **29 líneas** |
| §2.1: el OR de áreas en `admin.guard.ts:144-147` | el código es `:144-147`, **el comentario que se cita es `:142-143`**; el bloque entero, `:140-148` |
| §2.4(a): el `FOR UPDATE` de `bloquearOferta` en `reservas.service.ts:75` | `:75` es la **llamada**; la definición es `:344` y el `FOR UPDATE`, `:352` |
| §4.1: `.cuerpo` en **dos** archivos | **tres** — faltaba `components/admin/enviar-correo.tsx:212` |
| §4.4: `GET /admin/participantes` «hoy no» devuelve sobre paginado | **sí** lo devuelve (`crm.service.ts:434-446`); solo le falta `porPagina` |
| §4.6.B: el array pasaría a llamarse `filas` | **se queda `participantes`**: lo leen cuatro sitios vivos del cliente |
| §5.1: el `grep` de `AuditoriaService` daba 4 líneas | da **8**: el `import` y el `providers` de cada módulo |
| §6.1: *«llegaron SEIS grafías»* | *«llegaron **a** SEIS grafías»* |
| §4.3: «200 pase lo que pase» | «200 pase lo que pase **con el contenido**»: la firma mala es `401` (`leads.controller.ts:173`) |
| §4.2: «dos comprobaciones **igual de laxas**» | en `mimetype`, campañas **sí** es más estricta (`:191`); plantillas acepta por extensión (`:115-117`) |