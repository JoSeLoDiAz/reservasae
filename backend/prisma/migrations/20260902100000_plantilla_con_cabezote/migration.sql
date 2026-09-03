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
ALTER TABLE "plantillas_correo" ADD COLUMN IF NOT EXISTS "bannerDatos" BYTEA;
ALTER TABLE "plantillas_correo" ADD COLUMN IF NOT EXISTS "bannerMime" TEXT;
ALTER TABLE "plantillas_correo" ADD COLUMN IF NOT EXISTS "bannerNombre" TEXT;
ALTER TABLE "plantillas_correo" ADD COLUMN IF NOT EXISTS "bannerVersion" INTEGER NOT NULL DEFAULT 1;

-- IF NOT EXISTS, y no estaba en el original.
--
-- La misma migracion se escribio dos veces el mismo dia: esta y
-- `20260902180000_banner_de_plantilla`, porque al mezclar la rama
-- por la manana faltaba el schema y se anadio a mano. La segunda
-- YA CORRIO en produccion y en pruebas, asi que esta se encuentra
-- las columnas puestas y sin el IF NOT EXISTS tumbaria el
-- arranque del backend.
