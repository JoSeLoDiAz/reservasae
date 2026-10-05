/** Si la reserva no llega a existir, la organización tampoco. */

/**
 * LO ENCONTRÓ UNA AUDITORÍA DEL 5 OCT 2026.
 *
 * `asegurarEmpresa` corría FUERA de la transacción, antes de abrirla.
 * Y después de ella quedaban varios `throw`: la reserva que ya existe
 * con otra cantidad ---el camino normal del segundo envío del
 * formulario--- y los cupos que cambiaron mientras se procesaba. Al
 * saltar cualquiera de los dos, quien llamaba recibía un 409 y la fila
 * `Empresa` se quedaba escrita, porque nunca estuvo dentro de nada que
 * se pudiera deshacer.
 *
 * `POST /reservas` ES PÚBLICA Y SIN SESIÓN, así que eso no era solo
 * basura acumulándose: con una tanda de NITs inventados se llenaba la
 * tabla de organizaciones a voluntad. Y esa tabla no es un registro
 * cualquiera: es la que el analista de información mira para saber con
 * quién se está hablando, la que alimenta el F7 y la que se cruza con
 * el RUES. Una organización que no reservó nada no debería estar ahí.
 *
 * Ahora `asegurarEmpresa` recibe el `tx` y se llama DESPUÉS del bloqueo
 * de la oferta. Lo segundo importa tanto como lo primero: el
 * `FOR UPDATE` pone en fila los envíos repetidos a la misma oferta, que
 * es el doble clic de siempre, y así el que llega segundo se encuentra
 * la organización ya escrita por el primero en vez de chocar con ella.
 */

import { ConflictException } from '@nestjs/common';

import { EstadoReserva } from '../../generated/prisma';
import {
  baseFalsa,
  CONTEXTO,
  dtoDeReserva,
  mundoBase,
  type Mundo,
} from './base-falsa-de-reservas';
import { ReservasService } from './reservas.service';

const servicioDe = (base: unknown) =>
  new ReservasService(base as any, {} as any);

/**
 * El grupo se cierra entre la lectura sin bloquear y el bloqueo.
 *
 * Es la forma más limpia de provocar el 409 que antes dejaba basura:
 * la lectura de `:46` ve la oferta abierta y el `SELECT FOR UPDATE` ya
 * la encuentra cerrada. Pasa de verdad ---el administrador cierra el
 * grupo mientras alguien tiene el formulario abierto--- y da
 * exactamente la forma del fallo: un `throw` ya dentro de la
 * transacción, con la organización por crear o recién creada.
 */
function baseQueCierraElGrupoAlBloquear(mundo: Mundo) {
  const base = baseFalsa(mundo);
  const bloqueoOriginal = base.$queryRaw;
  base.$queryRaw = async (...args: unknown[]) => {
    const filas = await bloqueoOriginal(...(args as [string[]]));
    return filas.map((f: Record<string, unknown>) => ({
      ...f,
      abierta: false,
    }));
  };
  return base;
}

describe('la organización no queda si la reserva no queda', () => {
  it('un 409 no deja la fila de la organización escrita', async () => {
    const mundo = mundoBase();

    await expect(
      servicioDe(baseQueCierraElGrupoAlBloquear(mundo)).crear(
        dtoDeReserva({ nit: '900111222' }),
        CONTEXTO,
      ),
    ).rejects.toThrow(ConflictException);

    expect(mundo.empresas).toHaveLength(0);
    expect(mundo.reservas).toHaveLength(0);
  });

  /**
   * ASÍ SE VEÍA EL ABUSO: una tanda de NITs distintos, todos
   * fallando, y la tabla de organizaciones llenándose igual. Tres
   * basta para fijar la regla; con el fallo abierto quedaban tres
   * filas.
   */
  it('una tanda de NITs inventados no puebla la tabla', async () => {
    const mundo = mundoBase();
    const base = baseQueCierraElGrupoAlBloquear(mundo);

    for (const nit of ['900111222', '900333444', '900555666']) {
      await expect(
        servicioDe(base).crear(dtoDeReserva({ nit }), CONTEXTO),
      ).rejects.toThrow(ConflictException);
    }

    expect(mundo.empresas).toHaveLength(0);
  });

  /**
   * NI SE RELLENAN LOS HUECOS A MEDIAS. Con una organización que ya
   * existe, `asegurarEmpresa` completa los campos vacíos; si la
   * reserva se cae después, esa escritura también se deshace. Lo
   * contrario dejaría la base contando una historia que no pasó.
   */
  it('tampoco rellena huecos de una organización que ya existía', async () => {
    const mundo = mundoBase();
    mundo.empresas.push({
      id: 'emp-colegio',
      nit: '890123456',
      razonSocial: 'Colegio San Mateo',
      numeroColaboradores: null,
      redAsociada: null,
      digitoVerificacion: null,
    });

    await expect(
      servicioDe(baseQueCierraElGrupoAlBloquear(mundo)).crear(
        dtoDeReserva({ numeroColaboradores: 80, redAsociada: 'ADEE' }),
        CONTEXTO,
      ),
    ).rejects.toThrow(ConflictException);

    const empresa = mundo.empresas[0];
    expect(empresa.numeroColaboradores).toBeNull();
    expect(empresa.redAsociada).toBeNull();
    expect(empresa.digitoVerificacion).toBeNull();
  });

  /**
   * EL OTRO 409, el que de verdad veía el cliente: el segundo envío
   * con otra cantidad. Aquí la organización ya existe y tiene que
   * seguir existiendo ---no se borra nada--- pero sin que el intento
   * fallido le haya escrito encima.
   */
  it('la reserva repetida con otra cantidad no toca la organización', async () => {
    const mundo = mundoBase();
    mundo.oferta.cuposOcupados = 10;
    mundo.empresas.push({
      id: 'emp-colegio',
      nit: '890123456',
      razonSocial: 'Colegio San Mateo',
      numeroColaboradores: null,
      redAsociada: null,
      digitoVerificacion: null,
    });
    mundo.reservas.push({
      id: 'res-colegio',
      empresaId: 'emp-colegio',
      ofertaId: 'of-1',
      estado: EstadoReserva.CONFIRMADA,
      cuposSolicitados: 10,
      cuposConfirmados: 10,
      cuposEnEspera: 0,
      contactoCorreo: 'compras@colegio.test',
      creadoEn: new Date('2026-09-01'),
    });

    await expect(
      servicioDe(baseFalsa(mundo)).crear(
        dtoDeReserva({ cuposSolicitados: 25, numeroColaboradores: 80 }),
        CONTEXTO,
      ),
    ).rejects.toThrow(ConflictException);

    expect(mundo.empresas).toHaveLength(1);
    expect(mundo.empresas[0].numeroColaboradores).toBeNull();
    expect(mundo.reservas[0].cuposSolicitados).toBe(10);
  });

  it('y cuando la reserva sí queda, la organización queda con ella', async () => {
    const mundo = mundoBase();

    const vista = await servicioDe(baseFalsa(mundo)).crear(
      dtoDeReserva({ nit: '900111222', numeroColaboradores: 80 }),
      CONTEXTO,
    );

    expect(vista.cuposConfirmados).toBe(10);
    expect(mundo.empresas).toHaveLength(1);
    expect(mundo.empresas[0].nit).toBe('900111222');
    expect(mundo.reservas).toHaveLength(1);
  });
});

describe('dónde está escrito que va dentro', () => {
  const fuente = require('fs').readFileSync(
    require('path').join(__dirname, 'reservas.service.ts'),
    'utf8',
  ) as string;

  /**
   * LA PRUEBA DE ARRIBA SE PUEDE APROBAR POR CASUALIDAD si alguien
   * vuelve a sacar la llamada y la base de mentira resulta indulgente.
   * Esto fija lo que no se puede deshacer: que recibe el `tx` y que no
   * hay ni un `this.prisma` dentro.
   */
  it('asegurarEmpresa recibe el tx y no usa this.prisma', () => {
    const i = fuente.indexOf('private async asegurarEmpresa(');
    expect(i).toBeGreaterThan(-1);
    const cuerpo = fuente.slice(i, fuente.indexOf('\n  private ', i + 20));

    expect(cuerpo).toContain('tx: Prisma.TransactionClient');
    expect(cuerpo).not.toContain('this.prisma');
  });

  /// Y después del bloqueo, que es lo que serializa el doble clic.
  it('se llama después de bloquear la oferta', () => {
    const bloqueo = fuente.indexOf('await this.bloquearOferta(tx, oferta.id)');
    const empresa = fuente.indexOf('await this.asegurarEmpresa(tx, nit, dto)');
    expect(bloqueo).toBeGreaterThan(-1);
    expect(empresa).toBeGreaterThan(bloqueo);
  });
});
