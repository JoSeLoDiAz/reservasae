/**
 * GENTE QUE ENTRA HOY, PARA PODER PROBAR LOS FILTROS.
 *
 * «Hágalo con datos que fueran a hoy para saber que sí funciona esto
 * para todos los tableros» (cliente, 27 sep 2026). Y tiene razón: la
 * base de pruebas se sembró en agosto, así que poner el periodo en
 * «Hoy» devolvía cero en todas partes y no había forma de distinguir
 * un filtro que funciona de uno que no.
 *
 * QUÉ HACE. Reparte leads nuevos entre las acciones abiertas, con
 * `creadoEn` de HOY y de AYER, y certifica a unos cuantos hoy mismo
 * para que la ventana de ritmo de las dos proyecciones tenga algo
 * dentro. Nada más.
 *
 * SOLO EN LA BASE DE PRUEBAS. La guarda es la misma que la del resto
 * de semillas: si `DATABASE_URL` no dice «prueba», se planta.
 *
 * ES IDEMPOTENTE: los documentos van en un rango propio ---99.000.000
 * en adelante--- y se borra lo de ese rango antes de volver a sembrar.
 * Correrlo dos veces deja lo mismo que correrlo una.
 */

import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

/// El rango de documentos de esta semilla. Suyo y de nadie más.
const DESDE_DOCUMENTO = 99_000_000;
const CUANTOS = 60;

const HORAS_BOGOTA = 5;

/// La cédula de ciudadanía en el catálogo del SEP.
const TIPO_CEDULA = 1;

/** Medianoche de Bogotá de hace `hace` días, como instante. */
function diaDeBogota(hace: number): Date {
  const ahora = new Date();
  const enBogota = new Date(ahora.getTime() - HORAS_BOGOTA * 3600_000);
  const dia = enBogota.toISOString().slice(0, 10);
  const medianoche = new Date(`${dia}T05:00:00.000Z`);
  medianoche.setUTCDate(medianoche.getUTCDate() - hace);
  return medianoche;
}

/** Una hora de oficina dentro de ese día, para que no salgan todos iguales. */
function aLoLargoDelDia(dia: Date, i: number): Date {
  const f = new Date(dia.getTime());
  /// Entre las 8 y las 17 de Bogotá, que es cuando entra la gente.
  f.setUTCHours(13 + (i % 9), (i * 7) % 60, 0, 0);
  return f;
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/prueba/i.test(url)) {
    throw new Error(
      'Esta semilla SOLO corre contra la base de pruebas. ' +
        'La DATABASE_URL de ahora no dice «prueba», así que no toco nada.',
    );
  }

  /// Lo de una vuelta anterior, fuera. Se borra por el rango de
  /// documentos, que es solo suyo.
  const anteriores = await prisma.participante.findMany({
    where: {
      persona: {
        numeroDocumento: {
          gte: String(DESDE_DOCUMENTO),
          lt: String(DESDE_DOCUMENTO + 1_000_000),
        },
      },
    },
    select: { id: true, personaId: true },
  });
  if (anteriores.length > 0) {
    await prisma.movimientoParticipante.deleteMany({
      where: { participanteId: { in: anteriores.map((p) => p.id) } },
    });
    await prisma.participante.deleteMany({
      where: { id: { in: anteriores.map((p) => p.id) } },
    });
    await prisma.persona.deleteMany({
      where: { id: { in: [...new Set(anteriores.map((p) => p.personaId))] } },
    });
    console.log(`  limpiados ${anteriores.length} de la vuelta anterior`);
  }

  const acciones = await prisma.accionFormacion.findMany({
    where: { visible: true },
    select: { id: true, codigo: true, convenioId: true },
    orderBy: { orden: 'asc' },
  });
  if (acciones.length === 0) throw new Error('No hay acciones visibles que sembrar.');

  const hoy = diaDeBogota(0);
  const ayer = diaDeBogota(1);

  let creados = 0;
  let certificados = 0;

  for (let i = 0; i < CUANTOS; i++) {
    const accion = acciones[i % acciones.length];
    /// Dos tercios de hoy y un tercio de ayer: así «Hoy» y «Ayer»
    /// dan cifras DISTINTAS, que es lo que prueba que el filtro
    /// recorta de verdad y no solo que devuelve algo.
    const esDeHoy = i % 3 !== 0;
    const cuando = aLoLargoDelDia(esDeHoy ? hoy : ayer, i);
    const documento = String(DESDE_DOCUMENTO + i);

    const persona = await prisma.persona.create({
      data: {
        numeroDocumento: documento,
        /// 1 es la cédula de ciudadanía en el catálogo del SEP.
        tipoDocumentoSepId: TIPO_CEDULA,
        primerNombre: 'Prueba',
        primerApellido: `Del Día ${i + 1}`,
        correo: `prueba.hoy.${documento}@ejemplo.test`,
        celular: `30000${String(i).padStart(5, '0')}`,
      },
      select: { id: true },
    });

    /// Uno de cada cinco llega hasta certificado, para que la ventana
    /// de ritmo de las dos proyecciones tenga algo que medir.
    const certifica = i % 5 === 0;
    const etapa = certifica ? 'CERTIFICADO' : 'DATOS_COMPLETOS';

    const participante = await prisma.participante.create({
      data: {
        personaId: persona.id,
        convenioId: accion.convenioId,
        accionFormacionId: accion.id,
        etapa,
        creadoEn: cuando,
        actualizadoEn: cuando,
      },
      select: { id: true },
    });
    creados += 1;

    if (certifica) {
      /// El movimiento es lo que fecha la certificación: la etapa de
      /// hoy no lleva fecha pegada, y de aquí come el «ritmo» de las
      /// dos proyecciones.
      await prisma.movimientoParticipante.create({
        data: {
          participanteId: participante.id,
          etapaAntes: 'EN_FORMACION',
          etapaDespues: 'CERTIFICADO',
          creadoEn: cuando,
        },
      });
      certificados += 1;
    }
  }

  console.log(`\n  ${creados} leads nuevos: ${CUANTOS - Math.floor(CUANTOS / 3)} de hoy y el resto de ayer`);
  console.log(`  ${certificados} certificados con fecha de hoy o ayer`);
  console.log('\n  Ahora «Hoy» y «Ayer» dan cifras distintas en los tableros.');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
