# 0001 · Borrado lógico: nada se borra, se archiva

- **Estado:** propuesto
- **Fecha:** 2026-08-31
- **Relacionado:** 0002 (auditoría), 0010 (SEP), 0012 (reservas)

## Contexto

El censo de Fase 0 cuenta **45 borrados físicos de Prisma**: 18 en `backend/src` y 27 en
guiones de `backend/prisma` (`docs/arquitectura/00-mapa-actual.md:295`).

De los 18 vivos, **uno solo deja rastro**: `PARTICIPANTE_BORRADO`
(`backend/src/crm/crm.service.ts:1775-1787`).

`borrarParticipacion` (`backend/src/crm/crm.service.ts:1725`) borra la fila dentro de una
transacción (`:1749-1756`) y se lleva **ocho tablas**: tres las vacía a mano ahí dentro
—avances, notas y movimientos de etapa (`:1750-1754`)— y las otras cinco caen por cascada.
Son las ocho FK con `onDelete: Cascade` hacia `Participante` (`backend/prisma/schema.prisma:573`,
`:674`, `:989`, `:1027`, `:1216`, `:1617`, `:1832`, `:1914`). Entre ellas
`valores_anteriores` (`:1914`), que es **el mecanismo para deshacer cambios**. Borrar a
alguien destruye la forma de deshacer lo que se le hizo. Y el `return` devuelve el documento
en claro (`backend/src/crm/crm.service.ts:1792`), aunque la huella sí lo tapa (`:1783`).

**El obstáculo real no es la columna: es que no hay embudo único de lectura.** Fase 1,
hallazgo D-02 (`docs/arquitectura/01-auditoria.md:216-227`): hay 72 consultas a
`participante` en 14 ficheros y solo cuatro pasan por el constructor de filtros `donde()`. El
refutador añadió 28 consultas más en SQL crudo contra `"participantes"`. **Entre ellas, el
reporte al SEP, que es el entregable contractual.**

Un `archivadoEn` aplicado solo en `donde()` dejaría fuera casi todo.

**El patrón ya existe en la casa, cuatro veces:**

- `backend/src/politicas/politicas.service.ts:179-198` se niega a borrar una política
  aceptada: «es la prueba de lo que leyó» (`:190`).
- `ValorAnterior.restauradoEn` (`backend/prisma/schema.prisma:1907-1909`): *«Se restableció
  desde aquí. No se borra la fila: deshacer también es un cambio, y se tiene que poder
  ver.»* Ese es el molde.
- El único índice único parcial del repositorio:
  `backend/prisma/migrations/20260814120000_politica_por_destinatario/migration.sql:19-21`,
  `CREATE UNIQUE INDEX "politicas_datos_una_vigente" ... WHERE "vigenteHasta" IS NULL`.
- Y está escrito como regla en `CLAUDE.md:360-362`: *«Nada se borra cuando ya se usó. Una
  pregunta con respuestas no puede cambiar de tipo (archívela y cree otra); una opción ya
  elegida se archiva en vez de borrarse; un formulario con respuestas se despublica, no se
  borra.»*

Restricción: hoy hay **12 marcas de ocultamiento distintas** (`visible`, `activo`,
`anulada`, `vigenteHasta`…) y ningún `archivadoEn`/`archivadoPor` uniforme
(`docs/arquitectura/00-mapa-actual.md:198`).

## Decisión

**Ninguna entidad de negocio se borra. Se archiva.**

1. Las entidades de negocio llevan `archivadoEn DateTime?`, `archivadoPorId String?` y
   `archivadoMotivo String?`. Los tres o ninguno: una fecha sin autor no sirve para
   responder quién.

2. **Primero el embudo único de lectura, después la columna.** D-02 lo exige. Una papelera
   que 72 consultas se saltan es peor que no tener papelera: da la sensación de que lo
   archivado dejó de viajar cuando sigue viajando al SENA.

3. **El índice parcial se AÑADE al lado, no sustituye al `@@unique`.** Donde haga falta poder
   archivar y volver a crear sin chocar, se añade en **SQL crudo** un índice único parcial con
   `WHERE "archivadoEn" IS NULL`, y **el `@@unique` de Prisma se conserva**.

   Es lo que hace el molde que se cita arriba, y conviene leerlo bien: `PoliticaDatos`
   mantiene su `@@unique([convenioId, destinatario, version])` **total** en el modelo
   (`backend/prisma/schema.prisma:1099`), y el parcial `politicas_datos_una_vigente` vive
   **solo** en SQL y sobre otras columnas (`migration.sql:19-21`). Añade; no sustituye.

   Sustituir rompe cosas concretas. `Reserva` tiene `@@unique([empresaId, ofertaId])`
   (`backend/prisma/schema.prisma:303`, *«contra el doble clic: una reserva por oferta»*,
   `:302`). Volverlo parcial obligaría a quitarlo del modelo, porque Prisma no sabe expresar
   índices parciales; y al quitarlo desaparece el accesor generado `empresaId_ofertaId`, que
   es con lo que `backend/src/reservas/reservas.service.ts:78` encuentra la reserva cancelada
   para **revivirla** en `:119-124`. Esa es la ruta que sostiene la lista de espera y el CHECK
   `reservas_cancelada_sin_cupos`.

   El precio de añadir en SQL crudo está dicho: el índice parcial es **invisible para
   Prisma**, igual que `politicas_datos_una_vigente`, así que un `prisma migrate dev` puede
   proponer tirarlo. Es el mismo precio que la casa ya paga por ese, y la defensa es la misma:
   vive en su propia migración y nadie corre `migrate dev` contra una base real.

4. **La excepción se escribe, no se deja en blanco.** La regla cubre las entidades de
   negocio de INV-7: `Participante`, `Reserva`, `LeadEntrante`, `Persona`, `Empresa`,
   `Institucion`. La **configuración** —formularios, secciones, preguntas, opciones,
   políticas— se rige por la regla que ya tiene escrita en `CLAUDE.md:360-362` y en
   `backend/src/politicas/politicas.service.ts:179-198`: **se borra solo lo que nunca se
   usó; en cuanto tiene respuestas detrás, se archiva o se despublica.** Esos borrados
   (`backend/src/formularios/formularios.controller.ts:101-102`, `:129-130`, `:173-174`;
   `backend/src/admin/admin.controller.ts:341-343`;
   `backend/src/politicas/politicas.controller.ts:58-59`) **no son incumplimientos de este
   ADR**: son la excepción, y esta es la línea donde queda escrita.

5. `borrarParticipacion` **deja de borrar y pasa a archivar**. El endpoint no se retira:
   tiene llamador vivo en `frontend/src/lib/crm-api.ts:988-995` desde
   `frontend/src/app/admin/participantes/[id]/page.tsx:1035`. Conserva su nombre y su
   mensaje, que ya dicen lo correcto: *«Borra la participación, no a la persona: la misma
   cédula puede estar en el otro convenio, y ahí sigue»*
   (`backend/src/crm/crm.service.ts:1720-1723`). Y su `return` deja de devolver el
   documento en claro (`:1792`).

   Eso toca dos ataduras del frontend, y conviene que estén escritas antes de tocarlas:
   `frontend/src/lib/crm-api.ts:992` tipa `documento: string` en la respuesta, así que
   quitarlo del `return` rompe el tipo; y el texto de confirmación de
   `frontend/src/app/admin/participantes/[id]/page.tsx:1030` dice *«Esto no se deshace»*, que
   **deja de ser verdad** en cuanto pasa a archivar y hay que reescribirlo.

6. Las 12 marcas existentes **no se migran ahora**. Se quedan donde están y se declaran
   como deuda. Unificarlas es un trabajo aparte y meterlo aquí hace que este ADR no se
   pueda aplicar.

7. **Archivar no es neutro para el aforo ni para la lista de espera, y esos predicados entran
   en el embudo.** El embudo de D-02 es el de las **72 lecturas de `participante`**; estos
   tres sitios no están ahí, y por eso se nombran:

   - `promoverListaDeEspera` filtra por `estado: { not: EstadoReserva.CANCELADA }`
     (`backend/src/reservas/reservas.service.ts:397`), **no por «está viva»**. Una reserva
     archivada y no cancelada con `cuposEnEspera > 0` se seguiría promoviendo a `CONFIRMADA`
     (`:409-416`) y seguiría moviendo el contador de la oferta (`:437`). Ese predicado lleva
     `archivadoEn: null` el mismo día que exista la columna, y en ese sitio exacto.
   - Los dos conteos de aforo —`backend/src/crm/crm.service.ts:976` (alta) y `:3462`
     (asignar)— cuentan `etapa: { in: ETAPAS_VIVAS }` sin mirar el archivado: un participante
     archivado seguiría ocupando silla. Mismo `archivadoEn: null`.
   - Y **una `Reserva` solo se archiva después de estar `CANCELADA`**, con los dos contadores
     a cero. Archivar una reserva que todavía retiene cupos deja el cupo muerto, que es
     exactamente lo que `reservas_cancelada_sin_cupos`
     (`backend/prisma/migrations/20260729000000_modelo_inicial/migration.sql:410-412`) existe
     para impedir.

## Alternativas evaluadas

**Añadir `archivadoEn` sin construir el embudo.** Descartada. Es D-02: las 72 consultas y
las 28 en SQL crudo lo ignorarían. El reporte al SEP arma su propio `where` y seguiría
mandando archivados al SENA. Es la alternativa que parece barata y es la única peligrosa,
porque da confianza sin darla.

**Mover la fila a una tabla papelera.** Descartada, y conviene ser exacto con el motivo.
`Participante` tiene cinco relaciones `onDelete: Restrict`
(`backend/prisma/schema.prisma:933-938`; la `:936` es `SetNull`), pero **apuntan hacia
fuera**: impiden borrar la persona, el convenio, la reserva, la oferta y la acción de
formación mientras cuelgue una ficha; no impiden borrar la ficha. Lo que ata la fila viva es
el histórico: `valores_anteriores` apunta por FK a ella (`:1914`). Mover obliga a duplicar
cada modelo y a romper todas las FK. Y mover una fila de tabla **es borrarla de la
primera**, que es lo que este ADR prohíbe.

**Un `activo Boolean @default(true)`.** Descartada. No dice cuándo ni quién, que son las
dos preguntas que hay que poder responder. Y ya hay 12 marcas booleanas: añadir la
decimotercera es el problema, no la solución.

**Vistas de Postgres que filtren lo archivado.** Descartada. El repositorio tiene **cero
vistas y cero triggers** (Fase 0 §2; comprobado: `CREATE VIEW` y `CREATE TRIGGER` no aparecen
en ninguna de las 43 migraciones), Prisma no las mapea, y obligaría a pasar a SQL crudo
justo donde ya hay 28 consultas sin control.

**Una extensión de Prisma (`$extends`) que inyecte el filtro.** Descartada por dos motivos
independientes. `PrismaService extends PrismaClient`
(`backend/src/prisma/prisma.service.ts:6`) y `$extends` devuelve un objeto **nuevo**, no una
instancia de `PrismaService`, que es lo que Nest inyecta en 14 servicios; además el
constructor ya lleva `omit` (`:8-9`). Y aunque funcionara, **no alcanzaría a las 28
consultas en SQL crudo**, que son justo las que se saltan todo.

## Consecuencias

**Lo bueno.** Nada se pierde. El historial para deshacer sobrevive al archivado. INV-1,
INV-2 e INV-3 dejan de depender de que nadie pulse el botón equivocado. Y la excepción de
configuración queda escrita, así que deja de parecer una violación de la regla.

**Lo malo, y lo aceptamos.** El embudo es trabajo grande **antes** de ver un solo
resultado, y es la parte que se va a querer saltar. Toda consulta nueva hay que pasarla por
él y no hay nada que lo obligue: hará falta una prueba que recorra la superficie entera,
como la que ya existe para el ámbito (`backend/src/formularios/fuera-del-ambito.spec.ts`,
descrita en `CLAUDE.md:2223`), porque un arreglo consulta por consulta se olvida de alguna.
Las filas archivadas siguen ocupando espacio y **no hay política de retención**. Y mientras
las 12 marcas viejas convivan con `archivadoEn` hay dos vocabularios para lo mismo.

---
