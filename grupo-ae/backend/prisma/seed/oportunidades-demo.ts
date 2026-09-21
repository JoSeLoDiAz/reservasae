/** Negocios inventados para ver el embudo con algo dentro. */

/**
 * Un tablero vacío no se puede juzgar: no se ve si las columnas
 * respiran, si el dinero cabe en la tarjeta ni si el reloj de
 * respuesta salta cuando debe. Esta siembra deja el embudo en un
 * estado creíble de martes por la mañana.
 *
 * A propósito NO deja todo bonito: hay dos sin dueño esperando
 * respuesta —una de ellas pasada de los cinco minutos— y una
 * quieta hace once días. Sembrar solo casos felices es como se
 * llega a paneles que en producción se ven por primera vez rotos.
 */

import { EtapaOportunidad, PrismaClient, TipoEmbudo } from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';
import { soloEnPruebas } from './solo-pruebas';

exigirBaseSegura('Sembrar oportunidades');
soloEnPruebas('db:sembrar-oportunidades');

const prisma = new PrismaClient();

/// Hace N minutos, para poder fabricar esperas.
const haceMinutos = (n: number) => new Date(Date.now() - n * 60_000);
const haceDias = (n: number) => new Date(Date.now() - n * 86_400_000);
const enDias = (n: number) => new Date(Date.now() + n * 86_400_000);

type Semilla = {
  titulo: string;
  embudo: TipoEmbudo;
  etapa: EtapaOportunidad;
  valor: number;
  campana?: string;
  /// Minutos que lleva creada.
  edad: number;
  /// Minutos que tardó la primera respuesta. Null: nadie contestó.
  respondida: number | null;
  quieta?: number;
  cierre?: number;
  conAsesor?: boolean;
};

/// Los títulos dicen QUÉ se vende y no a quién: la empresa o la
/// persona se la reparte la siembra por turno, y un título con
/// «· Hoteles Costa» colgado de otra empresa era una demo que se
/// contradecía sola (QA, 17 sep 2026).
const SEMILLAS: Semilla[] = [
  // ── esperando respuesta: lo que el reloj vigila ──────────────
  {
    titulo: 'Google Workspace Business Standard · 40 usuarios',
    embudo: TipoEmbudo.EMPRESA,
    etapa: EtapaOportunidad.CAPTADO,
    valor: 0,
    campana: 'Meta · Workspace pymes',
    edad: 47,
    respondida: null,
    conAsesor: false,
  },
  {
    titulo: 'Curso de Gemini en el día a día',
    embudo: TipoEmbudo.PERSONA,
    etapa: EtapaOportunidad.CAPTADO,
    valor: 0,
    campana: 'Instagram · Cursos Google',
    edad: 3,
    respondida: null,
    conAsesor: false,
  },

  // ── el embudo de empresas, con peso ─────────────────────────
  {
    titulo: 'Migración a Google Workspace',
    embudo: TipoEmbudo.EMPRESA,
    etapa: EtapaOportunidad.CONTACTADO,
    valor: 8_400_000,
    campana: 'Referido',
    edad: 60 * 30,
    respondida: 4,
    cierre: 45,
  },
  {
    titulo: 'Renovación anual Workspace Business Plus',
    embudo: TipoEmbudo.EMPRESA,
    etapa: EtapaOportunidad.CALIFICADO,
    valor: 22_000_000,
    campana: 'LinkedIn · Workspace',
    edad: 60 * 24 * 6,
    respondida: 12,
    cierre: 30,
  },
  {
    titulo: 'Chromebooks para el aula',
    embudo: TipoEmbudo.EMPRESA,
    etapa: EtapaOportunidad.PROPUESTA_ENVIADA,
    valor: 46_500_000,
    campana: 'Evento educación',
    edad: 60 * 24 * 12,
    respondida: 7,
    cierre: 21,
  },
  {
    titulo: 'Gemini Enterprise para el equipo directivo',
    embudo: TipoEmbudo.EMPRESA,
    etapa: EtapaOportunidad.EN_NEGOCIACION,
    valor: 31_800_000,
    campana: 'Referido',
    edad: 60 * 24 * 20,
    respondida: 22,
    cierre: 10,
  },
  {
    titulo: 'Workspace Enterprise Standard con soporte',
    embudo: TipoEmbudo.EMPRESA,
    etapa: EtapaOportunidad.CALIFICADO,
    valor: 14_200_000,
    edad: 60 * 24 * 14,
    respondida: 90,
    /// La que lleva once días sin que nadie la toque.
    quieta: 11,
    cierre: 60,
  },
  {
    titulo: 'Soporte y administración de Workspace',
    embudo: TipoEmbudo.EMPRESA,
    etapa: EtapaOportunidad.GANADO,
    valor: 18_900_000,
    campana: 'Meta · Soporte',
    edad: 60 * 24 * 40,
    respondida: 3,
  },
  {
    titulo: 'Google Workspace Starter',
    embudo: TipoEmbudo.EMPRESA,
    etapa: EtapaOportunidad.PERDIDO,
    valor: 9_600_000,
    campana: 'LinkedIn · Workspace pymes',
    edad: 60 * 24 * 55,
    respondida: 180,
  },

  // ── el de personas: más corto y más rápido ──────────────────
  {
    titulo: 'Curso de Google Workspace',
    embudo: TipoEmbudo.PERSONA,
    etapa: EtapaOportunidad.CONTACTADO,
    valor: 780_000,
    campana: 'Instagram · Cursos Google',
    edad: 60 * 20,
    respondida: 2,
    cierre: 7,
  },
  {
    titulo: 'Chromebook para estudiar',
    embudo: TipoEmbudo.PERSONA,
    etapa: EtapaOportunidad.CALIFICADO,
    valor: 1_450_000,
    campana: 'Meta · Chromebooks',
    edad: 60 * 24 * 3,
    respondida: 6,
    cierre: 5,
  },
  {
    titulo: 'Curso de Gemini',
    embudo: TipoEmbudo.PERSONA,
    etapa: EtapaOportunidad.GANADO,
    valor: 320_000,
    campana: 'WhatsApp',
    edad: 60 * 24 * 9,
    respondida: 1,
  },
];

/// Las mismas que usa el embudo. Se copian aquí y no se importan
/// del backend para que la siembra no arrastre medio Nest.
const PROBABILIDAD: Record<TipoEmbudo, Partial<Record<EtapaOportunidad, number>>> = {
  EMPRESA: { CAPTADO: 5, CONTACTADO: 15, CALIFICADO: 30, PROPUESTA_ENVIADA: 50, EN_NEGOCIACION: 70, GANADO: 100, PERDIDO: 0 },
  PERSONA: { CAPTADO: 10, CONTACTADO: 30, CALIFICADO: 55, GANADO: 100, PERDIDO: 0 },
};

/**
 * POR QUÉ PUERTA ENTRÓ CADA NEGOCIO.
 *
 * `Oportunidad` no tiene `formularioId`: guarda `campana`, una
 * cadena libre, y la única forma de saber por qué formulario
 * entró un negocio es la convención de
 * `frontend/src/lib/enlace-de-campana.ts` — el enlace que se
 * reparte se marca `<slug de la puerta>/<anuncio>`.
 *
 * La siembra escribía «Meta · Seguridad industrial» a secas, sin
 * puerta delante, y entonces la pantalla de Formularios contaba
 * cero: la cuenta era correcta y el dato no la ejercitaba. Con la
 * puerta puesta, la frase que pidió el dueño —«esta puerta ha
 * traído N negocios que valen X»— se ve en la demo.
 *
 * Los dos slugs son los de los formularios publicados que siembra
 * `formularios.ts`, y son los mismos dos embudos: el de empresas
 * y el de personas.
 */
const PUERTA: Record<TipoEmbudo, string> = {
  [TipoEmbudo.EMPRESA]: 'empresas',
  [TipoEmbudo.PERSONA]: 'personas',
};

const marcaDe = (s: Semilla) =>
  s.campana ? `${PUERTA[s.embudo]}/${s.campana}` : PUERTA[s.embudo];

async function main() {
  const convenio = await prisma.convenio.findFirst({ where: { activo: true } });
  if (!convenio) {
    console.error('No hay convenio activo. Corra antes `pnpm exec prisma db seed`.');
    process.exit(1);
  }

  const asesores = await prisma.admin.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    take: 4,
  });
  if (asesores.length === 0) {
    console.error('No hay cuentas. Corra antes `pnpm db:crear-admin`.');
    process.exit(1);
  }

  const empresas = await prisma.empresa.findMany({ select: { id: true }, take: 8 });
  const personas = await prisma.persona.findMany({ select: { id: true }, take: 8 });

  /// Se borran las de la siembra anterior por el prefijo del
  /// codigo. Sin filtro se llevaria por delante lo que alguien
  /// hubiera creado a mano probando.
  const previas = await prisma.oportunidad.deleteMany({
    where: { codigo: { startsWith: 'OP-DEMO-' } },
  });

  let n = 0;
  for (const s of SEMILLAS) {
    n += 1;
    const creadoEn = haceMinutos(s.edad);
    const asesor = s.conAsesor === false ? null : asesores[n % asesores.length];
    const esEmpresa = s.embudo === TipoEmbudo.EMPRESA;

    const o = await prisma.oportunidad.create({
      data: {
        codigo: `OP-DEMO-${String(n).padStart(3, '0')}`,
        convenioId: convenio.id,
        embudo: s.embudo,
        etapa: s.etapa,
        titulo: s.titulo,
        valor: s.valor,
        probabilidad: PROBABILIDAD[s.embudo][s.etapa] ?? 0,
        cierreEsperado: s.cierre ? enDias(s.cierre) : null,
        asesorId: asesor?.id ?? null,
        empresaId: esEmpresa ? (empresas[n % Math.max(1, empresas.length)]?.id ?? null) : null,
        personaId: !esEmpresa ? (personas[n % Math.max(1, personas.length)]?.id ?? null) : null,
        campana: marcaDe(s),
        creadoEn,
        primeraRespuestaEn: s.respondida === null ? null : haceMinutos(s.edad - s.respondida),
        minutosPrimeraRespuesta: s.respondida,
        ultimoToqueEn: s.quieta ? haceDias(s.quieta) : haceMinutos(Math.min(s.edad, 60 * 24)),
        cerradaEn:
          s.etapa === EtapaOportunidad.GANADO || s.etapa === EtapaOportunidad.PERDIDO
            ? haceMinutos(Math.floor(s.edad / 2))
            : null,
        motivoCierre:
          s.etapa === EtapaOportunidad.GANADO
            ? 'PRECIO_ACEPTADO'
            : s.etapa === EtapaOportunidad.PERDIDO
              ? 'SE_FUE_CON_OTRO'
              : null,
      },
    });

    await prisma.movimientoOportunidad.create({
      data: {
        oportunidadId: o.id,
        de: null,
        a: s.etapa,
        nota: 'Sembrada para pruebas',
        adminId: asesor?.id ?? null,
        actorNombre: asesor?.nombre ?? 'Siembra',
      },
    });
  }

  const sinContestar = SEMILLAS.filter((s) => s.respondida === null).length;
  const tarde = SEMILLAS.filter((s) => s.respondida === null && s.edad >= 5).length;

  console.log('');
  if (previas.count > 0) console.log(`  ${previas.count} de la siembra anterior, borradas`);
  console.log(`  ${SEMILLAS.length} oportunidades sembradas`);
  console.log(`  ${sinContestar} esperando primera respuesta (${tarde} pasada de los 5 min)`);
  console.log('  1 lleva 11 dias sin que nadie la toque');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
