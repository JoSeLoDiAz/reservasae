/** La cédula que se teclea en la llamada, cruzada antes de usarla. */

/**
 * El caso, previsto por el propio cliente: «puede ser que lo
 * pongan mal». El asesor oye mal un dígito y teclea la cédula de
 * otra persona que YA está en el sistema.
 *
 * Sin esto, `crm.crear` hace `upsert` por (tipo, número): reutiliza
 * la Persona del tercero y le pisa el correo, el celular, el
 * género y el domicilio con los de este lead. Ese celular acaba
 * viajando al SENA como suyo.
 *
 * TRES SALIDAS Y NO DOS. Lo que este spec recorre es la superficie
 * —las tres— y no los casos que se me ocurran: es la lección de
 * `escalera.spec`, que probaba pares elegidos a mano y por eso no
 * vio que uno había quedado imposible.
 *
 * El doble de Prisma BUSCA DE VERDAD por (tipo, número). Uno que
 * devolviera siempre la misma persona probaría el doble, no el
 * candado — el error que este proyecto ya cometió con el que
 * decidía por el prefijo del id.
 */

import { DeQuienEsEseDocumento, pistaDe } from './de-quien-es-ese-documento';

type PersonaFalsa = {
  id: string;
  tipoDocumentoSepId: number;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
};

const JAVIER: PersonaFalsa = {
  id: 'per-javier',
  tipoDocumentoSepId: 1,
  numeroDocumento: '1020304050',
  primerNombre: 'Javier',
  segundoNombre: 'Andrés',
  primerApellido: 'Rodríguez',
  segundoApellido: 'Gómez',
};

const MARIA: PersonaFalsa = {
  id: 'per-maria',
  tipoDocumentoSepId: 1,
  numeroDocumento: '1020304051',
  primerNombre: 'María',
  segundoNombre: null,
  primerApellido: 'Cifuentes',
  segundoApellido: 'Peña',
};

function armar(personas: PersonaFalsa[] = [JAVIER, MARIA]) {
  const prisma = {
    persona: {
      findUnique: (a: {
        where: {
          tipoDocumentoSepId_numeroDocumento: {
            tipoDocumentoSepId: number;
            numeroDocumento: string;
          };
        };
      }) => {
        /// LA LLAVE DE VERDAD, las dos partes.
        const k = a.where.tipoDocumentoSepId_numeroDocumento;
        const hay = personas.find(
          (p) =>
            p.tipoDocumentoSepId === k.tipoDocumentoSepId &&
            p.numeroDocumento === k.numeroDocumento,
        );
        return Promise.resolve(hay ?? null);
      },
    },
  };
  return new DeQuienEsEseDocumento(prisma as never);
}

describe('LIBRE: nadie tiene ese documento', () => {
  it('una cédula que no está, pasa', async () => {
    const r = await armar().mirar(1, '9999999999', 'Ana Torres');
    expect(r.que).toBe('LIBRE');
  });

  it('sin tipo no hay nada que cruzar', async () => {
    /// Que FALTE el documento lo dice `loQueLeFaltaAlLead`, que
    /// es otra pregunta. Aquí no se bloquea por eso.
    const r = await armar().mirar(null, '1020304050', 'Javier Rodríguez');
    expect(r.que).toBe('LIBRE');
  });

  it('sin número, tampoco', async () => {
    const r = await armar().mirar(1, null, 'Javier Rodríguez');
    expect(r.que).toBe('LIBRE');
  });

  it('el MISMO número con otro TIPO es otra llave', async () => {
    /// La llave son las dos partes. Mirando solo el número, un
    /// pasaporte y una cédula que coincidan chocarían.
    const r = await armar().mirar(4, '1020304050', 'Ana Torres');
    expect(r.que).toBe('LIBRE');
  });
});

describe('ES_ELLA: existe y el nombre cuadra', () => {
  it('el nombre completo, igual', async () => {
    const r = await armar().mirar(1, '1020304050', 'Javier Andrés Rodríguez Gómez');
    expect(r).toEqual({ que: 'ES_ELLA', personaId: 'per-javier' });
  });

  it('sin el segundo nombre, que es como lo dicta casi todo el mundo', async () => {
    const r = await armar().mirar(1, '1020304050', 'Javier Rodríguez Gómez');
    expect(r.que).toBe('ES_ELLA');
  });

  it('sin tildes y en mayúsculas, que es como llega de un formulario', async () => {
    /// Se reutiliza `compararNombres` del RUI justamente para
    /// esto. Una comparación propia aquí acabaría discrepando con
    /// aquella sobre si dos nombres son el mismo.
    const r = await armar().mirar(1, '1020304050', 'JAVIER ANDRES RODRIGUEZ GOMEZ');
    expect(r.que).toBe('ES_ELLA');
  });

  it('el número con puntos es el mismo número', async () => {
    /// Se normaliza antes de buscar, como en las otras ocho
    /// puertas: `1.020.304.050` y `1020304050` son la misma
    /// cédula, y aquí es donde MÁS se teclea con puntos.
    const r = await armar().mirar(1, '1.020.304.050', 'Javier Rodríguez Gómez');
    expect(r.que).toBe('ES_ELLA');
  });
});

describe('ES_DE_OTRO: el dígito mal, que es el caso que importa', () => {
  it('un dígito cambiado cae en otra persona y SE PARA', async () => {
    /// 1020304051 en vez de ...050. Es la cédula de María.
    const r = await armar().mirar(1, '1020304051', 'Javier Rodríguez Gómez');
    expect(r.que).toBe('ES_DE_OTRO');
  });

  it('y la pista dice lo justo: que no es la suya, no quién es', async () => {
    /// El asesor necesita saber que se equivocó, no de quién es
    /// esa cédula. Enseñar el nombre entero de un tercero
    /// convertiría la mesa en un buscador de personas por
    /// documento.
    const r = await armar().mirar(1, '1020304051', 'Javier Rodríguez Gómez');
    if (r.que !== 'ES_DE_OTRO') throw new Error('debía ser ES_DE_OTRO');
    expect(r.pista).toBe('M. C. P.');
    expect(r.pista).not.toMatch(/María|Cifuentes|Peña/);
  });

  it('sin nombre con que comparar, NO se deja pasar', async () => {
    /// La decisión conservadora, y es la correcta: si no se puede
    /// confirmar que es ella, dejar seguir es exactamente el
    /// fallo que esto existe para evitar.
    const r = await armar().mirar(1, '1020304050', '   ');
    expect(r.que).toBe('ES_DE_OTRO');
  });
});

describe('la pista', () => {
  it('son las iniciales, con punto', () => {
    expect(pistaDe('María Cifuentes Peña')).toBe('M. C. P.');
  });

  it('aguanta espacios de más', () => {
    expect(pistaDe('  Ana   Torres  ')).toBe('A. T.');
  });
});
