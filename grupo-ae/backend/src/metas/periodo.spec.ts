import {
  claveDe,
  diaEnColombia,
  diasHabilesDelMes,
  diasHabilesRestantes,
  mesTerminado,
  periodoDe,
  revisarPeriodo,
  ultimosDoceMeses,
  ventanaDe,
  ventanaDelAnio,
  ventanaDelMes,
} from './periodo';

/// Instantes escritos en UTC, que es como llegan de la base.
const utc = (iso: string) => new Date(iso);

describe('el mes comercial', () => {
  describe('los bordes llevan el huso de Bogotá dentro', () => {
    it('septiembre empieza a las cinco de la mañana en UTC', () => {
      const { desde, hasta } = ventanaDelMes(2026, 9);
      expect(desde.toISOString()).toBe('2026-09-01T05:00:00.000Z');
      expect(hasta.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    });

    it('diciembre cierra en enero del año siguiente', () => {
      expect(ventanaDelMes(2026, 12).hasta.toISOString()).toBe(
        '2027-01-01T05:00:00.000Z',
      );
    });

    /**
     * La prueba que justifica todo este módulo.
     *
     * Ocho de la noche del 30 de septiembre en Bogotá ya es 1 de
     * octubre en UTC. Con los bordes construidos en la hora del
     * servidor, esa venta cerraba en octubre y el asesor se
     * quedaba sin ella justo el día del cierre.
     */
    it('una venta de las 8 p. m. del último día del mes es de ese mes', () => {
      const cerrada = utc('2026-10-01T01:00:00.000Z');

      const septiembre = ventanaDelMes(2026, 9);
      expect(cerrada >= septiembre.desde && cerrada < septiembre.hasta).toBe(
        true,
      );

      const octubre = ventanaDelMes(2026, 10);
      expect(cerrada >= octubre.desde).toBe(false);

      expect(diaEnColombia(cerrada)).toEqual({ anio: 2026, mes: 9, dia: 30 });
      expect(periodoDe(cerrada)).toEqual({ anio: 2026, mes: 9 });
    });

    it('el año entero va de enero a enero', () => {
      const { desde, hasta } = ventanaDelAnio(2026);
      expect(desde.toISOString()).toBe('2026-01-01T05:00:00.000Z');
      expect(hasta.toISOString()).toBe('2027-01-01T05:00:00.000Z');
    });

    it('sin mes, la ventana es la del año', () => {
      expect(ventanaDe(2026, null)).toEqual(ventanaDelAnio(2026));
      expect(ventanaDe(2026, 9)).toEqual(ventanaDelMes(2026, 9));
    });
  });

  describe('los días de trabajo', () => {
    it('septiembre de 2026 tiene 22 hábiles', () => {
      expect(diasHabilesDelMes(2026, 9)).toBe(22);
    });

    it('el febrero bisiesto cuenta su día 29', () => {
      expect(diasHabilesDelMes(2024, 2)).toBe(21);
      expect(diasHabilesDelMes(2026, 2)).toBe(20);
    });

    it('quedan los que faltan, contando hoy', () => {
      /// Jueves 10 de septiembre, tres de la tarde en Bogotá.
      const hoy = utc('2026-09-10T20:00:00.000Z');
      expect(diasHabilesRestantes(2026, 9, hoy)).toBe(15);
    });

    /// El caso que se rompe si «hoy» no cuenta: el último día del
    /// mes se quedaría sin días para lo que falta, y «cuánto falta
    /// por día» se apagaría justo cuando más se mira.
    it('el último día del mes todavía cuenta como día de venta', () => {
      const ultimoDia = utc('2026-09-30T14:00:00.000Z');
      expect(diasHabilesRestantes(2026, 9, ultimoDia)).toBe(1);
    });

    it('a un mes pasado no le quedan días', () => {
      expect(
        diasHabilesRestantes(2026, 8, utc('2026-09-10T20:00:00.000Z')),
      ).toBe(0);
    });

    it('a un mes que no ha empezado le quedan todos', () => {
      expect(
        diasHabilesRestantes(2026, 10, utc('2026-09-10T20:00:00.000Z')),
      ).toBe(diasHabilesDelMes(2026, 10));
    });

    it('un mes solo está terminado cuando ya pasó', () => {
      const hoy = utc('2026-09-10T20:00:00.000Z');
      expect(mesTerminado(2026, 8, hoy)).toBe(true);
      expect(mesTerminado(2026, 9, hoy)).toBe(false);
      expect(mesTerminado(2026, 10, hoy)).toBe(false);
      expect(mesTerminado(2025, 12, hoy)).toBe(true);
    });

    /// La medianoche de Bogotá del día 1 pertenece al mes nuevo,
    /// aunque en UTC ya sean las cinco de la mañana.
    it('el mes cambia a la medianoche de Bogotá, no a la de UTC', () => {
      const primeroDeOctubre = utc('2026-10-01T05:00:00.000Z');
      expect(mesTerminado(2026, 9, primeroDeOctubre)).toBe(true);
      const ultimoInstanteDeSeptiembre = utc('2026-10-01T04:59:59.999Z');
      expect(mesTerminado(2026, 9, ultimoInstanteDeSeptiembre)).toBe(false);
    });
  });

  describe('los últimos doce meses', () => {
    it('son doce y acaban en el corriente', () => {
      const meses = ultimosDoceMeses(utc('2026-09-10T20:00:00.000Z'));
      expect(meses).toHaveLength(12);
      expect(meses[11]).toEqual({ anio: 2026, mes: 9 });
    });

    /// Restar meses a mano se va a negativo al cruzar el año: es el
    /// error clásico de esta cuenta.
    it('cruzan el año hacia atrás', () => {
      const meses = ultimosDoceMeses(utc('2026-01-15T20:00:00.000Z'));
      expect(meses[0]).toEqual({ anio: 2025, mes: 2 });
      expect(meses[11]).toEqual({ anio: 2026, mes: 1 });
    });

    it('la clave del mes ordena alfabéticamente', () => {
      expect(claveDe({ anio: 2026, mes: 9 })).toBe('2026-09');
      expect(
        claveDe({ anio: 2026, mes: 12 }) > claveDe({ anio: 2026, mes: 9 }),
      ).toBe(true);
    });
  });

  describe('lo que no es un periodo', () => {
    it('el mes 13 no existe, y el reparo lo dice', () => {
      expect(revisarPeriodo(2026, 13)).toContain('El mes va de 1 (enero) a 12');
      expect(revisarPeriodo(2026, 13)).toContain('13');
    });

    it('el mes 0 tampoco: los meses no empiezan en cero', () => {
      expect(revisarPeriodo(2026, 0)).not.toBeNull();
    });

    it('un mes con decimales no es un mes', () => {
      expect(revisarPeriodo(2026, 1.5)).not.toBeNull();
    });

    it('un año de dos cifras es un dedo torcido', () => {
      expect(revisarPeriodo(26, 9)).toContain('no parece un año de trabajo');
    });

    it('un periodo de verdad no tiene reparos', () => {
      expect(revisarPeriodo(2026, 1)).toBeNull();
      expect(revisarPeriodo(2026, 12)).toBeNull();
    });
  });
});
