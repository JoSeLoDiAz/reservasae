/** Escribe los pasos y arma el embudo del formulario público. */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';

import { resolverVentana, type Rango } from '../crm/ventana';
import { PrismaService } from '../prisma/prisma.service';
import { diaBogota } from '../comun/dia-bogota';
import { procedenciaSql } from './procedencia';
import { MarcarPasoDto } from './dto';
import { altura, ESCALERA, VERSION_EMBUDO } from './escalera';

/// Solo el paso de llegada trae el contexto.
const SOLO_AL_LLEGAR = 'LLEGO';

type FilaEmbudo = { paso: string; visitas: bigint };
type FilaCorte = { valor: string | null; visitas: bigint; envios: bigint };
type FilaDia = { dia: string; llegaron: bigint; preinscritos: bigint };

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
  async procedenciaDe(visitaId: string): Promise<string | null> {
    try {
      const filas = await this.prisma.$queryRaw<Array<{ procedencia: string }>>`
        SELECT ${procedenciaSql()} AS procedencia
          FROM "pasos_de_visita"
         WHERE "visitaId" = ${visitaId} AND "paso" = 'LLEGO'
         LIMIT 1
      `;
      return filas[0]?.procedencia ?? null;
    } catch {
      // saber de dónde vino no puede tumbar un registro
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
  async embudo(ambito: string[], rango: Rango = 'SEMANA') {
    if (ambito.length === 0) return this.vacio(rango);

    const ventana = resolverVentana(rango);
    /// `TODO` no acota, y aquí sí hace falta un par de fechas:
    /// la consulta filtra por cuándo EMPEZÓ la visita.
    const desde = ventana.actual?.desde ?? new Date(0);
    const hasta = ventana.actual?.hasta ?? new Date(Date.now() + 86_400_000);

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

    const [porDia, procedencia, dispositivo, entrada, campana] = await Promise.all([
      this.porDia(ambito, desde, hasta),
      this.corte(ambito, desde, hasta, procedenciaSql()),
      this.corte(ambito, desde, hasta, Prisma.raw('"ancho"')),
      this.corte(ambito, desde, hasta, Prisma.raw('"puerta"')),
      this.corte(ambito, desde, hasta, Prisma.raw('"utmCampana"')),
    ]);

    /// CON AMBITO. Sin el, un gremio leia en negrita la fecha
    /// del primer paso del OTRO: el filtro se interseca, nunca
    /// se omite.
    const primero = await this.prisma.pasoDeVisita.findFirst({
      where: { convenioId: { in: ambito } },
      orderBy: { creadoEn: 'asc' },
      select: { creadoEn: true },
    });

    return {
      etiqueta: ventana.etiqueta,
      contandoDesde: primero?.creadoEn ?? null,
      hitos,
      caidaMayor: caidaMayor(hitos),
      porDia,
      procedencia,
      dispositivo,
      entrada,
      campana,
    };
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

  /// Un corte del paso de LLEGADA, con su conversión.
  ///
  /// La expresión sale SIEMPRE del código —un nombre de columna o
  /// el `CASE` de la procedencia—, nunca del cliente.
  private async corte(
    ambito: string[],
    desde: Date,
    hasta: Date,
    col: Prisma.Sql,
  ): Promise<Array<{ valor: string | null; visitas: number; envios: number }>> {
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
      envios: Number(f.envios),
    }));
  }

  private vacio(rango: Rango) {
    return {
      etiqueta: resolverVentana(rango).etiqueta,
      contandoDesde: null,
      hitos: ESCALERA.map((paso) => ({ paso, visitas: 0 })),
      caidaMayor: null,
      porDia: [],
      procedencia: [],
      dispositivo: [],
      entrada: [],
      campana: [],
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
