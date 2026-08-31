# 02 · Arquitectura objetivo — índice

**Fase 2. Solo lectura: no se modificó ni una línea de código de producción.**

| | |
|---|---|
| Método | 3 pasadas. Diseño → refutación → corrección, con un crítico distinto en cada una |
| Coste | 34 agentes en total, 0 fallos |
| Convergencia | 1ª pasada: **82 vetos**. 2ª: 30. 3ª: **0 daños** |
| Resultado | 6 documentos + **12 ADRs**, con **32 decisiones abiertas y marcadas** |

## Lo que pasó, y por qué importa

La **primera pasada la rechazaron los tres críticos**. No por detalles: por 30 choques contra
código que hoy funciona. Dos de ellos **repetían un fallo ya retirado en Fase 1** — un diseño
que mataba la lista de espera.

En la segunda ronda les di una licencia explícita: *"si concluyes que algo no se puede hacer
sin romper nada, dilo y propón la alternativa. **Preferimos un diseño más humilde que
funcione**"*.

Eso cambió el resultado. El ejemplo está en el [ADR 0012](../adr/0012-el-enum-estadoreserva-se-queda-en-tres.md):
el hold con TTL —hallazgo crítico F-01— **se resuelve sin añadir ni un valor a ningún enum**,
con dos columnas anulables que caducan por la vía de `CANCELADA`, que ya existe.

En la tercera, el listón de aprobación se fijó por escrito en **una sola pregunta**:
*¿publicar esto causaría daño?* No *¿es perfecto?*. Porque un crítico que nunca aprueba
bloquea la entrega, y eso también es un fallo.

---

## Los documentos

| Documento | Qué contiene |
|---|---|
| [**02-flujo-end-to-end.md**](02-flujo-end-to-end.md) | Contexto, el flujo completo lead→certificado, y el diagrama del aforo. **Cada paso marcado según exista hoy o no** |
| [**02-modelo-objetivo.md**](02-modelo-objetivo.md) | ER objetivo, campos de auditoría, los 22 `@@unique` y cuáles pasan a parciales |
| [**02-maquinas-de-estado.md**](02-maquinas-de-estado.md) | Las cuatro máquinas con tabla de transiciones, guardias, efectos y quién puede |
| [**02-patrones-transversales.md**](02-patrones-transversales.md) | Auditoría por trigger, outbox, soft-delete, bloqueo. Con el SQL |
| [**02-permisos-y-api.md**](02-permisos-y-api.md) | Matriz rol × entidad × acción, contratos de API, sobre de error |
| [**Los 12 ADRs**](../adr/) | Una decisión por fichero, con las alternativas descartadas |

---

## Los ADRs

Se pidieron siete mínimos y salieron doce. Los cinco de más no son relleno: son decisiones que
**ya estaban tomadas y no estaban escritas en ninguna parte** — justo la deuda que INV-10 quiere
cerrar.

| ADR | Decisión |
|---|---|
| [0001](../adr/0001-borrado-logico.md) | Nada se borra: se archiva |
| [0002](../adr/0002-auditoria-por-trigger-y-por-aplicacion.md) | Auditoría por trigger **y** por aplicación, conviviendo |
| [0003](../adr/0003-estrategia-anti-sobrecupo.md) | Anti-sobrecupo **respetando el sobrecupo autorizado** |
| [0004](../adr/0004-idempotencia-de-webhook.md) | Idempotencia de webhook |
| [0005](../adr/0005-outbox-transaccional.md) | Outbox transaccional |
| [0006](../adr/0006-zona-horaria.md) | UTC en base, Bogotá en pantalla |
| [0007](../adr/0007-empresa-vs-institucion.md) | **Por qué NO se fusionan** — decisión que solo vivía en una conversación |
| [0008](../adr/0008-llave-de-identidad.md) | La llave es el par, no el número |
| [0009](../adr/0009-lms-de-solo-seguimiento.md) | El LMS solo lee |
| [0010](../adr/0010-los-titulos-del-sep-no-se-tocan.md) | Los títulos del SEP son el contrato |
| [0011](../adr/0011-migraciones-desatendidas.md) | Las migraciones corren solas: lo que eso obliga |
| [0012](../adr/0012-el-enum-estadoreserva-se-queda-en-tres.md) | `EstadoReserva` se queda en tres valores |

---

## ⚠️ Una contradicción entre documentos, sin resolver

Los seis documentos se escribieron en paralelo, y **dos se contradicen**. Está marcada como
bloqueante por su propio autor, y se deja a la vista en vez de esconderla:

> **¿Qué gobierna la vitalidad de `propuestas_de_datos`?**
> [`02-patrones-transversales.md`](02-patrones-transversales.md) §3.3 dice que `archivadoEn`.
> [`02-maquinas-de-estado.md`](02-maquinas-de-estado.md) dice que un valor `REEMPLAZADA` en
> `EstadoPropuesta`.
>
> **No pueden ser las dos.** Hay que elegir antes de escribir la migración, y la elección tiene
> consecuencias distintas en cada documento.

---

## Las 32 decisiones abiertas

Cada una está marcada **en el documento donde importa**, no solo aquí. Las que bloquean de
verdad:

**Bloqueantes**

1. **Dónde vive el TTL del hold** — `Convenio.diasDeReserva` o por oferta. La columna no existe
   (grep → cero). **Sin ella la migración del hold no se puede cerrar** y R7 no se puede
   encender.
2. **La contradicción de `propuestas_de_datos`** — la de arriba.
3. **¿"Administrador" significa `SUPERADMIN` o `LIDER_SISTEMAS`?** Cambia toda la sección de
   cronograma. Tú dijiste *"nadie modifica fechas de cronograma si no es administrador"*, y en
   este sistema esa palabra tiene dos significados distintos.

**Que necesitan al SENA** — ya recogidas en [`decisiones-para-jose.md`](decisiones-para-jose.md)

4. Qué palabra corresponde a cada salida en la columna `ESTADO`.
5. Si los retirados viajan al SENA — mover `ETAPAS_DEL_REPORTE` **cambia también el F7 de
   empresas** y su conteo de beneficiarios.

**Que cambian el alcance**

6. `creadoPorId`: ¿FK de verdad en 21 modelos, o `String` suelto?
7. Sustituir los seis booleanos de papelera **no es una migración interna**: son 71 líneas en
   `backend/` y 70 en `frontend/`. Es un cambio de contrato de API.
8. La `Idempotency-Key` trae **la única migración del documento de API**.
9. El sobre de error solo sirve si entra **a la vez** el cambio de `frontend/src/lib/pedir.ts`.

Las 23 restantes están en sus documentos, cada una con su coste.

---

## Tres cosas que estos documentos descubrieron y no se buscaban

**1. El `CHECK` del hold rompería el revivir de una reserva, en la ruta pública.** Una empresa a
la que se le venció el hold y vuelve a reservar: el `CHECK` falla y sale **500 crudo**, porque
`POST /reservas` no tiene guard ni `ExceptionFilter`. **No es un caso raro: es EL caso.** El
documento trae la línea exacta que hay que añadir para que no pase.

**2. Sin editar el `schema.prisma` a la vez que el SQL, el siguiente `migrate dev` tira las
columnas nuevas.** Prisma ve *drift* y genera la migración que las elimina. Es un fallo distinto
del enum que ya reventó en producción, y acaba igual de mal.

**3. La lista de etapas del aula estaría escrita por quinta vez.** `backend/src/crm/etapas.ts`
existe precisamente porque estaba cuatro veces y se corrigió en tres. Un diseño la iba a
duplicar otra vez, y su propio autor lo marcó.

---

## Lo que sigue

**Fase 3 — plan de migración.** Backlog P0→P3, cada migración `expand→migrate→contract` con
rollback y verificación de conteos.

**Ahí empieza a tocarse producción.** Yo escribo las migraciones; **ejecutarlas sigue
necesitando una persona delante**, siempre.
