# 0006 · Zona horaria: UTC en base, Bogotá en pantalla, y la frontera del día

- **Estado:** aceptado (recoge por escrito lo que ya está implementado)
- **Fecha:** 2026-08-31

## Contexto

Esto es de lo mejor resuelto del repositorio y no estaba escrito como decisión.

`NO ENCONTRADO`: `dayjs`, `date-fns`, `luxon`, `moment`. Todo con `Date` nativo, `Intl` y
SQL. Las fechas se guardan **en UTC como `TIMESTAMP(3)` sin zona**.

La traducción vive **en un solo sitio**: `backend/src/comun/dia-bogota.ts`, con spec propio.
Y el porqué está escrito ahí (`:3-21`):

> *Las fechas se guardan en UTC y Colombia va cinco horas detrás, así que
> `date_trunc('day', x)` a secas parte los días a las 19:00 de Bogotá: las cinco horas de
> tarde-noche —que es cuando la gente diligencia— se cargan al día siguiente. Lo mismo hace
> `toISOString().slice(0, 10)` en JS.*

Y la lección de por qué está centralizado (`:11-15`): *«El arreglo existía en
`crm/control.ts` y estaba escrito allí: los cuatro `date_trunc` de los tableros se quedaron
fuera, que es la lección de siempre —un arreglo aplicado en un sitio y no a la clase—.»*

Tres detalles que son decisiones, no accidentes:

- **`diaBogota` devuelve TEXTO y no un timestamp, a propósito** (`:34-37`): *«un
  `date_trunc` en hora de Bogotá vuelve a Node como `Date`, y ahí se lee otra vez en UTC —
  el mismo error dos veces, y la segunda invisible. Con texto no hay viaje de vuelta.»*
- **`HOY_BOGOTA`** (`:48`) existe porque `CURRENT_DATE` es el día del servidor y el
  contenedor de Postgres corre en UTC.
- **La zona va por nombre y no por el −5** (`:17-20`, `:25`, `:29`), aunque Colombia no
  tenga horario de verano desde 1993.

`NO ENCONTRADO`: variable `TZ` en los contenedores.

Y el otro lado ya está resuelto igual: `frontend/src/components/admin/ritmo.tsx:10-19`
formatea con `timeZone: "UTC"` sobre `` `${iso}T00:00:00Z` `` — porque el `iso` que llega
**ya es el día de Bogotá** y volver a traducirlo lo movería un día.

## Decisión

1. **En base, todo instante en UTC, `TIMESTAMP(3)` sin zona.** No se cambia.

2. **La frontera del día es `America/Bogota` y se calcula una sola vez**, en
   `backend/src/comun/dia-bogota.ts`. Ningún `date_trunc('day', ...)` suelto ni
   `toISOString().slice(0, 10)` en código nuevo.

3. **Un día del calendario viaja como TEXTO `YYYY-MM-DD`, nunca como instante.** Un instante
   que representa un día se lee dos veces, y la segunda está mal y no se ve.

4. **El frontend no vuelve a traducir lo que ya viene traducido.** Un `YYYY-MM-DD` se
   formatea pinchado a medianoche UTC, como `ritmo.tsx:10-19`. Solo los **instantes** se
   formatean con `timeZone: "America/Bogota"`.

5. **No se pone `TZ` en los contenedores.** Postgres sigue en UTC.

6. **La zona va por nombre.** Aunque hoy el desplazamiento sea fijo.

## Alternativas evaluadas

**Guardar en hora de Bogotá.** Descartada. Un `TIMESTAMP` sin zona en hora local es ambiguo
en cuanto cambien las reglas, obliga a reescribir todo lo guardado, y rompe la comparación
directa con `NOW()`.

**Pasar todo a `TIMESTAMPTZ`.** Descartada **por coste, no por mérito**: es lo correcto en
abstracto. Son 43 modelos, y las migraciones corren solas en cada arranque (ADR 0011). El
beneficio real sobre «UTC más una frontera calculada en un sitio» es pequeño mientras solo
haya **una** zona de negocio. Si algún día hay una segunda, esta decisión se rehace entera y
esta es la alternativa que se retoma.

**`TZ=America/Bogota` en el contenedor de Postgres.** Descartada. Arreglaría `CURRENT_DATE`
y estropearía todo lo demás: el código asume UTC en los 43 modelos, y el arreglo sería
invisible hasta que algo cuadrara mal.

**Meter una librería de fechas.** Descartada. Hoy hay cero y el problema real no es
aritmética de fechas: es que la frontera se calcule una sola vez. Una librería no impide que
alguien escriba `date_trunc('day')` en SQL crudo, que es como se escapó la primera vez.

**Traducir en el frontend con el reloj del navegador.** Descartada. Un asesor con el portátil
en otra zona vería otro día, y las cifras dejarían de cuadrar con el informe al SENA.

## Consecuencias

**Lo bueno.** El día es el mismo en la pantalla, en el informe y en la consulta. El porqué
está escrito en el propio archivo y fijado con spec, así que sobrevive a quien lo escribió.

**Lo malo, y lo aceptamos.** Hay que **acordarse** de usar el helper, y el precedente dice
que no siempre se hace: los cuatro `date_trunc` de tableros se quedaron fuera la primera
vez. Un `YYYY-MM-DD` como texto no se puede restar ni ordenar por zona sin convertirlo. Y
`HORAS_BOGOTA = -5` (`backend/src/comun/dia-bogota.ts:29`) es una constante que hoy es verdad
y algún día podría no serlo, aunque la zona por nombre limite el daño.

---
