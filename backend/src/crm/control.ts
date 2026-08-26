import { EtapaParticipante, Prisma } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { enPeriodo, PRIMERA_MATRICULA } from './anclas';
import { ETAPAS_DEL_EMBUDO } from './metricas-inscripciones';
import { variacion, type Comparacion, type Ventana } from './ventana';

/**
 * Control de inscritos: cuántos hay y cómo se reparten.
 *
 * Va aparte de `crm.service.ts` porque son cerca de veinte
 * consultas que no comparten nada con el resto del CRM, y
 * aquel ya pasa de mil quinientas líneas.
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
 *
 * Los cortes accionables —quién no tiene asesor, quién
 * lleva días sin que lo llamen, qué origen convierte y qué
 * organización debe nombres— tampoco la llevan: son la cola
 * de trabajo de hoy, y recortarla por «ayer» la dejaría
 * casi vacía justo cuando más larga está.
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
/// Se arma desde `ETAPAS_DEL_EMBUDO` en vez de teclearla:
/// una lista tecleada aparte se queda atras el dia que la
/// otra cambie, y nadie se entera hasta que los numeros no
/// cuadran. Ya pasó.
const ETAPAS_INSCRIPCION = Prisma.sql`p."etapa" IN (${Prisma.join(
  ETAPAS_DEL_EMBUDO.map((e) => Prisma.sql`${e}::"EtapaParticipante"`),
)})`;

/**
 * Las tres primeras: lo que todavía está por trabajar.
 *
 * No sirve `ETAPAS_INSCRIPCION`, que incluye INSCRITO y
 * PERDIDO: los dos son un desenlace, y contarlos en la cola
 * del líder la haría crecer justo al cerrar fichas.
 */
const ETAPAS_POR_TRABAJAR = Prisma.sql`p."etapa" IN (
  'INTERESADO'::"EtapaParticipante",
  'CONTACTADO'::"EtapaParticipante",
  'DATOS_COMPLETOS'::"EtapaParticipante"
)`;

export type Corte = { etiqueta: string; total: number };

/** Un tramo de espera y cuántos llevan ahí. */
export type Tramo = {
  /** El piso del tramo en días: 0, 3, 8 o 15. */
  dias: number;
  total: number;
};

/** Cuánto convierte un origen, no cuánto trae. */
export type CorteOrigen = {
  etiqueta: string;
  /** Todos los que entraron por ahí. */
  leads: number;
  /** Los que de esos llegaron a inscrito. */
  inscritos: number;
  conversion: number;
};

/** Una organización, sus inscritos y sus cupos. */
export type CorteEmpresa = {
  nit: string;
  razonSocial: string;
  inscritos: number;
  cupos: number;
};

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
  /** La primera cola del líder: leads sin dueño. */
  sinAsignar: number;
  /** Cuánto lleva esperando quien sigue en INTERESADO. */
  sinContactar: Tramo[];
  porAccion: Corte[];
  porUbicacion: Array<Corte & { tipo: string }>;
  porGrupo: Array<Corte & { clave: string; inicio: string | null }>;
  porConvenio: Corte[];
  porAsesor: CorteAsesor[];
  porOrigen: Corte[];
  conversionPorOrigen: CorteOrigen[];
  porModalidad: Corte[];
  /** Las diez con más inscritos, contra sus cupos. */
  topEmpresas: CorteEmpresa[];
  serie: Array<{ dia: string; total: number }>;
  /** Cuándo llegaron los leads, no cuándo se inscribieron. */
  leadsPorDia: Array<{ dia: string; total: number }>;
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
  sinAsignar: 0,
  sinContactar: [],
  porAccion: [],
  porUbicacion: [],
  porGrupo: [],
  porConvenio: [],
  porAsesor: [],
  porOrigen: [],
  conversionPorOrigen: [],
  porModalidad: [],
  topEmpresas: [],
  serie: [],
  leadsPorDia: [],
};

/** Día ISO: las ventanas cortan a medianoche. */
function dia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Las dos cifras de cabecera bajo un filtro dado. */
async function cabecera(
  prisma: PrismaService,
  donde: Prisma.Sql,
): Promise<Cabecera> {
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
    diasHastaInscribir:
      media === null || media === undefined ? null : Number(media),
  };
}

/** Cuánto cambió cada cifra de cabecera. */
function comparar(
  a: Cabecera,
  b: Cabecera | null,
): Record<string, number | null> {
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
    hasta: comparacion.actual
      ? dia(new Date(comparacion.actual.hasta.getTime() - DIA))
      : null,
  };

  // con ámbito vacío no se consulta: un IN () es inválido
  if (ambito.length === 0) {
    return {
      ...VACIO,
      ventana: marco,
      anterior: null,
      variacion: comparar(VACIO, null),
    };
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
  const corte = (v: Ventana | null) =>
    enPeriodo(v?.desde ?? null, v?.hasta ?? null);
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

  // el mismo recorte, contado por creadoEn
  const dosMesesLeads = comparacion.actual
    ? Prisma.empty
    : Prisma.sql`AND p."creadoEn" >= NOW() - INTERVAL '60 days'`;

  const [
    ahora,
    anterior,
    cupos,
    cobertura,
    embudo,
    sinAsignar,
    sinContactar,
    porAccion,
    porUbicacion,
    porGrupo,
    porConvenio,
    porAsesor,
    porOrigen,
    conversionPorOrigen,
    porModalidad,
    topEmpresas,
    serie,
    leadsPorDia,
  ] = await Promise.all([
    cabecera(prisma, inscritos),

    comparacion.anterior
      ? cabecera(prisma, filtro(comparacion.anterior))
      : Promise.resolve(null),

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
      SELECT COUNT(*) FILTER (WHERE r."id" IS NOT NULL) AS "conReserva",
             COUNT(*) FILTER (WHERE r."id" IS NULL)     AS "porSuCuenta"
        FROM "participantes" p
        ${UNIR_ANCLA}
        -- las CANCELADAS fuera, igual que el denominador:
        -- si no, cancelar una reserva subia la cobertura
        LEFT JOIN "reservas" r
               ON r."id" = p."reservaId" AND r."estado" <> 'CANCELADA'
       WHERE ${suyos} ${enPeriodo(null, null)}
    `,

    prisma.$queryRaw<Array<{ etapa: EtapaParticipante; total: bigint }>>`
      SELECT p."etapa"::text AS etapa, COUNT(*) AS total
        FROM "participantes" p
       WHERE ${dentro} AND ${ETAPAS_INSCRIPCION}
       GROUP BY 1 ORDER BY 1
    `,

    /**
     * Lo que nadie está trabajando: sin asesor y sin cerrar.
     *
     * No lleva ventana ni ancla: es una cola, no un hecho
     * fechado. Recortada por el periodo, un lead de la
     * semana pasada que sigue sin dueño desaparecería de la
     * única lista que existe para darle uno.
     */
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total
        FROM "participantes" p
       WHERE ${suyos}
         AND p."asesorId" IS NULL
         AND ${ETAPAS_POR_TRABAJAR}
    `,

    /**
     * Cuánto lleva enfriándose la cola, en cuatro tramos.
     *
     * Solo INTERESADO: en cuanto alguien lo llama la ficha
     * pasa a CONTACTADO, así que la antigüedad de los demás
     * ya no mide espera sin atender. El corte va contra
     * `creadoEn` porque es cuándo llegó, que es la promesa
     * que se está incumpliendo.
     */
    prisma.$queryRaw<Array<{ dias: number; total: bigint }>>`
      SELECT CASE
               WHEN p."creadoEn" > NOW() - INTERVAL '3 days'  THEN 0
               WHEN p."creadoEn" > NOW() - INTERVAL '8 days'  THEN 3
               WHEN p."creadoEn" > NOW() - INTERVAL '15 days' THEN 8
               ELSE 15
             END AS dias,
             COUNT(*) AS total
        FROM "participantes" p
       WHERE ${suyos}
         AND p."etapa" = 'INTERESADO'::"EtapaParticipante"
       GROUP BY 1 ORDER BY 1
    `,

    prisma.$queryRaw<
      Array<{ etiqueta: string; codigo: string; total: bigint }>
    >`
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
      -- LEFT JOIN: ofertaId es nullable, y con INNER esa
      -- gente desaparecia de aqui pero no de «Por accion»,
      -- que esta justo encima. Una sumaba 100 % y la otra
      -- 78 % sin que nada lo dijera
      SELECT COALESCE(u."nombre", 'Sin ubicación asignada') AS etiqueta,
             COALESCE(u."tipo"::text, '—') AS tipo,
             COUNT(*) AS total
        FROM "participantes" p
        LEFT JOIN "ofertas" o     ON o."id" = p."ofertaId"
        LEFT JOIN "ubicaciones" u ON u."id" = o."ubicacionId"
        ${UNIR_ANCLA}
       WHERE ${inscritos}
       GROUP BY 1, 2
       ORDER BY COUNT(*) DESC
    `,

    prisma.$queryRaw<
      Array<{
        grupoId: string | null;
        numero: number;
        codigo: string;
        gremio: string | null;
        inicio: Date | null;
        total: bigint;
      }>
    >`
      ${CON_ANCLA}
      -- LEFT JOIN por lo mismo: coberturaId es nullable y
      -- no tener grupo solo AVISA al matricular, no bloquea
      SELECT g."id" AS "grupoId",
             g."numero" AS numero,
             COALESCE(af."codigo", '—') AS codigo,
             -- de qué gremio es esta AF1, porque hay más de una
             COALESCE(cv."sigla", cv."nombre") AS gremio,
             g."fechaInicio" AS inicio, COUNT(*) AS total
        FROM "participantes" p
        LEFT JOIN "grupos_cobertura" gc   ON gc."id" = p."coberturaId"
        LEFT JOIN "grupos" g              ON g."id" = gc."grupoId"
        LEFT JOIN "acciones_formacion" af ON af."id" = g."accionFormacionId"
        LEFT JOIN "convenios" cv          ON cv."id" = af."convenioId"
        ${UNIR_ANCLA}
       WHERE ${inscritos}
       -- por id, no por codigo: AF1..AF7 existen en los dos
       -- convenios y la numeracion de grupos reinicia, asi
       -- que agrupando por codigo dos grupos distintos se
       -- fundian en una barra bajo «el reparto real»
       GROUP BY g."id", af."id", 3, 4, g."numero", g."fechaInicio"
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

    /**
     * Qué origen convierte, que no es cuál trae más.
     *
     * `porOrigen` cuenta volumen y una pauta puede traer
     * trescientos leads y convertir el 2 %. Ni el numerador
     * ni el denominador llevan periodo, por lo mismo que la
     * conversión del asesor: con «hoy» todas caen a cero y
     * la tabla se ordena por quién tuvo suerte esta mañana.
     */
    prisma.$queryRaw<
      Array<{ etiqueta: string; leads: bigint; inscritos: bigint }>
    >`
      ${CON_ANCLA}
      SELECT p."origen"::text AS etiqueta,
             COUNT(*) AS leads,
             COUNT(*) FILTER (WHERE an."momento" IS NOT NULL) AS inscritos
        FROM "participantes" p
        ${UNIR_ANCLA}
       WHERE ${suyos}
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
     * Quién ya puso nombres y cuántos cupos había apartado.
     *
     * Ninguna de las dos cifras lleva ventana: los cupos no
     * pueden llevarla —salen de reservas— y medir contra
     * ellos unos inscritos recortados daría deudas de
     * nombres inventadas. Los cupos van en una subconsulta
     * por empresa y no en el mismo SUM: unidos a los
     * participantes se sumarían una vez por cada inscrito.
     */
    prisma.$queryRaw<
      Array<{
        nit: string;
        razonSocial: string;
        inscritos: bigint;
        cupos: bigint | null;
      }>
    >`
      ${CON_ANCLA}
      SELECT e."nit" AS nit,
             e."razonSocial" AS "razonSocial",
             COUNT(*) AS inscritos,
             (
               SELECT COALESCE(SUM(r2."cuposConfirmados"), 0)
                 FROM "reservas" r2
                 JOIN "ofertas" o2             ON o2."id" = r2."ofertaId"
                 JOIN "acciones_formacion" af2 ON af2."id" = o2."accionFormacionId"
                WHERE r2."empresaId" = e."id"
                  AND r2."estado" <> 'CANCELADA'
                  AND af2."convenioId" IN (${Prisma.join(ambito)})
             ) AS cupos
        FROM "participantes" p
        -- la misma condicion que el subselect de cupos: si
        -- no, una reserva cancelada deja sus inscritos
        -- contra unos cupos que ya no estan, y la fila sale
        -- con mas gente que sillas
        JOIN "reservas" r ON r."id" = p."reservaId" AND r."estado" <> 'CANCELADA'
        JOIN "empresas" e ON e."id" = r."empresaId"
        ${UNIR_ANCLA}
       WHERE ${suyos} ${enPeriodo(null, null)}
       GROUP BY e."id", e."nit", e."razonSocial"
       ORDER BY COUNT(*) DESC, e."razonSocial"
       LIMIT 10
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

    /**
     * Cuándo LLEGÓ cada lead, por el día de Bogotá.
     *
     * Va por `creadoEn` y con el mismo recorte que el embudo
     * —y los mismos dos meses cuando no hay ventana— para
     * poder leerla contra `serie` en la misma pantalla: dos
     * series de distinto rango no se comparan, se
     * malinterpretan.
     */
    prisma.$queryRaw<Array<{ dia: string; total: bigint }>>`
      SELECT to_char(
               date_trunc('day', p."creadoEn" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota'),
               'YYYY-MM-DD'
             ) AS dia,
             COUNT(*) AS total
        FROM "participantes" p
       WHERE ${dentro} ${dosMesesLeads}
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
    sinAsignar: Number(sinAsignar[0]?.total ?? 0),
    sinContactar: sinContactar.map((f) => ({
      dias: Number(f.dias),
      total: cifra(f),
    })),
    porAccion: porAccion.map((f) => ({
      etiqueta: `${f.codigo} · ${f.etiqueta}`,
      total: cifra(f),
    })),
    porUbicacion: porUbicacion.map((f) => ({
      etiqueta: f.etiqueta,
      tipo: f.tipo,
      total: cifra(f),
    })),
    /// La etiqueta lleva el gremio, y no es adorno.
    ///
    /// AF1 existe en BRITCHAM y existe en ADECOPRIA, y la
    /// numeración de grupos vuelve a empezar en cada una. Sin
    /// el gremio salían dos barras que decían exactamente lo
    /// mismo -- «AF1 · grupo 1» -- con cifras distintas, y no
    /// había forma de saber cuál era cuál. Se ve solo cuando
    /// se están mirando los dos gremios a la vez.
    porGrupo: porGrupo.map((f) => ({
      clave: f.grupoId ?? 'sin-grupo',
      etiqueta:
        f.numero === null
          ? 'Sin grupo asignado'
          : `${f.codigo} · grupo ${f.numero}${f.gremio ? ` · ${f.gremio}` : ''}`,
      inicio: f.inicio ? f.inicio.toISOString().slice(0, 10) : null,
      total: cifra(f),
    })),
    porConvenio: porConvenio.map((f) => ({
      etiqueta: f.etiqueta,
      total: cifra(f),
    })),
    porAsesor: porAsesor.map((f) => {
      const asignados = Number(f.asignados);
      const total = cifra(f);
      return {
        asesorId: f.asesorId,
        etiqueta: f.etiqueta,
        total,
        asignados,
        inscritosSiempre: Number(f.inscritosSiempre),
        conversion:
          asignados === 0 ? 0 : Number(f.inscritosSiempre) / asignados,
      };
    }),
    porOrigen: porOrigen.map((f) => ({
      etiqueta: f.etiqueta,
      total: cifra(f),
    })),
    conversionPorOrigen: conversionPorOrigen.map((f) => {
      const leads = Number(f.leads);
      const convertidos = Number(f.inscritos);
      return {
        etiqueta: f.etiqueta,
        leads,
        inscritos: convertidos,
        conversion: leads === 0 ? 0 : convertidos / leads,
      };
    }),
    porModalidad: porModalidad.map((f) => ({
      etiqueta: f.etiqueta,
      total: cifra(f),
    })),
    topEmpresas: topEmpresas.map((f) => ({
      nit: f.nit,
      razonSocial: f.razonSocial,
      inscritos: Number(f.inscritos),
      cupos: Number(f.cupos ?? 0),
    })),
    // ya viene como yyyy-mm-dd de Bogotá desde el SQL
    serie: serie.map((f) => ({ dia: f.dia, total: cifra(f) })),
    leadsPorDia: leadsPorDia.map((f) => ({ dia: f.dia, total: cifra(f) })),
    ventana: marco,
    anterior,
    variacion: comparar(ahora, anterior),
  };
}
