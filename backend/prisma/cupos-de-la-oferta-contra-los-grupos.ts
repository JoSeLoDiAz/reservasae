/**
 * ¿DICEN LO MISMO LOS CUPOS DE LA OFERTA Y LOS DE SUS GRUPOS?
 *
 * «Hay que revisar esto urgente, parece cerrado» (7 oct 2026), sobre
 * el formulario público enseñando «Disponibilidad: 0 cupos» en AF1
 * para Medellín, mientras la tabla del comité decía 419 cupos libres
 * en esa misma acción.
 *
 * Las dos cifras salen de sitios distintos y nada las obliga a
 * cuadrar:
 *
 *   - lo que el formulario PÚBLICO ofrece sale de `Oferta`
 *     ---`cuposMaximos` por acción y ubicación, puesto a mano---;
 *   - lo que la tabla del comité cuenta sale de las COBERTURAS de los
 *     grupos, que es lo que trae el cronograma.
 *
 * Mientras el cronograma no se importe, el segundo se mueve y el
 * primero no. Una oferta con menos cupos que sus grupos cierra la
 * puerta a gente que sí cabe; al revés, promete plazas que no existen.
 *
 * SOLO LEE. No escribe nada, ni con argumentos.
 *
 *   pnpm ts-node prisma/cupos-de-la-oferta-contra-los-grupos.ts
 */

import { PrismaClient } from '../generated/prisma';
import { OCUPAN_SILLA } from '../src/crm/etapas';

const prisma = new PrismaClient();

/// Cuántas filas se enseñan. Las peores primero.
const CUANTAS = 20;

async function main() {
  console.log('\n═══ CUPOS: LA OFERTA CONTRA SUS GRUPOS ═══\n');

  const ofertas = await prisma.oferta.findMany({
    where: { abierta: true },
    select: {
      id: true,
      cuposMaximos: true,
      cuposOcupados: true,
      ubicacionId: true,
      ubicacion: { select: { nombre: true } },
      accionFormacion: { select: { id: true, codigo: true } },
    },
  });

  /// Lo que los grupos declaran para esa acción en esa ubicación.
  const coberturas = await prisma.grupoCobertura.groupBy({
    by: ['ubicacionId'],
    _sum: { cuposMaximos: true },
  });

  /// Por acción y ubicación, que es como se parea con la oferta.
  const porGrupo = await prisma.grupoCobertura.findMany({
    select: {
      ubicacionId: true,
      cuposMaximos: true,
      grupo: { select: { accionFormacionId: true } },
    },
  });
  const deLosGrupos = new Map<string, number>();
  for (const c of porGrupo) {
    const llave = `${c.grupo.accionFormacionId}|${c.ubicacionId}`;
    deLosGrupos.set(llave, (deLosGrupos.get(llave) ?? 0) + c.cuposMaximos);
  }

  /// Y cuánta gente hay dentro por cada oferta, con la MISMA regla que
  /// usa el formulario: quien vino por una reserva ya está contado en
  /// `cuposOcupados`.
  const sueltos = await prisma.participante.groupBy({
    by: ['ofertaId'],
    where: {
      ofertaId: { in: ofertas.map((o) => o.id) },
      reservaId: null,
      etapa: { in: OCUPAN_SILLA },
    },
    _count: { _all: true },
  });
  const porSuCuenta = new Map(
    sueltos.map((s) => [s.ofertaId ?? '', s._count._all]),
  );

  const filas = ofertas.map((o) => {
    const grupos = deLosGrupos.get(
      `${o.accionFormacion?.id}|${o.ubicacionId}`,
    );
    const dentro = o.cuposOcupados + (porSuCuenta.get(o.id) ?? 0);
    return {
      que: `${o.accionFormacion?.codigo ?? '?'} · ${o.ubicacion?.nombre ?? '?'}`,
      oferta: o.cuposMaximos,
      grupos: grupos ?? null,
      dentro,
      libresSegunLaOferta: o.cuposMaximos - dentro,
      libresSegunLosGrupos: grupos === undefined ? null : grupos - dentro,
    };
  });

  /// Lo que importa: dónde el formulario dice que no hay y los grupos
  /// dicen que sí.
  const cerradasDeMentira = filas.filter(
    (f) =>
      f.libresSegunLaOferta <= 0 &&
      f.libresSegunLosGrupos !== null &&
      f.libresSegunLosGrupos > 0,
  );

  console.log(
    `  Ofertas abiertas: ${filas.length}` +
      `\n  Cerradas al público TENIENDO cupo en sus grupos: ${cerradasDeMentira.length}\n`,
  );
  for (const f of cerradasDeMentira.slice(0, CUANTAS)) {
    console.log(
      `    ${f.que.padEnd(34)} oferta ${String(f.oferta).padStart(4)}  grupos ${String(f.grupos).padStart(4)}  dentro ${String(f.dentro).padStart(4)}  libres segun grupos ${f.libresSegunLosGrupos}`,
    );
  }

  /// Y el caso contrario, que promete lo que no hay.
  const prometenDeMas = filas.filter(
    (f) =>
      f.libresSegunLosGrupos !== null &&
      f.libresSegunLaOferta > f.libresSegunLosGrupos,
  );
  console.log(
    `\n  Ofertas que ofrecen MÁS de lo que sus grupos aguantan: ${prometenDeMas.length}\n`,
  );
  for (const f of prometenDeMas.slice(0, CUANTAS)) {
    console.log(
      `    ${f.que.padEnd(34)} oferta ofrece ${String(f.libresSegunLaOferta).padStart(4)}  grupos aguantan ${f.libresSegunLosGrupos}`,
    );
  }

  /// Y una muestra pase lo que pase: una salida de puros ceros no
  /// distingue «todo cuadra» de «no se comparo nada».
  console.log(`
  Muestra de lo comparado:
`);
  for (const f of filas.slice(0, 3)) {
    const g = f.grupos === null ? `sin grupos` : String(f.grupos);
    console.log(
      `    ${f.que.padEnd(34)} oferta ${String(f.oferta).padStart(4)}  grupos ${g.padStart(10)}  dentro ${String(f.dentro).padStart(4)}`,
    );
  }

  const sinGrupos = filas.filter((f) => f.grupos === null);
  if (sinGrupos.length) {
    console.log(
      `\n  Y sin grupos en esa ubicación, así que no hay con qué comparar: ${sinGrupos.length}`,
    );
    for (const f of sinGrupos.slice(0, 5)) console.log(`    ${f.que}`);
  }

  console.log(
    '\n  Esto NO se arregla a mano fila por fila: lo que mantiene los dos' +
      '\n  números iguales es importar el cronograma, que es de donde salen' +
      '\n  los grupos y sus cupos.\n',
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
