import { ETAPAS_VIVAS } from './crm.service';
import { ETAPAS_DEL_EMBUDO, ETIQUETA_ETAPA } from './metricas-inscripciones';

/// Estas pruebas no miden un calculo: fijan un acuerdo.
///
/// Habia cuatro listas que decian ser «el embudo» con
/// contenidos distintos, y dos que decian ser «ocupar una
/// silla». Ninguna estaba mal calculada; cada pantalla
/// preguntaba por otra poblacion, y por eso los numeros no
/// cuadraban nunca. Si alguien vuelve a separarlas, esto se
/// cae y se sabe por que.

describe('el embudo es uno solo', () => {
  it('lleva las cinco etapas que trabaja el asesor', () => {
    expect(ETAPAS_DEL_EMBUDO).toEqual([
      'INTERESADO',
      'CONTACTADO',
      'DATOS_COMPLETOS',
      'INSCRITO',
      'PERDIDO',
    ]);
  });

  it('INSCRITO esta dentro: el lead no desaparece al marcarlo', () => {
    expect(ETAPAS_DEL_EMBUDO).toContain('INSCRITO');
  });

  it('cada etapa del embudo tiene su nombre de pantalla', () => {
    for (const e of ETAPAS_DEL_EMBUDO) {
      expect(ETIQUETA_ETAPA[e]).toBeTruthy();
    }
  });

  it('PERDIDO se llama «No interesado» en pantalla', () => {
    expect(ETIQUETA_ETAPA.PERDIDO).toBe('No interesado');
  });
});

describe('ocupar una silla', () => {
  it('empieza en INSCRITO, no en INTERESADO', () => {
    expect(ETAPAS_VIVAS).toEqual(['INSCRITO', 'EN_FORMACION', 'CERTIFICADO']);
  });

  it('un interesado no ocupa nada: es un nombre tecleado', () => {
    expect(ETAPAS_VIVAS).not.toContain('INTERESADO');
    expect(ETAPAS_VIVAS).not.toContain('CONTACTADO');
    expect(ETAPAS_VIVAS).not.toContain('DATOS_COMPLETOS');
  });

  it('quien se fue deja la silla', () => {
    for (const salida of ['PERDIDO', 'RETIRADO', 'DESERTO', 'ABANDONO', 'NO_APROBO']) {
      expect(ETAPAS_VIVAS).not.toContain(salida);
    }
  });
});
