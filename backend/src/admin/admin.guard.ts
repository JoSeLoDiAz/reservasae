import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import type { Admin, RolAdmin } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

export const COOKIE_SESION = 'convoca_sesion';

/** Rutas marcadas así no exigen sesión. */
export const PUBLICA = 'ruta_publica';
export const Publica = () => SetMetadata(PUBLICA, true);

/** Rutas marcadas así se pueden usar aún debiendo cambiar la contraseña. */
export const PERMITIDA_SIN_CAMBIAR_CLAVE = 'sin_cambiar_clave';
export const PermitidaSinCambiarClave = () =>
  SetMetadata(PERMITIDA_SIN_CAMBIAR_CLAVE, true);

export const ROLES = 'roles_admin';
export const Roles = (...roles: RolAdmin[]) => SetMetadata(ROLES, roles);

export type PeticionConAdmin = Request & { admin?: Admin };

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publica) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionConAdmin>();
    const token = (peticion.cookies as Record<string, string> | undefined)?.[COOKIE_SESION];
    if (!token) {
      throw new UnauthorizedException('Inicie sesión para continuar.');
    }

    let sujeto: string;
    try {
      sujeto = this.jwt.verify<{ sub: string }>(token).sub;
    } catch {
      throw new UnauthorizedException('Su sesión expiró. Vuelva a iniciar sesión.');
    }

    // se relee en cada peticion: desactivar corta ya
    const admin = await this.prisma.admin.findUnique({ where: { id: sujeto } });
    if (!admin || !admin.activo) {
      throw new UnauthorizedException('La cuenta ya no está activa.');
    }
    peticion.admin = admin;

    const sinCambiar = this.reflector.getAllAndOverride<boolean>(
      PERMITIDA_SIN_CAMBIAR_CLAVE,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (admin.debeCambiarClave && !sinCambiar) {
      throw new ForbiddenException({
        message: 'Debe cambiar su contraseña antes de continuar.',
        debeCambiarClave: true,
      });
    }

    const roles = this.reflector.getAllAndOverride<RolAdmin[]>(ROLES, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (roles?.length && !roles.includes(admin.rol)) {
      throw new ForbiddenException('No tiene permiso para esta operación.');
    }

    return true;
  }
}
