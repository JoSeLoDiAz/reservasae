/** Lo que falta se dice diciendo PARA QUÉ falta. */

/**
 * «TENGO PERSONAS INSCRITAS Y REALMENTE NO FALTA NINGÚN DATO»
 * (cliente, 5 oct 2026). Lo dijo tres veces antes de que lo
 * encontráramos, y tenía razón las tres.
 *
 * LA CAUSA SON DOS LISTAS DISTINTAS QUE LA PANTALLA ENSEÑABA COMO UNA.
 *
 * La compuerta para matricular ---`revisar()`--- exige exactamente
 * tres cosas:
 *
 *   - el curso CON su sede;
 *   - una forma de contactarla (correo o celular);
 *   - y la autorización de tratamiento de datos.
 *
 * NO exige la organización. NO exige los campos del SEP ---fecha de
 * nacimiento, estrato, barrio, nivel ocupacional---.
 *
 * La columna «Falta N» cuenta otra cosa: `faltaDeLaPersona` +
 * `faltaDeLaEmpresa`, que son justo esos campos del SEP y los de la
 * organización.
 *
 * De modo que una persona pasa la compuerta, se inscribe, se forma, se
 * CERTIFICA ---y la celda le sigue diciendo «Falta 1»---. El sistema la
 * dejó entrar sin pedirle eso y después se lo reprocha.
 *
 * Medido sobre la base el 5 oct 2026: 18 de 18 INSCRITO, 24 de 24
 * CERTIFICADO y 93 de 95 fichas cuya etapa se llama literalmente
 * DATOS_COMPLETOS decían que les faltaba algo.
 *
 * LO QUE SE CUENTA NO CAMBIA ---esos datos sí hacen falta para el SENA,
 * y dejar de verlos sería peor que el ruido--- lo que cambia es que se
 * dice para qué.
 */

import { paraQueFalta } from './completitud';

describe('a quien todavía no ha entrado, le falta para entrar', () => {
  it.each(['INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS'])(
    'en %s, lo que falta es para inscribirla',
    (etapa) => {
      expect(paraQueFalta(etapa)).toBe('INSCRIBIR');
    },
  );
});

describe('a quien ya entró, le falta para el reporte', () => {
  /**
   * LAS TRES QUE OCUPAN SILLA. Si está dentro del aula, lo que le
   * falte no le impide entrar: ya entró. Decirle «Falta 1» a secas es
   * mandar al asesor a arreglar algo que no bloquea nada.
   */
  it.each(['INSCRITO', 'EN_FORMACION', 'CERTIFICADO'])(
    'en %s, lo que falta es para el SENA',
    (etapa) => {
      expect(paraQueFalta(etapa)).toBe('REPORTE');
    },
  );

  /**
   * Y LAS CUATRO SALIDAS TAMBIÉN: quien no aprobó, desertó, abandonó
   * o se retiró ESTUVO DENTRO. Tratarlas como «le falta para entrar»
   * sería proponer inscribir a alguien que ya salió.
   */
  it.each(['NO_APROBO', 'DESERTO', 'ABANDONO', 'RETIRADO'])(
    'en %s, que ya salió, tampoco le falta nada para entrar',
    (etapa) => {
      expect(paraQueFalta(etapa)).toBe('REPORTE');
    },
  );
});

/**
 * LA REGLA QUE NO SE PUEDE PERDER AL TOCAR ESTO: la compuerta de
 * matrícula NO exige la organización. Está fijado aquí porque es lo
 * que explica todo el defecto, y porque si alguien se la añadiera
 * «para que cuadre», dejaría de poder inscribirse media base.
 */
describe('qué exige de verdad la compuerta para matricular', () => {
  const leer = () =>
    require('fs').readFileSync(
      require('path').join(__dirname, 'completitud.ts'),
      'utf8',
    ) as string;

  it('pide curso con sede, contacto y autorización, y nada más', () => {
    const t = leer();
    const i = t.indexOf('export function revisar');
    const j = t.indexOf('// ── reporte al SENA ──', i);
    const compuerta = t.slice(i, j);

    expect(compuerta).toContain('matricula.push');
    expect(compuerta).toContain('falta la sede');
    expect(compuerta).toContain('no hay forma de contactarla');
    expect(compuerta).toContain('no ha autorizado el tratamiento');

    /// Y NO la organización: es la mitad del hallazgo.
    expect(compuerta).not.toContain('faltaDeLaEmpresa');
    expect(compuerta).not.toContain('los datos de su organización');
  });

  /// Mientras que la columna sí los cuenta: las dos listas existen y
  /// son distintas a propósito. El defecto era no decirlo.
  it('y la columna cuenta la persona y su organización', () => {
    const t = leer();
    const i = t.indexOf('export function faltaDeLaFicha');
    const trozo = t.slice(i, i + 400);
    expect(trozo).toContain('faltaDeLaPersona');
    expect(trozo).toContain('faltaDeLaEmpresa');
  });
});

/**
 * Y LA PANTALLA LO DICE. El cálculo puede estar perfecto y quedarse
 * sin efecto si la celda no lo usa, que es exactamente lo que pasaba.
 */
describe('la celda lo enseña', () => {
  it('añade «para el SENA» cuando ya entró', () => {
    const t = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '..',
        '..',
        '..',
        'frontend',
        'src',
        'components',
        'admin',
        'columnas-participante.tsx',
      ),
      'utf8',
    ) as string;
    expect(t).toContain('f.paraQueFalta === "REPORTE"');
    expect(t).toContain('para el SENA');
  });
});
