/** Un «no tiene» no cuela por ninguna de las tres puertas. */

/**
 * `persona.celular` lo leen TRES reglas: lo que le falta a la
 * ficha, la compuerta de matrícula y lo que exige el reporte al
 * SEP. El arreglo se aplicó primero a una sola, así que la
 * pantalla decía que no faltaba nada, la compuerta rechazaba, y
 * el archivo que se le manda al SENA salía con «no tiene» en la
 * columna de contacto.
 *
 * Este spec recorre las tres a la vez a propósito: es lo que
 * impide que la próxima vez se arregle otra vez una de tres.
 */

import { faltaDeLaPersona, revisar } from './completitud';

const PERSONA = {
  correo: null as string | null,
  celular: null as string | null,
  fechaNacimiento: new Date('1995-04-12'),
  generoSepId: 1,
  estrato: 3,
  departamentoSepId: 5,
  municipioSepId: 5001,
  direccion: 'Calle 10 # 4-20',
  barrio: 'Laureles',
};

function ficha(celular: string | null, correo: string | null = null) {
  return {
    persona: { ...PERSONA, celular, correo },
    nivelOcupacionalSepId: 3,
    ofertaId: 'o1',
    coberturaId: 'c1',
    accionFormacionId: 'af1',
    tieneAutorizacion: true,
    empresa: null,
  };
}

/** Las tres listas, para mirarlas juntas. */
function lasTres(celular: string | null, correo: string | null = null) {
  const f = ficha(celular, correo);
  const r = revisar(f as never);
  return {
    ficha: faltaDeLaPersona(f as never).join(' · '),
    matricula: r.matricula.join(' · '),
    reporte: r.reporte.join(' · '),
  };
}

describe('un celular de verdad pasa las tres', () => {
  it('no lo menciona ninguna', () => {
    const t = lasTres('3001234567');
    expect(t.ficha).not.toMatch(/celular/i);
    expect(t.matricula).not.toMatch(/celular/i);
    expect(t.reporte).not.toMatch(/celular/i);
  });
});

describe('un «no tiene» NO pasa ninguna de las tres', () => {
  it('la ficha lo dice', () => {
    /// Antes decía que no faltaba nada mientras la compuerta
    /// rechazaba: la pantalla y el servidor discrepando sobre el
    /// mismo dato.
    expect(lasTres('no tiene').ficha).toMatch(/celular/i);
  });

  it('la compuerta de matrícula lo rechaza', () => {
    expect(lasTres('no tiene').matricula).toMatch(/contactarla/i);
  });

  it('el REPORTE al SEP lo rechaza, que es lo que importa', () => {
    /// Sin esto la fila salía en el archivo con «no tiene» en la
    /// columna de contacto, y el cliente arma sus INSERT
    /// concatenando celdas.
    expect(lasTres('no tiene').reporte).toMatch(/celular/i);
  });

  it('y dice que NO ES UN NÚMERO, no que falte', () => {
    /// El alistamiento agrupa por motivo y el asesor actúa sobre
    /// esa lista: «falta el celular» y «el celular no es un
    /// número» se arreglan de formas distintas.
    const t = lasTres('no tiene');
    expect(t.reporte).toMatch(/no es un número/i);
    expect(t.reporte).not.toMatch(/falta el celular/i);
  });
});

describe('vacío sigue siendo «falta», no «es inválido»', () => {
  it('el mensaje distingue los dos casos', () => {
    const t = lasTres(null);
    expect(t.reporte).toMatch(/falta el celular/i);
    expect(t.reporte).not.toMatch(/no es un número/i);
  });
});

describe('un fijo no sirve como celular en ninguna', () => {
  it('la columna del SEP es de celular', () => {
    expect(lasTres('6041234567').reporte).toMatch(/celular/i);
  });
});

describe('con correo, la matrícula pasa pero el reporte no', () => {
  it('son dos exigencias distintas y se mantienen distintas', () => {
    /// Matricular pide UNA forma de contacto; el reporte pide
    /// las dos columnas. Un celular inválido no puede colar en
    /// la segunda por tener correo.
    const t = lasTres('no tiene', 'ana@ejemplo.test');
    expect(t.matricula).not.toMatch(/contactarla/i);
    expect(t.reporte).toMatch(/no es un número/i);
  });
});
