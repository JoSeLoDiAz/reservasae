import { EtapaOportunidad, TipoEmbudo } from '../../generated/prisma';
import { probabilidadDe } from './embudos';
import {
  enDinero,
  enFacturado,
  fechaCorta,
  narrarAsesor,
  narrarCliente,
  narrarEdicion,
  narrarProbabilidad,
  normalizarMoneda,
  puedeAtarse,
  puedeBorrarse,
  puedeFacturarse,
  puedePisarProbabilidad,
  resolverProbabilidad,
  revisarMoneda,
  sigueEnPie,
  type Campos,
} from './edicion';
import type { Hechos } from './escalera';

/// Una oportunidad de empresa con todo puesto, igual que en
/// `escalera.spec.ts`: cada prueba le quita lo suyo y así lo que
/// falla es lo que la prueba nombra.
const completa = (cambios: Partial<Hechos> = {}): Hechos => ({
  embudo: TipoEmbudo.EMPRESA,
  valor: 12_000_000,
  tieneEmpresa: true,
  tienePersona: false,
  tieneAsesor: true,
  ...cambios,
});

const ficha = (cambios: Partial<Campos> = {}): Campos => ({
  titulo: 'Diplomado para BRITCHAM',
  valor: 12_000_000,
  moneda: 'COP',
  cierreEsperado: new Date('2026-06-30T00:00:00.000Z'),
  campana: null,
  ...cambios,
});

describe('editar una oportunidad sin romperla', () => {
  describe('el cambio no puede dejarla incumpliendo su propia etapa', () => {
    it('quitarle el valor a una CALIFICADA se bloquea', () => {
      const v = sigueEnPie(EtapaOportunidad.CALIFICADO, completa({ valor: 0 }));
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('valor');
      /// El mensaje tiene que decir la salida, no solo el no.
      expect(v.porque).toContain('perdida');
    });

    it('bajarlo sin llegar a cero se guarda: eso es negociar', () => {
      const v = sigueEnPie(
        EtapaOportunidad.CALIFICADO,
        completa({ valor: 4_000_000 }),
      );
      expect(v.puede).toBe(true);
    });

    it('en CAPTADO el valor cero es normal y pasa', () => {
      const v = sigueEnPie(EtapaOportunidad.CAPTADO, completa({ valor: 0 }));
      expect(v.puede).toBe(true);
    });

    it('soltar al asesor de una que ya avanzó se bloquea', () => {
      const v = sigueEnPie(
        EtapaOportunidad.EN_NEGOCIACION,
        completa({ tieneAsesor: false }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('asesor');
    });

    it('soltarlo en CAPTADO sí: es el estado de «entró y no lo ha tomado nadie»', () => {
      const v = sigueEnPie(
        EtapaOportunidad.CAPTADO,
        completa({ tieneAsesor: false }),
      );
      expect(v.puede).toBe(true);
    });

    /// Una ganada sin valor es la peor de todas: es la cifra con la
    /// que se cierra el mes.
    it('dejar en cero una GANADA se bloquea, y la salida es otra', () => {
      const v = sigueEnPie(
        EtapaOportunidad.GANADO,
        completa({ valor: 0, motivo: 'PRECIO_ACEPTADO' }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('reábrala');
    });

    it('una PERDIDA sí puede quedar en cero', () => {
      const v = sigueEnPie(
        EtapaOportunidad.PERDIDO,
        completa({ valor: 0, motivo: 'SIN_PRESUPUESTO' }),
      );
      expect(v.puede).toBe(true);
    });
  });

  describe('la moneda no se cambia sola', () => {
    it('pasar de COP a USD sin mandar el valor se bloquea', () => {
      const v = revisarMoneda(
        { moneda: 'COP', valor: 12_000_000 },
        { moneda: 'USD' },
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('USD');
    });

    it('con el valor ya en la moneda nueva, pasa', () => {
      const v = revisarMoneda(
        { moneda: 'COP', valor: 12_000_000 },
        { moneda: 'USD', valor: 3_000 },
      );
      expect(v.puede).toBe(true);
      expect(v.moneda).toBe('USD');
    });

    it('si no vale nada, no hay cifra que malinterpretar', () => {
      const v = revisarMoneda({ moneda: 'COP', valor: 0 }, { moneda: 'USD' });
      expect(v.puede).toBe(true);
      expect(v.moneda).toBe('USD');
    });

    it('mandar la misma moneda no es un cambio', () => {
      const v = revisarMoneda(
        { moneda: 'COP', valor: 12_000_000 },
        { moneda: 'cop' },
      );
      expect(v.puede).toBe(true);
      expect(v.moneda).toBe('COP');
    });

    /// La moneda que devuelve es la que hay que guardar, para que el
    /// servicio no normalice por su cuenta y se le quede vieja.
    it('sin pedir cambio, la que queda es la de antes', () => {
      const v = revisarMoneda({ moneda: 'EUR', valor: 500 }, {});
      expect(v.puede).toBe(true);
      expect(v.moneda).toBe('EUR');
    });

    it('una moneda inventada se rechaza diciendo cuáles hay', () => {
      const v = revisarMoneda({ moneda: 'COP', valor: 1 }, { moneda: 'pesos' });
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('COP');
    });

    it('normalizar admite minúsculas y espacios, y nada más', () => {
      expect(normalizarMoneda(' usd ')).toBe('USD');
      expect(normalizarMoneda('COL$')).toBeNull();
    });

    /// Lo facturado va en la misma moneda que el valor, así que
    /// cambiarla sin convertirlo lo metería en el informe del mes
    /// como otra plata.
    describe('lo facturado también se convierte', () => {
      it('con el valor convertido pero lo facturado no, se bloquea', () => {
        const v = revisarMoneda(
          { moneda: 'COP', valor: 12_000_000, valorFacturado: 11_900_000 },
          { moneda: 'USD', valor: 3_000 },
        );
        expect(v.puede).toBe(false);
        expect(v.porque).toContain('facturado');
        expect(v.porque).toContain('11.900.000 COP');
        expect(v.moneda).toBe('COP');
      });

      it('con los dos convertidos, pasa', () => {
        const v = revisarMoneda(
          { moneda: 'COP', valor: 12_000_000, valorFacturado: 11_900_000 },
          { moneda: 'USD', valor: 3_000, valorFacturado: 2_975 },
        );
        expect(v.puede).toBe(true);
        expect(v.moneda).toBe('USD');
      });

      it('quitarlo a la vez también vale: ya no hay cifra que leer mal', () => {
        const v = revisarMoneda(
          { moneda: 'COP', valor: 12_000_000, valorFacturado: 11_900_000 },
          { moneda: 'USD', valor: 3_000, valorFacturado: null },
        );
        expect(v.puede).toBe(true);
      });

      it('sin facturar, o facturado en cero, no estorba', () => {
        expect(
          revisarMoneda(
            { moneda: 'COP', valor: 12_000_000, valorFacturado: null },
            { moneda: 'USD', valor: 3_000 },
          ).puede,
        ).toBe(true);
        expect(
          revisarMoneda(
            { moneda: 'COP', valor: 12_000_000, valorFacturado: 0 },
            { moneda: 'USD', valor: 3_000 },
          ).puede,
        ).toBe(true);
      });

      /// El valor sigue mandando primero: si falta, el mensaje es el
      /// de siempre y no uno nuevo que hable de facturas.
      it('si falta el valor, el no es el de siempre', () => {
        const v = revisarMoneda(
          { moneda: 'COP', valor: 12_000_000, valorFacturado: 11_900_000 },
          { moneda: 'USD' },
        );
        expect(v.puede).toBe(false);
        expect(v.porque).toContain('pronóstico');
      });
    });
  });

  describe('solo se factura lo ganado', () => {
    it('a una ganada se le anota lo facturado', () => {
      expect(puedeFacturarse(EtapaOportunidad.GANADO, 11_900_000).puede).toBe(
        true,
      );
    });

    /// El cero es un dato —se facturó en cero— y en una ganada vale.
    it('facturado en cero también, si está ganada', () => {
      expect(puedeFacturarse(EtapaOportunidad.GANADO, 0).puede).toBe(true);
    });

    it('a una abierta no, y el no dice que hay que ganarla primero', () => {
      const v = puedeFacturarse(EtapaOportunidad.EN_NEGOCIACION, 5_000_000);
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('Cerrado ganado');
    });

    it('a una recién captada tampoco', () => {
      expect(puedeFacturarse(EtapaOportunidad.CAPTADO, 1).puede).toBe(false);
    });

    it('a una perdida no, y la salida es reabrirla', () => {
      const v = puedeFacturarse(EtapaOportunidad.PERDIDO, 5_000_000);
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('reábrala');
    });

    /// Quitarlo es corregir un error: bloquearlo dejaría pegada a la
    /// ficha justo la cifra equivocada.
    it('quitarlo se puede en cualquier etapa', () => {
      for (const etapa of Object.values(EtapaOportunidad)) {
        expect(puedeFacturarse(etapa, null).puede).toBe(true);
      }
    });
  });

  describe('el embudo decide a quién se le ata', () => {
    it('al de empresas, una empresa', () => {
      expect(puedeAtarse(TipoEmbudo.EMPRESA, 'empresa').puede).toBe(true);
      expect(puedeAtarse(TipoEmbudo.EMPRESA, 'persona').puede).toBe(false);
    });

    it('al de personas, una persona', () => {
      expect(puedeAtarse(TipoEmbudo.PERSONA, 'persona').puede).toBe(true);
      expect(puedeAtarse(TipoEmbudo.PERSONA, 'empresa').puede).toBe(false);
    });

    it('y el no dice dónde va el contacto que decide', () => {
      const v = puedeAtarse(TipoEmbudo.EMPRESA, 'persona');
      expect(v.porque).toContain('ficha de la empresa');
    });
  });

  describe('pisar la probabilidad', () => {
    it('se puede con el negocio vivo', () => {
      expect(
        puedePisarProbabilidad(EtapaOportunidad.PROPUESTA_ENVIADA, 10).puede,
      ).toBe(true);
    });

    it('no se puede con el negocio cerrado', () => {
      expect(puedePisarProbabilidad(EtapaOportunidad.GANADO, 50).puede).toBe(
        false,
      );
    });

    /// Soltarla siempre se puede: es volver a la verdad de la tabla.
    it('devolverla a la de su etapa se puede hasta en una cerrada', () => {
      expect(puedePisarProbabilidad(EtapaOportunidad.PERDIDO, null).puede).toBe(
        true,
      );
    });

    it('pisada, se guarda con la bandera arriba', () => {
      const r = resolverProbabilidad(
        TipoEmbudo.EMPRESA,
        EtapaOportunidad.PROPUESTA_ENVIADA,
        10,
      );
      expect(r).toEqual({ probabilidad: 10, probabilidadPropia: true });
    });

    it('soltada, vuelve a la de la tabla y baja la bandera', () => {
      const r = resolverProbabilidad(
        TipoEmbudo.EMPRESA,
        EtapaOportunidad.PROPUESTA_ENVIADA,
        null,
      );
      expect(r.probabilidadPropia).toBe(false);
      expect(r.probabilidad).toBe(
        probabilidadDe(TipoEmbudo.EMPRESA, EtapaOportunidad.PROPUESTA_ENVIADA),
      );
    });
  });

  describe('borrar es la excepción, cerrar es la regla', () => {
    /// El alta escribe un movimiento siempre, así que uno es
    /// «recién creada».
    const reciennacida = {
      etapa: EtapaOportunidad.CAPTADO,
      gestiones: 0,
      movimientos: 1,
    };

    it('lo que entró por error y nadie tocó se borra', () => {
      expect(puedeBorrarse(reciennacida).puede).toBe(true);
    });

    it('fuera de CAPTADO no se borra: se cierra', () => {
      const v = puedeBorrarse({
        ...reciennacida,
        etapa: EtapaOportunidad.CONTACTADO,
      });
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('perdida');
    });

    it('con gestiones no se borra, aunque siga en CAPTADO', () => {
      const v = puedeBorrarse({ ...reciennacida, gestiones: 2 });
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('2 gestiones');
    });

    it('una sola gestión se dice en singular', () => {
      const v = puedeBorrarse({ ...reciennacida, gestiones: 1 });
      expect(v.porque).toContain('1 gestión registrada');
    });

    /**
     * El caso por el que se miran los movimientos: reabrir una
     * perdida la devuelve a CAPTADO, y sin esto reabrir sería el
     * camino para borrar una oportunidad con toda su historia.
     */
    it('una reabierta vuelve a CAPTADO pero ya tiene historia', () => {
      const v = puedeBorrarse({ ...reciennacida, movimientos: 4 });
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('historia');
    });
  });

  describe('lo que queda escrito en la bitácora', () => {
    it('sin cambios no se narra nada: eso es lo que evita el ruido', () => {
      expect(narrarEdicion(ficha(), ficha())).toEqual([]);
    });

    /// «Valor cotizado» y no «Valor»: desde que existe lo facturado,
    /// «Valor» a secas no dice cuál de las dos cifras cambió.
    it('el valor se narra con el antes y el después', () => {
      const lineas = narrarEdicion(ficha(), ficha({ valor: 18_000_000 }));
      expect(lineas).toEqual([
        'Valor cotizado: 12.000.000 COP → 18.000.000 COP',
      ]);
    });

    it('valor y moneda van en una sola línea, porque se mueven juntos', () => {
      const lineas = narrarEdicion(
        ficha(),
        ficha({ valor: 3_000, moneda: 'USD' }),
      );
      expect(lineas).toEqual(['Valor cotizado: 12.000.000 COP → 3.000 USD']);
    });

    it('facturar por primera vez queda escrito', () => {
      const lineas = narrarEdicion(
        ficha(),
        ficha({ valorFacturado: 11_900_000 }),
      );
      expect(lineas).toEqual([
        'Valor facturado: sin facturar → 11.900.000 COP',
      ]);
    });

    it('corregir lo facturado dice el antes y el después', () => {
      const lineas = narrarEdicion(
        ficha({ valorFacturado: 11_900_000 }),
        ficha({ valorFacturado: 10_000_000 }),
      );
      expect(lineas).toEqual([
        'Valor facturado: 11.900.000 COP → 10.000.000 COP',
      ]);
    });

    it('quitarlo lo devuelve a «sin facturar», y se dice', () => {
      const lineas = narrarEdicion(
        ficha({ valorFacturado: 11_900_000 }),
        ficha({ valorFacturado: null }),
      );
      expect(lineas).toEqual([
        'Valor facturado: 11.900.000 COP → sin facturar',
      ]);
    });

    /// Sin facturar y facturado en cero son dos hechos, y en la
    /// bitácora tienen que leerse distinto.
    it('facturar en cero no se confunde con no haber facturado', () => {
      const lineas = narrarEdicion(ficha(), ficha({ valorFacturado: 0 }));
      expect(lineas).toEqual(['Valor facturado: sin facturar → 0 COP']);
    });

    it('lo facturado va en su propia línea, aparte de lo cotizado', () => {
      const lineas = narrarEdicion(
        ficha(),
        ficha({ valor: 12_500_000, valorFacturado: 11_900_000 }),
      );
      expect(lineas).toEqual([
        'Valor cotizado: 12.000.000 COP → 12.500.000 COP',
        'Valor facturado: sin facturar → 11.900.000 COP',
      ]);
    });

    it('guardar lo facturado sin cambiarlo no escribe nada', () => {
      expect(
        narrarEdicion(
          ficha({ valorFacturado: 11_900_000 }),
          ficha({ valorFacturado: 11_900_000 }),
        ),
      ).toEqual([]);
    });

    /// Las fichas de antes no traen la clave: no es un cambio de
    /// «nada» a «sin facturar».
    it('una ficha vieja sin lo facturado no inventa un cambio', () => {
      expect(narrarEdicion(ficha(), ficha({ valorFacturado: null }))).toEqual(
        [],
      );
    });

    /// La misma cifra en otra moneda es otra plata: se narra aunque
    /// el número no se haya movido.
    it('si cambia la moneda, lo facturado se narra aunque la cifra sea igual', () => {
      const lineas = narrarEdicion(
        ficha({ valor: 0, valorFacturado: 0 }),
        ficha({ valor: 0, valorFacturado: 0, moneda: 'USD' }),
      );
      expect(lineas).toEqual([
        'Valor cotizado: 0 COP → 0 USD',
        'Valor facturado: 0 COP → 0 USD',
      ]);
    });

    it('la campaña vacía se dice, no se calla', () => {
      const lineas = narrarEdicion(ficha(), ficha({ campana: 'Feria 2026' }));
      expect(lineas).toEqual(['Campaña: sin campaña → Feria 2026']);
    });

    it('elegir el servicio del portafolio queda escrito, con su familia', () => {
      const lineas = narrarEdicion(
        ficha(),
        ficha({ servicio: 'Google Workspace Business Plus (Empresas)' }),
      );
      expect(lineas).toEqual([
        'Servicio: sin servicio → Google Workspace Business Plus (Empresas)',
      ]);
    });

    it('la cantidad se narra, y borrarla también', () => {
      expect(narrarEdicion(ficha(), ficha({ cantidad: 40 }))).toEqual([
        'Cantidad: sin cantidad → 40',
      ]);
      expect(narrarEdicion(ficha({ cantidad: 40 }), ficha({ cantidad: null }))).toEqual([
        'Cantidad: 40 → sin cantidad',
      ]);
    });

    it('una ficha vieja sin servicio no inventa un cambio', () => {
      /// Las fichas de antes del portafolio no traen la clave: no es
      /// un cambio de «nada» a «null».
      expect(narrarEdicion(ficha(), ficha({ servicio: null, cantidad: null }))).toEqual([]);
    });

    it('quitar la fecha de cierre queda escrito', () => {
      const lineas = narrarEdicion(ficha(), ficha({ cierreEsperado: null }));
      expect(lineas).toEqual(['Cierre esperado: 30/06/2026 → sin fecha']);
    });

    /// La fecha de cierre es un día, no un instante: la misma fecha
    /// con otra hora no es un cambio que nadie quiera leer.
    it('la misma fecha con otra hora no es un cambio', () => {
      const lineas = narrarEdicion(
        ficha(),
        ficha({ cierreEsperado: new Date('2026-06-30T18:45:00.000Z') }),
      );
      expect(lineas).toEqual([]);
    });

    it('varios campos, varias líneas', () => {
      const lineas = narrarEdicion(
        ficha(),
        ficha({ titulo: 'Diplomado en comercio exterior', valor: 15_000_000 }),
      );
      expect(lineas).toHaveLength(2);
    });

    it('el traspaso dice de quién a quién', () => {
      expect(narrarAsesor('Ana Pérez', 'Luis Gómez')).toBe(
        'Pasó de Ana Pérez a Luis Gómez',
      );
      expect(narrarAsesor(null, 'Luis Gómez')).toBe('Asignada a Luis Gómez');
      expect(narrarAsesor('Ana Pérez', null)).toContain('Ana Pérez la soltó');
    });

    it('la probabilidad dice si se puso a mano o si se soltó', () => {
      expect(narrarProbabilidad(50, 10, true)).toContain('manualmente');
      expect(narrarProbabilidad(10, 50, false)).toContain('su etapa');
    });

    it('atar y corregir el cliente se narran distinto', () => {
      expect(narrarCliente('empresa', null, 'ACME S.A.S.')).toBe(
        'Atada a la empresa ACME S.A.S.',
      );
      expect(narrarCliente('empresa', 'ACME S.A.S.', 'ACME Ltda.')).toBe(
        'Empresa: ACME S.A.S. → ACME Ltda.',
      );
    });
  });

  describe('el formato no depende del contenedor', () => {
    it('los miles van con punto', () => {
      expect(enDinero(12_000_000, 'COP')).toBe('12.000.000 COP');
      expect(enDinero(999, 'COP')).toBe('999 COP');
      expect(enDinero(0, 'USD')).toBe('0 USD');
    });

    it('lo facturado vacío se dice con palabras, no como cero', () => {
      expect(enFacturado(null, 'COP')).toBe('sin facturar');
      expect(enFacturado(0, 'COP')).toBe('0 COP');
      expect(enFacturado(11_900_000, 'COP')).toBe('11.900.000 COP');
    });

    /// En UTC: leer el cierre en hora de Bogotá lo enseñaría siempre
    /// como el día anterior.
    it('la fecha se lee en UTC, que es como se guardó', () => {
      expect(fechaCorta(new Date('2026-06-30T00:00:00.000Z'))).toBe(
        '30/06/2026',
      );
      expect(fechaCorta(new Date('2026-01-05T00:00:00.000Z'))).toBe(
        '05/01/2026',
      );
      expect(fechaCorta(null)).toBe('sin fecha');
    });
  });
});
