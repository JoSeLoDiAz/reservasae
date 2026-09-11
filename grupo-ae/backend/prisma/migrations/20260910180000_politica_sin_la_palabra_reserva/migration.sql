-- El titulo de la politica sale ENTERO en las pantallas publicas de
-- captacion (/empresas y /personas), encima de la casilla que la
-- persona marca. Ahi seguia leyendose «Tratamiento de datos — quien
-- reserva».
--
-- `prisma/seed/prueba.ts` ya lo escribe como «quien solicita» desde
-- que la pantalla dejo de vender cupos, pero ese guion se salta la
-- fila que ya existe (`if (vigente) continue`), asi que el texto
-- nuevo solo llegaba a una base recien creada. La de trabajo se
-- quedo con el de antes.
--
-- Coincidencia exacta: si alguien redacto su propio titulo desde el
-- panel, no se toca.

UPDATE "politicas_datos"
   SET "titulo" = 'Tratamiento de datos — quien solicita'
 WHERE "titulo" = 'Tratamiento de datos — quien reserva';
