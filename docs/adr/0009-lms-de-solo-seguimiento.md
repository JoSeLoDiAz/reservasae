# 0009 · El LMS es de solo seguimiento

- **Estado:** aceptado (decidido por el dueño el 2026-08-31)
- **Fecha:** 2026-08-31
- **Relacionado:** 0008 (la llave), 0003 (nadie más toca cupos), 0004 (llamamos nosotros)

## Contexto

**Hoy no se puede certificar a nadie por la vía normal. Y certificar es lo que paga el
SENA.**

La regla existe y está bien construida: `MINIMO_PARA_CERTIFICAR = 0.8`
(`backend/src/crm/crm.service.ts:196`), con la compuerta del 80 % en `cambiarEtapa`
(`:2181-2186`).

Pero el muro que se topa de verdad está **antes**, en `:2174-2179`: si la acción de formación
no tiene actividades obligatorias, `obligatorias` da 0 y `cambiarEtapa` lanza
*«Esta acción de formación no tiene actividades obligatorias cargadas: no hay contra qué
medir si terminó»*. Conviene citar las dos, porque quien lea solo la del 80 % pensará que el
problema es el umbral.

Lo que faltan son **los datos**. No hay ni una ruta ni una pantalla que cree una `Actividad`
ni que marque un `AvanceActividad`. Comprobado: las únicas apariciones de
`avanceActividad.` en producción son `backend/src/crm/crm.service.ts:1750` (un `deleteMany`
al borrar el participante) y `:2161` (un `count`). Las dos de la siembra de prueba son
`backend/prisma/seed/prueba.ts:346` (un `deleteMany` de limpieza) y `:1283` — **el único
`create` de avance de todo el repositorio**.

Con la base real, `obligatorias` da 0 y `cambiarEtapa` lanza. **La compuerta es un muro.**

**Y una buena noticia: la idempotencia ya está resuelta en el esquema.**
`AvanceActividad` tiene `@@unique([participanteId, actividadId])`
(`backend/prisma/schema.prisma:577`), con el comentario de `:576`: *«una fila por persona y
actividad»*. El mismo avance recibido N veces actualiza la que existe. Sin eso, un avance
sumado dos veces daría 200 % de progreso, y eso acabaría en el informe del SENA.

Es el mismo patrón que ya hace que Meta pueda reintentar cincuenta veces sin duplicar nada
(`@@unique([origenSistema, externoId])`, `schema.prisma:791`).

**Y un aviso que sale de Fase 0:** `Matricula` (`backend/src/crm/matricula.ts:37`) y
`VigiaDeCupos` (`backend/src/crm/vigia-de-cupos.ts:36`) arrancan **siempre y sin
interruptor**, y por eso se duplican en la ventana de split-brain entre sedes.

## Decisión

1. **El LMS escribe avance académico y nada más.** No crea participantes, no cambia etapas,
   no toca cupos, ofertas ni grupos.

2. **El emparejamiento es por la llave del ADR 0008 más un identificador de curso
   acordado.** Con la llave de la persona no basta: hace falta saber **de qué curso** es el
   avance.

3. **Lo que no casa NO se crea.** Va a una lista de «no casan» que alguien revisa, con el
   documento, el curso y el motivo. Crear la ficha automáticamente convertiría al LMS en una
   puerta de alta de personas, que es justo lo que no debe ser.

4. **Llamamos nosotros.** El LMS no nos empuja. Así mandamos sobre el ritmo y no nos pueden
   inundar.

5. **El avance trae la fecha en que OCURRIÓ, no en la que nos lo cuentan**, y solo se acepta
   si es más reciente que lo guardado. El `@@unique` cubre el reenvío; **no** cubre dos
   envíos contradictorios, y para eso hace falta saber cuál es el bueno.

6. **Su reloj lleva interruptor propio (`LMS_WORKER`) y no arranca en una réplica.** Como
   `RuiWorker` (`backend/src/crm/rui/rui.worker.ts:18`), `WebWorker`
   (`backend/src/instituciones/web/web.worker.ts:18`) y `CampanasWorker`
   (`backend/src/correo/campanas/campanas.worker.ts:18`). No se repite el defecto de
   `Matricula` y `VigiaDeCupos`.

7. **Normalizamos el documento al recibir, aunque el LMS cumpla el contrato.** No por
   desconfianza: porque un contrato que solo se cumple si la otra parte se porta bien no es
   una garantía. Es la misma razón por la que nginx pone `CF-Connecting-IP` *«SIEMPRE, pise
   lo que pise el cliente»* (`docker/nginx/default.conf:47-49`).

## Alternativas evaluadas

**LMS de escritura completa: que cree fichas y mueva etapas.** Descartada por el dueño.
Convertiría al LMS en una segunda puerta de alta de personas y en un segundo escritor de
cupos, que es exactamente lo que el ADR 0003 acaba de cerrar. El aforo tiene que tener un
solo dueño.

**Que el LMS nos empuje por webhook.** Descartada. Nos pone a su ritmo, obliga a autenticar y
mantener una puerta pública más, y repite todos los problemas del ADR 0004 sin necesidad: el
avance académico no es urgente, un día de retraso no cambia nada.

**Cargar el avance por `.xlsx` con la plantilla que ya existe.** Descartada **como solución
permanente**. El cargue masivo de reservas es el hallazgo crítico nº 1 de Fase 0
(`docs/arquitectura/00-mapa-actual.md:541-547`): escribe en un `for` pelado, sin transacción
y sin candado. Sirve de puente si el LMS tarda, pero pasando por la misma política del ADR
0003, no por la plantilla actual.

**Que el LMS decida quién certifica.** Descartada. Certificar es lo que paga el SENA y la
compuerta del 80 % (`crm.service.ts:196`, aplicada en `:2181-2186`) es una decisión de
negocio nuestra, con su propia lógica de numerador y denominador. Delegarla en el proveedor
es delegar el contrato.

**Emparejar por correo en vez de por documento.** Descartada. El correo no es firme, y el
propio repositorio ya lo modela así: el cruce de leads calcula `firme: true` para el
documento —*«La única que es firme»*, `backend/src/leads/cruzar-con-el-crm.ts:57`, valor en
`:74`— y `firme: false` para correo (`:93`) y celular (`:110`). Emparejar avance académico
por un campo no firme es atribuirle a alguien las notas de otro.

## Consecuencias

**Lo bueno.** Desbloquea Gestión Académica entera, que hoy es un muro. Y el aforo y las
etapas siguen teniendo un solo dueño.

**Lo malo, y lo aceptamos.** La lista de «no casan» necesita pantalla y alguien que la mire,
o se convierte en otra mesa de entrada que nadie ve — que es exactamente el hallazgo A-01
con los leads. Y hasta que el LMS exista, certificar sigue siendo imposible por la vía
normal.

> **DECISIÓN ABIERTA.** El mapa de tipos de documento y el identificador de curso hay que
> acordarlos con el proveedor del LMS. **Eso no lo podemos decidir solos**, y sin ello los
> puntos 2 y 5 no se pueden implementar.

---
