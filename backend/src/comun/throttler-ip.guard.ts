import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

import { ipReal } from './ip-real';

/**
 * El límite por defecto de @nestjs/throttler usa `req.ip`, que detrás del
 * túnel de Cloudflare es siempre la IP de la red de Docker: todo el mundo
 * contaría como un único visitante y el límite saltaría con dos personas
 * usando el formulario a la vez.
 *
 * Importa especialmente aquí porque para editar una reserva basta con saber el
 * NIT, y el NIT es público: sin límite por IP real, probar NITs en masa sale
 * gratis.
 */
@Injectable()
export class ThrottlerIpGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    return Promise.resolve(ipReal(req));
  }
}
