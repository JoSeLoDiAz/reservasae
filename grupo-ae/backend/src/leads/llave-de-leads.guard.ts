/** La llave del webhook, ANTES de mirar el cuerpo. */

/// El comentario del controlador decía «la llave primero,
/// antes de mirar el cuerpo», y no se cumplía.
///
/// En Nest el orden es: guards → interceptores → PIPES →
/// handler. El `ValidationPipe` global corre antes que la
/// primera línea del método, así que quien NO tiene la llave y
/// mandaba un cuerpo cualquiera recibía un 400 con la lista
/// completa de campos que la ruta espera — que es exactamente
/// lo que ese comentario quería evitar. La comprobación estaba
/// bien pensada y en el sitio equivocado.
///
/// Un guard sí corre antes del pipe. Ahora sin llave es 401 y
/// nada más: quien la tenga verá los errores de validación,
/// quien no, no aprende ni un nombre de campo.

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { CABECERA, claveCorrecta } from './secreto-de-leads';

@Injectable()
export class LlaveDeLeadsGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const req = contexto.switchToHttp().getRequest<Request>();
    const clave = req.headers[CABECERA] as string | undefined;

    if (!claveCorrecta(clave)) {
      /// El mensaje no dice si faltaba la cabecera o si estaba
      /// mal: las dos respuestas juntas le dirían a quien
      /// prueba que la cabecera existe y cómo se llama.
      throw new UnauthorizedException('Llave de webhook inválida.');
    }
    return true;
  }
}
