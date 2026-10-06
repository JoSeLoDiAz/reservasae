/** Lo gestionado el viernes y lo gestionado hoy son cifras distintas. */

/**
 * «NO ME ESTÁ MOSTRANDO LO GESTIONADO EL VIERNES Y LO GESTIONADO HOY»
 * (cliente, 5 oct 2026).
 *
 * No lo mostraba porque no se podía. `carga.gestionados` responde «de
 * los leads que LLEGARON en este periodo, a cuántos se ha tocado
 * alguna vez»: con los leads de agosto, esa cifra es la misma el
 * viernes que hoy. No había ninguna fecha con la que recortar el acto
 * de gestionar.
 *
 * La fecha sí existía, repartida en los tres sitios que ya definían
 * «gestionado»: la nota tiene `creadoEn`, `datosTocadosPorAsesorEn` es
 * un instante, y el movimiento de etapa tiene el suyo. Así que la
 * cuenta nueva no cambia la regla: le pone la ventana. No hizo falta
 * migración.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { acreditarPorQuienToco, SIN_ASESOR } from './acreditar-gestion';
import { repartirInscripciones, type LeadDelAsesor } from './asesores-datos';

const HOY = new Date('2026-10-06T15:00:00.000Z');

const lead = (p: Partial<LeadDelAsesor> = {}): LeadDelAsesor => ({
  asesorId: 'ana',
  asesorNombre: 'Ana',
  etapa: 'INTERESADO',
  creadoEn: new Date('2026-08-01T15:00:00.000Z'),
  datosTocadosPorAsesorEn: null,
  notas: 0,
  accionFormacionId: 'af1',
  accionCodigo: 'AF1',
  accionNombre: 'Una acción',
  ...p,
});

const filas = (tocados?: Map<string, number>) =>
  repartirInscripciones([lead(), lead()], new Map(), HOY, tocados);

describe('la cifra del periodo va aparte de la de siempre', () => {
  it('con ventana, cada asesor lleva a cuántos tocó dentro', () => {
    const f = filas(new Map([['ana', 7]]));
    expect(f[0].gestionadosEnElPeriodo).toBe(7);
  });

  /**
   * Y ES OTRA CUENTA, no un rename. La de siempre mira los leads que
   * llegaron; esta mira el acto de gestionar. Un asesor con dos leads
   * de agosto puede haber tocado siete fichas el viernes.
   */
  it('no es la misma que `gestionados`', () => {
    const f = filas(new Map([['ana', 7]]));
    expect(f[0].carga.total).toBe(2);
    expect(f[0].gestionadosEnElPeriodo).toBe(7);
  });

  /**
   * SIN VENTANA, NULA Y NO CERO. «Gestionado en el periodo» sin
   * periodo no quiere decir nada, y un cero en esa columna se lee
   * como que el asesor no hizo nada.
   */
  it('sin ventana puesta, la cifra es nula', () => {
    expect(filas(undefined)[0].gestionadosEnElPeriodo).toBeNull();
  });

  it('un asesor sin nada dentro de la ventana lleva cero, no nulo', () => {
    expect(filas(new Map())[0].gestionadosEnElPeriodo).toBe(0);
  });

  /// Las que no tienen asesor también se cuentan: son trabajo hecho,
  /// y esconderlas es como se pierden.
  it('las fichas sin asesor tienen su propia fila y su cifra', () => {
    const f = repartirInscripciones(
      [lead({ asesorId: null, asesorNombre: null })],
      new Map(),
      HOY,
      new Map([['SIN_ASESOR', 3]]),
    );
    const sinAsesor = f.find((x) => x.asesorId === null);
    expect(sinAsesor?.gestionadosEnElPeriodo).toBe(3);
  });
});

/**
 * Y LA CONSULTA, QUE ES DONDE ESTÁ LO DELICADO.
 *
 * Se lee del fuente porque el servicio pide media docena de
 * dependencias para instanciarse, y lo que hay que fijar es QUÉ se
 * cuenta como gestión con fecha.
 */
describe('qué cuenta como gestión dentro de la ventana', () => {
  const FUENTE = readFileSync(join(__dirname, 'crm.service.ts'), 'utf8');

  const bloque = () => {
    const i = FUENTE.indexOf('private async tocadosEnLaVentana');
    expect(i).toBeGreaterThan(-1);
    return FUENTE.slice(i, FUENTE.indexOf('\n  }', i));
  };

  it('los tres sitios que ya definían «gestionado», los tres con fecha', () => {
    const b = bloque();
    expect(b).toContain('notaDeGestion.findMany');
    expect(b).toContain('movimientoParticipante.findMany');
    expect(b).toContain('datosTocadosPorAsesorEn: dentro');
    expect(b).toContain('creadoEn: dentro');
  });

  /**
   * Y NO SE AGRUPA POR EL DUEÑO DE LA FICHA.
   *
   * Es lo único de esta consulta que un test de texto puede decir y el
   * de arriba no decía: mientras el `select` traiga `asesorId` de
   * `participante` para agrupar por él, la cifra es de otra pregunta.
   * Lo que importa de verdad se prueba abajo, llamando a la función.
   */
  it('cada toque se acredita a quien lo hizo, no al asesor de hoy', () => {
    const b = bloque();
    expect(b).toContain('autorId: true');
    expect(b).toContain('adminId: true');
    expect(b).toContain('acreditarPorQuienToco');
  });

  /**
   * EL MOVIMIENTO, SOLO SI LO HIZO UNA PERSONA. El que escribe el LMS
   * al reportar avance no es gestión de nadie: contándolo, el día que
   * entra un archivo del aula saldrían todos los asesores trabajando.
   */
  it('ni la nota que escribe el sistema', () => {
    /// Lucid deja una nota por cada conversacion que pega, con autor
    /// nulo. Contarla diria que la asesora trabajo una ficha que no
    /// toco: es la misma regla que Lucid ya aplica al no marcarlas
    /// como intento de contacto.
    expect(bloque()).toContain('autorId: { not: null }');
  });

  it('el movimiento del LMS no cuenta como gestión', () => {
    expect(bloque()).toContain('adminId: { not: null }');
  });

  /// El tope EXCLUSIVO, como en todas las ventanas de la casa: con
  /// `lte` el último día entra entero y la cifra cuenta un día más.
  it('la ventana va con `gte`/`lt`, no con `lte`', () => {
    const b = bloque();
    expect(b).toContain('gte: desde');
    expect(b).toContain('lt: hasta');
    expect(b).not.toContain('lte:');
  });

  it('y sin ventana no consulta nada', () => {
    expect(bloque()).toContain('if (!desde && !hasta) return undefined;');
  });
});

/**
 * A QUIÉN SE LE APUNTA CADA TOQUE. Esto sí se prueba llamando.
 *
 * La consulta agrupaba por el `asesorId` de la ficha, así que contestaba
 * «a cuántas de MIS fichas de hoy las tocó alguien». Y eso lo infla
 * justo quien no trabajó: `asignarAsesorEnLote` escribe en la misma
 * transacción el movimiento --con su `adminId`-- y el `asesorId` nuevo.
 */
describe('se acredita a quien tocó, no a quien es hoy el dueño', () => {
  it('repartir fichas no le sube la cifra a quien las recibe', () => {
    /// Lo que deja un reparto de tres leads: tres movimientos del
    /// líder, y las tres fichas ya con el asesorId de Ana.
    const por = acreditarPorQuienToco(
      [],
      [
        { adminId: 'lider', participanteId: 'f1' },
        { adminId: 'lider', participanteId: 'f2' },
        { adminId: 'lider', participanteId: 'f3' },
      ],
      [],
    );
    expect(por.get('ana')).toBeUndefined();
    expect(por.get('lider')).toBe(3);
  });

  it('la nota que un líder escribe sobre la ficha de otro es del líder', () => {
    const por = acreditarPorQuienToco(
      [{ autorId: 'lider', participanteId: 'f1' }],
      [],
      [],
    );
    expect(por.get('ana')).toBeUndefined();
    expect(por.get('lider')).toBe(1);
  });

  /// Tres toques a la misma ficha son UNA ficha gestionada.
  it('la misma ficha tocada varias veces cuenta una', () => {
    const por = acreditarPorQuienToco(
      [
        { autorId: 'ana', participanteId: 'f1' },
        { autorId: 'ana', participanteId: 'f1' },
      ],
      [{ adminId: 'ana', participanteId: 'f1' }],
      [{ id: 'f1', asesorId: 'ana' }],
    );
    expect(por.get('ana')).toBe(1);
  });

  /// Y dos personas distintas sobre la misma ficha son dos: las dos
  /// la trabajaron.
  it('dos personas sobre la misma ficha cuentan una cada una', () => {
    const por = acreditarPorQuienToco(
      [{ autorId: 'ana', participanteId: 'f1' }],
      [{ adminId: 'beto', participanteId: 'f1' }],
      [],
    );
    expect(por.get('ana')).toBe(1);
    expect(por.get('beto')).toBe(1);
  });

  /// `datosTocadosPorAsesorEn` es la única que no dice quién: ahí sí
  /// manda el asesor de la ficha, que es lo que la columna afirma.
  it('los datos tocados se acreditan al asesor de la ficha', () => {
    const por = acreditarPorQuienToco([], [], [{ id: 'f1', asesorId: 'ana' }]);
    expect(por.get('ana')).toBe(1);
  });

  it('lo que no tiene dueño va a su propia llave', () => {
    const por = acreditarPorQuienToco([], [], [{ id: 'f1', asesorId: null }]);
    expect(por.get(SIN_ASESOR)).toBe(1);
  });

  /// Una nota puede colgar de un lead y no de una ficha: entonces no
  /// hay ficha que contar.
  it('una nota sin ficha no cuenta', () => {
    const por = acreditarPorQuienToco(
      [{ autorId: 'ana', participanteId: null }],
      [],
      [],
    );
    expect(por.size).toBe(0);
  });
});
