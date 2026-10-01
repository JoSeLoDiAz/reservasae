-- La clasificacion de una gestion: categoria y subcategoria,
-- configurables desde el panel.
--
-- Lo pidio el cliente el 30 sep 2026: «necesito que las notas sean
-- como las plantillas personalizables [...] su categoria y su
-- subcategoria mas lo que coloque el asesor. Esto blinda el proceso
-- y se sabe realmente que paso».
--
-- Tablas y no enums: con un enum, cada razon nueva seria una
-- migracion, nadie la pediria, y todo volveria al texto libre --que
-- es lo que esto existe para evitar.

CREATE TABLE "categorias_de_nota" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    -- Ocultar, nunca eliminar: hay notas que apuntan aqui.
    "ocultaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_de_nota_pkey" PRIMARY KEY ("id")
);

-- Dos «No contactado» son dos filas que cuentan la mitad cada una.
CREATE UNIQUE INDEX "categorias_de_nota_nombre_key"
  ON "categorias_de_nota"("nombre");

-- Lo que llena el desplegable: lo visible, en su orden.
CREATE INDEX "categorias_de_nota_ocultaEn_orden_idx"
  ON "categorias_de_nota"("ocultaEn", "orden");

CREATE TABLE "subcategorias_de_nota" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "ocultaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcategorias_de_nota_pkey" PRIMARY KEY ("id")
);

-- Unico DENTRO de su categoria: el mismo nombre puede tener
-- sentido en dos categorias distintas.
CREATE UNIQUE INDEX "subcategorias_de_nota_categoriaId_nombre_key"
  ON "subcategorias_de_nota"("categoriaId", "nombre");

CREATE INDEX "subcategorias_de_nota_categoriaId_ocultaEn_orden_idx"
  ON "subcategorias_de_nota"("categoriaId", "ocultaEn", "orden");

-- RESTRICT y no CASCADE: borrar una categoria no se puede, y el que
-- lo intente desde una consola recibe un no de la base en vez de
-- dejar subcategorias huerfanas.
ALTER TABLE "subcategorias_de_nota"
  ADD CONSTRAINT "subcategorias_de_nota_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categorias_de_nota"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Las dos columnas de la nota, NULAS las dos.
--
-- Nulas porque las notas que ya existen no tienen categoria y
-- tienen que seguir leyendose. Inventarles una --«Sin
-- clasificar»-- seria escribir en el historial algo que nadie
-- anoto.
ALTER TABLE "notas_participante" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "notas_participante" ADD COLUMN "subcategoriaId" TEXT;

ALTER TABLE "notas_participante"
  ADD CONSTRAINT "notas_participante_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categorias_de_nota"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notas_participante"
  ADD CONSTRAINT "notas_participante_subcategoriaId_fkey"
  FOREIGN KEY ("subcategoriaId") REFERENCES "subcategorias_de_nota"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- El corte del informe: cuantas gestiones por categoria y cuando.
CREATE INDEX "notas_participante_categoriaId_creadoEn_idx"
  ON "notas_participante"("categoriaId", "creadoEn");

CREATE INDEX "notas_participante_subcategoriaId_creadoEn_idx"
  ON "notas_participante"("subcategoriaId", "creadoEn");

-- LAS SEMILLAS VAN AQUI, EN LA MIGRACION, Y NO EN `prisma/seed`.
--
-- Porque no son datos de demostracion: son parte del contrato. De
-- «No contactado» cuelga un informe, asi que la categoria tiene que
-- existir en pruebas y en produccion, no solo donde alguien se
-- acuerde de correr la siembra. La siembra se corre a mano y solo
-- en bases de prueba; esto se aplica solo, una vez, en todas.
--
-- Los ids son fijos y legibles, no cuid: asi una consulta de apoyo
-- --«cuantas gestiones quedaron en no contactado»-- se puede
-- escribir sin mirar la tabla primero, y un reaplicado no duplica.
--
-- Las cuatro categorias salen del flujo que YA existe, no de una
-- lista inventada: las tres primeras son las tres salidas que el
-- CRM ya distingue (`ResultadoGestion`: CONTACTO, SIN_RESPUESTA,
-- DATO_MALO) y la cuarta es lo que queda abierto despues. Las dos
-- que el cliente nombro --«No contactado» y «Contactado»-- van con
-- las subcategorias que dicto, tal cual.
INSERT INTO "categorias_de_nota" ("id", "nombre", "orden") VALUES
  ('cat-no-contactado', 'No contactado', 10),
  ('cat-contactado',    'Contactado',    20),
  ('cat-dato-malo',     'El dato no sirve', 30),
  ('cat-seguimiento',   'Seguimiento',   40)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "subcategorias_de_nota" ("id", "categoriaId", "nombre", "orden") VALUES
  ('sub-nc-sin-respuesta',   'cat-no-contactado', 'Sin respuesta',            10),
  ('sub-nc-numero-malo',     'cat-no-contactado', 'Número equivocado',       20),
  ('sub-nc-buzon',           'cat-no-contactado', 'Buzón de voz',            30),
  ('sub-nc-colgo',           'cat-no-contactado', 'Colgó sin atender',       40),

  ('sub-co-interesado',      'cat-contactado',    'Interesado',              10),
  ('sub-co-no-interesado',   'cat-contactado',    'No interesado',           20),
  ('sub-co-mas-info',        'cat-contactado',    'Pide más información',    30),
  ('sub-co-no-cumple',       'cat-contactado',    'No cumple requisitos',    40),
  ('sub-co-ya-inscrito',     'cat-contactado',    'Ya está inscrito',        50),

  ('sub-dm-no-existe',       'cat-dato-malo',     'El número no existe',     10),
  ('sub-dm-correo-rebota',   'cat-dato-malo',     'El correo rebota',        20),
  ('sub-dm-otra-persona',    'cat-dato-malo',     'Los datos son de otra persona', 30),

  ('sub-sg-volver-a-llamar', 'cat-seguimiento',   'Quedó en volver a llamar', 10),
  ('sub-sg-faltan-datos',    'cat-seguimiento',   'Faltan datos para inscribir', 20),
  ('sub-sg-documentos',      'cat-seguimiento',   'Pendiente de documentos', 30),
  ('sub-sg-inscrito',        'cat-seguimiento',   'Inscripción completada',  40)
ON CONFLICT ("id") DO NOTHING;
