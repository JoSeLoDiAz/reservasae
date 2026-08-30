/** La cola de validación por buscador web. */

/// Mismo reparto que el RUI: una fila por consulta, un solo hilo
/// vaciándola, y el resultado NO entra en la ficha -- entra como
/// propuesta, para que una persona la acepte campo por campo.
///
/// Cambios de este port:
///   - encolar() deduplica por NIT (no por institucionId) y respeta el
///     "banco de empresas únicas": si el mismo NIT se consultó hace poco
///     con éxito, no se vuelve a consultar.
///   - procesarUna() consulta N veces y CONSOLIDA por consenso, para
///     blindar la volatilidad del buscador. Los niveles de confianza por
///     campo se guardan en la consulta para la pantalla de revisión.

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { EstadoConsultaRues } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { consolidarFichas, aFichaWeb, type FichaConsolidada } from './consenso';
import { fichaAPropuesta } from './ficha-a-propuesta';
import type { FichaWeb } from './leer-ficha-web';
import {
  PROVEEDOR_WEB,
  type ProveedorWeb,
  type RespuestaWeb,
  webConectado,
} from './proveedor-web';

/// Lo que todavía no tiene respuesta.
const SIN_RESOLVER = [EstadoConsultaRues.PENDIENTE, EstadoConsultaRues.EN_CURSO];

/// Cuántas veces se reintenta antes de darla por perdida.
const INTENTOS_MAXIMOS = 3;

/// Cuántas veces se consulta el mismo NIT para el consenso.
const CORRIDAS_CONSENSO = Math.max(1, Number(process.env.WEB_CONSENSO ?? 3) || 3);

/// Pausa entre corridas del mismo NIT (no atosigar al buscador).
const PAUSA_CONSENSO = 4000;

/// Ventana en la que una consulta LISTA del mismo NIT se reaprovecha:
/// dentro de esto, el banco ya tiene la empresa y no se vuelve a pagar.
const REUSO_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

/// Los campos que la ficha necesita para poder reportarse.
const CAMPOS_DE_LA_FICHA = {
  razonSocial: true, nombreComercial: true, fechaFundacion: true,
  direccion: true, telefono: true, correo: true, paginaWeb: true,
  ciudadNombre: true, departamentoNombre: true, sectorEconomico: true,
  codigoCiiu: true, clasificacion: true, tamano: true, numeroEmpleados: true,
} as const;

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

@Injectable()
export class WebService {
  private readonly log = new Logger('BuscadorWeb');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVEEDOR_WEB) private readonly proveedor: ProveedorWeb,
  ) {}

  /**
   * Pone una institución en la cola.
   *
   * No espera a nada: guardar una ficha nunca se bloquea por el
   * buscador. Deduplica por NIT (banco de empresas únicas): si ya hay
   * una consulta pendiente para ese NIT solo se le sube la prioridad, y
   * si el mismo NIT se resolvió hace poco no se vuelve a consultar.
   */
  async encolar(institucionId: string, prioridad = 0): Promise<void> {
    const f = await this.prisma.institucion.findUnique({
      where: { id: institucionId },
      select: { id: true, nit: true, razonSocial: true },
    });
    if (!f) throw new NotFoundException('Esa organización ya no existe.');

    // 1) ¿Ya hay una consulta sin resolver para ESTE NIT (cualquier ficha)?
    const pendiente = await this.prisma.consultaRues.findFirst({
      where: { nit: f.nit, estado: { in: SIN_RESOLVER } },
      select: { id: true, prioridad: true },
    });
    if (pendiente) {
      if (prioridad > pendiente.prioridad) {
        await this.prisma.consultaRues.update({
          where: { id: pendiente.id },
          data: { prioridad },
        });
      }
      return;
    }

    // 2) Banco único: ¿el mismo NIT ya se resolvió con éxito hace poco?
    const reciente = await this.prisma.consultaRues.findFirst({
      where: {
        nit: f.nit,
        estado: EstadoConsultaRues.LISTA,
        resueltaEn: { gte: new Date(Date.now() - REUSO_MS) },
      },
      select: { id: true },
    });
    if (reciente) {
      this.log.log(`NIT ${f.nit}: ya está en el banco (consulta reciente). No se repite.`);
      return;
    }

    // 3) No había nada: se crea la fila.
    await this.prisma.consultaRues.create({
      data: { institucionId, nit: f.nit, prioridad },
    });
  }

  /// En qué va lo de una organización, para que la ficha pueda decir
  /// «consultando» en vez de quedarse muda.
  async estado(institucionId: string) {
    const ultima = await this.prisma.consultaRues.findFirst({
      where: { institucionId },
      orderBy: { creadoEn: 'desc' },
      select: {
        estado: true, camposNuevos: true, ultimoError: true,
        creadoEn: true, resueltaEn: true,
      },
    });
    return { conectado: webConectado(), ultima };
  }

  /// Toma una fila y la marca en curso en el mismo golpe. `SKIP LOCKED`
  /// deja que mañana corran dos trabajadores sin que los dos consulten
  /// -- y paguen -- el mismo NIT.
  private async tomarSiguiente() {
    const filas = await this.prisma.$queryRaw<
      Array<{ id: string; institucionId: string; nit: string }>
    >`
      UPDATE "consultas_rues"
      SET "estado" = 'EN_CURSO', "tomadaEn" = NOW(), "intentos" = "intentos" + 1
      WHERE "id" = (
        SELECT "id" FROM "consultas_rues"
        WHERE "estado" = 'PENDIENTE'
        ORDER BY "prioridad" DESC, "creadoEn" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id", "institucionId", "nit"
    `;
    return filas[0] ?? null;
  }

  /** Consulta una y guarda lo que salga. */
  async procesarUna(): Promise<boolean> {
    const tarea = await this.tomarSiguiente();
    if (!tarea) return false;

    let resultado: RespuestaWeb;
    let consenso: FichaConsolidada | undefined;
    try {
      const r = await this.consultarConConsenso(tarea.nit);
      resultado = r.resultado;
      consenso = r.consenso;
    } catch (e) {
      resultado = { estado: 'FALLO', error: (e as Error).message };
    }

    await this.guardar(tarea.id, tarea.institucionId, resultado, consenso);
    return true;
  }

  /**
   * Consulta el mismo NIT N veces y consolida por consenso.
   *
   * Cada corrida es una consulta real al proveedor. Se juntan las fichas
   * ENCONTRADAS y se votan campo por campo. Si ninguna corrida trajo
   * algo aprovechable, se devuelve el último FALLO o SIN_RESULTADO.
   */
  private async consultarConConsenso(
    nit: string,
  ): Promise<{ resultado: RespuestaWeb; consenso?: FichaConsolidada }> {
    const fichas: FichaWeb[] = [];
    let ultimoError = '';
    let ultimoCrudo = '';

    for (let i = 0; i < CORRIDAS_CONSENSO; i += 1) {
      let r: RespuestaWeb;
      try {
        r = await this.proveedor.consultar(nit);
      } catch (e) {
        ultimoError = (e as Error).message;
        continue;
      }
      if (r.estado === 'ENCONTRADO') {
        fichas.push(r.ficha);
        ultimoCrudo = r.crudo;
      } else if (r.estado === 'FALLO') {
        ultimoError = r.error;
      } else if (r.crudo) {
        ultimoCrudo = r.crudo;
      }
      if (i < CORRIDAS_CONSENSO - 1) await esperar(PAUSA_CONSENSO);
    }

    if (fichas.length === 0) {
      return {
        resultado: ultimoError
          ? { estado: 'FALLO', error: ultimoError }
          : { estado: 'SIN_RESULTADO', crudo: ultimoCrudo || undefined },
      };
    }

    const consenso = consolidarFichas(fichas);
    const ficha = aFichaWeb(consenso);
    if (!ficha.razonSocial) {
      return { resultado: { estado: 'SIN_RESULTADO', crudo: ultimoCrudo || undefined } };
    }
    return { resultado: { estado: 'ENCONTRADO', ficha, crudo: ultimoCrudo }, consenso };
  }

  private async guardar(
    id: string,
    institucionId: string,
    resultado: RespuestaWeb,
    consenso?: FichaConsolidada,
  ): Promise<void> {
    const c = await this.prisma.consultaRues.findUnique({
      where: { id },
      select: { intentos: true, nit: true },
    });
    if (!c) return;

    if (resultado.estado === 'FALLO') {
      const seRinde = c.intentos >= INTENTOS_MAXIMOS;
      await this.prisma.consultaRues.update({
        where: { id },
        data: {
          estado: seRinde ? EstadoConsultaRues.FALLIDA : EstadoConsultaRues.PENDIENTE,
          ultimoError: resultado.error.slice(0, 500),
          resueltaEn: seRinde ? new Date() : null,
        },
      });
      return;
    }

    if (resultado.estado === 'SIN_RESULTADO') {
      await this.prisma.consultaRues.update({
        where: { id },
        data: {
          estado: EstadoConsultaRues.SIN_RESULTADO,
          camposNuevos: 0,
          respuesta: resultado.crudo ? { crudo: resultado.crudo } : undefined,
          resueltaEn: new Date(),
          ultimoError: null,
        },
      });
      return;
    }

    const actual = await this.prisma.institucion.findUnique({
      where: { id: institucionId },
      select: CAMPOS_DE_LA_FICHA,
    });
    if (!actual) return;

    const campos = fichaAPropuesta(resultado.ficha, actual);
    const cuantos = Object.keys(campos).length;

    await this.prisma.$transaction(async (tx) => {
      await tx.propuestaInstitucion.deleteMany({
        where: { institucionId, fuente: 'WEB', estado: 'PENDIENTE' },
      });

      if (cuantos > 0) {
        await tx.propuestaInstitucion.create({
          data: { institucionId, fuente: 'WEB', campos },
        });
      }

      await tx.consultaRues.update({
        where: { id },
        data: {
          estado: EstadoConsultaRues.LISTA,
          // el texto tal cual + el consenso con niveles de confianza,
          // para poder discutir de dónde salió un dato y con cuánta certeza.
          respuesta: {
            ficha: resultado.ficha,
            crudo: resultado.crudo,
            consenso: consenso ?? null,
          },
          camposNuevos: cuantos,
          resueltaEn: new Date(),
          ultimoError: null,
        },
      });
    });

    this.log.log(
      cuantos > 0
        ? `NIT ${c.nit}: ${cuantos} campo(s) propuestos, esperando revisión.`
        : `NIT ${c.nit}: nada nuevo que proponer.`,
    );
  }
}
