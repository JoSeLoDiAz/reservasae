/** El cronograma no toca los grupos de otro gremio. */

/**
 * LOS CÓDIGOS AF SE REPITEN ENTRE GREMIOS Y NO SIGNIFICAN LO MISMO.
 *
 * ADECOPRIA tiene un AF1 «Gestión de la Atención y Neuroeducación» ---el
 * del cronograma--- y la unión temporal BRITCHAM-ADEE tiene otro AF1,
 * «Despliegue de Agentes Autónomos con IA», con sus propios ocho grupos
 * numerados igual. Emparejar por código y número a secas movería las
 * fechas del gremio equivocado, y no se notaría hasta que un grupo
 * cerrara inscripciones once días antes de tiempo.
 *
 * Aquí se fija el control que lo impide, y las tres cosas que nunca
 * debe hacer una importación: inventar grupos, borrar lo que el
 * cronograma no menciona, y escribir cuando no está segura.
 */

import {
  comparable,
  compararConElCronograma,
  hablanDelMismoSitio,
  lugaresDelRotulo,
  medianocheEnBogota,
  type GrupoEnLaBase,
} from './emparejar-con-la-base';
import type { GrupoDelCronograma } from './lector-del-cronograma';

const fila = (p: Partial<GrupoDelCronograma>): GrupoDelCronograma => ({
  fila: 5,
  gremio: 'ADECOPRIA',
  af: 'AF1',
  nombre: 'Gestión de la Atención',
  grupo: 'AF1.G1 Bogotá',
  numeroDeGrupo: 1,
  modalidad: 'Virtual',
  meta: 65,
  horasDeclaradas: 40,
  horasContadas: 40,
  sesiones: 20,
  inicio: '2026-10-19',
  fin: '2026-11-11',
  cierreInscripciones: '2026-10-08',
  lanzamiento: '2026-09-14',
  unidades: [],
  ...p,
});

const enLaBase = (p: Partial<GrupoEnLaBase>): GrupoEnLaBase => ({
  id: 'g1',
  numero: 1,
  accionCodigo: 'AF1',
  fechaInicio: null,
  fechaFin: null,
  cierreInscripciones: null,
  ubicaciones: ['BOGOTÁ D.C'],
  ...p,
});

describe('los nombres de lugar, que se escriben distinto en cada lado', () => {
  it('se comparan sin tildes ni mayúsculas', () => {
    expect(comparable('Pópayán')).toBe('POPAYAN');
    expect(comparable('BOGOTÁ D.C')).toBe('BOGOTA D C');
  });

  it('del rótulo salen los lugares, sin el código', () => {
    expect(lugaresDelRotulo('AF1.G4. Huila, Magdalena')).toEqual([
      'HUILA',
      'MAGDALENA',
    ]);
    expect(lugaresDelRotulo('AF3.G1 Apartadó (Antioquia)')).toEqual([
      'APARTADO',
      'ANTIOQUIA',
    ]);
  });

  /// «Bogotá» tiene seis letras pero «D.C» no llega al mínimo: se cae
  /// sola, y es lo que se quiere, porque no identifica nada.
  it('los trozos demasiado cortos no cuentan como lugar', () => {
    expect(lugaresDelRotulo('AF1.G1 Bogotá')).toEqual(['BOGOTA']);
  });

  it('basta que coincida uno de los lugares', () => {
    expect(hablanDelMismoSitio(['HUILA', 'MAGDALENA'], ['HUILA'])).toBe(true);
  });

  it('y si no se tocan en nada, no son el mismo grupo', () => {
    expect(
      hablanDelMismoSitio(['CAUCA', 'SANTANDER'], ['ATLANTICO', 'CORDOBA']),
    ).toBe(false);
  });

  /// Sin lugares que comparar no se puede afirmar que estén en
  /// desacuerdo: el control calla, no acusa.
  it('sin lugares en el rótulo, el control no estorba', () => {
    expect(hablanDelMismoSitio([], ['BOGOTA'])).toBe(true);
  });
});

describe('qué se escribiría', () => {
  it('un grupo sin fechas las recibe todas', () => {
    const r = compararConElCronograma([fila({})], [enLaBase({})]);
    expect(r.porAplicar).toHaveLength(1);
    expect(r.porAplicar[0].cambios).toEqual([
      { campo: 'fechaInicio', de: null, a: '2026-10-19' },
      { campo: 'fechaFin', de: null, a: '2026-11-11' },
      { campo: 'cierreInscripciones', de: null, a: '2026-10-08' },
    ]);
  });

  it('lo que ya está igual no se vuelve a escribir', () => {
    const r = compararConElCronograma(
      [fila({})],
      [
        enLaBase({
          fechaInicio: medianocheEnBogota('2026-10-19'),
          fechaFin: medianocheEnBogota('2026-11-11'),
          cierreInscripciones: medianocheEnBogota('2026-10-08'),
        }),
      ],
    );
    expect(r.sinCambios).toHaveLength(1);
    expect(r.porAplicar).toEqual([]);
  });

  /**
   * LO QUE EL CRONOGRAMA NO DICE NO BORRA LO QUE HAY. Una fila sin
   * sesiones marcadas no significa que el grupo no tenga fechas:
   * significa que esa fila no las trae. Vaciar por silencio sería la
   * peor forma de perder un dato.
   */
  it('lo que el cronograma no trae no borra lo que ya existe', () => {
    const r = compararConElCronograma(
      [fila({ inicio: null, fin: null })],
      [enLaBase({ fechaInicio: medianocheEnBogota('2026-08-11') })],
    );
    expect(r.porAplicar[0].cambios).toEqual([
      { campo: 'cierreInscripciones', de: null, a: '2026-10-08' },
    ]);
  });
});

describe('cuándo se planta', () => {
  /**
   * EL CASO QUE JUSTIFICA TODO ESTO. El G5 de AF1 en el cronograma es
   * «Cauca, Santander»; en el otro gremio, el G5 de su AF1 cubre
   * Atlántico, Magdalena y Córdoba. Mismo código, mismo número, otro
   * curso y otra gente.
   */
  it('no escribe en un grupo que cubre otras ciudades', () => {
    const r = compararConElCronograma(
      [fila({ grupo: 'AF1.G5. Cauca, Santander', numeroDeGrupo: 5 })],
      [
        enLaBase({
          id: 'otro',
          numero: 5,
          ubicaciones: ['ATLÁNTICO', 'MAGDALENA', 'CÓRDOBA'],
        }),
      ],
    );
    expect(r.porAplicar).toEqual([]);
    expect(r.conReparos).toHaveLength(1);
    expect(r.conReparos[0].reparos[0]).toMatch(/No parecen el mismo grupo/);
  });

  /// No se crean grupos: el cronograma dice cuándo, no qué existe.
  it('un grupo que no está en el sistema se reporta, no se crea', () => {
    const r = compararConElCronograma(
      [fila({ grupo: 'AF9.G1 Leticia', af: 'AF9' })],
      [enLaBase({})],
    );
    expect(r.conReparos[0].grupoId).toBeNull();
    expect(r.conReparos[0].reparos[0]).toMatch(/no hay un grupo 1 de AF9/);
  });

  it('un rótulo sin número de grupo no se adivina', () => {
    const r = compararConElCronograma(
      [fila({ grupo: 'Bogotá', numeroDeGrupo: null })],
      [enLaBase({})],
    );
    expect(r.conReparos[0].reparos[0]).toMatch(/número de grupo/);
  });

  it('si hay dos candidatos no elige: avisa', () => {
    const r = compararConElCronograma(
      [fila({})],
      [enLaBase({ id: 'a' }), enLaBase({ id: 'b' })],
    );
    expect(r.conReparos[0].reparos[0]).toMatch(/no se puede saber cuál/);
  });
});

/**
 * LA MEDIANOCHE ES LA DE BOGOTÁ, NO LA DE UTC.
 *
 * Colombia va cinco horas detrás y no mueve el reloj. Guardar
 * `2026-10-08` como medianoche UTC lo deja en las siete de la tarde del
 * día 7 en Bogotá: el cierre se adelantaría un día entero y nadie
 * sabría por qué. Es el mismo error que ya tuvo que arreglarse en el
 * calendario de inscripción.
 */
describe('las fechas se guardan en hora de Colombia', () => {
  it('la medianoche de Bogotá son las 05:00 UTC', () => {
    expect(medianocheEnBogota('2026-10-08').toISOString()).toBe(
      '2026-10-08T05:00:00.000Z',
    );
  });

  it('y lo guardado se vuelve a leer como el mismo día', () => {
    const r = compararConElCronograma(
      [fila({})],
      [enLaBase({ cierreInscripciones: medianocheEnBogota('2026-10-08') })],
    );
    /// Si la ida y la vuelta no cuadraran, esto saldría como un cambio
    /// del 8 al 8, y la importación escribiría cada vez que se corre.
    expect(
      r.porAplicar[0].cambios.find((c) => c.campo === 'cierreInscripciones'),
    ).toBeUndefined();
  });
});
