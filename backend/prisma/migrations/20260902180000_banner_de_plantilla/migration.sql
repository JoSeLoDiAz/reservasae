-- El banner del encabezado, en las plantillas de correo.
--
-- El codigo que lo usa entro con la rama arq/crm-hardening y
-- venia SIN esta migracion ni las columnas en el schema: el
-- backend no compilaba. Son las mismas cuatro que ya tiene
-- `campanas`, con la misma semantica.

ALTER TABLE "plantillas_correo" ADD COLUMN "bannerDatos" BYTEA;
ALTER TABLE "plantillas_correo" ADD COLUMN "bannerMime" TEXT;
ALTER TABLE "plantillas_correo" ADD COLUMN "bannerNombre" TEXT;
ALTER TABLE "plantillas_correo" ADD COLUMN "bannerVersion" INTEGER NOT NULL DEFAULT 1;
