import { EtapaOportunidad, TipoEmbudo } from '../../generated/prisma';
import { probabilidadDe, valorPonderado, esDelEmbudo } from './embudos';
import { avanza, ordenDe, puedeIr, type Hechos } from './escalera';

/// Una oportunidad de empresa que cumple todo. Cada prueba le
/// quita lo suyo: así lo que falla es lo que la prueba nombra y no
/// un descuido del montaje.
const completa = (cambios: Partial<Hechos> = {}): Hechos => ({
  embudo: TipoEmbudo.EMPRESA,
  valor: 12_000_000,
  tieneEmpresa: true,
  tienePersona: false,
  tieneAsesor: true,
  ...cambios,
});

describe('la escalera de la venta', () => {
  describe('cada embudo sube sus propios peldaños', () => {
    it('el de personas no admite «en negociación»', () => {
      const v = puedeIr(
        EtapaOportunidad.CALIFICADO,
        EtapaOportunidad.EN_NEGOCIACION,
        completa({ embudo: TipoEmbudo.PERSONA, tienePersona: true, tieneEmpresa: false }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('embudo de personas');
    });

    it('el de empresas sí, y con todo puesto pasa', () => {
      const v = puedeIr(
        EtapaOportunidad.PROPUESTA_ENVIADA,
        EtapaOportunidad.EN_NEGOCIACION,
        completa(),
      );
      expect(v.puede).toBe(true);
    });

    /// La razón de fondo: esas etapas valen 0 % en el embudo de
    /// personas, así que colar una ahí sacaría la fila del
    /// pronóstico sin que nadie lo hubiera pedido.
    it('las etapas ajenas valen cero, que es por lo que se prohíben', () => {
      expect(probabilidadDe(TipoEmbudo.PERSONA, EtapaOportunidad.EN_NEGOCIACION)).toBe(0);
      expect(esDelEmbudo(TipoEmbudo.PERSONA, EtapaOportunidad.EN_NEGOCIACION)).toBe(false);
    });
  });

  describe('calificar exige tener con qué', () => {
    it('sin valor no se califica', () => {
      const v = puedeIr(
        EtapaOportunidad.CONTACTADO,
        EtapaOportunidad.CALIFICADO,
        completa({ valor: 0 }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('valor');
    });

    it('sin empresa no se califica en el embudo de empresas', () => {
      const v = puedeIr(
        EtapaOportunidad.CONTACTADO,
        EtapaOportunidad.CALIFICADO,
        completa({ tieneEmpresa: false }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('empresa');
    });

    it('sin persona no se califica en el embudo de personas', () => {
      const v = puedeIr(
        EtapaOportunidad.CONTACTADO,
        EtapaOportunidad.CALIFICADO,
        completa({
          embudo: TipoEmbudo.PERSONA,
          tieneEmpresa: false,
          tienePersona: false,
        }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('persona');
    });

    /// Contactar es justo lo que se hace ANTES de saber nada. Si
    /// esta compuerta se pusiera aquí, el reloj de respuesta no se
    /// podría parar nunca y todo el equipo saldría en rojo.
    it('contactar no exige nada de eso', () => {
      const v = puedeIr(
        EtapaOportunidad.CAPTADO,
        EtapaOportunidad.CONTACTADO,
        completa({ valor: 0, tieneEmpresa: false }),
      );
      expect(v.puede).toBe(true);
    });
  });

  describe('cerrar exige motivo', () => {
    it('no se pierde sin decir por qué', () => {
      const v = puedeIr(EtapaOportunidad.EN_NEGOCIACION, EtapaOportunidad.PERDIDO, completa());
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('por qué');
    });

    it('no se gana con un motivo de perder', () => {
      const v = puedeIr(
        EtapaOportunidad.EN_NEGOCIACION,
        EtapaOportunidad.GANADO,
        completa({ motivo: 'NUNCA_RESPONDIO' }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('no es un motivo de ganar');
    });

    it('no se pierde con un motivo de ganar', () => {
      const v = puedeIr(
        EtapaOportunidad.EN_NEGOCIACION,
        EtapaOportunidad.PERDIDO,
        completa({ motivo: 'PRECIO_ACEPTADO' }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('no es un motivo de perder');
    });

    it('perder por «otro» sí vale: no todo se prevé', () => {
      const v = puedeIr(
        EtapaOportunidad.CALIFICADO,
        EtapaOportunidad.PERDIDO,
        completa({ motivo: 'OTRO' }),
      );
      expect(v.puede).toBe(true);
    });

    it('una venta ganada no puede valer cero', () => {
      const v = puedeIr(
        EtapaOportunidad.EN_NEGOCIACION,
        EtapaOportunidad.GANADO,
        completa({ valor: 0, motivo: 'PRECIO_ACEPTADO' }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('valor');
    });
  });

  describe('reabrir', () => {
    it('se puede, pero hay que decir qué cambió', () => {
      const sinNota = puedeIr(
        EtapaOportunidad.PERDIDO,
        EtapaOportunidad.EN_NEGOCIACION,
        completa(),
      );
      expect(sinNota.puede).toBe(false);
      expect(sinNota.porque).toContain('qué cambió');

      const conNota = puedeIr(
        EtapaOportunidad.PERDIDO,
        EtapaOportunidad.EN_NEGOCIACION,
        completa({ nota: 'Volvió con presupuesto aprobado para el otro semestre.' }),
      );
      expect(conNota.puede).toBe(true);
    });

    it('una nota en blanco no es una nota', () => {
      const v = puedeIr(
        EtapaOportunidad.PERDIDO,
        EtapaOportunidad.CALIFICADO,
        completa({ nota: '   ' }),
      );
      expect(v.puede).toBe(false);
    });
  });

  describe('dueño', () => {
    it('sin asesor no se mueve de captado', () => {
      const v = puedeIr(
        EtapaOportunidad.CAPTADO,
        EtapaOportunidad.CONTACTADO,
        completa({ tieneAsesor: false }),
      );
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('asesor');
    });

    /// CAPTADO sin dueño no es un descuido: es el estado que mide
    /// el reloj, «entró y no lo ha tomado nadie».
    it('nacer en captado sin asesor es legítimo', () => {
      const v = puedeIr(null, EtapaOportunidad.CAPTADO, completa({ tieneAsesor: false }));
      expect(v.puede).toBe(true);
    });
  });

  describe('crear ya avanzada pasa por las mismas compuertas', () => {
    it('no se crea directamente en calificado sin valor', () => {
      const v = puedeIr(null, EtapaOportunidad.CALIFICADO, completa({ valor: 0 }));
      expect(v.puede).toBe(false);
      expect(v.porque).toContain('valor');
    });
  });

  it('no se mueve a donde ya está', () => {
    const v = puedeIr(EtapaOportunidad.CALIFICADO, EtapaOportunidad.CALIFICADO, completa());
    expect(v.puede).toBe(false);
  });

  describe('orden y avance', () => {
    it('las dos formas de cerrar empatan: ni ganar es «más» que perder', () => {
      expect(ordenDe(TipoEmbudo.EMPRESA, EtapaOportunidad.GANADO)).toBe(
        ordenDe(TipoEmbudo.EMPRESA, EtapaOportunidad.PERDIDO),
      );
    });

    it('retroceder se reconoce como retroceso', () => {
      expect(avanza(TipoEmbudo.EMPRESA, EtapaOportunidad.EN_NEGOCIACION, EtapaOportunidad.CALIFICADO)).toBe(false);
      expect(avanza(TipoEmbudo.EMPRESA, EtapaOportunidad.CALIFICADO, EtapaOportunidad.EN_NEGOCIACION)).toBe(true);
    });

    it('el embudo de personas es más corto, y su orden lo refleja', () => {
      expect(ordenDe(TipoEmbudo.PERSONA, EtapaOportunidad.CALIFICADO)).toBe(2);
      expect(ordenDe(TipoEmbudo.EMPRESA, EtapaOportunidad.CALIFICADO)).toBe(2);
      expect(ordenDe(TipoEmbudo.EMPRESA, EtapaOportunidad.EN_NEGOCIACION)).toBe(4);
    });
  });
});

describe('el pronóstico', () => {
  it('pondera valor por probabilidad de la etapa', () => {
    const p = probabilidadDe(TipoEmbudo.EMPRESA, EtapaOportunidad.PROPUESTA_ENVIADA);
    expect(p).toBe(50);
    expect(valorPonderado(12_000_000, p)).toBe(6_000_000);
  });

  /// Sumar cien pronósticos con decimales sueltos descuadra el
  /// total contra la suma de las partes, y esa diferencia de tres
  /// pesos es la que hace que nadie vuelva a creerle al tablero.
  it('redondea al peso, sin decimales sueltos', () => {
    expect(valorPonderado(3_333_333, 30)).toBe(1_000_000);
    expect(Number.isInteger(valorPonderado(1_234_567, 15))).toBe(true);
  });

  it('lo captado pesa poco y lo perdido no pesa', () => {
    expect(valorPonderado(10_000_000, probabilidadDe(TipoEmbudo.EMPRESA, EtapaOportunidad.CAPTADO))).toBe(500_000);
    expect(valorPonderado(10_000_000, probabilidadDe(TipoEmbudo.EMPRESA, EtapaOportunidad.PERDIDO))).toBe(0);
  });
});
