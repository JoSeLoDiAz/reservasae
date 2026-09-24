/** El informe de reservas: el PDF de Google Sheets, servido de una vez. */

/**
 * De dónde viene: el cliente armaba a mano en una hoja de cálculo
 * «RESERVAS ADECOPRIA», dos tablas —cuántas reservas por acción de
 * formación, y cuántas por organización dentro de cada acción— y
 * pedía verlo en el panel, con gráficas, detrás del botón «Ver
 * reservas» del bloque «Cupos apartados por empresas».
 *
 * Por qué es un endpoint y no una cuenta en el navegador, aunque el
 * listado de reservas ya trae la acción de cada fila:
 *
 *  - El listado pagina con tope duro de 200. Hoy hay 60 reservas y
 *    cabrían en una página, así que el informe armado en el navegador
 *    saldría BIEN hoy y empezaría a mentir en silencio el día 201: la
 *    «Suma total» se quedaría congelada y nadie lo notaría, porque una
 *    suma equivocada no se ve equivocada.
 *  - Cada fila del listado arrastra TODAS las respuestas del
 *    formulario público. Para cuatro columnas es traerse el
 *    formulario entero de cada organización.
 *  - «Cuántos cupos ya tienen nombre», por acción y por organización,
 *    no viaja en ninguna respuesta de hoy: hay que salir de
 *    participantes y del ancla de matrícula.
 *
 * Se trae UNA fila por reserva —estrecha, sin respuestas— y todo lo
 * demás se agrega aquí, en `armarInforme`, a partir de esas mismas
 * filas. Así las dos tablas, los totales y cada gráfica salen de la
 * misma lista y cuadran por construcción: con una consulta por
 * tabla, cada una con su WHERE, bastaba con que una se olvidara de
 * las canceladas para que la Tabla 1 y la Tabla 2 sumaran distinto
 * con el mismo pie de «Suma total».
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  EstadoReserva,
  Prisma,
  type Modalidad,
  type TipoUbicacion,
} from '../../generated/prisma';
import { booleanoDeVerdad } from '../comun/booleano-de-verdad';
import { aDiaBogota, diaBogota, fechaBogota } from '../comun/dia-bogota';
import { enPeriodo, PRIMERA_MATRICULA } from '../crm/anclas';
import { OCUPAN_SILLA } from '../crm/etapas';
import type { PrismaService } from '../prisma/prisma.service';
import { sqlDeConvenio } from './ambito';
import {
  DIAS_DE_AVISO,
  PLAZO_ENTREGA_NOMBRES,
  estadoDelPlazo,
  type EstadoDelPlazo,
} from './plazo-de-reservas';

/**
 * Tope de filas del cruce acción × organización.
 *
 * Hoy son 51. El tope no está para ahorrar: está para que, si algún
 * día se corta, se DIGA (`truncado`). Los totales se calculan antes
 * de cortar, así que la «Suma total» sigue siendo la de verdad
 * aunque la tabla no muestre todas las filas.
 */
export const TOPE_PARES = 1000;

/**
 * Cómo se llama la barra de las sedes que no tienen departamento.
 *
 * Se cuentan y se enseñan: son cupos de verdad, y esconderlos haría
 * que las barras no sumaran el total de arriba.
 */
export const SIN_DEPARTAMENTO = 'Sin departamento';

// ── el contrato ─────────────────────────────────────────────────
// Espejo de `frontend/src/lib/tableros-api.ts`. Si se cambia uno,
// se cambia el otro: la pantalla no tiene otra fuente de verdad.

export type FiltrosInformeReservas = {
  /**
   * El gremio, por id. Es el que trae el enlace desde Control: el
   * bloque de cupos filtra por `convenioId`, y sin arrastrarlo se
   * hacía clic en los 149 cupos de ADECOPRIA y el informe abría con
   * los 539 de los dos gremios —la misma sensación de «no
   * funciona»—. SE INTERSECA con el ámbito del guard.
   */
  convenioId?: string;
  /** El mismo corte por slug, como el listado y el Excel. Si llegan
      los dos, manda `convenioId`. */
  convenio?: string;
  accionFormacionId?: string;
  /** Dónde se dicta (Oferta.ubicacionId), no dónde vive nadie. */
  ubicacionId?: string;
  /**
   * El departamento donde se dicta, por su nombre.
   *
   * Es un corte MÁS ANCHO que `ubicacionId`: la ciudad de Medellín y
   * el departamento de Antioquia son dos ubicaciones distintas, y el
   * cliente pide ver «Antioquia» con las dos dentro (23 sep 2026).
   * Va por nombre y no por id porque `Ubicacion.departamento` es un
   * texto: no hay tabla de departamentos de la que colgar un id.
   */
  departamento?: string;
  /** Una sola institución, por su id de empresa. */
  empresaId?: string;
  /** Días de calendario de Bogotá, «YYYY-MM-DD», los dos inclusive. */
  desde?: string;
  hasta?: string;
  /** Por omisión false. Las canceladas se cuentan aparte SIEMPRE. */
  incluirCanceladas?: boolean;
};

/** Lo que se reparte igual en las tres tablas. */
type Cifras = {
  reservas: number;
  cuposConfirmados: number;
  cuposEnEspera: number;
  /** Cupos con una persona matriculada detrás. */
  conNombre: number;
  /**
   * Los de esos que siguen dentro HOY.
   *
   * `conNombre` cuenta a quien llegó alguna vez, retirado o no, y es
   * la que alimenta la brecha de nombres y el informe que se le
   * reporta al SENA. Esta descuenta las salidas. Las dos son
   * ciertas; lo que no pueden es llamarse igual.
   */
  dentro: number;
  /**
   * Cupos confirmados que siguen sin persona, acotado a cero RESERVA
   * POR RESERVA y luego sumado.
   *
   * Hay reservas con más matriculados que cupos (en local, AF1 de
   * «Logística Sur Express»: 10 cupos, 12 personas). Sin acotar salía
   * un «sin nombre» negativo; acotado solo en cada fila de la tabla,
   * la suma por acción y la suma por organización dejaban de dar lo
   * mismo, porque la sobra de una reserva se comía los huecos de otra
   * según cómo se agrupara. Acotado en la reserva —que es donde está
   * el cupo— la cifra se puede sumar en cualquier sentido, y es la
   * verdad: dos personas de más en un curso no llenan las sillas de
   * otra organización.
   */
  sinNombre: number;
  /**
   * Personas matriculadas POR ENCIMA de los cupos de su reserva.
   * Es lo que hace falta para leer una fila contra la otra:
   * sinNombre = cuposConfirmados − conNombre + nombresDeMas.
   */
  nombresDeMas: number;
};

export type FilaInformeAccion = Cifras & {
  /** La llave es el id: el código solo es único por convenio y con
      los dos gremios hay dos «AF1» distintos. */
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  convenio: string;
  convenioSigla: string | null;
  modalidad: Modalidad;
  horas: number | null;
  organizaciones: number;
  /** Techo de inscripción: suma de Oferta.cuposMaximos. */
  cuposDelProyecto: number;
  /** Lo comprometido ante el SENA, sin el 30 % de sobrecupo. */
  metaComprometida: number;
  reservasCanceladas: number;
  cuposCancelados: number;
};

export type FilaInformeCruce = Cifras & {
  accionFormacionId: string;
  codigo: string;
  accion: string;
  empresaId: string;
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  ubicaciones: string[];
  primeraReserva: string;
  ultimaReserva: string;
  /**
   * En qué punto del plazo del 30 de septiembre va esta fila.
   *
   * Se calcula AQUÍ y no en el navegador: la regla ya está escrita y
   * probada en `plazo-de-reservas.ts`, y una segunda copia en el
   * frontend es la que se queda vieja el día que el plazo cambie.
   */
  estadoPlazo: EstadoDelPlazo;
};

export type FilaInformeOrganizacion = Cifras & {
  empresaId: string;
  nit: string;
  razonSocial: string;
  acciones: string[];
};

export type InformeReservas = {
  generadoEn: string;
  /**
   * Hasta cuándo tienen las instituciones para entregar los nombres
   * de sus cupos, y a cuántos días del corte se empieza a avisar.
   *
   * Viaja en el informe --y no como constante del navegador-- para
   * que la pantalla, el papel y cualquier aviso digan la misma fecha
   * sin que nadie tenga que acordarse de cambiarla en tres sitios.
   */
  plazo: { entregaNombres: string; diasDeAviso: number; hoy: string };
  recorte: {
    convenios: Array<{
      id: string;
      slug: string;
      sigla: string | null;
      nombre: string;
    }>;
    accion: { id: string; codigo: string; nombre: string } | null;
    ubicacion: { id: string; nombre: string } | null;
    /// Va por nombre: `Ubicacion.departamento` es un texto, no una
    /// tabla de la que colgar un id.
    departamento: string | null;
    institucion: { id: string; nit: string; razonSocial: string } | null;
    desde: string | null;
    hasta: string | null;
    incluyeCanceladas: boolean;
  };
  totales: Cifras & {
    cuposSolicitados: number;
    reservasCanceladas: number;
    cuposCancelados: number;
    acciones: number;
    organizaciones: number;
    pares: number;
    cuposDelProyecto: number;
    metaComprometida: number;
  };
  porAccion: FilaInformeAccion[];
  cruce: FilaInformeCruce[];
  porOrganizacion: FilaInformeOrganizacion[];
  porUbicacion: Array<{
    ubicacionId: string;
    nombre: string;
    tipo: TipoUbicacion;
    reservas: number;
    cuposConfirmados: number;
  }>;
  /** El mismo reparto, un escalón más arriba: por departamento. */
  porDepartamento: Array<{
    departamento: string;
    reservas: number;
    organizaciones: number;
    cuposConfirmados: number;
    conNombre: number;
    sinNombre: number;
  }>;
  porEstado: Array<{
    estado: EstadoReserva;
    reservas: number;
    cuposConfirmados: number;
    cuposEnEspera: number;
  }>;
  porDia: Array<{ dia: string; reservas: number; cupos: number }>;
  truncado: boolean;
};

// ── los filtros ─────────────────────────────────────────────────

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lee la consulta y se queda con los cinco filtros que existen.
 *
 * Todo lo demás se descarta aquí, a propósito y en un solo sitio:
 * `asesorId` y `etapa` son de una ficha de persona, no de una
 * reserva; `grupoId` va por el camino del participante y unirlo a
 * una reserva multiplica filas; `buscar` y la paginación no aplican
 * a un agregado; y el ámbito NUNCA entra por la consulta —lo pone el
 * guard—. Aceptar cualquiera de ellos «para que filtre como los
 * demás» daría cero o el informe entero según cómo se escribiera el
 * JOIN, que es lo que ya advierte `recorteDeMeta` en control.ts.
 *
 * Una fecha que no se entiende NO se ignora: el informe saldría del
 * proyecto entero y quien pidió «septiembre» leería otra cosa.
 */
export function filtrosDelInforme(
  consulta: Record<string, unknown>,
): FiltrosInformeReservas {
  const texto = (clave: string): string | undefined => {
    const valor = consulta[clave];
    if (valor === undefined || valor === null) return undefined;
    /// `?convenioId=a&convenioId=b` llega como arreglo. Quedarse con
    /// uno de los dos es elegir por el usuario sin decírselo.
    if (typeof valor !== 'string') {
      throw new BadRequestException(`El filtro «${clave}» va una sola vez.`);
    }
    const limpio = valor.trim();
    return limpio === '' ? undefined : limpio;
  };

  const desde = texto('desde');
  const hasta = texto('hasta');
  for (const [clave, valor] of [
    ['desde', desde],
    ['hasta', hasta],
  ] as const) {
    if (valor !== undefined && !esDiaDeCalendario(valor)) {
      throw new BadRequestException(
        `«${clave}» tiene que ser un día AAAA-MM-DD.`,
      );
    }
  }
  /// Comparar como texto vale porque las dos van en AAAA-MM-DD.
  if (desde && hasta && desde > hasta) {
    throw new BadRequestException('«desde» es posterior a «hasta».');
  }

  return {
    convenioId: texto('convenioId'),
    convenio: texto('convenio'),
    accionFormacionId: texto('accionFormacionId'),
    ubicacionId: texto('ubicacionId'),
    departamento: texto('departamento'),
    empresaId: texto('empresaId'),
    desde,
    hasta,
    incluirCanceladas: booleanoDeVerdad(consulta.incluirCanceladas) ?? false,
  };
}

/** «2026-02-30» tiene la forma y no es un día. */
function esDiaDeCalendario(valor: string): boolean {
  if (!DIA.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return (
    fecha.getUTCFullYear() === a &&
    fecha.getUTCMonth() === m - 1 &&
    fecha.getUTCDate() === d
  );
}

// ── lo que devuelve la base ─────────────────────────────────────

/** Una reserva, estrecha: sin respuestas ni datos de contacto. */
export type ReservaCruda = {
  id: string;
  estado: EstadoReserva;
  solicitados: number | bigint;
  confirmados: number | bigint;
  enEspera: number | bigint;
  /** Día de Bogotá, ya como texto. */
  dia: string;
  accionFormacionId: string;
  codigo: string;
  accion: string;
  convenio: string;
  convenioSigla: string | null;
  modalidad: Modalidad;
  horas: number | null;
  empresaId: string;
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  ubicacionId: string;
  ubicacion: string;
  tipoUbicacion: TipoUbicacion;
  /** El departamento de esa sede. Nulo en una ciudad sin departamento. */
  departamento: string | null;
  /** Matriculados de ESTA reserva. Cero si está cancelada. */
  conNombre: number | bigint;
  /** Los de esos que siguen DENTRO hoy: ver el CTE. */
  dentro: number | bigint;
};

/** Una acción del recorte, tenga o no reservas. */
export type AccionCruda = {
  accionFormacionId: string;
  codigo: string;
  nombre: string;
  convenio: string;
  convenioSigla: string | null;
  modalidad: Modalidad;
  horas: number | null;
  cuposDelProyecto: number | bigint | null;
  metaComprometida: number | bigint | null;
};

// ── la consulta ─────────────────────────────────────────────────

type Recorte = InformeReservas['recorte'];

export async function informeDeReservas(
  prisma: PrismaService,
  ambito: string[],
  filtros: FiltrosInformeReservas,
  ahora = new Date(),
): Promise<InformeReservas> {
  const incluyeCanceladas = filtros.incluirCanceladas ?? false;
  const recorteVacio: Recorte = {
    convenios: [],
    accion: null,
    ubicacion: null,
    departamento: filtros.departamento ?? null,
    institucion: null,
    desde: filtros.desde ?? null,
    hasta: filtros.hasta ?? null,
    incluyeCanceladas,
  };

  /// Con ámbito vacío no se consulta: `IN ()` es SQL inválido, y una
  /// cuenta sin concesión en ningún convenio no tiene nada que ver.
  if (ambito.length === 0) {
    return armarInforme({
      reservas: [],
      acciones: [],
      recorte: recorteVacio,
      generadoEn: ahora,
    });
  }

  /**
   * Los convenios que de verdad entran: ámbito ∩ lo pedido.
   *
   * `AND` y no un spread, por el defecto que ya pasó dos veces en
   * este controlador (`interseca-no-sustituye.spec`): el filtro
   * pedido traía la misma clave que el ámbito y lo pisaba, y una
   * cuenta de ADECOPRIA pidiendo `?convenio=britcham-adee` veía
   * BRITCHAM. Pedir uno de fuera devuelve vacío, nunca todo.
   */
  const pedido: Prisma.ConvenioWhereInput = filtros.convenioId
    ? { id: filtros.convenioId }
    : filtros.convenio
      ? { slug: filtros.convenio }
      : {};
  const encontrados = await prisma.convenio.findMany({
    where: { AND: [{ id: { in: ambito } }, pedido] },
    orderBy: [{ orden: 'asc' }, { slug: 'asc' }],
    select: { id: true, slug: true, sigla: true, nombre: true },
  });
  /// Se vuelve a pasar por el ámbito en JS: el SQL de abajo confía en
  /// esta lista, y así su candado no depende de que la consulta de
  /// arriba siga escrita igual.
  const convenios = encontrados.filter((c) => ambito.includes(c.id));
  const efectivos = convenios.map((c) => c.id);

  /**
   * La acción se busca dentro del ÁMBITO, no dentro del gremio
   * elegido. Una acción de BRITCHAM con ADECOPRIA elegido es un
   * recorte contradictorio y sale en cero diciendo cuál era —el papel
   * no miente—; una acción que no es de ningún convenio suyo es un
   * 404, como en `accion()`, para no contar si existe.
   */
  const accion = filtros.accionFormacionId
    ? await prisma.accionFormacion.findFirst({
        where: { id: filtros.accionFormacionId, convenioId: { in: ambito } },
        select: { id: true, codigo: true, nombre: true },
      })
    : null;
  if (filtros.accionFormacionId && !accion) {
    throw new NotFoundException('No existe esa acción de formación.');
  }

  const ubicacion = filtros.ubicacionId
    ? await prisma.ubicacion.findUnique({
        where: { id: filtros.ubicacionId },
        select: { id: true, nombre: true },
      })
    : null;
  if (filtros.ubicacionId && !ubicacion) {
    throw new NotFoundException('No existe esa ubicación.');
  }

  /// La institución, para que el papel diga de quién es el informe.
  /// Se busca sin acotar por ámbito a propósito: una empresa se
  /// comparte entre gremios, y lo que acota es la reserva --que sí va
  /// por convenio en el SQL--.
  const institucion = filtros.empresaId
    ? await prisma.empresa.findUnique({
        where: { id: filtros.empresaId },
        select: { id: true, nit: true, razonSocial: true },
      })
    : null;
  if (filtros.empresaId && !institucion) {
    throw new NotFoundException('No existe esa institución.');
  }

  const recorte: Recorte = {
    ...recorteVacio,
    convenios,
    accion,
    ubicacion,
    institucion,
  };

  if (efectivos.length === 0) {
    return armarInforme({
      reservas: [],
      acciones: [],
      recorte,
      generadoEn: ahora,
    });
  }

  const [reservas, acciones] = await Promise.all([
    prisma.$queryRaw<ReservaCruda[]>(
      consultaDeReservas(ambito, efectivos, filtros),
    ),
    prisma.$queryRaw<AccionCruda[]>(
      consultaDeAcciones(ambito, efectivos, filtros),
    ),
  ]);

  return armarInforme({ reservas, acciones, recorte, generadoEn: ahora });
}

/**
 * Las reservas del recorte, UNA fila cada una, canceladas incluidas.
 *
 * Las canceladas viajan siempre y `armarInforme` decide: van aparte
 * en los totales (ocultar, nunca eliminar: la fila se queda y la
 * cifra se ve) y en las tablas solo si se pidió.
 *
 * El candado es `sqlDeConvenio(ambito)` —el de ambito.ts, escrito una
 * vez— y el recorte va DEBAJO, en otro AND. Son dos condiciones a
 * propósito: si alguien cambia cómo se resuelve el recorte, la
 * cerradura del guard sigue en su sitio.
 */
export function consultaDeReservas(
  ambito: string[],
  efectivos: string[],
  filtros: FiltrosInformeReservas,
): Prisma.Sql {
  const creado = Prisma.sql`r."creadoEn"`;
  return Prisma.sql`
    WITH ${PRIMERA_MATRICULA},
    /**
     * Cuántos cupos de cada reserva tienen ya a alguien, con el MISMO
     * criterio del bloque «Cupos apartados por empresas»
     * (control.ts, la consulta de cobertura): quien ALGUNA VEZ llegó
     * a inscrito, sin ventana. Con otro criterio —por ejemplo «quien
     * pisó el aula»— el informe abría con 11 donde el bloque desde el
     * que se hizo clic decía 13.
     *
     * Y AL LADO, la columna «dentro»: los de esos que siguen dentro
     * HOY. «Inscritos confirmados: quien está inscrito HOY» (Josse,
     * 22 sep 2026), para el módulo 1 del Resumen. NO sustituye a la
     * otra: aquella cuenta a quien llegó alguna vez --retirados
     * incluidos-- y es la que alimenta la brecha de nombres y el
     * informe que se le reporta al SENA. Las dos son ciertas; lo
     * que no pueden es llamarse igual en dos pantallas.
     *
     * Sale de la MISMA lista que cuenta la ocupación --OCUPAN_SILLA,
     * en crm/etapas.ts-- y no de una escrita aquí: con dos listas,
     * una pantalla diría que alguien ocupa un cupo y la otra que no.
     *
     * OJO CON LOS ACENTOS GRAVES: este bloque vive DENTRO de la
     * plantilla de la consulta, así que uno solo la termina y el
     * error sale como sintaxis de TypeScript, lejos de aquí. Por eso
     * el original no lleva ninguno, y este tampoco.
     */
    con_nombre AS (
      SELECT p."reservaId" AS rid,
             COUNT(*) AS n,
             -- y cuantos siguen DENTRO hoy: ver el bloque de arriba
             COUNT(*) FILTER (
               WHERE p."etapa"::text IN (${Prisma.join(OCUPAN_SILLA)})
             ) AS dentro
        FROM "participantes" p
        LEFT JOIN primera_matricula an ON an."pid" = p."id"
       WHERE p."reservaId" IS NOT NULL ${enPeriodo(null, null)}
       GROUP BY 1
    )
    SELECT r."id"                         AS id,
           r."estado"::text               AS estado,
           r."cuposSolicitados"           AS solicitados,
           r."cuposConfirmados"           AS confirmados,
           r."cuposEnEspera"              AS "enEspera",
           ${diaBogota(creado)}           AS dia,
           af."id"                        AS "accionFormacionId",
           af."codigo"                    AS codigo,
           af."nombre"                    AS accion,
           c."slug"                       AS convenio,
           c."sigla"                      AS "convenioSigla",
           af."modalidad"::text           AS modalidad,
           af."horas"                     AS horas,
           e."id"                         AS "empresaId",
           e."nit"                        AS nit,
           e."digitoVerificacion"         AS "digitoVerificacion",
           e."razonSocial"                AS "razonSocial",
           u."id"                         AS "ubicacionId",
           u."nombre"                     AS ubicacion,
           u."tipo"::text                 AS "tipoUbicacion",
           -- El departamento de esa sede. Cuando la ubicación ES un
           -- departamento, su propio nombre: así «Antioquia» y
           -- «Medellín» caen en la misma barra y no en dos.
           COALESCE(u."departamento", CASE WHEN u."tipo" = 'DEPARTAMENTO' THEN u."nombre" END)
                                          AS departamento,
           -- una reserva cancelada ya no tiene cupos: si le quedaban
           -- personas colgadas, contarlas subía la cobertura justo al
           -- cancelar, que es lo que control.ts también descarta
           CASE WHEN r."estado" <> 'CANCELADA' THEN COALESCE(cn."n", 0) ELSE 0 END
                                          AS "conNombre",
           CASE WHEN r."estado" <> 'CANCELADA' THEN COALESCE(cn."dentro", 0) ELSE 0 END
                                          AS "dentro"
      FROM "reservas" r
      JOIN "ofertas" o             ON o."id" = r."ofertaId"
      JOIN "acciones_formacion" af ON af."id" = o."accionFormacionId"
      JOIN "convenios" c           ON c."id" = af."convenioId"
      JOIN "empresas" e            ON e."id" = r."empresaId"
      JOIN "ubicaciones" u         ON u."id" = o."ubicacionId"
      LEFT JOIN con_nombre cn      ON cn."rid" = r."id"
     WHERE ${sqlDeConvenio(ambito, 'r')}
       AND af."convenioId" IN (${Prisma.join(efectivos)})
       ${filtros.accionFormacionId ? Prisma.sql`AND af."id" = ${filtros.accionFormacionId}` : Prisma.empty}
       ${filtros.ubicacionId ? Prisma.sql`AND o."ubicacionId" = ${filtros.ubicacionId}` : Prisma.empty}
       ${
         /// La misma cuenta que la columna de arriba, repetida aquí
         /// porque un alias del SELECT no se puede usar en el WHERE.
         filtros.departamento
           ? Prisma.sql`AND COALESCE(u."departamento", CASE WHEN u."tipo" = 'DEPARTAMENTO' THEN u."nombre" END) = ${filtros.departamento}`
           : Prisma.empty
       }
       ${filtros.empresaId ? Prisma.sql`AND r."empresaId" = ${filtros.empresaId}` : Prisma.empty}
       ${
         /// El día de Bogotá, dicho por su nombre. `creadoEn` es
         /// TIMESTAMP sin zona guardado en UTC: compararlo contra
         /// NOW() —como hace `serie()`— depende del TimeZone de la
         /// sesión, que en local es Bogotá y en el servidor UTC, y la
         /// misma ventana arranca cinco horas antes allá que aquí.
         filtros.desde
           ? Prisma.sql`AND ${fechaBogota(creado)} >= ${filtros.desde}::date`
           : Prisma.empty
       }
       ${filtros.hasta ? Prisma.sql`AND ${fechaBogota(creado)} <= ${filtros.hasta}::date` : Prisma.empty}
     ORDER BY r."creadoEn"
  `;
}

/**
 * Todas las acciones del recorte, con techo y meta, TENGAN O NO
 * reservas.
 *
 * Las que no tienen son justo las que hay que ver, y sin ellas la
 * suma de `cuposDelProyecto` por fila no daba el techo del proyecto
 * (los 4.797 del resumen): el total y la tabla no cuadraban.
 *
 * El techo y la meta NO llevan fechas: no son hechos fechados, y
 * recortarlos por «la última semana» daba una meta de cero. Sí se
 * acotan por ubicación, y en eso esta meta va más allá de
 * `recorteDeMeta` —que solo admite convenio y acción porque Control
 * no filtra por ubicación—: la meta SÍ se reparte por ubicación
 * (GrupoCobertura es grupo × ubicación) igual que el techo (Oferta
 * es acción × ubicación). Sin eso, con Bogotá elegida, se comparaban
 * las reservas de Bogotá contra la meta del país.
 */
export function consultaDeAcciones(
  ambito: string[],
  efectivos: string[],
  filtros: FiltrosInformeReservas,
): Prisma.Sql {
  const enLaUbicacion = (alias: string) =>
    filtros.ubicacionId
      ? Prisma.sql`AND ${Prisma.raw(`${alias}."ubicacionId"`)} = ${filtros.ubicacionId}`
      : Prisma.empty;

  return Prisma.sql`
    SELECT af."id"               AS "accionFormacionId",
           af."codigo"           AS codigo,
           af."nombre"           AS nombre,
           c."slug"              AS convenio,
           c."sigla"             AS "convenioSigla",
           af."modalidad"::text  AS modalidad,
           af."horas"            AS horas,
           -- en subconsultas y no en un JOIN: unidas las dos, cada
           -- oferta se sumaba una vez por cada cobertura y al revés
           (SELECT COALESCE(SUM(o."cuposMaximos"), 0)
              FROM "ofertas" o
             WHERE o."accionFormacionId" = af."id" ${enLaUbicacion('o')}
           ) AS "cuposDelProyecto",
           (SELECT COALESCE(SUM(gc."cuposBase"), 0)
              FROM "grupos_cobertura" gc
              JOIN "grupos" g ON g."id" = gc."grupoId"
             WHERE g."accionFormacionId" = af."id" ${enLaUbicacion('gc')}
           ) AS "metaComprometida"
      FROM "acciones_formacion" af
      JOIN "convenios" c ON c."id" = af."convenioId"
     WHERE af."convenioId" IN (${Prisma.join(ambito)})
       AND af."convenioId" IN (${Prisma.join(efectivos)})
       ${filtros.accionFormacionId ? Prisma.sql`AND af."id" = ${filtros.accionFormacionId}` : Prisma.empty}
       ${
         filtros.ubicacionId
           ? Prisma.sql`AND EXISTS (SELECT 1 FROM "ofertas" o2
                                     WHERE o2."accionFormacionId" = af."id"
                                       AND o2."ubicacionId" = ${filtros.ubicacionId})`
           : Prisma.empty
       }
     ORDER BY c."orden", c."slug", af."orden", af."codigo"
  `;
}

// ── el agregado ─────────────────────────────────────────────────

const cifra = (v: number | bigint | null | undefined) => Number(v ?? 0);

const ceros = (): Cifras => ({
  reservas: 0,
  cuposConfirmados: 0,
  cuposEnEspera: 0,
  conNombre: 0,
  dentro: 0,
  sinNombre: 0,
  nombresDeMas: 0,
});

/** «AF2» antes que «AF10», y en español. */
const ordenNatural = (a: string, b: string) =>
  a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });

type Entrada = {
  reservas: ReservaCruda[];
  acciones: AccionCruda[];
  recorte: Recorte;
  generadoEn: Date;
  tope?: number;
};

/**
 * Todo el informe desde las mismas filas.
 *
 * Va aparte de la consulta y exportada para fijarla en una prueba
 * sin base: que la suma por acción, la suma por organización y los
 * totales den lo mismo es una propiedad de ESTA función, y es la que
 * se rompe en silencio si alguien añade un corte que filtra distinto.
 */
export function armarInforme(entrada: Entrada): InformeReservas {
  const { recorte, generadoEn } = entrada;
  const tope = entrada.tope ?? TOPE_PARES;
  const incluye = recorte.incluyeCanceladas;

  /// El orden de las acciones es el de la consulta (gremio, orden,
  /// código): es el del PDF, AF1, AF2, AF3...
  const porAccion = new Map<string, FilaInformeAccion>();
  const nuevaAccion = (
    a: Omit<AccionCruda, 'cuposDelProyecto' | 'metaComprometida'>,
  ) => ({
    accionFormacionId: a.accionFormacionId,
    codigo: a.codigo,
    nombre: a.nombre,
    convenio: a.convenio,
    convenioSigla: a.convenioSigla,
    modalidad: a.modalidad,
    horas: a.horas === null ? null : Number(a.horas),
    ...ceros(),
    organizaciones: 0,
    cuposDelProyecto: 0,
    metaComprometida: 0,
    reservasCanceladas: 0,
    cuposCancelados: 0,
  });
  for (const a of entrada.acciones) {
    porAccion.set(a.accionFormacionId, {
      ...nuevaAccion(a),
      cuposDelProyecto: cifra(a.cuposDelProyecto),
      metaComprometida: cifra(a.metaComprometida),
    });
  }

  /// Sin `estadoPlazo`: esa columna se calcula al final, sobre el
  /// `sinNombre` ya sumado. Ponerla en el acumulador obligaría a
  /// recalcularla en cada reserva de la fila.
  const cruce = new Map<
    string,
    Omit<FilaInformeCruce, 'estadoPlazo'> & { ubicacionesVistas: Set<string> }
  >();
  const organizaciones = new Map<
    string,
    FilaInformeOrganizacion & {
      accionesVistas: Map<string, { codigo: string; gremio: string }>;
    }
  >();
  const empresasDeAccion = new Map<string, Set<string>>();
  /// Cuántas instituciones distintas hay en cada departamento. Se
  /// lleva aparte porque una institución con tres reservas en el
  /// mismo departamento es UNA institución, no tres.
  const empresasDeDepartamento = new Map<string, Set<string>>();
  const porUbicacion = new Map<
    string,
    InformeReservas['porUbicacion'][number]
  >();
  /// El corte por departamento, que el cliente pidió aparte del de
  /// ubicación (23 sep 2026). No se deriva de `porUbicacion` sumando
  /// sus filas: ahí la ciudad y el departamento son dos entradas, y
  /// sumarlas contaría dos veces las reservas de quien dicta en los
  /// dos sitios. Se cuenta reserva por reserva, como todo lo demás.
  const porDepartamento = new Map<
    string,
    InformeReservas['porDepartamento'][number]
  >();
  const porDia = new Map<
    string,
    { dia: string; reservas: number; cupos: number }
  >();
  const porEstado = new Map<
    EstadoReserva,
    InformeReservas['porEstado'][number]
  >(
    [
      EstadoReserva.CONFIRMADA,
      EstadoReserva.LISTA_ESPERA,
      EstadoReserva.CANCELADA,
    ].map((e) => [
      e,
      { estado: e, reservas: 0, cuposConfirmados: 0, cuposEnEspera: 0 },
    ]),
  );

  const totales: InformeReservas['totales'] = {
    ...ceros(),
    cuposSolicitados: 0,
    reservasCanceladas: 0,
    cuposCancelados: 0,
    acciones: 0,
    organizaciones: 0,
    pares: 0,
    cuposDelProyecto: 0,
    metaComprometida: 0,
  };

  const sumar = (destino: Cifras, c: Cifras) => {
    destino.reservas += c.reservas;
    destino.cuposConfirmados += c.cuposConfirmados;
    destino.cuposEnEspera += c.cuposEnEspera;
    destino.conNombre += c.conNombre;
    destino.dentro += c.dentro;
    destino.sinNombre += c.sinNombre;
    destino.nombresDeMas += c.nombresDeMas;
  };

  for (const r of entrada.reservas) {
    const cancelada = r.estado === EstadoReserva.CANCELADA;
    const confirmados = cifra(r.confirmados);
    const enEspera = cifra(r.enEspera);
    const solicitados = cifra(r.solicitados);
    /// Defensa: la consulta ya lo pone a cero, pero una reserva
    /// cancelada con personas colgadas no puede subir la cobertura
    /// aunque alguien cambie el SQL.
    const conNombre = cancelada ? 0 : cifra(r.conNombre);

    // la acción, aunque la consulta de acciones no la haya traído
    let accion = porAccion.get(r.accionFormacionId);
    if (!accion) {
      accion = nuevaAccion({ ...r, nombre: r.accion });
      porAccion.set(r.accionFormacionId, accion);
    }

    const estado = porEstado.get(r.estado);
    if (estado) {
      estado.reservas += 1;
      estado.cuposConfirmados += confirmados;
      estado.cuposEnEspera += enEspera;
    }

    if (cancelada) {
      /// Aparte y SIEMPRE, se pidan o no en las tablas: cuántas se
      /// cayeron es una cifra, y esconderla es la forma de que el
      /// informe cuadre de más.
      accion.reservasCanceladas += 1;
      accion.cuposCancelados += solicitados;
      totales.reservasCanceladas += 1;
      totales.cuposCancelados += solicitados;
      if (!incluye) continue;
    }

    const c: Cifras = {
      reservas: 1,
      cuposConfirmados: confirmados,
      cuposEnEspera: enEspera,
      conNombre,
      /// Nunca mas que los cupos: una reserva de 10 con 12 personas
      /// no llena 12 sillas, igual que `conNombre` --y la sobra ya
      /// se dice aparte en `nombresDeMas`--.
      dentro: Math.min(confirmados, cancelada ? 0 : cifra(r.dentro)),
      sinNombre: Math.max(0, confirmados - conNombre),
      nombresDeMas: Math.max(0, conNombre - confirmados),
    };

    sumar(totales, c);
    totales.cuposSolicitados += solicitados;
    sumar(accion, c);

    const empresas =
      empresasDeAccion.get(r.accionFormacionId) ?? new Set<string>();
    empresas.add(r.empresaId);
    empresasDeAccion.set(r.accionFormacionId, empresas);

    // Tabla 2: el par acción × organización
    const llave = `${r.accionFormacionId}|${r.empresaId}`;
    let par = cruce.get(llave);
    if (!par) {
      par = {
        accionFormacionId: r.accionFormacionId,
        codigo: r.codigo,
        accion: r.accion,
        empresaId: r.empresaId,
        nit: r.nit,
        digitoVerificacion: r.digitoVerificacion,
        razonSocial: r.razonSocial,
        ...ceros(),
        ubicaciones: [],
        primeraReserva: r.dia,
        ultimaReserva: r.dia,
        ubicacionesVistas: new Set<string>(),
      };
      cruce.set(llave, par);
    }
    sumar(par, c);
    par.ubicacionesVistas.add(r.ubicacion);
    // los días van en AAAA-MM-DD: se comparan como texto
    if (r.dia < par.primeraReserva) par.primeraReserva = r.dia;
    if (r.dia > par.ultimaReserva) par.ultimaReserva = r.dia;

    let org = organizaciones.get(r.empresaId);
    if (!org) {
      org = {
        empresaId: r.empresaId,
        nit: r.nit,
        razonSocial: r.razonSocial,
        ...ceros(),
        acciones: [],
        accionesVistas: new Map(),
      };
      organizaciones.set(r.empresaId, org);
    }
    sumar(org, c);
    org.accionesVistas.set(r.accionFormacionId, {
      codigo: r.codigo,
      gremio: r.convenioSigla ?? r.convenio,
    });

    const ub = porUbicacion.get(r.ubicacionId) ?? {
      ubicacionId: r.ubicacionId,
      nombre: r.ubicacion,
      tipo: r.tipoUbicacion,
      reservas: 0,
      cuposConfirmados: 0,
    };
    ub.reservas += 1;
    ub.cuposConfirmados += confirmados;
    porUbicacion.set(r.ubicacionId, ub);

    /// «Sin departamento» se cuenta, no se esconde: son cupos de
    /// verdad, y dejarlos fuera haría que las barras no sumaran el
    /// total de arriba —que es de las primeras cosas que alguien
    /// comprueba mirando un informe—.
    const nombreDepto = r.departamento ?? SIN_DEPARTAMENTO;
    const dep = porDepartamento.get(nombreDepto) ?? {
      departamento: nombreDepto,
      reservas: 0,
      organizaciones: 0,
      cuposConfirmados: 0,
      conNombre: 0,
      sinNombre: 0,
    };
    dep.reservas += 1;
    dep.cuposConfirmados += confirmados;
    dep.conNombre += c.conNombre;
    dep.sinNombre += c.sinNombre;
    porDepartamento.set(nombreDepto, dep);
    const suyas = empresasDeDepartamento.get(nombreDepto) ?? new Set<string>();
    suyas.add(r.empresaId);
    empresasDeDepartamento.set(nombreDepto, suyas);

    const dia = porDia.get(r.dia) ?? { dia: r.dia, reservas: 0, cupos: 0 };
    dia.reservas += 1;
    dia.cupos += confirmados;
    porDia.set(r.dia, dia);
  }

  // cierre de las acciones: organizaciones y techo
  const ordenDeAccion = new Map<string, number>();
  let i = 0;
  for (const a of porAccion.values()) {
    a.organizaciones = empresasDeAccion.get(a.accionFormacionId)?.size ?? 0;
    totales.cuposDelProyecto += a.cuposDelProyecto;
    totales.metaComprometida += a.metaComprometida;
    if (a.reservas > 0) totales.acciones += 1;
    ordenDeAccion.set(a.accionFormacionId, i++);
  }

  /// Agrupado por acción en el orden de la Tabla 1, como el PDF; y
  /// dentro de cada acción, la organización que más reservó arriba.
  const filasCruce = [...cruce.values()]
    .sort(
      (a, b) =>
        (ordenDeAccion.get(a.accionFormacionId) ?? 0) -
          (ordenDeAccion.get(b.accionFormacionId) ?? 0) ||
        b.reservas - a.reservas ||
        b.cuposConfirmados - a.cuposConfirmados ||
        ordenNatural(a.razonSocial, b.razonSocial),
    )
    .map(({ ubicacionesVistas, ...p }) => ({
      ...p,
      ubicaciones: [...ubicacionesVistas].sort(ordenNatural),
      estadoPlazo: estadoDelPlazo(p.sinNombre, aDiaBogota(generadoEn)),
    }));

  /// La que más nombres debe, arriba: es la lista de a quién llamar.
  const filasOrganizacion = [...organizaciones.values()]
    .sort(
      (a, b) =>
        b.sinNombre - a.sinNombre ||
        b.cuposConfirmados - a.cuposConfirmados ||
        ordenNatural(a.razonSocial, b.razonSocial),
    )
    .map(({ accionesVistas, ...o }) => ({
      ...o,
      acciones: codigosDe(accionesVistas),
    }));

  totales.organizaciones = filasOrganizacion.length;
  totales.pares = filasCruce.length;

  return {
    generadoEn: generadoEn.toISOString(),
    /// El «hoy» sale del mismo instante con que se selló el informe
    /// y en día de Bogotá: calcularlo en el navegador haría que un
    /// portátil con la zona corrida enseñara otro semáforo.
    plazo: {
      entregaNombres: PLAZO_ENTREGA_NOMBRES,
      diasDeAviso: DIAS_DE_AVISO,
      hoy: aDiaBogota(generadoEn),
    },
    recorte,
    totales,
    porAccion: [...porAccion.values()],
    cruce: filasCruce.slice(0, tope),
    porOrganizacion: filasOrganizacion.slice(0, tope),
    porUbicacion: [...porUbicacion.values()].sort(
      (a, b) =>
        b.cuposConfirmados - a.cuposConfirmados ||
        b.reservas - a.reservas ||
        ordenNatural(a.nombre, b.nombre),
    ),
    porDepartamento: [...porDepartamento.values()]
      .map((d) => ({
        ...d,
        organizaciones: empresasDeDepartamento.get(d.departamento)?.size ?? 0,
      }))
      .sort(
        (a, b) =>
          b.cuposConfirmados - a.cuposConfirmados ||
          b.reservas - a.reservas ||
          ordenNatural(a.departamento, b.departamento),
      ),
    porEstado: [...porEstado.values()],
    porDia: [...porDia.values()].sort((a, b) =>
      a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0,
    ),
    truncado: filasCruce.length > tope || filasOrganizacion.length > tope,
  };
}

/**
 * Los códigos de una organización, sin repetir y ordenados.
 *
 * Con los dos gremios a la vez, «AF1» puede ser dos acciones
 * distintas; a secas saldría una sola vez y parecería una. Solo en
 * ese caso se le pega el gremio.
 */
function codigosDe(
  vistas: Map<string, { codigo: string; gremio: string }>,
): string[] {
  const veces = new Map<string, number>();
  for (const v of vistas.values())
    veces.set(v.codigo, (veces.get(v.codigo) ?? 0) + 1);
  return [...vistas.values()]
    .map((v) =>
      (veces.get(v.codigo) ?? 0) > 1 ? `${v.codigo} · ${v.gremio}` : v.codigo,
    )
    .sort(ordenNatural);
}
