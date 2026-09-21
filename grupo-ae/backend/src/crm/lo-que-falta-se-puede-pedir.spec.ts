/** Todo lo que se declara «falta» tiene dónde pedirse. */

/**
 * El defecto que este spec existe para que no vuelva:
 *
 * `faltaDeLaPersona` contaba el municipio, y el enlace público
 * de completar datos **no lo preguntaba** — la pantalla asume
 * que el domicilio se dio al reservar el cupo. Así que el panel
 * decía «le falta un dato», ofrecía el enlace para arreglarlo, y
 * el enlace no pedía ese dato. Generar otro no cambiaba nada: la
 * ficha quedaba imposible de completar por el único camino que
 * existe para completarla.
 *
 * Y no fallaba nada. La ficha simplemente no entraba al reporte
 * del SEP, que es la clase de error que se descubre tarde.
 *
 * Por eso lo que se fija aquí NO es «el municipio se pide», que
 * sería arreglar el caso de hoy. Es el CONJUNTO CERRADO de lo
 * que la regla puede llegar a exigir: si alguien añade un campo
 * obligatorio, este test falla y le obliga a decidir dónde se
 * pregunta antes de poder seguir.
 */

import { faltaDeLaPersona } from './completitud';
import {
  NO_SE_PREGUNTAN,
  seLePregunta,
  type CampoOcultable,
} from './lo-que-no-se-pregunta';

/// Lo que la regla puede pedir, y dónde se pregunta cada uno.
///
/// `RESERVA` = se captura al apartar el cupo o al crear la
/// ficha. `ENLACE` = lo pregunta `/completar/<token>`.
///
/// Si añade un campo a `faltaDeLaPersona`, añádalo aquí Y
/// asegúrese de que la pantalla que dice lo pregunta de verdad.
const DONDE_SE_PIDE: Record<string, 'RESERVA' | 'ENLACE'> = {
  correo: 'RESERVA',
  celular: 'RESERVA',
  'un celular que sea un número': 'RESERVA',
  'fecha de nacimiento': 'ENLACE',
  género: 'RESERVA',
  estrato: 'ENLACE',
  departamento: 'ENLACE',
  municipio: 'ENLACE',
  dirección: 'ENLACE',
  'barrio o vereda': 'ENLACE',
  'nivel ocupacional': 'ENLACE',
};

/// Lo de la tabla que una instalación puede dejar de preguntar.
///
/// Siguen en `DONDE_SE_PIDE` porque el enlace SÍ sabe
/// preguntarlos —el código está, oculto por configuración—. Lo
/// que cambia es que, ocultos, la regla tampoco los exige: si los
/// exigiera, sería otra vez el callejón del municipio.
const OCULTABLE_POR_TEXTO: Record<string, CampoOcultable> = {
  'fecha de nacimiento': 'fechaNacimiento',
  estrato: 'estrato',
};

const estaOculto = (texto: string) => {
  const campo = OCULTABLE_POR_TEXTO[texto];
  return campo !== undefined && !seLePregunta(campo);
};

/** Una persona sin absolutamente nada: lo pide todo. */
const VACIA = {
  persona: {
    correo: null,
    celular: null,
    fechaNacimiento: null,
    generoSepId: null,
    estrato: null,
    departamentoSepId: null,
    municipioSepId: null,
    direccion: null,
    barrio: null,
  },
  nivelOcupacionalSepId: null,
};

describe('lo que la regla exige está en la tabla', () => {
  it('una ficha vacía no pide nada que no sepamos dónde preguntar', () => {
    for (const falta of faltaDeLaPersona(VACIA as never)) {
      expect({ falta, conocido: falta in DONDE_SE_PIDE }).toEqual({
        falta,
        conocido: true,
      });
    }
  });

  it('el «celular que no es un número» también está contemplado', () => {
    /// Es un mensaje distinto del de «falta celular», y se
    /// arregla distinto: uno es pedirlo y el otro corregirlo.
    const conBasura = {
      ...VACIA,
      persona: { ...VACIA.persona, celular: 'no tiene' },
    };

    for (const falta of faltaDeLaPersona(conBasura as never)) {
      expect({ falta, conocido: falta in DONDE_SE_PIDE }).toEqual({
        falta,
        conocido: true,
      });
    }
  });

  it('la tabla no sobra: todo lo que declara lo emite la regla', () => {
    /// Sin esto, la tabla se llenaría de entradas muertas y
    /// dejaría de decir nada. Se juntan los dos escenarios
    /// porque «falta celular» y «no es un número» se excluyen.
    const emitidos = new Set([
      ...faltaDeLaPersona(VACIA as never),
      ...faltaDeLaPersona({
        ...VACIA,
        persona: { ...VACIA.persona, celular: 'no tiene' },
      } as never),
    ]);

    /// Lo oculto por configuración es la única excepción: la
    /// tabla sabe dónde se pregunta, pero esta instalación no lo
    /// pregunta, y entonces la regla tampoco lo emite.
    for (const declarado of Object.keys(DONDE_SE_PIDE)) {
      expect({ declarado, loEmite: emitidos.has(declarado) }).toEqual({
        declarado,
        loEmite: !estaOculto(declarado),
      });
    }
  });
});

describe('lo que no se pregunta, no se exige', () => {
  it('una ficha vacía no reclama nada de lo que el enlace oculta', () => {
    /// El caso concreto: Grupo AE no pregunta la fecha de
    /// nacimiento ni el estrato. Si la regla los siguiera
    /// pidiendo, cada contacto saldría «parcial» para siempre y
    /// el enlace que se le manda para completarlo no se los
    /// preguntaría.
    const falta = faltaDeLaPersona(VACIA as never);
    for (const [texto, campo] of Object.entries(OCULTABLE_POR_TEXTO)) {
      if (!NO_SE_PREGUNTAN.has(campo)) continue;
      expect({ texto, loExige: falta.includes(texto) }).toEqual({
        texto,
        loExige: false,
      });
    }
  });

  it('en Grupo AE la fecha de nacimiento y el estrato están ocultos', () => {
    /// Fijado a propósito. Si alguien los vuelve a preguntar, que
    /// sea una decisión y no un descuido: este test le obliga a
    /// venir aquí y decirlo.
    expect(seLePregunta('fechaNacimiento')).toBe(false);
    expect(seLePregunta('estrato')).toBe(false);
    expect(seLePregunta('poblacionVulnerable')).toBe(false);
  });

  it('lo que sí se pregunta se sigue exigiendo', () => {
    /// Ocultar dos datos no puede apagar la regla entera: el
    /// domicilio y el nivel ocupacional se siguen pidiendo.
    const falta = faltaDeLaPersona(VACIA as never);
    expect(falta).toEqual(
      expect.arrayContaining(['departamento', 'municipio', 'nivel ocupacional']),
    );
  });
});

describe('el domicilio se pide en el ENLACE, y esa es la corrección', () => {
  it('departamento y municipio los pregunta el enlace', () => {
    /// Estaban marcados como «se dan al reservar», y por eso la
    /// pantalla no los pintaba. Es falso: se puede crear una
    /// ficha desde el panel o convertir un lead sin ellos.
    expect(DONDE_SE_PIDE['departamento']).toBe('ENLACE');
    expect(DONDE_SE_PIDE['municipio']).toBe('ENLACE');
  });

  it('una persona a la que solo le falta el municipio lo dice así', () => {
    const casi = {
      persona: {
        correo: 'a@b.test',
        celular: '3001234567',
        fechaNacimiento: new Date('1997-10-08'),
        generoSepId: 1,
        estrato: 2,
        departamentoSepId: 11,
        municipioSepId: null,
        direccion: 'Carrera 28',
        barrio: 'San Vicente',
      },
      nivelOcupacionalSepId: 3,
    };

    expect(faltaDeLaPersona(casi as never)).toEqual(['municipio']);
  });
});
