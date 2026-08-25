/** Prueba el conflicto asesor / interesado. */

/// Lo que se comprueba: que si el asesor no toco, lo del
/// interesado entra directo; que si toco, no pisa nada y
/// queda esperando; y que al resolver entra solo lo que el
/// asesor acepto.

import { PrismaClient } from '../generated/prisma';
import { PrismaService } from '../src/prisma/prisma.service';
import { PreinscripcionService } from '../src/preinscripcion/preinscripcion.service';

const prisma = new PrismaClient();
let fallos = 0;

function comprobar(que: string, bien: boolean, detalle = '') {
  if (!bien) fallos += 1;
  console.log(`  ${bien ? 'OK  ' : 'FALLA'}  ${que}${detalle ? ` — ${detalle}` : ''}`);
}

/// Con contador propio y borrando los de la corrida
/// anterior: si no, el script solo se puede correr una vez
/// y una prueba que no se repite no sirve de red.
async function enlaceNuevo(participanteId: string): Promise<string> {
  const token = `prueba-${participanteId.slice(-6)}-${await siguiente()}`;
  await prisma.enlaceCompletado.create({
    data: {
      token,
      participanteId,
      expiraEn: new Date(Date.now() + 86_400_000),
    },
  });
  return token;
}

let n = 0;
async function siguiente() {
  n += 1;
  return n;
}

async function main() {
  console.log('\n=== CONFLICTO ASESOR / INTERESADO ===\n');

  const servicio = new PreinscripcionService(prisma as unknown as PrismaService);

  const p = await prisma.participante.findFirst({
    orderBy: { creadoEn: 'asc' },
    select: { id: true, personaId: true },
  });
  if (!p) {
    console.log('  Hacen falta participantes. Corre db:sembrar-prueba.');
    process.exitCode = 1;
    return;
  }

  // punto de partida limpio
  await prisma.enlaceCompletado.deleteMany({
    where: { participanteId: p.id, token: { startsWith: 'prueba-' } },
  });
  await prisma.propuestaDeDatos.deleteMany({ where: { participanteId: p.id } });
  await prisma.participante.update({
    where: { id: p.id },
    data: { datosTocadosPorAsesorEn: null },
  });
  await prisma.persona.update({
    where: { id: p.personaId },
    data: { barrio: 'BARRIO VIEJO', direccion: 'CALLE VIEJA 1' },
  });

  // ── 1. el asesor NO ha tocado: entra directo ──
  console.log('El asesor no ha tocado la ficha');
  const t1 = await enlaceNuevo(p.id);
  const r1 = await servicio.guardarPersona(t1, {
    barrio: 'BARRIO NUEVO',
    direccion: 'CARRERA NUEVA 2',
  } as never);

  const tras1 = await prisma.persona.findUnique({
    where: { id: p.personaId },
    select: { barrio: true, direccion: true },
  });

  comprobar('se guarda sin esperar', r1.enEspera === false);
  comprobar('el barrio se escribio', tras1?.barrio === 'BARRIO NUEVO', tras1?.barrio ?? '');
  comprobar(
    'no queda ninguna propuesta',
    (await prisma.propuestaDeDatos.count({ where: { participanteId: p.id } })) === 0,
  );

  // ── 2. el asesor SI toco: no pisa ──
  console.log('\nEl asesor ya tocó la ficha');
  await prisma.participante.update({
    where: { id: p.id },
    data: { datosTocadosPorAsesorEn: new Date() },
  });
  await prisma.persona.update({
    where: { id: p.personaId },
    data: { barrio: 'EL QUE PUSO EL ASESOR', direccion: 'LA DEL ASESOR' },
  });

  const t2 = await enlaceNuevo(p.id);
  const r2 = await servicio.guardarPersona(t2, {
    barrio: 'EL QUE MANDO EL INTERESADO',
    direccion: 'LA DEL INTERESADO',
  } as never);

  const tras2 = await prisma.persona.findUnique({
    where: { id: p.personaId },
    select: { barrio: true, direccion: true },
  });

  comprobar('se marca en espera', r2.enEspera === true);
  comprobar(
    'NO se pisa lo del asesor',
    tras2?.barrio === 'EL QUE PUSO EL ASESOR',
    tras2?.barrio ?? '',
  );

  const propuesta = await prisma.propuestaDeDatos.findFirst({
    where: { participanteId: p.id, estado: 'PENDIENTE' },
  });
  comprobar('queda una propuesta pendiente', propuesta !== null);

  const campos = (propuesta?.campos ?? {}) as Record<string, unknown>;
  comprobar(
    'la propuesta trae los dos campos',
    Object.keys(campos).length === 2,
    Object.keys(campos).join(', '),
  );
  comprobar(
    'y trae lo que mando el interesado',
    campos.barrio === 'EL QUE MANDO EL INTERESADO',
  );

  // ── 3. lo que llega igual no propone nada ──
  console.log('\nLo que llega igual a lo que hay');
  await prisma.propuestaDeDatos.deleteMany({ where: { participanteId: p.id } });
  const t3 = await enlaceNuevo(p.id);
  await servicio.guardarPersona(t3, { barrio: 'EL QUE PUSO EL ASESOR' } as never);
  comprobar(
    'no se crea propuesta por un valor identico',
    (await prisma.propuestaDeDatos.count({ where: { participanteId: p.id } })) === 0,
  );

  // ── 4. solo una pendiente a la vez ──
  console.log('\nDos envíos seguidos del interesado');
  const t4 = await enlaceNuevo(p.id);
  await servicio.guardarPersona(t4, { barrio: 'PRIMER INTENTO' } as never);
  const t5 = await enlaceNuevo(p.id);
  await servicio.guardarPersona(t5, { barrio: 'SEGUNDO INTENTO' } as never);

  const pendientes = await prisma.propuestaDeDatos.findMany({
    where: { participanteId: p.id, estado: 'PENDIENTE' },
  });
  comprobar('solo queda una pendiente', pendientes.length === 1, `${pendientes.length}`);
  comprobar(
    'y es la ultima que mando',
    (pendientes[0]?.campos as Record<string, unknown>)?.barrio === 'SEGUNDO INTENTO',
  );

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
