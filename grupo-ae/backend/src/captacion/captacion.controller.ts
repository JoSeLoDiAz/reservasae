import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { IpReal } from '../comun/ip-real';
import { CaptacionService } from './captacion.service';
import { CaptarDto } from './dto';

/**
 * Público: no lleva guard. Nadie ha entrado todavía.
 *
 * Dos rutas y nada más: pintar el formulario y recibirlo. Todo lo
 * que se hace con lo recibido —ver el negocio, moverlo, cerrarlo—
 * vive detrás de `AdminGuard` en `admin/oportunidades`. Que la
 * puerta pública sea tan estrecha es lo que permite razonar sobre
 * ella.
 *
 * El límite por IP lo cuenta `ThrottlerIpGuard`, que lee la IP real
 * de Cloudflare: sin él, todas las peticiones parecerían venir del
 * proxy y el límite se agotaría con la primera persona.
 */
@Controller('captacion')
export class CaptacionController {
  constructor(private readonly captacion: CaptacionService) {}

  /// Se pinta una vez por visita, y la misma pantalla se recarga
  /// mientras alguien la llena. Treinta deja trabajar y corta a
  /// quien esté recorriendo slugs para averiguar qué formularios
  /// tenemos publicados.
  @Get(':slug')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  formulario(@Param('slug') slug: string) {
    return this.captacion.formulario(slug);
  }

  /**
   * Diez por minuto y por IP, el mismo límite que una reserva.
   *
   * No es el candado contra los duplicados —ese es `no-duplicar.ts`,
   * y trabaja por cliente y no por IP— sino contra el que quiera
   * llenar el tablero de basura. Diez deja sitio a los reintentos de
   * una persona impaciente y a varias personas de una misma oficina,
   * que salen todas por la misma dirección.
   */
  @Post(':slug')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  captar(
    @Param('slug') slug: string,
    @Body() dto: CaptarDto,
    @IpReal() ip: string,
  ) {
    /// La IP se guarda con la autorización: es parte de la prueba de
    /// que esa persona la dio, y sin ella la constancia dice mucho
    /// menos.
    return this.captacion.captar(slug, dto, ip);
  }
}
