# 0004 · Idempotencia de webhook: 200 siempre, dedupe en la base

- **Estado:** propuesto
- **Fecha:** 2026-08-31
- **Relacionado:** 0011 (migraciones: aquí no entra ningún valor de enum nuevo), 0008 (la
  llave de identidad), 0001 (lo que llega no se borra)

## Contexto

Un módulo (`backend/src/leads/`), tres puertas entrantes —`POST /webhooks/leads`
(`leads.controller.ts:66`), `GET /webhooks/leads/meta` (`:105`) y `POST /webhooks/leads/meta`
(`:149`)—, cero webhooks salientes.

**La regla más dura del dominio está escrita en el propio código**
(`backend/src/leads/leads.controller.ts:176-181`):

> *Se contesta 200 pase lo que pase con el contenido. Meta reintenta cuando no recibe 200, y
> si insiste sin éxito **APAGA el webhook**. Un aviso que no entendemos no puede costar que
> dejen de llegar los que sí.*

Y otra vez para la puerta del orquestador (`:62-64`): *«200 y no 201: se contesta lo mismo
cuando el lead es nuevo y cuando ya estaba, y `repetido` lo dice.»*

**La idempotencia existe pero es check-then-insert.**
`backend/src/leads/leads.service.ts:116-121` hace un `findUnique` sobre
`origenSistema_externoId` y `:126` hace el `create`. Entre las dos hay una ventana: dos
reintentos simultáneos pasan los dos por el `findUnique` sin encontrar nada y los dos
intentan crear. El `@@unique([origenSistema, externoId])`
(`backend/prisma/schema.prisma:791`) salva la corrección —no hay fila doble— pero el
perdedor recibe un P2002 que sale como **500 crudo**, porque no hay `ExceptionFilter`
(`grep -rn "ExceptionFilter\|useGlobalFilters" backend/src/` → cero).

**A-03, crítico.** `LeadEntrante.participanteId` es `String? @unique`
(`backend/prisma/schema.prisma:783`): **solo un lead puede apuntar a un participante**. La
segunda vez que una persona ya fichada llega por el webhook, el `update` de
`leads.service.ts:339-349` viola el índice, sale un 500 y el lead queda atrapado en
`PENDIENTE` para siempre. Y **se autooculta**: el reintento del emisor entra por la guarda de
idempotencia y devuelve **200 con `repetido: true`** (`leads.service.ts:123`). El emisor cree
que quedó bien. Nadie se entera.

Que la misma persona llene el formulario dos veces es lo normal, no el caso raro.

**Y el crudo se guarda después de validar.** Lo que no cuadra la firma no deja rastro, y lo
que no se puede guardar solo va al log (`leads.service.ts:272-276`). INV-6 no se cumple.

## Decisión

1. **La respuesta se queda en 200. En las tres puertas. No se pasa a 202 en ninguna.** Lo
   dice el código y el motivo es que Meta apaga el webhook. Un 202 «aceptado y encolado» es
   correcto en abstracto y aquí cuesta la entrada de leads.

2. **La deduplicación deja de ser check-then-insert.** Se hace en un solo golpe:
   `INSERT ... ON CONFLICT ("origenSistema","externoId") DO NOTHING`, y `repetido` se decide
   por si insertó o no. El contrato de respuesta no cambia.

3. **Se retira el `@unique` de `LeadEntrante.participanteId`.** Un participante puede tener
   N leads. La migración **no es solo quitar el `@unique`**: hay que editar el otro lado,
   porque `backend/prisma/schema.prisma:952` declara `lead LeadEntrante?` en `Participante`
   y sin el `@unique` del lado de la FK Prisma se niega a validar el 1-1; la relación
   inversa pasa a ser lista. Quitar un índice único **no puede fallar contra datos
   existentes**, así que esta migración sí entra en el camino automático de `migrate deploy`
   (ADR 0011).

4. **Con el `@unique` fuera no hace falta ni columna nueva ni valor de enum nuevo: el código
   que hay ya hace lo correcto.** El lead repetido apunta al mismo `participanteId` y queda en
   `CONVERTIDO` con el motivo de por dónde se encontró — que es literalmente lo que
   `backend/src/leads/leads.service.ts:342-347` escribe hoy (`estado: 'CONVERTIDO'`,
   `motivo: porDondeSeEncontro(coincide)`, con `motivo String?` en
   `backend/prisma/schema.prisma:780`). Lo único que hoy lo impide es el índice.

   **Nada de inventar un estado `DUPLICADO`.** `EstadoLeadEntrante` tiene exactamente tres
   valores —`PENDIENTE`, `CONVERTIDO`, `DESCARTADO`— (`backend/prisma/schema.prisma:738-745`);
   añadir uno es un `ALTER TYPE ... ADD VALUE`, que es justo el fallo que ya reventó en
   producción y cuya lección está escrita en
   `backend/prisma/migrations/20260830185000_origen_lead_importacion/migration.sql:3-7`. Ver
   ADR 0011, punto 1.

5. **El crudo se guarda ANTES de validar**, en su propia transacción. Lo que no cuadre la
   firma también deja fila. Sin eso INV-6 no se cumple y el fallo es invisible: hoy un aviso
   mal firmado no existe para nadie.

6. **La clave de idempotencia es la que manda el emisor (`externoId`), no una llave natural
   de la persona.** Una clave como `(tipoDocumentoSepId, numeroDocumento, convenioId)` con
   TTL prohibiría la **segunda ficha legítima** de la misma persona en otra acción de
   formación del mismo convenio, que `backend/prisma/schema.prisma:955` y
   `backend/src/crm/crm.service.ts:1022-1035` permiten a propósito.

## Alternativas evaluadas

**202 y cola.** Descartada. Es la respuesta de manual y aquí apaga la entrada de leads. La
decisión está escrita en `leads.controller.ts:176-181`.

**Dejar check-then-insert y confiar en el `@@unique`.** Descartada a medias: el índice salva
la corrección, pero el perdedor de la carrera recibe un 500 y el emisor no puede distinguir
«ya estaba» de «se cayó». Con `ON CONFLICT DO NOTHING` los dos casos son el mismo y ninguno
es un error.

**Cabecera `Idempotency-Key`.** Descartada para estas rutas: **Meta no la manda**. Tiene
sentido en las rutas del panel, y eso es otra decisión.

**Deduplicar por hash del cuerpo.** Descartada. Meta reenvía el mismo aviso con envoltorio
distinto y el hash cambiaría; y para el orquestador sobra, porque ya manda `externoId`.

**Mantener el `@unique` y colgar el lead repetido de otro campo.** Descartada. Es un FK
nullable más en el mismo modelo y obliga a nombrar las dos `@relation`, cuando el par
`(participanteId, CONVERTIDO, motivo)` que ya escribe `leads.service.ts:342-347` resuelve el
caso sin columna nueva en cuanto se quita el índice.

**Añadir un valor `DUPLICADO` al enum.** Descartada. Es una migración de enum en un camino
desatendido (ADR 0011) para expresar algo que el modelo ya expresa. El atenuante existe —no
hay ningún tipo ni `Record` de estado de lead en `frontend/src`, coherente con A-01, así que
la regla de los `Record` exhaustivos no se dispararía— pero un atenuante no es un motivo.

## Consecuencias

**Lo bueno.** El segundo lead de la misma persona deja de dar 500 y de quedarse atrapado.
El reintento concurrente deja de ser una carrera. Y por primera vez queda rastro de lo que
no cuadró la firma. Todo ello **sin tocar un solo enum**.

**Lo malo, y lo aceptamos.** La tabla de crudos crece con **todo** lo que llega, basura
incluida, y la escribe una ruta que **no lleva guard** —`POST /webhooks/leads/meta`
(`leads.controller.ts:149`) solo comprueba la firma dentro del handler (`:166-174`), a
diferencia de su hermana, que sí lleva `LlaveDeLeadsGuard` (`:67`)—, así que la retención no
es opcional: hay que ponerla desde el primer día. Quitar el `@unique` es una migración que
toca el schema por los dos lados. Y el «200 pase lo que pase» sigue significando que un
fallo interno se ve como éxito desde fuera: eso se compensa con la fila de crudo y con
mirarla, **no con el código HTTP** — y hoy no hay pantalla para mirarla (A-01).

---
