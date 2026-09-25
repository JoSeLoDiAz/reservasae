# Lo que queda — lista real

**Revalidado contra el código de hoy**, después de los ~45 commits de José. Sustituye a los
recuentos anteriores, que estaban desfasados.

| | |
|---|---|
| Método | 4 revalidadores + 4 refutadores, 0 fallos |
| Línea base | `tsc` de backend y frontend limpios · **1109 pruebas en 101 suites, verde** (eran 853) |
| Resultado | **97 puntos revisados: 12 cerrados, 74 vivos, 11 cambiaron de forma** |

> Los refutadores encontraron **5 dados por cerrados que seguían vivos**. Van corregidos
> abajo — es exactamente el error que más caro sale, porque hace que se deje de mirar.

---

## Por dónde entrar, según el tiempo que tengas

| Coste | Cuántos |
|---|---|
| **Minutos** | 14 |
| **Horas** | 40 |
| **Días** | 6 |
| **Necesita migración** | 10 |
| **Necesita decisión** | 15 |

---

## Los 14 de minutos

Lo más rentable que hay. Ordenados por lo que pesan:

| Id | Qué | Arreglo |
|---|---|---|
| **B-01** 🔴 | El control de reparto de fichas **se salta por la puerta de al lado** | Exigir `conveniosQueReparten` en `@Patch(':id')` cuando venga `asesorId` |
| **A-08** 🔴 | Carrera entre la comprobación de idempotencia y el `insert` | `try/catch` de P2002 y devolver `repetido: true` |
| **B-03** 🔴 | `PATCH :id/formacion` mueve de acción **sin mirar la etapa** | Rechazar si está en terminal (`CERTIFICADO`, `RETIRADO`) |
| **MESA-02** 🔴 | La paginación de la mesa **sigue sin un solo botón** | `useState` de página y dos botones |
| **B-09** | La regla del celular está escrita una vez y aplicada en **2 de 5** puertas | Llamar a `celularValido` en las tres que faltan |
| **B-15** | Borrar la participación **devuelve la cédula en claro** | `taparDocumento` en la respuesta |
| **A-05** | La fusión **descarta el documento y el interés** del lead nuevo | Añadirlos a `llega` |
| **MESA-05** | El filtro `estado` llega al `where` de Prisma **sin validar** | `@IsEnum` y quitar el `as never` |
| **LOTE-02** | El texto crudo de la excepción **sale al cliente** | Filtrar por tipo; el resto al log |
| **B-14** | Repartir una ficha no deja registro | Emitir `ASESOR_ASIGNADO` |
| **A-01** | El documento sale en claro **en la mesa** | *(ver la nota de abajo)* |
| **AJUSTE-01** | `AJUSTE_ADMIN` existe y no lo emite nadie | Emitirlo, o sacarlo del enum |
| **CONVERTIR-UNO** | `POST :id/convertir` sigue sin llamarse | Colgarla del cajón, o borrarla |
| **TOQUE-CAMPAÑA** | El parámetro `campana` existe y nadie lo pasa | Pasarlo, o quitarlo |

> **Sobre A-01:** el revalidador pide tapar el documento en la mesa. **Ya rechacé eso una vez
> y sigo rechazándolo:** `taparDocumento` se escribió para los logs, el listado de
> participantes devuelve la cédula entera igual, y la mesa **busca por documento**. Lo dejo
> anotado para que no vuelva a aparecer como pendiente.

---

## Los cinco cerrados en falso

Los refutadores hicieron su trabajo. Estos **estaban dados por cerrados y no lo están**:

**1. `B-08` — la validación, no la normalización.** `preinscripcion.service.ts:252` normaliza,
pero **no llama a `documentoValido(tipo, numero)`**. Es la **única de las ocho puertas** que no
lo hace. Una cédula con letras entra por ahí.

**2. `A-15` — `procesadoEn` en el camino más recorrido.** La rama firme del webhook
(`leads.service.ts:526-536`) escribe `participanteId`, `CONVERTIDO` y `motivo`, **y no pone
`procesadoEn`**. Las tres puertas del panel sí lo ponen.

**3. `B-14` — crear ficha por la puerta pública.** `PARTICIPANTE_CREADO` cubre `crm.crear()`,
pero `preinscripcion.service.ts:349` hace **su propio `participante.create`** —el otro único
del backend— y deja solo un movimiento, **ni una fila de auditoría**.

**4. `AUD-PARTICIPANTE`** — el mismo caso, visto desde el otro lado: mi comentario dice que
cubre las cuatro puertas y **no cubre la pública**.

**5. `M-11`** — retirar la migración del plan es correcto, pero **queda el problema que
resolvía**. Y su paso manual sigue apuntando a un fichero que no existe.

> Las tres primeras son **el mismo defecto de forma**, y ya van cuatro veces esta semana: un
> arreglo que cierra el camino principal y deja abierta la puerta pública. Preinscripción es
> la que más gente usa y la que menos se mira.

---

## Los críticos, hoy

**De 14: 2 cerrados, 8 vivos, 4 cambiaron de forma.**

**`C-14` — el recuento, medido hoy:** **22 de 75 escrituras dejan huella.** Eran 14 de 71.
Subió por `PARTICIPANTE_CREADO`, `PARTICIPANTE_BORRADO`, la caracterización y
`ORGANIZACION_CAMBIADA`.

Quedan **53 sin huella**, y ahora los huecos tienen nombre: **permisos** (9 escrituras en
`admin.service.ts`), **políticas de datos** (4) y **cronograma** (2).

**`E-01` — un matiz que no sabíamos:** el cronograma **no puede auditar aunque se quiera**. El
catálogo de `auditoria.service.ts` no tiene las entidades `GRUPO` ni `COBERTURA`, y como está
declarado `as const`, **no compilaría**. Hay que ampliar el catálogo primero.

**`D-02` — cambia el orden, y esto importa:** el embudo único de lectura hay que tenerlo
**antes** de crear la papelera, no después. Hoy no hay daño porque no hay nada archivado. Si se
hace al revés, se archiva y **sigue viajando al SENA**.

**`D-01` — mejoró sin cerrarse:** ahora el borrado deja huella (`PARTICIPANTE_BORRADO`), pero
sigue siendo borrado físico y **sigue sin haber `archivadoEn` en el esquema**. `grep archivado`
sobre `schema.prisma` no devuelve nada.

---

## Las migraciones

**De las 12: una aplicada (la 09), una retirada (la 11), diez siguen haciendo falta.**

Todas necesitan renumerarse: las mías empiezan en `20260831090000` y las de José ya van por
`20260902000000`.

---

## Para José

**Lo que está esperando ventana:**
- La **01 y la 02** — la bitácora por trigger. De ellas dependen cuatro críticos. La 02 toma
  candado sobre 43 tablas: **avisar antes**.

**Lo que hace falta preguntarle o decidir con él:**
1. **¿Amplía el catálogo de auditoría con `GRUPO` y `COBERTURA`?** Sin eso, `E-01` no se puede
   arreglar ni queriendo.
2. **¿La papelera va antes o después del embudo?** La respuesta correcta es el embudo primero,
   pero es su despliegue.
3. **Cuando el SENA dé los tres ids** (`sepProyectoId`, `accionSepId`, `grupoSepId`), **¿dónde
   se ponen?** Hoy no hay pantalla, ni ruta, ni seed. Él hizo que el reporte salga sin ellos —
   correcto para desbloquear — pero el día que lleguen no hay dónde escribirlos.

---

## Lo que sigue sin poder hacerse

**El aula.** `actividades` y `avances_actividad` **no las escribe nadie en producción**. Con las
tablas vacías, `cambiarEtapa` **impide certificar a cualquiera**. Y certificar es lo que paga el
SENA. Esto no se arregla con código: **se desbloquea con el LMS**.

**El retiro.** Las cuatro salidas del aula siguen fuera de `ETAPAS_DEL_REPORTE`, así que quien
se retira **desaparece del cargue** en vez de reportarse. Bloqueado por la pregunta al SENA
sobre los valores de la columna `ESTADO`.

---

## Pedidos de Mauricio · madrugada del 25 sep 2026

La cajita de esta tanda: **todo lo que pidió, entregado o no**, para que no se escape nada.
Se cierra uno antes de abrir el siguiente.

### Entregado y probado

| Qué | Dónde | Commit |
|---|---|---|
| «Seguimiento de las reservas» se despliega al pulsar un departamento, recortado a él | Control de Reservas | `f50b4d7`+`a943518` |
| Fuera el párrafo que explicaba «cupo ocupado / pendientes» | Control de Reservas | idem |
| «Sin departamento» deja de devolver informe vacío | backend, filtro del informe | `a943518` |
| Orden y nombres de las columnas del listado por organización | Reservas | `0815b30` |
| «Descargar en Excel / formato / Cargar archivo» en las dos vistas | Reservas | `5f3a405` |
| «2 · 30 cupos» se leía «2 de 30»: fuera la repetición | Reservas | `3cae914` |
| Fuera la leyenda de las celdas AF | Reservas | `ac3fc2b` |
| **Cupos ocupados y Cupos pendientes**, con el criterio del informe | Reservas + backend | `d1ea967` |
| Las cinco cifras iguales en las dos vistas; «Cupos pendientes» | Reservas + Control de Reservas | `2b5613e` |
| La celda AF dice «1 de 16», y el cajón lo abre reserva por reserva | Reservas | `d33f51f` |
| Fuera el rótulo, la descripción y el pie del bloque de asesores | Seguimiento de asesores | `b52ef59` |
| **Seguimiento académico rehecho**: resumen, cupos e inscritos, dos gráficas y su tabla AF × grupo × UT | Seguimiento académico | `2ae4d61` |

### En curso

Nada. Todo lo pedido esta madrugada está entregado y probado.

### Lo que falta

**Nada por construir.** Lo de «vive separado» era que el buscador y los filtros no vivieran
dentro de la caja con la tabla, como en Gestión de leads: hecho. La pestaña académica se
convirtió también a la tabla compartida, con sus siete puertas y sin su pie.

1. **Empujar la rama.** Hay ocho commits solo en la máquina de Mauricio, el parte para José
   entre ellos.
2. **Que Mauricio valide** las cuatro pantallas en su 3100, de una pasada.
3. **Nada de esto se ha visto fuera de su local.** Todo se probó contra la base sembrada del
   5544; en `dev` y en `prueba.reservasae.com` no está.

### Decidido, para que no se vuelva a preguntar

- **El commit roto `f50b4d7`** (usa un componente que aún no existía) **se queda como está**.
  HEAD compila. Ya está en `origin`; reescribir historial empujado es peor que el defecto.
- **Destino**: la rama de siempre, `andres/pantallas-sobre-dev`. No sale a `dev` por mi cuenta.
- **Lo del correo que abre el lead en la columna derecha** era una descripción de Gestión de
  leads, no un pedido. Descartado.
- **«El dato no sirve»** se queda: son tres resultados porque cada uno lleva a una acción
  distinta, y en esta base se usa 46 veces contra 72 «no contestó» y 96 «hablé con ella».

### El riesgo que no es de código

Otra sesión de Claude trabaja **en este mismo worktree** y se llevó trabajo mío dentro de sus
commits **dos veces** esta madrugada —`f50b4d7` quedó sin compilar por eso—. Mientras las dos
escriban aquí, la forma de acotarlo es **commitear cada pieza en cuanto termina**.

---

## Para José · el estado al 25 de septiembre de 2026

**Escrito para José**, para que decida qué integra. Es el parte de la rama, no un resumen de
conversación: lo que hay, dónde está, qué hace falta para desplegarlo y qué mirar antes.

**Estado comprobado hoy:** `tsc` limpio en backend y frontend · **2.096 pruebas en 185 suites,
verde** · las pantallas ejercitadas con navegador contra la base del 5544.

### Dónde está todo

Rama **`andres/pantallas-sobre-dev`**, **48 commits por encima de `origin/dev`**.

- **Funde sin conflictos.** Comprobado con `git merge-tree --write-tree origin/dev HEAD`.
- **96 ficheros**, backend y frontend.
- **Una migración**: `20260923190000_asesor_academico_por_grupo`.

### Qué entra, por pantalla

| Pantalla | Qué cambió |
|---|---|
| **Seguimiento del aula** (`/admin/participantes/academico`) | La tabla pasa al esquema de Gestión de leads: buscador, filtros por columna, selector de columnas y descarga. Diez cifras arriba, filtros fusionados en la fila del buscador, seis columnas nuevas, el avance actividad por actividad y el cajón que abre el lead completo. El aula son los CURSOS, solo lo virtual, y **las seis actividades de verdad** (contaba nueve). |
| **Seguimiento de asesores** (`…/academico/asesores`) | Pantalla nueva: carga y ritmo por asesor, con cierre, «debe hacer al día» y estado. Al pulsar una fila, **subtabla debajo** con su desglose acción por acción. Montada como Control de inscritos: buscador y filtros sueltos, sin caja. |
| **Seguimiento académico** (`…/academico/tablero`) | Rehecho entero: resumen general, cupos e inscritos por acción, dos gráficas y la tabla `AF · GRUPO · SIN INGRESO · SIN ACTIVIDAD · UT1…UT5 · EVAL FINAL · TOTAL PAX`, con subtotal por AF. |
| **Control de Reservas** (informe) | Las tres cifras de la ocupación. «Seguimiento de las reservas» deja de estar siempre puesto: **sale al pulsar un departamento**, recortado a él. «Pendientes» pasa a «Cupos pendientes». |
| **Reservas** (`/admin/reservas`) | Vista nueva **por organización**, con las AF como columnas. Orden y nombres de columnas rehechos, **«Cupos ocupados» y «Cupos pendientes»** con el criterio del informe, y la descarga y el cargue en las dos vistas. |
| **Control de inscritos** | Las tarjetas como las pidió el cliente, y la leyenda de la tira con los nombres nuevos. |
| **Arranque** | El `.env` se carga antes que cualquier import. Con eso **el login arranca en local sin el 500** que veníamos viendo. |

### Qué hace falta para desplegarlo

1. **`pnpm prisma:deploy`** — la migración de arriba.
2. **Construir backend Y frontend.** No vale solo el frontend: el backend cambió en
   `reservas-agrupadas.ts` (endpoint nuevo del listado por organización, y los campos
   `conNombre`/`sinNombre`), `asesores-datos.ts` y `seguimiento-de-asesores.ts` (el desglose por
   asesor), `resumen-por-accion.ts`, `resumen-por-grupo.ts`, `informe-de-reservas.ts` y
   `main.ts`.
3. Si el backend queda sin reconstruir, la pantalla de reservas enseña **columnas en blanco**
   donde van los cupos ocupados, y el desglose del asesor dice que el servidor no lo manda.

### Lo que hay que saber antes de integrar

- **El commit `f50b4d7` no compila por sí solo.** Usa un componente que se definió en el
  commit siguiente. `HEAD` compila y funciona; el que no sirve es ese commit suelto. **No
  cortar por ahí** en un bisect ni llevárselo aislado. Se decidió dejarlo como está en vez de
  reescribir historial ya empujado.
- **Dos sesiones escribieron en este mismo worktree la madrugada del 25.** Varios commits
  llevan dentro trabajo que su mensaje no menciona. Si un mensaje no cuadra con el diff, es
  por eso, no porque falte contexto.
- **Nada de esto se ha visto fuera del local de Mauricio.** Todo se probó contra la base
  sembrada del 5544, con navegador y a mano. En `dev` y en `prueba.reservasae.com` no está.
- **Cupos ocupados sale cuadrado contra Control de Reservas**: comprobado sobre la misma base,
  51 pares acción × organización, cero discrepancias, mismos totales (46 ocupados, 496
  pendientes). Si al desplegar discrepan, el defecto está en el despliegue, no en la cuenta.

### Lo que sigue pendiente, y no es de esta entrega

Lo de siempre, que ya está arriba en este documento:

- **Los 14 de minutos** — B-01, A-08, B-03 y MESA-02 son los rojos.
- **El aula sigue bloqueada por el LMS**: `actividades` y `avances_actividad` no las escribe
  nadie en producción, y sin ellas `cambiarEtapa` impide certificar. Estas pantallas ya saben
  leerlas; lo que falta es quién las escribe.
- **El retiro sigue bloqueado por el SENA**: las cuatro salidas del aula siguen fuera de
  `ETAPAS_DEL_REPORTE`.
