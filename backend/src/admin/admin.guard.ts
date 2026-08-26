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

import type { Admin, RolAdmin, RolConvenio } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { alcanza, nivelDe, type Area, type Nivel } from './permisos';

export const COOKIE_SESION = 'convoca_sesion';

/** Rutas marcadas así no exigen sesión. */
export const PUBLICA = 'ruta_publica';
export const Publica = () => SetMetadata(PUBLICA, true);

/** Rutas usables sin cambiar la clave. */
export const PERMITIDA_SIN_CAMBIAR_CLAVE = 'sin_cambiar_clave';
export const PermitidaSinCambiarClave = () =>
  SetMetadata(PERMITIDA_SIN_CAMBIAR_CLAVE, true);

export const ROLES = 'roles_admin';
export const Roles = (...roles: RolAdmin[]) => SetMetadata(ROLES, roles);

export const AREA = 'area_requerida';

/**
 * Qué área toca esta ruta y con qué nivel. Además de
 * negar el paso, recorta el ámbito a los convenios donde
 * de verdad alcanza ese nivel: así quien lleva académico
 * en un convenio e inscripciones en el otro no puede
 * escribir inscripciones en el primero ni por la API.
 */
export const Requiere = (area: Area | Area[], nivel: Nivel = 'VER') =>
  SetMetadata(AREA, { areas: Array.isArray(area) ? area : [area], nivel });

/**
 * A qué convenios tiene acceso, resuelto en el guard.
 * Sin fila en AdminConvenio no se ve nada de ese convenio:
 * la concesión es explícita, nunca por omisión.
 */
export type Ambito = {
  /// Los ids que alcanza para lo que pide esta ruta.
  convenios: string[];
  /// Un superadmin con filas en los dos los ve los dos.
  todos: boolean;
  /// Qué roles tiene en cada convenio. La misma persona
  /// puede llevar áreas distintas en cada uno.
  roles: Record<string, RolConvenio[]>;
  /// El gremio que se eligió arriba en el panel, si eligió
  /// uno. Null es «todos los que pueda ver».
  gremioElegido: string | null;
  /// Todos los que le concede su cuenta, sin recortar por el
  /// gremio elegido: es lo que llena el desplegable.
  concedidos: string[];
};

/// La cabecera con la que el panel dice de qué gremio está
/// hablando.
///
/// Va por cabecera y no por parámetro de cada consulta a
/// propósito: así el recorte se aplica UNA vez, aquí, y
/// ninguna pantalla puede olvidarlo. Es la misma razón por la
/// que el ámbito se resuelve en el guard y no en cada
/// servicio.
export const CABECERA_GREMIO = 'x-gremio';

export type PeticionConAdmin = Request & { admin?: Admin; ambito?: Ambito };

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

    // se relee en cada petición
    const admin = await this.prisma.admin.findUnique({ where: { id: sujeto } });
    if (!admin || !admin.activo) {
      throw new UnauthorizedException('La cuenta ya no está activa.');
    }
    peticion.admin = admin;

    // el ambito se resuelve aqui y no en cada consulta:
    // olvidarlo en una sola deja escapar el otro convenio
    const concesiones = await this.prisma.adminConvenio.findMany({
      where: { adminId: admin.id },
      select: { convenioId: true, rol: true },
    });
    const roles: Record<string, RolConvenio[]> = {};
    for (const c of concesiones) {
      (roles[c.convenioId] ??= []).push(c.rol);
    }
    const concedidos = Object.keys(roles);
    const activos = await this.prisma.convenio.count({ where: { activo: true } });

    const exigido = this.reflector.getAllAndOverride<{ areas: Area[]; nivel: Nivel }>(
      AREA,
      [contexto.getHandler(), contexto.getClass()],
    );

    // sin @Requiere valen todos los concedidos; con el,
    // solo aquellos donde el rol alcanza el nivel pedido
    // varias areas = basta con alcanzar en una: cambiar de
    // etapa es de inscripciones y tambien de academico
    const convenios = exigido
      ? concedidos.filter((id) =>
          exigido.areas.some((a) => alcanza(nivelDe(roles[id], a), exigido.nivel)),
        )
      : concedidos;

    // el gremio elegido RECORTA, nunca amplía: si pide uno
    // que su cuenta no le concede, se ignora y se queda con
    // todo lo suyo. Un encabezado no puede dar acceso.
    const pedido = peticion.headers[CABECERA_GREMIO];
    const gremioElegido =
      typeof pedido === 'string' && convenios.includes(pedido) ? pedido : null;

    const alcance = gremioElegido ? [gremioElegido] : convenios;

    peticion.ambito = {
      convenios: alcance,
      todos: !gremioElegido && alcance.length >= activos,
      roles,
      gremioElegido,
      concedidos,
    };

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

    const rolesDeCuenta = this.reflector.getAllAndOverride<RolAdmin[]>(ROLES, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (rolesDeCuenta?.length && !rolesDeCuenta.includes(admin.rol)) {
      throw new ForbiddenException('No tiene permiso para esta operación.');
    }

    // ni un convenio donde alcance: la ruta no es suya
    if (exigido && convenios.length === 0) {
      throw new ForbiddenException(
        exigido.nivel === 'ESCRIBIR'
          ? 'Su rol permite consultar esta sección, no modificarla.'
          : 'Su rol no tiene acceso a esta sección.',
      );
    }

    return true;
  }
}
