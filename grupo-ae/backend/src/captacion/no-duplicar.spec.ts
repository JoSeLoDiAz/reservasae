/** Las dos ventanas: el mismo envío y el mismo negocio. */

import { EtapaOportunidad } from '../../generated/prisma';
import {
  DIAS_DEL_MISMO_NEGOCIO,
  MINUTOS_DEL_MISMO_ENVIO,
  queHacerCon,
  type Anterior,
} from './no-duplicar';

const AHORA = new Date('2026-09-10T15:00:00Z');

const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;

const haceMinutos = (n: number) => new Date(AHORA.getTime() - n * MINUTO);
const haceDias = (n: number) => new Date(AHORA.getTime() - n * DIA);

/// Una oportunidad viva que nació hace un momento. Cada prueba le
/// cambia lo suyo, para que lo que falle sea lo que la prueba
/// nombra y no un descuido del montaje.
const anterior = (cambios: Partial<Anterior> = {}): Anterior => {
  const creadoEn = cambios.creadoEn ?? haceMinutos(1);
  return {
    id: 'op-1',
    codigo: 'OP-2026-0007',
    etapa: EtapaOportunidad.CAPTADO,
    creadoEn,
    /// Por omisión, nadie la ha tocado desde que nació: es el
    /// estado real de una oportunidad recién captada.
    ultimoToqueEn: creadoEn,
    ...cambios,
  };
};

describe('no duplicar lo que llega por el formulario', () => {
  it('sin nada anterior, se crea', () => {
    expect(queHacerCon([], AHORA)).toEqual({ que: 'CREAR' });
  });

  describe('el mismo envío', () => {
    /// El caso del encargo: dos veces en cinco minutos.
    it('dos envíos en cinco minutos son uno solo', () => {
      const v = queHacerCon([anterior({ creadoEn: haceMinutos(5) })], AHORA);
      expect(v.que).toBe('EL_MISMO_ENVIO');
    });

    it('el doble clic —un segundo después— también', () => {
      const v = queHacerCon([anterior({ creadoEn: haceMinutos(0) })], AHORA);
      expect(v).toEqual({
        que: 'EL_MISMO_ENVIO',
        id: 'op-1',
        codigo: 'OP-2026-0007',
      });
    });

    it('devuelve LA MISMA referencia, que es lo que ve la persona', () => {
      const v = queHacerCon(
        [anterior({ codigo: 'OP-2026-0042', creadoEn: haceMinutos(2) })],
        AHORA,
      );
      expect(v).toMatchObject({ codigo: 'OP-2026-0042' });
    });

    it('pasada la ventana ya no es el mismo envío', () => {
      const v = queHacerCon(
        [anterior({ creadoEn: haceMinutos(MINUTOS_DEL_MISMO_ENVIO + 1) })],
        AHORA,
      );
      expect(v.que).toBe('EL_MISMO_NEGOCIO');
    });
  });

  describe('el mismo negocio', () => {
    it('a los tres días vuelve a escribir: se anota, no se duplica', () => {
      const v = queHacerCon([anterior({ creadoEn: haceDias(3) })], AHORA);
      expect(v).toEqual({
        que: 'EL_MISMO_NEGOCIO',
        id: 'op-1',
        codigo: 'OP-2026-0007',
      });
    });

    /// Lo que pedía el encargo: a los tres meses es un negocio
    /// nuevo, aunque el anterior siguiera abierto.
    it('a los tres meses es un negocio nuevo', () => {
      const v = queHacerCon(
        [anterior({ creadoEn: haceDias(DIAS_DEL_MISMO_NEGOCIO + 1) })],
        AHORA,
      );
      expect(v).toEqual({ que: 'CREAR' });
    });

    /**
     * El aserto que nadie escribe, y el que protege de la
     * corrección ingenua: si la ventana larga se midiera contra el
     * nacimiento, este caso —un negocio viejo que el asesor movió
     * ayer— saldría duplicado justo cuando está caliente.
     */
    it('un negocio viejo que alguien tocó ayer sigue siendo el mismo', () => {
      const v = queHacerCon(
        [
          anterior({
            creadoEn: haceDias(DIAS_DEL_MISMO_NEGOCIO + 200),
            ultimoToqueEn: haceDias(1),
          }),
        ],
        AHORA,
      );
      expect(v.que).toBe('EL_MISMO_NEGOCIO');
    });
  });

  describe('lo cerrado no estorba', () => {
    it('quien ya compró y vuelve trae un negocio nuevo', () => {
      const v = queHacerCon(
        [anterior({ etapa: EtapaOportunidad.GANADO, creadoEn: haceDias(2) })],
        AHORA,
      );
      expect(v).toEqual({ que: 'CREAR' });
    });

    /**
     * Y este es el que importa de verdad. Colgar el interés nuevo
     * de la oportunidad perdida obligaría a reabrirla, y reabrirla
     * le quitaría al informe del mes una pérdida que sí ocurrió.
     */
    it('quien se perdió ayer y vuelve hoy también', () => {
      const v = queHacerCon(
        [anterior({ etapa: EtapaOportunidad.PERDIDO, creadoEn: haceDias(1) })],
        AHORA,
      );
      expect(v).toEqual({ que: 'CREAR' });
    });

    it('entre una cerrada reciente y una abierta vieja, manda la abierta', () => {
      const v = queHacerCon(
        [
          anterior({
            id: 'cerrada',
            etapa: EtapaOportunidad.PERDIDO,
            creadoEn: haceMinutos(30),
          }),
          anterior({
            id: 'abierta',
            etapa: EtapaOportunidad.CONTACTADO,
            creadoEn: haceDias(10),
          }),
        ],
        AHORA,
      );
      expect(v).toMatchObject({ que: 'EL_MISMO_NEGOCIO', id: 'abierta' });
    });
  });

  it('entre varias abiertas decide la más reciente', () => {
    const v = queHacerCon(
      [
        anterior({ id: 'vieja', creadoEn: haceDias(10) }),
        anterior({ id: 'nueva', creadoEn: haceMinutos(2) }),
      ],
      AHORA,
    );
    expect(v).toMatchObject({ que: 'EL_MISMO_ENVIO', id: 'nueva' });
  });
});
