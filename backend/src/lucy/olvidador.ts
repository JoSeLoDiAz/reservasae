/** Borra las conversaciones de nadie pasados los 60 dias. */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { EstadoConversacion } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { DIAS_QUE_SE_GUARDAN, limiteDelOlvido } from './olvido';

/// Una vez al dia basta: lo que se mide en dias no necesita un
/// reloj de minutos. Mismo criterio que el vigia de cupos.
const CADA = 12 * 60 * 60 * 1000;
const AL_ARRANCAR = 45_000;

@Injectable()
export class OlvidadorDeConversaciones implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Lucy');
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

  /// Se dice lo que se borra. Un borrado callado es
  /// indistinguible de que nunca llegara nada.
  async olvidar(hoy = new Date()): Promise<number> {
    const { count } = await this.prisma.conversacionEntrante.deleteMany({
      where: {
        estado: EstadoConversacion.SIN_DUENO,
        recibidoEn: { lt: limiteDelOlvido(hoy) },
      },
    });

    if (count > 0) {
      this.log.log(
        `Olvidadas ${count} conversaciones sin dueño de más de ${DIAS_QUE_SE_GUARDAN} días.`,
      );
    }
    return count;
  }
}
