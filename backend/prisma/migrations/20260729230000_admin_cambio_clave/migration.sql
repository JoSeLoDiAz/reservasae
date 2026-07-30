-- Toda cuenta nueva nace con una contrasena temporal que conoce quien la creo,
-- asi que arranca obligada a cambiarla antes de poder hacer nada.
ALTER TABLE "administradores"
  ADD COLUMN "debeCambiarClave" BOOLEAN NOT NULL DEFAULT true;
