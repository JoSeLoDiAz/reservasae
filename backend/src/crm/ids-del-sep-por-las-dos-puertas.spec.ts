/** El par imposible no entra por ninguno de los dos lados. */

/**
 * `motivoDeIdInvalido` juzga el estado FINAL, y hace falta en
 * los dos sentidos.
 *
 * El primer arreglo resolvía el departamento contra lo guardado,
 * y eso cerró «mandar el municipio solo». Pero `municipioCuadra`
 * devuelve `true` en cuanto el municipio llega vacío, así que el
 * espejo seguía abierto: guardando primero Medellín y mandando
 * después el departamento de Bogotá, el par no se volvía a
 * comprobar. La misma fila imposible entrando por el otro lado.
 */

import { motivoDeIdInvalido } from './catalogos-sep';

/// 5 = Antioquia, 5001 = Medellín. 11 = Bogotá D.C.,
/// 11001 = Bogotá. Son los códigos DANE, que es lo que el SEP
/// usa como id.
const ANTIOQUIA = 5;
const MEDELLIN = 5001;
const BOGOTA_DEPTO = 11;
const BOGOTA = 11001;

describe('los dos juntos en la misma petición', () => {
  it('el par bueno pasa', () => {
    expect(
      motivoDeIdInvalido({ departamentoSepId: ANTIOQUIA, municipioSepId: MEDELLIN }),
    ).toBeNull();
  });

  it('el par imposible se rechaza', () => {
    expect(
      motivoDeIdInvalido({ departamentoSepId: BOGOTA_DEPTO, municipioSepId: MEDELLIN }),
    ).toMatch(/no pertenece/i);
  });
});

describe('partiendo la petición en dos: municipio después', () => {
  it('el municipio ajeno se rechaza contra el departamento guardado', () => {
    expect(
      motivoDeIdInvalido(
        { municipioSepId: MEDELLIN },
        { departamentoSepId: BOGOTA_DEPTO },
      ),
    ).toMatch(/no pertenece/i);
  });

  it('el municipio propio pasa', () => {
    expect(
      motivoDeIdInvalido({ municipioSepId: MEDELLIN }, { departamentoSepId: ANTIOQUIA }),
    ).toBeNull();
  });
});

describe('EL ESPEJO: partiendo la petición al revés, departamento después', () => {
  it('un departamento que no cuadra con el municipio GUARDADO se rechaza', () => {
    /// Este es el que seguía abierto. Sin él, la ficha acaba con
    /// departamento Bogotá y municipio Medellín, y esa fila el
    /// SEP la rechaza meses después.
    expect(
      motivoDeIdInvalido({ departamentoSepId: BOGOTA_DEPTO }, { municipioSepId: MEDELLIN }),
    ).not.toBeNull();
  });

  it('y el mensaje dice qué hacer, no solo que no', () => {
    /// «Cambie también el municipio» es accionable; «no
    /// pertenece» a secas deja al asesor sin saber qué tocar,
    /// porque el municipio no está en lo que acaba de mandar.
    expect(
      motivoDeIdInvalido({ departamentoSepId: BOGOTA_DEPTO }, { municipioSepId: MEDELLIN }),
    ).toMatch(/cambie también el municipio/i);
  });

  it('el departamento que sí cuadra pasa', () => {
    expect(
      motivoDeIdInvalido({ departamentoSepId: ANTIOQUIA }, { municipioSepId: MEDELLIN }),
    ).toBeNull();
  });

  it('cambiar los dos a la vez, a un par bueno, pasa', () => {
    expect(
      motivoDeIdInvalido(
        { departamentoSepId: BOGOTA_DEPTO, municipioSepId: BOGOTA },
        { departamentoSepId: ANTIOQUIA, municipioSepId: MEDELLIN },
      ),
    ).toBeNull();
  });
});

describe('sin ninguno de los dos no se inventa un error', () => {
  it('una ficha vacía no se rechaza por esto', () => {
    /// La ficha captura y casi nada bloquea guardar: rechazar
    /// aquí obligaría a tener el domicilio para tocar cualquier
    /// otro campo.
    expect(motivoDeIdInvalido({})).toBeNull();
    expect(motivoDeIdInvalido({}, {})).toBeNull();
  });

  it('un municipio inexistente se rechaza aunque llegue solo', () => {
    expect(motivoDeIdInvalido({ municipioSepId: 99999 })).not.toBeNull();
  });
});
