-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "TipoUbicacion" AS ENUM ('CIUDAD', 'DEPARTAMENTO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'LISTA_ESPERA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AccionMovimiento" AS ENUM ('CREACION', 'EDICION', 'CANCELACION', 'PROMOCION_LISTA_ESPERA', 'AJUSTE_ADMIN');

-- CreateEnum
CREATE TYPE "TipoPregunta" AS ENUM ('TEXTO_CORTO', 'TEXTO_LARGO', 'NUMERO', 'CORREO', 'TELEFONO', 'SELECCION_UNICA', 'SELECCION_MULTIPLE', 'CASILLA');

-- CreateEnum
CREATE TYPE "CampoNucleo" AS ENUM ('EMPRESA_NIT', 'EMPRESA_RAZON_SOCIAL', 'EMPRESA_COLABORADORES', 'EMPRESA_RED_ASOCIADA', 'CONTACTO_NOMBRE', 'CONTACTO_CORREO', 'CONTACTO_TELEFONO', 'CONTACTO_CARGO', 'OFERTA', 'CUPOS_SOLICITADOS', 'ACEPTA_TERMINOS', 'ACEPTA_POLITICA_DATOS');

-- CreateEnum
CREATE TYPE "RolAdmin" AS ENUM ('SUPERADMIN', 'GESTOR', 'CONSULTA');

-- CreateTable
CREATE TABLE "convenios" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sigla" TEXT,
    "nit" TEXT NOT NULL,
    "digitoVerificacion" TEXT,
    "correo" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "departamento" TEXT,
    "paginaWeb" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convenios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acciones_formacion" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "modalidad" "Modalidad" NOT NULL,
    "evento" TEXT,
    "enfoque" TEXT,
    "metodologia" TEXT,
    "horas" INTEGER,
    "objetivo" TEXT,
    "ambiente" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acciones_formacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoUbicacion" NOT NULL,
    "departamento" TEXT,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos" (
    "id" TEXT NOT NULL,
    "accionFormacionId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "modalidad" "Modalidad" NOT NULL,
    "sedeUbicacionId" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "horario" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_cobertura" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,
    "modalidad" "Modalidad" NOT NULL,
    "cuposBase" INTEGER NOT NULL,
    "cuposMaximos" INTEGER NOT NULL,

    CONSTRAINT "grupos_cobertura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertas" (
    "id" TEXT NOT NULL,
    "accionFormacionId" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,
    "modalidad" "Modalidad" NOT NULL,
    "cuposMaximos" INTEGER NOT NULL,
    "cuposOcupados" INTEGER NOT NULL DEFAULT 0,
    "abierta" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "digitoVerificacion" TEXT,
    "razonSocial" TEXT NOT NULL,
    "numeroColaboradores" INTEGER,
    "redAsociada" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ofertaId" TEXT NOT NULL,
    "cuposSolicitados" INTEGER NOT NULL,
    "cuposConfirmados" INTEGER NOT NULL DEFAULT 0,
    "cuposEnEspera" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'CONFIRMADA',
    "contactoNombre" TEXT NOT NULL,
    "contactoCorreo" TEXT NOT NULL,
    "contactoTelefono" TEXT,
    "contactoCargo" TEXT,
    "aceptaTerminos" BOOLEAN NOT NULL DEFAULT false,
    "aceptaPoliticaDatos" BOOLEAN NOT NULL DEFAULT false,
    "politicaDatosId" TEXT,
    "ipOrigen" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "canceladaEn" TIMESTAMP(3),

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_reserva" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "accion" "AccionMovimiento" NOT NULL,
    "confirmadosAntes" INTEGER NOT NULL,
    "confirmadosDespues" INTEGER NOT NULL,
    "enEsperaAntes" INTEGER NOT NULL,
    "enEsperaDespues" INTEGER NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "adminId" TEXT,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formularios" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formularios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preguntas" (
    "id" TEXT NOT NULL,
    "formularioId" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "ayuda" TEXT,
    "tipo" "TipoPregunta" NOT NULL,
    "obligatoria" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "campoNucleo" "CampoNucleo",
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opciones" (
    "id" TEXT NOT NULL,
    "preguntaId" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "archivada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "opciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuestas" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "preguntaId" TEXT NOT NULL,
    "etiquetaPregunta" TEXT NOT NULL,
    "valorTexto" TEXT,
    "valorNumero" INTEGER,
    "valorBooleano" BOOLEAN,
    "valoresSeleccion" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuestas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicas_datos" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),

    CONSTRAINT "politicas_datos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "administradores" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hashClave" TEXT NOT NULL,
    "rol" "RolAdmin" NOT NULL DEFAULT 'GESTOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administradores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "convenios_slug_key" ON "convenios"("slug");

-- CreateIndex
CREATE INDEX "acciones_formacion_convenioId_visible_orden_idx" ON "acciones_formacion"("convenioId", "visible", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "acciones_formacion_convenioId_codigo_key" ON "acciones_formacion"("convenioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_nombre_tipo_key" ON "ubicaciones"("nombre", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_accionFormacionId_numero_key" ON "grupos"("accionFormacionId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_cobertura_grupoId_ubicacionId_modalidad_key" ON "grupos_cobertura"("grupoId", "ubicacionId", "modalidad");

-- CreateIndex
CREATE INDEX "ofertas_accionFormacionId_idx" ON "ofertas"("accionFormacionId");

-- CreateIndex
CREATE UNIQUE INDEX "ofertas_accionFormacionId_ubicacionId_key" ON "ofertas"("accionFormacionId", "ubicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_nit_key" ON "empresas"("nit");

-- CreateIndex
CREATE INDEX "reservas_ofertaId_estado_idx" ON "reservas"("ofertaId", "estado");

-- CreateIndex
CREATE INDEX "reservas_contactoCorreo_idx" ON "reservas"("contactoCorreo");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_empresaId_ofertaId_key" ON "reservas"("empresaId", "ofertaId");

-- CreateIndex
CREATE INDEX "movimientos_reserva_reservaId_creadoEn_idx" ON "movimientos_reserva"("reservaId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "formularios_slug_key" ON "formularios"("slug");

-- CreateIndex
CREATE INDEX "preguntas_formularioId_orden_idx" ON "preguntas"("formularioId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "preguntas_formularioId_campoNucleo_key" ON "preguntas"("formularioId", "campoNucleo");

-- CreateIndex
CREATE INDEX "opciones_preguntaId_orden_idx" ON "opciones"("preguntaId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "opciones_preguntaId_valor_key" ON "opciones"("preguntaId", "valor");

-- CreateIndex
CREATE UNIQUE INDEX "respuestas_reservaId_preguntaId_key" ON "respuestas"("reservaId", "preguntaId");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_datos_convenioId_version_key" ON "politicas_datos"("convenioId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "administradores_correo_key" ON "administradores"("correo");

-- AddForeignKey
ALTER TABLE "acciones_formacion" ADD CONSTRAINT "acciones_formacion_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_accionFormacionId_fkey" FOREIGN KEY ("accionFormacionId") REFERENCES "acciones_formacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_sedeUbicacionId_fkey" FOREIGN KEY ("sedeUbicacionId") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_cobertura" ADD CONSTRAINT "grupos_cobertura_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_cobertura" ADD CONSTRAINT "grupos_cobertura_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_accionFormacionId_fkey" FOREIGN KEY ("accionFormacionId") REFERENCES "acciones_formacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "ofertas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_politicaDatosId_fkey" FOREIGN KEY ("politicaDatosId") REFERENCES "politicas_datos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_reserva" ADD CONSTRAINT "movimientos_reserva_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_reserva" ADD CONSTRAINT "movimientos_reserva_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formularios" ADD CONSTRAINT "formularios_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas" ADD CONSTRAINT "preguntas_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "formularios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opciones" ADD CONSTRAINT "opciones_preguntaId_fkey" FOREIGN KEY ("preguntaId") REFERENCES "preguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_preguntaId_fkey" FOREIGN KEY ("preguntaId") REFERENCES "preguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas_datos" ADD CONSTRAINT "politicas_datos_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariantes de cupos
--
-- Prisma no expresa CHECK en el schema, asi que van aqui a mano. Son la ultima
-- linea de defensa: aunque alguien escriba mal una consulta, o quite el lock,
-- o edite a mano desde psql, la base se niega a sobrevender.
-- ---------------------------------------------------------------------------

ALTER TABLE "ofertas"
  ADD CONSTRAINT "ofertas_cupos_dentro_del_tope"
  CHECK ("cuposOcupados" >= 0 AND "cuposOcupados" <= "cuposMaximos");

ALTER TABLE "ofertas"
  ADD CONSTRAINT "ofertas_tope_no_negativo"
  CHECK ("cuposMaximos" >= 0);

ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_cupos_no_negativos"
  CHECK ("cuposSolicitados" >= 0 AND "cuposConfirmados" >= 0 AND "cuposEnEspera" >= 0);

-- Una reserva no puede tener repartidos mas cupos de los que pidio. Es menor
-- o igual y no igual porque al cancelar los dos contadores bajan a cero pero
-- se conserva cuanto habia pedido.
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_reparto_coherente"
  CHECK ("cuposConfirmados" + "cuposEnEspera" <= "cuposSolicitados");

-- Una reserva cancelada no retiene cupos: si los retuviera, seguirian contando
-- en cuposOcupados y el cupo quedaria muerto, que es exactamente el fallo que
-- tiene hoy el Excel.
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_cancelada_sin_cupos"
  CHECK ("estado" <> 'CANCELADA' OR ("cuposConfirmados" = 0 AND "cuposEnEspera" = 0));
