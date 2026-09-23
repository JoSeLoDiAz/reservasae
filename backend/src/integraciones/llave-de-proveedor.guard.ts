/** El 401 antes de mirar el cuerpo, y quien entro. */

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

import {
  CABECERA,
  CABECERA_VIEJA,
  hayAlgunaLlave,
  proveedorDeLaClave,
  proveedoresConLlave,
  type Proveedor,
} from './proveedores';

/// Lo que el guard deja escrito para que lo lea el controlador.
/// Va en la peticion y no en un parametro porque el proveedor
/// lo decide la LLAVE, y la llave solo la ve el guard.
export type PeticionConProveedor = Request & { proveedor?: Proveedor };

@Injectable()
export class LlaveDeProveedorGuard implements CanActivate {
  private readonly log = new Logger('Integraciones');
  /// Cuantas se rechazaron y cuando se conto la ultima vez.
  private rechazadas = 0;
  private ultimoAviso = 0;

  canActivate(contexto: ExecutionContext): boolean {
    const pedido = contexto.switchToHttp().getRequest<PeticionConProveedor>();
    const llave = pedido.headers[CABECERA] ?? pedido.headers[CABECERA_VIEJA];
    const quien = proveedorDeLaClave(typeof llave === 'string' ? llave : undefined);

    if (quien) {
      pedido.proveedor = quien;
      return true;
    }

    this.gritar();
    // el mismo mensaje mudo para llave mala y para llave
    // ausente: distinguirlos dice si la cabecera existe
    throw new UnauthorizedException('Llave de webhook inválida.');
  }

  /// Estas puertas no tienen contador natural: nadie sabe
  /// cuantas conversaciones deberia haber hoy. Asi que lo que
  /// se cuenta son los RECHAZOS, y el aviso se hace mas fuerte
  /// cuanto mas insista quien llama -- al reves de un fallo
  /// silencioso.
  private gritar(): void {
    this.rechazadas += 1;
    const ahora = Date.now();
    if (ahora - this.ultimoAviso < 60_000) return;
    this.ultimoAviso = ahora;

    const porque = hayAlgunaLlave()
      ? `la llave que llega no es de ninguno de: ${proveedoresConLlave().join(', ')}`
      : 'NO hay ninguna llave de integración configurada';
    this.log.warn(
      `Rechazadas ${this.rechazadas} llamadas de integración: ${porque}. ` +
        'Esas conversaciones no quedan como nota en ninguna ficha.',
    );
  }
}
