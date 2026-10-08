/**
 * ¿DICE EL PANEL LO QUE DICE LA BASE?
 *
 * «Cada vez que me dices que sí ya no creo» (cliente, 7 oct 2026).
 *
 * Y lleva razón en desconfiar de lo que le he enseñado hasta ahora:
 * todas mis comprobaciones miraban si una cifra SE MUEVE al cambiar el
 * periodo. Eso no prueba que sea CORRECTA. Una cifra puede moverse y
 * estar mal, y ningún barrido de los que hice lo vería.
 *
 * Esto cuenta lo mismo POR SEPARADO, con SQL escrito aquí a mano
 * siguiendo las reglas tal como están dichas, y compara contra lo que
 * devuelven las consultas del panel. Si las dos coinciden, la cifra es
 * buena; si no, sale el descuadre con nombre y apellidos.
 *
 * NO REUTILIZA EL CÓDIGO DEL PANEL, y ese es todo el valor: si usara
 * sus mismas funciones, un error estaría en los dos lados y las dos
 * darían lo mismo. Dos caminos distintos al mismo número es lo único
 * que de verdad lo comprueba.
 *
 * SOLO LEE.
 *
 *   pnpm db:cuadrar
 */

import { PrismaClient } from '../generated/prisma';
/// Las MISMAS piezas que usa el panel: lo que se compara es el
/// RESULTADO, no el camino. Llamar a otra cosa sería comparar dos
/// consultas mías entre sí y no el panel contra la base.
import {
  completarFila,
  resumenPorAccionSql,
} from '../src/crm/resumen-por-accion';

const prisma = new PrismaClient();

/// La ventana que se compara. Son las dos que el cliente usa.
const VENTANAS: Array<{ nombre: string; desde: string | null; hasta: string | null }> = [
  { nombre: 'Desde el principio', desde: null, hasta: null },
  {
    nombre: 'Ayer (6 oct, hora de Bogotá)',
    desde: '2026-10-06T05:00:00.000Z',
    hasta: '2026-10-07T05:00:00.000Z',
  },
  {
    nombre: 'Últimos 12 meses',
    desde: '2025-10-08T05:00:00.000Z',
    hasta: null,
  },
];

const OCUPAN = ['INSCRITO', 'EN_FORMACION', 'CERTIFICADO'];

type Fila = {
  codigo: string;
  gremio: string;
  cuposReservados: number;
  campanaDigital: number;
  inscritos: number;
};

/**
 * LA CUENTA HECHA A MANO, con las reglas dichas en palabras:
 *
 *   - CUPOS RESERVADOS: la suma de los cupos de las reservas
 *     CONFIRMADAS que se crearon dentro del periodo.
 *   - LEADS POR SU CUENTA: las personas que NO vienen de reserva y que
 *     llegaron dentro del periodo.
 *   - INSCRITOS: las personas que HOY ocupan silla y que entraron a
 *     INSCRITO dentro del periodo ---la primera vez, y sin contar un
 *     movimiento de INSCRITO a INSCRITO, que es un traslado de grupo
 *     y no una inscripción nueva---.
 */
async function aMano(desde: string | null, hasta: string | null): Promise<Map<string, Fila>> {
  const por = new Map<string, Fila>();

  const acciones = await prisma.accionFormacion.findMany({
    select: {
      id: true,
      codigo: true,
      convenio: { select: { sigla: true, slug: true } },
    },
  });
  const llave = (id: string) => {
    const a = acciones.find((x) => x.id === id);
    return a ? `${a.codigo} · ${a.convenio?.sigla ?? a.convenio?.slug ?? '?'}` : id;
  };
  for (const a of acciones) {
    por.set(llave(a.id), {
      codigo: a.codigo,
      gremio: a.convenio?.sigla ?? '',
      cuposReservados: 0,
      campanaDigital: 0,
      inscritos: 0,
    });
  }

  /// 1 · Cupos reservados.
  const reservas = await prisma.reserva.findMany({
    where: {
      estado: 'CONFIRMADA',
      ...(desde || hasta
        ? {
            creadoEn: {
              ...(desde ? { gte: new Date(desde) } : {}),
              ...(hasta ? { lt: new Date(hasta) } : {}),
            },
          }
        : {}),
    },
    select: {
      cuposConfirmados: true,
      oferta: { select: { accionFormacionId: true } },
    },
  });
  for (const r of reservas) {
    const aid = r.oferta?.accionFormacionId;
    if (!aid) continue;
    const f = por.get(llave(aid));
    if (f) f.cuposReservados += r.cuposConfirmados;
  }

  /// 2 · Leads por su cuenta.
  const gente = await prisma.participante.findMany({
    where: {
      origen: { not: 'EMPRESA' },
      accionFormacionId: { not: null },
      ...(desde || hasta
        ? {
            creadoEn: {
              ...(desde ? { gte: new Date(desde) } : {}),
              ...(hasta ? { lt: new Date(hasta) } : {}),
            },
          }
        : {}),
    },
    select: { accionFormacionId: true },
  });
  for (const g of gente) {
    const f = por.get(llave(g.accionFormacionId!));
    if (f) f.campanaDigital += 1;
  }

  /// 3 · Inscritos.
  if (!desde && !hasta) {
    /// Sin periodo: los que hoy ocupan silla, sin más.
    const vivos = await prisma.participante.findMany({
      where: { etapa: { in: OCUPAN as never }, accionFormacionId: { not: null } },
      select: { accionFormacionId: true },
    });
    for (const v of vivos) {
      const f = por.get(llave(v.accionFormacionId!));
      if (f) f.inscritos += 1;
    }
  } else {
    const movs = await prisma.movimientoParticipante.findMany({
      where: {
        etapaDespues: 'INSCRITO',
        NOT: { etapaAntes: 'INSCRITO' },
        creadoEn: {
          ...(desde ? { gte: new Date(desde) } : {}),
          ...(hasta ? { lt: new Date(hasta) } : {}),
        },
        participante: { etapa: { in: OCUPAN as never } },
      },
      select: {
        participanteId: true,
        participante: { select: { accionFormacionId: true } },
      },
    });
    /// Personas distintas: entrar, salir y volver es una, no dos.
    const vistos = new Set<string>();
    for (const m of movs) {
      if (vistos.has(m.participanteId)) continue;
      vistos.add(m.participanteId);
      const aid = m.participante?.accionFormacionId;
      if (!aid) continue;
      const f = por.get(llave(aid));
      if (f) f.inscritos += 1;
    }
  }

  return por;
}

async function main() {
  console.log('\n═══ EL PANEL CONTRA LA BASE, CONTADO POR SEPARADO ═══\n');

  /// Se usan las MISMAS piezas que el panel ---su SQL y su
  /// `completarFila`--- porque lo que se compara es el resultado, no
  /// el camino: si llamara a otra cosa estaría comparando dos
  /// consultas mías y no el panel contra la base.
  const todos = (await prisma.convenio.findMany({ select: { id: true } })).map(
    (c) => c.id,
  );

  let descuadres = 0;
  for (const v of VENTANAS) {
    const mio = await aMano(v.desde, v.hasta);
    const crudas = await prisma.$queryRaw<
      Parameters<typeof completarFila>[0][]
    >(
      resumenPorAccionSql(todos, null, {
        desde: v.desde ?? undefined,
        hasta: v.hasta ?? undefined,
      }),
    );
    const suyo = crudas.map(completarFila);

    console.log(`\n── ${v.nombre} ──`);
    console.log(
      '   ' +
        'ACCIÓN'.padEnd(26) +
        'CUPOS RES.'.padStart(22) +
        'LEADS'.padStart(18) +
        'INSCRITOS'.padStart(18),
    );

    for (const fila of suyo as Array<Record<string, unknown>>) {
      const codigo = String(fila.codigo);
      /// El panel no trae el gremio en esta tabla, así que se pega por
      /// id de acción, que es único.
      const a = await prisma.accionFormacion.findUnique({
        where: { id: String(fila.accionFormacionId) },
        select: { convenio: { select: { sigla: true, slug: true } } },
      });
      const k = `${codigo} · ${a?.convenio?.sigla ?? a?.convenio?.slug ?? '?'}`;
      const m = mio.get(k);
      if (!m) continue;

      const par = (suyoN: number, mioN: number) =>
        (suyoN === mioN ? '  ' : ' ✗') + String(suyoN).padStart(6) + '/' + String(mioN).padEnd(6);

      const malo =
        Number(fila.cuposReservados) !== m.cuposReservados ||
        Number(fila.campanaDigital) !== m.campanaDigital ||
        Number(fila.totalInscritos) !== m.inscritos;
      if (malo) descuadres += 1;

      console.log(
        '   ' +
          k.padEnd(26) +
          par(Number(fila.cuposReservados), m.cuposReservados).padStart(22) +
          par(Number(fila.campanaDigital), m.campanaDigital).padStart(18) +
          par(Number(fila.totalInscritos), m.inscritos).padStart(18),
      );
    }
  }

  console.log(
    `\n   Formato: panel/mano. Una ✗ marca el descuadre.\n` +
      `   DESCUADRES EN TOTAL: ${descuadres}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
