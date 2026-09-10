-- donde quiere tomarlo, que no es donde vive

-- para una formacion HIBRIDA la sede ES la modalidad: AF7 se
-- dicta en MEDELLIN presencial y en ANTIOQUIA virtual, y quien
-- vive en Medellin puede hacer las dos
--
-- se guarda el TEXTO y no un id: las sedes dependen del curso, y
-- el curso lo puede corregir el asesor despues
ALTER TABLE "leads_entrantes" ADD COLUMN "sedePedida" TEXT;
