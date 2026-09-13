/** La puerta por la que Lucy deja sus conversaciones. */

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
import { NotaDeLucyDto } from './dto';
import { LlaveDeLucyGuard } from './llave-de-lucy.guard';
import { LucyService } from './lucy.service';

/// Mismo techo que la puerta de leads y por lo mismo: por aqui
/// entra un chatbot, y lo que el limitador corta se PIERDE.
/// Mauricio pidio al menos 200 por minuto.
@Throttle({ default: { limit: 300, ttl: 60_000 } })
@Controller('webhooks/lucy')
export class LucyController {
  constructor(private readonly lucy: LucyService) {}

  /// 200 y no 201: se contesta lo mismo si es nueva y si ya
  /// habia llegado.
  @Post('notas')
  @UseGuards(LlaveDeLucyGuard)
  @HttpCode(200)
  notas(
    @Body() dto: NotaDeLucyDto,
    @Headers('host') host?: string,
    @Headers('x-origen-sistema') origen?: string,
  ) {
    const sistema = (origen ?? 'lucy').trim().slice(0, 80) || 'lucy';
    return this.lucy.entra(dto, sistema, etiquetaDelHost(host));
  }
}
