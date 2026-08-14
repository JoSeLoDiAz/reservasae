import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DestinatarioPolitica } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarPoliticaDto, CrearPoliticaDto } from './dto';

/** El texto legal versionado, uno por convenio y destinatario. */
@Injectable()
export class PoliticasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(convenioId?: string, destinatario?: DestinatarioPolitica) {
    const politicas = await this.prisma.politicaDatos.findMany({
      where: { convenioId, destinatario },
      orderBy: [{ convenioId: 'asc' }, { destinatario: 'asc' }, { version: 'desc' }],
      include: {
        convenio: { select: { id: true, nombre: true, sigla: true, slug: true } },
        _count: { select: { reservas: true } },
      },
    });

    return politicas.map((p) => ({
      id: p.id,
      convenio: p.convenio,
      destinatario: p.destinatario,
      version: p.version,
      titulo: p.titulo,
      contenido: p.contenido,
      vigente: p.vigenteHasta === null,
      vigenteDesde: p.vigenteDesde,
      vigenteHasta: p.vigenteHasta,
      aceptaciones: p._count.reservas,
      // una vez aceptada, el texto se congela
      editable: p._count.reservas === 0,
    }));
  }

  /** Qué falta para poder publicar acciones de cada convenio. */
  async cobertura() {
    const convenios = await this.prisma.convenio.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, sigla: true, slug: true },
    });

    const vigentes = await this.prisma.politicaDatos.findMany({
      where: { vigenteHasta: null },
      select: { convenioId: true, destinatario: true, version: true },
    });

    return convenios.map((c) => {
      const suyas = vigentes.filter((v) => v.convenioId === c.id);
      return {
        convenio: c,
        reserva: suyas.find((v) => v.destinatario === 'RESERVA') ?? null,
        participante: suyas.find((v) => v.destinatario === 'PARTICIPANTE') ?? null,
      };
    });
  }

  /** El texto vigente, para la página pública. */
  async vigentePublica(slug: string, destinatario: DestinatarioPolitica) {
    const politica = await this.prisma.politicaDatos.findFirst({
      where: { convenio: { slug }, destinatario, vigenteHasta: null },
      select: {
        titulo: true,
        contenido: true,
        version: true,
        vigenteDesde: true,
        convenio: { select: { nombre: true, sigla: true, slug: true } },
      },
    });

    if (!politica) {
      throw new NotFoundException('Todavía no hay una política publicada.');
    }
    return politica;
  }

  /** Crear una versión la deja vigente y cierra la anterior. */
  async crear(dto: CrearPoliticaDto) {
    const convenio = await this.prisma.convenio.findUnique({
      where: { id: dto.convenioId },
      select: { id: true },
    });
    if (!convenio) throw new NotFoundException('Ese convenio no existe.');

    return this.prisma.$transaction(async (tx) => {
      const anterior = await tx.politicaDatos.findFirst({
        where: {
          convenioId: dto.convenioId,
          destinatario: dto.destinatario,
          vigenteHasta: null,
        },
        select: { id: true, version: true },
      });

      const ultima = await tx.politicaDatos.findFirst({
        where: { convenioId: dto.convenioId, destinatario: dto.destinatario },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const ahora = new Date();

      // el indice parcial no admite dos vigentes a la vez
      if (anterior) {
        await tx.politicaDatos.update({
          where: { id: anterior.id },
          data: { vigenteHasta: ahora },
        });
      }

      return tx.politicaDatos.create({
        data: {
          convenioId: dto.convenioId,
          destinatario: dto.destinatario,
          version: (ultima?.version ?? 0) + 1,
          titulo: dto.titulo.trim(),
          contenido: dto.contenido.trim(),
          vigenteDesde: ahora,
        },
      });
    });
  }

  /** Solo mientras nadie la haya aceptado. */
  async actualizar(id: string, dto: ActualizarPoliticaDto) {
    const politica = await this.prisma.politicaDatos.findUnique({
      where: { id },
      include: { _count: { select: { reservas: true } } },
    });
    if (!politica) throw new NotFoundException('Esa política no existe.');

    if (politica._count.reservas > 0) {
      throw new ConflictException(
        `Esta política ya la aceptaron ${politica._count.reservas} personas. ` +
          'Publique una versión nueva en vez de cambiar el texto que leyeron.',
      );
    }

    return this.prisma.politicaDatos.update({
      where: { id },
      data: {
        titulo: dto.titulo?.trim(),
        contenido: dto.contenido?.trim(),
      },
    });
  }

  /** Solo si nadie la aceptó y no es la vigente. */
  async eliminar(id: string) {
    const politica = await this.prisma.politicaDatos.findUnique({
      where: { id },
      include: { _count: { select: { reservas: true } } },
    });
    if (!politica) throw new NotFoundException('Esa política no existe.');

    if (politica._count.reservas > 0) {
      throw new ConflictException(
        'No se borra una política que alguien aceptó: es la prueba de lo que leyó.',
      );
    }
    if (politica.vigenteHasta === null) {
      throw new BadRequestException(
        'Es la política vigente. Publique otra versión y entonces podrá borrar esta.',
      );
    }

    await this.prisma.politicaDatos.delete({ where: { id } });
    return { borrada: true };
  }
}
