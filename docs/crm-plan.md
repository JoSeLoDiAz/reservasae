# Convoca — CRM de seguimiento académico
## Plan único de diseño y entrega

---

## 1. El problema

**Lo que hay hoy.** Convoca sabe contar sillas. Una reserva es `(empresa, oferta, N cupos)`: la empresa entra al formulario, aparta doce cupos de una acción de formación en un departamento, y el sistema mueve un contador con un `UPDATE` atómico que está probado bajo concurrencia real. Alrededor de eso ya funciona lo demás: catálogo público, formularios administrables, apariencia por convenio, tableros con avance contra la meta de 3.690 beneficiarios, ritmo, proyección y tres informes en Excel. Es un sistema de convocatoria terminado y correcto.

**Lo que falta, en dos frases.** Hoy el sistema cuenta sillas, no gente: la reserva dice «la empresa X apartó 12 cupos» y nadie sabe quiénes son esos doce. Un CRM que siga a cada participante por etapas, que produzca la matrícula y que genere el archivo de cargue al SEP necesita a las doce personas con nombre y documento, así que hay que añadir un eslabón nuevo al proceso: **después de reservar, la empresa entrega los nombres.** Ese eslabón no existe ni en el modelo, ni en la interfaz, ni en el proceso comercial — y de él cuelga absolutamente todo lo demás que pidió el cliente: las etapas, el seguimiento por AF y por grupo, las notas con autor, la matrícula y el archivo del SEP. Además hay un hueco legal debajo: la casilla de tratamiento de datos que hoy se marca la firma **quien diligencia el formulario en nombre de la empresa**, y una empresa no puede autorizar el tratamiento de los datos personales de sus empleados. El titular es el empleado.

---

## 2. Las decisiones que sostienen todo

### 2.1 Dos tablas, no una: `Persona` (identidad) y `Participante` (la persona en una oferta)

`Persona` es única en todo el sistema por `(tipoDocumento, numeroDocumento)` normalizados, sin convenio. `Participante` es esa persona ocupando una silla de una oferta concreta, y es quien lleva etapa, cobertura, notas, historial y resultado.

**Por qué:** son 15 cursos gratuitos y la misma persona va a estar en varios. Con una sola tabla plana —como hace el prototipo— corregir un correo se hace tantas veces como cursos, el CRM muestra tres «contactos» que son la misma persona, y no se puede responder «cuánta gente distinta hemos formado», que no es la suma de los dos convenios y es justo lo que se reporta. Separando, la deduplicación deja de ser una tarea permanente y pasa a ser una restricción de la base.

### 2.2 Nominar NUNCA toca `Oferta.cuposOcupados`

El único código que mueve el contador sigue siendo `crear`, `editar`, `cancelar` y `promoverListaDeEspera` del servicio de reservas. La nominación vive **debajo** del cupo.

**Por qué:** los tres candados contra la sobreventa (el `@@unique([empresaId, ofertaId])`, el `UPDATE` condicional y los CHECK de la migración inicial) están diseñados para un único camino de escritura y están probados con `db:prueba-carga`. Un segundo camino que mueva el mismo número no fallaría en la prueba: fallaría en producción, un martes, con dos personas nominando a la vez.

### 2.3 …pero sí hay código nuevo en el camino público, y hay que decirlo

Aquí corrijo el diseño original, que prometía «cero código nuevo tocando cupos». Es falso. El invariante **`COUNT(participantes vivos) ≤ Reserva.cuposConfirmados`** lo rompen tres caminos que ya existen y que son **públicos, autenticados solo con el NIT**:

| Camino | Qué pasa hoy | Qué hay que hacer |
|---|---|---|
| `PATCH /reservas/:id` a la baja | Baja de 10 a 3 con 8 nombres entregados → 8 personas sobre 3 cupos | **409** si la cantidad nueva es menor que el número de participantes vivos, con el mensaje de que primero hay que retirar nombres |
| `POST /reservas/:id/cancelar` | Pone confirmados a 0 y **regala las sillas a la lista de espera en la misma transacción** | **409** si hay al menos un participante vivo: «hay personas matriculadas, contacte a su asesor». Cancelar pasa a ser una acción de gestión |
| `POST /reservas` sobre una reserva CANCELADA | **Revive la misma fila** (mismo `id`) → los participantes y respuestas del ciclo anterior resucitan dentro de una reserva nueva de otra cantidad | Al revivir: anular los participantes anteriores con motivo `RESERVA_REVIVIDA` y borrar las respuestas viejas **incondicionalmente** (hoy solo se borran si el envío nuevo trae respuestas: es un bug latente que ya existe) |

`promoverListaDeEspera` solo **sube** confirmados, así que no rompe el invariante — pero cambia el número de sillas nominables sin que nadie actúe sobre esa reserva. La pantalla de nominación lee siempre el valor vivo, nunca uno cacheado.

La nominación en sí se serializa con `SELECT ... FOR UPDATE` **sobre la fila de la reserva**, no sobre la oferta: así el camino público caliente no se degrada ni un milisegundo por culpa del CRM. Y se añade la séptima comprobación a `db:verificar`.

### 2.4 La cobertura de grupo se asigna sola en el 82 % de los cupos

`Participante.coberturaId` apunta a `GrupoCobertura` (grupo × ubicación × modalidad), no a `Grupo`. Verificado contra `catalogo.json`:

> **106 ofertas, 4.797 cupos. `Oferta.cuposMaximos` es exactamente la suma de sus `GrupoCobertura` en las 106, cero descuadres. Solo 7 ofertas son ambiguas** (BRITCHAM AF1/AF2/AF3 Bogotá D.C., AF4 Bogotá; ADECOPRIA AF1, AF2 y AF7 Antioquia), **878 cupos**. En las otras 99 —3.919 cupos, el 81,7 %— hay un solo grupo detrás y el sistema asigna la cobertura al crear el participante, sin intervención humana.

La tensión «por AF vs por grupo» casi se disuelve sola. El reparto manual es un **filtro** (`coberturaId IS NULL`) dentro del listado, no una pantalla propia.

**Sin contador atómico en la cobertura.** El tope por cobertura es blando: se cuenta con `GROUP BY` en SQL y el panel marca en rojo el grupo desbordado y bloquea su matrícula hasta resolverlo. El compromiso con el SENA es por acción×ubicación (la oferta), y pasarse de una cobertura sin pasarse de la oferta es un reparto mal hecho, no un incumplimiento: lo arregla un gestor moviendo gente. Meter un segundo contador es exactamente el defecto que este modelo se construyó para evitar.

### 2.5 La autorización de tratamiento es del titular, y hoy no existe ninguna política

Esto es lo más grave que encontró la revisión, y no es una nota de documentación:

- `PoliticaDatos` es una **tabla muerta**: no hay endpoint que la cree, ni página pública que la muestre, ni script que la siembre.
- `politicaVigente()` hace `findFirst` y **devuelve `null` en silencio**. Por tanto **todas las reservas que existan hoy se guardaron con `aceptaPoliticaDatos = true` y `politicaDatosId = null`**: la persona marcó una casilla que no apunta a ningún texto.

Decisiones:
1. **CRUD de `PoliticaDatos` + página pública + candado**: sin política vigente no se puede publicar una acción. Va en la fase 0, antes de capturar el primer documento.
2. `PoliticaDatos` gana `destinatario: RESERVA | PARTICIPANTE`. El texto que lee quien reserva no es el que necesita el participante (finalidades distintas, incluida la **transmisión al SENA**).
3. Tabla **`AutorizacionDatos`** por `(persona, política)` — no un booleano en `Persona`. Como la política es por convenio, una persona en los dos convenios tiene dos filas, que es lo correcto: la autorización de ADECOPRIA no ampara el tratamiento bajo BRITCHAM.
4. Sin autorización vigente para la política del convenio de esa participación, **no se puede pasar a MATRICULADO ni entrar en el archivo del SEP.**

El flujo recomendado —y es la pregunta nº 3 al cliente— es que **la empresa entregue nombre y correo corporativo, y sea la persona quien complete su matrícula y otorgue su autorización por un enlace propio**. Eso resuelve el problema legal y de paso el de calidad del dato: el titular escribe bien su propio número. Pero ese flujo necesita correo, así que en la primera entrega los datos entran por el asesor con estado `PENDIENTE_AUTORIZACION` y salen marcados en la matrícula y **bloqueados** para el SEP.

### 2.6 El aislamiento entre convenios está en la base, no en el subdominio

El cliente pidió «separarlos por subdominio». Hay que decírselo claro: **el subdominio no aísla nada.** Hoy:

- El ámbito no existe: `Admin` no tiene ninguna relación con `Convenio` y `RolAdmin` son tres valores globales.
- `TablerosController` y `FormulariosAdminController` **no llevan un solo `@Roles`** (verificado: los únicos cuatro del backend están en `/admin/usuarios`). Una cuenta `CONSULTA` descarga hoy el Excel con nombre, correo, celular y cargo de todos los contactos, y puede borrar un formulario.
- La cookie de sesión es host-only, así que no viajaría a un subdominio; no hay comodín DNS ni entradas en el ingress del túnel; y `marca-publica.tsx` resuelve el ámbito con `usePathname()`, así que en `adecopria.reservasae.com/` la ruta es `/` y el navegador repintaría con la **marca general**, rompiendo la apariencia por formulario justo en la página que justifica el subdominio.

Decisión: **`Admin.convenioId String?` (nulo = ve los dos) más el filtro de ámbito inyectado en todas las consultas del CRM y de tableros.** Eso es lo que separa de verdad. El subdominio se hace después, es cosmético, y su coste real es DNS + ingress + cookie + middleware + SSR + el arreglo de `marca-publica.tsx`. Descarto la tabla `AdminConvenio` N:N: con dos convenios y un puñado de cuentas, una columna cubre el 100 % de los casos conocidos y el tercer convenio sigue siendo un `UPDATE`.

### 2.7 Etapas: siete valores, y el embudo se cuenta desde los movimientos

```
POSTULADO → DATOS_COMPLETOS → MATRICULADO → EN_FORMACION → CERTIFICADO
salidas:   RETIRADO (con motivo y fecha)   ·   NO_APROBO
```

No se copian las ocho etapas del prototipo: `pago realizado` y `en negociación` no significan nada en una formación gratuita. Y hay dos etapas **después** del punto donde el prototipo consideraba terminado el embudo, porque lo que el SENA paga es que la persona llegue al final, y la deserción es el riesgo real del proyecto.

**El embudo se cuenta acumulado, sobre `MovimientoParticipante` con `GROUP BY etapaDespues`**, nunca sobre la etapa actual. El prototipo cuenta por etapa actual y el embudo le sale invertido: quien llega a CERTIFICADO desaparece de MATRICULADO. Es la misma lección que ya está aprendida con el ritmo, que sale de `movimientos_reserva` y no de `reservas.creadoEn`.

`MATRICULADO` es una **compuerta dura** con cuatro requisitos —documento, cobertura asignada, grupo con fechas, autorización vigente— y el panel enseña la lista de lo que falta mientras se trabaja, no solo al pulsar el botón. Es el mismo patrón que ya funciona en el constructor de formularios.

### 2.8 La cifra que abre el CRM es la brecha de nombres

`cuposConfirmados − nombresEntregados`, por oferta y por grupo, con la lista de empresas que deben nombres. Es la única cifra del CRM que se traduce en una llamada telefónica hoy mismo, funciona desde el primer día porque el numerador ya existe, y mide **el riesgo número uno del proyecto**: que las empresas nunca entreguen los nombres y acabemos con 4.797 cupos reservados y 800 personas identificadas. Por eso va en la primera entrega y no en la cuarta.

El CRM **no publica ningún «% de avance» calculado sobre participantes**: el avance sigue saliendo de `Oferta.cuposOcupados`. Dos números que miden lo mismo acaban discrepando y nadie sabe cuál creer.

### 2.9 Notas y auditoría: autor congelado, sin borrado

`NotaParticipante` con `autorId` **y** `autorNombre` congelado en el momento de escribir. No se borra; una corrección es otra nota. Es la petición literal del cliente («que las notas permitan ver quién lo hizo») y el mismo patrón que ya usa `Respuesta.etiquetaPregunta`: si mañana se desactiva o renombra la cuenta, la nota tiene que seguir diciendo quién lo dijo. Sin notas privadas: una nota es información sobre una persona identificada y bajo habeas data esa persona puede pedirla.

`MovimientoReserva.adminId` y `AccionMovimiento.AJUSTE_ADMIN` existen en el schema y **nadie los escribe en todo el backend** (verificado). El CRM es el momento de terminar esa auditoría, no de inventar otra.

### 2.10 Lo que se recorta, y por qué

| Recortado | Motivo |
|---|---|
| Pantalla de fusión de duplicados y `fusionadaEnId` | Con `@@unique([tipoDocumento, numeroDocumento])` + normalización, el duplicado por documento es **imposible de crear**. Lo que queda (misma persona con CC y con PPT) es raro y se arregla en psql las tres veces que pase |
| `InvitacionNominacion` con token en la fase 1 | El 100 % del valor («¿quiénes son los 4.797?») se consigue con el asesor pegando el Excel que la empresa le manda. Evita construir el canal de correo antes de saber si hace falta |
| Motor de plantillas del SEP en base de datos (dos tablas + editor con arrastre) | Contradice el patrón de la casa (`Tema.colores` es JSON validado contra un catálogo en código). Las columnas van en **un archivo TypeScript**; si el formato resulta cambiar a menudo, se promueve a columna JSON después |
| `AsignacionParticipante`, `Participante.asesorId` materializado, `veCarteraAjena` | El tope del sistema son 4.797 cupos: un JOIN por FK indexada no se mide. La cartera va en `Reserva.asesorId` y su historial en la tabla genérica de auditoría |
| Cohortes semanales de conversión, estandarización indirecta por mezcla, p90 | Con 15 acciones × 15 departamentos, la mayoría de celdas tendrán n<5 y el ajuste será tan ruidoso como el dato crudo. La conversión por asesor **no se publica en la v1** |
| `MotivoSalida` como catálogo administrable | El propio diseño pregunta al cliente si el SENA impone la lista. Enum + «Otro con texto» hasta que se sepa |
| Píxel de apertura de correo | El dato es basura desde que Apple Mail precarga imágenes, y meter rastreo en un sistema que está pidiendo autorización de tratamiento es regalarle el argumento a quien lo revise |
| Suplantación de identidad («ver como este asesor») | Rompe justo el atributo por el que el cliente pidió las notas con autor |
| SMS | El enum lo contempla desde el día uno (cuesta cero); no se implementa. Esta audiencia tiene correo corporativo y WhatsApp |

---

## 3. Modelo de datos

### Tablas nuevas

**`Persona`** — la identidad natural, única en todo el sistema y compartida entre convenios.
`id`, `tipoDocumento` (enum `CC, CE, TI, PA, PEP, PPT, RC, OTRO`), `numeroDocumento` (normalizado), `primerNombre`, `segundoNombre?`, `primerApellido`, `segundoApellido?`, `fechaNacimiento?`, `sexo?`, `correo?`, `celular?` (E.164), `creadoEn`, `actualizadoEn`.
`@@unique([tipoDocumento, numeroDocumento])`. La normalización va en `backend/src/comun/documento.ts`, hermano de `nit.ts`. **Sin `convenioId`, a propósito.** El nombre va en cuatro columnas porque el cargue del SENA las pide separadas y partir «MARIA DEL CARMEN DE LA HOZ» por espacios se equivoca siempre.

**`Participante`** — la persona ocupando una silla.
`id`, `personaId`, `reservaId`, `ofertaId`, `accionFormacionId`, `coberturaId?`, `etapa`, `origenDato` (EMPRESA/ASESOR/AUTOGESTION), `cargoEnEmpresa?`, `nivelOcupacional?`, `nivelEducativo?`, `porcentajeAsistencia?`, `notaFinal?`, `fechaMatricula?`, `fechaRetiro?`, `motivoSalida?`, `fechaCertificacion?`, `cargadoEnSepEn?`, `anuladoEn?`, `motivoAnulacion?`.
`@@unique([accionFormacionId, personaId])` — nadie cuenta dos veces contra la meta por estar en dos ubicaciones de la misma AF. `ofertaId` y `accionFormacionId` se denormalizan desde la reserva: es seguro porque **una reserva nunca cambia de oferta** (`editar` solo toca la cantidad; cambiar de oferta es otra reserva). `reservaId` con `onDelete: Restrict`. Índices por `(coberturaId, etapa)` y `(ofertaId, etapa)`.

**`MovimientoParticipante`** — cada cambio de etapa. Es la ÚNICA fuente del embudo, de los tiempos y del ritmo de matrícula.
`id`, `participanteId`, `etapaAntes`, `etapaDespues`, `motivo?`, `adminId?`, `nota?`, `ip?`, `creadoEn`. Calcado de `MovimientoReserva`, con `@@index([creadoEn])` para agregar por día en SQL.

**`NotaParticipante`** — `id`, `participanteId`, `autorId?`, `autorNombre` (congelado), `texto`, `creadoEn`. Solo se crea.

**`AutorizacionDatos`** — la prueba legal.
`id`, `personaId`, `politicaDatosId`, `canal` (FORMULARIO_WEB / CARGA_EMPRESA / VERBAL_ASESOR / CORREO), `otorgadaEn`, `ip?`, `userAgent?`, `evidencia?`, `revocadaEn?`. No es un booleano: hay que poder demostrar qué versión se aceptó, por qué canal y si se revocó.

### Tablas existentes que cambian

**`PoliticaDatos`** — gana `destinatario: RESERVA | PARTICIPANTE`. Y por fin gana CRUD y página pública.
**`Reserva`** — gana `asesorId?` (FK a `Admin`, `onDelete: SetNull`) y `origen: PUBLICO | PANEL`. `estado` **no se toca**: tiene tres CHECK colgando.
**`Admin`** — gana `convenioId?` (nulo = ve los dos) y el enum `RolAdmin` gana `ASESOR`. *Nota de operación: `ALTER TYPE ... ADD VALUE` no puede ir en la misma migración que lo asigna, y las migraciones corren solas en el `CMD` del Dockerfile — van en migraciones separadas o el backend no arranca.*
**`Grupo`** — **ni un campo nuevo.** `fechaInicio`, `fechaFin` y `horario` ya existen y están vacíos en las 67 filas. Lo que falta es poder escribirlos. El CRUD se limita **estrictamente** a esos tres campos: `sedeUbicacionId` lo pisa el seed en cada resiembra, y `GrupoCobertura.cuposBase` **es de donde sale la meta de 3.690** del tablero — dejar que un admin la toque es dejar que mueva el compromiso con el SENA sin auditoría.
**`Respuesta` / `Pregunta`** — *aplazado*. La idea de reutilizar el constructor de formularios para los campos de caracterización del SEP (`Pregunta.ambito = PARTICIPANTE`) es buena, pero obliga a partir el `@@unique([reservaId, preguntaId])` en índices únicos parciales que Prisma 6 no expresa (SQL crudo y pérdida de tipado), y a que **cada** lectura de `formulario.preguntas` filtre por ámbito. Se decide cuando llegue el formato real del SEP.

### Tablas de fases posteriores

**`RegistroAuditoria`** (fase 2) — `adminId?`, `actorNombre` (congelado), `accion`, `entidad`, `entidadId`, `convenioId?`, `resumen`, `antes Json?`, `despues Json?`, `ip`, `userAgent`, `creadoEn`. **Dentro no entran datos personales**: para cambios en PII se guarda qué campos cambiaron, no los valores — si no, la auditoría se convierte en una segunda copia completa de los datos personales, y es la copia que nadie recuerda proteger. `accion` como `String` validado contra un catálogo en código, **no** como enum de Postgres. No se fusiona con `MovimientoReserva`: el ritmo agrega sus columnas enteras en SQL y en JSON eso se acaba.

**`Envio` + `EventoEnvio` + `Consentimiento`** (fase 3) — la cola vive en Postgres, no en Redis, para que el encolado entre en la **misma transacción** que crea la reserva y no haya doble escritura. `Consentimiento` fusiona consentimiento y supresión en una sola tabla append-only por `(canal, destino)` con estado `OTORGADO | REVOCADO | REBOTE_DURO | QUEJA`: el estado vigente es la última fila.

**`CargueGenerado`** (fase 4) — quién, cuándo, qué versión de plantilla, qué filtros, cuántas filas salieron y cuántas se omitieron. **No guarda el archivo** ni el array de participantes: para «¿a quién ya cargué?» basta `Participante.cargadoEnSepEn`.

---

## 4. Fases de entrega

### Fase 0 — Desbloquear y tapar *(pequeña; cero CRM)*

Es la entrega más barata y la que más valor inmediato da, porque **responde la mitad de la petición literal del cliente** sin tocar el modelo.

- **Fechas de los 67 grupos**: `PATCH /admin/grupos/:id` (solo `fechaInicio`, `fechaFin`, `horario`) y pantalla `/admin/grupos` con edición **en línea**, no carga por Excel. Son 67 filas × 3 campos, una vez en la vida: el generador de plantilla + parser + validación previa cuesta diez veces más que una tabla editable, y `exceljs` hoy está montado solo para escribir.
- **Cupos en tiempo real para el asesor**: `/admin/tableros/ubicaciones` **ya devuelve** acción × ubicación con cupos, ocupados, disponibles, avance, semáforo y `abierta`, y `datos-vivos.ts` ya lo refresca cada 30 s. Se le añaden **departamento, fechas del grupo, cupos en espera y estado de publicación**, y se monta `/admin/cupos`: agrupado por departamento (la cabecera dice «2 ofertas», nunca un total sumado — un cupo presencial en Medellín y uno virtual para Antioquia no son intercambiables), con el filtro **«necesito N cupos»** calculado en el navegador y la píldora de publicación. Sin websockets ni SSE: nginx corta a 90 s, Cloudflare a ~100 s, y la garantía real la da el 409 del `UPDATE` condicional al reservar.
- **Cerrar los agujeros de roles**: `@Roles(SUPERADMIN, GESTOR)` a nivel de clase en `TablerosController` y `FormulariosAdminController`, y en las rutas de marca, logos y `PATCH /admin/acciones/:id`. Son cuatro líneas y hoy una cuenta `CONSULTA` descarga todos los contactos y borra formularios.
- **Política de tratamiento**: CRUD, página pública, campo `destinatario`, y `politicaVigente()` deja de devolver `null` en silencio — sin política vigente no se publica una acción.
- **Bugs verificados**: `date_trunc` a hora de Bogotá en las **cuatro** consultas (líneas 305, 491, 516 y 538 de `tableros.service.ts`) **y** en `aDia()` de `proyeccion.ts`, que usa `toISOString()` en UTC para calcular la ventana — cambiar solo el SQL corre la ventana un día entre las 19:00 y medianoche. Devolver `to_char(...)` como texto. Además: **`tableros.service.ts` contiene un byte NUL literal** en el centinela de búsqueda por NIT (`contains: soloDigitos(buscar) || '\0'`) — Postgres no admite NUL en `text`, así que la búsqueda por razón social probablemente devuelve 500. Confirmado que el archivo es «binario» para grep.
- **Throttler**: el tablero dispara 6 peticiones por refresco y el límite global es 60/min **por IP**; cinco personas del mismo despacho ya agotan la cuota, hoy. Límite propio por id de administrador en `/admin/*`.
- **Lista de slugs reservados** en el DTO de formularios (hoy se puede crear un formulario con slug `admin` o `consulta` y quedarse inaccesible).
- **Blindar los scripts destructivos**: `db:borrar-reservas` y `db:reiniciar-reservas` borran de verdad, y con `Participante` colgando en cascada se llevarían por delante personas, autorizaciones y el soporte del cargue al SEP. Que se nieguen si hay participantes.

**Al terminar:** el asesor ya tiene cupos por departamento y acción con fechas de inicio y fin, y el panel ya no filtra datos de contacto a cualquier cuenta.

---

### Fase 1 — La persona existe *(la más grande de todas; es el corazón del CRM)*

- `Persona`, `Participante`, `MovimientoParticipante`, `NotaParticipante`, `AutorizacionDatos`, con sus CHECK a mano en la migración.
- `Admin.convenioId` + filtro de ámbito inyectado en tableros y CRM. Ojo: `tableros.service.ts` son ~950 líneas y hay que tocarlas todas, incluidos los tres bloques de SQL crudo, donde Prisma no protege nada. Y `porEmpresa` **cambia de significado**: la empresa es única por NIT y cruza convenios, así que hay que filtrar la lista **y** recalcular sus totales sobre las reservas del ámbito.
- **Nominación desde el panel**: a mano por el asesor y por carga de Excel en dos pasos (previsualizar el diff → confirmar). Sin token, sin correo, sin pantalla pública. La plantilla de carga es **la misma** que la matrícula que se descarga: el asesor baja el archivo con una fila vacía por cupo confirmado, la empresa la llena, se sube.
- **Los tres arreglos del invariante** de la sección 2.3, más la comprobación nueva en `db:verificar`.
- Asignación automática de cobertura en el 82 % de los cupos; filtro «sin cobertura» para los 878 restantes.
- **Tablero de brecha de nombres** por oferta y por grupo, con la lista accionable de empresas que deben nombres.
- **Excel de matrícula por grupo**: bloque de encabezado (convenio, acción, grupo, modalidad, sede, fechas, horario, comprometidos, matriculados) sobre la tabla, e incluye a **todos** con dos columnas propias: «Estado del registro» y «Faltantes». `construirLibro` gana `encabezado?` y `Columna.tipo: 'texto' | 'numero' | 'fecha'`. *Matiz que la revisión acertó: `numFmt = '@'` no convierte un número en texto — la protección real contra la notación científica es pasar cadenas, y el código ya lo hace; el refactor sigue valiendo la pena por las fechas y por dejarlo explícito.*
- Ficha del participante: identidad, matrícula, autorización, notas con autor, historial y sus otras participaciones.

**Al terminar:** se puede responder «quiénes son los 4.797», que hoy no se puede responder de ninguna manera, y sale la matrícula por grupo.

---

### Fase 2 — Seguimiento, equipo y auditoría *(media)*

- Etapas completas, kanban por AF y por grupo con **filtro obligatorio** (4.797 tarjetas en siete columnas no se leen), y **acciones por lote desde el primer día** (matricular un grupo de 250 de uno en uno no es viable, y si no está, el módulo se abandona y se vuelve a Excel).
- Rol `ASESOR`, catálogo de permisos en `backend/src/admin/permisos.ts` con `@Permiso` sustituyendo a `@Roles`, y `GET /admin/yo` devolviendo los permisos ya resueltos para que el frontend deje de decidir la navegación con un `soloSuperadmin` escrito a mano.
- `Reserva.asesorId` + bandeja de sin asignar + reasignación por lote. Al desactivar una cuenta, la cartera queda como **pendiente visible** en la portada, no bloquea la desactivación ni se reasigna en silencio.
- `RegistroAuditoria` + escritura por fin de `MovimientoReserva.adminId` con `AJUSTE_ADMIN` + registro de inicios de sesión fallidos.
- Embudo acumulado, tiempos por etapa (mediana de tránsito + cuántos llevan más de N días parados), deserción **contra el margen real** — no contra un 23,1 % fijo: el global sale de `1 − 3690/4797`, pero por celda el margen es `1 − base/máximo` de las coberturas, y el truncado hace que varíe.
- Enmascarado de documento y celular en el listado, con revelado auditado en la ficha y permiso propio para exportar.

---

### Fase 3 — La empresa participa, y el correo *(una dimensión entera, no un renglón)*

Hay que ser honesto sobre esto: **no existe ni una línea de infraestructura de correo.** Ni `nodemailer`, ni cola, ni Redis, ni variable SMTP, ni SPF/DKIM/DMARC en un dominio que nunca ha enviado un correo. Es un subsistema completo con su reputación, su calentamiento de dominio, sus rebotes y su forma de fallar en silencio.

- Cola `Envio` en Postgres con `FOR UPDATE SKIP LOCKED`, worker **apagado por defecto** con `MENSAJERIA_WORKER=1` (el `.env` local apunta por túnel a la base de producción: un worker que arranque en `pnpm dev:backend` manda correos reales a empresas reales). La defensa real, además, va en el **encolado**, no solo en el worker.
- Proveedor de correo con **API REST por token** (Postmark/Resend/Brevo) detrás de una interfaz de dos métodos — **no SES+SNS**: SES exige cuenta de AWS que este proyecto no tiene, salida de sandbox por ticket, confirmación de suscripción SNS y verificación de certificado, y la diferencia de coste a este volumen es una comida.
- **Idempotencia = `MovimientoReserva.id`**, con `INSERT ... ON CONFLICT DO NOTHING` por `$executeRaw`. Dentro de la transacción solo se inserta **la intención**; el cuerpo se renderiza en el worker. Si no, una colisión de clave hace rollback de la reserva entera, y revivir una reserva cancelada repite la clave.
- Requisitos técnicos que no son opcionales: `rawBody: true` en `main.ts` (o la firma de Meta nunca cuadra), parser `text/plain` y exención del `ValidationPipe` global en las rutas de webhook, y `@SkipThrottle()` (los eventos llegan de un puñado de IPs y se comerían el límite).
- Primer correo: **aviso de promoción desde lista de espera**. Hoy `promoverListaDeEspera` mueve a una empresa de espera a confirmada **en absoluto silencio** y la empresa solo se entera si entra a `/consulta` por su cuenta. Es un fallo de producto, no una funcionalidad futura. Y el aviso tiene que decir las cantidades reales: la promoción es **parcial y repetible**.
- Nominación por la empresa con token de un solo uso enviado al correo de contacto — **no con el NIT**. La decisión de volver solo con el NIT está documentada y se sostiene mientras detrás de la puerta solo hay «cuántos cupos pedí»; deja de sostenerse cuando detrás hay cédulas, celulares y fechas de nacimiento de terceros. El NIT está en cada factura y en el RUES.
- `/matricula/:token`: la persona completa sus datos y **otorga su propia autorización**. Es el flujo legalmente correcto y el que arregla la calidad del dato.
- `Consentimiento` append-only, `List-Unsubscribe` de un clic, página de baja. Nada de envíos en lote antes de esto.

---

### Fase 4 — SEP y cierre académico *(media, y bloqueada por el cliente)*

- **Archivo de cargue al SEP**, con el formato real en la mano. Columnas declaradas en un archivo TypeScript, generado en estilo **plano** (una sola hoja, cabecera literal en la fila 1, sin filas de título ni celdas combinadas), con pantalla de **revisión en JSON separada de la descarga por navegación**, y las filas incompletas **omitidas**. Se siembra una versión marcada como **no verificada** hasta que un cargue sea aceptado.
- **Antes de diseñar nada: mirar `/opt/sep/SEPLocal`.** El propio entorno lo repite (`/opt/sep/reservasae`, `ssh sep-vm`, `sep.ggpcsena.com`): es plausible que el «cargue al SEP» sea contra el sistema hermano del mismo cliente y que su esquema esté a un `ls` de distancia. Puede disolver el riesgo número uno de esta fase.
- Carga de asistencia y notas por grupo desde Excel, cruzando por documento. **Sin modelar sesiones ni libro de calificaciones**: quien imparte es el SENA con su propia plataforma, y duplicar el registro garantiza que los dos números no coincidan.
- `RETIRADO` con fecha y motivo, `CERTIFICADO`, y la pantalla de reparto de los 878 cupos multigrupo — que tiene que existir **antes** del exportador, porque un participante sin cobertura no se puede matricular ni cargar, y eso se descubre al intentar generar el archivo.
- `CargueGenerado` + filtro «solo los que nunca se han cargado».

---

### Fase 5 — Lo opcional *(cada pieza es independiente)*

Subdominios por convenio · WhatsApp por la API oficial de Meta, solo plantillas UTILITY aprobadas (fuera de la ventana de 24 h no existe el texto libre, y ningún BSP cambia eso) · Apartar cupos desde el panel por teléfono · Reportes programados (resumen semanal, lista diaria que **no se manda si sale vacía**) · SMS, solo si tras ver los datos de entrega de correo y WhatsApp queda un hueco real.

---

## 5. Riesgos, por gravedad

1. **No hay política de tratamiento y la que se «acepta» no existe.** `PoliticaDatos` no tiene CRUD ni página pública, y `politicaVigente()` devuelve `null`: cada reserva se guarda con `politicaDatosId = null`. Con datos de empresa ya es feo; con cédulas de miles de ciudadanos es otro orden de magnitud. **Bloqueante absoluto de la fase 1.**
2. **La empresa no puede autorizar el tratamiento de los datos de sus empleados.** Ley 1581, art. 9: autorización previa, expresa e informada **del titular**, y aquí la finalidad incluye una transmisión a un tercero (el SENA). Una casilla marcada por el jefe no es autorización. Determina el flujo de nominación entero.
3. **El invariante roto en silencio.** Sin los arreglos de la sección 2.3, cancelar o editar a la baja desde el formulario público destruye el soporte de gente ya matriculada y regala sus sillas a otra empresa, sin vuelta atrás.
4. **Que las empresas nunca entreguen los nombres.** No se arregla con código, se arregla con proceso — pero se descubre tarde si no se mide desde el primer día. Por eso la brecha va en la fase 1.
5. **Los 67 grupos no tienen fechas.** Todo el eslabón académico (matricular, `EN_FORMACION`, `CERTIFICADO`) queda bloqueado, y la mitad de lo que pidió el cliente para el asesor no se puede mostrar.
6. **El formato del SEP no existe en `docs/`.** Todo lo que se diseñe sin él es adivinar, y el error se descubre con miles de filas ya capturadas.
7. **Los scripts que borran de verdad.** `db:borrar-reservas` y `db:reiniciar-reservas`, contra una base que desde el portátil **es la de producción**.
8. **Roles: `CONSULTA` lo ve todo.** Hoy ya descarga los contactos; mañana descargaría las cédulas.
9. **El correo es un subsistema, no un renglón.** Sin SPF/DKIM/DMARC y sin calentar el dominio, el primer envío masivo va a spam en Outlook/365 — que es donde está esta audiencia — y el fallo es silencioso: nadie abre un ticket porque un correo *no* llegó.
10. **Calidad del dato.** Los correos y documentos los teclea una persona de RR. HH. en una plantilla para 40 compañeros. Un dato sucio en la fase 1 es un rechazo del SEP en la fase 4, cuando ya no hay a quién preguntar.
11. **Datos sensibles y menores.** Si el SEP pide grupo étnico, discapacidad o condición de víctima, son datos sensibles (art. 5): autorización reforzada, no obligatorios, y el constructor actual no distingue preguntas sensibles. Y `TI` significa menor de edad: autorización del representante legal, y el flujo de «la persona completa su propia matrícula» no vale para ellos.
12. **Retención y supresión** contra una bitácora inmutable. Hace falta una ruta de anonimización decidida desde el principio; después es una migración con datos reales dentro.
13. **Una persona con dos tipos de documento** queda duplicada sin mecanismo de fusión en la v1. Raro, pero cuenta dos veces contra la meta.
14. **Expectativa del subdominio.** El cliente creerá que aísla legalmente dos responsables de tratamiento distintos, y no lo hace: un solo Postgres, un solo backup, y cuentas globales que ven los dos.
15. **Tres avances que van a divergir**: cupos reservados, personas matriculadas y personas certificadas. Si nadie decide cuál es la cifra grande, el tablero empieza a contar dos historias a la vez.

---

## 6. Preguntas al cliente

### Bloquean la fase 1 — hay que preguntarlas ya

1. **¿Quién es el responsable del tratamiento de los datos de los participantes: Grupo AE, cada convenio (ADECOPRIA / UNIÓN TEMPORAL BRITCHAM ADEE), o el SENA?** Determina quién firma la política, quién responde ante la SIC y si hace falta contrato de transmisión y registro en el RNBD.
2. **¿Está aprobado el texto de la política de tratamiento para participantes?** No es el mismo que el de quien reserva: cambian las finalidades e incluye la transmisión al SENA.
3. **¿Puede la empresa entregarnos el documento y el celular de sus empleados, o solo el nombre y el correo corporativo?** Es la decisión que define el flujo de nominación entero. La respuesta jurídicamente segura es «solo el correo, y que cada persona complete el resto».
4. **¿Nos pueden enviar un archivo de ejemplo REAL del cargue al SEP, aunque sea con datos ficticios?** Y: **¿qué es el SEP exactamente** — nombre completo, URL — y **¿es el mismo sistema que `SEPLocal`, el proyecto hermano en el servidor?** Una sola respuesta resuelve la mitad de las dudas de la fase 4.
5. **¿Quién tiene las fechas de inicio y fin de los 67 grupos y para cuándo?** Sin ellas no se puede matricular a nadie ni mostrar al asesor lo que pidió.
6. **¿Qué pasa con un cupo confirmado que nunca se nomina?** ¿Hay fecha límite tras la cual se libera y se promueve la lista de espera, o se queda hasta que alguien lo edite? El sistema no puede decidirlo solo.
7. **¿Los 3.690 beneficiarios se acreditan como matriculados o como certificados?** Decide cuál es la cifra grande del tablero cuando existan personas.
8. **¿El SENA acepta cargar el 130 % (4.797) o solo la meta (3.690)?** Si es solo la meta, el sobrecupo deja de ser colchón de deserción y pasa a ser una lista de espera que hay que gestionar de otra forma.
9. **¿Los asesores son personal de Grupo AE o de los gremios, y puede un asesor ver participantes del otro convenio?** Si son responsables de tratamiento distintos, el ámbito cruzado no se puede permitir aunque lo pidan.
10. **¿Una misma persona puede estar en dos acciones de formación? ¿Y en la misma acción bajo los dos convenios? ¿Hay tope de cursos por persona?**
11. **¿Se admite alguien sin empresa (inscripción individual)?** Hoy el modelo dice que no; cambiarlo después obliga a inventar una «empresa» que es la propia persona.
12. **Confirmar el NIT de ADECOPRIA:** `890.982.432-0` (proyecto) o `890.901.432-0` (aviso de privacidad). Va impreso en la política que firma cada participante.

### Bloquean las fases 3 y 4

13. **¿La «matrícula» es un formato oficial del SENA o interno?** ¿Lleva firma del participante? Si lleva, se diseña para imprimir, no para filtrar en Excel.
14. **¿Qué listas exactas usa el SEP para nivel educativo y nivel ocupacional?** Los proyectos comprometen cupos por nivel ocupacional; si la lista no coincide, el reporte no cuadra.
15. **¿Se admiten PPT y PEP como documento? ¿Y menores con TI?** En las empresas afiliadas hay trabajadores venezolanos, y si el SEP no los acepta hay que saberlo antes de prometer el cupo.
16. **¿El cargue es acumulativo (actualiza por documento) o cada archivo crea registros nuevos?** De eso depende si hay que excluir a quien ya se cargó.
17. **¿Existe un catálogo oficial del SENA de motivos de retiro?** Si existe, el sistema nace con esos valores.
18. **¿Qué porcentaje de asistencia exige el SENA para aprobar, y desde qué punto es deserción y no inasistencia?**
19. **Cuando alguien se retira después de estar cargado en el SEP, ¿hay que reportar la baja?** Decide si `RETIRADO` es una etiqueta interna o dispara un trámite.
20. **Correo: ¿cuál es la dirección remitente, el nombre visible y —sobre todo— a qué buzón llega y quién lee las respuestas?** Un remitente sin buzón de respuesta genera quejas garantizadas.
21. **¿En los correos y WhatsApp sí se puede nombrar al SENA y el tipo de formación?** En el sitio público se decidió que no; cambia el texto de todas las plantillas y, en WhatsApp, lo que se manda a aprobar.
22. **WhatsApp: ¿de qué número sale, quién completa la verificación de negocio de Meta, y qué presupuesto hay?** Meta cobra por mensaje de plantilla y la verificación es calendario del cliente, no nuestro.

### Se pueden responder más tarde

23. ¿Quién decide el reparto de los 878 cupos multigrupo de Bogotá y Antioquia, y con qué criterio: equilibrar, jornada preferida, u orden de llegada?
24. ¿Quién puede descargar la matrícula y el archivo del SEP? Propuesta: matrícula para GESTOR y SUPERADMIN, SEP solo para personas concretas y con nombre, CONSULTA ninguno.
25. ¿Puede un asesor exportar su propia cartera a Excel, o toda exportación nominal queda en gestión?
26. ¿Cuánto tiempo hay que conservar los datos personales tras el cierre del convenio? Lo dice el contrato con el SENA, y sin ese número no se puede escribir ni la cláusula ni la purga.
27. ¿El asesor promete por teléfono un grupo o una fecha concreta? Si la respuesta es sí, el cupo tendría que moverse de la oferta al grupo, y ese es el cambio más caro que se puede pedir.
28. ¿Los subdominios exactos? `britcham-adee.reservasae.com` es el slug técnico y es feo de dictar; `britcham.reservasae.com` se lee mejor. Cambiarlo después obliga a reemitir los enlaces repartidos.
29. En el sitio de un convenio, la consulta pública por NIT ¿debe mostrar también las reservas del otro convenio? Hoy las muestra todas.
30. ¿Hay proceso de selección o entra todo el que se postula? Si hay selección, falta una etapa de aprobación y una de rechazo con motivo.