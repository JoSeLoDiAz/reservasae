/** Las tres puertas que partían una organización en dos. */

/**
 * EL CASO DEL COLEGIO BENEDICTINO (cliente, 2 oct 2026).
 *
 * Lo encontró en producción: la misma organización en dos filas, NIT
 * `890982209` con 6 leads y NIT `8909822094` con 8. El segundo es el
 * primero con su dígito de verificación pegado detrás.
 *
 * `normalizarNit` parte el pegado desde el 30 sep. Pero TRES PUERTAS no
 * la llamaban: usaban `replace(/\D/g, '')`, que es una segunda
 * normalización —y dos normalizaciones del mismo dato son dos llaves
 * distintas—.
 *
 * LO QUE LO HACE TAN FÁCIL DE PROVOCAR: la pantalla imprime el NIT como
 * se escribe, «890.982.209-4». Copiarlo de ahí y pegarlo en cualquiera
 * de esas tres puertas daba `8909822094` y creaba la segunda fila.
 */

import { calcularDigitoVerificacion, normalizarNit } from './nit';

/// La forma vieja, para poder enseñar la diferencia.
const comoEstaba = (v: string) => v.replace(/\D/g, '');

const NUEVE = '890982209';
const CON_PUNTOS = '890.982.209-4';

describe('el NIT del Colegio Benedictino', () => {
  it('su dígito es el 4, así que el pegado es el de la segunda fila', () => {
    expect(calcularDigitoVerificacion(NUEVE)).toBe('4');
    expect(NUEVE + '4').toBe('8909822094');
  });

  /**
   * LA LÍNEA QUE LO CAUSABA, en una prueba: quitar todo lo que no es
   * dígito convierte el NIT escrito en el NIT pegado.
   */
  it('con la regla vieja, copiar de la pantalla y pegar daba OTRA llave', () => {
    expect(comoEstaba(CON_PUNTOS)).toBe('8909822094');
    expect(comoEstaba(CON_PUNTOS)).not.toBe(NUEVE);
  });

  it('y con la regla buena da la misma, venga como venga', () => {
    for (const escrito of [
      CON_PUNTOS,
      '890982209-4',
      '8909822094',
      '890982209',
      '  890.982.209 - 4 ',
    ]) {
      expect(normalizarNit(escrito)?.nit).toBe(NUEVE);
    }
  });
});

describe('lo que no se puede romper al arreglarlo', () => {
  /**
   * UNA CÉDULA DE DIEZ DÍGITOS NO SE PARTE. Es la tercera condición de
   * `traeElDvPegado` y la que lo hace seguro: hay independientes con
   * cédula registrada como NIT.
   */
  it('una cédula de diez dígitos se queda entera', () => {
    /// Empieza por 1, así que no entra por la regla del 8|9.
    expect(normalizarNit('1007495352')?.nit).toBe('1007495352');
  });

  it('ni un número de diez que empiece por 8 pero cuyo último no sea su DV', () => {
    const falso = '8001837678';
    expect(calcularDigitoVerificacion('800183767')).not.toBe('8');
    expect(normalizarNit(falso)?.nit).toBe(falso);
  });

  /**
   * Y DEJA DE PODER CREARSE «ORGANIZACIÓN 1». En la base hay una
   * empresa con NIT `18` y otra con `1-8`: salieron de una puerta que
   * solo exigía «que tenga algún dígito».
   */
  it('un NIT de uno o dos dígitos ya no pasa', () => {
    expect(normalizarNit('1')).toBeNull();
    expect(normalizarNit('18')).toBeNull();
  });
});

/**
 * Y LA QUE NO SE TOCA, dicho para que nadie la 'arregle'.
 *
 * Cuando alguien declara que trabaja por su cuenta, su cédula ES su
 * RUT. Ahí el número no lleva dígito pegado: es la cédula entera.
 * Pasarla por la regla del NIT la partiría, y la persona quedaría
 * registrada con un documento que no es el suyo.
 */
describe('el RUT del independiente NO se parte', () => {
  it('su cédula se queda entera aunque empiece por 8 o 9', () => {
    const t = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '..',
        'preinscripcion/preinscripcion.service.ts',
      ),
      'utf8',
    ) as string;
    expect(t).toContain(
      "const nit = p.persona.numeroDocumento.replace(/\\D/g, '');",
    );
    expect(t).toContain('AQUÍ NO VA `normalizarNit`, Y ES A PROPÓSITO');
  });
});

describe('las tres puertas llaman a la regla única', () => {
  const leer = (ruta: string) =>
    require('fs').readFileSync(
      require('path').join(__dirname, '..', ruta),
      'utf8',
    ) as string;

  it('el formulario público de completar datos', () => {
    const t = leer('preinscripcion/preinscripcion.service.ts');
    expect(t).toContain('const leido = normalizarNit(dto.nit);');
    /// Y la comparación que decide si la ficha CAMBIA de organización,
    /// con la misma regla: normalizarlas distinto hacía parecer que
    /// cambiaba sin que nadie la cambiara, y de ahí salía el upsert
    /// que creaba la segunda fila.
    expect(t).toContain(
      'const leidoPedido = dto.nit ? normalizarNit(dto.nit) : null;',
    );
    /// Y ya no queda la vieja en ese fichero.
    expect(t).not.toContain("dto.nit.replace(/\\D/g, '')");
  });

  it('el cargue de empresas aliadas', () => {
    const t = leer('plantillas/plantillas.service.ts');
    expect(t).toContain("normalizarNit(v ?? '')?.nit ?? ''");
  });

  it('editar la organización desde el panel', () => {
    const t = leer('tableros/editar-empresa.dto.ts');
    expect(t).toContain('normalizarNit(value)?.nit');
  });
});
