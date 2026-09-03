/** A quién ofrece el lote de grupo, y a quién no. */

/**
 * El cliente lo pidió así: «si el grupo es en Bogotá, que me muestre
 * los que seleccionaron Bogotá; y si es presencial o virtual, el grupo
 * también debe filtrar».
 *
 * Lo que este spec fija es que esas DOS condiciones son UNA: como
 * `Oferta` es única por `(accionFormacionId, ubicacionId)`, «misma
 * acción + misma sede» colapsa en `ofertaId`. Si alguien la sustituye
 * por una comparación de nombres de ciudad o de tipos de ubicación,
 * estos tests caen.
 *
 * Y fija lo que MÁS fácil se rompe al «mejorar» esto: que la
 * modalidad no puede filtrar personas —una persona no tiene
 * modalidad— y que el lote solo RELLENA el hueco, nunca mueve a nadie
 * de cohorte.
 */

import {
  cuantosCaben,
  elegiblesDelGrupo,
  porQueNoCuadraLaCelda,
} from './elegibles-del-grupo';
import { NO_RECIBEN_GRUPO, OCUPAN_SILLA, RETIENEN_ASIENTO } from './etapas';

describe('el where: cuatro igualdades y ni un OR', () => {
  const w = elegiblesDelGrupo({ ofertaId: 'of-1', convenioId: 'c-1' });

  it('acota por la OFERTA, que ya es acción + sede', () => {
    /// Si alguien lo cambia por comparar nombres de ciudad, esto cae.
    expect(w.ofertaId).toBe('of-1');
  });

  it('y por el convenio, aunque el ámbito ya haya acotado', () => {
    expect(w.convenioId).toBe('c-1');
  });

  it('SOLO los que no tienen grupo', () => {
    /// Es lo que vuelve seguro al lote: rellena el hueco y nunca
    /// mueve a nadie de cohorte. Cambiar de grupo afecta a dos cupos
    /// y a lo que se le reportó al SENA: eso se hace ficha por ficha.
    expect(w.coberturaId).toBeNull();
  });

  it('y quien salió NO recibe cohorte', () => {
    expect(w.etapa).toEqual({ notIn: NO_RECIBEN_GRUPO });
  });

  it('no lleva NINGÚN filtro de modalidad', () => {
    /// Una persona no tiene modalidad: la tiene su oferta, y la
    /// oferta ya quedó fijada por la sede. Meterla aquí solo podría
    /// no hacer nada o vaciar el lote entero.
    expect(JSON.stringify(w)).not.toMatch(/modalidad/i);
  });
});

describe('las etapas: quién entra en la lista', () => {
  /// EL ASERTO QUE PROTEGE DE LA EQUIVOCACIÓN MÁS FÁCIL.
  ///
  /// `OCUPAN_SILLA` son solo INSCRITO, EN_FORMACION y CERTIFICADO.
  /// Usarla aquí devolvería CERO de los que necesitan grupo, porque
  /// el montón de la pauta es INTERESADO y CONTACTADO.
  const DEL_MONTON = ['INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS'] as const;

  it.each(DEL_MONTON)('%s SÍ entra: es el montón de la pauta', (e) => {
    expect(NO_RECIBEN_GRUPO).not.toContain(e);
  });

  it('INSCRITO también, y son los más valiosos', () => {
    /// Desde el 3 sep 2026 se inscribe sin grupo, así que estos son
    /// exactamente los que `completitud.ts` deja fuera del reporte
    /// con «no tiene grupo asignado».
    expect(NO_RECIBEN_GRUPO).not.toContain('INSCRITO');
  });

  it.each(['RETIRADO', 'DESERTO', 'ABANDONO', 'NO_APROBO', 'PERDIDO'] as const)(
    '%s NO entra',
    (e) => {
      expect(NO_RECIBEN_GRUPO).toContain(e);
    },
  );

  it('RETIENEN_ASIENTO no es OCUPAN_SILLA, y esa es la clave', () => {
    /// Si fueran la misma, contar los apuntados de una celda daría
    /// solo los inscritos: el grupo se vería vacío con doscientos
    /// interesados dentro y el lote metería otros doscientos encima.
    expect(RETIENEN_ASIENTO.length).toBeGreaterThan(OCUPAN_SILLA.length);
    expect(RETIENEN_ASIENTO).toEqual(expect.arrayContaining([...OCUPAN_SILLA]));
    expect(RETIENEN_ASIENTO).toContain('INTERESADO');
  });
});

describe('la celda tiene que cuadrar con la oferta', () => {
  const CELDA = {
    ubicacionId: 'u-bogota',
    modalidad: 'VIRTUAL',
    numero: 1,
    sede: 'BOGOTÁ D.C',
  };

  it('con la misma sede y la misma modalidad, cuadra', () => {
    expect(
      porQueNoCuadraLaCelda(CELDA, {
        ubicacionId: 'u-bogota',
        modalidad: 'VIRTUAL',
      }),
    ).toBeNull();
  });

  it('sin oferta en esa sede, se dice y no se asigna', () => {
    const r = porQueNoCuadraLaCelda(CELDA, null);
    expect(r).toMatch(/no tiene oferta/i);
  });

  it('con OTRA modalidad, se para', () => {
    /// Hoy no salta nunca —las 106 ofertas y las 114 coberturas del
    /// catálogo casan— y por eso mismo tiene que estar: si salta,
    /// alguien movió el catálogo y está a punto de reportarle al SENA
    /// una cohorte presencial hecha de gente que se apuntó a virtual.
    const r = porQueNoCuadraLaCelda(CELDA, {
      ubicacionId: 'u-bogota',
      modalidad: 'PRESENCIAL',
    });
    expect(r).toMatch(/VIRTUAL/);
    expect(r).toMatch(/PRESENCIAL/);
  });

  it('con otra sede, también', () => {
    const r = porQueNoCuadraLaCelda(CELDA, {
      ubicacionId: 'u-medellin',
      modalidad: 'VIRTUAL',
    });
    expect(r).toMatch(/no es de esa sede/i);
  });
});

describe('cuántos caben', () => {
  it('el tope menos los apuntados', () => {
    expect(cuantosCaben({ cuposMaximos: 65, apuntados: 42 })).toBe(23);
  });

  it('nunca negativo, aunque haya sobrecupo autorizado', () => {
    /// El sobrecupo se permite y deja firma, así que una celda puede
    /// tener más apuntados que su tope. Devolver -5 haría que el
    /// `slice` del lote se comiera el final de la lista.
    expect(cuantosCaben({ cuposMaximos: 30, apuntados: 35 })).toBe(0);
  });

  it('y con la celda vacía, caben todos', () => {
    expect(cuantosCaben({ cuposMaximos: 65, apuntados: 0 })).toBe(65);
  });
});
