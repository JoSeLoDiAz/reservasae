/** Del texto del lead sale un curso, o no sale ninguno. */

/**
 * Lo que se fija aquí no es el parseo: es CUÁNDO NO se resuelve.
 * Un lead con un curso que no tenemos no es un lead de otro
 * curso — es uno al que hay que preguntarle. Adivinarlo lo mete
 * en una formación que no pidió, y eso llega al reporte del SENA.
 */

import { accionQuePidio, codigoQuePidio } from './accion-que-pidio';

/// Como están en producción: mismo código, curso distinto.
const ADECOPRIA = [
  { id: 'a1', codigo: 'AF1', visible: true },
  { id: 'a2', codigo: 'AF2', visible: true },
  { id: 'a7', codigo: 'AF7', visible: true },
];

describe('sacar el código de lo que la persona escribió', () => {
  it('el caso que pidió el cliente', () => {
    expect(codigoQuePidio('AF1 - Los nuevos retos')).toBe('AF1');
  });

  it('con el código solo', () => {
    expect(codigoQuePidio('AF1')).toBe('AF1');
  });

  it('en minúscula, con espacio, o con cero delante', () => {
    /// Quien rotula la opción en el formulario de Meta no
    /// controla cómo se escribe. Rechazar por un espacio sería
    /// perder el lead por una coma.
    for (const t of ['af1', 'AF 1', 'AF01', 'af 01']) {
      expect({ t, sale: codigoQuePidio(t) }).toEqual({ t, sale: 'AF1' });
    }
  });

  it('dentro de una frase más larga', () => {
    expect(codigoQuePidio('Me interesa el curso AF7 de la tarde')).toBe('AF7');
  });

  it('sin nada que parezca un código, null', () => {
    for (const t of ['', null, undefined, 'quiero estudiar', 'AFX', 'AF']) {
      expect({ t, sale: codigoQuePidio(t) }).toEqual({ t, sale: null });
    }
  });

  it('«AF» pegado a otra palabra no cuenta', () => {
    /// `\b` en los dos lados: sin eso, «GRAFICO1» daría AF1.
    expect(codigoQuePidio('DRAFT1')).toBeNull();
  });
});

describe('resolver contra el catálogo de SU gremio', () => {
  it('devuelve la acción cuando existe', () => {
    expect(accionQuePidio('AF2 - lo que sea', ADECOPRIA)?.id).toBe('a2');
  });

  it('un código que ese gremio NO tiene devuelve null', () => {
    /// ADECOPRIA llega hasta AF7; BRITCHAM tiene AF8. Devolver
    /// «la más parecida» metería a la persona en otro curso.
    expect(accionQuePidio('AF8', ADECOPRIA)).toBeNull();
  });

  it('una acción no publicada tampoco vale', () => {
    /// Si no está visible no se está ofreciendo. Apuntar a
    /// alguien ahí desde fuera se salta la decisión de no
    /// ofrecerla al público.
    const conOculta = [...ADECOPRIA, { id: 'a9', codigo: 'AF9', visible: false }];
    expect(accionQuePidio('AF9', conOculta)).toBeNull();
  });

  it('sin texto no se resuelve nada', () => {
    expect(accionQuePidio(null, ADECOPRIA)).toBeNull();
    expect(accionQuePidio('me interesa', ADECOPRIA)).toBeNull();
  });
});

describe('el mismo código en los dos gremios es OTRO curso', () => {
  it('cada catálogo devuelve el suyo, nunca el del otro', () => {
    /// Es la razón por la que esto recibe el catálogo del
    /// convenio y no busca en toda la tabla: en producción
    /// AF1 de ADECOPRIA es neuroeducación y AF1 de BRITCHAM es
    /// agentes autónomos.
    const BRITCHAM = [{ id: 'b1', codigo: 'AF1', visible: true }];

    expect(accionQuePidio('AF1', ADECOPRIA)?.id).toBe('a1');
    expect(accionQuePidio('AF1', BRITCHAM)?.id).toBe('b1');
  });
});
