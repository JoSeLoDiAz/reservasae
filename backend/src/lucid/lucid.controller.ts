/** La puerta por la que Lucid deja sus conversaciones. */

/**
 * Ruta propia, guard propio, modulo propio. NO se cuelga del
 * controlador de leads aunque se le parezca: su docblock ya lo
 * dice --«una ruta que acepta dos autenticaciones deja entrar
 * por la mas debil»--, y ademas esta puerta NO crea leads. Lucid
 * no hace gestion de leads; los leads siguen entrando por Meta.
 */

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { etiquetaDelHost } from '../admin/gremio-del-host';
import {
  LlaveDeProveedorGuard,
  type PeticionConProveedor,
} from '../integraciones/llave-de-proveedor.guard';
import { NotaDeLucidDto } from './dto';
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
  /// QUIEN LLAMA SALE DE LA LLAVE, no de una cabecera.
  ///
  /// Antes lo decia `x-origen-sistema`, que cae por defecto en
  /// «lucid»: un segundo chatbot que no la mandara chocaba
  /// contra el espacio de ids de Lucid y su conversacion se
  /// contestaba «repetido» sin escribirse. El guard ya sabe de
  /// quien es la llave; usar eso no se puede equivocar.
  @Post('notas')
  @UseGuards(LlaveDeProveedorGuard)
  @HttpCode(200)
  notas(
    @Body() dto: NotaDeLucidDto,
    @Req() pedido: PeticionConProveedor,
    @Headers('host') host?: string,
  ) {
    return this.lucid.entra(dto, pedido.proveedor ?? 'lucid', etiquetaDelHost(host));
  }
}
