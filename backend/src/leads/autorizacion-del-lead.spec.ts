/** De quién es la autorización, y de quién no. */

/**
 * La decisión que sostiene todo el lote: la constancia NO la
 * teclea nadie.
 *
 * Quien llenó el formulario de una pauta —o el nuestro— no pudo
 * enviarlo sin aceptar la política, así que ahí hay una
 * autorización de verdad y su prueba es el propio registro que
 * quedó guardado. Quien escribió por WhatsApp no aceptó nada, y
 * a quien subió el equipo en una lista, menos.
 *
 * Estampárselo a los tres por igual sería fabricar la prueba, y
 * este archivo lo dice con todas las letras: la autorización que
 * FALTA bloquea el reporte al SENA; la FALSA lo abre.
 */

import {
  autorizoAlRegistrarse,
  evidenciaDelLead,
  loQueLeFaltaAlLead,
} from './listo-para-ficha';

import type { OrigenParticipante } from '../../generated/prisma';

describe('solo autorizó quien llenó un formulario', () => {
  it.each(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'REDES'] as OrigenParticipante[])(
    '%s llenó un formulario de la pauta: sí autorizó',
    (origen) => {
      expect(autorizoAlRegistrarse(origen)).toBe(true);
    },
  );

  it('AUTOGESTION es nuestro propio formulario: sí autorizó', () => {
    expect(autorizoAlRegistrarse('AUTOGESTION')).toBe(true);
  });

  it.each(['WHATSAPP', 'REFERIDO', 'EVENTO', 'OTRO'] as OrigenParticipante[])(
    '%s NO pasó por ningún formulario: no consta que autorizara',
    (origen) => {
      /// Este es el candado. Si alguien lo abre «para que entren
      /// todos», esas fichas entran al .xlsx que se le sube al
      /// SENA sin que nadie haya aceptado nada.
      expect(autorizoAlRegistrarse(origen)).toBe(false);
    },
  );
});

describe('la evidencia es de ESE lead, no una frase para todos', () => {
  const base = {
    origen: 'FACEBOOK' as OrigenParticipante,
    origenSistema: 'meta',
    recibidoEn: new Date('2026-08-30T14:22:00Z'),
  };

  it('lleva el id que dio el emisor y el del lead', () => {
    const e = evidenciaDelLead({ ...base, id: 'lead-abc', externoId: 'meta-999' });

    expect(e).toContain('meta-999');
    expect(e).toContain('lead-abc');
  });

  it('dos leads distintos NO comparten evidencia', () => {
    /// Es la diferencia entre cien pruebas y una frase repetida
    /// cien veces. Si esto empata, la constancia deja de apuntar
    /// a nada concreto y vuelve a ser un invento.
    const a = evidenciaDelLead({ ...base, id: 'l-1', externoId: 'ext-1' });
    const b = evidenciaDelLead({ ...base, id: 'l-2', externoId: 'ext-2' });

    expect(a).not.toEqual(b);
  });

  it('dice cuándo llegó, que es cuándo autorizó', () => {
    const e = evidenciaDelLead({ ...base, id: 'l', externoId: 'x' });
    expect(e).toContain('2026-08-30 14:22');
  });
});

describe('qué le falta a un lead para poder ser ficha', () => {
  const listo = {
    estado: 'PENDIENTE',
    participanteId: null,
    tipoDocumentoSepId: 1,
    numeroDocumento: '1020304050',
    nombreCompleto: null,
    primerNombre: 'Ana',
    primerApellido: 'Ruiz',
    accionFormacionId: 'af-1',
    origen: 'FACEBOOK' as OrigenParticipante,
  };

  it('uno completo no tiene nada que le falte', () => {
    expect(loQueLeFaltaAlLead(listo)).toEqual([]);
  });

  it('el documento con puntos vale: se normaliza igual que al convertir', () => {
    /// Si aquí no se normalizara y allá sí, la pantalla apagaría
    /// la casilla de un lead perfectamente convertible.
    expect(loQueLeFaltaAlLead({ ...listo, numeroDocumento: '1.020.304.050' })).toEqual(
      [],
    );
  });

  it('sin curso, falta el curso', () => {
    expect(loQueLeFaltaAlLead({ ...listo, accionFormacionId: null })).toEqual([
      expect.stringMatching(/curso/i),
    ]);
  });

  it('el nombre puede venir entero y se parte, como al convertir', () => {
    const r = loQueLeFaltaAlLead({
      ...listo,
      primerNombre: null,
      primerApellido: null,
      nombreCompleto: 'Ana Maria Ruiz Gomez',
    });
    expect(r).toEqual([]);
  });

  it('un nombre de una sola palabra no alcanza: falta el apellido', () => {
    const r = loQueLeFaltaAlLead({
      ...listo,
      primerNombre: null,
      primerApellido: null,
      nombreCompleto: 'Ana',
    });
    expect(r).toEqual([expect.stringMatching(/apellido/i)]);
  });

  it('uno ya atendido no dice qué más le falta: ya no está en la mesa', () => {
    const r = loQueLeFaltaAlLead({
      ...listo,
      estado: 'CONVERTIDO',
      participanteId: 'p-1',
      accionFormacionId: null,
    });
    /// Enumerarle carencias a un lead que ya es ficha confundiría
    /// a quien lo lea: lo único cierto es que ya se atendió.
    expect(r).toEqual(['ya se atendió']);
  });
});
