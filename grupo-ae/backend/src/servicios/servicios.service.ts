import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { ActualizarServicioDto } from './dto';

@Injectable()
export class ServiciosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Todo el portafolio, en el orden en que se oferta.
   *
   * Con `soloVisibles` es lo que se ofrece al elegir el servicio de un
   * negocio; sin él, lo que ve quien lo administra —los ocultos
   * también, porque se tienen que poder volver a mostrar—.
   *
   * Cuenta cuántos negocios lleva cada uno: es la primera pregunta
   * que el portafolio vino a poder contestar.
   */
  listar(soloVisibles: boolean) {
    return this.prisma.servicio.findMany({
      where: soloVisibles ? { visible: true } : {},
      orderBy: [{ familia: 'asc' }, { orden: 'asc' }],
      select: {
        id: true,
        familia: true,
        tipo: true,
        nombre: true,
        unidad: true,
        orden: true,
        visible: true,
        _count: { select: { oportunidades: true } },
      },
    });
  }

  async actualizar(id: string, dto: ActualizarServicioDto) {
    const actual = await this.prisma.servicio.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Ese servicio no está en el portafolio.');

    const nombre = dto.nombre?.trim();
    if (nombre !== undefined && nombre.length < 3) {
      throw new BadRequestException('El nombre del servicio es muy corto.');
    }
    if (nombre && nombre !== actual.nombre) {
      const repetido = await this.prisma.servicio.findUnique({
        where: { familia_nombre: { familia: actual.familia, nombre } },
        select: { id: true },
      });
      if (repetido) {
        throw new BadRequestException('Ya hay un servicio con ese nombre en esta familia.');
      }
    }

    return this.prisma.servicio.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.unidad !== undefined ? { unidad: dto.unidad.trim() } : {}),
        ...(dto.visible !== undefined ? { visible: dto.visible } : {}),
        ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
      },
    });
  }
}
