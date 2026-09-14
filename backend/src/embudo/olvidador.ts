/** Borra los pasos de visita pasados los 90 días. */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/// Tres meses: dos campañas completas caben de sobra, y pasado
/// eso el dato ya no cambia ninguna decisión.
export const DIAS_QUE_SE_GUARDAN = 90;

const CADA = 12 * 60 * 60 * 1000;
const AL_ARRANCAR = 60_000;

export function limiteDelOlvido(hoy = new Date()): Date {
  return new Date(hoy.getTime() - DIAS_QUE_SE_GUARDAN * 24 * 60 * 60 * 1000);
}

@Injectable()
export class OlvidadorDePasos implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Embudo');
  private reloj: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    setTimeout(() => void this.olvidar(), AL_ARRANCAR).unref();
    this.reloj = setInterval(() => void this.olvidar(), CADA);
    this.reloj.unref();
  }

  onModuleDestroy() {
    if (this.reloj) clearInterval(this.reloj);
  }

  async olvidar(hoy = new Date()): Promise<number> {
    const { count } = await this.prisma.pasoDeVisita.deleteMany({
      where: { creadoEn: { lt: limiteDelOlvido(hoy) } },
    });
    if (count > 0) {
      this.log.log(`Olvidados ${count} pasos de más de ${DIAS_QUE_SE_GUARDAN} días.`);
    }
    return count;
  }
}
