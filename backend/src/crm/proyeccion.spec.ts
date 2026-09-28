/** La proyección de inscripciones, por acción de formación. */

/**
 * Se prueba la función pura y no el servicio: aquí vive la decisión
 * ---si llega o no--- y es la que va a mirar alguien para reforzar un
 * equipo. Los dos supuestos declarados, la conversión y la ventana del
 * ritmo, quedan fijados aquí: el día que se cambien, estas pruebas lo
 * dicen en vez de que cambie una cifra en pantalla sin que nadie sepa
 * por qué.
 */

import { DIAS_DE_RITMO, proyectarInscripciones } from './proyeccion';

const DIA = (t: string) => new Date(`${t}T00:00:00.000Z`);

/**
 * Un miércoles a media mañana EN BOGOTÁ.
 *
 * La hora importa y me costó una vuelta: con `2026-09-23T00:00:00Z`
 * en Bogotá son todavía las siete de la tarde del 22, así que
 * `hoyEnColombia` devolvía el 22 y salía un día de trabajo de más.
 * Es el mismo desfase de cinco horas que descuadró el Excel de leads
 * un día entero.
 */
const HOY = new Date('2026-09-23T15:00:00.000Z');

const lead = (accion: string, etapa: string, n = 1) =>
  Array.from({ length: n }, () => ({
    accionFormacionId: accion,
    codigo: 'AF1',
    nombre: 'Una acción',
    etapa: etapa as never,
  }));

describe('la proyección por acción', () => {
  it('sin fecha de inicio no hay cierre, y eso es lo primero que hay que arreglar', () => {
    const [f] = proyectarInscripciones(
      lead('af1', 'INSCRITO', 5),
      new Map([['af1', 100]]),
      new Map(),
      new Map(),
      HOY,
    );

    expect(f.veredicto).toBe('SIN_FECHA');
    expect(f.cierre).toBeNull();
    expect(f.metaDiaria).toBeNull();
    /// Y la proyección no se inventa nada: sin días por delante, lo
    /// que hay es lo que hay.
    expect(f.proyeccion).toBe(5);
  });

  it('con los cupos cubiertos está CUBIERTO aunque el plazo haya vencido', () => {
    const [f] = proyectarInscripciones(
      lead('af1', 'INSCRITO', 30),
      new Map([['af1', 30]]),
      /// Un cierre de hace tres semanas.
      new Map([['af1', DIA('2026-09-01')]]),
      new Map(),
      HOY,
    );

    expect(f.faltan).toBe(0);
    expect(f.veredicto).toBe('CUBIERTO');
  });

  it('pasado el cierre y sin cubrir, está CERRADO y no hay meta que pedir', () => {
    const [f] = proyectarInscripciones(
      lead('af1', 'INSCRITO', 10),
      new Map([['af1', 50]]),
      new Map([['af1', DIA('2026-09-01')]]),
      new Map(),
      HOY,
    );

    expect(f.veredicto).toBe('CERRADO');
    expect(f.metaDiaria).toBeNull();
  });

  /**
   * EL CÁLCULO ENTERO, paso a paso y con números redondos, porque es
   * el que alguien va a querer seguir con el dedo.
   *
   * Del miércoles 23 al miércoles 30 hay SEIS días de trabajo ---solo
   * cae un domingo---. Faltan 30 de 50 cupos. A 12 inscritos en la
   * ventana de 15 días, el ritmo es 0,8 al día.
   */
  it('reparte lo que falta entre los días de trabajo y proyecta al ritmo de la ventana', () => {
    const [f] = proyectarInscripciones(
      [...lead('af1', 'INSCRITO', 20), ...lead('af1', 'DATOS_COMPLETOS', 30)],
      new Map([['af1', 50]]),
      new Map([['af1', DIA('2026-09-30')]]),
      new Map([['af1', 12]]),
      HOY,
    );

    expect(f.diasRestantes).toBe(6);
    expect(f.faltan).toBe(30);
    /// 30 entre 6 días: cinco al día, hacia arriba.
    expect(f.metaDiaria).toBe(5);
    /// 12 en 15 días de ventana.
    expect(f.ritmoReal).toBeCloseTo(0.8);
    /// 20 que hay + 0,8 × 6 días = 24,8 -> 25.
    expect(f.proyeccion).toBe(25);
    /// Proyecta 25 de 50: no llega ni de lejos.
    expect(f.veredicto).toBe('NO_LLEGA');
  });

  it('con diez por ciento de margen LLEGA; por debajo de eso, APRETADO', () => {
    const base = (inscritosRecientes: number) =>
      proyectarInscripciones(
        lead('af1', 'INSCRITO', 40),
        new Map([['af1', 50]]),
        new Map([['af1', DIA('2026-09-30')]]),
        new Map([['af1', inscritosRecientes]]),
        HOY,
      )[0];

    /// 25 en la ventana son 1,67 al día: 40 + 10 = 50 justos.
    expect(base(25).veredicto).toBe('APRETADO');
    /// 60 en la ventana son 4 al día: 40 + 24 = 64, muy por encima.
    expect(base(60).veredicto).toBe('LLEGA');
  });
});

describe('la conversión y los leads que hacen falta', () => {
  /// EL SUPUESTO DECLARADO Nº 1. Con pocos leads propios, la
  /// conversión de la acción no significa nada: una con tres leads y
  /// un inscrito daría un 33 % y multiplicar por él es inventarse una
  /// cifra con cara de dato.
  it('una acción con pocos leads usa el promedio general, no el suyo', () => {
    const filas = proyectarInscripciones(
      [
        /// La grande: 100 leads, 50 inscritos. Conversión general 50 %.
        ...lead('grande', 'INSCRITO', 50),
        ...lead('grande', 'DATOS_COMPLETOS', 50),
        /// La pequeña: 3 leads, 1 inscrito. Su 33 % no vale.
        ...lead('chica', 'INSCRITO', 1),
        ...lead('chica', 'DATOS_COMPLETOS', 2),
      ],
      new Map([
        ['grande', 60],
        ['chica', 11],
      ]),
      new Map([
        ['grande', DIA('2026-09-30')],
        ['chica', DIA('2026-09-30')],
      ]),
      new Map(),
      HOY,
    );

    const grande = filas.find((f) => f.accionFormacionId === 'grande')!;
    const chica = filas.find((f) => f.accionFormacionId === 'chica')!;

    expect(grande.conversionPropia).toBe(true);
    expect(grande.conversion).toBeCloseTo(0.5);

    expect(chica.conversionPropia).toBe(false);
    /// Usa el general y no el suyo: 51 inscritos de 103 leads en
    /// total, un 49,5 %. Con su propio 33 % harían falta 30 leads;
    /// con el general, 21.
    expect(chica.conversion).toBeCloseTo(51 / 103);
    expect(chica.faltan).toBe(10);
    expect(chica.leadsNecesarios).toBe(21);
  });

  /// Los que ya están abiertos son materia prima que YA se tiene: lo
  /// que hay que salir a buscar es la diferencia. Pedir los 20
  /// enteros teniendo 8 en la mano manda a la calle por 12 de más.
  it('descuenta los leads abiertos de los que hay que conseguir', () => {
    const [f] = proyectarInscripciones(
      [...lead('af1', 'INSCRITO', 50), ...lead('af1', 'DATOS_COMPLETOS', 50)],
      new Map([['af1', 60]]),
      new Map([['af1', DIA('2026-09-30')]]),
      new Map(),
      HOY,
    );

    expect(f.abiertos).toBe(50);
    expect(f.faltan).toBe(10);
    /// Al 50 % de conversión, 10 que faltan piden 20 leads.
    expect(f.leadsNecesarios).toBe(20);
    /// Pero 50 ya están abiertos: no hay que conseguir ninguno.
    expect(f.leadsPorConseguir).toBe(0);
  });

  /// Un descartado no vuelve: contarlo como materia prima diría que
  /// hay con qué llegar cuando no lo hay.
  it('los descartados no cuentan como leads abiertos', () => {
    const [f] = proyectarInscripciones(
      [...lead('af1', 'INSCRITO', 10), ...lead('af1', 'PERDIDO', 40)],
      new Map([['af1', 60]]),
      new Map([['af1', DIA('2026-09-30')]]),
      new Map(),
      HOY,
    );

    expect(f.leads).toBe(50);
    expect(f.abiertos).toBe(0);
  });
});

describe('el orden de las filas', () => {
  /**
   * POR CÓDIGO, de AF1 en adelante.
   *
   * Estuvo ordenada por veredicto ---lo peor arriba--- con la idea de
   * que la pantalla sirve para decidir dónde meter esfuerzo. El
   * cliente la lee como un catálogo, y buscar la AF4 en una lista
   * ordenada por otra cosa es recorrerla entera: «Acción de formación
   * en orden, o sea primero AF1, AF2, AF3» (27 sep 2026). Para lo
   * otro está la columna «¿Alcanza?», que ordena y filtra sola.
   */
  it('las ordena por código de acción, no por lo mal que vayan', () => {
    const conCodigo = (id: string, codigo: string) =>
      lead(id, 'INSCRITO', 1).map((l) => ({ ...l, codigo }));

    const filas = proyectarInscripciones(
      [
        ...conCodigo('tercera', 'AF3'),
        ...conCodigo('primera', 'AF1'),
        ...conCodigo('segunda', 'AF2'),
      ],
      new Map([
        ['tercera', 10],
        ['primera', 100],
        ['segunda', 100],
      ]),
      new Map(),
      new Map(),
      HOY,
    );

    expect(filas.map((f) => f.codigo)).toEqual(['AF1', 'AF2', 'AF3']);
  });

  /// NUMÉRICO Y NO ALFABÉTICO. Por texto, «AF10» va entre «AF1» y
  /// «AF2». Hoy no hay acciones de dos dígitos; el día que las haya,
  /// nadie se va a acordar de esta línea.
  it('AF10 va después de AF9, no entre AF1 y AF2', () => {
    const conCodigo = (id: string, codigo: string) =>
      lead(id, 'INSCRITO', 1).map((l) => ({ ...l, codigo }));

    const filas = proyectarInscripciones(
      [
        ...conCodigo('diez', 'AF10'),
        ...conCodigo('dos', 'AF2'),
        ...conCodigo('nueve', 'AF9'),
      ],
      new Map(),
      new Map(),
      new Map(),
      HOY,
    );

    expect(filas.map((f) => f.codigo)).toEqual(['AF2', 'AF9', 'AF10']);
  });
});

describe('la ventana del ritmo', () => {
  /// EL SUPUESTO DECLARADO Nº 2, fijado: el ritmo se divide entre los
  /// días de la VENTANA y no entre los que lleva viva la acción. Así
  /// dos acciones se comparan entre sí, que es para lo que están en la
  /// misma tabla.
  it('divide siempre entre los días de la ventana, no entre los que lleva la acción', () => {
    const [f] = proyectarInscripciones(
      lead('af1', 'INSCRITO', 3),
      new Map([['af1', 100]]),
      new Map([['af1', DIA('2026-09-30')]]),
      new Map([['af1', 30]]),
      HOY,
    );

    expect(f.ritmoReal).toBeCloseTo(30 / DIAS_DE_RITMO);
  });
});
