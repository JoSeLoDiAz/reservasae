import { Prisma } from '../../generated/prisma';
import { enPeriodo, PRIMERA_ENTRADA_AL_AULA } from './anclas';
import type { PrismaService } from '../prisma/prisma.service';
import { MINIMO_PARA_CERTIFICAR } from './crm.service';
import { variacion, type Comparacion, type Ventana } from './ventana';

/**
 * El tablero del seguimiento académico: cómo va cada acción
 * de formación, cada grupo y cada asesor. No cada persona.
 *
 * El avance se calcula en SQL sobre TODOS, no sobre una
 * página: una media sacada de las 300 más recientes no es
 * la media, y aquí la cifra es justo lo que se mira.
 *
 * El denominador de «avance» y «terminación» es el total de
 * quien está en el aula, incluidas las salidas. Sacar a los
 * desertores del denominador subiría el porcentaje justo
 * por haber perdido gente, que es al revés de lo que
 * significa.
 *
 * La ventana elige una COHORTE: quien pisó el aula en ese
 * periodo. Se ancla en la PRIMERA entrada al aula y no en
 * la matrícula: nada obliga a pasar por INSCRITO, así que
 * anclar ahí haría invisible a quien saltó de
 * DATOS_COMPLETOS a EN_FORMACION estando dentro.
 */

const DIA = 24 * 60 * 60 * 1000;

export type Metricas = {
  /** Todo el que pisó el aula, salidas incluidas. */
  enAula: number;
  /** Los que siguen dentro. */
  dentro: number;
  certificados: number;
  listos: number;
  desertaron: number;
  abandonaron: number;
  retirados: number;
  noAprobaron: number;
  /** De 0 a 1, medio sobre los que SÍ se pueden medir. */
  avanceMedio: number;
  /** Cuántos tienen actividades con las que medirlos. */
  medibles: number;
  /** Cuántos no: su acción no tiene actividades cargadas. */
  sinMedir: number;
  /** Null si el corte junta varias acciones. */
  actividades: number | null;
};

export type FilaAccion = Metricas & { codigo: string; nombre: string };

export type FilaGrupo = FilaAccion & {
  /** Null en la fila de quien no tiene grupo. */
  numero: number | null;
  inicio: string | null;
  fin: string | null;
};

export type FilaAsesor = Metricas & { asesorId: string | null; nombre: string };

/** Las cifras de cabecera, que son las comparables. */
export type Cabecera = {
  total: number;
  dentro: number;
  certificados: number;
  listos: number;
  salidas: number;
  /** Sobre los medibles, no sobre el total. */
  avanceMedio: number;
  medibles: number;
  /** Sin actividades cargadas: no se les puede medir. */
  sinMedir: number;
  /** certificados / total del aula */
  terminacion: number;
  /** las cuatro salidas / total del aula */
  desercion: number;
};

/** Un grupo que arranca pronto: la agenda. */
export type GrupoQueArranca = {
  codigo: string;
  numero: number;
  inicio: string;
  inscritos: number;
  /** Cuántos días faltan para que empiece. */
  dias: number;
};

/** Un grupo pasado de fecha con gente aún dentro. */
export type GrupoVencido = {
  codigo: string;
  numero: number;
  fin: string;
  enAula: number;
  certificados: number;
  /** Los que siguen EN_FORMACION con el grupo vencido. */
  sinCerrar: number;
};

/** Cuántos parados hay en cada tramo de días. */
export type TramoParados = {
  /** El primer día del tramo; -1 es «nunca entró». */
  dias: number;
  total: number;
};

/** La ventana tal como viaja al navegador. */
export type VentanaTablero = {
  rango: string;
  etiqueta: string;
  etiquetaAnterior: string | null;
  desde: string | null;
  hasta: string | null;
};

export type TableroAcademico = Cabecera & {
  minimoParaCertificar: number;
  porAccion: FilaAccion[];
  porGrupo: FilaGrupo[];
  porAsesor: FilaAsesor[];
  /** Lo que empieza en 30 días. No es la cohorte. */
  gruposQueArrancan: GrupoQueArranca[];
  /** Terminaron en el papel y siguen con gente dentro. */
  gruposVencidos: GrupoVencido[];
  /** La cola de rescate del gestor académico. */
  paradosPorDias: TramoParados[];
  ventana: VentanaTablero;
  /** Las mismas cifras del periodo previo. */
  anterior: Cabecera | null;
  variacion: Record<string, number | null>;
};

/** Las cifras que se comparan, por su nombre. */
const CLAVES = [
  'total',
  'dentro',
  'certificados',
  'listos',
  'salidas',
  'avanceMedio',
  'terminacion',
  'desercion',
] as const;

/** La fecha en ISO corto, o null si no hay. */
const dia = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Las etapas que significan haber pisado el aula. */
const EN_AULA = Prisma.sql`p."etapa" IN (
  'EN_FORMACION'::"EtapaParticipante",
  'CERTIFICADO'::"EtapaParticipante",
  'RETIRADO'::"EtapaParticipante",
  'NO_APROBO'::"EtapaParticipante",
  'DESERTO'::"EtapaParticipante",
  'ABANDONO'::"EtapaParticipante"
)`;

/** Los que ocupan silla: todavía no se han ido. */
const VIVOS = Prisma.sql`p."etapa" IN (
  'INTERESADO'::"EtapaParticipante",
  'CONTACTADO'::"EtapaParticipante",
  'DATOS_COMPLETOS'::"EtapaParticipante",
  'INSCRITO'::"EtapaParticipante",
  'EN_FORMACION'::"EtapaParticipante",
  'CERTIFICADO'::"EtapaParticipante"
)`;

/**
 * El ancla de la cohorte, lo obligatorio publicado por
 * acción y lo aprobado por persona Y ACCIÓN. Van como CTE
 * porque los tres cortes —acción, grupo y asesor—
 * necesitan exactamente lo mismo.
 *
 * `aprobadas` se agrupa también por acción porque el
 * numerador tiene que ser de la MISMA acción que el
 * denominador: sin eso, quien hizo 10 de 10 en la AF1 y se
 * reasigna a la AF5 (12 obligatorias) sale con 10/12 y
 * «listo para certificar» sin haber tocado la AF5.
 */
const CON_AVANCE = Prisma.sql`
  WITH ${PRIMERA_ENTRADA_AL_AULA},
  obligatorias AS (
    SELECT a."accionFormacionId" AS af, COUNT(*)::int AS total
      FROM "actividades" a
     WHERE a."publicada" AND a."obligatoria"
     GROUP BY 1
  ),
  aprobadas AS (
    SELECT av."participanteId" AS pid,
           a."accionFormacionId" AS af,
           COUNT(*)::int AS n
      FROM "avances_actividad" av
      JOIN "actividades" a ON a."id" = av."actividadId"
     WHERE av."estado" = 'APROBADA'::"EstadoAvance"
       AND a."obligatoria" AND a."publicada"
     GROUP BY 1, 2
  )
`;

/**
 * La fracción aprobada de esta persona, de 0 a 1, o NULL
 * si su acción no tiene actividades con las que medirla.
 *
 * El CASE no es adorno: `LEAST` en Postgres NO es estricta,
 * ignora los NULL, así que `LEAST(1.0, NULL)` devuelve 1.0.
 * Sin él, todo el que no tiene actividades cargadas salía
 * al 100 % y «listo para certificar» —que es el estado de
 * hoy en producción, sin adaptador del LMS— mientras el
 * botón de certificar lo negaba por no tener contra qué
 * medir. Dos pantallas y dos verdades sobre la misma persona.
 */
const FRACCION = Prisma.sql`
  CASE WHEN COALESCE(ob."total", 0) = 0 THEN NULL
       ELSE LEAST(1.0, COALESCE(ap."n", 0)::numeric / ob."total") END
`;

/**
 * Las columnas que se repiten en los tres cortes.
 *
 * `listos` solo cuenta a los que siguen EN_FORMACION, que
 * es el mismo criterio que `COMPLETADO` en la vista persona
 * a persona. Sobre las seis etapas del aula, todo
 * CERTIFICADO cumplía por construcción y un NO_APROBO con
 * 9/10 también: una cohorte cerrada decía «50 listos para
 * certificar» cuando ya no quedaba ninguno por certificar.
 *
 * `actividades` es NULL cuando el grupo abarca más de una
 * acción. `MAX` solo significa algo si todas comparten
 * denominador: un asesor con gente en la AF1 (4) y en la
 * AF5 (12) salía «de 12 actividades» en toda su fila.
 */
const METRICAS = Prisma.sql`
  COUNT(*)::int AS "enAula",
  COUNT(*) FILTER (
    WHERE p."etapa" IN (
      'EN_FORMACION'::"EtapaParticipante",
      'CERTIFICADO'::"EtapaParticipante"
    )
  )::int AS "dentro",
  COUNT(*) FILTER (WHERE p."etapa" = 'CERTIFICADO'::"EtapaParticipante")::int AS "certificados",
  COUNT(*) FILTER (
    WHERE p."etapa" = 'EN_FORMACION'::"EtapaParticipante"
      AND ${FRACCION} >= ${MINIMO_PARA_CERTIFICAR}
  )::int AS "listos",
  COUNT(*) FILTER (WHERE p."etapa" = 'DESERTO'::"EtapaParticipante")::int AS "desertaron",
  COUNT(*) FILTER (WHERE p."etapa" = 'ABANDONO'::"EtapaParticipante")::int AS "abandonaron",
  COUNT(*) FILTER (WHERE p."etapa" = 'RETIRADO'::"EtapaParticipante")::int AS "retirados",
  COUNT(*) FILTER (WHERE p."etapa" = 'NO_APROBO'::"EtapaParticipante")::int AS "noAprobaron",
  COALESCE(AVG(${FRACCION}), 0)::float AS "avanceMedio",
  COUNT(${FRACCION})::int AS "medibles",
  COUNT(*) FILTER (WHERE COALESCE(ob."total", 0) = 0)::int AS "sinMedir",
  CASE WHEN COUNT(DISTINCT p."accionFormacionId") = 1
       THEN COALESCE(MAX(ob."total"), 0)::int
       ELSE NULL END AS "actividades"
`;

/** Los JOIN del avance y del ancla, en los tres cortes. */
const UNIR = Prisma.sql`
  LEFT JOIN obligatorias ob ON ob."af" = p."accionFormacionId"
  LEFT JOIN aprobadas   ap ON ap."pid" = p."id"
                          AND ap."af" = p."accionFormacionId"
  LEFT JOIN primera_entrada an ON an."pid" = p."id"
`;

/** El corte del periodo sobre la ventana que toque. */
const corteDe = (v: Ventana | null): Prisma.Sql =>
  enPeriodo(v ? v.desde : null, v ? v.hasta : null);

/** El corte por acción, del que salen los totales. */
function consultaPorAccion(prisma: PrismaService, suyos: Prisma.Sql, v: Ventana | null) {
  // LEFT JOIN, no INNER: `accionFormacionId` es nullable y
  // con INNER esas filas desaparecian de aqui pero no de
  // porAsesor, asi que las tres tablas de la misma pantalla
  // no cuadraban entre si ni con la cifra grande
  return prisma.$queryRaw<FilaAccion[]>`
    ${CON_AVANCE}
    SELECT COALESCE(af."codigo", '—') AS codigo,
           COALESCE(af."nombre", 'Sin acción asignada') AS nombre,
           ${METRICAS}
      FROM "participantes" p
      LEFT JOIN "acciones_formacion" af ON af."id" = p."accionFormacionId"
      ${UNIR}
     WHERE ${suyos} AND ${EN_AULA} ${corteDe(v)}
     GROUP BY 1, 2
     ORDER BY 1
  `;
}

/**
 * Lo que arranca en los próximos 30 días.
 *
 * Sale de `grupos` y no de `participantes` porque el grupo
 * que empieza el jueves sin nadie apuntado es justo el que
 * hay que mirar, y agrupando por participante no existiría.
 * Por eso el ámbito va dos veces: el del grupo, por su
 * acción, y el de la gente que se cuenta.
 *
 * No lleva el corte de la ventana: esto es futuro, y la
 * cohorte se ancla en haber pisado ya el aula.
 */
function consultaQueArrancan(prisma: PrismaService, suyos: Prisma.Sql, ambito: string[]) {
  return prisma.$queryRaw<GrupoQueArranca[]>`
    SELECT af."codigo" AS codigo,
           g."numero" AS numero,
           to_char(g."fechaInicio", 'YYYY-MM-DD') AS inicio,
           (g."fechaInicio"::date - CURRENT_DATE)::int AS dias,
           COUNT(p."id")::int AS inscritos
      FROM "grupos" g
      JOIN "acciones_formacion" af ON af."id" = g."accionFormacionId"
      LEFT JOIN "grupos_cobertura" gc ON gc."grupoId" = g."id"
      LEFT JOIN "participantes" p ON p."coberturaId" = gc."id"
                                 AND ${suyos} AND ${VIVOS}
     WHERE af."convenioId" IN (${Prisma.join(ambito)})
       AND g."fechaInicio" IS NOT NULL
       AND g."fechaInicio"::date >= CURRENT_DATE
       AND g."fechaInicio"::date <= CURRENT_DATE + 30
     GROUP BY g."id", af."id"
     ORDER BY g."fechaInicio", af."codigo", g."numero"
  `;
}

/**
 * Los grupos que ya terminaron y siguen con gente dentro:
 * lo que hay que cerrar o justificar ante el SENA.
 *
 * Aquí sí se parte de `participantes`, porque un grupo
 * vencido sin nadie dentro no es un pendiente de nadie: lo
 * que lo pone en la lista es que quede alguien EN_FORMACION.
 */
function consultaVencidos(prisma: PrismaService, suyos: Prisma.Sql) {
  return prisma.$queryRaw<GrupoVencido[]>`
    SELECT af."codigo" AS codigo,
           g."numero" AS numero,
           to_char(g."fechaFin", 'YYYY-MM-DD') AS fin,
           COUNT(*)::int AS "enAula",
           COUNT(*) FILTER (
             WHERE p."etapa" = 'CERTIFICADO'::"EtapaParticipante"
           )::int AS certificados,
           COUNT(*) FILTER (
             WHERE p."etapa" = 'EN_FORMACION'::"EtapaParticipante"
           )::int AS "sinCerrar"
      FROM "participantes" p
      JOIN "grupos_cobertura" gc      ON gc."id" = p."coberturaId"
      JOIN "grupos" g                 ON g."id" = gc."grupoId"
      JOIN "acciones_formacion" af    ON af."id" = g."accionFormacionId"
     WHERE ${suyos} AND ${EN_AULA}
       AND g."fechaFin" IS NOT NULL
       AND g."fechaFin"::date < CURRENT_DATE
     GROUP BY g."id", af."id"
    HAVING COUNT(*) FILTER (
             WHERE p."etapa" = 'EN_FORMACION'::"EtapaParticipante"
           ) > 0
     ORDER BY g."fechaFin", af."codigo", g."numero"
  `;
}

/**
 * De los que están EN_FORMACION, cuánto llevan sin entrar
 * al aula. Es la cola de rescate: a quién llamar hoy.
 *
 * «Nunca entró» va aparte y no en el tramo más alto —es el
 * -1—, porque con `ultimoAcceso` en NULL cualquier resta da
 * NULL y caería en el mismo saco que quien lleva un mes
 * fuera. Son dos problemas distintos: uno no encontró la
 * puerta y el otro la dejó de abrir.
 *
 * Tampoco lleva la ventana: quien lleva dos meses parado
 * entró al aula en otra cohorte, y es justo a quien hay que
 * rescatar.
 */
function consultaParados(prisma: PrismaService, suyos: Prisma.Sql) {
  // los cinco tramos salen siempre
  return prisma.$queryRaw<TramoParados[]>`
    WITH tramos("dias") AS (VALUES (-1), (0), (8), (15), (31)),
    clasificados AS (
      SELECT CASE
               WHEN p."ultimoAcceso" IS NULL THEN -1
               WHEN CURRENT_DATE - p."ultimoAcceso"::date <= 7  THEN 0
               WHEN CURRENT_DATE - p."ultimoAcceso"::date <= 14 THEN 8
               WHEN CURRENT_DATE - p."ultimoAcceso"::date <= 30 THEN 15
               ELSE 31
             END AS "dias"
        FROM "participantes" p
       WHERE ${suyos}
         AND p."etapa" = 'EN_FORMACION'::"EtapaParticipante"
    )
    SELECT t."dias"::int AS dias, COUNT(c."dias")::int AS total
      FROM tramos t
      LEFT JOIN clasificados c ON c."dias" = t."dias"
     GROUP BY t."dias"
     ORDER BY (t."dias" < 0), t."dias"
  `;
}

/** La cabecera, sumando el corte por acción. */
function resumir(filas: FilaAccion[]): Cabecera {
  // suma de un corte, no de otra consulta
  const suma = (f: (x: FilaAccion) => number) => filas.reduce((s, x) => s + f(x), 0);

  const total = suma((x) => x.enAula);
  const certificados = suma((x) => x.certificados);
  const salidas =
    suma((x) => x.desertaron) +
    suma((x) => x.abandonaron) +
    suma((x) => x.retirados) +
    suma((x) => x.noAprobaron);

  // ponderada por los MEDIBLES, no por los del aula: quien
  // no tiene actividades no entra en la media de nadie
  const medibles = suma((x) => x.medibles);
  const avanceMedio =
    medibles > 0
      ? filas.reduce((s, x) => s + x.avanceMedio * x.medibles, 0) / medibles
      : 0;

  return {
    total,
    dentro: suma((x) => x.dentro),
    certificados,
    listos: suma((x) => x.listos),
    salidas,
    avanceMedio,
    medibles,
    sinMedir: suma((x) => x.sinMedir),
    terminacion: total > 0 ? certificados / total : 0,
    desercion: total > 0 ? salidas / total : 0,
  };
}

/** La ventana en fechas, con el último día dentro. */
function describirVentana(c: Comparacion): VentanaTablero {
  const fin = c.actual ? new Date(c.actual.hasta.getTime() - DIA) : null;
  return {
    rango: c.rango,
    etiqueta: c.etiqueta,
    etiquetaAnterior: c.etiquetaAnterior,
    desde: dia(c.actual ? c.actual.desde : null),
    hasta: dia(fin),
  };
}

/** Cuánto cambió cada cifra contra el periodo previo. */
function comparar(
  hoy: Cabecera,
  antes: Cabecera | null,
  hayVentana: boolean,
): Record<string, number | null> {
  const cambios: Record<string, number | null> = {};
  for (const clave of CLAVES) {
    // el tamaño de dos cohortes sí se compara; su avance,
    // su terminación y su deserción no: la de este mes casi
    // no ha tenido tiempo de certificar y la anterior lleva
    // un periodo entero de aula, así que la flecha marcaría
    // «−100 %» sin que nada haya cambiado. Es el mismo sesgo
    // que arreglamos en Control, aquí del revés
    const maduraDistinto =
      hayVentana && MADURAN.includes(clave as (typeof MADURAN)[number]);

    cambios[clave] = antes && !maduraDistinto ? variacion(hoy[clave], antes[clave]) : null;
  }
  return cambios;
}

/** Las que dependen de cuánto lleva la cohorte dentro. */
const MADURAN = [
  'avanceMedio',
  'terminacion',
  'desercion',
  'certificados',
  'listos',
  // estas dos tambien: `salidas` es el numerador de la
  // desercion y `dentro` es el total menos las salidas, asi
  // que heredan el mismo sesgo. Una cohorte recien entrada
  // no ha tenido tiempo de desertar, y comparar su cero
  // contra el doce de una madura pinta un -67 % en verde
  'dentro',
  'salidas',
] as const;

/** Sin ámbito no hay cifras, pero sí la misma forma. */
function vacio(comparacion: Comparacion): TableroAcademico {
  const cero = resumir([]);
  return {
    ...cero,
    minimoParaCertificar: MINIMO_PARA_CERTIFICAR,
    porAccion: [],
    porGrupo: [],
    porAsesor: [],
    gruposQueArrancan: [],
    gruposVencidos: [],
    paradosPorDias: [],
    ventana: describirVentana(comparacion),
    anterior: null,
    variacion: comparar(cero, null, false),
  };
}

export async function tableroAcademico(
  prisma: PrismaService,
  ambito: string[],
  comparacion: Comparacion,
): Promise<TableroAcademico> {
  // un IN () vacío es inválido
  if (ambito.length === 0) return vacio(comparacion);

  const suyos = Prisma.sql`p."convenioId" IN (${Prisma.join(ambito)})`;
  const corte = corteDe(comparacion.actual);

  const [
    porAccion,
    porGrupo,
    porAsesor,
    gruposQueArrancan,
    gruposVencidos,
    paradosPorDias,
    antes,
  ] = await Promise.all([
    consultaPorAccion(prisma, suyos, comparacion.actual),

    // LEFT JOIN, no INNER: `coberturaId` es nullable y
    // matricular sin grupo solo AVISA, asi que con INNER
    // esa gente desaparecia de aqui pero no de las otras
    // dos tablas, y los tres totales no cuadraban
    prisma.$queryRaw<
      Array<FilaAccion & { numero: number | null; inicio: Date | null; fin: Date | null }>
    >`
      ${CON_AVANCE}
      SELECT COALESCE(af."codigo", '—') AS codigo,
             COALESCE(af."nombre", 'Sin grupo asignado') AS nombre,
             g."numero" AS numero, g."fechaInicio" AS inicio, g."fechaFin" AS fin,
             ${METRICAS}
        FROM "participantes" p
        LEFT JOIN "grupos_cobertura" gc   ON gc."id" = p."coberturaId"
        LEFT JOIN "grupos" g              ON g."id" = gc."grupoId"
        LEFT JOIN "acciones_formacion" af ON af."id" = g."accionFormacionId"
        ${UNIR}
       WHERE ${suyos} AND ${EN_AULA} ${corte}
       GROUP BY af."codigo", af."nombre", g."numero", g."fechaInicio", g."fechaFin"
       ORDER BY af."codigo", g."numero"
    `,

    prisma.$queryRaw<FilaAsesor[]>`
      ${CON_AVANCE}
      SELECT p."asesorId" AS "asesorId",
             COALESCE(a."nombre", 'Sin asignar') AS nombre,
             ${METRICAS}
        FROM "participantes" p
        LEFT JOIN "administradores" a ON a."id" = p."asesorId"
        ${UNIR}
       WHERE ${suyos} AND ${EN_AULA} ${corte}
       GROUP BY p."asesorId", a."nombre"
       ORDER BY COUNT(*) DESC
    `,

    consultaQueArrancan(prisma, suyos, ambito),
    consultaVencidos(prisma, suyos),
    consultaParados(prisma, suyos),

    // del previo solo hace falta la cabecera
    comparacion.anterior ? consultaPorAccion(prisma, suyos, comparacion.anterior) : null,
  ]);

  const cabecera = resumir(porAccion);
  const anterior = antes ? resumir(antes) : null;

  return {
    ...cabecera,
    minimoParaCertificar: MINIMO_PARA_CERTIFICAR,
    porAccion,
    porGrupo: porGrupo.map((g) => ({ ...g, inicio: dia(g.inicio), fin: dia(g.fin) })),
    porAsesor,
    gruposQueArrancan,
    gruposVencidos,
    paradosPorDias,
    ventana: describirVentana(comparacion),
    anterior,
    variacion: comparar(cabecera, anterior, comparacion.actual !== null),
  };
}
