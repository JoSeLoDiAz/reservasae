/** Un correo que no lo es no abre la compuerta ni entra al reporte. */

/// El spec de `comun/correo.ts` prueba la funcion pura, y eso
/// no sujeta nada: devolviendo estas tres lineas a
/// `!persona.correo` seguiria pasando. Aqui se llama a las
/// funciones de verdad, que es donde estaba el defecto.

import { faltaDeLaPersona, revisar, type ParaRevisar } from './completitud';

const PERSONA = {
  correo: 'ana.ruiz@colegio.edu.co',
  celular: null,
  fechaNacimiento: new Date('1990-05-04'),
  generoSepId: 1,
  estrato: 3,
  departamentoSepId: 68,
  municipioSepId: 68001,
  barrio: 'Centro',
  direccion: 'Calle 1 # 2-3',
};

const BASE: ParaRevisar = {
  ofertaId: 'of1',
  coberturaId: 'cb1',
  accionFormacionId: 'af1',
  nivelOcupacionalSepId: 1,
  beneficiarioPrevio: false,
  tieneAutorizacion: true,
  grupoConFechas: true,
  grupoSepId: 1,
  accionSepId: 1,
  persona: PERSONA,
};

const con = (correo: string | null): ParaRevisar => ({
  ...BASE,
  persona: { ...PERSONA, correo },
});

const sinContacto = (r: { matricula: string[] }) =>
  r.matricula.some((m) => m.includes('contactarla'));

describe('la compuerta de matrícula', () => {
  it('un correo de verdad basta para poder contactarla', () => {
    expect(sinContacto(revisar(con('ana.ruiz@colegio.edu.co')))).toBe(false);
  });

  it.each(['esto-no-es-un-correo', 'no tiene', 'ana@', 'ana@ejemplo'])(
    '«%s» NO cuenta como forma de contacto',
    (malo) => {
      expect(sinContacto(revisar(con(malo)))).toBe(true);
    },
  );

  it('sin correo tampoco, que ya era así', () => {
    expect(sinContacto(revisar(con(null)))).toBe(true);
  });

  /// Lo que hace que el arreglo valga: con un celular util la
  /// persona SI se puede contactar, aunque el correo sea basura.
  it('con un celular bueno pasa aunque el correo esté mal', () => {
    const r = revisar({
      ...con('esto-no-es-un-correo'),
      persona: { ...PERSONA, correo: 'esto-no-es-un-correo', celular: '3001234567' },
    });
    expect(sinContacto(r)).toBe(false);
  });
});

describe('el reporte al SENA', () => {
  it('un correo basura sale como que falta el correo', () => {
    expect(revisar(con('esto-no-es-un-correo')).reporte).toContain(
      'falta el correo',
    );
  });

  it('uno bueno no', () => {
    expect(revisar(con('ana.ruiz@colegio.edu.co')).reporte).not.toContain(
      'falta el correo',
    );
  });
});

describe('lo que el asesor tiene que ir a completar', () => {
  it('el correo basura aparece en la lista', () => {
    expect(
      faltaDeLaPersona({
        persona: { ...PERSONA, correo: 'esto-no-es-un-correo' },
        nivelOcupacionalSepId: 1,
      }),
    ).toContain('correo');
  });

  it('el bueno no aparece', () => {
    expect(
      faltaDeLaPersona({ persona: PERSONA, nivelOcupacionalSepId: 1 }),
    ).not.toContain('correo');
  });
});
