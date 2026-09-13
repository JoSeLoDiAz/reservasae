/** Las conversaciones de Lucid, colgadas de quien corresponde. */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { CanalContacto } from '../../generated/prisma';
import { normalizarCelular } from '../comun/celular';
import { PrismaService } from '../prisma/prisma.service';
import { aQuienSePega, type Candidato } from './a-quien-se-pega';
import type { NotaDeLucidDto } from './dto';

/// Quien firma la nota. Se congela como cualquier otra.
const AUTOR = 'Lucid (WhatsApp)';

@Injectable()
export class LucidService {
  private readonly log = new Logger('Lucid');

  constructor(private readonly prisma: PrismaService) {}

  async entra(dto: NotaDeLucidDto, sistema: string, delHost: string | null) {
    /// El gremio lo AFIRMA la direccion. Si vienen los dos y no
    /// coinciden se rechaza: resolverlo en silencio es como una
    /// conversacion acaba en el historial del otro gremio, que
    /// es mezclar dos tratamientos de datos distintos.
    if (delHost && dto.convenio && dto.convenio !== delHost) {
      throw new BadRequestException(
        `La dirección dice «${delHost}» y el cuerpo dice «${dto.convenio}». ` +
          'No se adivina cuál: mande uno de los dos, o los dos iguales.',
      );
    }
    const slug = delHost ?? dto.convenio ?? null;
    if (!slug) {
      throw new BadRequestException(
        'Falta el convenio. Mándelo en el cuerpo, o llame al subdominio del gremio.',
      );
    }

    const convenio = await this.prisma.convenio.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!convenio) throw new BadRequestException(`No existe el convenio «${slug}».`);

    /// Un reintento no deja dos notas. A 200 por minuto los
    /// reintentos son certeza, no hipotesis.
    const yaEstaba = await this.prisma.conversacionEntrante.findUnique({
      where: {
        origenSistema_externoId: { origenSistema: sistema, externoId: dto.externoId },
      },
      select: { id: true, estado: true, notaId: true },
    });
    if (yaEstaba) {
      return {
        estado: yaEstaba.estado,
        conversacionId: yaEstaba.id,
        notaId: yaEstaba.notaId,
        repetido: true,
        motivo: 'Esa conversación ya había llegado.',
      };
    }

    const celular = normalizarCelular(dto.telefono);
    const candidatos = await this.candidatosDe(celular, convenio.id);
    const donde = aQuienSePega(candidatos);

    const conversacion = await this.prisma.conversacionEntrante.create({
      data: {
        convenioId: convenio.id,
        origenSistema: sistema,
        externoId: dto.externoId,
        celular,
        ocurridoEn: dto.ocurridoEn ? new Date(dto.ocurridoEn) : null,
        resumen: dto.resumen,
        carga: (dto.carga ?? null) as never,
        estado: donde.estado,
        candidatos: donde.estado === 'PEGADA' ? undefined : (candidatos as never),
      },
      select: { id: true },
    });

    if (donde.estado !== 'PEGADA') {
      this.log.log(`Conversación ${dto.externoId}: ${donde.estado} — ${donde.motivo}`);
      return {
        estado: donde.estado,
        conversacionId: conversacion.id,
        notaId: null,
        repetido: false,
        motivo: donde.motivo,
      };
    }

    const nota = await this.prisma.notaDeGestion.create({
      data: {
        participanteId: donde.destino.tipo === 'FICHA' ? donde.destino.id : null,
        leadId: donde.destino.tipo === 'LEAD' ? donde.destino.id : null,
        autorId: null,
        autorNombre: AUTOR,
        texto: dto.resumen,
        canales: [CanalContacto.WHATSAPP],
        /// SIN resultado, y no es un descuido. `gestionDe()`
        /// cuenta los intentos con `resultado: { not: null }` y
        /// los «sin respuesta» desde el ultimo CONTACTO. Poner
        /// CONTACTO aqui vaciaria sola la lista de a quien hay
        /// que insistirle, que es el producto. La regla ya
        /// estaba escrita: las notas del sistema no son intentos.
        resultado: null,
      },
      select: { id: true },
    });

    await this.prisma.conversacionEntrante.update({
      where: { id: conversacion.id },
      data: { notaId: nota.id },
    });

    /// Si es de un lead, se mueve su ultima gestion: es verdad
    /// que se le toco, y la cola del asesor se ordena por eso.
    if (donde.destino.tipo === 'LEAD') {
      await this.prisma.leadEntrante.update({
        where: { id: donde.destino.id },
        data: { ultimaGestionEn: new Date() },
      });
    }

    return {
      estado: 'PEGADA' as const,
      conversacionId: conversacion.id,
      notaId: nota.id,
      repetido: false,
      motivo: donde.motivo,
      adjuntadaA: { tipo: donde.destino.tipo, id: donde.destino.id },
    };
  }

  /**
   * Quien puede ser el dueno de ese numero, dentro del gremio.
   *
   * Los leads YA convertidos no son candidato aparte: son su
   * ficha, y contarlos dos veces mandaria a cuarentena a todo el
   * que llego por pauta y despues se inscribio.
   */
  private async candidatosDe(celular: string, convenioId: string): Promise<Candidato[]> {
    if (!celular) return [];

    const [fichas, leads] = await Promise.all([
      this.prisma.participante.findMany({
        where: { convenioId, persona: { celular } },
        select: { id: true, personaId: true, creadoEn: true },
        take: 20,
      }),
      this.prisma.leadEntrante.findMany({
        where: { convenioId, celular, participanteId: null },
        select: { id: true, recibidoEn: true },
        take: 20,
      }),
    ]);

    return [
      ...fichas.map((f) => ({
        tipo: 'FICHA' as const,
        id: f.id,
        personaId: f.personaId,
        creadoEn: f.creadoEn,
      })),
      ...leads.map((l) => ({ tipo: 'LEAD' as const, id: l.id, creadoEn: l.recibidoEn })),
    ];
  }
}
