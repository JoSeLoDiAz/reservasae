import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export type Semaforo = 'DISPONIBLE' | 'ULTIMOS_CUPOS' | 'COMPLETO';

/** El semáforo del cupo. */
export function semaforo(cuposMaximos: number, cuposOcupados: number): Semaforo {
  const disponibles = cuposMaximos - cuposOcupados;
  if (disponibles <= 0) return 'COMPLETO';
  // 10 % del cupo y nunca menos de 3
  if (disponibles <= Math.max(3, Math.floor(cuposMaximos * 0.1))) return 'ULTIMOS_CUPOS';
  return 'DISPONIBLE';
}

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async convenios() {
    const convenios = await this.prisma.convenio.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { slug: true, nombre: true, sigla: true },
    });
    return convenios;
  }

  /** Acciones publicadas con sus ofertas abiertas. */
  async porConvenio(slug: string) {
    const convenio = await this.prisma.convenio.findUnique({
      where: { slug },
      include: {
        acciones: {
          where: { visible: true },
          orderBy: { orden: 'asc' },
          include: {
            ofertas: {
              where: { abierta: true },
              include: { ubicacion: true },
            },
          },
        },
      },
    });

    if (!convenio || !convenio.activo) {
      throw new NotFoundException('No existe ese convenio.');
    }

    return {
      slug: convenio.slug,
      nombre: convenio.nombre,
      sigla: convenio.sigla,
      acciones: convenio.acciones.map((accion) => ({
        id: accion.id,
        codigo: accion.codigo,
        nombre: accion.nombre,
        modalidad: accion.modalidad,
        evento: accion.evento,
        horas: accion.horas,
        objetivo: accion.objetivo,
        ofertas: accion.ofertas
          .map((oferta) => ({
            id: oferta.id,
            modalidad: oferta.modalidad,
            ubicacion: oferta.ubicacion.nombre,
            tipoUbicacion: oferta.ubicacion.tipo,
            departamento: oferta.ubicacion.departamento,
            cuposMaximos: oferta.cuposMaximos,
            // solo se expone lo que queda
            cuposDisponibles: Math.max(oferta.cuposMaximos - oferta.cuposOcupados, 0),
            estado: semaforo(oferta.cuposMaximos, oferta.cuposOcupados),
          }))
          .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion, 'es')),
      })),
    };
  }
}
