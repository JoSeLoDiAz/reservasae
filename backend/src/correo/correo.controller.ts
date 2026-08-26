/** Ver si el correo sale, desde el panel. */

/// Sin esto, la única forma de saber si el correo funciona
/// era abrir una consola y correr un script. Quien administra
/// esto no tiene por qué hacer eso para saber si una alerta
/// va a llegar o se va a perder en silencio.

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { Admin } from '../../generated/prisma';
import { AdminActual } from '../admin/admin-actual.decorator';
import { AdminGuard, Requiere } from '../admin/admin.guard';
import { CorreoService, correoConectado } from './correo.service';
import { desvioConfigurado } from './desvio';
import { ProbarCorreoDto } from './dto';

@Controller('admin/correo')
@UseGuards(AdminGuard)
@Requiere('configuracion', 'ESCRIBIR')
export class CorreoController {
  constructor(private readonly correo: CorreoService) {}

  /**
   * Cómo está configurado, y si el servidor lo acepta.
   *
   * NO devuelve la clave ni un pedazo de ella. Solo si está
   * puesta: quien mira esta pantalla necesita saber que hay
   * una, no cuál es.
   */
  @Get('estado')
  async estado() {
    const configurado = correoConectado();
    const prueba = configurado ? await this.correo.probar() : null;

    return {
      configurado,
      servidor: process.env.SMTP_SERVIDOR ?? null,
      puerto: Number(process.env.SMTP_PUERTO ?? 587),
      usuario: process.env.SMTP_USUARIO ?? null,
      remitente: process.env.SMTP_DESDE ?? process.env.SMTP_USUARIO ?? null,
      nombre: process.env.SMTP_NOMBRE ?? 'Convoca',
      tieneClave: Boolean(process.env.SMTP_CLAVE),
      /// Si todo se desvía, hay que verlo aquí: si no, la
      /// pantalla diría que el correo sale y nadie sabría
      /// que no llega a su destinatario.
      desviadoA: desvioConfigurado(),
      esPrueba: process.env.ENTORNO === 'prueba',
      /// Si el servidor lo dejó entrar ahora mismo, no cuando
      /// se configuró: una clave revocada se ve aquí.
      acepta: prueba?.estado === 'ENVIADO',
      error: prueba?.estado === 'FALLO' ? prueba.error : null,
    };
  }

  /** Manda uno de prueba a donde le digan. */
  @Post('probar')
  async probar(@Body() dto: ProbarCorreoDto, @AdminActual() admin: Admin) {
    if (!correoConectado()) {
      throw new BadRequestException(
        'El correo no está configurado en el servidor.',
      );
    }

    const r = await this.correo.enviar({
      para: dto.para,
      asunto: 'Convoca · prueba de correo',
      texto:
        `Si está leyendo esto, el correo de Convoca quedó funcionando.\n\n` +
        `Lo mandó ${admin.nombre} desde el panel. No hay que contestarlo.\n`,
      html:
        '<p>Si está leyendo esto, el correo de <strong>Convoca</strong> quedó ' +
        'funcionando.</p>' +
        `<p style="color:#666;font-size:13px">Lo mandó ${admin.nombre} desde el ` +
        'panel. No hay que contestarlo.</p>',
    });

    if (r.estado === 'FALLO') throw new BadRequestException(r.error);
    if (r.estado === 'APAGADO') {
      throw new BadRequestException('El correo está apagado en el servidor.');
    }

    /// `para` es a donde FUE, no a donde se pidió: con el
    /// desvío puesto no son lo mismo, y decir el pedido
    /// haría creer que le llegó a esa persona.
    return {
      enviado: true,
      para: r.para,
      pedido: dto.para,
      desviado: r.desviado,
      id: r.id,
    };
  }
}
