/** La mesa dice qué sede le tocará, con la MISMA regla que la conversión. */

/**
 * Lo pidió el cliente: «en el lead que llegue, que ya diga la acción
 * de formación y la cobertura que quiera, y al pasarlo a interesado
 * que lleve eso cargado».
 *
 * La segunda mitad ya funcionaba —`convertir` deduce la sede con
 * `sedeQueLeToca` y la ficha nace con ella— pero la mesa no la
 * enseñaba: el asesor convertía a ciegas, sin saber si iba a nacer
 * pudiendo matricularse o si el departamento de esa persona no tiene
 * ese curso.
 *
 * LO QUE ESTE SPEC SUJETA ES QUE LAS DOS USEN LA MISMA FUNCIÓN. Si
 * la mesa dedujera la sede con una regla propia, enseñaría una y la
 * conversión escribiría otra — y eso es peor que no decir nada,
 * porque el asesor decide mirando un dato falso. Es el patrón que
 * este repositorio lleva seis rondas documentando.
 *
 * Y hay una razón para escribirlo así: al añadir la consulta, los
 * 1268 tests siguieron en verde porque el doble de
 * `mesa-de-entrada.spec` no tiene `oferta.findMany` y el código
 * nuevo no llegaba a correr. Verde sin ejercer nada.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sedeQueLeToca, type OfertaCandidata } from './sede-que-le-toca';

const MESA = readFileSync(join(__dirname, 'mesa-de-entrada.service.ts'), 'utf8');
const CONVERSION = readFileSync(join(__dirname, 'conversion.service.ts'), 'utf8');

describe('las dos deducen la sede con la misma DECISIÓN', () => {
  /**
   * ESTE BLOQUE ESTABA MAL Y DEJÓ PASAR EL DEFECTO QUE DICE
   * IMPEDIR. Comprobaba que las dos contuvieran `sedeQueLeToca(`,
   * y las dos lo contenían — pero la conversión hacía ADEMÁS otra
   * cosa antes: honrar `lead.sedePedida` y devolver null si ese
   * curso no la dicta. O sea que compartían la función y no la
   * decisión, y el spec no sabía distinguirlo.
   *
   * El efecto, comprobado en vivo: un lead de Bucaramanga que
   * pide AF1 en Cartagena sale en la mesa con «Sede: SANTANDER»
   * y su ficha nace con `ofertaId = NULL`.
   *
   * Ahora se fija la función que contiene la decisión ENTERA, y
   * se prohíbe que cualquiera de las dos llame a las mitades por
   * su cuenta — que es lo único que distingue «comparten la
   * decisión» de «comparten un trozo».
   */
  it('la mesa llama a `sedeQueTendra`', () => {
    expect(MESA).toContain('sedeQueTendra(');
  });

  it('y la conversión también', () => {
    expect(CONVERSION).toContain('sedeQueTendra(');
  });

  it('y NINGUNA de las dos llama a las mitades por su cuenta', () => {
    /// `sedeQueLeToca` es media decisión y `sedePedida` la otra
    /// media. Quien llame a una sola vuelve a tener media regla,
    /// que es exactamente como se produjo el defecto.
    for (const [nombre, fuente] of [
      ['la mesa', MESA],
      ['la conversión', CONVERSION],
    ] as const) {
      expect([nombre, fuente.includes('sedeQueLeToca(')]).toEqual([nombre, false]);
      expect([nombre, fuente.includes('sedePedida(')]).toEqual([nombre, false]);
    }
  });

  it('la mesa trae `sedePedida` de la base', () => {
    /// Sin el campo en el `select`, `sedeQueTendra` lo recibe
    /// undefined y se comporta como la mitad vieja: en verde y
    /// enseñando la sede equivocada.
    expect(MESA).toContain('sedePedida: true');
  });

  it('la mesa NO tiene un `cubreA` propio', () => {
    /// Si alguien resuelve la sede aquí a mano, la mesa enseñaría
    /// una sede y la conversión escribiría otra.
    expect(MESA).not.toContain('cubreA(');
  });

  it('y la sede se resuelve en UNA consulta, no una por fila', () => {
    /// Con volumen de pauta la mesa es la pantalla que más se abre.
    /// Preguntando lead a lead, una mesa de 200 haría 200 viajes.
    expect(MESA).toContain('cursosDeLosLeads');
    expect(MESA).toContain('accionFormacionId: { in: cursosDeLosLeads }');
  });

  it('y la consulta de ofertas va acotada por el ámbito', () => {
    /// Sin esto, la mesa de un gremio deduciría la sede contra las
    /// ofertas del otro.
    const i = MESA.indexOf('accionFormacionId: { in: cursosDeLosLeads }');
    expect(MESA.slice(i, i + 200)).toContain('convenioId: { in: ambito }');
  });
});

/// Las ofertas de un curso en tres sitios: una ciudad de Antioquia,
/// el departamento entero, y otro departamento.
const OFERTAS: OfertaCandidata[] = [
  {
    id: 'of-medellin',
    accionFormacionId: 'af1',
    cuposMaximos: 60,
    cuposOcupados: 55,
    ubicacion: { nombre: 'MEDELLÍN', tipo: 'CIUDAD', departamento: 'ANTIOQUIA' },
  },
  {
    id: 'of-antioquia',
    accionFormacionId: 'af1',
    cuposMaximos: 40,
    cuposOcupados: 0,
    ubicacion: { nombre: 'ANTIOQUIA', tipo: 'DEPARTAMENTO', departamento: 'ANTIOQUIA' },
  },
  {
    id: 'of-huila',
    accionFormacionId: 'af1',
    cuposMaximos: 40,
    cuposOcupados: 0,
    ubicacion: { nombre: 'HUILA', tipo: 'DEPARTAMENTO', departamento: 'HUILA' },
  },
];

describe('qué sede le toca, que es lo que la mesa va a enseñar', () => {
  it('de Medellín: gana la que más sitio libre tenga', () => {
    /// Le sirven las dos de Antioquia. El desempate es el cupo
    /// libre, y es el MISMO que usa la ficha: si aquí y allá se
    /// ordenara distinto, la misma persona caería en sedes
    /// distintas según por dónde entrara.
    const r = sedeQueLeToca(OFERTAS, 'af1', {
      departamento: 'ANTIOQUIA',
      ciudad: 'MEDELLÍN',
    });
    expect(r?.id).toBe('of-antioquia');
  });

  it('de Apartadó: la del departamento, no la de Medellín', () => {
    /// «Un grupo presencial en Medellín no le sirve a alguien de
    /// Apartadó aunque los dos sean de Antioquia.»
    const r = sedeQueLeToca(OFERTAS, 'af1', {
      departamento: 'ANTIOQUIA',
      ciudad: 'APARTADÓ',
    });
    expect(r?.id).toBe('of-antioquia');
  });

  it('de SUCRE: NINGUNA, y eso es lo que hay que decir', () => {
    /// El caso que vio el cliente en producción. Null no es un
    /// fallo: es que su departamento no tiene ese curso, y se
    /// arregla escribiéndole, no convirtiéndola.
    const r = sedeQueLeToca(OFERTAS, 'af1', {
      departamento: 'SUCRE',
      ciudad: 'SAMPUÉS',
    });
    expect(r).toBeNull();
  });

  it('sin domicilio, le sirve cualquiera', () => {
    /// `cubreA` devuelve true sin ubicación: no se puede afirmar
    /// que NO la cubre, y dejar fuera una sede buena por un dato
    /// que falta también es un error.
    const r = sedeQueLeToca(OFERTAS, 'af1', {
      departamento: null,
      ciudad: null,
    });
    expect(r).not.toBeNull();
  });

  it('y de otro curso, ninguna de estas', () => {
    const r = sedeQueLeToca(OFERTAS, 'af9', {
      departamento: 'ANTIOQUIA',
      ciudad: 'MEDELLÍN',
    });
    expect(r).toBeNull();
  });
});
