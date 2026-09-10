/** Los cuatro caminos que escriben el contador, corriendo a la vez. G-01 y F-02. */

/**
 * QUÉ SE PRUEBA
 *
 * `cuposOcupados` lo mueven CUATRO manos distintas:
 *
 *   1. crear                `reservas.service.ts:100`
 *   2. editar               `reservas.service.ts:186`
 *   3. cancelar (público)   `reservas.service.ts:237`
 *   4. cancelar (tablero)   `tableros.service.ts:1159-1162`
 *
 * Las tres primeras están en el mismo fichero y se parecen. La cuarta
 * vive en otro módulo, y ahí está el hallazgo G-01: toma el candado
 * (`tableros.service.ts:1155`) y NO LO USA —decide con la fila que leyó
 * fuera de la transacción, en :1118, y decrementa sin condición, sin el
 * `rowCount` que protege a `moverContador`—.
 *
 * Y el refutador encontró que no es solo el tablero: `editar` también
 * lee la reserva con un `findUnique` pelado (`reservas.service.ts:164`)
 * antes de tomar el candado, y `cancelar` igual (:229). Dos de los tres
 * caminos «buenos» tienen el mismo defecto. Eso es F-02.
 *
 * TRES BLOQUES, Y NO LOS TRES FALLAN HOY
 *
 *   A · los cuatro caminos sobre la misma oferta, cada uno con su
 *       reserva. HOY PASA, y se deja puesto como red: el candado de la
 *       oferta serializa los movimientos del contador mientras cada
 *       mano toque una reserva distinta. Si algún día esto se rompe, es
 *       una regresión y hay que verla.
 *
 *   B · DOS CANCELACIONES PÚBLICAS a la vez sobre LA MISMA reserva.
 *       HOY FALLA. El cupo vuelve dos veces.
 *
 *   C · una cancelación pública y una del tablero a la vez sobre LA
 *       MISMA reserva. HOY FALLA, y es el caso peor: el tablero ni
 *       siquiera tiene la red del `UPDATE` condicional.
 *
 * EL COLCHÓN, QUE NO ES UN DETALLE
 *
 * En B y C hay SIEMPRE una segunda reserva con cupos. Sin ella, la
 * segunda devolución dejaría el contador en negativo, el `UPDATE`
 * condicional de `moverContador` (:369-380) devolvería cero filas y la
 * transacción se caería sola: la prueba «pasaría» y el fallo quedaría
 * tapado por la aritmética. Con el colchón, la doble devolución CABE, y
 * entonces se ve lo que es: el contador dice menos gente de la que hay.
 *
 * SE REPITE EN RONDAS
 *
 * Si la segunda petición llega después de que la primera confirme, la
 * guarda de idempotencia acierta y no hay fuga. Es una carrera, así que
 * se corre diez veces con reservas nuevas y se exige que fallen CERO
 * rondas. Lo que se cuenta y se dice es cuántas fugaron.
 *
 * MONTAJE / LIMPIEZA / TIEMPO
 *   Isla propia, como el resto. Borrado completo en el `finally`.
 *   ~20 s por el túnel, ~6 s en local.
 */

import { PrismaClient } from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';
import {
  aLaVez,
  apunte,
  bloque,
  cerrar,
  conIsla,
  crearOferta,
  exigirBaseDePruebas,
  garantiza,
  ipDePrueba,
  Isla,
  nitDePrueba,
  ocuparConReserva,
  pedir,
  porEstado,
  Respuesta,
  solapeMaximo,
} from './arnes';

// el 5433 es producción, aunque diga localhost
exigirBaseSegura('La prueba de los cuatro caminos');
exigirBaseDePruebas('La prueba de los cuatro caminos');

const prisma = new PrismaClient();

const RONDAS = 10;
const AFORO = 40;
/// Lo que aparta cada reserva. Cinco para que la fuga se vea de lejos:
/// un contador con cinco de menos no se confunde con un redondeo.
const CUPOS = 5;

let siguiente = 0;
function reservar(cuantos: number): number {
  const desde = siguiente;
  siguiente += cuantos;
  return desde;
}

/** El contador y la suma de las reservas vivas. Tienen que ser el mismo número. */
async function cuadre(ofertaId: string): Promise<{ contador: number; suma: number }> {
  const oferta = await prisma.oferta.findUniqueOrThrow({ where: { id: ofertaId } });
  const suma = await prisma.reserva.aggregate({
    where: { ofertaId, estado: { not: 'CANCELADA' } },
    _sum: { cuposConfirmados: true },
  });
  return { contador: oferta.cuposOcupados, suma: suma._sum.cuposConfirmados ?? 0 };
}

// ---------------------------------------------------------------------------
// A · los cuatro caminos a la vez. Hoy pasa
// ---------------------------------------------------------------------------

async function losCuatroALaVez(isla: Isla): Promise<void> {
  bloque('A · crear, editar, cancelar por el público y cancelar desde el tablero, a la vez');

  const oferta = await crearOferta(prisma, isla, `G01-${isla.sello}`, AFORO);

  const i = reservar(4);
  const paraEditar = await ocuparConReserva(prisma, isla, oferta.id, CUPOS, i);
  const paraPublico = await ocuparConReserva(prisma, isla, oferta.id, CUPOS, i + 1);
  const paraTablero = await ocuparConReserva(prisma, isla, oferta.id, CUPOS, i + 2);
  const nuevo = i + 3;

  const antes = await cuadre(oferta.id);
  apunte(`antes: contador ${antes.contador}, suma ${antes.suma}`);

  const caminos: Array<() => Promise<Respuesta>> = [
    () =>
      pedir('POST', '/reservas', {
        ip: ipDePrueba(nuevo),
        cuerpo: {
          ofertaId: oferta.id,
          nit: nitDePrueba(isla, nuevo),
          razonSocial: `CARGA ${isla.sello} NUEVA`,
          contactoNombre: 'Contacto nuevo',
          contactoCorreo: `nueva.${isla.sello}@pruebas.invalid`,
          cuposSolicitados: 3,
          aceptaTerminos: true,
          aceptaPoliticaDatos: true,
        },
      }),
    () =>
      pedir('PATCH', `/reservas/${paraEditar.reservaId}`, {
        ip: ipDePrueba(nuevo + 1),
        cuerpo: { nit: paraEditar.nit, cuposSolicitados: CUPOS + 3 },
      }),
    () =>
      pedir('POST', `/reservas/${paraPublico.reservaId}/cancelar`, {
        ip: ipDePrueba(nuevo + 2),
        cuerpo: { nit: paraPublico.nit },
      }),
    () =>
      pedir('POST', `/admin/tableros/reservas/${paraTablero.reservaId}/cancelar`, {
        ip: ipDePrueba(nuevo + 3),
        cookie: isla.cookie,
      }),
  ];

  const { salidas, ms } = await aLaVez(caminos.length, (k) => caminos[k]);
  apunte(
    `4 peticiones en ${ms} ms · hasta ${solapeMaximo(salidas)} en vuelo a la vez · ${porEstado(salidas)}`,
  );

  garantiza(
    'ninguno de los cuatro caminos revienta cuando los otros tres escriben a la vez',
    salidas.every((r) => r.estado !== 0 && r.estado < 500),
    porEstado(salidas),
  );

  const despues = await cuadre(oferta.id);
  garantiza(
    'después de las cuatro manos, el contador sigue diciendo lo mismo que las reservas',
    despues.contador === despues.suma,
    `contador ${despues.contador} · suma ${despues.suma}`,
  );

  const tope = await prisma.oferta.findUniqueOrThrow({ where: { id: oferta.id } });
  garantiza(
    'el contador se queda entre cero y el tope',
    tope.cuposOcupados >= 0 && tope.cuposOcupados <= tope.cuposMaximos,
    `${tope.cuposOcupados} de ${tope.cuposMaximos}`,
  );
}

// ---------------------------------------------------------------------------
// B y C · dos cancelaciones sobre LA MISMA reserva
// ---------------------------------------------------------------------------

type Pareja = 'dos por el público' | 'una del público y una del tablero';

async function unaRondaDeDobleCancelacion(
  isla: Isla,
  ofertaId: string,
  pareja: Pareja,
): Promise<{ fuga: number; estados: string; movimientos: number }> {
  const i = reservar(2);
  const victima = await ocuparConReserva(prisma, isla, ofertaId, CUPOS, i);
  /// El colchón. Sin él, la segunda devolución dejaría el contador en
  /// negativo y `moverContador` la rechazaría: la fuga quedaría tapada
  /// por el `>= 0` del UPDATE, no por una defensa de verdad.
  await ocuparConReserva(prisma, isla, ofertaId, CUPOS, i + 1);

  const publica = () =>
    pedir('POST', `/reservas/${victima.reservaId}/cancelar`, {
      ip: ipDePrueba(i),
      cuerpo: { nit: victima.nit },
    });
  const desdeElTablero = () =>
    pedir('POST', `/admin/tableros/reservas/${victima.reservaId}/cancelar`, {
      ip: ipDePrueba(i + 1),
      cookie: isla.cookie,
    });

  const segunda = pareja === 'dos por el público' ? publica : desdeElTablero;
  const { salidas } = await aLaVez(2, (k) => (k === 0 ? publica : segunda));

  const { contador, suma } = await cuadre(ofertaId);
  const movimientos = await prisma.movimientoReserva.count({
    where: { reservaId: victima.reservaId, accion: 'CANCELACION' },
  });

  // el contador quedó por debajo de la gente que de verdad hay
  return { fuga: suma - contador, estados: porEstado(salidas), movimientos };
}

async function dobleCancelacion(isla: Isla, pareja: Pareja, etiqueta: string): Promise<void> {
  bloque(`${etiqueta} · ${pareja}, ${RONDAS} rondas`);

  const oferta = await crearOferta(prisma, isla, `F02-${etiqueta}-${isla.sello}`, 400);

  let rondasConFuga = 0;
  let cuposFugados = 0;
  let rondasConDobleApunte = 0;
  const codigos = new Set<string>();

  for (let r = 0; r < RONDAS; r += 1) {
    const { fuga, estados, movimientos } = await unaRondaDeDobleCancelacion(
      isla,
      oferta.id,
      pareja,
    );
    codigos.add(estados);
    if (fuga !== 0) {
      rondasConFuga += 1;
      cuposFugados += fuga;
    }
    if (movimientos > 1) rondasConDobleApunte += 1;
  }

  apunte(`códigos vistos: ${[...codigos].join(' | ')}`);

  garantiza(
    'dos cancelaciones a la vez devuelven el cupo UNA vez, no dos',
    rondasConFuga === 0,
    `${rondasConFuga} de ${RONDAS} rondas con fuga · ${cuposFugados} cupos perdidos`,
  );
  garantiza(
    'la bitácora de cupos apunta una sola cancelación por reserva cancelada',
    rondasConDobleApunte === 0,
    `${rondasConDobleApunte} de ${RONDAS} rondas con dos apuntes de CANCELACION`,
  );

  const final = await cuadre(oferta.id);
  garantiza(
    'al final de las rondas el contador sigue diciendo lo mismo que las reservas',
    final.contador === final.suma,
    `contador ${final.contador} · suma ${final.suma}`,
  );
}

// ---------------------------------------------------------------------------

async function main() {
  await conIsla(prisma, async (isla) => {
    await losCuatroALaVez(isla);
    await dobleCancelacion(isla, 'dos por el público', 'B');
    await dobleCancelacion(isla, 'una del público y una del tablero', 'C');
  });
  cerrar();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
