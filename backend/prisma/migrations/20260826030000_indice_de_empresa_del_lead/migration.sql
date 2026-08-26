-- El F7 busca los leads por su empresa, y hasta hoy no había
-- por dónde. También lo usa la guarda que impide borrar una
-- empresa que todavía tiene gente colgando.
CREATE INDEX IF NOT EXISTS "participantes_empresaId_idx"
  ON "participantes"("empresaId");
