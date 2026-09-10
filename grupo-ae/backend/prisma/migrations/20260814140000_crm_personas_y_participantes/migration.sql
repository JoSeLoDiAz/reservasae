-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'CE', 'TI', 'PA', 'PEP', 'PPT', 'RC', 'NIT', 'OTRO');

-- CreateEnum
CREATE TYPE "OrigenParticipante" AS ENUM ('EMPRESA', 'ASESOR', 'AUTOGESTION', 'REFERIDO', 'REDES', 'EVENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "EtapaParticipante" AS ENUM ('NUEVO', 'CONTACTADO', 'DATOS_COMPLETOS', 'MATRICULADO', 'EN_FORMACION', 'CERTIFICADO', 'PERDIDO', 'RETIRADO', 'NO_APROBO');

-- CreateEnum
CREATE TYPE "CanalAutorizacion" AS ENUM ('FORMULARIO_WEB', 'CARGA_EMPRESA', 'VERBAL_ASESOR', 'CORREO', 'PRESENCIAL');

-- CreateEnum
CREATE TYPE "RolConvenio" AS ENUM ('LIDER_INSCRIPCION', 'GESTOR_INSCRIPCION', 'LIDER_ACADEMICO', 'GESTOR_ACADEMICO', 'LIDER_SISTEMAS', 'CONSULTA');

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "primerNombre" TEXT NOT NULL,
    "segundoNombre" TEXT,
    "primerApellido" TEXT NOT NULL,
    "segundoApellido" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "sexo" TEXT,
    "correo" TEXT,
    "celular" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participantes" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "reservaId" TEXT,
    "ofertaId" TEXT,
    "accionFormacionId" TEXT,
    "coberturaId" TEXT,
    "etapa" "EtapaParticipante" NOT NULL DEFAULT 'NUEVO',
    "origen" "OrigenParticipante" NOT NULL DEFAULT 'ASESOR',
    "asesorId" TEXT,
    "cargoEnEmpresa" TEXT,
    "nivelEducativo" TEXT,
    "nivelOcupacional" TEXT,
    "porcentajeAsistencia" INTEGER,
    "notaFinal" DECIMAL(5,2),
    "fechaMatricula" TIMESTAMP(3),
    "fechaRetiro" TIMESTAMP(3),
    "motivoSalida" TEXT,
    "fechaCertificacion" TIMESTAMP(3),
    "cargadoEnSepEn" TIMESTAMP(3),
    "sobrecupoPorId" TEXT,
    "sobrecupoMotivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_participante" (
    "id" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "etapaAntes" "EtapaParticipante",
    "etapaDespues" "EtapaParticipante" NOT NULL,
    "motivo" TEXT,
    "adminId" TEXT,
    "nota" TEXT,
    "ip" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_participante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_participante" (
    "id" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "autorId" TEXT,
    "autorNombre" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_participante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autorizaciones_datos" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "politicaDatosId" TEXT NOT NULL,
    "canal" "CanalAutorizacion" NOT NULL,
    "otorgadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "evidencia" TEXT,
    "revocadaEn" TIMESTAMP(3),

    CONSTRAINT "autorizaciones_datos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_convenio" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "rol" "RolConvenio" NOT NULL,
    "otorgadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_convenio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personas_primerApellido_primerNombre_idx" ON "personas"("primerApellido", "primerNombre");

-- CreateIndex
CREATE INDEX "personas_correo_idx" ON "personas"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "personas_tipoDocumento_numeroDocumento_key" ON "personas"("tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE INDEX "participantes_convenioId_etapa_idx" ON "participantes"("convenioId", "etapa");

-- CreateIndex
CREATE INDEX "participantes_ofertaId_etapa_idx" ON "participantes"("ofertaId", "etapa");

-- CreateIndex
CREATE INDEX "participantes_coberturaId_etapa_idx" ON "participantes"("coberturaId", "etapa");

-- CreateIndex
CREATE INDEX "participantes_asesorId_etapa_idx" ON "participantes"("asesorId", "etapa");

-- CreateIndex
CREATE INDEX "participantes_reservaId_idx" ON "participantes"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "participantes_accionFormacionId_personaId_key" ON "participantes"("accionFormacionId", "personaId");

-- CreateIndex
CREATE INDEX "movimientos_participante_participanteId_creadoEn_idx" ON "movimientos_participante"("participanteId", "creadoEn");

-- CreateIndex
CREATE INDEX "movimientos_participante_creadoEn_idx" ON "movimientos_participante"("creadoEn");

-- CreateIndex
CREATE INDEX "notas_participante_participanteId_creadoEn_idx" ON "notas_participante"("participanteId", "creadoEn");

-- CreateIndex
CREATE INDEX "autorizaciones_datos_personaId_revocadaEn_idx" ON "autorizaciones_datos"("personaId", "revocadaEn");

-- CreateIndex
CREATE INDEX "admin_convenio_convenioId_rol_idx" ON "admin_convenio"("convenioId", "rol");

-- CreateIndex
CREATE UNIQUE INDEX "admin_convenio_adminId_convenioId_rol_key" ON "admin_convenio"("adminId", "convenioId", "rol");

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "ofertas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_accionFormacionId_fkey" FOREIGN KEY ("accionFormacionId") REFERENCES "acciones_formacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_coberturaId_fkey" FOREIGN KEY ("coberturaId") REFERENCES "grupos_cobertura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_sobrecupoPorId_fkey" FOREIGN KEY ("sobrecupoPorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_participante" ADD CONSTRAINT "movimientos_participante_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_participante" ADD CONSTRAINT "movimientos_participante_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_participante" ADD CONSTRAINT "notas_participante_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_participante" ADD CONSTRAINT "notas_participante_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "administradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorizaciones_datos" ADD CONSTRAINT "autorizaciones_datos_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorizaciones_datos" ADD CONSTRAINT "autorizaciones_datos_politicaDatosId_fkey" FOREIGN KEY ("politicaDatosId") REFERENCES "politicas_datos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_convenio" ADD CONSTRAINT "admin_convenio_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "administradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_convenio" ADD CONSTRAINT "admin_convenio_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- la asistencia es un porcentaje
ALTER TABLE "participantes"
  ADD CONSTRAINT "participantes_asistencia_valida"
  CHECK ("porcentajeAsistencia" IS NULL OR ("porcentajeAsistencia" BETWEEN 0 AND 100));

-- una nota negativa no significa nada
ALTER TABLE "participantes"
  ADD CONSTRAINT "participantes_nota_valida"
  CHECK ("notaFinal" IS NULL OR "notaFinal" >= 0);

-- un sobrecupo sin motivo no es una autorizacion
ALTER TABLE "participantes"
  ADD CONSTRAINT "participantes_sobrecupo_justificado"
  CHECK (("sobrecupoPorId" IS NULL) = ("sobrecupoMotivo" IS NULL));

-- retirarse deja fecha
ALTER TABLE "participantes"
  ADD CONSTRAINT "participantes_retiro_fechado"
  CHECK ("etapa" <> 'RETIRADO' OR "fechaRetiro" IS NOT NULL);
