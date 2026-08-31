# 0008 · La llave de identidad es el par `(tipoDocumentoSepId, numeroDocumento)`

- **Estado:** aceptado (decidido por el dueño el 2026-08-31)
- **Fecha:** 2026-08-31
- **Relacionado:** 0009 (LMS), 0011 (migraciones), 0002 (el documento no se historia)

## Contexto

Es la decisión que más cuesta cambiar después: de ella cuelga cómo se casan los sistemas, y
cambiarla más tarde significa revisar ficha por ficha.

**Buena noticia: ya está así.** `backend/prisma/schema.prisma:856` declara
`@@unique([tipoDocumentoSepId, numeroDocumento])` en `Persona`, con el comentario de `:855`:
*«el duplicado se vuelve imposible de crear»*. No hay que migrar nada para esto.

**El normalizador existe y hace lo que hace falta.**
`backend/src/comun/documento.ts:7`, con el motivo escrito en `:5-6`: *«Sin puntos, sin
espacios y en mayusculas: la unicidad depende de que "1.019.456.782" y "1019456782" sean
uno.»* Y `documentoValido(tipoSepId, numero)` en `:18`, que valida **según el tipo**: solo
dígitos si el tipo es numérico, alfanumérico si es pasaporte o PEP.

**El hueco, confirmado.** `backend/src/preinscripcion/preinscripcion.service.ts:236` hace
solo `dto.numeroDocumento.trim()`. Y el DTO tampoco normaliza.

| Por dónde entra | Teclea | Se guarda como |
|---|---|---|
| Panel de admin | `1.020.304.050` | `1020304050` |
| **Preinscripción pública** | `1.020.304.050` | `1.020.304.050` |

**Son dos `Persona` distintas para el mismo ser humano**, y el `@@unique` no las detecta
porque las cadenas difieren. Es la puerta que más gente usa —se inscribe sola, sin asesor
delante— y es donde más se teclea con puntos.

Y una restricción de privacidad: el documento **no se historia**, y no por olvido
(`backend/src/crm/clase-de-dato.ts:75-82`).

## Decisión

1. **La identidad de una persona es el PAR, no el número.** El catálogo del SEP tiene varios
   tipos y dos personas distintas pueden compartir número con tipos distintos. Es raro;
   cuando pasa, mezcla a dos seres humanos y no hay forma limpia de deshacerlo.

2. **La normalización se hace en la FRONTERA**, con un `@Transform` en el DTO, igual que el
   `recortar` que ya se usa (`backend/src/admin/dto.ts:24`, aplicado en `:58`, `:64`, `:70`;
   y `correo`, en `:27`, que además pasa a minúsculas). Ponerlo en el DTO y no en cada
   servicio significa que **una ruta nueva lo hereda sin acordarse**. Es la diferencia entre
   una convención y una garantía.

3. **Una sola puerta de escritura de `Persona`**: `resolverPersona(tipo, numero, datos)`, que
   normaliza y hace el `upsert` por la clave compuesta. Hoy hay dos creadores de ficha
   —`backend/src/crm/crm.service.ts:1038` y
   `backend/src/preinscripcion/preinscripcion.service.ts:328`— y cada uno normaliza distinto;
   ahí es donde entra la divergencia.

4. **La base lo garantiza al final**, con
   `CHECK ("numeroDocumento" ~ '^[A-Z0-9]{4,20}$')` — el mismo patrón que ya aplica
   `normalizarDocumento` (`backend/src/comun/documento.ts:14`). Es la única capa que no se
   olvida: una fila con puntos no entra venga por donde venga, por una ruta nueva, por un
   guion suelto o por un `psql` a mano. Es el mismo razonamiento de los **17 CHECK** que ya
   defienden invariantes en las migraciones, cinco de ellos de cupos
   (`backend/prisma/migrations/20260729000000_modelo_inicial/migration.sql:388-412`).

5. **El CHECK va en expand → migrate → contract, y la limpieza NO viaja en el mismo
   despliegue.** Primero contar cuántas filas no cumplen el patrón (consulta de solo
   lectura); después normalizarlas **fusionando a mano las que colisionen**, porque dos filas
   pueden pasar a ser la misma persona y eso lo decide un humano, no un `UPDATE`; solo
   entonces, el CHECK. Ver ADR 0011.

6. **El documento sigue sin historiarse.** No se copia a la bitácora del ADR 0002 ni a
   `valores_anteriores`.

## Alternativas evaluadas

**El número solo, sin el tipo.** Descartada. Dos personas con distinto tipo pueden compartir
número. El coste de equivocarse no es un registro duplicado: es **mezclar dos personas**, y
eso no se deshace.

**Un id interno y el documento como atributo cualquiera.** Descartada de facto: ya hay id
interno (`cuid`) y no responde la pregunta. La pregunta es cómo se reconoce a la **misma
persona que vuelve por otra puerta**, y para eso hace falta una llave natural.

**Normalizar en cada servicio.** Descartada. Es lo que hay hoy y ya falló: cinco sitios
llaman al normalizador —`backend/src/crm/carga.ts:103`,
`backend/src/crm/crm.service.ts:909` y `:3704`,
`backend/src/leads/conversion.service.ts:99`, `backend/src/leads/leads.service.ts:396`— y el
sexto, el público, no.

**Solo el CHECK, sin `@Transform`.** Descartada. Rechazaría con **500 crudo** (no hay
`ExceptionFilter`) una cédula escrita con puntos, que es un error del usuario y no del
sistema. La frontera tiene que arreglar lo arreglable.

**Solo el `@Transform`, sin CHECK.** Descartada. Un guion suelto, una siembra o un `psql` se
lo saltan. Es una convención, no una garantía, y este ADR existe porque las convenciones ya
fallaron una vez.

**Poner el CHECK ya, en la próxima migración.** Descartada. Si hay filas con puntos la
migración falla, y con `set -e` en `backend/arrancar.sh:7` y `migrate deploy` en `:29` **el
contenedor no arranca**.

## Consecuencias

**Lo bueno.** Se acaba la divergencia entre el panel y la preinscripción. Y el contrato con
cualquier sistema externo —el LMS del ADR 0009 incluido— tiene una llave escrita en vez de
un acuerdo verbal.

**Lo malo, y lo aceptamos.** La limpieza previa es trabajo manual contra la base real y **no
se puede automatizar**, porque fusionar dos personas es una decisión. El `@Transform` cambia
lo que el usuario escribió sin decírselo. Y quien hoy tenga dos fichas por ser el mismo
humano las seguirá teniendo hasta que alguien las fusione: este ADR impide fichas nuevas
divergentes, no arregla las viejas.

---
