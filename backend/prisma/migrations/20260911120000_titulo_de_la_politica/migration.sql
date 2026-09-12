-- El título del texto legal del participante, como lo pidió el
-- cliente el 11 sep 2026:
--
--   antes:  Términos y Condiciones — Habeas Data
--   ahora:  Términos y Condiciones y Autorización para el
--           Tratamiento de Datos Personales
--
-- Es una VERSIÓN NUEVA y no un UPDATE del título, a propósito.
-- Una política que alguien ya aceptó no se edita: es la prueba de
-- lo que leyó (`PoliticasService.actualizar` lo rechaza con un
-- 409 por lo mismo). Se cierra la vigente y se publica la
-- siguiente con el MISMO contenido, palabra por palabra; solo
-- cambia el título.
--
-- Nadie pierde su autorización por esto: la que vale es la del
-- gremio, sea de la versión que sea, mientras no la revoque
-- (`correo/autorizacion-vigente.ts`, `crm/sep/sep.service.ts`).
--
-- Solo toca las que siguen llamándose como la siembra original.
-- Una que el administrador ya retituló a mano se queda como está:
-- lo suyo manda sobre esto.

-- las que hay que renovar, antes de tocar nada. Sin `ON COMMIT
-- DROP`: si el script no corre dentro de una transacción, cada
-- sentencia confirma sola y la tabla desaparecería antes de usarla
CREATE TEMP TABLE "_politicas_a_renovar" AS
SELECT p."id", p."convenioId", p."destinatario", p."contenido",
       (SELECT MAX(u."version")
          FROM "politicas_datos" u
         WHERE u."convenioId" = p."convenioId"
           AND u."destinatario" = p."destinatario") AS "ultima"
  FROM "politicas_datos" p
 WHERE p."destinatario" = 'PARTICIPANTE'
   AND p."vigenteHasta" IS NULL
   AND p."titulo" = 'Términos y Condiciones — Habeas Data';

-- primero se cierra la vigente: el índice `politicas_datos_una_vigente`
-- no admite dos abiertas a la vez, ni un instante
UPDATE "politicas_datos"
   SET "vigenteHasta" = CURRENT_TIMESTAMP,
       "actualizadoEn" = CURRENT_TIMESTAMP
 WHERE "id" IN (SELECT "id" FROM "_politicas_a_renovar");

-- y después se abre la nueva, con el mismo texto
INSERT INTO "politicas_datos"
  ("id", "convenioId", "destinatario", "version", "titulo", "contenido",
   "vigenteDesde", "vigenteHasta", "creadoEn", "actualizadoEn")
SELECT md5(random()::text || r."id"),
       r."convenioId",
       r."destinatario",
       r."ultima" + 1,
       'Términos y Condiciones y Autorización para el Tratamiento de Datos Personales',
       r."contenido",
       CURRENT_TIMESTAMP,
       NULL,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
  FROM "_politicas_a_renovar" r;

DROP TABLE "_politicas_a_renovar";
