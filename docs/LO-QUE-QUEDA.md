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
