-- un participante puede tener VARIOS leads

-- El @unique decia «un participante, como mucho un lead», y el
-- dominio dice lo contrario: que la misma persona llene el
-- formulario dos veces es lo normal, no el caso raro.
--
-- Comprobado en vivo antes de tocarlo: el SEGUNDO lead de alguien
-- que ya tiene ficha salia 500 crudo, quedaba PENDIENTE para
-- siempre, y se autoocultaba -- el reintento entraba por la
-- guarda de idempotencia y devolvia 200 con repetido:true, asi
-- que el emisor dejaba de reintentar y nadie se enteraba.
--
-- La idempotencia NUNCA la dio este indice: la da
-- @@unique(origenSistema, externoId), que no se toca.
--
-- Y no se vuelve parcial: un parcial sobre «vivo» seguiria
-- prohibiendo dos leads vivos de la misma persona, que es justo
-- el caso que hay que permitir.
--
-- NO VA SOLA: exige el ramificado por `firme` en la misma imagen.
-- Sin el, el cruce flojo por correo o celular podria atar N leads
-- a la ficha de otro EN SILENCIO -- hoy lo acota que este indice
-- reviente. Se cambiaria un fallo ruidoso por uno callado.
-- Comprobado que ese ramificado ya esta antes de aplicarla.
--
-- Migracion de Mauricio Andres Palma (09 de su serie),
-- renumerada para ir despues de las de esta rama.

DROP INDEX IF EXISTS "leads_entrantes_participanteId_key";

CREATE INDEX IF NOT EXISTS "leads_entrantes_participanteId_idx"
  ON "leads_entrantes"("participanteId");
