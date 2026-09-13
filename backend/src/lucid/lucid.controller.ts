/** La puerta por la que Lucid deja sus conversaciones. */

/**
 * Ruta propia, guard propio, modulo propio. NO se cuelga del
 * controlador de leads aunque se le parezca: su docblock ya lo
 * dice --«una ruta que acepta dos autenticaciones deja entrar
 * por la mas debil»--, y ademas esta puerta NO crea leads. Lucid
 * no hace gestion de leads; los leads siguen entrando por Meta.
 */

import { Body, Controller, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { etiquetaDelHost } from '../admin/gremio-del-host';
import { NotaDeLucidDto } from './dto';
import { LlaveDeLucidGuard } from './llave-de-lucid.guard';
import { LucidService } from './lucid.service';

/// Mismo techo que la puerta de leads y por lo mismo: por aqui
/// entra un chatbot, y lo que el limitador corta se PIERDE.
/// Mauricio pidio al menos 200 por minuto.
@Throttle({ default: { limit: 300, ttl: 60_000 } })
@Controller('webhooks/lucid')
export class LucidController {
  constructor(private readonly lucid: LucidService) {}

  /// 200 y no 201: se contesta lo mismo si es nueva y si ya
  /// habia llegado.
  @Post('notas')
  @UseGuards(LlaveDeLucidGuard)
  @HttpCode(200)
  notas(
    @Body() dto: NotaDeLucidDto,
    @Headers('host') host?: string,
    @Headers('x-origen-sistema') origen?: string,
  ) {
    const sistema = (origen ?? 'lucid').trim().slice(0, 80) || 'lucid';
    return this.lucid.entra(dto, sistema, etiquetaDelHost(host));
  }
}
