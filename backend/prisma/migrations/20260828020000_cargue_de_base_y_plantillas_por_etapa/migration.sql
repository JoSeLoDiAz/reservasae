-- Tres cosas: que una campaña pueda salir de una lista subida,
-- que un buzón no reciba el mismo correo dos veces, y que una
-- plantilla sepa en qué etapa tiene sentido.

-- ── de dónde salen los destinatarios ──
--
-- SEGMENTO: de la base propia, con reglas.
-- CARGUE:   de un archivo, y entonces la lista existe desde
--           antes de lanzar.
CREATE TYPE "OrigenCampana" AS ENUM ('SEGMENTO', 'CARGUE');

ALTER TABLE "campanas"
  ADD COLUMN "origen" "OrigenCampana" NOT NULL DEFAULT 'SEGMENTO';

-- ── un destinatario puede no ser nadie del CRM ──
--
-- Un correo subido no tiene ficha. Sin esto habría que
-- inventarle un participante a cada línea del Excel, y eso
-- llena la base de leads falsos que nadie pidió.
ALTER TABLE "destinatarios_campana"
  ALTER COLUMN "participanteId" DROP NOT NULL;

-- El primer nombre que traía el archivo. Los del segmento no
-- lo llevan: lo sacan de su ficha, que está más al día que
-- una columna de Excel.
ALTER TABLE "destinatarios_campana"
  ADD COLUMN "nombre" TEXT;

-- ── un BUZÓN, una vez por campaña ──
--
-- Era por participante, y eso dejaba pasar el caso común: una
-- misma persona con dos fichas -- inscrita en dos cosas --
-- recibía el correo dos veces. El tope de dos al día tampoco
-- lo frenaba, porque también contaba por participante.
--
-- Quien recibe es el buzón, no la ficha. En esta base había
-- 17 personas así.
DROP INDEX "destinatarios_campana_campanaId_participanteId_key";

CREATE UNIQUE INDEX "destinatarios_campana_campanaId_correo_key"
  ON "destinatarios_campana"("campanaId", "correo");

-- ── la plantilla sabe cuándo tiene sentido ──
--
-- Una «confirmación de inscripción» a quien todavía no está
-- inscrito es una mentira firmada por el gremio, y de las que
-- no se recogen: la persona se queda esperando un cupo que
-- nadie le dio.
--
-- Vacío quiere decir «en cualquier etapa», que es lo que
-- valía hasta hoy: las que ya existen no cambian de
-- comportamiento.
ALTER TABLE "plantillas_correo"
  ADD COLUMN "etapasPermitidas" "EtapaParticipante"[] DEFAULT ARRAY[]::"EtapaParticipante"[];
