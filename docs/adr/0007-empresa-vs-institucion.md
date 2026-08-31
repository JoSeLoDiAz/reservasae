# 0007 · Empresa vs Institución: por qué **no** se fusionan

- **Estado:** aceptado (rescata una decisión ya tomada y nunca escrita)
- **Fecha:** 2026-08-31

## Contexto

Fase 0 lo anotó como **zona oscura nº 5**: *«`Empresa` e `Institucion` modelan lo mismo con
tipos distintos (NIT, razón social, dirección, teléfono, `departamentoSepId`…)»*
(`backend/prisma/schema.prisma:203` y `:1341`).

Es una lectura correcta del esquema y una conclusión equivocada. **Son dos cosas distintas y
la diferencia está escrita en cuatro sitios; lo que faltaba era juntarlos.**

**Qué es cada una.** `backend/prisma/schema.prisma:1335-1340`:

> *no había dónde dejar lo que devuelve el RUES. Ahora es **el maestro**, y `Empresa` —la
> que reserva cupos— cuelga de él. Un mismo NIT puede tener varias: el de un municipio ampara
> a sus colegios, y hay que dejar elegir.*

Y `:202`: *«La organización que reserva, por su NIT.»*

**El ámbito difiere, y la decisión ya estaba tomada.** `CLAUDE.md:2233-2240`:

> ***`instituciones` no lleva ámbito, y es correcto.** Es el directorio maestro de NIT,
> compartido: la tabla no tiene `convenioId`, así que no hay nada que filtrar. **Una revisión
> lo reportó como fuga y no lo es.***
>
> ***`empresas` se comparte por decisión del cliente**, pero la descarga de plantillas las
> volcaba todas, mientras el panel solo lista las que tienen alguna reserva dentro del
> ámbito.*

**Y el mecanismo está escrito en el código.** `backend/src/tableros/ambito.ts:31-35`:

> *La empresa no cuelga de nada: se la reconoce por tener al menos una reserva dentro del
> ámbito.*
> `empresaDeConvenio = (ambito) => ({ reservas: { some: reservaDeConvenio(ambito) } })`

Confirmado en las dos direcciones: `InstitucionesService.listar`
(`backend/src/instituciones/instituciones.service.ts:50`) arma su `where` como
`{ activo: true }` (`:60`) y **no lleva ningún filtro de convenio**; los tableros pasan
`empresaDeConvenio(ambito)` en `backend/src/tableros/tableros.service.ts:74`, `:138` y
`:556`.

Y hay una trampa ya pisada, documentada en `tableros.service.ts:585-591`:

> *El ámbito también AQUÍ, no solo en la empresa. La empresa se comparte entre convenios, así
> que acotar solo la fila de arriba dejaba las columnas —reservas, confirmados, en espera y
> cursos— sumando las del otro gremio.*

**Las claves de unicidad son incompatibles, y eso es lo que cierra la discusión:**

| | `Empresa` | `Institucion` |
|---|---|---|
| Unicidad | `@@unique([nit])` (`:249`), *«un NIT, una organizacion»* (`:248`) | `@@unique([nit, razonSocial])` (`:1400`) |
| Por qué | una reserva llega por FK y solo tiene el NIT | *«Un mismo NIT puede tener varias»* (`:1339-1340`) |
| Ámbito | por gremio, vía `reservas: { some: ... }` | **ninguno**: es global |
| Procedencia | lo que teclea quien reserva | `fuente` (`:1383`), `fuentePorCampo` (`:1380`), `verificadaPorId` (`:1386`), `verificadaEn` (`:1387`) |

`Empresa.institucionId` es **anulable a propósito** (`:235-238`): *«Null mientras nadie la
haya emparejado: se puede reservar con un NIT que todavía no está en el directorio.»*

## Decisión

**No se fusionan. Son dos entidades, con dos ciclos de vida y dos ámbitos.**

1. **`Institucion` es el maestro.** Global, sin `convenioId`, una fila por
   `(nit, razonSocial)`, con procedencia por campo y verificación humana. Se llena desde el
   RUES y desde la búsqueda web.

2. **`Empresa` es la contraparte de una reserva.** Una fila por NIT, sin `convenioId`, y su
   ámbito **se deduce**: se la reconoce por tener al menos una reserva dentro del ámbito.

3. **El puente es `Empresa.institucionId`, y sigue siendo anulable.** Se puede reservar con
   un NIT que aún no está en el directorio; emparejar es un acto posterior y humano.

4. **Ninguna consulta de `Institucion` lleva filtro de convenio.** Reportarlo como fuga de
   ámbito es un falso positivo, y ya pasó una vez.

5. **Toda consulta de `Empresa` que se le muestre a un gremio lleva `empresaDeConvenio`, y
   además acota las relaciones que cuelgan de ella.** Acotar solo la fila de arriba deja las
   columnas sumando el otro gremio.

6. **Lo que se reporta al SENA sale de la ficha verificada.** Una `Institucion` sin
   verificar no viaja: *«Quién la confirmó. Sin esto no se reporta al SENA»*
   (`backend/prisma/schema.prisma:1385`).

## Alternativas evaluadas

**Fusionar en una tabla con un booleano `esMaestro`.** Descartada. **Las dos claves de
unicidad son incompatibles.** `Empresa` exige un NIT una fila; `Institucion` exige varias por
NIT **a propósito**, para el municipio que ampara a sus colegios. En una sola tabla se pierde
una de las dos garantías, y las dos están razonadas en el esquema.

**Fusionar y quedarse con la unicidad de `Institucion`.** Descartada. `Reserva` llega a la
empresa por FK y el formulario público **solo tiene el NIT**: con varias filas por NIT habría
que elegir cuál, y no hay quién elija — es una ruta pública sin sesión.

**Fusionar y quedarse con la unicidad de `Empresa`.** Descartada. Obliga a tirar filas del
RUES o a inventar cuál es la buena, que es exactamente lo que `fuentePorCampo` y
`verificadaPor` existen para no hacer nunca.

**Ponerle `convenioId` a `Institucion`.** Descartada. La decisión ya está escrita
(`CLAUDE.md:2233-2235`) y el maestro compartido es lo que evita consultar el RUES una vez por
gremio. Además duplicaría la ficha **y su verificación**: dos gremios verificando la misma
empresa por separado.

**Quitarle a `Empresa` sus campos del SEP y leerlos siempre de `Institucion`.** Descartada.
`institucionId` es anulable, así que habría reservas sin datos de empresa; y el F7 pide
campos que el RUES no publica, como `papelEnConvenio` (`schema.prisma:228`) y
`numeroTrabajadores` (`:226`).

**Dejarlo como zona oscura, sin decidir.** Descartada. Ya costó un falso positivo de
seguridad. Sin este ADR vuelve a pasar, y la próxima vez alguien «arregla» la fuga.

## Consecuencias

**Lo bueno.** Cada tabla tiene un dueño y una pregunta. El ámbito queda explicado y el falso
positivo no vuelve. Y el caso del municipio con sus colegios sigue siendo posible.

**Lo malo, y lo aceptamos.** Hay campos duplicados entre las dos —razón social, dirección,
teléfono, `departamentoSepId`— y **pueden discrepar**, sin que nadie diga cuál manda al
reportar. Nadie obliga a emparejar, así que puede haber empresas reservando para siempre sin
ficha maestra. Y `empresaDeConvenio` es un `some` sobre relación: más caro que un
`convenioId` directo, y **fácil de olvidar en las relaciones anidadas** — ya se olvidó una
vez, y por eso está el comentario de `tableros.service.ts:585-591`.

---
