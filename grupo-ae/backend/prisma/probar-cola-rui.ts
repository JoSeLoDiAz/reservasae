/** Prueba la cola del RUI contra Postgres de verdad. */

/// SKIP LOCKED no se puede probar con un mock: o hay dos
/// conexiones peleando por la misma fila, o no se prueba
/// nada. Por eso esto es un script y no un test de jest.

import { PrismaClient } from '../generated/prisma';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProveedorRuiLocal } from '../src/crm/rui/proveedor';
import { ColaRui } from '../src/crm/rui/cola-rui';
import { RuiService } from '../src/crm/rui/rui.service';

const prisma = new PrismaClient();

let fallos = 0;

function comprobar(que: string, bien: boolean, detalle = '') {
  const marca = bien ? 'OK  ' : 'FALLA';
  if (!bien) fallos += 1;
  console.log(`  ${marca}  ${que}${detalle ? ` — ${detalle}` : ''}`);
}

async function main() {
  console.log('\n=== COLA DEL RUI ===\n');

  // el proveedor local sin demora, para no esperar
  const servicio = new RuiService(
    prisma as unknown as PrismaService,
    new ColaRui(prisma as unknown as PrismaService),
    { registrar: async () => undefined } as never,
    new ProveedorRuiLocal(0),
  );

  const personas = await prisma.persona.findMany({
    take: 12,
    orderBy: { creadoEn: 'asc' },
    select: { id: true, numeroDocumento: true, primerNombre: true, primerApellido: true },
  });

  if (personas.length < 6) {
    console.log('  Hacen falta personas sembradas. Corre db:sembrar-prueba.');
    process.exitCode = 1;
    return;
  }

  // limpio lo de corridas anteriores
  await prisma.consultaRui.deleteMany({
    where: { personaId: { in: personas.map((p) => p.id) } },
  });

  // ── encolar ──
  console.log('Encolar');
  for (const p of personas) await servicio.encolar(p.id);

  const encoladas = await prisma.consultaRui.count({
    where: { personaId: { in: personas.map((p) => p.id) }, estado: 'PENDIENTE' },
  });
  comprobar('se encolan todas', encoladas === personas.length, `${encoladas}/${personas.length}`);

  // ── no se duplica ──
  await servicio.encolar(personas[0].id);
  const delPrimero = await prisma.consultaRui.count({
    where: { personaId: personas[0].id },
  });
  comprobar('encolar dos veces no duplica', delPrimero === 1, `${delPrimero} fila(s)`);

  // ── prioridad ──
  console.log('\nPrioridad');
  const ultimo = personas[personas.length - 1];
  await servicio.priorizar(ultimo.id);

  const siguiente = await servicio.tomarSiguiente();
  const suya = await prisma.consultaRui.findFirst({ where: { personaId: ultimo.id } });
  comprobar(
    'el priorizado sale primero aunque llegara último',
    siguiente?.id === suya?.id,
  );

  // lo devuelvo a la cola para el resto de la prueba
  if (siguiente) {
    await prisma.consultaRui.update({
      where: { id: siguiente.id },
      data: { estado: 'PENDIENTE', intentos: 0, prioridad: 0 },
    });
  }

  // ── SKIP LOCKED: dos workers no se pisan ──
  console.log('\nDos workers a la vez');
  const otro = new PrismaClient();
  const servicioB = new RuiService(
    otro as unknown as PrismaService,
    new ColaRui(otro as unknown as PrismaService),
    { registrar: async () => undefined } as never,
    new ProveedorRuiLocal(0),
  );

  const [a, b] = await Promise.all([
    servicio.tomarSiguiente(),
    servicioB.tomarSiguiente(),
  ]);

  comprobar('los dos consiguen trabajo', a !== null && b !== null);
  // por la cola, no por el prefijo: los cuid lo comparten
  comprobar('y no es el mismo', a?.id !== b?.id, `…${a?.id?.slice(-6)} vs …${b?.id?.slice(-6)}`);

  await otro.$disconnect();

  // los devuelvo a la cola
  for (const t of [a, b]) {
    if (t) {
      await prisma.consultaRui.update({
        where: { id: t.id },
        data: { estado: 'PENDIENTE', intentos: 0 },
      });
    }
  }

  // ── vaciar la cola ──
  console.log('\nVaciar la cola');
  let vueltas = 0;
  while (await servicio.procesarUna()) {
    vueltas += 1;
    if (vueltas > 100) break;
  }

  const resumen = await servicio.resumen();
  console.log(
    `  procesadas ${vueltas} · listas ${resumen.listas} · ` +
      `sin resultado ${resumen.sinResultado} · fallidas ${resumen.fallidas}`,
  );
  comprobar('no queda nada pendiente', resumen.pendientes === 0, `${resumen.pendientes}`);
  comprobar('ninguna se queda EN_CURSO', resumen.enCurso === 0, `${resumen.enCurso}`);

  // ── el reintento ──
  const fallidas = await prisma.consultaRui.findMany({
    where: { personaId: { in: personas.map((p) => p.id) }, estado: 'FALLIDA' },
    select: { intentos: true },
  });
  if (fallidas.length) {
    comprobar(
      'las fallidas se rindieron tras 3 intentos',
      fallidas.every((f) => f.intentos >= 3),
      `intentos: ${fallidas.map((f) => f.intentos).join(', ')}`,
    );
  } else {
    console.log('  (ninguna falló en esta tanda)');
  }

  // ── comparación de nombres ──
  console.log('\nComparación de nombres');
  const listas = await prisma.consultaRui.findMany({
    where: { personaId: { in: personas.map((p) => p.id) }, estado: 'LISTA' },
    select: { nombreTecleado: true, nombreEncontrado: true, nombreCoincide: true },
  });
  comprobar(
    'toda LISTA trae veredicto',
    listas.every((l) => l.nombreCoincide !== null),
  );
  const distintas = listas.filter((l) => l.nombreCoincide === false).length;
  console.log(`  ${distintas} de ${listas.length} no coinciden (el proveedor local inventa nombres)`);

  // ── estado para la ficha ──
  console.log('\nEstado para la ficha');
  const estado = await servicio.estadoDe(personas[0].id);
  comprobar('la ficha sabe en qué va', estado.estado !== 'SIN_CONSULTA', estado.estado);

  console.log(
    fallos === 0 ? '\n=== TODO BIEN ===\n' : `\n=== ${fallos} COMPROBACIONES FALLAN ===\n`,
  );
  if (fallos) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
