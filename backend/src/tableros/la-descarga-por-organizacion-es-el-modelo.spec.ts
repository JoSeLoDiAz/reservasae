/** La descarga de «Por organización» sale igual que el modelo del cliente. */

/**
 * Lo que esto viene a impedir (30 sep 2026):
 *
 *  1. Que las columnas se muevan. El cliente entregó
 *     `reservas_colegios.xlsx` y el fichero que baja el panel se
 *     coteja contra él columna por columna. Sus quince primeras van
 *     en SU orden y con SUS rótulos --«leads recibidos» en
 *     minúscula, «Cuantos inscritos» sin tilde--, y cualquiera de
 *     las dos cosas se cambia sin querer al tocar el fichero de al
 *     lado.
 *
 *  2. Que las dos fórmulas salgan como números calculados. Es el
 *     defecto caro: el fichero se le entrega a un gremio QUE LO VA A
 *     TOCAR, y con números, al corregir «Cuantos inscritos» de una
 *     fila, el total de al lado se queda mintiendo. Tienen que ser
 *     `=K2+L2+M2` y `=I2-J2`, como en su hoja.
 *
 *  3. Que las columnas AF se adelanten a las fijas, o que salgan las
 *     que nadie reservó. Son dinámicas --«en su modelo falta AF4
 *     porque nadie reservó ahí»-- y van DETRÁS de las quince, en el
 *     orden que manda el servidor, que es el que pinta la pantalla.
 *
 *  4. Que la cabecera pierda su verde, o que el bloque de gestión
 *     vuelva a quedarse sin relleno --que es como vino en su
 *     fichero: letra blanca sobre nada, cuatro cabeceras invisibles.
 *
 * No hay base de datos: `armarAgrupadas` y `hojaPorOrganizacion` son
 * funciones puras, y el libro se lee con el mismo exceljs que lo
 * escribe.
 */

import ExcelJS from 'exceljs';

import { EstadoReserva } from '../../generated/prisma';
import { construirLibro } from './exportar';
import {
  hojaPorOrganizacion,
  TITULOS_FIJOS,
  VERDE_CABECERA,
  VERDE_GESTION,
} from './exportar-por-organizacion';
import { armarAgrupadas, type ReservaParaAgrupar } from './reservas-agrupadas';

const EMPRESA = {
  id: 'e1',
  nit: '890900938',
  digitoVerificacion: '1',
  razonSocial: 'Colegio Colombo Británico de Envigado',
  numeroColaboradores: 40,
  redAsociada: 'ADECOPRIA',
  redAsociadaOtra: null,
};

const OTRA = {
  ...EMPRESA,
  id: 'e2',
  nit: '890981239',
  digitoVerificacion: null,
  razonSocial: 'INSTITUTO MUSICAL DIEGO ECHAVARRIA',
};

const accion = (
  id: string,
  codigo: string,
  convenio = 'adecopria',
  sigla: string | null = 'ADECOPRIA',
) => ({
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
    convenio?: string;
    sigla?: string;
  },
): ReservaParaAgrupar {
  const { accionId, codigo, convenio, sigla, ...resto } = parcial;
  return {
    estado: EstadoReserva.CONFIRMADA,
    cuposSolicitados: 40,
    cuposConfirmados: 40,
    cuposEnEspera: 0,
    creadoEn: new Date('2026-09-01T15:00:00Z'),
    canceladaEn: null,
    contactoNombre: 'Gerardo Franco',
    contactoCorreo: 'rector@cbw.edu.co',
    contactoCelular: '3166656075',
    contactoCargo: 'Rector',
    empresa: EMPRESA,
    oferta: {
      modalidad: 'VIRTUAL',
      ubicacion: { nombre: 'Medellín' },
      accionFormacion: accion(accionId, codigo, convenio, sigla),
    },
    formulario: { slug: 'adecopria', titulo: 'Inscripción ADECOPRIA' },
    ...resto,
  };
}

/** Tres AF de un colegio y una de otro, con sus cifras de leads. */
const CUATRO = [
  reserva({ id: 'r1', accionId: 'af1', codigo: 'AF1', cuposConfirmados: 20 }),
  reserva({
    id: 'r2',
    accionId: 'af2',
    codigo: 'AF2',
    cuposConfirmados: 10,
    cuposSolicitados: 10,
    creadoEn: new Date('2026-09-12T15:00:00Z'),
    contactoNombre: 'Natalia Montes',
    contactoCorreo: 'natalia@cbw.edu.co',
    contactoCelular: null,
    contactoCargo: 'Directora Pedagógica y de Bilingüismo',
  }),
  reserva({
    id: 'r3',
    accionId: 'af5',
    codigo: 'AF5',
    estado: EstadoReserva.CANCELADA,
    cuposConfirmados: 0,
    cuposSolicitados: 8,
    canceladaEn: new Date('2026-09-18T15:00:00Z'),
  }),
  /// MENOS CUPOS QUE EL PRIMERO A PROPÓSITO: las filas salen de más
  /// a menos apartado, así que así se sabe cuál es cuál.
  reserva({
    id: 'r4',
    accionId: 'af3',
    codigo: 'AF3',
    empresa: OTRA,
    cuposConfirmados: 25,
    cuposSolicitados: 25,
  }),
];

const LEADS = new Map([
  [
    'e1',
    { leadsRecibidos: 20, inscritos: 10, descartados: 5, noContactable: 5 },
  ],
  [
    'e2',
    { leadsRecibidos: 25, inscritos: 25, descartados: 0, noContactable: 0 },
  ],
]);

const agrupadas = () => armarAgrupadas(CUATRO, new Map(), LEADS);

/**
 * El libro ESCRITO Y VUELTO A LEER, que es la única manera de saber
 * qué le llega a Excel: lo que la hoja declare no sirve de prueba de
 * que el .xlsx lo lleve.
 *
 * El `as` es por los tipos de exceljs: `writeBuffer` devuelve un
 * `Buffer<ArrayBufferLike>` y `load` declara el `Buffer` a secas.
 */
async function releido(hojas = [hojaPorOrganizacion(agrupadas())]) {
  const libro = new ExcelJS.Workbook();
  const bytes = await construirLibro(hojas);
  await libro.xlsx.load(
    bytes as unknown as Parameters<typeof libro.xlsx.load>[0],
  );
  return libro;
}

/** El congelado, que exceljs declara sin `xSplit`. */
const congelado = (hoja: ExcelJS.Worksheet) =>
  hoja.views[0] as { state?: string; xSplit?: number; ySplit?: number };

describe('las quince columnas fijas, en el orden de su hoja', () => {
  it('son las suyas, letra por letra', () => {
    expect(TITULOS_FIJOS).toEqual([
      'Fechas',
      'NIT',
      'Organización',
      'Contacto',
      'Correo del contacto',
      'Celular del contacto',
      'Cargo del contacto',
      'Estado',
      'Cupos reservados',
      'leads recibidos',
      'Cuantos inscritos',
      'Descartados',
      'No contactable',
      'Total lead gestionados',
      'Cupos pendientes',
    ]);
  });

  it('la hoja las lleva todas y en ese orden', () => {
    const hoja = hojaPorOrganizacion(agrupadas());

    expect(hoja.nombre).toBe('Reservas');
    expect(hoja.columnas.slice(0, 15).map((c) => c.titulo)).toEqual(
      TITULOS_FIJOS,
    );
  });

  it('el NIT lleva pegado el dígito de verificación, y sin él no lo inventa', () => {
    const [primera, segunda] = hojaPorOrganizacion(agrupadas()).filas;

    expect(primera.nit).toBe('890900938-1');
    expect(segunda.nit).toBe('890981239');
  });

  it('la organización va en mayúsculas, como en su hoja', () => {
    expect(hojaPorOrganizacion(agrupadas()).filas[0].organizacion).toBe(
      'COLEGIO COLOMBO BRITÁNICO DE ENVIGADO',
    );
  });

  it('el segundo contacto se cuenta entre paréntesis y los cargos van con « ; »', () => {
    const [fila] = hojaPorOrganizacion(agrupadas()).filas;

    expect(fila.contacto).toBe('Gerardo Franco (+1)');
    expect(fila.cargo).toBe('Rector ; Directora Pedagógica y de Bilingüismo');
    /// El celular que falta se cae: «3166656075 / » se lee como un
    /// dato a medio teclear.
    expect(fila.celular).toBe('3166656075');
  });

  it('«Confirmada las 2» cuenta ACCIONES, y la mezcla se abre por AF', () => {
    const [primera, segunda] = hojaPorOrganizacion(agrupadas()).filas;

    /// Dos confirmadas y una cancelada: no se puede resumir en una
    /// palabra sin esconder la cancelada.
    expect(primera.estado).toBe(
      'AF1 Confirmada / AF2 Confirmada / AF5 Cancelada',
    );
    expect(segunda.estado).toBe('Confirmada');
  });

  it('las fechas van en una sola línea, con « / »', () => {
    expect(hojaPorOrganizacion(agrupadas()).filas[0].fechas).toBe(
      '01 de sept de 26 / 12 de sept de 26',
    );
  });
});

describe('las dos fórmulas salen como FÓRMULA y no como número', () => {
  it('en la hoja, la celda lleva `formula` y no la cifra', () => {
    const [primera, segunda] = hojaPorOrganizacion(agrupadas()).filas;

    expect(primera.totalGestionados).toEqual({ formula: 'K2+L2+M2' });
    expect(primera.cuposPendientes).toEqual({ formula: 'I2-J2' });
    /// La segunda organización es la fila 3 de Excel, y su fórmula
    /// habla de la 3: la cabecera ocupa la 1.
    expect(segunda.totalGestionados).toEqual({ formula: 'K3+L3+M3' });
    expect(segunda.cuposPendientes).toEqual({ formula: 'I3-J3' });
  });

  it('en el .xlsx escrito siguen siendo fórmulas', async () => {
    const hoja = (await releido()).getWorksheet('Reservas')!;

    const total = hoja.getRow(2).getCell(14);
    const pendientes = hoja.getRow(2).getCell(15);

    expect(total.type).toBe(ExcelJS.ValueType.Formula);
    expect(pendientes.type).toBe(ExcelJS.ValueType.Formula);
    expect(total.formula).toBe('K2+L2+M2');
    expect(pendientes.formula).toBe('I2-J2');
  });

  it('las cifras que SÍ son dato siguen siendo números', async () => {
    const hoja = (await releido()).getWorksheet('Reservas')!;

    expect(hoja.getRow(2).getCell(9).value).toBe(30);
    expect(hoja.getRow(2).getCell(10).value).toBe(20);
    expect(hoja.getRow(2).getCell(11).value).toBe(10);
  });
});

describe('las columnas AF van detrás de las fijas y son las que tienen reserva', () => {
  it('detrás de la quince, en el orden del servidor', () => {
    const datos = agrupadas();
    const hoja = hojaPorOrganizacion(datos);

    expect(hoja.columnas).toHaveLength(15 + datos.acciones.length);
    expect(hoja.columnas.slice(15).map((c) => c.titulo)).toEqual(
      datos.acciones.map((a) => a.codigo),
    );
  });

  it('solo las acciones donde alguien reservó: AF4 no existe', () => {
    const codigos = hojaPorOrganizacion(agrupadas())
      .columnas.slice(15)
      .map((c) => c.titulo);

    /// Por código, con el gremio de desempate: así los dos «AF1» de
    /// dos gremios quedan juntos.
    expect(codigos).toEqual(['AF1', 'AF2', 'AF3', 'AF5']);
    expect(codigos).not.toContain('AF4');
  });

  it('sin reserva la celda va vacía y NO en cero', () => {
    const datos = agrupadas();
    const hoja = hojaPorOrganizacion(datos);
    /// La segunda organización solo reservó AF3, la tercera columna
    /// AF: las otras tres se quedan vacías. Cero es un número que se
    /// suma, y «no reservó» no es «reservó cero».
    expect(hoja.filas[1].af0).toBeNull();
    expect(hoja.filas[1].af2).toBe(25);
    /// Y la cancelada lleva los SOLICITADOS: sus cupos volvieron a
    /// la oferta, así que confirmados es cero y no dice qué apartó.
    expect(hoja.filas[0].af3).toBe(8);
  });

  it('con dos gremios, el código solo no basta: la cabecera lleva la sigla', () => {
    const datos = armarAgrupadas([
      reserva({ id: 'r1', accionId: 'a-ade', codigo: 'AF1' }),
      reserva({
        id: 'r2',
        accionId: 'a-ae',
        codigo: 'AF1',
        convenio: 'grupo-ae',
        sigla: 'GRUPO AE',
      }),
    ]);

    expect(
      hojaPorOrganizacion(datos)
        .columnas.slice(15)
        .map((c) => c.titulo),
    ).toEqual(['AF1 · ADECOPRIA', 'AF1 · GRUPO AE']);
  });
});

describe('los colores de la cabecera son los suyos', () => {
  const relleno = (celda: ExcelJS.Cell) =>
    (celda.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;

  it('verde oscuro con letra blanca en negrita, Arial 10', async () => {
    const cabecera = (await releido()).getWorksheet('Reservas')!.getRow(1);

    expect(relleno(cabecera.getCell(1))).toBe(VERDE_CABECERA);
    expect(cabecera.getCell(1).font).toMatchObject({
      bold: true,
      name: 'Arial',
      size: 10,
      color: { argb: 'FFFFFFFF' },
    });
  });

  it('el bloque de gestión --J a M-- va de su propio verde, NO sin relleno', async () => {
    const cabecera = (await releido()).getWorksheet('Reservas')!.getRow(1);

    for (const columna of [10, 11, 12, 13]) {
      expect(relleno(cabecera.getCell(columna))).toBe(VERDE_GESTION);
    }
    /// Y las de al lado NO se contagian: «Cupos reservados» y «Total
    /// lead gestionados» siguen en el verde de la hoja.
    expect(relleno(cabecera.getCell(9))).toBe(VERDE_CABECERA);
    expect(relleno(cabecera.getCell(14))).toBe(VERDE_CABECERA);
    expect(VERDE_GESTION).not.toBe(VERDE_CABECERA);
  });

  /**
   * LOS ANCHOS, Y EL DE LAS AF POR SEPARADO.
   *
   * Las AF van a 9, que es el valor por omisión DE exceljs: lo
   * descarta al escribir y entonces Excel las pinta a 8,43, un poco
   * más estrechas que en su hoja. La hoja declara el 9 como ancho
   * por omisión para que viaje en el fichero. Sin esta prueba el
   * detalle vuelve solo en cuanto alguien toque `construirLibro`.
   */
  it('los anchos son los medidos en su fichero, y el 9 de las AF viaja', async () => {
    const hoja = (await releido()).getWorksheet('Reservas')!;

    expect(hoja.getColumn(1).width).toBe(32.71);
    expect(hoja.getColumn(3).width).toBe(55.71);
    expect(hoja.properties.defaultColWidth).toBe(9);
  });

  it('NIT y Fechas quedan congeladas al desplazarse a las AF', async () => {
    const hoja = (await releido()).getWorksheet('Reservas')!;

    expect(congelado(hoja)).toMatchObject({
      state: 'frozen',
      xSplit: 2,
      ySplit: 1,
    });
  });
});

describe('las descargas de siempre no se enteran', () => {
  /// La cabecera a medida es opcional, y sin ella la hoja sale como
  /// salía: azul de marca, sin centrar y sin congelar columnas. Es
  /// lo que impide que arreglar el modelo del cliente le cambie el
  /// fichero a las otras ocho descargas.
  it('sin `cabecera`, el azul de marca y una sola fila congelada', async () => {
    const libro = await releido([
      {
        nombre: 'Empresas',
        columnas: [{ titulo: 'NIT', clave: 'nit' }],
        filas: [{ nit: '890900938' }],
      },
    ]);
    const hoja = libro.getWorksheet('Empresas')!;

    expect(
      (hoja.getRow(1).getCell(1).fill as ExcelJS.FillPattern).fgColor?.argb,
    ).toBe('FF1E3A8A');
    expect(congelado(hoja)).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(congelado(hoja).xSplit).toBeFalsy();
  });
});
