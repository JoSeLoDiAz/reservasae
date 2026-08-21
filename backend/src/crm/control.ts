import { EtapaParticipante, Prisma } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { enPeriodo, PRIMERA_MATRICULA } from './anclas';
import { variacion, type Comparacion, type Ventana } from './ventana';

/**
 * Control de inscritos: cuántos hay y cómo se reparten.
 *
 * Va aparte de `crm.service.ts` porque son once consultas
 * que no comparten nada con el resto del CRM, y aquel ya
 * pasa de mil quinientas líneas.
 *
 * Todo se agrupa en la base, no en Node: traer cinco mil
 * fichas para contarlas por departamento sería absurdo, y
 * es la misma regla que ya siguen los tableros.
 *
 * El denominador de los porcentajes es SIEMPRE el total de
 * inscritos, nunca el de cada corte: así las vistas del
 * mismo dato se pueden comparar entre sí.
 *
 * La ventana usa DOS fechas, y cada corte la que le toca:
 * los inscritos van por el ancla de `anclas.ts` —la PRIMERA
 * vez que llegaron a serlo— y el embudo por `creadoEn`
 * —cuándo llegó el lead—, porque los peldaños de arriba no
 * tienen matrícula y con la primera desaparecían enteros.
 * Los cupos y la cobertura nunca llevan ventana: salen de
 * reservas, y recortarlos daría una cobertura falsa.
 */

const DIA = 24 * 60 * 60 * 1000;

/** El ancla, para las consultas que cortan por periodo. */
const CON_ANCLA = Prisma.sql`WITH ${PRIMERA_MATRICULA}`;

/** La unión del ancla, igual en todos los cortes. */
const UNIR_ANCLA = Prisma.sql`LEFT JOIN primera_matricula an ON an."pid" = p."id"`;

/**
 * Las cinco etapas que dibuja la vista de inscripciones.
 *
 * El embudo agrupaba las once y la pantalla pintaba cinco:
 * el total que sumaba la tarjeta no era el de las barras.
 * Se recorta aquí para que el backend mande exactamente lo
 * que se pinta y no haya forma de sumar de más.
 */
const ETAPAS_INSCRIPCION = Prisma.sql`p."etapa" IN (
  'INTERESADO'::"EtapaParticipante",
  'CONTACTADO'::"EtapaParticipante",
  'DATOS_COMPLETOS'::"EtapaParticipante",
  'INSCRITO'::"EtapaParticipante",
  'PERDIDO'::"EtapaParticipante"
)`;

export type Corte = { etiqueta: string; total: number };

/** Cuánto convirtió un asesor de lo que lleva. */
export type CorteAsesor = {
  asesorId: string | null;
  etiqueta: string;
  /** Los que llegó a inscribir en el periodo. */
  total: number;
  /** Todas sus fichas del ámbito, sin ventana. */
  asignados: number;
  /**
   * Cuántos de los suyos llegaron a inscrito, SIEMPRE.
   *
   * Ni el numerador ni el denominador llevan periodo: con
   * «hoy», todas las conversiones caían al 0-2 % y la tabla
   * se ordenaba por a quién le entró una inscripción esta
   * mañana, no por quién convierte mejor.
   */
  conversion: number;
  inscritosSiempre: number;
};

/** Las cifras que se comparan con el periodo anterior. */
export type Cabecera = {
  total: number;
  /** Días medios de lead a inscrito. Null si no hay ninguno. */
  diasHastaInscribir: number | null;
};

export type Control = Cabecera & {
  /** El techo contra el que se mide la captura. */
  cuposConfirmados: number;
  /**
   * Quien llegó a inscrito ocupando un cupo reservado, sin
   * ventana. Es el numerador de la cobertura: los cupos
   * salen de reservas, así que contar también a quien entró
   * por su cuenta dividía dos poblaciones distintas y podía
   * dar más del 100 % con las sillas reservadas vacías.
   */
  inscritosConReserva: number;
  /** Los que llegaron por redes, feria o referido. */
  inscritosPorSuCuenta: number;
  embudo: Array<{ etapa: EtapaParticipante; total: number }>;
  porAccion: Corte[];
  porUbicacion: Array<Corte & { tipo: string }>;
  porGrupo: Array<Corte & { inicio: string | null }>;
  porConvenio: Corte[];
  porAsesor: CorteAsesor[];
  porOrigen: Corte[];
  porModalidad: Corte[];
  serie: Array<{ dia: string; total: number }>;
  ventana: {
    rango: string;
    etiqueta: string;
    etiquetaAnterior: string | null;
    desde: string | null;
    hasta: string | null;
  };
  anterior: Cabecera | null;
  variacion: Record<string, number | null>;
};

const VACIO: Omit<Control, 'ventana' | 'anterior' | 'variacion'> = {
  total: 0,
  cuposConfirmados: 0,
  inscritosConReserva: 0,
  inscritosPorSuCuenta: 0,
  diasHastaInscribir: null,
  embudo: [],
  porAccion: [],
  porUbicacion: [],
  porGrupo: [],
  porConvenio: [],
  porAsesor: [],
  porOrigen: [],
  porModalidad: [],
  serie: [],
};

/** Día ISO: las ventanas cortan a medianoche. */
function dia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Las dos cifras de cabecera bajo un filtro dado. */
async function cabecera(prisma: PrismaService, donde: Prisma.Sql): Promise<Cabecera> {
  const [conteo, dias] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>`
      ${CON_ANCLA}
      SELECT COUNT(*) AS total
        FROM "participantes" p
        ${UNIR_ANCLA}
       WHERE ${donde}
    `,

    // de lead a inscrito, por el ancla
    prisma.$queryRaw<Array<{ dias: number | null }>>`
      ${CON_ANCLA}
      SELECT AVG(EXTRACT(EPOCH FROM (an."momento" - p."creadoEn")) / 86400) AS dias
        FROM "participantes" p
        ${UNIR_ANCLA}
       WHERE ${donde}
    `,
  ]);

  const media = dias[0]?.dias;
  return {
    total: Number(conteo[0]?.total ?? 0),
    diasHastaInscribir: media === null || media === undefined ? null : Number(media),
  };
}

/** Cuánto cambió cada cifra de cabecera. */
function comparar(a: Cabecera, b: Cabecera | null): Record<string, number | null> {
  return {
    total: b ? variacion(a.total, b.total) : null,
    diasHastaInscribir:
      b && a.diasHastaInscribir !== null && b.diasHastaInscribir !== null
        ? variacion(a.diasHastaInscribir, b.diasHastaInscribir)
        : null,
  };
}

export async function controlDeInscritos(
  prisma: PrismaService,
  ambito: string[],
  comparacion: Comparacion,
): Promise<Control> {
  const marco = {
    rango: comparacion.rango,
    etiqueta: comparacion.etiqueta,
    etiquetaAnterior: comparacion.etiquetaAnterior,
    desde: comparacion.actual ? dia(comparacion.actual.desde) : null,
    // el «hasta» de la ventana es abierto
    hasta: comparacion.actual ? dia(new Date(comparacion.actual.hasta.getTime() - DIA)) : null,
  };

  // con ámbito vacío no se consulta: un IN () es inválido
  if (ambito.length === 0) {
    return { ...VACIO, ventana: marco, anterior: null, variacion: comparar(VACIO, null) };
  }

  const suyos = Prisma.sql`p."convenioId" IN (${Prisma.join(ambito)})`;

  /**
   * «Llegó a inscrito», por el hecho y no por el estado.
   *
   * Exigir que la etapa SIGA siendo INSCRITO hoy sesgaba
   * toda comparación en el mismo sentido: el periodo
   * anterior lleva más tiempo drenando hacia EN_FORMACION,
   * así que se ha vaciado y el actual no. Dos días con la
   * misma captura daban +400 % — el tablero siempre decía
   * que vamos mejor. El hecho se lee del ancla y no de la
   * columna de fecha: ver `anclas.ts` para el porqué.
   */
  const corte = (v: Ventana | null) => enPeriodo(v?.desde ?? null, v?.hasta ?? null);
  const filtro = (v: Ventana | null) => Prisma.sql`${suyos} ${corte(v)}`;

  const inscritos = filtro(comparacion.actual);
  // el mismo criterio suelto, para el asesor
  const periodo = corte(comparacion.actual);

  /**
   * El embudo va por `creadoEn`, cuándo llegó el lead.
   *
   * Con la matrícula los peldaños de arriba —que no la
   * tienen— desaparecían en cuanto había ventana, y la
   * tarjeta anunciaba «100 % ha llegado a inscrito» con
   * setecientos leads sin trabajar en la base.
   */
  const llegaron = comparacion.actual
    ? Prisma.sql`AND p."creadoEn" >= ${comparacion.actual.desde} AND p."creadoEn" < ${comparacion.actual.hasta}`
    : Prisma.empty;
  const dentro = Prisma.sql`${suyos} ${llegaron}`;

  // sin ventana, la serie se queda en dos meses
  const dosMeses = comparacion.actual
    ? Prisma.empty
    : Prisma.sql`AND an."momento" >= NOW() - INTERVAL '60 days'`;

  const [
    ahora,
    anterior,
    cupos,
    cobertura,
    embudo,
    porAccion,
    porUbicacion,
    porGrupo,
    porConvenio,
    porAsesor,
    porOrigen,
    porModalidad,
    serie,
  ] = await Promise.all([
    cabecera(prisma, inscritos),

    comparacion.anterior ? cabecera(prisma, filtro(comparacion.anterior)) : Promise.resolve(null),

    prisma.$queryRaw<Array<{ cupos: bigint | null }>>`
      SELECT COALESCE(SUM(r."cuposConfirmados"), 0) AS cupos
        FROM "reservas" r
        JOIN "ofertas" o             ON o."id" = r."ofertaId"
        JOIN "acciones_formacion" af ON af."id" = o."accionFormacionId"
       WHERE af."convenioId" IN (${Prisma.join(ambito)})
         AND r."estado" <> 'CANCELADA'
    `,

    /**
     * Quien ALGUNA VEZ llegó a inscrito, sin ventana: el
     * numerador de la cobertura.
     *
     * Un cupo se ocupa cuando alguien queda inscrito, así
     * que contar también a interesados y contactados subía
     * la cobertura sin que nadie se inscribiera y la dejaba
     * pasar del 100 %. Y no lleva ventana porque los cupos
     * salen de reservas y no pueden llevarla: medir contra
     * ellos un total recortado daba «cobertura 0 %» y
     * «4.794 cupos sin nombre» con solo elegir «ayer».
     */
    prisma.$queryRaw<Array<{ conReserva: bigint; porSuCuenta: bigint }>>`
      ${CON_ANCLA}
      SELECT COUNT(*) FILTER (WHERE p."reservaId" IS NOT NULL) AS "conReserva",
             COUNT(*) FILTER (WHERE p."reservaId" IS NULL)     AS "porSuCuenta"
        FROM "participantes" p
        ${UNIR_ANCLA}
       WHERE ${suyos} ${enPeriodo(null, null)}
    `,

    prisma.$queryRaw<Array<{ etapa: EtapaParticipante; total: bigint }>>`
      SELECT p."etapa"::text AS etapa, COUNT(*) AS total
        FROM "participantes" p
       WHERE ${dentro} AND ${ETAPAS_INSCRIPCION}
       GROUP BY 1 ORDER BY 1
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; codigo: string; total: bigint }>>`
      ${CON_ANCLA}
      SELECT af."nombre" AS etiqueta, af."codigo" AS codigo, COUNT(*) AS total
        FROM "participantes" p
        JOIN "acciones_formacion" af ON af."id" = p."accionFormacionId"
        ${UNIR_ANCLA}
       WHERE ${inscritos}
       GROUP BY af."codigo", af."nombre"
       ORDER BY af."codigo"
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; tipo: string; total: bigint }>>`
      ${CON_ANCLA}
      SELECT u."nombre" AS etiqueta, u."tipo"::text AS tipo, COUNT(*) AS total
        FROM "participantes" p
        JOIN "ofertas" o     ON o."id" = p."ofertaId"
        JOIN "ubicaciones" u ON u."id" = o."ubicacionId"
        ${UNIR_ANCLA}
       WHERE ${inscritos}
       GROUP BY u."nombre", u."tipo"
       ORDER BY COUNT(*) DESC
    `,

    prisma.$queryRaw<
      Array<{ numero: number; codigo: string; inicio: Date | null; total: bigint }>
    >`
      ${CON_ANCLA}
      SELECT g."numero" AS numero, af."codigo" AS codigo,
             g."fechaInicio" AS inicio, COUNT(*) AS total
        FROM "participantes" p
        JOIN "grupos_cobertura" gc   ON gc."id" = p."coberturaId"
        JOIN "grupos" g              ON g."id" = gc."grupoId"
        JOIN "acciones_formacion" af ON af."id" = g."accionFormacionId"
        ${UNIR_ANCLA}
       WHERE ${inscritos}
       -- por id, no por codigo: AF1..AF7 existen en los dos
       -- convenios y la numeracion de grupos reinicia, asi
       -- que agrupando por codigo dos grupos distintos se
       -- fundian en una barra bajo «el reparto real»
       GROUP BY af."id", af."codigo", g."numero", g."fechaInicio"
       ORDER BY af."codigo", g."numero"
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; total: bigint }>>`
      ${CON_ANCLA}
      SELECT COALESCE(c."sigla", c."nombre") AS etiqueta, COUNT(*) AS total
        FROM "participantes" p
        JOIN "convenios" c ON c."id" = p."convenioId"
        ${UNIR_ANCLA}
       WHERE ${inscritos}
       GROUP BY 1 ORDER BY COUNT(*) DESC
    `,

    /**
     * Los inscritos llevan periodo; lo asignado, no.
     *
     * El FILTER repite el criterio de la cabecera —el ancla
     * y su periodo—, así que la columna suma exactamente la
     * cifra grande. Con el criterio viejo, la etapa INSCRITO
     * de hoy, no sumaba nunca, y la conversión —que es el
     * orden de la tabla— salía dividida por otro número.
     */
    prisma.$queryRaw<
      Array<{
        asesorId: string | null;
        etiqueta: string;
        total: bigint;
        inscritosSiempre: bigint;
        asignados: bigint;
      }>
    >`
      ${CON_ANCLA}
      SELECT p."asesorId" AS "asesorId",
             COALESCE(a."nombre", 'Sin asignar') AS etiqueta,
             COUNT(*) FILTER (WHERE TRUE ${periodo}) AS total,
             COUNT(*) FILTER (WHERE an."momento" IS NOT NULL) AS "inscritosSiempre",
             COUNT(*) AS asignados
        FROM "participantes" p
        LEFT JOIN "administradores" a ON a."id" = p."asesorId"
        ${UNIR_ANCLA}
       WHERE ${suyos}
       GROUP BY p."asesorId", a."nombre"
       ORDER BY total DESC, asignados DESC
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; total: bigint }>>`
      ${CON_ANCLA}
      SELECT p."origen"::text AS etiqueta, COUNT(*) AS total
        FROM "participantes" p
        ${UNIR_ANCLA}
       WHERE ${inscritos}
       GROUP BY 1 ORDER BY COUNT(*) DESC
    `,

    prisma.$queryRaw<Array<{ etiqueta: string; total: bigint }>>`
      ${CON_ANCLA}
      SELECT o."modalidad"::text AS etiqueta, COUNT(*) AS total
        FROM "participantes" p
        JOIN "ofertas" o ON o."id" = p."ofertaId"
        ${UNIR_ANCLA}
       WHERE ${inscritos}
       GROUP BY 1 ORDER BY COUNT(*) DESC
    `,

    /**
     * El ritmo de captura, por el día de Bogotá.
     *
     * El momento del ancla es un timestamp sin zona guardado
     * en UTC, así que `date_trunc` a secas partía los días a
     * las 19:00 de Bogotá: las cinco horas de tarde-noche
     * —que es cuando la gente diligencia— se cargaban al día
     * siguiente. Y la ventana sí corta a medianoche de
     * Bogotá, así que el gráfico pintaba barras de días que
     * la propia etiqueta declaraba fuera del periodo.
     */
    prisma.$queryRaw<Array<{ dia: string; total: bigint }>>`
      ${CON_ANCLA}
      SELECT to_char(
               date_trunc('day', an."momento" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota'),
               'YYYY-MM-DD'
             ) AS dia,
             COUNT(*) AS total
        FROM "participantes" p
        ${UNIR_ANCLA}
       WHERE ${inscritos} ${dosMeses}
       GROUP BY 1 ORDER BY 1
    `,
  ]);

  const cifra = (f: { total: bigint }) => Number(f.total);

  return {
    ...ahora,
    cuposConfirmados: Number(cupos[0]?.cupos ?? 0),
    inscritosConReserva: Number(cobertura[0]?.conReserva ?? 0),
    inscritosPorSuCuenta: Number(cobertura[0]?.porSuCuenta ?? 0),
    embudo: embudo.map((f) => ({ etapa: f.etapa, total: cifra(f) })),
    porAccion: porAccion.map((f) => ({
      etiqueta: `${f.codigo} · ${f.etiqueta}`,
      total: cifra(f),
    })),
    porUbicacion: porUbicacion.map((f) => ({
      etiqueta: f.etiqueta,
      tipo: f.tipo,
      total: cifra(f),
    })),
    porGrupo: porGrupo.map((f) => ({
      etiqueta: `${f.codigo} · grupo ${f.numero}`,
      inicio: f.inicio ? f.inicio.toISOString().slice(0, 10) : null,
      total: cifra(f),
    })),
    porConvenio: porConvenio.map((f) => ({ etiqueta: f.etiqueta, total: cifra(f) })),
    porAsesor: porAsesor.map((f) => {
      const asignados = Number(f.asignados);
      const total = cifra(f);
      return {
        asesorId: f.asesorId,
        etiqueta: f.etiqueta,
        total,
        asignados,
        inscritosSiempre: Number(f.inscritosSiempre),
        conversion: asignados === 0 ? 0 : Number(f.inscritosSiempre) / asignados,
      };
    }),
    porOrigen: porOrigen.map((f) => ({ etiqueta: f.etiqueta, total: cifra(f) })),
    porModalidad: porModalidad.map((f) => ({ etiqueta: f.etiqueta, total: cifra(f) })),
    // ya viene como yyyy-mm-dd de Bogotá desde el SQL
    serie: serie.map((f) => ({ dia: f.dia, total: cifra(f) })),
    ventana: marco,
    anterior,
    variacion: comparar(ahora, anterior),
  };
}
