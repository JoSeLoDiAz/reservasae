/** La cola de validación por buscador web. */

/// Mismo reparto que el RUI: una fila por consulta, un solo
/// hilo vaciándola, y el resultado NO entra en la ficha --
/// entra como propuesta, para que una persona la acepte campo
/// por campo. El robot nunca escribe el maestro.

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { EstadoConsultaRues } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { fichaAPropuesta } from './ficha-a-propuesta';
import {
  PROVEEDOR_WEB,
  type ProveedorWeb,
  type RespuestaWeb,
  webConectado,
} from './proveedor-web';

/// Lo que todavía no tiene respuesta.
const SIN_RESOLVER = [
  EstadoConsultaRues.PENDIENTE,
  EstadoConsultaRues.EN_CURSO,
];

/// Cuántas veces se reintenta antes de darla por perdida.
const INTENTOS_MAXIMOS = 3;

/// Los campos que la ficha necesita para poder reportarse.
const CAMPOS_DE_LA_FICHA = {
  razonSocial: true,
  nombreComercial: true,
  fechaFundacion: true,
  direccion: true,
  telefono: true,
  correo: true,
  paginaWeb: true,
  ciudadNombre: true,
  departamentoNombre: true,
  sectorEconomico: true,
  codigoCiiu: true,
  clasificacion: true,
  tamano: true,
  numeroEmpleados: true,
} as const;

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
   * No espera a nada: guardar una ficha nunca se bloquea por
   * el buscador. Si ya hay una consulta pendiente para esa
   * organización se reusa, y solo se le sube la prioridad --
   * preguntar dos veces lo mismo cuesta plata y no trae nada.
   */
  async encolar(institucionId: string, prioridad = 0): Promise<void> {
    const f = await this.prisma.institucion.findUnique({
      where: { id: institucionId },
      select: { id: true, nit: true, razonSocial: true },
    });
    if (!f) throw new NotFoundException('Esa organización ya no existe.');

    const pendiente = await this.prisma.consultaRues.findFirst({
      where: { institucionId, estado: { in: SIN_RESOLVER } },
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

    await this.prisma.consultaRues.create({
      data: { institucionId, nit: f.nit, prioridad },
    });
  }

  /// En qué va lo de una organización, para que la ficha
  /// pueda decir «consultando» en vez de quedarse muda.
  async estado(institucionId: string) {
    const ultima = await this.prisma.consultaRues.findFirst({
      where: { institucionId },
      orderBy: { creadoEn: 'desc' },
      select: {
        estado: true,
        camposNuevos: true,
        ultimoError: true,
        creadoEn: true,
        resueltaEn: true,
      },
    });

    return { conectado: webConectado(), ultima };
  }

  /// Toma una fila y la marca en curso en el mismo golpe.
  /// `SKIP LOCKED` deja que mañana corran dos trabajadores sin
  /// que los dos consulten -- y paguen -- el mismo NIT.
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
    try {
      resultado = await this.proveedor.consultar(tarea.nit);
    } catch (e) {
      resultado = { estado: 'FALLO', error: (e as Error).message };
    }

    await this.guardar(tarea.id, tarea.institucionId, resultado);
    return true;
  }

  private async guardar(
    id: string,
    institucionId: string,
    resultado: RespuestaWeb,
  ): Promise<void> {
    const c = await this.prisma.consultaRues.findUnique({
      where: { id },
      select: { intentos: true, nit: true },
    });
    if (!c) return;

    if (resultado.estado === 'FALLO') {
      // se rinde solo cuando se acabaron los intentos
      const seRinde = c.intentos >= INTENTOS_MAXIMOS;
      await this.prisma.consultaRues.update({
        where: { id },
        data: {
          estado: seRinde
            ? EstadoConsultaRues.FALLIDA
            : EstadoConsultaRues.PENDIENTE,
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
          // aunque no sirviera, queda lo que dijo: es lo único
          // que explica por qué no sirvió
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
      /// La propuesta anterior que nadie miró se va.
      ///
      /// PENDIENTE quiere decir que ningún humano la vio: dejar
      /// dos versiones del mismo NIT en la bandeja no le da más
      /// información a nadie, le enseña a aceptar sin leer. Lo
      /// que dijo el buscador queda entero en la consulta, así
      /// que la traza no se pierde.
      await tx.propuestaInstitucion.deleteMany({
        where: { institucionId, fuente: 'WEB', estado: 'PENDIENTE' },
      });

      if (cuantos > 0) {
        await tx.propuestaInstitucion.create({
          data: {
            institucionId,
            fuente: 'WEB',
            campos,
          },
        });
      }

      await tx.consultaRues.update({
        where: { id },
        data: {
          estado: EstadoConsultaRues.LISTA,
          // el texto tal cual, para poder discutir de dónde salió un dato
          respuesta: {
            ficha: resultado.ficha,
            crudo: resultado.crudo,
          },
          camposNuevos: cuantos,
          resueltaEn: new Date(),
          ultimoError: null,
        },
      });
    });

    this.log.log(
      cuantos > 0
        ? `NIT ${c.nit}: ${cuantos} campo(s) propuestos, esperando que alguien los revise.`
        : `NIT ${c.nit}: nada nuevo que proponer.`,
    );
  }
}
