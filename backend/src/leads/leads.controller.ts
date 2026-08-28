/** La puerta por la que entran los leads. */

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { EntraLeadDto } from './dto';
import { LeadsService } from './leads.service';
import { CABECERA, claveCorrecta } from './secreto-de-leads';

/**
 * Cuelga de `/webhooks` y NO del panel: no lleva sesión, la
 * llave viaja en una cabecera. Por eso vive en su propio módulo
 * y no dentro del CRM — para que se vea desde fuera que esta
 * ruta escribe sin `AdminGuard`.
 */
@Controller('webhooks/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /**
   * Entra un lead.
   *
   * 200 y no 201: se contesta lo mismo cuando el lead es nuevo y
   * cuando ya estaba, y `repetido` lo dice. Un 201 en el segundo
   * caso sería mentir sobre lo que pasó.
   */
  @Post()
  @HttpCode(200)
  async entra(
    @Body() dto: EntraLeadDto,
    @Headers(CABECERA) clave: string | undefined,
    @Headers('x-origen-sistema') origen: string | undefined,
  ) {
    /// La llave primero, antes de mirar el cuerpo.
    ///
    /// Validar el DTO antes diría, con sus mensajes de error, qué
    /// campos espera esta ruta a quien no tiene la llave.
    if (!claveCorrecta(clave)) {
      throw new UnauthorizedException('Llave de webhook inválida.');
    }

    /// Quien lo manda, para la idempotencia. Por defecto el
    /// orquestador, que hoy es el unico.
    const sistema =
      (origen ?? 'orquestador').trim().slice(0, 80) || 'orquestador';

    return this.leads.entra(dto, sistema);
  }
}
