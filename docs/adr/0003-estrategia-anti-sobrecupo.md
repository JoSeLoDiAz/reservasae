# 0003 · Estrategia anti-sobrecupo: una sola política, con escape firmado

- **Estado:** propuesto
- **Fecha:** 2026-08-31
- **Relacionado:** 0012 (reservas), 0009 (LMS no toca cupos)

## Contexto

Hay **dos sistemas de aforo sobre las mismas sillas** y no se hablan (Fase 0 §6). Reservas
cuenta con un contador materializado `Oferta.cuposOcupados`; inscripción cuenta en vivo los
participantes en `OCUPAN_SILLA` (`backend/src/crm/etapas.ts:30-34`).

**El sobrecupo autorizado es deliberado y está modelado.** `sobrecupoPorId` y
`sobrecupoMotivo` (`backend/prisma/schema.prisma:926-928`) con su CHECK de coherencia en
`backend/prisma/migrations/20260814140000_crm_personas_y_participantes/migration.sql:222-225`,
con el motivo escrito encima: *«un sobrecupo sin motivo no es una autorizacion»*.

**Y hoy hay DOS políticas de cupo que no coinciden:**

| | Ruta | Qué hace |
|---|---|---|
| **Con escape** | `crm.service.ts:979-987` (crear) | si `ocupadas >= cuposMaximos`, pide `dto.sobrecupoMotivo`, deja entrar y sella el par |
| **Con escape** | `crm.service.ts:3467-3475` (asignar) | idéntico, con otro texto |
| **Sin escape** | `crm.service.ts:1958-1962` (G4, grupo lleno) | lanza. No mira `sobrecupoMotivo` |
| **Sin escape** | `crm.service.ts:2270-2275` (G10, cobertura llena) | lanza. No mira `sobrecupoMotivo` |

Cualquier diseño que las funda en una sola sin nombrar el escape **hace ganar al bloqueo
duro y mata el sobrecupo**. Ya pasó dos veces: Fase 1 retiró un CHECK
`sillasOcupadas <= cuposMaximos` por esto, y el veto de la primera pasada de Fase 2 retiró
otro diseño por lo mismo.

**El hueco estructural** (G-03): los cinco CHECK de cupos
(`backend/prisma/migrations/20260729000000_modelo_inicial/migration.sql:388-412`) acotan
`0..cuposMaximos` pero **nunca atan el contador a `SUM(cuposConfirmados)`**.

**Y el sobrecupo que de verdad duele es el que nadie firma**, porque nadie sabe que ocurrió.
La puerta real es `asignar()`: aplica el tope de la **oferta** con escape (`:3467-3475`),
pero **no mide el cupo del grupo** — `exigirCoberturaDeLaOferta`
(`backend/src/crm/cobertura.ts:132-164`, llamada desde `crm.service.ts:3479-3483`) comprueba
que la cobertura sea de esa oferta y no selecciona `cuposMaximos` ni una vez. Las otras dos
puertas que se suelen citar aquí hay que decirlas con precisión, y están en el punto 3 de la
decisión: la preinscripción pública **no ocupa silla**, y el cargue masivo del crítico nº 1
de Fase 0 **no crea gente**.

## Decisión

**El aforo no se defiende con un CHECK duro sobre sillas ocupadas. Se defiende con una sola
política de admisión que tiene escape firmado.**

1. **Una función, tres respuestas.** `caben(...)` devuelve `ADMITE`, `EXIGE_FIRMA` o
   `PROHIBIDO`. Hay **dos** respuestas negativas y son distintas: la mayoría de los "no" de
   aforo son en realidad "no sin firma". Hoy G4 y G10 devuelven `PROHIBIDO` donde deberían
   devolver `EXIGE_FIRMA`.

2. **El escape es siempre el par completo**, `sobrecupoPorId` **y** `sobrecupoMotivo`. Nunca
   uno solo: el CHECK lo impide, y ese CHECK es la definición de qué cuenta como
   autorización.

3. **Se cierra el sobrecupo accidental, y se cierra donde de verdad está.** Las cuatro rutas
   de la tabla pasan por `caben(...)`. De las tres puertas que se suelen listar, dos no son lo
   que parecían, y conviene dejarlo escrito para que nadie las «arregle» por el sitio
   equivocado:

   - **`asignar()` sí entra**, por partida doble: el tope de la oferta (`:3467-3475`) y el del
     grupo, que hoy **no se mira** (`backend/src/crm/cobertura.ts:132-164`). Es la puerta que
     de verdad produce sobrecupo sin firma.
   - **La preinscripción pública no ocupa silla.** Crea la ficha en `etapa: 'INTERESADO'`
     (`backend/src/preinscripcion/preinscripcion.service.ts:335`), e `INTERESADO` **no está**
     en `OCUPAN_SILLA` (`backend/src/crm/etapas.ts:30-34`). No consume aforo, así que no pasa
     por `caben(...)` como compuerta de admisión: el aforo se decide después, cuando alguien
     la mueve a `INSCRITO`, y esa ruta sí pasa. Lo que la preinscripción llena es el embudo
     por encima del cupo, no el cupo.
   - **El cargue masivo del crítico nº 1 no crea gente.** Ese crítico
     (`docs/arquitectura/00-mapa-actual.md:541-547`) es el cargue de **reservas**:
     `backend/src/plantillas/plantillas.service.ts:400-405` escribe `cuposSolicitados` con
     `reserva.update()` en un `for` pelado, *«sin candado, sin mover el contador, sin
     `MovimientoReserva` y sin promover la lista de espera»*. Lo que le falta no es una
     política sobre si cabe una persona: es el camino de reservas entero. Queda **fuera** de
     este ADR, y se nombra aquí para que no se dé por cubierto. El cargue masivo de
     **participantes**, en cambio, ya llama a `crear` (`backend/src/crm/crm.service.ts:2799`),
     o sea que ya pasa por la política.

4. **`EXIGE_FIRMA` en una ruta sin sesión se comporta como `PROHIBIDO`.** No es una
   excepción caprichosa: es aritmética. `POST /preinscripcion/:slug` no lleva guard —lo dice
   el propio controlador, *«Público: no lleva guard. Nadie ha entrado todavía»*
   (`backend/src/preinscripcion/preinscripcion.controller.ts:12`, ruta en `:22-28`)—, así que
   no hay admin que pueda ser `sobrecupoPorId`. Un motivo sin firmante viola
   `participantes_sobrecupo_justificado` y, sin `ExceptionFilter` (comprobado: cero en
   `backend/src`), sale como **500 crudo**. Donde no hay quien firme, la única respuesta
   honesta es «no».

5. **El invariante que sí se puede vigilar es el del contador contra la suma de los
   CONFIRMADOS**, no el de las sillas contra el tope:
   `Oferta.cuposOcupados = SUM(cuposConfirmados)` de las reservas no canceladas.

   **`cuposEnEspera` no entra, y no puede entrar.** `moverContador` solo recibe confirmados
   (`backend/src/reservas/reservas.service.ts:100`, `:186`, `:237` y `:437`), y el CHECK
   `ofertas_cupos_dentro_del_tope`
   (`backend/prisma/migrations/20260729000000_modelo_inicial/migration.sql:388-390`) exige
   `cuposOcupados <= cuposMaximos`: la lista de espera existe precisamente porque lo que
   espera queda **fuera** del contador. Sumarle `cuposEnEspera` haría que el vigilante
   denunciara como descuadre **toda** oferta con lista de espera, y quien «cuadrara» el
   contador para acallarlo reventaría el `UPDATE` condicional de `:369-380` y con él la lista
   de espera entera. G-03 ya lo dejó bien escrito: *«jamás atan el contador a
   `SUM(cuposConfirmados)`»*.

   Un CHECK no puede expresarlo, porque cruza dos tablas. Se vigila con un job de
   reconciliación que **solo reporta y no corrige**: un descuadre puede ser el síntoma de
   otra cosa, y corregirlo solo borraría la evidencia.

6. **`sobrecupoPorId` es `onDelete: SetNull`** (`backend/prisma/schema.prisma:941`). En
   teoría, borrar al admin que firmó dejaría `(NULL, 'motivo')`, que **viola el CHECK** y
   haría fallar la operación. En la práctica no se dispara, y el motivo es más simple de lo
   que parecía: **no hay endpoint que borre un administrador**. En
   `backend/src/admin/admin.controller.ts` los dos únicos `@Delete` son `sesion` (`:108`) y
   `logos/:id` (`:341`). Queda escrito aquí para que quien vuelva a mirarlo sepa que se miró
   y por qué no se cambió — y para que quien algún día añada ese endpoint sepa lo que rompe.

## Alternativas evaluadas

**CHECK duro `sillasOcupadas <= cuposMaximos`.** Descartada, y es la que hay que seguir
descartando. Mata una funcionalidad deliberada, modelada y con su propio CHECK de
coherencia. Ya se retiró en Fase 1 (G-05) y otra vez en la primera pasada de Fase 2.

**Fundir las dos políticas en la estricta.** Descartada. Es a lo que tiende cualquier regla
del tipo «un solo `aplicar()` por máquina», y el resultado es que gana el bloqueo duro y el
sobrecupo desaparece **sin que el documento lo diga en ninguna parte**. Así murió el diseño
anterior.

**Fundir las dos en la laxa (todo pasa con motivo).** Descartada. G4 y G10 protegen el cupo
del **grupo** y de la **cobertura**, que es el nivel al que el SENA paga. Dejar entrar a
cualquiera con un texto libre convierte la firma en un trámite y el aforo del aula en una
sugerencia.

**Un solo aforo: borrar el contador materializado y contar en vivo siempre.** Descartada.
El contador es lo que hace posible el `UPDATE ... AND "cuposOcupados" + N <= "cuposMaximos"`
(`backend/src/reservas/reservas.service.ts:369-380`), que decide **dentro de la propia
sentencia** y es la única garantía real que hay hoy, probada con avalancha en
`backend/prisma/prueba-carga.ts:100-104`. Sustituirlo por un `COUNT` dentro de la
transacción serializa el camino público más caliente.

**Un trigger que recalcule el contador.** Descartada por lo mismo, y además pondría el
primer trigger de negocio del repositorio justo en la ruta más caliente.

## Consecuencias

**Lo bueno.** El sobrecupo sigue siendo posible y sigue quedando firmado. El accidental deja
de ser posible por la puerta que de verdad lo produce. Y hay **una** política, en un sitio,
que se puede probar.

**Lo malo, y lo aceptamos.** El job de reconciliación necesita quien lo dispare y no hay
planificador. Y el escape es texto libre: un motivo vacío de sentido cumple el CHECK igual
que uno bueno.

> **DECISIÓN ABIERTA.** G4 (`crm.service.ts:1958-1962`) y G10 (`:2270-2275`) se vuelven
> **más permisivas** de lo que son hoy: pasan de prohibir a exigir firma. Eso cambia lo que
> un líder puede hacer hoy y hay que confirmarlo con el dueño antes de aplicarlo. Mientras no
> esté confirmado, los puntos 1 y 3 se aplican al tope de la oferta y **no** a G4 ni a G10.

---
