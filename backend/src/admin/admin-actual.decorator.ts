import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { Admin } from '../../generated/prisma';
import type { Ambito, PeticionConAdmin } from './admin.guard';

/** El administrador cargado por AdminGuard. */
export const AdminActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): Admin => {
    const peticion = contexto.switchToHttp().getRequest<PeticionConAdmin>();
    if (!peticion.admin) {
      // ruta pública mal decorada
      throw new Error('AdminActual usado en una ruta sin sesión.');
    }
    return peticion.admin;
  },
);

/** Los convenios que esta cuenta puede ver. */
export const AmbitoActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): Ambito => {
    const peticion = contexto.switchToHttp().getRequest<PeticionConAdmin>();
    if (!peticion.ambito) {
      throw new Error('AmbitoActual usado en una ruta sin sesión.');
    }
    return peticion.ambito;
  },
);
