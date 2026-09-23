/** La puerta de LECTURA para los chatbots. */

/**
 * Es la primera ruta del sistema que DEVUELVE datos de una
 * persona a una maquina de fuera. Todo lo que habia hasta hoy
 * hacia afuera escribe: leads, Meta y las notas.
 *
 * Por eso vive en su propio prefijo y no colgada de `/admin`:
 * alli el guard relee al administrador de la base en cada
 * peticion, y aqui no hay administrador que releer. Mezclarlas
 * seria hacer que una ruta acepte dos autenticaciones, que es
 * como se entra por la mas debil.
 *
 * Y por eso devuelve lo MINIMO: si existe, su primer nombre, su
 * etapa, su curso y que le falta. Nunca la ficha, nunca la
 * cedula, nunca la direccion.
 */

import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { etiquetaDelHost } from '../admin/gremio-del-host';
import { IntegracionesService } from './integraciones.service';
import { LlaveDeProveedorGuard } from './llave-de-proveedor.guard';

/// Mismo techo que las otras dos puertas de integracion: por
/// aqui pregunta un chatbot en cada conversacion que empieza, y
/// los 60 generales se los comeria en una mañana.
@Throttle({ default: { limit: 300, ttl: 60_000 } })
@Controller('integraciones')
@UseGuards(LlaveDeProveedorGuard)
export class IntegracionesController {
  constructor(private readonly integraciones: IntegracionesService) {}

  /// El gremio lo afirma la direccion, como en todo el sistema;
  /// por la puerta general se manda `convenio`.
  @Get('persona')
  persona(
    @Query('telefono') telefono?: string,
    @Query('documento') documento?: string,
    @Query('convenio') convenio?: string,
    @Headers('host') host?: string,
  ) {
    return this.integraciones.reconocer(
      etiquetaDelHost(host) ?? convenio ?? null,
      telefono,
      documento,
    );
  }
}
