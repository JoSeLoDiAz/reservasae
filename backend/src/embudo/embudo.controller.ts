/** La puerta por la que el formulario público marca sus pasos. */

import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { MarcarPasoDto } from './dto';
import { EmbudoService } from './embudo.service';

/// 300 por minuto y no 60, y el cubo es POR MANEJADOR: los
/// beacons no pueden comerse la cuota de `registrar`. El techo
/// sube porque la pauta llega tras el CGNAT de los operadores
/// móviles, donde muchos abonados comparten una IP de salida.
@Throttle({ default: { limit: 300, ttl: 60_000 } })
@Controller('preinscripcion')
export class EmbudoController {
  constructor(private readonly embudo: EmbudoService) {}

  /// 204 SIEMPRE, y sin cuerpo. Medir no puede romper el
  /// formulario, y un slug desconocido no puede ser un oráculo.
  @Post(':slug/paso')
  @HttpCode(204)
  async paso(@Param('slug') slug: string, @Body() dto: MarcarPasoDto): Promise<void> {
    await this.embudo.marcar(slug, dto);
  }
}
