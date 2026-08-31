# 0012 · El enum `EstadoReserva` se queda en tres valores

- **Estado:** propuesto
- **Fecha:** 2026-08-31
- **Relacionado:** 0001 (no se borra), 0011 (migraciones), 0005 (avisar al vencer)

## Contexto

**F-01 es crítico y real.** No existe hold con TTL. El enum solo tiene
`CONFIRMADA / LISTA_ESPERA / CANCELADA` (`backend/prisma/schema.prisma:257-261`), no hay
columna de vencimiento y no hay job que libere. Una empresa reserva 20 cupos «por si acaso»
y no vuelve: **esos 20 cupos no se liberan nunca.** Los cupos se secan con reservas fantasma.

La solución obvia es añadir un estado —`CADUCADA`, `EXPIRADA`, `SOLICITADA`—. **Se ha
propuesto dos veces y se ha retirado dos veces.** Esto es por qué.

**1. El estado nuevo se deshace solo, dentro de la misma transacción.**
`promoverListaDeEspera` filtra `estado: { not: EstadoReserva.CANCELADA }`
(`backend/src/reservas/reservas.service.ts:397`) — **no filtra «los estados vivos»**. Una
reserva recién caducada con `cuposEnEspera > 0` sigue casando ahí, y `:409-416` la devuelve a
`CONFIRMADA`. Y se llama en la misma transacción que la caducaría, porque liberar cupo es
justo lo que dispara la promoción.

**2. No es un sitio: son veintidós predicados** que preguntan «¿no es `CANCELADA`?» en vez de
«¿está viva?». Los conté. Dieciocho lo preguntan dentro del `where`:

`backend/src/crm/control.ts:371`, `:412`, `:638`, `:646` · `backend/src/crm/panel-de-cupos.ts:68`
· `backend/src/crm/planeacion-de-pauta.ts:121` · `backend/src/reservas/reservas.service.ts:397`
· `backend/src/tableros/tableros.service.ts:69`, `:143`, `:307`, `:361`, `:392`, `:441`,
`:593`, `:669`, `:725`, `:874`, `:899`.

Y otros cuatro comparan en TypeScript, fuera del `where`, que es igual de fácil de olvidar:
`backend/src/reservas/reservas.service.ts:81` (doble clic), `:166` (guardia de edición),
`:230` (idempotencia de cancelar) y `:326` (total de cupos de la empresa).

`panel-de-cupos.ts:68` infla la ocupación del panel; `control.ts` son las cifras de
cumplimiento al SENA.

**3. Rompe el frontend.** `EstadoReserva` está declarado **a mano** en
`frontend/src/lib/api.ts:10` y `frontend/src/lib/tableros-api.ts:6`.
`frontend/src/app/admin/reservas/page.tsx:23` es `Record<EstadoReserva, ...>`: añadir el
valor sin la clave **no compila**. Y `frontend/src/app/admin/acciones/[id]/page.tsx:31` es
`Record<string, ...>`: compila y revienta en runtime, que es peor.

**4. Y el CHECK no lo atraparía.** `reservas_cancelada_sin_cupos`
(`backend/prisma/migrations/20260729000000_modelo_inicial/migration.sql:410-412`) dice
`estado <> 'CANCELADA' OR (cuposConfirmados = 0 AND cuposEnEspera = 0)`, y su comentario
(`:407-409`) explica que existe porque *«una reserva cancelada no retiene cupos: si los
retuviera, seguirian contando en cuposOcupados y el cupo quedaria muerto»*. Un estado
terminal nuevo que retenga cupos deja **exactamente ese cupo muerto**, y el CHECK no lo ve
porque solo nombra `CANCELADA`.

## Decisión

1. **El enum `EstadoReserva` se queda con `CONFIRMADA`, `LISTA_ESPERA` y `CANCELADA`.**

2. **El vencimiento se modela con COLUMNAS, no con un estado**: `venceEn DateTime?` y quien
   la venció. Al vencer, la reserva se **CANCELA** —el estado que ya existe, con su CHECK y
   con los veintidós predicados ya correctos— y el motivo dice que fue por vencimiento.

3. **Cancelar por vencimiento pasa por el mismo camino que cancelar a mano**: baja los dos
   contadores a cero (lo exige `reservas_cancelada_sin_cupos`), mueve el contador de la
   oferta y promueve la lista de espera. Que la lista de espera se promueva **es lo que se
   quiere**: para eso se libera el cupo.

4. **Como paso previo y SEPARADO, los veintidós predicados pasan a un helper
   `estaViva(estado)`.** Ese refactor **no cambia comportamiento hoy**: con tres valores, «no
   es CANCELADA» y «está viva» son el mismo conjunto. Por eso se puede hacer solo y
   comprobar solo.

5. **Hasta que ese helper exista, la lista de valores está cerrada.** Y cuando alguien quiera
   añadir un valor a este o a cualquier otro enum de estado, hace antes las dos listas: los
   predicados que preguntan «¿no es X?» y los `Record` del frontend. Ver ADR 0011, punto 5.

## Alternativas evaluadas

**Añadir `CADUCADA` o `EXPIRADA`.** Descartada dos veces, por los cuatro motivos del
contexto. El más grave es que **se deshace sola** en la misma transacción: no es un fallo que
se vea en pruebas unitarias con dobles.

**Añadir el estado y arreglar los veintidós predicados a la vez.** Descartada **por orden,
no por mérito**: es el arreglo bueno a largo plazo. Pero mete el refactor y el cambio de
comportamiento en el mismo despliegue, y **los seis `FOR UPDATE` del código no se ejercitan
en las pruebas**: `backend/src/crm/cambiar-etapa.spec.ts:109` y
`backend/src/cronograma/cupos-editables.spec.ts:57` sustituyen `$queryRaw` por `[]`. Primero
el helper, después el valor **si hace falta** — y con este ADR probablemente no haga falta.

**Añadir `SOLICITADA` como estado previo a `CONFIRMADA`.** Descartada, y es peor que las
otras. Parte en dos el camino público más caliente, y `@@unique([empresaId, ofertaId])`
(`backend/prisma/schema.prisma:303`, *«contra el doble clic: una reserva por oferta»*) sigue
permitiendo **una sola fila por par**: una solicitud vencida bloquearía la reserva buena.

**Un booleano `caducada`.** Descartada. Es un estado disfrazado: los mismos veintidós
predicados seguirían sin mirarlo y la fila seguiría contando como viva en el panel y en las
cifras al SENA.

**Borrar la reserva vencida.** Descartada. ADR 0001.

**No hacer nada.** Descartada. F-01 es crítico con probabilidad ALTA y el efecto es
acumulativo: cada reserva fantasma resta cupo para siempre.

## Consecuencias

**Lo bueno.** Se arregla F-01 **sin tocar el enum**, sin migración de enum (ADR 0011), sin
romper la compilación del frontend y sin que la lista de espera lo deshaga. Y la promoción se
dispara sola al vencer, que es justo lo que hace falta.

**Lo malo, y lo aceptamos.** Una reserva vencida y una cancelada a mano **se ven igual en las
pantallas** si nadie mira el motivo: es una pérdida real de información en el listado. Hace
falta quien dispare el vencimiento, y no hay planificador —los dos `setInterval` que existen
(`backend/src/crm/matricula.ts:37` y `backend/src/crm/vigia-de-cupos.ts:36`) arrancan siempre
y se duplican entre sedes—. Y el refactor a `estaViva()` es trabajo sin resultado visible,
del que nadie se acuerda hasta que hace falta y ya es tarde.
