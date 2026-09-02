/** La sede pedida distingue Medellín de Antioquia. */

/**
 * Los casos son los REALES de producción, no inventados:
 * `adecopria AF7` es HÍBRIDA y se dicta en ANTIOQUIA
 * (departamento, virtual, 117 cupos) y en MEDELLÍN (ciudad,
 * presencial, 78). Para quien vive en Medellín son dos opciones
 * distintas, y hoy el sistema se queda siempre con la virtual.
 */

import { sedePedida, type SedeCandidata } from './sede-pedida';

const of = (nombre: string, tipo: 'CIUDAD' | 'DEPARTAMENTO', af = 'af7') => ({
  id: nombre.toLowerCase(),
  accionFormacionId: af,
  ubicacion: { nombre, tipo },
});

/// Las ofertas de verdad de adecopria AF7.
const AF7: SedeCandidata[] = [
  of('ANTIOQUIA', 'DEPARTAMENTO'),
  of('BOGOTÁ D.C', 'DEPARTAMENTO'),
  of('CAUCA', 'DEPARTAMENTO'),
  of('MEDELLÍN', 'CIUDAD'),
  of('PEREIRA', 'CIUDAD'),
];

function elegida(texto: string | null, ofertas = AF7, af = 'af7') {
  const r = sedePedida(texto, ofertas, af);
  if (r === null) return 'NO_LA_MANDO';
  if ('sede' in r) return r.sede.ubicacion.nombre;
  if ('ambigua' in r) return 'AMBIGUA';
  return 'NINGUNA';
}

describe('el caso que hoy está roto: AF7 en Medellín', () => {
  it('sede «Medellín» da la PRESENCIAL, no la departamental', () => {
    /// Es el arreglo entero. Traduciendo el nombre a ids del SEP,
    /// «Medellín» daría (dep 5, mun 5001) y ese 5 casaría también
    /// con ANTIOQUIA: las dos seguirían dentro y el desempate por
    /// cupo devolvería la virtual otra vez.
    expect(elegida('Medellín')).toBe('MEDELLÍN');
  });

  it('sede «Antioquia» da la VIRTUAL', () => {
    expect(elegida('Antioquia')).toBe('ANTIOQUIA');
  });

  it('y no se confunden entre ellas en ningún sentido', () => {
    expect([elegida('MEDELLIN'), elegida('ANTIOQUIA')]).toEqual([
      'MEDELLÍN',
      'ANTIOQUIA',
    ]);
  });
});

describe('se escribe como se escriba', () => {
  it.each([
    ['Medellín', 'MEDELLÍN'],
    ['MEDELLIN', 'MEDELLÍN'],
    ['medellin', 'MEDELLÍN'],
    ['  Medellin  ', 'MEDELLÍN'],
    ['Antioquia', 'ANTIOQUIA'],
    ['ANTIOQUÍA', 'ANTIOQUIA'],
    ['Pereira', 'PEREIRA'],
    ['CAUCA', 'CAUCA'],
  ])('«%s» -> %s', (escrito, esperado) => {
    expect(elegida(escrito)).toBe(esperado);
  });
});

describe('Bogotá, con sus dos nombres', () => {
  it.each(['Bogotá', 'BOGOTA', 'Bogotá D.C', 'BOGOTA D.C.', 'bogota dc'])(
    '«%s» encuentra la sede de Bogotá',
    (escrito) => {
      /// El catálogo llama al departamento «BOGOTÁ D.C» y al
      /// municipio «BOGOTÁ». La gente escribe cualquiera de los
      /// dos para cualquiera de las dos cosas, y todas tienen que
      /// llegar al mismo sitio.
      expect(elegida(escrito)).toBe('BOGOTÁ D.C');
    },
  );

  it('y con la CIUDAD Bogotá pasa lo mismo', () => {
    /// britcham AF8 tiene BOGOTÁ ciudad presencial, no la
    /// departamental. Escriban lo que escriban, es la única.
    const af8 = [of('BOGOTÁ', 'CIUDAD', 'af8'), of('SANTANDER', 'DEPARTAMENTO', 'af8')];
    for (const t of ['Bogotá', 'BOGOTA D.C', 'bogota']) {
      expect(elegida(t, af8, 'af8')).toBe('BOGOTÁ');
    }
  });

  it('pero si un curso tuviera LAS DOS, no se elige: se pregunta', () => {
    /// Hoy ninguna acción las tiene --comprobado sobre las 106--
    /// pero si mañana alguien crea la que falta, elegir por cupo
    /// o por orden sería el mismo defecto que esto viene a
    /// quitar. Se deja en la mesa y lo confirma una persona.
    const ambas = [
      of('BOGOTÁ D.C', 'DEPARTAMENTO', 'afx'),
      of('BOGOTÁ', 'CIUDAD', 'afx'),
    ];
    expect(elegida('Bogotá', ambas, 'afx')).toBe('AMBIGUA');
  });
});

describe('lo que no casa se dice, no se acierta', () => {
  it('una sede donde ese curso no se dicta no elige ninguna', () => {
    expect(elegida('Cartagena')).toBe('NINGUNA');
  });

  it('y devuelve DÓNDE sí se dicta, para poder arreglarlo', () => {
    /// Un «no encontrado» sin decir qué había obliga a adivinar,
    /// y quien lo lee es un asesor con la ficha delante.
    const r = sedePedida('Cartagena', AF7, 'af7');
    expect(r).toEqual({
      ninguna: ['ANTIOQUIA', 'BOGOTÁ D.C', 'CAUCA', 'MEDELLÍN', 'PEREIRA'],
    });
  });

  it('vacío no es un error: es que no la mandó', () => {
    for (const t of [null, '', '   ']) expect(elegida(t)).toBe('NO_LA_MANDO');
  });
});

describe('solo las sedes de SU curso', () => {
  it('una sede de otra acción no se elige aunque el nombre case', () => {
    const mezcla = [of('MEDELLÍN', 'CIUDAD', 'af9'), of('ANTIOQUIA', 'DEPARTAMENTO', 'af7')];
    expect(elegida('Medellín', mezcla, 'af7')).toBe('NINGUNA');
  });
});
