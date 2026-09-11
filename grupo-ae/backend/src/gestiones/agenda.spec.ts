import { aDiaBogota } from '../comun/dia-bogota';
import {
  cuboDe,
  diaBogotaDe,
  esProximoPaso,
  limitesDeAgenda,
  medianocheBogotaDe,
  puedeBorrarse,
} from './agenda';

/**
 * La semana de referencia, con sus días escritos:
 *
 *     lun 7 · mar 8 · mié 9 · JUE 10 · vie 11 · sáb 12 · dom 13
 *     ... y el lunes siguiente es el 14.
 *
 * Se elige una semana entera y no fechas sueltas porque casi
 * todos los errores de esto son de borde: el primero y el último
 * día del cubo.
 */
const LUNES = '2026-09-07';
const JUEVES = '2026-09-10';
const VIERNES = '2026-09-11';
const SABADO = '2026-09-12';
const DOMINGO = '2026-09-13';
const LUNES_QUE_VIENE = '2026-09-14';

/**
 * Una hora de BOGOTÁ, como el instante UTC que se guarda.
 *
 * Escribir las pruebas en hora de Bogotá y no en UTC es
 * deliberado: así lo que dice el `it` es lo que ve el asesor, y
 * si la conversión se rompe se rompe aquí, en un sitio, y no en
 * treinta expectativas escritas a mano con las cinco horas ya
 * sumadas.
 */
const enBogota = (dia: string, hora = '12:00:00.000') =>
  new Date(Date.parse(`${dia}T${hora}Z`) + 5 * 3_600_000);

describe('el día de Bogotá de un instante', () => {
  it('a las seis de la tarde sigue siendo hoy', () => {
    expect(diaBogotaDe(new Date('2026-09-10T23:00:00.000Z'))).toBe(JUEVES);
  });

  /// El defecto que justifica todo el archivo: a las 19:00 de
  /// Bogotá ya es el día siguiente en UTC. Sin corregirlo, cada
  /// tarde a las siete la agenda del equipo entero salta un día.
  it('a las SIETE de la tarde tampoco cambia de día', () => {
    expect(diaBogotaDe(new Date('2026-09-11T00:00:00.000Z'))).toBe(JUEVES);
  });

  it('el último milisegundo del día todavía es de ese día', () => {
    expect(diaBogotaDe(new Date('2026-09-11T04:59:59.999Z'))).toBe(JUEVES);
  });

  it('y el siguiente ya es del día de mañana', () => {
    expect(diaBogotaDe(new Date('2026-09-11T05:00:00.000Z'))).toBe(VIERNES);
  });

  it('el año cambia cinco horas después que en Greenwich', () => {
    expect(diaBogotaDe(new Date('2027-01-01T03:00:00.000Z'))).toBe('2026-12-31');
    expect(diaBogotaDe(new Date('2027-01-01T05:00:00.000Z'))).toBe('2027-01-01');
  });

  /**
   * Este módulo es puro y por eso no importa `comun/dia-bogota`,
   * que carga Prisma. La copia se paga aquí: si alguna de las dos
   * cambia de criterio, esta prueba lo dice el mismo día.
   */
  it('coincide con `aDiaBogota`, que lo hace por nombre de zona', () => {
    const instantes = [
      '2026-09-10T23:00:00.000Z',
      '2026-09-11T00:00:00.000Z',
      '2026-09-11T04:59:59.999Z',
      '2026-09-11T05:00:00.000Z',
      '2027-01-01T03:00:00.000Z',
      '2026-03-08T06:30:00.000Z',
    ];
    for (const i of instantes) {
      expect(diaBogotaDe(new Date(i))).toBe(aDiaBogota(new Date(i)));
    }
  });
});

describe('la medianoche de un día de Bogotá', () => {
  it('son las cinco de la mañana en UTC, que es lo que va al where', () => {
    expect(medianocheBogotaDe(JUEVES).toISOString()).toBe(
      '2026-09-10T05:00:00.000Z',
    );
  });

  it('es la vuelta exacta de leer el día', () => {
    const arranque = medianocheBogotaDe(JUEVES);
    expect(diaBogotaDe(arranque)).toBe(JUEVES);
    expect(diaBogotaDe(new Date(arranque.getTime() - 1))).toBe('2026-09-09');
  });
});

describe('qué cuenta como vencido', () => {
  const LA_TARDE_DEL_JUEVES = enBogota(JUEVES, '17:00:00.000');

  /**
   * La prueba que da sentido a medir en días y no en instantes.
   *
   * Si se comparara `venceEn < ahora`, esto saldría VENCIDA a las
   * 09:01 y el asesor vería en rojo lo que se comprometió a hacer
   * hoy y todavía puede hacer.
   */
  it('lo de esta mañana NO está vencido esta tarde', () => {
    expect(cuboDe(enBogota(JUEVES, '09:00:00.000'), LA_TARDE_DEL_JUEVES)).toBe(
      'HOY',
    );
  });

  it('la medianoche con la que arranca el día es HOY', () => {
    expect(cuboDe(enBogota(JUEVES, '00:00:00.000'), LA_TARDE_DEL_JUEVES)).toBe(
      'HOY',
    );
  });

  it('el último milisegundo del día también', () => {
    expect(cuboDe(enBogota(JUEVES, '23:59:59.999'), LA_TARDE_DEL_JUEVES)).toBe(
      'HOY',
    );
  });

  it('y el milisegundo anterior a la medianoche ya está VENCIDO', () => {
    expect(
      cuboDe(enBogota('2026-09-09', '23:59:59.999'), LA_TARDE_DEL_JUEVES),
    ).toBe('VENCIDA');
  });

  /// Preguntado a las siete de la tarde, que es cuando UTC ya
  /// cambió de día: lo de hoy tiene que seguir siendo de hoy.
  it('a las siete de la noche lo de hoy sigue sin vencer', () => {
    const lasSiete = new Date('2026-09-11T00:00:00.000Z');
    expect(cuboDe(enBogota(JUEVES, '09:00:00.000'), lasSiete)).toBe('HOY');
    expect(cuboDe(enBogota(VIERNES, '09:00:00.000'), lasSiete)).toBe(
      'ESTA_SEMANA',
    );
  });

  it('lo del lunes pasado está vencido el jueves', () => {
    expect(cuboDe(enBogota(LUNES), LA_TARDE_DEL_JUEVES)).toBe('VENCIDA');
  });
});

describe('hasta dónde llega «esta semana»', () => {
  it('el jueves, el viernes es de esta semana', () => {
    expect(cuboDe(enBogota(VIERNES), enBogota(JUEVES))).toBe('ESTA_SEMANA');
  });

  it('el domingo entero todavía es de esta semana', () => {
    expect(cuboDe(enBogota(DOMINGO, '23:59:59.999'), enBogota(JUEVES))).toBe(
      'ESTA_SEMANA',
    );
  });

  /// El borde de la semana: la medianoche del lunes ya es del
  /// otro lado. Es el corte que hace que la semana se pueda
  /// terminar.
  it('la medianoche del lunes que viene ya es MÁS ADELANTE', () => {
    expect(cuboDe(enBogota(LUNES_QUE_VIENE, '00:00:00.000'), enBogota(JUEVES))).toBe(
      'MAS_ADELANTE',
    );
  });

  it('el lunes, la semana cuenta entera hasta el domingo', () => {
    const elLunes = enBogota(LUNES);
    expect(cuboDe(enBogota(DOMINGO, '23:59:59.999'), elLunes)).toBe(
      'ESTA_SEMANA',
    );
    expect(cuboDe(enBogota(LUNES_QUE_VIENE), elLunes)).toBe('MAS_ADELANTE');
    expect(limitesDeAgenda(elLunes).finDeSemana.toISOString()).toBe(
      '2026-09-14T05:00:00.000Z',
    );
  });

  it('el sábado solo queda el domingo', () => {
    const elSabado = enBogota(SABADO);
    expect(cuboDe(enBogota(DOMINGO), elSabado)).toBe('ESTA_SEMANA');
    expect(cuboDe(enBogota(LUNES_QUE_VIENE), elSabado)).toBe('MAS_ADELANTE');
  });

  /**
   * El domingo no queda semana por delante y el cubo se queda
   * vacío. No es un descuido: es lo que significa una semana de
   * calendario, y lo del lunes aparece el lunes.
   */
  it('el domingo el cubo de la semana está vacío', () => {
    const elDomingo = enBogota(DOMINGO);
    const limites = limitesDeAgenda(elDomingo);
    expect(limites.finDeSemana.getTime()).toBe(limites.finDeHoy.getTime());
    expect(cuboDe(enBogota(DOMINGO, '23:00:00.000'), elDomingo)).toBe('HOY');
    expect(cuboDe(enBogota(LUNES_QUE_VIENE, '00:00:00.000'), elDomingo)).toBe(
      'MAS_ADELANTE',
    );
  });

  /// Preguntado a las siete de la tarde del domingo, cuando en
  /// UTC ya es lunes: la semana no puede haber arrancado todavía.
  it('el domingo a las siete de la noche la semana no ha cambiado', () => {
    const domingoTarde = new Date('2026-09-14T00:00:00.000Z');
    expect(limitesDeAgenda(domingoTarde).dia).toBe(DOMINGO);
    expect(cuboDe(enBogota(LUNES_QUE_VIENE), domingoTarde)).toBe(
      'MAS_ADELANTE',
    );
  });

  it('los cubos no se pisan: lo de hoy nunca es «esta semana»', () => {
    const horas = ['00:00:00.000', '08:30:00.000', '19:00:00.000', '23:59:59.999'];
    for (const h of horas) {
      expect(cuboDe(enBogota(JUEVES, h), enBogota(JUEVES))).toBe('HOY');
    }
  });
});

describe('qué es un próximo paso', () => {
  const AHORA = enBogota(JUEVES, '17:00:00.000');

  it('lo hecho no lo es, aunque tuviera fecha de mañana', () => {
    expect(
      esProximoPaso(
        { venceEn: enBogota(VIERNES), hechaEn: enBogota(JUEVES, '10:00:00.000') },
        AHORA,
      ),
    ).toBe(false);
  });

  /// Una nota suelta —«se llamó, no contestó»— no es un plan.
  it('una gestión sin fecha no lo es', () => {
    expect(esProximoPaso({ venceEn: null, hechaEn: null }, AHORA)).toBe(false);
  });

  it('lo de hoy todavía cuenta, aunque la hora ya pasara', () => {
    expect(
      esProximoPaso(
        { venceEn: enBogota(JUEVES, '08:00:00.000'), hechaEn: null },
        AHORA,
      ),
    ).toBe(true);
  });

  /**
   * El agujero que cierra esta condición: agendar mueve
   * `ultimoToqueEn` y saca el negocio de «frías», así que si lo
   * vencido siguiera contando como plan, agendar algo y no
   * hacerlo lo escondería de las dos listas para siempre.
   */
  it('lo que venció ayer deja de contar, y el negocio reaparece', () => {
    expect(
      esProximoPaso(
        { venceEn: enBogota('2026-09-09', '23:59:59.999'), hechaEn: null },
        AHORA,
      ),
    ).toBe(false);
  });

  it('lo del mes que viene cuenta', () => {
    expect(
      esProximoPaso({ venceEn: enBogota('2026-10-15'), hechaEn: null }, AHORA),
    ).toBe(true);
  });
});

describe('lo hecho no se borra', () => {
  it('una gestión pendiente se puede quitar', () => {
    expect(puedeBorrarse(null)).toBe(true);
  });

  it('una hecha no', () => {
    expect(puedeBorrarse(new Date('2026-09-10T14:00:00.000Z'))).toBe(false);
  });
});
