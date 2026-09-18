/** Escribe los pasos y arma el embudo del formulario público. */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';

import { compararDos, resolverVentana, type Rango } from '../crm/ventana';
import { PrismaService } from '../prisma/prisma.service';
import { diaBogota } from '../comun/dia-bogota';
import type { LlegadaDeLaVisita } from './origen-de-la-visita';
import { procedenciaSql } from './procedencia';
import { MarcarPasoDto } from './dto';
import { altura, ESCALERA, PRIMER_GESTO, VERSION_EMBUDO } from './escalera';

/**
 * Cuántas personas en UN DÍA ya son un enlace suelto por ahí.
 *
 * Por debajo es ruido: alguien que escribió la dirección, un
 * favorito, el equipo probando. Por encima, alguien repartió la
 * dirección sin sacarla del panel. Veinte es un supuesto del 18 sep
 * 2026, sin datos detrás: se ajusta cuando haya semanas medidas.
 */
export const UMBRAL_SIN_MARCAR = 20;

/// Lo que cuenta como «sin marcar». Sale del MISMO `CASE` que la
/// pantalla pinta como «No dejó rastro» y «Otra página web»: una
/// segunda definición acabaría discrepando de la dona de al lado.
/// Buscador, Meta y nuestras páginas NO: ahí sí hay señal, y no
/// son un enlace que alguien repartió.
const SIN_MARCAR = ['SIN_REFERENCIA', 'OTRA_WEB'];

/// Solo el paso de llegada trae el contexto.
const SOLO_AL_LLEGAR = 'LLEGO';

type FilaEmbudo = { paso: string; visitas: bigint };
type FilaCorte = {
  valor: string | null;
  visitas: bigint;
  personas: bigint;
  tocaron: bigint;
  envios: bigint;
};
type FilaDia = { dia: string; llegaron: bigint; preinscritos: bigint };

/** Lo que puede pedir la pantalla. Las fechas son ISO. */
export type PedidoDeEmbudo = {
  rango?: Rango;
  desde?: string;
  hasta?: string;
  /// Con estos dos, se comparan DOS periodos elegidos.
  contraDesde?: string;
  contraHasta?: string;
};

@Injectable()
export class EmbudoService {
  private readonly log = new Logger('Embudo');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Marca un paso. Gana la primera escritura.
   *
   * No lanza nunca y no dice si escribió: la puerta contesta 204
   * pase lo que pase, así que un slug inventado no puede servir
   * de oráculo de qué convenios existen.
   */
  async marcar(slug: string, dto: MarcarPasoDto): Promise<void> {
    try {
      const convenio = await this.prisma.convenio.findFirst({
        where: { slug },
        select: { id: true },
      });
      // slug desconocido: no se escribe y no se avisa
      if (!convenio) return;

      const alLlegar = dto.paso === SOLO_AL_LLEGAR;

      await this.prisma.pasoDeVisita.create({
        data: {
          visitaId: dto.visita,
          paso: dto.paso,
          version: dto.version ?? VERSION_EMBUDO,
          ms: dto.ms ?? null,
          detalle: dto.detalle ?? null,
          convenioId: convenio.id,
          slug,
          puerta: alLlegar ? (dto.puerta ?? null) : null,
          utmFuente: alLlegar ? (dto.utmFuente ?? null) : null,
          utmCampana: alLlegar ? (dto.utmCampana ?? null) : null,
          utmContenido: alLlegar ? (dto.utmContenido ?? null) : null,
          huboFbclid: alLlegar ? (dto.huboFbclid ?? null) : null,
          referente: alLlegar ? (dto.referente ?? null) : null,
          ancho: alLlegar ? (dto.ancho ?? null) : null,
          navegador: alLlegar ? (dto.navegador ?? null) : null,
        },
      });
    } catch (e) {
      // P2002 es el par repetido, que es el comportamiento
      if ((e as { code?: string }).code === 'P2002') return;
      this.log.warn(`No se pudo marcar «${dto.paso}»: ${String(e)}`);
    }
  }

  /**
   * El que escribe el servidor al aceptar el envío.
   *
   * `yaEstaba` no es cosmético: `registrar()` contesta 201 también
   * cuando el documento ya estaba inscrito, y contar eso como
   * conversión infla justo los canales por los que se reescribe a
   * gente que YA es ficha —el correo y WhatsApp—. Va en `detalle`
   * para no gastar una columna en un booleano.
   */
  async registrado(
    visitaId: string,
    slug: string,
    convenioId: string,
    yaEstaba = false,
  ): Promise<void> {
    try {
      await this.prisma.pasoDeVisita.create({
        data: {
          visitaId,
          paso: 'REGISTRADO',
          slug,
          convenioId,
          detalle: yaEstaba ? 'REPETIDA' : 'NUEVA',
        },
      });
    } catch {
      // repetido o visita inventada: no puede tumbar un registro
    }
  }

  /**
   * De dónde venía esta visita, para atribuir la ficha.
   *
   * Sale del MISMO `CASE` que pinta la pantalla: dos reglas para
   * «vino de pauta» acabarían discrepando, y este repositorio ya
   * pagó una vez por eso.
   */
  async procedenciaDe(visitaId: string): Promise<LlegadaDeLaVisita | null> {
    try {
      const filas = await this.prisma.$queryRaw<
        Array<{ procedencia: string; pagada: boolean; campana: string | null }>
      >`
        SELECT ${procedenciaSql()} AS procedencia,
               nullif("utmCampana", '') AS campana,
               -- la etiqueta de Ads Manager, o el clic de Meta
               (coalesce("utmCampana", '') <> '' OR "huboFbclid" IS TRUE) AS pagada
          FROM "pasos_de_visita"
         WHERE "visitaId" = ${visitaId} AND "paso" = 'LLEGO'
         LIMIT 1
      `;
      const f = filas[0];
      return f
        ? { procedencia: f.procedencia, pagada: f.pagada, campana: f.campana }
        : null;
    } catch (e) {
      /// Se dice. Si esto falla en silencio, el sintoma es que
      /// todo vuelve a ser AUTOGESTION -- o sea, indistinguible
      /// del defecto que este arreglo vino a cerrar.
      this.log.warn(`No se pudo leer la procedencia de una visita: ${String(e)}`);
      return null;
    }
  }

  /**
   * El embudo, contado por VISITA y acumulado.
   *
   * Cada visita aporta a su peldaño máximo y a todos los
   * anteriores, así que las barras salen monótonas por
   * construcción: un embudo que sube no se puede leer.
   */
  async embudo(ambito: string[], pedido: PedidoDeEmbudo = {}) {
    const rango = pedido.rango ?? 'SEMANA';
    if (ambito.length === 0) return this.vacio(rango);

    /**
     * DOS PERIODOS ELEGIDOS, no uno contra su previo.
     *
     * Lo pidió el cliente: «de tal fecha a tal fecha, hoy contra
     * ayer, un día contra otro del calendario». `compararDos` ya
     * existe para esto y su docblock lo dice: no exige que duren
     * igual, así que la pantalla tiene que enseñar los DOS
     * rótulos y no un genérico «el periodo anterior».
     */
    const comparando = Boolean(pedido.contraDesde && pedido.contraHasta);
    const marco = comparando
      ? compararDos(
          'PERSONALIZADO',
          'PERSONALIZADO',
          pedido.desde,
          pedido.hasta,
          pedido.contraDesde,
          pedido.contraHasta,
        )
      : resolverVentana(rango, pedido.desde, pedido.hasta);

    /// `TODO` no acota, y aquí sí hace falta un par de fechas:
    /// la consulta filtra por cuándo EMPEZÓ la visita.
    const desde = marco.actual?.desde ?? new Date(0);
    const hasta = marco.actual?.hasta ?? new Date(Date.now() + 86_400_000);
    const ventana = marco;

    /// La visita se fecha por su PRIMER paso, no paso a paso:
    /// una que empieza a las 23:58 y envía a las 00:02 saldría
    /// partida en dos días, y en los dos como un embudo roto.
    const filas = await this.prisma.$queryRaw<FilaEmbudo[]>`
      WITH visitas AS (
        SELECT "visitaId",
               MIN("creadoEn") AS empezo,
               MAX(CASE WHEN "paso" = ANY(${ESCALERA as unknown as string[]}::text[])
                        THEN array_position(${ESCALERA as unknown as string[]}::text[], "paso")
                        ELSE 0 END) AS tope
          FROM "pasos_de_visita"
         WHERE "convenioId" IN (${Prisma.join(ambito)})
         GROUP BY "visitaId"
      )
      SELECT e.paso, COUNT(*)::bigint AS visitas
        FROM visitas v
        JOIN LATERAL unnest(${ESCALERA as unknown as string[]}::text[])
               WITH ORDINALITY AS e(paso, n) ON e.n <= v.tope
       WHERE v.empezo >= ${desde} AND v.empezo < ${hasta}
       GROUP BY e.paso
    `;

    const porPaso = new Map(filas.map((f) => [f.paso, Number(f.visitas)]));
    const hitos = ESCALERA.map((paso) => ({ paso, visitas: porPaso.get(paso) ?? 0 }));

    const [personas, porDia, procedencia, dispositivo, entrada, campana, sinMarcarHoy] =
      await Promise.all([
      this.personas(ambito, desde, hasta),
      this.porDia(ambito, desde, hasta),
      this.corte(ambito, desde, hasta, procedenciaSql()),
      this.corte(ambito, desde, hasta, Prisma.raw('"ancho"')),
      this.corte(ambito, desde, hasta, Prisma.raw('"puerta"')),
      this.corte(ambito, desde, hasta, Prisma.raw('"utmCampana"')),
      this.sinMarcarHoy(ambito),
    ]);

    /// CON AMBITO. Sin el, un gremio leia en negrita la fecha
    /// del primer paso del OTRO: el filtro se interseca, nunca
    /// se omite.
    const primero = await this.prisma.pasoDeVisita.findFirst({
      where: { convenioId: { in: ambito } },
      orderBy: { creadoEn: 'asc' },
      select: { creadoEn: true },
    });

    /// El segundo periodo, solo si se pidió. Una consulta más y
    /// no seis: del bloque comparado interesa el embudo y de
    /// dónde venían, no los tres cortes menores.
    const comparado =
      comparando && marco.anterior
        ? await this.bloqueCorto(ambito, marco.anterior.desde, marco.anterior.hasta)
        : null;

    return {
      etiqueta: ventana.etiqueta,
      etiquetaAnterior: ventana.etiquetaAnterior ?? null,
      comparado,
      contandoDesde: primero?.creadoEn ?? null,
      /// APARTE, y no sumado a nada. Ver `historico()`.
      historico: await this.historico(ambito),
      hitos,
      /// Fuera de `hitos` a proposito: no es un peldaño de la
      /// escalera, asi que meterlo alli lo pondria en el embudo.
      personas,
      caidaMayor: caidaMayor(hitos),
      porDia,
      procedencia,
      dispositivo,
      entrada,
      campana,
      /// SIEMPRE de hoy, elija el periodo que elija la pantalla:
      /// es un aviso para actuar hoy, no una cifra del informe.
      sinMarcarHoy,
    };
  }

  /**
   * Personas de HOY que entraron por un enlace sin marcar.
   *
   * Lo pidió Mauricio el 18 sep 2026 para «blindar» la atribución
   * sin tocar el formulario: si alguien reparte la dirección
   * pelada, que se sepa ese mismo día y no en el informe del mes.
   *
   * PERSONAS y no visitas: un escáner de correo abre cada enlace
   * de un envío --565 de 599 el 16 sep--, y contando visitas el
   * aviso saltaría con cada mailing bien marcado.
   *
   * Y DESDE DÓNDE, cuando hay referente: «web.whatsapp.com» dice
   * por dónde se escapó el enlace, que es lo que hace falta para
   * corregirlo. Solo el host: la ruta nunca se guarda.
   */
  private async sinMarcarHoy(ambito: string[]) {
    const hoy = resolverVentana('HOY').actual;
    if (!hoy) return { personas: 0, umbral: UMBRAL_SIN_MARCAR, desde: [] };

    const filas = await this.prisma.$queryRaw<
      Array<{ referente: string | null; n: bigint }>
    >`
      SELECT nullif(lower(l."referente"), '') AS referente, COUNT(*)::bigint AS n
        FROM "pasos_de_visita" l
       WHERE l."paso" = 'LLEGO'
         AND l."convenioId" IN (${Prisma.join(ambito)})
         AND l."creadoEn" >= ${hoy.desde} AND l."creadoEn" < ${hoy.hasta}
         AND (${procedenciaSql()}) IN (${Prisma.join(SIN_MARCAR)})
         AND ${this.esDePersona()}
       GROUP BY 1
       ORDER BY 2 DESC
    `;

    return {
      personas: filas.reduce((t, f) => t + Number(f.n), 0),
      umbral: UMBRAL_SIN_MARCAR,
      desde: filas
        .filter((f) => f.referente)
        .slice(0, 3)
        .map((f) => ({ sitio: f.referente as string, personas: Number(f.n) })),
    };
  }

  /**
   * El trafico de ANTES del contador, reconstruido del
   * registro del servidor.
   *
   * Va en su propio campo y NO se suma a ninguna cifra de
   * arriba, y eso es la mitad del diseno. Si se mezclara:
   *
   * - `contandoDesde` es la fila mas vieja de `pasos_de_visita`
   *   y la pantalla la presenta como «el contador empezo el
   *   ...»: una sola fila reconstruida haria que afirmara
   *   haber medido lo que no midio.
   * - `hitos` acredita a cada visita TODOS los peldanos por
   *   debajo de su maximo --es lo que garantiza que el embudo
   *   no suba--, asi que una llegada reconstruida contaria
   *   como que esa persona eligio ciudad, eligio curso y
   *   AUTORIZO SUS DATOS. Seria una afirmacion sobre el
   *   consentimiento salida de una linea de registro.
   * - `caidaMayor` diria «N personas se fueron cargando» sobre
   *   gente de la que no se sabe nada.
   *
   * Lo que si se comparte es la REGLA: la procedencia sale de
   * `procedenciaSql()`, la misma funcion sobre las mismas
   * cuatro columnas. Con dos clasificadores, la misma visita
   * saldria de dos maneras segun de que fuente venga.
   */
  private async historico(ambito: string[]) {
    if (ambito.length === 0) return null;

    const [porDia, procedencia] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ dia: string; llegaron: bigint; preinscritos: bigint }>
      >`
        SELECT to_char(dia, 'YYYY-MM-DD') AS dia,
               SUM(visitas)::bigint AS llegaron,
               SUM(envios)::bigint  AS preinscritos
          FROM visitas_reconstruidas
         WHERE "convenioId" IN (${Prisma.join(ambito)})
         GROUP BY dia
         ORDER BY dia`,
      this.prisma.$queryRaw<
        Array<{ valor: string; visitas: bigint; envios: bigint }>
      >`
        SELECT ${procedenciaSql()} AS valor,
               SUM(visitas)::bigint AS visitas,
               SUM(envios)::bigint  AS envios
          FROM visitas_reconstruidas
         WHERE "convenioId" IN (${Prisma.join(ambito)})
         GROUP BY 1
         ORDER BY 2 DESC`,
    ]);

    if (porDia.length === 0) return null;

    const dias = porDia.map((f) => ({
      dia: f.dia,
      llegaron: Number(f.llegaron),
      preinscritos: Number(f.preinscritos),
    }));

    return {
      desde: dias[0].dia,
      hasta: dias[dias.length - 1].dia,
      visitas: dias.reduce((t, d) => t + d.llegaron, 0),
      envios: dias.reduce((t, d) => t + d.preinscritos, 0),
      porDia: dias,
      procedencia: procedencia.map((f) => ({
        valor: f.valor,
        visitas: Number(f.visitas),
        envios: Number(f.envios),
      })),
    };
  }

  /**
   * El segundo periodo, en corto.
   *
   * Solo el embudo y de dónde venían: comparar dos fechas es
   * responder «¿mejoró o empeoró?», y para eso no hacen falta
   * los cortes por dispositivo ni por campaña, que son para
   * mirar UN periodo por dentro.
   */
  private async bloqueCorto(ambito: string[], desde: Date, hasta: Date) {
    const [hitos, procedencia] = await Promise.all([
      this.hitos(ambito, desde, hasta),
      this.corte(ambito, desde, hasta, procedenciaSql()),
    ]);
    return { hitos, procedencia };
  }

  /// Los peldaños de una ventana. Sale del `embudo()` para poder
  /// pedirlo dos veces sin repetir la consulta escrita.
  private async hitos(
    ambito: string[],
    desde: Date,
    hasta: Date,
  ): Promise<Array<{ paso: string; visitas: number }>> {
    const filas = await this.prisma.$queryRaw<FilaEmbudo[]>`
      WITH visitas AS (
        SELECT "visitaId",
               MIN("creadoEn") AS empezo,
               MAX(CASE WHEN "paso" = ANY(${ESCALERA as unknown as string[]}::text[])
                        THEN array_position(${ESCALERA as unknown as string[]}::text[], "paso")
                        ELSE 0 END) AS tope
          FROM "pasos_de_visita"
         WHERE "convenioId" IN (${Prisma.join(ambito)})
         GROUP BY "visitaId"
      )
      SELECT e.paso, COUNT(*)::bigint AS visitas
        FROM visitas v
        JOIN LATERAL unnest(${ESCALERA as unknown as string[]}::text[])
               WITH ORDINALITY AS e(paso, n) ON e.n <= v.tope
       WHERE v.empezo >= ${desde} AND v.empezo < ${hasta}
       GROUP BY e.paso
    `;
    const porPaso = new Map(filas.map((f) => [f.paso, Number(f.visitas)]));
    return ESCALERA.map((paso) => ({ paso, visitas: porPaso.get(paso) ?? 0 }));
  }

  /**
   * Cuántos llegan y cuántos se preinscriben, DÍA A DÍA.
   *
   * Es el comparativo que pidió el cliente: desde que arrancó el
   * contador y hacia adelante, en vez de contra un periodo en el
   * que no se medía —que daría un −100 % que solo dice que antes
   * no había contador.
   *
   * Los días sin nada salen en CERO y no faltan: una serie con
   * huecos se lee como si esos días no existieran.
   */
  private async porDia(
    ambito: string[],
    desde: Date,
    hasta: Date,
  ): Promise<Array<{ dia: string; llegaron: number; preinscritos: number }>> {
    const filas = await this.prisma.$queryRaw<FilaDia[]>`
      WITH visitas AS (
        SELECT "visitaId",
               MIN("creadoEn") AS empezo,
               bool_or("paso" = 'REGISTRADO'
                       AND coalesce("detalle", 'NUEVA') <> 'REPETIDA') AS se_inscribio
          FROM "pasos_de_visita"
         WHERE "convenioId" IN (${Prisma.join(ambito)})
         GROUP BY "visitaId"
      ),
      dentro AS (
        SELECT * FROM visitas WHERE empezo >= ${desde} AND empezo < ${hasta}
      ),
      -- los dias del rango, para que los ceros existan
      calendario AS (
        SELECT to_char(d, 'YYYY-MM-DD') AS dia
          FROM generate_series(
                 (SELECT MIN(empezo) FROM dentro) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota',
                 NOW() AT TIME ZONE 'America/Bogota',
                 interval '1 day') AS d
      ),
      contadas AS (
        SELECT ${diaBogota(Prisma.sql`empezo`)} AS dia,
               COUNT(*)::bigint AS llegaron,
               COUNT(*) FILTER (WHERE se_inscribio)::bigint AS preinscritos
          FROM dentro GROUP BY 1
      )
      SELECT c.dia,
             coalesce(x.llegaron, 0)::bigint AS llegaron,
             coalesce(x.preinscritos, 0)::bigint AS preinscritos
        FROM calendario c LEFT JOIN contadas x USING (dia)
       ORDER BY c.dia
    `;
    return filas.map((f) => ({
      dia: f.dia,
      llegaron: Number(f.llegaron),
      preinscritos: Number(f.preinscritos),
    }));
  }

  /**
   * Si esa visita la hizo alguien.
   *
   * `SE_QUEDO` la escribe un temporizador a los tres segundos:
   * un escaner de enlaces carga y cierra, una persona sigue ahi.
   *
   * O TOCO EL FORMULARIO, y ese `OR` no es un adorno: sin el, una
   * visita que perdiera el beacon del temporizador pero llegara a
   * inscribirse saldria con menos personas que envios, y un
   * embudo que sube no se puede leer. Asi sale monotono por
   * construccion.
   */
  /// Cuantas de las llegadas del periodo las hizo alguien.
  private async personas(
    ambito: string[],
    desde: Date,
    hasta: Date,
  ): Promise<number> {
    const filas = await this.prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n
        FROM "pasos_de_visita" l
       WHERE l."paso" = 'LLEGO'
         AND l."convenioId" IN (${Prisma.join(ambito)})
         AND l."creadoEn" >= ${desde} AND l."creadoEn" < ${hasta}
         AND ${this.esDePersona()}
    `;
    return Number(filas[0]?.n ?? 0);
  }

  private esDePersona(): Prisma.Sql {
    return Prisma.sql`EXISTS (
      SELECT 1 FROM "pasos_de_visita" q
       WHERE q."visitaId" = l."visitaId"
         AND (q."paso" = 'SE_QUEDO'
              OR array_position(
                   ${ESCALERA as unknown as string[]}::text[], q."paso"
                 ) >= ${altura(PRIMER_GESTO) + 1})
    )`;
  }

  /// Un corte del paso de LLEGADA, con su conversión.
  ///
  /// La expresión sale SIEMPRE del código —un nombre de columna o
  /// el `CASE` de la procedencia—, nunca del cliente.
  private async corte(
    ambito: string[],
    desde: Date,
    hasta: Date,
    col: Prisma.Sql,
  ): Promise<
    Array<{
      valor: string | null;
      visitas: number;
      personas: number;
      tocaron: number;
      envios: number;
    }>
  > {
    const filas = await this.prisma.$queryRaw<FilaCorte[]>`
      WITH llegadas AS (
        SELECT "visitaId", ${col} AS valor, "creadoEn"
          FROM "pasos_de_visita"
         WHERE "paso" = 'LLEGO'
           AND "convenioId" IN (${Prisma.join(ambito)})
           AND "creadoEn" >= ${desde} AND "creadoEn" < ${hasta}
      )
      SELECT l.valor,
             COUNT(*)::bigint AS visitas,
             COUNT(*) FILTER (WHERE ${this.esDePersona()}
             )::bigint AS personas,
             -- Por PELDANO y no por el paso exacto: asi
             -- tocaron nunca puede salir menor que envios
             -- --REGISTRADO esta por encima-- y la fila sale
             -- monotona aunque se pierda el beacon de en medio.
             COUNT(*) FILTER (
               WHERE EXISTS (
                 SELECT 1 FROM "pasos_de_visita" g
                  WHERE g."visitaId" = l."visitaId"
                    AND array_position(
                          ${ESCALERA as unknown as string[]}::text[], g."paso"
                        ) >= ${altura(PRIMER_GESTO) + 1}
               )
             )::bigint AS tocaron,
             COUNT(*) FILTER (
               WHERE EXISTS (
                 SELECT 1 FROM "pasos_de_visita" p
                  WHERE p."visitaId" = l."visitaId"
                    AND p."paso" = 'REGISTRADO'
                    -- las repetidas no son conversion
                    AND coalesce(p."detalle", 'NUEVA') <> 'REPETIDA'
               )
             )::bigint AS envios
        FROM llegadas l
       GROUP BY l.valor
       ORDER BY visitas DESC
       LIMIT 12
    `;
    return filas.map((f) => ({
      valor: f.valor,
      visitas: Number(f.visitas),
      personas: Number(f.personas),
      tocaron: Number(f.tocaron),
      envios: Number(f.envios),
    }));
  }

  private vacio(rango: Rango) {
    return {
      etiqueta: resolverVentana(rango).etiqueta,
      etiquetaAnterior: null,
      comparado: null,
      contandoDesde: null,
      hitos: ESCALERA.map((paso) => ({ paso, visitas: 0 })),
      personas: 0,
      caidaMayor: null,
      porDia: [],
      procedencia: [],
      dispositivo: [],
      entrada: [],
      campana: [],
      /// Sin ambito no hay nada que ensenar, tampoco de antes.
      historico: null,
    };
  }
}

/** Entre qué dos peldaños se va más gente. */
export function caidaMayor(
  hitos: Array<{ paso: string; visitas: number }>,
): { de: string; a: string; sePerdieron: number } | null {
  let peor: { de: string; a: string; sePerdieron: number } | null = null;
  for (let i = 0; i < hitos.length - 1; i++) {
    const sePerdieron = hitos[i].visitas - hitos[i + 1].visitas;
    if (sePerdieron <= 0) continue;
    if (!peor || sePerdieron > peor.sePerdieron) {
      peor = { de: hitos[i].paso, a: hitos[i + 1].paso, sePerdieron };
    }
  }
  return peor;
}

export { altura };
