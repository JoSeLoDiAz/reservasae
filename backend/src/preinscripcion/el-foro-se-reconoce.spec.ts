/** El formulario público puede reconocer el foro, y lo dice. */

/**
 * «CUANDO ES FORO PREGUNTAN CÓMO LO INSCRIBO A VIRTUAL Y FORO»
 * (cliente, 7 oct 2026).
 *
 * La regla estaba BIEN desde el 14 sep ---`motivoParaNoInscribir`
 * exime al foro, que es la excepción que confirmó Catalina: «si es de
 * las virtuales se puede inscribir al foro, que puede escoger las
 * dos»--- y aun así nadie se inscribía en las dos. El motivo:
 *
 *   - la ruta pública NO mandaba `evento`, así que la pantalla no
 *     tenía con qué distinguir el foro de lo demás; salía rotulado
 *     «HÍBRIDA · 2 horas» igual que cualquier otra acción;
 *   - y el aviso de encima decía, a secas, «solo puede preinscribirse
 *     en una».
 *
 * Una regla que la pantalla contradice es, para quien la lee, igual
 * que no tenerla. Esto fija las tres mitades: que el dato viaja, que
 * las dos reglas son la MISMA, y que el aviso nombra la excepción.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { motivoDeSegundaImposible } from '../crm/segunda-inscripcion';
import { esForo, motivoParaNoInscribir } from '../crm/una-sola-accion';

const SERVICIO = readFileSync(
  join(__dirname, 'preinscripcion.service.ts'),
  'utf8',
);
const PANTALLA = readFileSync(
  join(
    __dirname,
    '..',
    '..',
    '..',
    'frontend',
    'src',
    'components',
    'preinscripcion.tsx',
  ),
  'utf8',
);

describe('el dato llega a la pantalla', () => {
  it('la ruta pública manda la pareja declarada', () => {
    expect(SERVICIO).toContain('combinaConAccionId: true');
    expect(SERVICIO).toContain('combinaConAccionId: a.combinaConAccionId');
  });

  it('la ruta pública manda `evento`', () => {
    /// Dos veces: en el `select` y en lo que se devuelve. Con solo
    /// una, o no se trae de la base o no sale por el cable.
    const enElSelect = SERVICIO.includes('evento: true');
    const enLaSalida = SERVICIO.includes('evento: a.evento');
    expect(enElSelect).toBe(true);
    expect(enLaSalida).toBe(true);
  });
});

describe('las dos reglas del foro son la misma', () => {
  /**
   * POR IGUALDAD Y NO POR «CONTIENE», en los dos lados. `evento` es
   * texto libre, y un futuro «FORO-TALLER» de cuarenta horas no puede
   * colarse por la excepción de los de dos.
   */
  it('la pantalla compara igual que el servidor', () => {
    expect(PANTALLA).toContain(
      '(evento ?? "").trim().toUpperCase() === "FORO"',
    );
  });

  it('y el servidor dice lo mismo', () => {
    expect(esForo('FORO')).toBe(true);
    expect(esForo(' foro ')).toBe(true);
    expect(esForo('FORO-TALLER')).toBe(false);
    expect(esForo('CURSO')).toBe(false);
    expect(esForo(null)).toBe(false);
  });

  /// Y la regla de verdad: con una virtual encima, el foro pasa.
  it('quien ya tiene una virtual puede sumar el foro', () => {
    const yaTiene = [
      {
        accionFormacionId: 'af1',
        codigo: 'AF1',
        nombre: 'Una virtual',
        evento: 'CURSO',
      },
    ];
    expect(
      motivoParaNoInscribir({ id: 'af7', evento: 'FORO' }, yaTiene),
    ).toBeNull();
  });

  /// Y AL REVÉS, que es el orden que nadie prueba: primero el foro y
  /// después la virtual. Si el foro contara como «su acción», la
  /// segunda se caería y la excepción no serviría de nada.
  it('y quien ya tiene el foro puede sumar una virtual', () => {
    const yaTiene = [
      {
        accionFormacionId: 'af7',
        codigo: 'AF7',
        nombre: 'El foro',
        evento: 'FORO',
      },
    ];
    expect(
      motivoParaNoInscribir({ id: 'af1', evento: 'CURSO' }, yaTiene),
    ).toBeNull();
  });

  /// Pero dos cursos siguen sin poder, que es la regla entera.
  it('y dos acciones que no son foro siguen sin poder', () => {
    const yaTiene = [
      {
        accionFormacionId: 'af1',
        codigo: 'AF1',
        nombre: 'Una virtual',
        evento: 'CURSO',
      },
    ];
    expect(
      motivoParaNoInscribir({ id: 'af2', evento: 'CURSO' }, yaTiene),
    ).toContain('solo se puede tomar una acción de formación');
  });
});

describe('y la pantalla lo dice, sin prometer de más', () => {
  /**
   * EL AVISO NOMBRA LOS DOS CÓDIGOS, y sale de la PAREJA declarada y
   * no de «¿es foro?».
   *
   * Ese fue mi error del 7 oct por la mañana: con `esForo` a secas,
   * a quien eligiera AF3 se le prometía poder sumar el foro después,
   * y el panel se lo niega ---AF3 no combina con nada---. En BRITCHAM
   * era peor: ninguna acción combina con ninguna, así que el aviso
   * habría mentido a todo el mundo.
   *
   * «Osea se puede cualquier AF y AF7» (cliente, 7 oct 2026). Pues
   * no, y por eso la pantalla tiene que leerlo del dato.
   */
  it('el aviso sale de la pareja declarada, no de «es foro»', () => {
    expect(PANTALLA).toContain('La única excepción es ${pareja.suma.codigo}');
    expect(PANTALLA).toContain('se puede sumar a ${pareja.base.codigo}');
  });

  /// Y la pareja se busca con la misma condición que `seCursanJuntas`
  /// del servidor: basta con que UNA nombre a la otra.
  it('y la pareja se busca como en el servidor', () => {
    expect(PANTALLA).toContain(
      'a.combinaConAccionId === b.id || b.combinaConAccionId === a.id',
    );
  });

  /**
   * Y SE ROTULAN LAS DOS TARJETAS, no solo el foro. Rotular una sola
   * se lee como que el foro se suma a cualquiera, que es justo lo que
   * no es.
   */
  it('y las dos tarjetas de la pareja se rotulan', () => {
    expect(PANTALLA).toContain('Foro · se suma a otra');
    expect(PANTALLA).toContain('Se le puede sumar el foro');
  });
});

/**
 * Y LAS DOS REGLAS SON DISTINTAS, que es lo que hay que tener
 * presente al tocar esto.
 *
 * La puerta PÚBLICA exime al foro por `evento`
 * (`motivoParaNoInscribir`). La del PANEL exige que la pareja esté
 * declarada en el dato (`motivoDeSegundaImposible`, regla de Josse
 * del 24 sep) y además pone el techo en dos.
 *
 * Eso es deliberado ---«la puerta pública sigue como estaba [...]
 * cerrarla allí es un cambio para el ciudadano y se decide
 * aparte»--- así que aquí NO se unifican. Lo que se arregla es que la
 * pantalla pública deje de prometer lo que la del panel niega.
 */
describe('el techo del panel sigue en dos', () => {
  it('con dos ya puestas, la tercera no entra', () => {
    const a = (id: string, codigo: string, con: string | null) => ({
      id,
      codigo,
      nombre: codigo,
      combinaConAccionId: con,
    });
    const m = motivoDeSegundaImposible(a('af3', 'AF3', null), [
      a('af1', 'AF1', 'af7'),
      a('af7', 'AF7', null),
    ]);
    expect(m).toContain('ya está en dos formaciones');
    expect(m).toContain('AF1 y AF7');
  });

  /// Y una que NO forma pareja no entra ni siendo la segunda.
  it('y una sin pareja no entra ni de segunda', () => {
    const a = (id: string, codigo: string, con: string | null) => ({
      id,
      codigo,
      nombre: codigo,
      combinaConAccionId: con,
    });
    expect(
      motivoDeSegundaImposible(a('af3', 'AF3', null), [a('af1', 'AF1', 'af7')]),
    ).toContain('no se cursa a la vez');
  });
});
