/** Las reservas se unifican por organización, y no se pierde ninguna. */

/**
 * Los defectos que esto viene a impedir:
 *
 *  1. La empresa partida en dos filas. Es lo que pasa si el agrupado
 *     corre sobre una página del listado en vez de sobre todas las
 *     reservas: las AF1 y AF2 caen en una página y las AF3 y AF4 en
 *     otra, y salen dos filas de la misma empresa con la mitad de sus
 *     reservas cada una. Ninguna de las dos parece equivocada.
 *
 *  2. Dos «AF1» sumados en una columna. El código solo es único por
 *     convenio: en ADECOPRIA AF3 es un taller y en Grupo AE es un
 *     curso. Agrupar las columnas por código los mete en la misma
 *     celda. Por eso la llave es `accionFormacionId`, y por eso
 *     existe `ambiguo`: con los dos gremios a la vista, dos cabeceras
 *     rotuladas «AF1» a secas son indistinguibles.
 *
 *  3. Los totales que no cuadran con las celdas. La fila dice
 *     «4 reservas · 32 cupos» arriba y las celdas suman otra cosa.
 *
 *  4. El contacto escondido. Es por reserva --«quien diligencia,
 *     distinto en cada curso», dice el modelo--, así que una empresa
 *     con cuatro AF puede traer cuatro personas. Quedarse con la de
 *     la primera reserva las esconde; repetir a la misma cuatro
 *     veces tampoco sirve.
 *
 *  5. La cancelada desaparecida. Es la que explica la columna
 *     Estado: si se cae del agrupado, «AF2 Cancelada» no tiene de
 *     dónde salir.
 *
 * No hay base de datos: `armarAgrupadas` es una función pura sobre
 * las filas que trae la consulta.
 */

import { EstadoReserva } from '../../generated/prisma';
import { armarAgrupadas, type ReservaParaAgrupar } from './reservas-agrupadas';

const EMPRESA = {
  id: 'e1',
  nit: '900111222',
  digitoVerificacion: '3',
  razonSocial: 'COLEGIO SAN JOSÉ',
  numeroColaboradores: 40,
  redAsociada: 'ADECOPRIA',
  redAsociadaOtra: null,
};

const OTRA = { ...EMPRESA, id: 'e2', nit: '800999888', razonSocial: 'LICEO MODERNO' };

/// Una acción de ADECOPRIA. El id es lo que las distingue; el código
/// se repite a propósito en la prueba del gremio ambiguo.
const accion = (id: string, codigo: string, convenio = 'adecopria', sigla = 'ADECOPRIA') => ({
  id,
  codigo,
  nombre: `Acción ${codigo}`,
  convenio: { slug: convenio, sigla },
});

function reserva(
  parcial: Partial<ReservaParaAgrupar> & {
    id: string;
    accionId: string;
    codigo: string;
  },
): ReservaParaAgrupar {
  const { accionId, codigo, ...resto } = parcial;
  return {
    estado: EstadoReserva.CONFIRMADA,
    cuposSolicitados: 5,
    cuposConfirmados: 5,
    cuposEnEspera: 0,
    creadoEn: new Date('2026-09-10T15:00:00Z'),
    canceladaEn: null,
    contactoNombre: 'Ana Gómez',
    contactoCorreo: 'ana@colegio.edu.co',
    contactoCelular: '3001112233',
    contactoCargo: 'Rectora',
    empresa: EMPRESA,
    oferta: {
      modalidad: 'VIRTUAL',
      ubicacion: { nombre: 'Bogotá' },
      accionFormacion: accion(accionId, codigo),
    },
    formulario: { slug: 'adecopria', titulo: 'Inscripción ADECOPRIA' },
    ...resto,
  } as ReservaParaAgrupar;
}

describe('las cuatro reservas de una empresa son UNA fila', () => {
  const cuatro = [
    reserva({ id: 'r1', accionId: 'af1', codigo: 'AF1', cuposConfirmados: 5 }),
    reserva({
      id: 'r2',
      accionId: 'af2',
      codigo: 'AF2',
      cuposConfirmados: 10,
      cuposSolicitados: 10,
      creadoEn: new Date('2026-09-12T15:00:00Z'),
    }),
    reserva({
      id: 'r3',
      accionId: 'af3',
      codigo: 'AF3',
      estado: EstadoReserva.CANCELADA,
      cuposConfirmados: 0,
      cuposSolicitados: 8,
      canceladaEn: new Date('2026-09-18T15:00:00Z'),
      creadoEn: new Date('2026-09-11T15:00:00Z'),
    }),
    reserva({
      id: 'r4',
      accionId: 'af4',
      codigo: 'AF4',
      estado: EstadoReserva.LISTA_ESPERA,
      cuposConfirmados: 0,
      cuposEnEspera: 6,
      cuposSolicitados: 6,
      creadoEn: new Date('2026-09-18T15:00:00Z'),
    }),
  ];

  it('una sola fila, con sus cuatro acciones en columnas', () => {
    const { filas, acciones } = armarAgrupadas(cuatro);

    expect(filas).toHaveLength(1);
    expect(acciones.map((a) => a.codigo)).toEqual(['AF1', 'AF2', 'AF3', 'AF4']);
    expect(Object.keys(filas[0].porAccion).sort()).toEqual(['af1', 'af2', 'af3', 'af4']);
  });

  it('los totales cuadran con lo que suman las celdas', () => {
    const [fila] = armarAgrupadas(cuatro).filas;
    const celdas = Object.values(fila.porAccion);

    expect(fila.totalReservas).toBe(4);
    expect(fila.reservasVivas).toBe(3);
    expect(fila.reservasCanceladas).toBe(1);
    expect(fila.cuposConfirmados).toBe(
      celdas.reduce((t, c) => t + c.cuposConfirmados, 0),
    );
    expect(fila.cuposConfirmados).toBe(15);
    expect(fila.cuposEnEspera).toBe(6);
    expect(fila.cuposSolicitados).toBe(29);
  });

  it('las fechas se consolidan en el tramo de verdad', () => {
    const [fila] = armarAgrupadas(cuatro).filas;

    /// La primera es la del 10 aunque llegara primera en la lista, y
    /// la última la del 18: no es «la primera y la última de la
    /// lista», es la menor y la mayor.
    expect(fila.primeraReserva).toBe(new Date('2026-09-10T15:00:00Z').toISOString());
    expect(fila.ultimaReserva).toBe(new Date('2026-09-18T15:00:00Z').toISOString());
  });

  it('la cancelada se queda: es la que explica la columna Estado', () => {
    const [fila] = armarAgrupadas(cuatro).filas;

    expect(fila.porAccion.af3.estado).toBe(EstadoReserva.CANCELADA);
    /// Sus cupos ya volvieron a la oferta, así que no suman como
    /// apartados; lo que pidió sí se conserva, que es lo que pinta
    /// la celda tachada.
    expect(fila.porAccion.af3.cuposConfirmados).toBe(0);
    expect(fila.porAccion.af3.cuposSolicitados).toBe(8);
  });
});

describe('la misma acción en dos sedes', () => {
  /**
   * El defecto que esto vino a arreglar, visto con los datos de
   * verdad: de 60 reservas, CINCO pares empresa+acción tenían dos
   * reservas --la misma AF dictada en dos departamentos--. Con una
   * reserva por celda, la fila decía «3 reservas · 40 cupos» arriba y
   * sus celdas sumaban 24: la tercera contaba en el total y no se
   * veía en ninguna columna.
   */
  const dosSedes = [
    reserva({
      id: 'r1',
      accionId: 'af2',
      codigo: 'AF2',
      cuposConfirmados: 16,
      cuposSolicitados: 16,
    }),
    {
      ...reserva({
        id: 'r2',
        accionId: 'af2',
        codigo: 'AF2',
        cuposConfirmados: 11,
        cuposSolicitados: 11,
      }),
      oferta: {
        modalidad: 'PRESENCIAL' as const,
        ubicacion: { nombre: 'Bolívar' },
        accionFormacion: accion('af2', 'AF2'),
      },
    },
    reserva({ id: 'r3', accionId: 'af5', codigo: 'AF5', cuposConfirmados: 13 }),
  ];

  it('las dos caben en la misma celda, y no se pierde ninguna', () => {
    const [fila] = armarAgrupadas(dosSedes).filas;

    expect(fila.totalReservas).toBe(3);
    expect(fila.porAccion.af2.reservas).toHaveLength(2);
    expect(fila.porAccion.af2.reservas.map((r) => r.ubicacion)).toEqual([
      'Bogotá',
      'Bolívar',
    ]);
  });

  it('el total de la fila cuadra con lo que suman las celdas', () => {
    const [fila] = armarAgrupadas(dosSedes).filas;
    const sumaDeCeldas = Object.values(fila.porAccion).reduce(
      (t, c) => t + c.cuposConfirmados,
      0,
    );

    expect(fila.cuposConfirmados).toBe(40);
    expect(sumaDeCeldas).toBe(40);
  });

  it('la columna no se duplica: dos reservas de la misma acción son UNA columna', () => {
    const { acciones } = armarAgrupadas(dosSedes);

    expect(acciones.map((a) => a.codigo)).toEqual(['AF2', 'AF5']);
  });

  it('con una confirmada y otra cancelada, la celda queda mixta y manda la viva', () => {
    const { filas } = armarAgrupadas([
      dosSedes[0],
      {
        ...dosSedes[1],
        estado: EstadoReserva.CANCELADA,
        cuposConfirmados: 0,
        canceladaEn: new Date('2026-09-20T15:00:00Z'),
      },
    ]);

    const celda = filas[0].porAccion.af2;
    expect(celda.mixta).toBe(true);
    /// Verde, porque en esa acción la empresa SÍ tiene cupo. Pintarla
    /// de cancelada por la otra sede diría lo contrario.
    expect(celda.estado).toBe(EstadoReserva.CONFIRMADA);
    expect(celda.cuposConfirmados).toBe(16);
    /// Y la cancelada sigue ahí dentro, para que la pantalla la diga.
    expect(celda.reservas.map((r) => r.estado)).toEqual([
      EstadoReserva.CONFIRMADA,
      EstadoReserva.CANCELADA,
    ]);
  });

  it('con una sola reserva, la celda no se marca como mixta', () => {
    const [fila] = armarAgrupadas([dosSedes[2]]).filas;

    expect(fila.porAccion.af5.mixta).toBe(false);
    expect(fila.porAccion.af5.reservas).toHaveLength(1);
  });
});

describe('los contactos', () => {
  it('se juntan por correo y se quedan con las acciones de cada uno', () => {
    const { filas } = armarAgrupadas([
      reserva({ id: 'r1', accionId: 'af1', codigo: 'AF1' }),
      reserva({ id: 'r2', accionId: 'af2', codigo: 'AF2' }),
      reserva({
        id: 'r3',
        accionId: 'af3',
        codigo: 'AF3',
        contactoNombre: 'Luis Prieto',
        contactoCorreo: 'luis@colegio.edu.co',
      }),
    ]);

    const [fila] = filas;
    expect(fila.contactos).toHaveLength(2);
    /// Ana diligenció dos, y sale UNA vez con sus dos códigos.
    expect(fila.contactos[0].nombre).toBe('Ana Gómez');
    expect(fila.contactos[0].codigos).toEqual(['AF1', 'AF2']);
    expect(fila.contactos[1].nombre).toBe('Luis Prieto');
    expect(fila.contactos[1].codigos).toEqual(['AF3']);
  });

  it('el mismo correo con otra caja de letras es la misma persona', () => {
    const { filas } = armarAgrupadas([
      reserva({ id: 'r1', accionId: 'af1', codigo: 'AF1' }),
      reserva({
        id: 'r2',
        accionId: 'af2',
        codigo: 'AF2',
        contactoCorreo: 'ANA@Colegio.edu.co ',
      }),
    ]);

    expect(filas[0].contactos).toHaveLength(1);
    expect(filas[0].contactos[0].codigos).toEqual(['AF1', 'AF2']);
  });
});

describe('los dos «AF1» no se mezclan', () => {
  const dosGremios = [
    reserva({ id: 'r1', accionId: 'af1-adeco', codigo: 'AF1', cuposConfirmados: 5 }),
    {
      ...reserva({ id: 'r2', accionId: 'af1-ae', codigo: 'AF1', cuposConfirmados: 7 }),
      oferta: {
        modalidad: 'VIRTUAL' as const,
        ubicacion: { nombre: 'Bogotá' },
        accionFormacion: accion('af1-ae', 'AF1', 'britcham-adee', 'BRITCHAM'),
      },
    },
  ];

  it('son dos columnas, no una', () => {
    const { acciones } = armarAgrupadas(dosGremios);

    expect(acciones).toHaveLength(2);
    expect(acciones.map((a) => a.accionFormacionId)).toEqual(['af1-adeco', 'af1-ae']);
  });

  it('las dos quedan marcadas como ambiguas, para que la cabecera lo diga', () => {
    const { acciones } = armarAgrupadas(dosGremios);

    expect(acciones.every((a) => a.ambiguo)).toBe(true);
  });

  it('con un gremio solo, ninguna es ambigua: la sigla sobraría', () => {
    const { acciones } = armarAgrupadas([
      reserva({ id: 'r1', accionId: 'af1', codigo: 'AF1' }),
      reserva({ id: 'r2', accionId: 'af2', codigo: 'AF2' }),
    ]);

    expect(acciones.some((a) => a.ambiguo)).toBe(false);
  });

  it('cada celda se queda con sus propios cupos', () => {
    const [fila] = armarAgrupadas(dosGremios).filas;

    expect(fila.porAccion['af1-adeco'].cuposConfirmados).toBe(5);
    expect(fila.porAccion['af1-ae'].cuposConfirmados).toBe(7);
    expect(fila.cuposConfirmados).toBe(12);
  });
});

describe('varias organizaciones', () => {
  it('cada una es su fila, y la columna existe aunque solo una la haya reservado', () => {
    const { filas, acciones } = armarAgrupadas([
      reserva({ id: 'r1', accionId: 'af1', codigo: 'AF1', cuposConfirmados: 5 }),
      reserva({
        id: 'r2',
        accionId: 'af2',
        codigo: 'AF2',
        cuposConfirmados: 20,
        empresa: OTRA,
        contactoCorreo: 'rector@liceo.edu.co',
      }),
    ]);

    expect(filas).toHaveLength(2);
    expect(acciones).toHaveLength(2);
    /// La de más cupos va primero: es de la que más hay que hablar.
    expect(filas[0].razonSocial).toBe('LICEO MODERNO');
    /// Y la que no reservó AF2 no tiene celda ahí: la pantalla pinta
    /// un punto, no un cero. Un cero se leería como «le dieron
    /// ninguno», que no es lo mismo que «no la pidió».
    expect(filas[1].porAccion.af2).toBeUndefined();
  });
});

describe('sin reservas', () => {
  it('no inventa columnas ni filas', () => {
    expect(armarAgrupadas([])).toEqual({
      total: 0,
      truncado: false,
      acciones: [],
      filas: [],
    });
  });
});
