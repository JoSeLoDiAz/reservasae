-- el nombre visible pasa a "Convoca CRM"

-- el @default solo vale para una base nueva: las que ya existen
-- se quedarian diciendo "Convoca" en la pestaña y en la cabecera
-- de los formularios publicos, que es donde esta columna manda
-- sobre el codigo
ALTER TABLE "marca" ALTER COLUMN "nombreApp" SET DEFAULT 'Convoca CRM';

-- SOLO las que siguen en el valor viejo por defecto.
--
-- Un administrador pudo haberlo cambiado a proposito, y pisarselo
-- seria decidir por el. Misma regla que la siembra, que nunca
-- toca lo que alguien eligio.
UPDATE "marca" SET "nombreApp" = 'Convoca CRM' WHERE "nombreApp" = 'Convoca';
