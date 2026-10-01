-- La CATEGORIA declara que resultado significa.
--
-- Lo senalo el cliente el 30 sep 2026: al anotar una gestion se le
-- preguntaba LO MISMO DOS VECES. Arriba «Como salio» --[Hable con la
-- persona] [No contesto] [El dato no sirve]-- y debajo
-- «Clasificacion», cuyas cuatro categorias sembradas son
-- literalmente esas mismas tres mas «Seguimiento». Textual: «Ese
-- "Como salio" es la "Clasificacion"».
--
-- Se quedo la clasificacion. Los tres botones se fueron de la
-- pantalla. Y `notas_participante.resultado` NO se toca ni se
-- vacia: de el cuelgan los informes y la cuenta de intentos sin
-- respuesta. Lo que cambia es QUIEN lo decide: ya no el asesor en un
-- segundo control, sino la categoria que eligio, y lo deriva el
-- servidor al escribir.
--
-- NULABLE a proposito: una categoria puede no significar ningun
-- resultado --una «Nota interna» no es ni contacto ni intento-- y
-- sus notas quedan sin resultado, igual que las de antes del
-- catalogo.
ALTER TABLE "categorias_de_nota"
  ADD COLUMN "resultado" "ResultadoGestion";

-- LAS CUATRO FILAS YA SEMBRADAS, ACTUALIZADAS AQUI Y NO SOLO EN LA
-- SIEMBRA FUTURA.
--
-- La migracion anterior (20260930170000) ya las inserto en pruebas y
-- en produccion. Si esto solo arreglara las futuras, las cuatro que
-- de verdad usa el asesor quedarian sin significado y TODA nota
-- nueva se guardaria sin resultado: los informes dejarian de contar
-- desde hoy sin que nada falle.
--
-- «Seguimiento» → CONTACTO y no nulo: a un seguimiento solo se llega
-- despues de haber hablado con la persona, asi que es un contacto.
UPDATE "categorias_de_nota" SET "resultado" = 'CONTACTO'
  WHERE "id" = 'cat-contactado';
UPDATE "categorias_de_nota" SET "resultado" = 'SIN_RESPUESTA'
  WHERE "id" = 'cat-no-contactado';
UPDATE "categorias_de_nota" SET "resultado" = 'DATO_MALO'
  WHERE "id" = 'cat-dato-malo';
UPDATE "categorias_de_nota" SET "resultado" = 'CONTACTO'
  WHERE "id" = 'cat-seguimiento';

-- Por si alguna base se sembro con otros ids --una siembra a mano
-- antes de que los ids fueran fijos--: se busca por nombre y solo
-- donde siga sin significado, para no pisar nada ya configurado.
UPDATE "categorias_de_nota" SET "resultado" = 'CONTACTO'
  WHERE "resultado" IS NULL AND lower("nombre") = 'contactado';
UPDATE "categorias_de_nota" SET "resultado" = 'SIN_RESPUESTA'
  WHERE "resultado" IS NULL AND lower("nombre") = 'no contactado';
UPDATE "categorias_de_nota" SET "resultado" = 'DATO_MALO'
  WHERE "resultado" IS NULL AND lower("nombre") = 'el dato no sirve';
UPDATE "categorias_de_nota" SET "resultado" = 'CONTACTO'
  WHERE "resultado" IS NULL AND lower("nombre") = 'seguimiento';
