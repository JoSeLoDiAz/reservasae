-- La configuracion de la proyeccion de metas, por accion.
--
-- Dos datos que el administrador pone a mano y que no salen de
-- ningun otro: cuantos asesores trabajan la accion, y la fecha de
-- cierre que fija para la proyeccion (aparte del cronograma). De
-- ahi salen la meta diaria y la meta por asesor. Nulos: sin
-- configurar todavia, la pantalla lo dice y no inventa una meta.
ALTER TABLE "acciones_formacion"
  ADD COLUMN "proyeccionAsesores" INTEGER,
  ADD COLUMN "proyeccionCierre"   TIMESTAMP(3);
