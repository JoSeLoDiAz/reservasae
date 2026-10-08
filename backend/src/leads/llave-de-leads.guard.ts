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

import { proveedorDeLaClave, type Proveedor } from '../integraciones/proveedores';
import { CABECERA, claveCorrecta } from './secreto-de-leads';

/// La peticion, con el proveedor que la llave identifico.
export type PeticionDeLead = Request & { proveedorDelLead?: Proveedor };

@Injectable()
export class LlaveDeLeadsGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const req = contexto.switchToHttp().getRequest<PeticionDeLead>();
    const clave = req.headers[CABECERA] as string | undefined;

    /**
     * DOS LLAVES VALEN, Y NO SON LO MISMO.
     *
     * La del orquestador (`LEADS_WEBHOOK_SECRET`) sigue eligiendo
     * su etiqueta por cabecera, y hace bien: ese servicio nos
     * RELEVA leads de varias procedencias, asi que es el unico que
     * de verdad sabe de donde viene cada uno.
     *
     * La de un PROVEEDOR ---Lucid, Nua--- no elige: su etiqueta la
     * pone el registro del servidor. De esa etiqueta depende si el
     * lead cuenta como pauta pagada, y dejarsela elegir a quien
     * llama es lo que `leads.service` prohibe por escrito: «lo
     * decide QUIEN LO MANDA, no el cuerpo».
     *
     * Se prueban las de proveedor DESPUES: la del orquestador es la
     * que lleva meses entrando, y asi su camino no cambia de orden.
     */
    if (claveCorrecta(clave)) return true;

    const proveedor = proveedorDeLaClave(clave);
    if (proveedor) {
      req.proveedorDelLead = proveedor;
      return true;
    }

    /// El mensaje no dice si faltaba la cabecera o si estaba
    /// mal: las dos respuestas juntas le dirían a quien
    /// prueba que la cabecera existe y cómo se llama.
    throw new UnauthorizedException('Llave de webhook inválida.');
  }
}