# 0005 · Outbox transaccional: la intención dentro, el cuerpo fuera

- **Estado:** propuesto
- **Fecha:** 2026-08-31
- **Relacionado:** 0011 (nada de enums nuevos), 0001 (lo fallido no se borra)

## Contexto

`NO ENCONTRADO`: outbox. `grep -rniE "outbox|evento_pendiente"` sobre `backend/src` y
`frontend/src` → **cero**. (Sobre el repositorio entero el mismo comando devuelve seis
aciertos, y **todos** están en `docs/` — entre ellos
`docs/arquitectura/00-mapa-actual.md:201`, que es de donde sale esta frase. En código no hay
nada.)

**Pero ya hay dos colas en la casa, y una decisión de diseño ya tomada por escrito.**

`destinatarios_campana` **ya es una cola**: `estado`
(`backend/prisma/schema.prisma:1811`), `intentos` (`:1815`), `enviadoEn` (`:1816`) y
`@@unique([campanaId, correo])` (`:1840`), con un motivo cuidado en `:1834-1839` —la clave
es el **buzón**, no la ficha, porque una persona con dos fichas recibía el correo dos veces.
`avisos_de_cupos` (`backend/prisma/schema.prisma:1666`) es la otra.

El patrón de toma **ya está escrito dos veces**:
`backend/src/crm/rui/rui.service.ts:322` y
`backend/src/instituciones/web/web.service.ts:157`, los dos con `FOR UPDATE SKIP LOCKED`.
Lo que falla es el consumidor de campañas, que toma sin `SKIP LOCKED`
(`backend/src/correo/campanas/campanas.service.ts:388`) y marca **después** de enviar
(`:494`).

**Y la decisión de fondo ya está escrita**, en `docs/crm-plan.md:207`:

> *Idempotencia = `MovimientoReserva.id`, con `INSERT ... ON CONFLICT DO NOTHING` por
> `$executeRaw`. Dentro de la transacción solo se inserta **la intención**; el cuerpo se
> renderiza en el worker. Si no, una colisión de clave hace rollback de la reserva entera, y
> revivir una reserva cancelada repite la clave.*

Eso no es una idea nueva. Es un ADR sin escribir.

Y hay un caso concreto esperando: la promoción desde lista de espera va **«en absoluto
silencio»** (`docs/crm-plan.md:209`); la empresa promovida solo se entera si entra a
consultar por su cuenta.

## Decisión

1. **Se añade UNA bandeja de salida, para lo que hoy no tiene cola.** **No sustituye a
   `destinatarios_campana` ni a `avisos_de_cupos`.** Esas ya son colas con estado, intentos
   y clave única propia; duplicarlas crea un segundo sitio donde mirar y deja el primero
   pudriéndose.

2. **Dentro de la transacción de negocio se inserta solo la INTENCIÓN, nunca el cuerpo
   renderizado.** Es la decisión de `docs/crm-plan.md:207`. El cuerpo se arma en el worker,
   con los datos del momento del envío.

3. **La inserción es `INSERT ... ON CONFLICT DO NOTHING`, no un `create` contra un índice
   único.** Un P2002 dentro de la transacción de negocio **aborta la transacción entera** y
   se lleva por delante el movimiento de cupos. El reintento no deduplicaría: fallaría.

4. **`estado` y `tipo` son TEXT con CHECK, no enums de Postgres.** Ver ADR 0011. El
   argumento que ya se aplicó a `tipo` vale igual para `estado`.

5. **El consumidor toma con `FOR UPDATE SKIP LOCKED`**, con el patrón que ya está escrito en
   `rui.service.ts:322` y `web.service.ts:157`. Y **marca antes de enviar**, no después.

6. **Lo que falla repetidamente no se borra ni se mueve**: pasa a un estado terminal en la
   misma tabla. Nada de una segunda tabla de DLQ — mover una fila de tabla es borrarla de la
   primera (ADR 0001), y son dos sitios donde mirar.

7. **El worker lleva interruptor propio por variable de entorno**, como `RuiWorker`
   (`backend/src/crm/rui/rui.worker.ts:18`), `WebWorker`
   (`backend/src/instituciones/web/web.worker.ts:18`) y `CampanasWorker`
   (`backend/src/correo/campanas/campanas.worker.ts:18`). **No** como `Matricula`
   (`backend/src/crm/matricula.ts:37`) y `VigiaDeCupos`
   (`backend/src/crm/vigia-de-cupos.ts:36`), que arrancan siempre y por eso se duplican en la
   ventana de split-brain entre sedes (crítico 10 de Fase 0,
   `docs/arquitectura/00-mapa-actual.md:580-593`).

8. **Primer uso: el aviso de promoción desde lista de espera.** Es un fallo de producto que
   ya existe, no una funcionalidad futura. Y el aviso dice cantidades reales, porque la
   promoción es **parcial y repetible**
   (`backend/src/reservas/reservas.service.ts:403-416`).

## Alternativas evaluadas

**No poner outbox y mandar dentro de la transacción.** Descartada. Es un `await` a un
sistema externo dentro de `$transaction`, justo lo que INV-9 prohíbe y lo que el dominio de
reservas **hoy cumple** (Fase 1: *«ningún `await` a un sistema externo dentro de
`$transaction`; todo lo caro se resuelve antes de abrirla»*,
`docs/arquitectura/01-auditoria.md:65`). Sería un retroceso.

**Mandar después del commit, sin tabla.** Descartada. Si el proceso se cae entre el commit y
el envío, el aviso se pierde y nadie se entera. Es exactamente lo que pasa hoy con la
promoción de lista de espera.

**Una bandeja que reemplace `destinatarios_campana`.** Descartada. Esa tabla tiene estado,
intentos, `enviadoEn`, aperturas y clics, y su `@@unique` es por buzón con un motivo escrito
(`schema.prisma:1834-1840`). El arreglo de campañas es ponerle `SKIP LOCKED` —que ya está
escrito dos veces en la casa— y marcar antes de enviar. No una tabla nueva.

**Redis, BullMQ o Agenda.** Descartada. No hay Redis en el despliegue, y añade una pieza que
se cae aparte de la base. Sobre todo: **el outbox pierde su razón de ser si la intención no
se escribe en la MISMA transacción que el negocio**, y en Redis no se puede.

**Un enum de Postgres para el estado de la bandeja.** Descartada. Ver ADR 0011.

**Una segunda tabla para lo que fracasa (DLQ).** Descartada. Ver punto 6.

## Consecuencias

**Lo bueno.** Lo que se promete dentro de una transacción acaba mandándose. INV-9 se
mantiene. Y se reutiliza un patrón que ya está probado dos veces en el repositorio, en vez
de inventar uno.

**Lo malo, y lo aceptamos.** Una tabla más que crece y necesita retención. **Hay tres colas
conviviendo** —bandeja, `destinatarios_campana`, `avisos_de_cupos`— y hay que saber cuál
mira cada cosa; es el precio de no romper las dos que ya funcionan. El worker necesita quien
lo despierte y no hay planificador. Y mientras el interruptor esté apagado, la bandeja se
llena sin que nadie la vacíe, en silencio.

---
