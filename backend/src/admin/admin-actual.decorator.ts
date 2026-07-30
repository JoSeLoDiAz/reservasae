import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { Admin } from '../../generated/prisma';
import type { PeticionConAdmin } from './admin.guard';

/** El administrador que `AdminGuard` ya cargó de la base para esta petición. */
export const AdminActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): Admin => {
    const peticion = contexto.switchToHttp().getRequest<PeticionConAdmin>();
    if (!peticion.admin) {
      // Solo pasa si alguien pone @AdminActual en una ruta @Publica.
      throw new Error('AdminActual usado en una ruta sin sesión.');
    }
    return peticion.admin;
  },
);
