-- Un logo por tema.
--
-- Los logos del gremio son archivos cerrados, hechos para papel:
-- el de ADECOPRIA lleva el nombre en negro y sobre el fondo
-- oscuro no se lee. No se pueden recolorear desde el CSS como el
-- signo de Convoca, que va en `currentColor`. Así que la entidad
-- manda sus dos versiones y cada fila dice en qué tema sale.
--
-- Lo pidió el cliente el 11 sep 2026, con las variantes de
-- ADECOPRIA en SVG: símbolos a color con texto oscuro para el
-- tema claro, y los mismos símbolos con texto blanco para el
-- oscuro.
--
-- `AMBOS` por defecto, que es lo que ya son todos los que hay:
-- nadie tiene que volver a subir nada, y un logo sin texto
-- —como el de Grupo AE— se queda así y sale siempre.

CREATE TYPE "EsquemaDeLogo" AS ENUM ('AMBOS', 'CLARO', 'OSCURO');

ALTER TABLE "logos"
  ADD COLUMN "esquema" "EsquemaDeLogo" NOT NULL DEFAULT 'AMBOS';
