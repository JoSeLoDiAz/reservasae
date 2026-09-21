-- CreateTable
CREATE TABLE "parametros_del_tablero" (
    "id" TEXT NOT NULL DEFAULT 'unico',
    "ansPersonaMinutos" INTEGER NOT NULL DEFAULT 5,
    "ansEmpresaMinutos" INTEGER NOT NULL DEFAULT 1440,
    "bananeoPersona" INTEGER NOT NULL DEFAULT 3,
    "bananeoEmpresa" INTEGER NOT NULL DEFAULT 3,
    "diasParaFria" INTEGER NOT NULL DEFAULT 7,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoPorId" TEXT,

    CONSTRAINT "parametros_del_tablero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "probabilidades_de_etapa" (
    "id" TEXT NOT NULL,
    "embudo" "TipoEmbudo" NOT NULL,
    "etapa" "EtapaOportunidad" NOT NULL,
    "porcentaje" INTEGER NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "probabilidades_de_etapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "probabilidades_de_etapa_embudo_etapa_key" ON "probabilidades_de_etapa"("embudo", "etapa");

