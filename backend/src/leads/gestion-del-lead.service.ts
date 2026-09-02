/** Llamar a un lead y dejar constancia, sin convertirlo en ficha. */

/**
 * Es la mitad que faltaba. El lead de una pauta sin cédula entraba
 * bien y no podía salir: no se convertía —`Persona` exige
 * documento y eso no se toca— y tampoco se podía trabajar, porque
 * llamar y dejar nota solo existía sobre `Participante`.
 *
 * Ahora el asesor llama DESDE la mesa, apunta cómo salió, y cuando
 * consigue la cédula por teléfono convierte. Que es exactamente el
 * proceso que describió el cliente: «al momento de contactar se
 * confirma que pongan el número de cédula».
 *
 * NO HAY TABLA NUEVA, y es la decisión que lo sostiene. La nota va
 * a `notas_participante`, la misma de la ficha, con
 * `participanteId` nulo mientras no haya ficha. Una tabla aparte
 * daría dos verdades sobre «cuántas veces se contactó a esta
 * persona», que es el patrón que este proyecto lleva cinco rondas
 * documentando — y por el que ya se rechazó una tabla `Llamada`.
 *
 * Al convertir, la conversión rellena `participanteId` sin borrar
 * `leadId`: la nota queda colgando de los dos y el rastro no se
 * corta.
 */

import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService, ENTIDADES } from '../comun/auditoria.service';
import { AQuienSeParece } from './a-quien-se-parece';
import { porQueNoPuedoContactar, puedoContactar } from './puedo-contactar';

import type { CrearNotaDto } from '../crm/dto';

type Admin = { id: string; nombre: string };

@Injectable()
export class GestionDelLead {
  private readonly log = new Logger('GestionDelLead');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly seParece: AQuienSeParece,
  ) {}

  /** Deja una nota de gestión sobre un lead. */
  async agregarNota(
    leadId: string,
    dto: CrearNotaDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    /// Fuera del ámbito la fila NO EXISTE: 404 y no 403. Un 403
    /// confirmaría que el lead del otro gremio existe, y eso es un
    /// oráculo. Mismo criterio que `mesa.arreglar`.
    const lead = await this.prisma.leadEntrante.findFirst({
      where: { id: leadId, convenioId: { in: ambito } },
      select: {
        id: true,
        estado: true,
        participanteId: true,
        tipoDocumentoSepId: true,
        numeroDocumento: true,
        correo: true,
        celular: true,
      },
    });
    if (!lead) throw new NotFoundException('Ese lead no existe.');

    /// LA MISMA regla que pinta el botón en la pantalla.
    ///
    /// Un control que solo está en el navegador no es un control:
    /// esta ruta se llama directo. Y si la pantalla dijera que sí
    /// y el servidor que no, serían dos verdades sobre lo mismo.
    const puedo = puedoContactar({
      estado: lead.estado,
      participanteId: lead.participanteId,
      revoco: await this.seParece.revoco(lead),
    });
    if (puedo !== 'SI') {
      throw new ForbiddenException(porQueNoPuedoContactar(puedo)!);
    }

    /// La nota y la fecha de la última gestión, JUNTAS.
    ///
    /// En la misma transacción porque `ultimaGestionEn` es lo que
    /// ordena la cola del asesor: si se escribe aparte y algo
    /// falla en medio, la nota existe y la cola no se entera, así
    /// que ese lead se queda al final de la fila para siempre.
    const nota = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.notaDeGestion.create({
        data: {
          leadId: lead.id,
          autorId: admin.id,
          /// Congelado, como en la ficha: si mañana esa persona
          /// deja el equipo, la nota sigue diciendo quién llamó.
          autorNombre: admin.nombre,
          texto: dto.texto,
          canales: dto.canales,
          resultado: dto.resultado,
        },
        select: { id: true, creadoEn: true },
      });

      await tx.leadEntrante.update({
        where: { id: lead.id },
        data: { ultimaGestionEn: creada.creadoEn },
      });

      return creada;
    });

    /// En la auditoría va el RESULTADO, no el texto.
    ///
    /// El texto es libre y puede traer datos de la persona; el
    /// mismo criterio que ya se aplicó al motivo de una
    /// revocación.
    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'NOTA_CREADA',
      entidad: ENTIDADES.LEAD,
      entidadId: lead.id,
      resumen: `Gestión sobre el lead: ${dto.resultado}.`,
      ip,
    });

    this.log.log(`Nota en el lead ${lead.id} por ${admin.nombre} (${dto.resultado}).`);
    return { id: nota.id, creadoEn: nota.creadoEn };
  }

  /** Reparte leads entre asesores. */
  async asignar(
    ids: string[],
    asesorId: string | null,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    /// El asesor tiene que poder VER lo que se le asigna.
    ///
    /// Sin esto, un lead de ADECOPRIA asignado a quien solo tiene
    /// BRITCHAM queda con dueño y sin nadie que lo vea, y la cola
    /// lo cuenta como atendido. Es el mismo defecto que ya se
    /// cerró al repartir fichas.
    if (asesorId) {
      const suyos = await this.prisma.adminConvenio.findMany({
        where: { adminId: asesorId, convenioId: { in: ambito } },
        select: { convenioId: true },
      });
      if (!suyos.length) {
        throw new ForbiddenException(
          'Ese asesor no tiene permisos en este gremio, así que no vería los ' +
            'leads que se le asignen.',
        );
      }
      ambito = suyos.map((s) => s.convenioId);
    }

    /// Solo los que siguen en la mesa: repartir uno ya convertido
    /// no significa nada, y contarlo diría que se hizo algo.
    const r = await this.prisma.leadEntrante.updateMany({
      where: {
        id: { in: ids },
        convenioId: { in: ambito },
        estado: 'PENDIENTE',
        participanteId: null,
      },
      data: { asesorId },
    });

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'ASESOR_ASIGNADO',
      entidad: ENTIDADES.LEAD,
      entidadId: ids[0] ?? 'lote',
      resumen: `${r.count} lead(s) repartidos.`,
      ip,
    });

    /// Se dicen los TRES números y no un total: los que no
    /// estaban en la mesa y los de otro gremio no se tocaron, y
    /// contarlos como repartidos sería mentir sobre lo que pasó.
    /// Mismo criterio que el reparto de fichas por lote.
    return {
      repartidos: r.count,
      sinTocar: ids.length - r.count,
      total: ids.length,
    };
  }
}
