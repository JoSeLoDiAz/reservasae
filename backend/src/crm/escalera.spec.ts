/** Las reglas de la escalera de etapas. */

/**
 * Se prueba la MATRIZ ENTERA —las once etapas contra las once—
 * y no una lista de pares elegidos a mano. La primera versión de
 * este spec probaba pares sueltos y por eso no vio que
 * `INSCRITO → EN_FORMACION` había quedado imposible: ese par no
 * estaba en la lista.
 */

import type { EtapaParticipante } from '../../generated/prisma';
import {
  esRegresoAlAula,
  exigeCupo,
  exigeDatosParaElAula,
  motivoDeTransicionImposible,
} from './escalera';

const TODAS: EtapaParticipante[] = [
  'INTERESADO',
  'CONTACTADO',
  'DATOS_COMPLETOS',
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
  'PERDIDO',
  'RETIRADO',
  'NO_APROBO',
  'DESERTO',
  'ABANDONO',
];

/// La misma lista que `OCUPAN_SILLA` de `panel-de-cupos.ts`.
/// Escrita aquí a mano a propósito: si alguien cambia una de las
/// dos sin la otra, este spec lo dice.
const OCUPAN_SILLA: EtapaParticipante[] = ['INSCRITO', 'EN_FORMACION', 'CERTIFICADO'];

const EN_EL_AULA: EtapaParticipante[] = [
  'EN_FORMACION',
  'CERTIFICADO',
  'NO_APROBO',
  'RETIRADO',
  'DESERTO',
  'ABANDONO',
];

/** Los 121 pares. */
function cadaPar(f: (antes: EtapaParticipante, despues: EtapaParticipante) => void) {
  for (const antes of TODAS) for (const despues of TODAS) f(antes, despues);
}

describe('exigeCupo es aritmética de sillas', () => {
  it('la matriz entera cuadra con quién ocupa silla', () => {
    /// La regla completa en una línea: se pide cupo si el
    /// destino ocupa silla y el origen no la ocupaba.
    cadaPar((antes, despues) => {
      const esperado =
        OCUPAN_SILLA.includes(despues) && !OCUPAN_SILLA.includes(antes);
      expect({ antes, despues, cupo: exigeCupo(antes, despues) }).toEqual({
        antes,
        despues,
        cupo: esperado,
      });
    });
  });

  it('INSCRITO → EN_FORMACION NO pide cupo', () => {
    /// Es el ingreso tardío, y la primera versión lo hizo
    /// imposible: miraba «estar en el aula» en vez de «ocupar
    /// silla», INSCRITO no está en el aula, y `exigirQueQuepa`
    /// exige además una ventana de inscripción que a esas
    /// alturas está cerrada siempre.
    expect(exigeCupo('INSCRITO', 'EN_FORMACION')).toBe(false);
  });

  it('quien entra de fuera sí lo pide, se salte o no INSCRITO', () => {
    expect(exigeCupo('INTERESADO', 'INSCRITO')).toBe(true);
    expect(exigeCupo('INTERESADO', 'EN_FORMACION')).toBe(true);
    expect(exigeCupo('CONTACTADO', 'EN_FORMACION')).toBe(true);
  });

  it('quien se retiró liberó su silla, así que volver pide otra', () => {
    /// Al retirarse deja de contar en `OCUPAN_SILLA`, así que su
    /// silla se la puede haber llevado otro. No pedírsela sería
    /// sobrevender sin que nadie lo firme.
    expect(exigeCupo('RETIRADO', 'INSCRITO')).toBe(true);
    expect(exigeCupo('ABANDONO', 'EN_FORMACION')).toBe(true);
    expect(exigeCupo('NO_APROBO', 'EN_FORMACION')).toBe(true);
  });

  it('quien ya la ocupa no pide otra', () => {
    expect(exigeCupo('CERTIFICADO', 'EN_FORMACION')).toBe(false);
    expect(exigeCupo('EN_FORMACION', 'CERTIFICADO')).toBe(false);
  });

  it('salirse nunca pide cupo', () => {
    for (const salida of ['RETIRADO', 'NO_APROBO', 'DESERTO', 'ABANDONO', 'PERDIDO'] as const) {
      for (const antes of TODAS) expect(exigeCupo(antes, salida)).toBe(false);
    }
  });
});

describe('exigeDatosParaElAula: siempre que se entre, venga de donde venga', () => {
  it('la matriz entera: depende SOLO del destino', () => {
    /// La autorización de datos se puede revocar, así que «ya la
    /// pasó una vez» no dice nada sobre hoy. Que el origen no
    /// influya es justo lo que lo garantiza.
    cadaPar((antes, despues) => {
      const esperado = despues === 'INSCRITO' || despues === 'EN_FORMACION';
      expect({ antes, despues, datos: exigeDatosParaElAula(antes, despues) }).toEqual({
        antes,
        despues,
        datos: esperado,
      });
    });
  });

  it('el agujero original: INTERESADO → EN_FORMACION los exige', () => {
    expect(exigeDatosParaElAula('INTERESADO', 'EN_FORMACION')).toBe(true);
  });

  it('el defecto del primer arreglo: quien vuelve también', () => {
    /// Eximirlo dejó INSCRITO más débil que antes: revocando la
    /// autorización y pasando de RETIRADO a INSCRITO se volvía a
    /// matricular a quien pidió que no se usaran sus datos.
    expect(exigeDatosParaElAula('RETIRADO', 'INSCRITO')).toBe(true);
    expect(exigeDatosParaElAula('CERTIFICADO', 'EN_FORMACION')).toBe(true);
  });
});

describe('esRegresoAlAula exime de la ventana, no del cupo', () => {
  it('coincide exactamente con haber estado en el aula', () => {
    for (const antes of TODAS) {
      expect({ antes, regreso: esRegresoAlAula(antes) }).toEqual({
        antes,
        regreso: EN_EL_AULA.includes(antes),
      });
    }
  });

  it('quien vuelve pide cupo Y está exento de ventana, a la vez', () => {
    /// Las dos cosas juntas son la regla: su silla se liberó
    /// (cupo sí), y el grupo al que vuelve ya arrancó, así que
    /// su ventana está cerrada por definición (ventana no).
    /// Exigirle la ventana le cerraría el regreso siempre.
    expect(exigeCupo('RETIRADO', 'EN_FORMACION')).toBe(true);
    expect(esRegresoAlAula('RETIRADO')).toBe(true);
  });

  it('quien entra por primera vez NO está exento', () => {
    expect(esRegresoAlAula('INTERESADO')).toBe(false);
    expect(esRegresoAlAula('CONTACTADO')).toBe(false);
    expect(esRegresoAlAula('INSCRITO')).toBe(false);
    expect(esRegresoAlAula('PERDIDO')).toBe(false);
  });
});

describe('no se cierra una formación que no ocurrió', () => {
  it('la matriz entera: a CERTIFICADO y NO_APROBO solo desde el aula o INSCRITO', () => {
    cadaPar((antes, despues) => {
      const esCierre = despues === 'CERTIFICADO' || despues === 'NO_APROBO';
      const puede = antes === 'EN_FORMACION' || antes === 'INSCRITO';
      const bloqueado = motivoDeTransicionImposible(antes, despues) !== null;
      expect({ antes, despues, bloqueado }).toEqual({
        antes,
        despues,
        bloqueado: esCierre && !puede,
      });
    });
  });

  it('RETIRADO → CERTIFICADO no, y dice cómo hacerlo bien', () => {
    expect(motivoDeTransicionImposible('RETIRADO', 'CERTIFICADO')).toMatch(/En formación/);
  });

  it('INTERESADO → CERTIFICADO tampoco', () => {
    expect(motivoDeTransicionImposible('INTERESADO', 'CERTIFICADO')).toMatch(/matricula/i);
  });

  it('desde INSCRITO sí: hay grupos sin fechas', () => {
    expect(motivoDeTransicionImposible('INSCRITO', 'CERTIFICADO')).toBeNull();
  });

  it('la cadena del regreso es transitable de punta a punta', () => {
    /// Esto es lo que ata las tres reglas: si `exigeCupo` o la
    /// ventana bloquearan el paso por «En formación», la regla
    /// de arriba —«páselo primero a En formación»— se estaría
    /// bloqueando a sí misma y certificar a quien volvió sería
    /// imposible, no difícil.
    expect(motivoDeTransicionImposible('RETIRADO', 'EN_FORMACION')).toBeNull();
    expect(esRegresoAlAula('RETIRADO')).toBe(true);
    expect(motivoDeTransicionImposible('EN_FORMACION', 'CERTIFICADO')).toBeNull();
  });
});
