import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  getOptionsToken,
  getStorageToken,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';

import { COOKIE_SESION } from '../admin/admin.guard';
import { ipReal } from './ip-real';

/**
 * Limita por SESIÓN cuando hay sesión, y por IP cuando no.
 *
 * Contaba solo por IP, y en una oficina eso es un cubo COMPARTIDO: las
 * cinco gestoras de ADECOPRIA salen por la misma dirección, así que
 * entre todas tenían 60 peticiones por minuto. Una pantalla del panel
 * se come varias nada más abrirse ---la tira, el resumen, las dos
 * tablas, la cuenta de avisos--- y cada bloque se refresca solo cada
 * treinta segundos. Con dos pestañas abiertas y tres personas
 * trabajando, el límite salta sin que nadie esté abusando: las
 * respuestas se van en 429 y la pantalla se queda a medias, que es
 * parte de lo que el cliente reporta como que no es confiable.
 *
 * La sesión es lo que de verdad identifica a quien pide: dos
 * compañeras en la misma oficina tienen cookies distintas.
 *
 * Y SE VERIFICA LA FIRMA, no basta con que la cookie esté. Tomando el
 * valor tal cual, cualquiera podría mandar una cookie inventada y
 * distinta en cada petición y estrenar cubo cada vez, que es
 * exactamente el abuso que este guardia existe para frenar. Verificar
 * es un HMAC sobre unos pocos bytes: no toca la base ni el disco.
 *
 * Lo que no trae sesión válida ---el formulario público, el sitio, una
 * cookie caducada--- sigue contando por IP, que ahí es lo correcto:
 * son visitantes anónimos y lo que hay que acotar es el origen.
 */
@Injectable()
export class ThrottlerIpGuard extends ThrottlerGuard {
  constructor(
    /// Los tokens se piden con los ayudantes del paquete: la
    /// constante de las opciones no sale de su `index`, y la del
    /// almacén es un símbolo que Nest no puede inferir del tipo.
    @Inject(getOptionsToken()) opciones: ThrottlerModuleOptions,
    @Inject(getStorageToken()) almacen: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
  ) {
    super(opciones, almacen, reflector);
  }

  protected getTracker(req: Request): Promise<string> {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      COOKIE_SESION
    ];
    if (token) {
      try {
        const sujeto = this.jwt.verify<{ sub: string }>(token).sub;
        if (sujeto) return Promise.resolve(`sesion:${sujeto}`);
      } catch {
        /// Caducada o falsa: cuenta como anónima, por IP.
      }
    }
    return Promise.resolve(`ip:${ipReal(req)}`);
  }
}
