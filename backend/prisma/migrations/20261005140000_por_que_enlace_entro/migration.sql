-- Por qué enlace entró cada persona.
--
-- El POST público ya recibía la palabra del formulario, la marca del
-- enlace y la baliza de la visita. Se tiraban: solo sobrevivía
-- `campanaDeEntrada`, y encima a medias -se escribe únicamente si la
-- ficha es nueva y no había un lead esperando-.
--
-- Nulos en lo que ya existe: hacia atrás no se puede reconstruir. Los
-- pasos de visita se borran a los 90 días y su id nunca se guardó en la
-- ficha. Rellenarlos con una suposición diría de dónde vino alguien sin
-- que conste, que es peor que no decir nada.
ALTER TABLE "participantes" ADD COLUMN "formularioDeEntrada" TEXT;
ALTER TABLE "participantes" ADD COLUMN "enlaceDeEntrada"     TEXT;
ALTER TABLE "participantes" ADD COLUMN "visitaDeEntrada"     TEXT;

-- Para poder preguntar «cuántos trajo este enlace» sin leer la tabla
-- entera: es la consulta que justifica todo esto.
CREATE INDEX "participantes_convenioId_formularioDeEntrada_idx"
    ON "participantes" ("convenioId", "formularioDeEntrada");
CREATE INDEX "participantes_convenioId_enlaceDeEntrada_idx"
    ON "participantes" ("convenioId", "enlaceDeEntrada");
