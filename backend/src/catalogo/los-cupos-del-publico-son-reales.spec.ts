/** El sitio público no promete plazas que ya no están. */

/**
 * LO VIO EL CLIENTE COMPARANDO LAS DOS PANTALLAS (2 oct 2026).
 *
 * `reservasae.com/adecopria` decía **422 cupos disponibles** en AF1. El
 * panel, de la misma acción: 520 de tope, 98 apartados por empresas y
 * **120 personas ya inscritas**. 520 − 98 = 422: el público restaba lo
 * apartado y no contaba a nadie más.
 *
 * La cuenta cuadraba exactamente en las cuatro acciones de la pantalla,
 * que es lo que convirtió la sospecha en diagnóstico.
 *
 * `Oferta.cuposOcupados` lo mueve SOLO el servicio de reservas: son las
 * plazas que una empresa aparta. Quien se inscribe por su cuenta no
 * estaba en ningún contador, así que el público lo veía libre y podía
 * reservar un sitio que ya no existe.
 */

import { plazasOcupadas, semaforo } from './catalogo.service';

describe('cuántas plazas están ocupadas de verdad', () => {
  it('las que apartó una empresa y las de quien entró por su cuenta', () => {
    expect(plazasOcupadas(98, 120)).toBe(218);
  });

  /**
   * EL CASO QUE ESTABA MAL: sin nadie por su cuenta la cuenta no cambia,
   * y por eso el defecto pasó inadvertido en las ofertas donde todo
   * entra por reserva de empresa.
   */
  it('sin inscritos directos, es lo de siempre', () => {
    expect(plazasOcupadas(98, 0)).toBe(98);
  });

  it('y sin reservas de empresa, solo los directos', () => {
    expect(plazasOcupadas(0, 19)).toBe(19);
  });
});

describe('el semáforo, con la cuenta buena', () => {
  it('AF1 ya no dice que hay 422 libres', () => {
    const tope = 520;
    const antes = tope - 98;
    const ahora = tope - plazasOcupadas(98, 120);
    expect(antes).toBe(422);
    expect(ahora).toBe(302);
  });

  it('se queda en COMPLETO cuando de verdad no cabe nadie', () => {
    expect(semaforo(100, plazasOcupadas(60, 40))).toBe('COMPLETO');
  });

  /**
   * Y AVISA ANTES DE LLENARSE, que es para lo que existe: con la cuenta
   * vieja una oferta podía decir «disponible» con tres sitios de verdad.
   */
  it('avisa de los últimos cupos contando a los dos', () => {
    /// 100 de tope, 85 apartados y 12 por su cuenta: quedan 3.
    expect(semaforo(100, plazasOcupadas(85, 12))).toBe('ULTIMOS_CUPOS');
    /// Con la cuenta vieja habría dicho que quedaban 15 y «disponible».
    expect(semaforo(100, 85)).toBe('DISPONIBLE');
  });
});

describe('de dónde salen esos dos números', () => {
  const fuente = () =>
    require('fs').readFileSync(
      require('path').join(__dirname, 'catalogo.service.ts'),
      'utf8',
    ) as string;

  /**
   * `reservaId: null` ES LA PARTE DELICADA.
   *
   * Quien entró POR una reserva de empresa ya está contado en
   * `cuposOcupados`. Contarlo otra vez cerraría ofertas que tienen
   * sitio, que es el daño opuesto y igual de malo.
   */
  it('solo cuenta a quien NO vino de una reserva de empresa', () => {
    expect(fuente()).toContain('reservaId: null,');
  });

  /**
   * Y SOLO A QUIEN OCUPA SILLA: un interesado no ocupa nada, y contarlo
   * cerraría la oferta a gente que todavía puede entrar.
   */
  it('y solo a quien ocupa silla', () => {
    expect(fuente()).toContain('etapa: { in: OCUPAN_SILLA },');
  });
});
