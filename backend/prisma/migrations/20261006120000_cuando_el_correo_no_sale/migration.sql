-- CUANDO EL CORREO NO SALE, QUE SE SEPA EN LA FICHA.
--
-- «No hay un criterio para ver si el correo esta bien o no»
-- (cliente, 5 oct 2026). Cuando el servidor rechaza una direccion,
-- eso quedaba en el registro del servidor y en ningun sitio que mire
-- quien trabaja la ficha.
--
-- Las dos NULABLES y sin relleno: no se les inventa un estado a las
-- direcciones de antes. Nulo es «nunca ha fallado, o no se sabe», que
-- es la verdad.
ALTER TABLE "personas" ADD COLUMN "correoFallaEn" TIMESTAMP(3);
ALTER TABLE "personas" ADD COLUMN "correoFalloMotivo" TEXT;

-- Por aqui se pregunta: «enseñame las fichas con el correo malo».
--
-- SIN clausula WHERE, aunque un indice parcial ocuparia menos: Prisma
-- no sabe declarar indices parciales, asi que el schema no podria
-- decir lo mismo y el primer `migrate dev` de alguien propondria
-- borrarlo. Es la correccion que Josse hizo esta mañana con los otros
-- dos indices, y vale igual aqui: lo que no esta en el schema se
-- pierde en la siguiente migracion que alguien genere.
CREATE INDEX "personas_correoFallaEn_idx" ON "personas" ("correoFallaEn");
