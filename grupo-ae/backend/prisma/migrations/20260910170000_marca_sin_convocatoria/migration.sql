-- El H1 del formulario publico sale de `marca.tituloPublico`, y ahi
-- seguia «Reserve sus cupos de formacion».
--
-- La migracion anterior (20260910153121) cambio el DEFAULT de estas
-- tres columnas y nada mas. `ALTER COLUMN ... SET DEFAULT` no toca las
-- filas que ya existen: solo decide que se escribe en las que nazcan
-- despues. Como la fila de marca se sembro hace meses, la pantalla
-- publica siguio encabezada por el texto de la convocatoria --cupos,
-- reserva y formacion gratuita-- aunque el codigo ya no prometia nada
-- de eso. Compilaba, arrancaba, y decia lo contrario de lo que hace.
--
-- Se mueven SOLO las filas que conservan el texto viejo exacto. Si
-- alguien ya lo reescribio desde el panel, esto no lo pisa: el
-- encabezado publico es suyo.

UPDATE "marca"
   SET "tituloPublico" = 'Cuéntenos qué necesita'
 WHERE "tituloPublico" = 'Reserve sus cupos de formación';

UPDATE "marca"
   SET "subtituloPublico" = 'Déjenos sus datos y un asesor lo contacta.'
 WHERE "subtituloPublico" = 'La formación es gratuita y los cupos son limitados.';

-- `nombreApp` es el <title> de la pestaña, tambien en las publicas:
-- quien abre el enlace veia «Convoca CRM», el nombre del producto
-- interno de la epoca de las convocatorias.
UPDATE "marca"
   SET "nombreApp" = 'Grupo AE'
 WHERE "nombreApp" = 'Convoca CRM';
