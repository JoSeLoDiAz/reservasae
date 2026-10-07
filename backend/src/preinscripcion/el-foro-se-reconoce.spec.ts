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

describe('y la pantalla lo dice', () => {
  it('el aviso nombra la excepción cuando hay foro', () => {
    expect(PANTALLA).toContain('El foro es la excepción');
  });

  /**
   * Y SOLO CUANDO LO HAY. Anunciar la excepción a quien no tiene foro
   * disponible en su zona es prometerle algo que no va a poder hacer.
   */
  it('y solo cuando hay foro entre lo que se le ofrece', () => {
    expect(PANTALLA).toContain(
      'conCobertura.some((x) => esForo(x.accion.evento))',
    );
  });

  it('y la tarjeta lo rotula', () => {
    expect(PANTALLA).toContain('Foro · se suma a otra');
  });
});
