-- en un foro hibrido la PAT es el MISMO dia

-- se prohibia el dia a la PAT pensando en un curso largo,
-- donde es la hora de conexion de los demas dias. Un foro es
-- un solo dia: unos en la sede y otros conectados, a la vez
ALTER TABLE "sesiones_de_grupo"
    DROP CONSTRAINT IF EXISTS "sesiones_de_grupo_pat_sin_dia";
