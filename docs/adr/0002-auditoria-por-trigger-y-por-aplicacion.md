# 0002 · Auditoría: por trigger **y** por aplicación

- **Estado:** propuesto
- **Fecha:** 2026-08-31
- **Relacionado:** 0001, 0008 (el documento no se historia), 0011 (migraciones)

## Contexto

**14 de 71 escrituras de negocio dejan huella. El 80 % no** (Fase 1, C-14;
`docs/arquitectura/01-auditoria.md:166`).

`AuditoriaService` se inyecta en **cinco servicios** y en ninguno más: `crm`
(`backend/src/crm/crm.service.ts:324`), `rui` (`backend/src/crm/rui/rui.service.ts:61`),
`instituciones` (`backend/src/instituciones/instituciones.service.ts:40`), `plantillas`
(`backend/src/plantillas/plantillas.service.ts:38`) y `preinscripcion`
(`backend/src/preinscripcion/preinscripcion.service.ts:55`). Los que escriben fuera de esa
lista tienen **cero** referencias: leads, conversión, reservas, admin, cronograma, políticas.
Los workers tampoco. Y `backend/src/cronograma/` no registra nada (E-01): nadie sabe quién
movió una fecha, en el módulo del que usted dijo explícitamente que solo lo toca un
administrador.

**No hay ni un trigger en las 43 migraciones.** Todo depende de que el programador se
acuerde de llamar a `registrar()`. INV-3 pide lo contrario: que escribir por SQL directo
también deje rastro.

Y la bitácora es borrable (C-06): cero `REVOKE`, cero `GRANT`, cero RLS en las migraciones.
La aplicación se conecta con el rol dueño del esquema (`backend/.env.example:9`, `:17`).

**Tres cosas que hoy funcionan y que un rediseño se lleva por delante si no mira:**

- `AuditoriaService.registrar` (`backend/src/comun/auditoria.service.ts:116-135`) escribe
  **fuera de toda transacción** y **se traga la excepción a propósito**. Está razonado en
  `:113-115`: *«No revienta la operación que audita: si la traza falla se registra el fallo,
  pero el cambio del usuario ya ocurrió y tumbarlo por esto sería peor.»* Y otra vez en
  `backend/src/crm/crm.service.ts:1758`: *«La huella, DESPUÉS de borrar y fuera de la
  transacción.»*
- `NUNCA_SE_HISTORIA` (`backend/src/crm/clase-de-dato.ts:79-82`) declara
  `numeroDocumento` y `tipoDocumentoSepId` con el motivo escrito en `:75-78`: *«si algún día
  se corrige, la cédula vieja NO se copia a ningún lado»*. Es la regla de privacidad más
  dura del repositorio.
- `backend/src/prisma/prisma.service.ts:8-9` va a propósito con
  `omit: { logo: { datos: true } }`: *«los bytes del logo no viajan por defecto»*.

Y hay dos hechos que acotan cualquier mecanismo de exigencia: `backend/src/crm/rui/` está
**fuera de alcance** y tiene nueve escrituras sin transacción; y `Matricula`
(`backend/src/crm/matricula.ts:37`) y `VigiaDeCupos`
(`backend/src/crm/vigia-de-cupos.ts:36`) **arrancan siempre**, sin interruptor.

## Decisión

**Las dos, con reparto claro. Ninguna sustituye a la otra.**

1. **Se pone un trigger de bitácora en Postgres.** Es lo único que ve el SQL crudo, los
   workers y un `psql` a mano. Es lo que INV-3 pide y lo que la aplicación no puede dar.

2. **La auditoría por aplicación no se toca.** Sigue fuera de transacción y sigue tragándose
   su excepción. Responde otra pregunta —quién, desde qué IP, con qué intención, y con un
   resumen en palabras— que el trigger no puede responder.

3. **Nada de una extensión de Prisma que exija contexto de transacción y lance si falta.**
   Ese mecanismo apagaría en silencio la auditoría que hoy sí funciona: el `create` suelto de
   `auditoria.service.ts:118-131` lanzaría, el catch de `:132-134` lo convertiría en una
   línea de log, y **ninguna de las 14 escrituras que hoy auditan volvería a escribir**. El
   fallo sería invisible porque el catch ya existe. Además tumbaría `backend/src/crm/rui/`,
   que está fuera de alcance, y los dos workers incondicionales.

4. **Las columnas ocultas se declaran tabla por tabla, ANTES de instalar el trigger.**
   `personas` y `participantes` ocultan al menos `numeroDocumento` y `tipoDocumentoSepId`,
   por `NUNCA_SE_HISTORIA`. Un trigger que copie la fila entera en un DELETE convierte
   **ejercer el derecho de supresión en el acto que crea la copia permanente de los datos**.
   `logos` no lleva trigger: `to_jsonb(OLD)` metería los bytes en JSONB, en hexadecimal, al
   doble de tamaño.

5. **`version` no entra en la lista de ruido.** No existe control optimista en este
   repositorio (Fase 0 §2). Las dos únicas columnas `version` son `PoliticaDatos.version`
   —la versión exacta del texto a la que apunta cada autorización, o sea la prueba de habeas
   data— y `Logo.version`, que es de caché. Silenciarla ocultaría el cambio con más
   consecuencias legales del sistema.

6. **Ningún `GRANT`, `REVOKE` ni `CREATE ROLE` en el camino de `prisma migrate deploy`.**
   Van en guion de operación. Y si alguno no tuviera más remedio que ir en migración, va
   envuelto en el `DO $$ ... pg_roles ... $$` del punto 2 del ADR 0011.

7. **La inmutabilidad se consigue con un rol de aplicación separado, no revocándose
   permisos a sí mismo el dueño del esquema.** Hoy la app se conecta como `reservasae`, que
   es el dueño: un `REVOKE` desde el dueño se lo devuelve él mismo, y si revoca el `INSERT`
   deja de poder auditar. Ese rol es trabajo aparte y merece su propio ADR.

8. **El modelo Prisma y el SQL describen la misma tabla.** `@default(autoincrement())` y
   `@default(now())`, no `BIGINT GENERATED ALWAYS AS IDENTITY` ni `clock_timestamp()`. Si
   divergen, el primer `prisma migrate dev` genera una migración correctora que deshace las
   decisiones sin avisar.

9. **Toda acción nueva se añade a `ACCIONES` antes de usarla.** El array abre en
   `backend/src/comun/auditoria.service.ts:10`, cierra con `as const` en `:40`, y `:42`
   deriva `export type Accion = (typeof ACCIONES)[number]`, que es lo que tipa
   `Entrada.accion`: auditar una acción que no esté en la lista **no compila**.

10. **La bitácora del trigger NO se particiona en la primera entrega, y la retención va en
    guion de operación.** Esta es la resolución explícita del choque con el punto 8, y manda
    el punto 8. Prisma no sabe expresar `PARTITION BY RANGE`, y una tabla particionada obliga
    además a meter la clave de partición en la primaria, así que un `@id` solo no vale: o se
    parte la tabla, o el modelo y el SQL describen lo mismo. Describen lo mismo.

    El motivo de fondo es peor que la incomodidad. **No hay planificador** —comprobado:
    `grep -rnE "@nestjs/schedule|@Cron|node-cron|bullmq" backend/src backend/package.json`
    → cero— y el trigger es fail-closed (punto 11). Una partición que falte no deja la
    bitácora coja: deja la base rechazando la primera escritura que caiga fuera del último
    rango, o sea el backend sin aceptar escrituras. Particionar sin quien cree las
    particiones es cambiar un problema de espacio por una caída.

    La poda va donde ya van las cosas que no pueden fallar solas: el guion de operación del
    punto 6. Y particionar queda escrito como deuda, para cuando exista planificador.

11. **El trigger es fail-closed, y eso se declara.** La auditoría por aplicación es fail-open
    **a propósito**: su excepción se la traga el `catch` de
    `backend/src/comun/auditoria.service.ts:132-134`, y está razonado en `:113-115`. Un
    trigger no puede hacer eso: su excepción aborta la transacción de negocio. O sea que a
    partir de este ADR **un fallo al auditar sí puede tumbar el cambio del usuario**, por la
    puerta del trigger, mientras por la puerta de la aplicación sigue sin tumbarlo. El
    documento no puede presentar el trigger como una red que solo se añade: cambia el modo
    de fallo de toda escritura auditada.

    Lo que lo acota es que la función del trigger sea mínima: copiar `to_jsonb(OLD)` menos las
    columnas ocultas del punto 4, y nada más —ni consultas, ni dependencia de una partición
    que alguien tenga que crear a tiempo (punto 10)—.

    > **DECISIÓN ABIERTA.** Este cambio de fail-open a fail-closed afecta a todas las
    > escrituras auditadas y necesita el visto bueno del dueño **antes** de instalar el
    > trigger. No se puede cerrar desde el código.

## Alternativas evaluadas

**Solo por aplicación.** Descartada. Es lo que hay hoy y el marcador es 14 de 71. Depende de
que el programador se acuerde, y 57 escrituras demuestran que no se acuerda. No ve el SQL
crudo, ni los workers, ni un `psql`.

**Solo por trigger.** Descartada. El trigger sabe **qué** cambió pero no **quién** ni **por
qué**. Se le puede pasar el actor con `set_config`, pero solo lo pone quien se acuerde: es
el mismo problema, movido de sitio. Y se perderían los resúmenes en palabras que hoy
existen.

**Una extensión de Prisma que exija el contexto.** Descartada por lo dicho en el punto 3, y
además porque la firma no encaja: **17 de las 30 llamadas a `$transaction` no reciben `tx`**.
Son la forma de array —`$transaction([...])`, o una variable de array, o un `.map(...)`— y
ahí no hay dónde meter un `set_config` previo. Las otras 13 son de callback y sí lo tienen.
Entre las 17 está `backend/src/crm/crm.service.ts:1297`, que es justamente la que escribe
`valores_anteriores`. (La aparición número 31 del texto `$transaction` en `backend/src`,
`backend/src/instituciones/web/harness.ts:95`, no es una llamada: es el doble de pruebas.)

**Auditar dentro de la misma transacción del negocio.** Descartada. Contradice una decisión
escrita dos veces (`auditoria.service.ts:113-115` y `crm.service.ts:1758`): un fallo al
auditar tumbaría el cambio que el usuario ya vio hecho. Nótese que el punto 11 **no** deshace
esto: la auditoría por aplicación sigue fuera de la transacción; lo que entra en la
transacción es el trigger, y por eso hay que declararlo.

**Un enum de Postgres para `accion`.** Descartada, y ya estaba decidido lo contrario por
escrito: `backend/src/comun/auditoria.service.ts:7-9` — *«Catálogo en código y no enum de
Postgres: añadir una acción no debería costar una migración, y el conjunto cambia más que el
esquema.»* Y un `ALTER TYPE` en migración desatendida es el fallo del ADR 0011.

## Consecuencias

**Lo bueno.** Por primera vez el SQL crudo, los workers y el webhook dejan rastro. Los
cuatro críticos de INV-3 dejan de estar abiertos. Y la auditoría que hoy funciona **no se
apaga para conseguirlo**, que es como se perdió el diseño anterior.

**Lo malo, y lo aceptamos.** Hay dos mecanismos con dos vocabularios y hay que saber cuál
mirar para cada pregunta, y ahora también **dos modos de fallo distintos** para la misma
pregunta (punto 11). El trigger dispara en **cada** UPDATE, y una campaña de 5.000
destinatarios son 5.000 filas de bitácora; sin partición, la poda depende de que alguien
corra el guion de operación. Y la inmutabilidad real queda pendiente del rol separado: hasta
entonces la bitácora existe pero la aplicación podría borrarla.

---
