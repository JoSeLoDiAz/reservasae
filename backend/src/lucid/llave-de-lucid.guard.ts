/** El 401 antes de mirar el cuerpo. */

/// Va en un GUARD y no dentro del metodo por lo mismo que el de
/// leads: el ValidationPipe corre DESPUES del guard, asi que sin
/// llave se contesta 401 pelado y no un 400 con la lista de
/// campos que la ruta espera.

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { CABECERA, claveCorrecta, hayLlaveDeLucid } from './secreto-de-lucid';

@Injectable()
export class LlaveDeLucidGuard implements CanActivate {
  private readonly log = new Logger('Lucid');
  /// Cuantas se rechazaron y cuando se conto la ultima vez.
  private rechazadas = 0;
  private ultimoAviso = 0;

  canActivate(contexto: ExecutionContext): boolean {
    const pedido = contexto.switchToHttp().getRequest<Request>();
    const llave = pedido.headers[CABECERA];

    if (claveCorrecta(typeof llave === 'string' ? llave : undefined)) return true;

    this.gritar();
    // el mismo mensaje mudo para llave mala y para llave
    // ausente: distinguirlos dice si la cabecera existe
    throw new UnauthorizedException('Llave de webhook inválida.');
  }

  /// Las notas de Lucid no tienen contador natural: nadie sabe
  /// cuantas deberia haber hoy. Asi que lo que se cuenta son
  /// los RECHAZOS, y el aviso se hace mas fuerte cuanto mas
  /// insista ella -- al reves de un fallo silencioso.
  private gritar(): void {
    this.rechazadas += 1;
    const ahora = Date.now();
    if (ahora - this.ultimoAviso < 60_000) return;
    this.ultimoAviso = ahora;

    const porque = hayLlaveDeLucid()
      ? 'la llave que llega no es la buena'
      : 'NO hay LUCID_WEBHOOK_SECRET configurada';
    this.log.warn(
      `Rechazadas ${this.rechazadas} llamadas de Lucid: ${porque}. ` +
        'Esas conversaciones no quedan como nota en ningún lead.',
    );
  }
}
