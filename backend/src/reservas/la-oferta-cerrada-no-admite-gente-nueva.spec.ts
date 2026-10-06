/** Con el grupo cerrado no entra nadie nuevo, pero sí se puede salir. */

/**
 * LO ENCONTRÓ UNA AUDITORÍA DEL 5 OCT 2026.
 *
 * `crear` comprobaba que la oferta estuviera `abierta` y que su acción
 * de formación fuera `visible`. `editar` no comprobaba nada: bloqueaba
 * la oferta, calculaba el techo y escribía. Y `bloquearOferta` ya
 * devolvía `abierta` en la fila, sin que ningún camino la leyera.
 *
 * O sea que cerrar un grupo cerraba la pantalla pública y el botón de
 * reservar, pero dejaba abierto `PATCH /reservas/:id`: la organización
 * que ya tenía reserva ampliaba la cantidad y metía en el aula a la
 * gente que el cierre pretendía dejar fuera. En el panel se veía
 * «cerrada» mientras los cupos seguían subiendo.
 *
 * La lista de espera hacía lo mismo sola y sin que nadie lo pidiera:
 * `promoverListaDeEspera` corre detrás de cada cancelación, y sobre una
 * oferta cerrada confirmaba a quien estaba esperando con los cupos que
 * liberaba el que se iba. El cierre se deshacía por su cuenta.
 *
 * LO QUE NO SE PUEDE CERRAR ES LA SALIDA. Cancelar y bajar la cantidad
 * liberan cupos; si se bloquean también, quien ya no va a llevar a su
 * gente se queda con los cupos apartados para siempre. Los tres
 * últimos casos de este fichero están para que nadie los cierre
 * «de paso» la próxima vez.
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

const CORREO = 'compras@colegio.test';

function conReservaConfirmada(
  ajustesDeOferta: Partial<Mundo['oferta']>,
): Mundo {
  const mundo = mundoBase();
  Object.assign(mundo.oferta, { cuposOcupados: 10 }, ajustesDeOferta);
  mundo.empresas.push({
    id: 'emp-colegio',
    nit: '890123456',
    razonSocial: 'Colegio San Mateo',
  });
  mundo.reservas.push({
    id: 'res-colegio',
    empresaId: 'emp-colegio',
    ofertaId: 'of-1',
    estado: EstadoReserva.CONFIRMADA,
    cuposSolicitados: 10,
    cuposConfirmados: 10,
    cuposEnEspera: 0,
    contactoCorreo: CORREO,
    creadoEn: new Date('2026-09-01'),
  });
  return mundo;
}

const servicioDe = (mundo: Mundo) =>
  new ReservasService(baseFalsa(mundo) as any, {} as any);

describe('ampliar una reserva sobre una oferta cerrada', () => {
  it('no se puede cuando la oferta está cerrada', async () => {
    const mundo = conReservaConfirmada({ abierta: false });

    await expect(
      servicioDe(mundo).editar(
        'res-colegio',
        '890123456',
        CORREO,
        40,
        CONTEXTO,
      ),
    ).rejects.toThrow(ConflictException);

    /// Y no se queda a medias: ni los cupos de la oferta ni la fila.
    expect(mundo.oferta.cuposOcupados).toBe(10);
    expect(mundo.reservas[0].cuposSolicitados).toBe(10);
  });

  /**
   * LAS DOS MANERAS DE CERRAR. Se baja `Oferta.abierta` para cerrar
   * una sede, o se oculta la acción entera con
   * `AccionFormacion.visible`. `crear` exigía las dos; mirar solo la
   * primera dejaba la mitad del agujero abierto.
   */
  it('tampoco cuando lo que está oculto es la acción de formación', async () => {
    const mundo = conReservaConfirmada({ abierta: true, visible: false });

    await expect(
      servicioDe(mundo).editar(
        'res-colegio',
        '890123456',
        CORREO,
        40,
        CONTEXTO,
      ),
    ).rejects.toThrow(ConflictException);
    expect(mundo.oferta.cuposOcupados).toBe(10);
  });

  it('con la oferta abierta sí se amplía', async () => {
    const mundo = conReservaConfirmada({});

    const vista = await servicioDe(mundo).editar(
      'res-colegio',
      '890123456',
      CORREO,
      40,
      CONTEXTO,
    );

    expect(vista.cuposConfirmados).toBe(40);
    expect(mundo.oferta.cuposOcupados).toBe(40);
  });

  it('y crear tampoco entra, que es lo único que ya funcionaba', async () => {
    const mundo = mundoBase();
    mundo.oferta.abierta = false;

    await expect(
      servicioDe(mundo).crear(dtoDeReserva(), CONTEXTO),
    ).rejects.toThrow(ConflictException);
  });
});

describe('la lista de espera no reabre un grupo cerrado', () => {
  function conAlguienEsperando(abierta: boolean): Mundo {
    const mundo = conReservaConfirmada({ abierta, cuposOcupados: 10 });
    mundo.empresas.push({
      id: 'emp-fundacion',
      nit: '900777111',
      razonSocial: 'Fundación Aprender',
    });
    mundo.reservas.push({
      id: 'res-fundacion',
      empresaId: 'emp-fundacion',
      ofertaId: 'of-1',
      estado: EstadoReserva.LISTA_ESPERA,
      cuposSolicitados: 5,
      cuposConfirmados: 0,
      cuposEnEspera: 5,
      contactoCorreo: 'fundacion@ejemplo.test',
      creadoEn: new Date('2026-09-10'),
    });
    return mundo;
  }

  it('cerrada: quien esperaba se queda esperando', async () => {
    const mundo = conAlguienEsperando(false);

    await servicioDe(mundo).cancelar(
      'res-colegio',
      '890123456',
      CORREO,
      CONTEXTO,
    );

    const esperando = mundo.reservas.find((r) => r.id === 'res-fundacion')!;
    expect(esperando.cuposEnEspera).toBe(5);
    expect(esperando.cuposConfirmados).toBe(0);
    expect(esperando.estado).toBe(EstadoReserva.LISTA_ESPERA);
    /// Los cupos liberados se quedan libres, no se reparten.
    expect(mundo.oferta.cuposOcupados).toBe(0);
  });

  it('abierta: se promueve, como siempre', async () => {
    const mundo = conAlguienEsperando(true);

    await servicioDe(mundo).cancelar(
      'res-colegio',
      '890123456',
      CORREO,
      CONTEXTO,
    );

    const esperando = mundo.reservas.find((r) => r.id === 'res-fundacion')!;
    expect(esperando.cuposConfirmados).toBe(5);
    expect(esperando.cuposEnEspera).toBe(0);
    expect(esperando.estado).toBe(EstadoReserva.CONFIRMADA);
    expect(mundo.oferta.cuposOcupados).toBe(5);
  });
});

describe('salir sigue abierto aunque el grupo esté cerrado', () => {
  it('cancelar funciona con la oferta cerrada', async () => {
    const mundo = conReservaConfirmada({ abierta: false });

    const vista = await servicioDe(mundo).cancelar(
      'res-colegio',
      '890123456',
      CORREO,
      CONTEXTO,
    );

    expect(vista.estado).toBe(EstadoReserva.CANCELADA);
    expect(mundo.oferta.cuposOcupados).toBe(0);
  });

  it('cancelar funciona también con la acción oculta', async () => {
    const mundo = conReservaConfirmada({ visible: false });

    const vista = await servicioDe(mundo).cancelar(
      'res-colegio',
      '890123456',
      CORREO,
      CONTEXTO,
    );

    expect(vista.estado).toBe(EstadoReserva.CANCELADA);
  });

  /**
   * BAJAR LA CANTIDAD ES MEDIA CANCELACIÓN, y por eso pasa por
   * `editar` sin tropezar con el cierre: lo que el cierre evita es
   * que entre gente nueva, no que alguien devuelva lo que no va a
   * usar.
   */
  it('y bajar la cantidad también, que es devolver cupos', async () => {
    const mundo = conReservaConfirmada({ abierta: false });

    const vista = await servicioDe(mundo).editar(
      'res-colegio',
      '890123456',
      CORREO,
      4,
      CONTEXTO,
    );

    expect(vista.cuposConfirmados).toBe(4);
    expect(mundo.oferta.cuposOcupados).toBe(4);
  });
});
