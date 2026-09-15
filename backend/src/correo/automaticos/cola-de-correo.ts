/** Poner en cola un correo que sale solo. */

/// Vive aparte del servicio que lo manda, igual que
/// `ColaRui`: encolar no es mas que escribir una fila. Quien
/// encola no tiene que saber nada de plantillas, de SMTP ni
/// del desvio, y sobre todo no tiene que esperar a ninguna
/// de las tres cosas.

import { Injectable, Logger } from '@nestjs/common';

import { MotivoDeCorreoAutomatico } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ColaDeCorreo {
  private readonly log = new Logger('ColaDeCorreo');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deja la fila y devuelve. NUNCA lanza.
   *
   * Lo llama la puerta publica justo despues de crear la
   * ficha: si encolar fallara hacia arriba, alguien que ya
   * quedo preinscrito recibiria un 500 por un correo.
   *
   * El `@@unique([participanteId, motivo])` hace el resto:
   * registrarse dos veces, o un reintento del POST, chocan
   * contra la llave y no encolan un segundo acuse.
   */
  async encolar(
    participanteId: string,
    convenioId: string,
    motivo: MotivoDeCorreoAutomatico,
  ): Promise<void> {
    try {
      await this.prisma.correoAutomatico.create({
        data: { participanteId, convenioId, motivo },
      });
    } catch (e) {
      // P2002 es el duplicado, y es el caso bueno
      const codigo = (e as { code?: string }).code;
      if (codigo === 'P2002') return;
      this.log.warn(
        `No se pudo encolar el correo de ${motivo}: ` +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  }
}
