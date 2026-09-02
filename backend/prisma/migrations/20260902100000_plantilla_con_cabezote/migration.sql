-- el cabezote de una plantilla: la franja que va de primeras,
-- arriba del texto
--
-- mismas cuatro columnas que "campanas" y por el mismo motivo:
-- el cliente de correo de OTRA persona es quien descarga la
-- imagen, asi que tiene que salir por una URL publica y no por
-- el panel
--
-- bannerVersion sube en cada cambio; sin eso Gmail sigue
-- sirviendo el cabezote viejo durante una semana
ALTER TABLE "plantillas_correo" ADD COLUMN "bannerDatos" BYTEA;
ALTER TABLE "plantillas_correo" ADD COLUMN "bannerMime" TEXT;
ALTER TABLE "plantillas_correo" ADD COLUMN "bannerNombre" TEXT;
ALTER TABLE "plantillas_correo" ADD COLUMN "bannerVersion" INTEGER NOT NULL DEFAULT 1;
