/** El vigía del calendario: avisa antes de que sea tarde. */

/// Mira una vez al día si algún grupo entró en su ventana de
/// aviso con cupos sin completar, y deja la fila. No manda
/// nada: no hay canal todavía, y aunque lo hubiera, mandar y
/// registrar son dos cosas distintas -- si el correo falla,
/// la fila tiene que quedar igual.
///
/// Lo que se avisa: «al grupo 2 de AF1 en Bogotá le faltan 17
/// cupos y la inscripción cierra el lunes». Eso es lo que
/// permite liberar los turnos preferentes que la empresa no
/// alcanzó a usar.

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { PanelDeCupos } from './panel-de-cupos';

/// Una vez al día sobra: lo que se vigila es el cambio de
/// fecha, no el minuto.
const CADA = 12 * 60 * 60 * 1000;
const AL_ARRANCAR = 30_000;

@Injectable()
export class VigiaDeCupos implements OnModuleInit {
  private readonly log = new Logger('VigiaDeCupos');
  private reloj: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly panel: PanelDeCupos,
  ) {}

  onModuleInit() {
    setTimeout(() => void this.revisar(), AL_ARRANCAR).unref();
    this.reloj = setInterval(() => void this.revisar(), CADA);
    this.reloj.unref();
  }

  onModuleDestroy() {
    if (this.reloj) clearInterval(this.reloj);
  }

  /**
   * Deja un aviso por cada grupo que lo necesite.
   *
   * Es idempotente: la clave única de la tabla es el grupo
   * más su fecha de arranque, así que correrlo diez veces
   * deja un aviso, no diez. Y si el cronograma se corre, la
   * fecha cambia y nace un aviso nuevo, que es lo correcto:
   * el viejo hablaba de otro calendario.
   */
  async revisar(hoy = new Date()): Promise<number> {
    const pendientes = await this.panel.porAvisar(hoy);
    if (pendientes.length === 0) return 0;

    let nuevos = 0;
    for (const g of pendientes) {
      if (!g.ventana.fechaInicio || !g.ventana.cierre || !g.ventana.aviso) continue;

      const ya = await this.prisma.avisoDeCupos.findUnique({
        where: {
          coberturaId_fechaInicioGrupo: {
            coberturaId: g.coberturaId,
            fechaInicioGrupo: g.ventana.fechaInicio,
          },
        },
        select: { id: true },
      });

      if (ya) {
        // el aviso ya existe, pero los números se mueven:
        // alguien pudo inscribirse ayer
        await this.prisma.avisoDeCupos.update({
          where: { id: ya.id },
          data: { inscritos: g.inscritos, faltan: g.faltan },
        });
        continue;
      }

      await this.prisma.avisoDeCupos.create({
        data: {
          coberturaId: g.coberturaId,
          fechaInicioGrupo: g.ventana.fechaInicio,
          avisarEn: g.ventana.aviso,
          cierreEn: g.ventana.cierre,
          cuposMaximos: g.cuposMaximos,
          inscritos: g.inscritos,
          faltan: g.faltan,
        },
      });
      nuevos += 1;
    }

    if (nuevos > 0) {
      this.log.warn(
        `${nuevos} grupo(s) con cupos sin completar y la inscripción por cerrar. ` +
          'Están en la cola de avisos.',
      );
    }
    return nuevos;
  }

  /** Los avisos que nadie ha atendido todavía. */
  async sinAtender(convenios: string[]) {
    const filas = await this.prisma.avisoDeCupos.findMany({
      where: {
        atendidoEn: null,
        cobertura: {
          grupo: { accionFormacion: { convenioId: { in: convenios } } },
        },
      },
      orderBy: { cierreEn: 'asc' },
      select: {
        id: true,
        avisarEn: true,
        cierreEn: true,
        cuposMaximos: true,
        inscritos: true,
        faltan: true,
        enviadoEn: true,
        cobertura: {
          select: {
            ubicacion: { select: { nombre: true } },
            grupo: {
              select: {
                numero: true,
                fechaInicio: true,
                accionFormacion: { select: { codigo: true, nombre: true } },
              },
            },
          },
        },
      },
    });

    return filas.map((f) => ({
      id: f.id,
      accion: `${f.cobertura.grupo.accionFormacion.codigo} · ${f.cobertura.grupo.accionFormacion.nombre}`,
      grupo: f.cobertura.grupo.numero,
      ubicacion: f.cobertura.ubicacion.nombre,
      arranca: f.cobertura.grupo.fechaInicio,
      cierra: f.cierreEn,
      cuposMaximos: f.cuposMaximos,
      inscritos: f.inscritos,
      faltan: f.faltan,
      /// Null quiere decir que todavía no salió por ningún
      /// canal: hoy no hay correo ni WhatsApp montados.
      enviadoEn: f.enviadoEn,
    }));
  }

  /** Alguien lo atendió: liberó los cupos o los completó. */
  async marcarAtendido(id: string) {
    await this.prisma.avisoDeCupos.update({
      where: { id },
      data: { atendidoEn: new Date() },
    });
  }
}
