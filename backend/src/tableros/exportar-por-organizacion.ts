/** La descarga en Excel de «Por organización»: el modelo del cliente. */

/**
 * De dónde viene: el cliente entregó `reservas_colegios.xlsx`, hoja
 * «Reservas», 15 colegios reales (30 sep 2026). La pantalla ya pinta
 * ese juego de columnas --ver `frontend/src/components/admin/
 * reservas-unificadas.tsx`--, pero el botón «Descargar en Excel»
 * bajaba el fichero del listado POR RESERVA: una fila por reserva,
 * otras columnas y otros rótulos. El fichero que él le entrega al
 * gremio tenía que armarlo a mano cada vez.
 *
 * Aquí se arma el libro con SU forma: su orden de columnas, sus
 * rótulos letra por letra ---«leads recibidos» en minúscula,
 * «Cuantos inscritos» sin tilde---, sus anchos y su verde de
 * cabecera.
 *
 * POR QUÉ LAS DOS FÓRMULAS VAN COMO FÓRMULAS Y NO COMO NÚMEROS.
 * En su hoja «Total lead gestionados» es `=K2+L2+M2` y «Cupos
 * pendientes» es `=I2-J2`. El fichero se le entrega a un gremio que
 * LO VA A TOCAR: si alguien corrige «Cuantos inscritos» de una fila,
 * con un número calculado el total de al lado se queda mintiendo y
 * nadie se da cuenta. Con la fórmula, Excel lo recalcula solo. Por
 * eso la celda lleva `{ formula }` y no el resultado, aunque el
 * servidor sepa la cifra: ver `CifrasDeLeads`.
 *
 * Ojo con una diferencia deliberada: `cuposPendientes` del servidor
 * está acotado a cero y la fórmula `=I2-J2` no lo está. Se deja la
 * fórmula tal cual porque es la suya y porque un negativo en esa
 * celda es información --mandaron más gente que cupos apartaron-- y
 * no un error de cuentas.
 */

import type { Hoja } from './exportar';
import type {
  ColumnaAccion,
  FilaAgrupada,
  ReservasAgrupadas,
} from './reservas-agrupadas';
import { EstadoReserva } from '../../generated/prisma';

/**
 * El verde de su cabecera, tal cual salió de su fichero.
 *
 * No es el azul del resto de las descargas de la casa a propósito:
 * esta hoja se coteja contra la que él entregó, y un color distinto
 * es lo primero que se ve.
 */
export const VERDE_CABECERA = 'FF1F6B3B';

/**
 * EL SEGUNDO COLOR, Y ES UN AÑADIDO NUESTRO — PENDIENTE DE QUE ÉL
 * LO CONFIRME (30 sep 2026).
 *
 * En su fichero las cuatro columnas de gestión --«leads recibidos»,
 * «Cuantos inscritos», «Descartados», «No contactable»-- quedaron
 * SIN relleno, con la letra blanca que tienen las demás: en Excel se
 * leen como cuatro cabeceras vacías. Es un descuido, no una
 * decisión: en el tablero de Tráfico él mismo pidió «de un color lo
 * que entró, de otro lo que se inscribió», que es exactamente este
 * bloque.
 *
 * Así que se les pone un verde MÁS CLARO DEL MISMO TONO, que
 * distingue el bloque sin inventar un color nuevo. Este, y no uno
 * más pálido, porque la letra sigue siendo blanca: con el aclarado
 * del 40 % que Excel aplica por omisión el contraste se cae a 2,8:1
 * y la cabecera vuelve a no leerse. Con este queda en 4,8:1.
 *
 * Si él prefiere otro, se cambia esta constante y nada más.
 */
export const VERDE_GESTION = 'FF3F7F55';

/** Arial 10, como toda su hoja. */
const FUENTE = 'Arial';
const TAMANO = 10;

/** El de las columnas AF en su fichero. */
const ANCHO_AF = 9;

const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  [EstadoReserva.CONFIRMADA]: 'Confirmada',
  [EstadoReserva.LISTA_ESPERA]: 'En espera',
  [EstadoReserva.CANCELADA]: 'Cancelada',
};

/**
 * LAS QUINCE FIJAS, EN SU ORDEN Y CON SUS ANCHOS.
 *
 * Los anchos son los medidos en su fichero y no números redondos:
 * así la hoja descargada se superpone con la suya sin que nadie
 * tenga que arrastrar bordes.
 *
 * Las cuatro de gestión van marcadas con `relleno`: ver
 * `VERDE_GESTION`.
 */
const FIJAS: Array<{
  titulo: string;
  clave: string;
  ancho: number;
  relleno?: string;
}> = [
  { titulo: 'Fechas', clave: 'fechas', ancho: 32.71 },
  { titulo: 'NIT', clave: 'nit', ancho: 15 },
  { titulo: 'Organización', clave: 'organizacion', ancho: 55.71 },
  { titulo: 'Contacto', clave: 'contacto', ancho: 30 },
  { titulo: 'Correo del contacto', clave: 'correo', ancho: 40 },
  { titulo: 'Celular del contacto', clave: 'celular', ancho: 24 },
  { titulo: 'Cargo del contacto', clave: 'cargo', ancho: 34 },
  { titulo: 'Estado', clave: 'estado', ancho: 17 },
  { titulo: 'Cupos reservados', clave: 'cuposReservados', ancho: 13.29 },
  {
    titulo: 'leads recibidos',
    clave: 'leadsRecibidos',
    ancho: 13.29,
    relleno: VERDE_GESTION,
  },
  {
    titulo: 'Cuantos inscritos',
    clave: 'inscritos',
    ancho: 13.29,
    relleno: VERDE_GESTION,
  },
  {
    titulo: 'Descartados',
    clave: 'descartados',
    ancho: 11.86,
    relleno: VERDE_GESTION,
  },
  {
    titulo: 'No contactable',
    clave: 'noContactable',
    ancho: 11.86,
    relleno: VERDE_GESTION,
  },
  { titulo: 'Total lead gestionados', clave: 'totalGestionados', ancho: 13.29 },
  { titulo: 'Cupos pendientes', clave: 'cuposPendientes', ancho: 11 },
];

/** Los rótulos de las quince, para la prueba. */
export const TITULOS_FIJOS = FIJAS.map((c) => c.titulo);

/**
 * Las dos columnas que son fórmula, por su letra de Excel.
 *
 * Van por POSICIÓN y no por nombre porque la fórmula es la suya
 * (`=K2+L2+M2`, `=I2-J2`) y las letras son las de su hoja: si algún
 * día se mete una columna antes, estas tienen que moverse con ella.
 * Se calculan de `FIJAS` para que no puedan desincronizarse.
 */
const letra = (clave: string) =>
  String.fromCharCode(65 + FIJAS.findIndex((c) => c.clave === clave));

const COL_RESERVADOS = letra('cuposReservados'); // I
const COL_RECIBIDOS = letra('leadsRecibidos'); // J
const COL_INSCRITOS = letra('inscritos'); // K
const COL_DESCARTADOS = letra('descartados'); // L
const COL_NO_CONTACTABLE = letra('noContactable'); // M

/**
 * «01 de sept de 26».
 *
 * EL MISMO FORMATO QUE LA PANTALLA, letra por letra: es `es-CO` con
 * día de dos cifras, mes corto y año de dos. Se escribe como TEXTO y
 * no como fecha porque una fila puede traer varios días --«07 de
 * sept de 26 / 14 de sept de 26», su fila 8-- y eso no es una fecha.
 */
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });

/**
 * Los días en que esta organización reservó, en una sola línea.
 *
 * Se agrupa por la fecha YA ESCRITA y no por el instante: dos
 * reservas del mismo día de Bogotá tienen instantes distintos, y
 * comparar el ISO cortado las separaría en dos cada vez que una cae
 * después de las 7 de la tarde. Es el mismo criterio que
 * `diasDeLaFila` de la pantalla.
 */
function dias(fila: FilaAgrupada): string {
  const vistos = new Map<string, string>();
  for (const celda of Object.values(fila.porAccion)) {
    for (const r of celda.reservas) {
      const texto = fecha(r.creadoEn);
      const previo = vistos.get(texto);
      if (previo === undefined || r.creadoEn < previo)
        vistos.set(texto, r.creadoEn);
    }
  }
  if (vistos.size === 0) return fecha(fila.ultimaReserva);
  return [...vistos.entries()]
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([texto]) => texto)
    .join(' / ');
}

/**
 * Los vacíos se caen antes de unir.
 *
 * Dos contactos de los que uno no dejó celular escribían
 * «3194173564 / », que se lee como un dato a medio teclear.
 */
const juntar = (valores: Array<string | null>, separador = ' / ') =>
  valores.filter((v): v is string => !!v?.trim()).join(separador);

/**
 * La columna Estado: «Confirmada las 6», o la lista si hay mezcla.
 *
 * EL NÚMERO SON ACCIONES DE FORMACIÓN y no reservas --la misma
 * acción en dos sedes son dos reservas y UNA acción--, que es la
 * lectura acordada del «las 6» de su hoja. Se cuenta igual que en la
 * pantalla, para que las dos digan lo mismo del mismo dato.
 */
function estadoDeLaFila(fila: FilaAgrupada, acciones: ColumnaAccion[]): string {
  const suyas = acciones
    .filter((a) => fila.porAccion[a.accionFormacionId])
    .map((a) => ({ accion: a, celda: fila.porAccion[a.accionFormacionId] }));

  if (suyas.length === 0) return '';

  const estados = new Set(suyas.map((s) => s.celda.estado));
  if (estados.size === 1 && !suyas.some((s) => s.celda.mixta)) {
    const texto = ETIQUETA_ESTADO[suyas[0].celda.estado];
    /// «Confirmada» a secas cuando es una sola, SIN EL PUNTO DEL
    /// MEDIO: es como lo escribió él, y esta columna se coteja
    /// contra su hoja.
    return suyas.length > 1 ? `${texto} las ${suyas.length}` : texto;
  }

  /// Con mezcla no se puede resumir en una palabra: decir solo
  /// «Confirmada» esconderia la cancelada de al lado.
  return suyas
    .map(({ accion, celda }) =>
      celda.mixta
        ? `${accion.codigo} ${[...new Set(celda.reservas.map((r) => ETIQUETA_ESTADO[r.estado]))].join(' · ')}`
        : `${accion.codigo} ${ETIQUETA_ESTADO[celda.estado]}`,
    )
    .join(' / ');
}

/**
 * Cómo se rotula una columna AF. El gremio solo se añade cuando hace
 * falta: «AF1» se repite entre convenios y no significa lo mismo, así
 * que con los dos a la vista dos columnas «AF1» a secas serían
 * indistinguibles. Es `tituloDeAccion` de la pantalla.
 */
const tituloDeAccion = (a: ColumnaAccion) =>
  a.ambiguo && a.convenioSigla ? `${a.codigo} · ${a.convenioSigla}` : a.codigo;

/**
 * Lo que va en la celda de una AF.
 *
 * Sin reserva va `null` y NO cero: cero es un número que se suma y
 * se ordena, y «no reservó» no es «reservó cero». En su hoja esas
 * celdas están vacías. Es el mismo criterio que la pantalla.
 */
function cupoDeLaAccion(fila: FilaAgrupada, id: string): number | null {
  const celda = fila.porAccion[id];
  if (!celda) return null;
  return celda.estado === EstadoReserva.CANCELADA
    ? celda.cuposSolicitados
    : celda.cuposConfirmados;
}

/**
 * La hoja «Reservas» del modelo, lista para `construirLibro`.
 *
 * Las columnas AF van DETRÁS de las quince fijas y en el orden que
 * manda el servidor --el mismo que pinta la pantalla--, que es el de
 * las acciones donde alguien reservó. No hay lista escrita a mano:
 * en su fichero falta AF4 porque nadie reservó ahí, y con dos
 * gremios a la vista hay dos «AF1» distintos.
 */
export function hojaPorOrganizacion(datos: ReservasAgrupadas): Hoja {
  const columnas = [
    ...FIJAS,
    ...datos.acciones.map((a, i) => ({
      titulo: tituloDeAccion(a),
      clave: `af${i}`,
      ancho: ANCHO_AF,
    })),
  ];

  const filas = datos.filas.map((fila, i) => {
    /// LA FILA DE EXCEL, no el índice: la cabecera es la 1, así que
    /// la primera organización es la 2 y sus fórmulas hablan de la 2.
    const n = i + 2;
    const deAcciones: Record<string, number | null> = {};
    datos.acciones.forEach((a, j) => {
      deAcciones[`af${j}`] = cupoDeLaAccion(fila, a.accionFormacionId);
    });

    return {
      fechas: dias(fila),
      /// Con el dígito de verificación pegado, como en su hoja
      /// («890900938-1»).
      nit: fila.digitoVerificacion
        ? `${fila.nit}-${fila.digitoVerificacion}`
        : fila.nit,
      organizacion: fila.razonSocial.trim().toUpperCase(),
      /// El resto de personas se cuenta ENTRE PARÉNTESIS --«(+1)»--
      /// porque así lo escribió él (sus filas 6, 8, 14 y 15). Sin
      /// ellos, «Ana Jaramillo +1» se lee como parte del nombre.
      contacto: fila.contactos.length
        ? fila.contactos[0].nombre +
          (fila.contactos.length > 1 ? ` (+${fila.contactos.length - 1})` : '')
        : '',
      correo: juntar(fila.contactos.map((c) => c.correo)),
      celular: juntar(fila.contactos.map((c) => c.celular)),
      /// LOS CARGOS CON « ; » Y LOS CELULARES CON « / », y la
      /// diferencia es de su hoja: un cargo puede llevar una barra
      /// dentro --«Directora Pedagógica y de Bilingüismo»-- y
      /// entonces no se sabría dónde acaba uno.
      cargo: juntar(
        fila.contactos.map((c) => c.cargo),
        ' ; ',
      ),
      estado: estadoDeLaFila(fila, datos.acciones),
      cuposReservados: fila.cuposConfirmados,
      leadsRecibidos: fila.leads.leadsRecibidos,
      inscritos: fila.leads.inscritos,
      descartados: fila.leads.descartados,
      noContactable: fila.leads.noContactable,
      /// FÓRMULA, NO NÚMERO. Ver la cabecera del fichero.
      totalGestionados: {
        formula: `${COL_INSCRITOS}${n}+${COL_DESCARTADOS}${n}+${COL_NO_CONTACTABLE}${n}`,
      },
      cuposPendientes: {
        formula: `${COL_RESERVADOS}${n}-${COL_RECIBIDOS}${n}`,
      },
      ...deAcciones,
    };
  });

  return {
    nombre: 'Reservas',
    columnas,
    filas,
    cabecera: {
      relleno: VERDE_CABECERA,
      fuente: FUENTE,
      tamano: TAMANO,
      alto: 42,
    },
    /// NIT y Fechas quedan a la vista al desplazarse a las AF, que
    /// es lo que hizo él en su fichero: con veintiuna columnas, sin
    /// esto no se sabe de quién es la fila que se está mirando.
    congelarColumnas: 2,
    cuerpo: { fuente: FUENTE, tamano: TAMANO },
    /// EL ANCHO DE LAS AF, que son las que van a 9. Tiene que ir aquí
    /// y no solo en cada columna: exceljs descarta el 9 al escribir
    /// --es su propio valor por omisión-- y sin esto Excel las pinta
    /// a 8,43. Ver `anchoPorOmision`.
    anchoPorOmision: ANCHO_AF,
  };
}
