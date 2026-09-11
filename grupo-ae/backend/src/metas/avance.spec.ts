import { calcularAvance, rotuloDeRitmo, type EntradaDeAvance } from './avance';
import { diasHabilesDelMes } from './periodo';

/// Jueves 10 de septiembre de 2026, tres de la tarde en Bogotá.
/// Septiembre tiene 22 hábiles: 7 transcurridos y 15 por delante.
const JUEVES_10 = new Date('2026-09-10T20:00:00.000Z');
/// Miércoles 30, el último día del mes.
const ULTIMO_DIA = new Date('2026-09-30T14:00:00.000Z');

const MILLON = 1_000_000;

/// Un mes de septiembre con meta de sesenta millones. Cada prueba
/// cambia lo suyo, para que lo que falle sea lo que la prueba
/// nombra y no un descuido del montaje.
const septiembre = (
  cambios: Partial<EntradaDeAvance> = {},
): EntradaDeAvance => ({
  meta: 60 * MILLON,
  ganado: 0,
  anio: 2026,
  mes: 9,
  ahora: JUEVES_10,
  ...cambios,
});

describe('el avance contra la meta', () => {
  describe('el mes en curso', () => {
    it('reparte la meta entre los días hábiles para saber si va en ritmo', () => {
      const a = calcularAvance(septiembre({ ganado: 30 * MILLON }));

      expect(a.diasHabiles).toBe(22);
      expect(a.diasHabilesTranscurridos).toBe(7);
      expect(a.diasHabilesRestantes).toBe(15);
      /// 60.000.000 x 7/22
      expect(a.esperado).toBe(19_090_909);
      expect(a.ritmo).toBe('EN_RITMO');
      expect(a.porcentaje).toBe(50);
      expect(a.falta).toBe(30 * MILLON);
      expect(a.faltaPorDiaHabil).toBe(2 * MILLON);
    });

    it('por debajo de lo esperado va atrasado, no perdido', () => {
      const a = calcularAvance(septiembre({ ganado: 5 * MILLON }));
      expect(a.ritmo).toBe('ATRASADO');
      expect(a.mesCerrado).toBe(false);
      expect(a.faltaPorDiaHabil).toBe(Math.ceil((55 * MILLON) / 15));
    });

    /// Empatar con lo esperado es ir en ritmo: quien lleva
    /// exactamente su parte no está atrasado.
    it('empatar con lo esperado es ir en ritmo', () => {
      const esperado = calcularAvance(septiembre()).esperado;
      expect(calcularAvance(septiembre({ ganado: esperado })).ritmo).toBe(
        'EN_RITMO',
      );
      expect(calcularAvance(septiembre({ ganado: esperado - 1 })).ritmo).toBe(
        'ATRASADO',
      );
    });

    it('el último día del mes todavía tiene un día donde poner lo que falta', () => {
      const a = calcularAvance(
        septiembre({ ganado: 50 * MILLON, ahora: ULTIMO_DIA }),
      );
      expect(a.diasHabilesRestantes).toBe(1);
      expect(a.faltaPorDiaHabil).toBe(10 * MILLON);
      expect(a.ritmo).toBe('ATRASADO');
    });

    /**
     * La cuota diaria se redondea SIEMPRE hacia arriba.
     *
     * Repartir cien en quince días a seis deja diez sin vender. Es
     * la única dirección en la que la suma de las cuotas alcanza la
     * meta, y por eso se prueba como propiedad y no como número.
     */
    it('la cuota diaria, sumada, alcanza siempre para lo que falta', () => {
      for (const ganado of [0, 1, 7 * MILLON, 59_999_999]) {
        const a = calcularAvance(septiembre({ ganado }));
        expect(
          (a.faltaPorDiaHabil ?? 0) * a.diasHabilesRestantes,
        ).toBeGreaterThanOrEqual(a.falta);
      }
    });
  });

  describe('la meta en cero', () => {
    /// Meta cero es una decisión —está de vacaciones, entra la
    /// semana que viene—, no un vacío. Lo que no puede es producir
    /// un porcentaje: ni 0 % ni 100 % dicen la verdad de alguien
    /// que no tenía nada que cumplir.
    it('no produce porcentaje, produce un vacío', () => {
      const a = calcularAvance(septiembre({ meta: 0, ganado: 0 }));
      expect(a.porcentaje).toBeNull();
      expect(a.ritmo).toBe('SIN_META');
      expect(a.esperado).toBe(0);
      expect(a.falta).toBe(0);
    });

    it('lo vendido sin meta cuenta como excedente entero', () => {
      const a = calcularAvance(septiembre({ meta: 0, ganado: 4 * MILLON }));
      expect(a.excedente).toBe(4 * MILLON);
      expect(a.porcentaje).toBeNull();
      expect(a.ritmo).toBe('SIN_META');
    });

    it('no deja ni un NaN en ningún campo', () => {
      const a = calcularAvance(septiembre({ meta: 0, ganado: 0 }));
      const numeros = Object.values(a).filter(
        (v): v is number => typeof v === 'number',
      );
      expect(numeros.some(Number.isNaN)).toBe(false);
    });
  });

  describe('el mes ya terminado', () => {
    /// Agosto visto desde el 10 de septiembre: 21 hábiles, todos
    /// gastados.
    const agosto = (cambios: Partial<EntradaDeAvance> = {}) =>
      calcularAvance(septiembre({ mes: 8, ...cambios }));

    it('no queda ningún día, así que no hay cuota diaria', () => {
      const a = agosto({ meta: 50 * MILLON, ganado: 30 * MILLON });
      expect(a.mesCerrado).toBe(true);
      expect(a.diasHabilesRestantes).toBe(0);
      /// Null y no Infinity ni «todo lo que falta»: no hay día
      /// donde ponerlo, y un número ahí sugiere una tarea que ya
      /// no existe.
      expect(a.faltaPorDiaHabil).toBeNull();
      expect(a.ritmo).toBe('INCUMPLIDA');
      expect(a.porcentaje).toBe(60);
    });

    it('un mes cerrado por encima de la meta está cumplido, no atrasado', () => {
      const a = agosto({ meta: 50 * MILLON, ganado: 55 * MILLON });
      expect(a.ritmo).toBe('CUMPLIDA');
      expect(a.falta).toBe(0);
      expect(a.excedente).toBe(5 * MILLON);
      expect(a.faltaPorDiaHabil).toBe(0);
      expect(a.porcentaje).toBe(110);
    });

    it('un mes cerrado sin meta sigue sin porcentaje', () => {
      const a = agosto({ meta: 0, ganado: 0 });
      expect(a.ritmo).toBe('SIN_META');
      expect(a.porcentaje).toBeNull();
      expect(a.faltaPorDiaHabil).toBe(0);
    });
  });

  describe('el mes que no ha empezado', () => {
    it('tiene todos sus días por delante y va en ritmo por definición', () => {
      const a = calcularAvance(septiembre({ mes: 10, ganado: 0 }));
      expect(a.diasHabilesRestantes).toBe(diasHabilesDelMes(2026, 10));
      expect(a.diasHabilesTranscurridos).toBe(0);
      expect(a.esperado).toBe(0);
      expect(a.ritmo).toBe('EN_RITMO');
    });
  });

  describe('pasarse de la meta', () => {
    it('no es faltar menos que cero: falta cero y lo demás es excedente', () => {
      const a = calcularAvance(septiembre({ ganado: 70 * MILLON }));
      expect(a.falta).toBe(0);
      expect(a.excedente).toBe(10 * MILLON);
      expect(a.porcentaje).toBe(117);
      expect(a.ritmo).toBe('CUMPLIDA');
    });
  });

  it('el rótulo se lee como lo diría una persona', () => {
    expect(calcularAvance(septiembre()).rotulo).toBe('Septiembre de 2026');
    expect(rotuloDeRitmo('INCUMPLIDA')).toBe('No se cumplió');
  });
});
