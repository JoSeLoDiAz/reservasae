# 0011 · Las migraciones corren solas: lo que puede fallar no entra

- **Estado:** propuesto
- **Fecha:** 2026-08-31
- **Relacionado:** todos los que proponen migración (0001, 0002, 0004, 0005, 0008, 0012)

## Contexto

**`backend/arrancar.sh:7` es `set -e`. `:29` es `pnpm exec prisma migrate deploy`. `:31` es
`exec node dist/main.js`.**

Si la imagen sube, la migración corre. No hay paso manual, ni aprobación, ni verificación
previa ni posterior, ni rollback (crítico 6 de Fase 0). Una migración que falla queda marcada
en `_prisma_migrations`: **el contenedor no arranca y no vuelve a arrancar** hasta que
alguien entre a hacer un `migrate resolve` a mano.

**Ya reventó una vez, y la lección está escrita en el propio repositorio.**
`backend/prisma/migrations/20260830185000_origen_lead_importacion/migration.sql:3-7`:

> *Va en su PROPIA migracion y antes de `toques_de_origen`, y no es una manía: Postgres no
> deja USAR un valor de enum recien añadido dentro de la misma transaccion, y Prisma corre
> cada migracion en una. Juntarlas es lo que hizo fallar aquella con «invalid input value para
> enum "OrigenLead": "IMPORTACION"».*

**Y no hay CI.** `NO ENCONTRADO`: no existe `.github/` ni equivalente. Las 853 pruebas, el
lint y el build solo corren si alguien los invoca a mano. Es la explicación estructural del
fallo del enum, y volverá a pasar.

**Hay más de una base, y algunas nacen vacías.** `docker-compose.prueba.yml` levanta otro
clúster; `backend/.env.example` manda al desarrollador a crear la suya; y
`scripts/rendirse.sh:90-92` hace `docker volume rm` más `docker volume create` y **recrea el
clúster vacío**, donde `initdb` solo crea la base y ningún rol extra.

## Decisión

**Una migración que pueda fallar contra una base real no entra en el camino de
`migrate deploy`.**

1. **`ALTER TYPE ... ADD VALUE` va SIEMPRE en su propia migración**, anterior a cualquiera
   que use el valor, y con `IF NOT EXISTS`. Como en `20260821010000` y `20260830185000`.

2. **Ningún `GRANT`, `REVOKE` ni `CREATE ROLE` en una migración.** Van en guion de operación.
   Un `GRANT ... TO reservasae_app` contra una base donde ese rol no existe deja el backend
   sin arrancar en las tres sedes. Si por lo que sea uno tuviera que ir en migración, va
   envuelto en
   `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='...') THEN ... END IF; END $$;`.

3. **Toda restricción nueva sobre datos existentes —`CHECK`, `NOT NULL`, `UNIQUE`— va en
   expand → migrate → contract**, y **la limpieza no viaja en el mismo despliegue que la
   restricción**. Primero contar, después limpiar, y solo entonces restringir. (Quitar una
   restricción, en cambio, no puede fallar contra datos existentes: eso sí entra en el camino
   automático. Es el caso del ADR 0004, punto 3.)

4. **El modelo Prisma y el SQL escrito a mano describen la misma tabla.** Nada de
   `BIGINT GENERATED ALWAYS AS IDENTITY` frente a `@default(autoincrement())`, ni
   `clock_timestamp()` frente a `@default(now())`. Si divergen, el primer `prisma migrate dev`
   que alguien corra genera una migración correctora que **deshace la decisión sin avisar**.
   Corolario, y por eso lo decide el ADR 0002 punto 10: si Prisma no sabe expresar una forma
   de tabla —`PARTITION BY RANGE`, por ejemplo—, esa forma no se usa.

   La excepción tolerada son los **índices** que Prisma no sabe expresar, como el parcial
   `politicas_datos_una_vigente`: viven en SQL crudo, invisibles para el modelo, y el precio
   está aceptado por escrito (ADR 0001, punto 3).

5. **Un valor nuevo en cualquier enum se comprueba antes contra el frontend.**
   `frontend/src/lib/api.ts` y `frontend/src/lib/tableros-api.ts` declaran los enums **a
   mano**. Un `Record<Enum, ...>` no compila si falta la clave; un `Record<string, ...>`
   compila y revienta en runtime, que es peor.

6. **Se prefiere TEXT con CHECK a un enum de Postgres cuando el conjunto vaya a crecer.** Ya
   es la política escrita para el catálogo de auditoría
   (`backend/src/comun/auditoria.service.ts:7-9`): *«añadir una acción no debería costar una
   migración»*.

## Alternativas evaluadas

**Sacar `migrate deploy` del arranque y correrlo a mano.** Descartada **de momento**, y es la
alternativa más seria. Hay tres sedes y bases que se recrean vacías: un paso manual olvidado
deja el esquema desfasado, y ese fallo es peor y aparece más tarde. La solución de fondo es
**CI**, no quitar el automatismo. Cuando exista CI, esta decisión se revisa.

**Envolver `migrate deploy` en un `|| true`.** Descartada. Arrancaría el backend contra un
esquema a medias, que es peor que no arrancar: el fallo dejaría de ser ruidoso y pasaría a ser
corrupción silenciosa.

**Poner la guardia `db:guardia` también en el arranque del contenedor.** Descartada. Esa
guardia existe para impedir que una máquina de desarrollo apunte a producción
(`backend/package.json:22`, `pnpm db:guardia && prisma migrate deploy`). Dentro del contenedor,
la base **es** la de esa sede: la guardia solo impediría arrancar.

**Prohibir los enums de Postgres del todo.** Descartada. Hay 31 y funcionan. El problema no
es el enum: es añadirle un valor y usarlo en la misma transacción.

**Confiar en que la revisión lo cace.** Descartada. No hay CI, y ya falló una vez.

## Consecuencias

**Lo bueno.** El modo de fallo más caro del sistema —el backend que no arranca y no vuelve a
arrancar— deja de depender de que alguien se acuerde de una regla no escrita.

**Lo malo, y lo aceptamos.** Un cambio que antes era una migración pasa a ser dos o tres
despliegues. Expand → migrate → contract obliga a **convivir con el estado intermedio**, y
alguien tiene que acordarse de cerrar el `contract`: los que no se cierran se quedan abiertos
para siempre. Y sacar los `GRANT` del camino automático los convierte en un paso manual que
se puede olvidar **en una sede y no en las otras**, que es el peor sitio donde olvidarse.

---
