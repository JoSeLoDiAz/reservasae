/** La mesa de entrada: recibir un lead y decidir qué hacer. */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { celularValido, normalizarCelular } from '../comun/celular';
import { documentoValido, normalizarDocumento } from '../comun/documento';
import { DOCUMENTOS_DE_PERSONA } from '../crm/catalogos-sep';
import { ColaRui } from '../crm/rui/cola-rui';
import { PrismaService } from '../prisma/prisma.service';

import type { EntraLeadDto } from './dto';

/// Lo que el CRM necesita para que un lead sea una ficha.
type Faltante = string;

@Injectable()
export class LeadsService {
  private readonly log = new Logger('Leads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly colaRui: ColaRui,
  ) {}

  /**
   * Entra un lead. Es idempotente y no lanza por datos flojos.
   *
   * Un webhook que contesta 400 porque al lead le falta el
   * apellido invita a que quien lo manda lo reintente en bucle o,
   * peor, lo descarte. Lo que llega se GUARDA siempre; lo que le
   * falte se dice en `motivo` y lo completa un asesor.
   *
   * Solo se rechaza lo que hace imposible guardarlo: que no
   * diga de qué gremio es, o que no traiga un id propio con el
   * que reconocerlo si vuelve.
   */
  async entra(dto: EntraLeadDto, origenSistema: string) {
    const convenio = await this.prisma.convenio.findFirst({
      where: { slug: dto.convenio, activo: true },
      select: { id: true, slug: true },
    });
    /// El gremio va explicito y no se adivina.
    ///
    /// Son dos convenios y adivinarlo mal mete a una persona de
    /// ADECOPRIA en BRITCHAM, que es peor que perder el lead.
    if (!convenio) {
      throw new BadRequestException(
        `«${dto.convenio}» no es una convocatoria activa. Mande el slug: adecopria o britcham-adee.`,
      );
    }

    const datos = this.limpiar(dto);
    const falta = this.queLeFalta(datos);

    /// El mismo lead dos veces no crea dos fichas.
    ///
    /// Los webhooks reintentan. Sin esto, un reintento de red
    /// —que quien lo manda ni ve— duplica a una persona.
    const ya = await this.prisma.leadEntrante.findUnique({
      where: {
        origenSistema_externoId: { origenSistema, externoId: dto.externoId },
      },
      select: { id: true, estado: true, participanteId: true, motivo: true },
    });
    if (ya) {
      return { ...this.vista(ya), repetido: true };
    }

    const lead = await this.prisma.leadEntrante.create({
      data: {
        convenioId: convenio.id,
        origenSistema,
        externoId: dto.externoId,
        origen: dto.origen ?? 'OTRO',
        nombreCompleto: datos.nombreCompleto,
        correo: datos.correo,
        celular: datos.celular,
        tipoDocumentoSepId: datos.tipoDocumentoSepId,
        numeroDocumento: datos.numeroDocumento,
        interes: dto.interes ?? null,
        // el cuerpo entero, para poder depurar y reprocesar
        carga: (dto.carga ?? dto) as Prisma.InputJsonValue,
        motivo: falta.length ? `Falta: ${falta.join(', ')}.` : null,
      },
      select: { id: true, estado: true, participanteId: true, motivo: true },
    });

    this.log.log(
      `Lead ${dto.externoId} de ${origenSistema} para ${convenio.slug}` +
        (falta.length ? ` — pendiente (${falta.join(', ')})` : ' — completo'),
    );

    return { ...this.vista(lead), repetido: false };
  }

  /**
   * Lo que llegó, normalizado como lo guarda el CRM.
   *
   * Se normaliza AQUÍ y no al convertir: si se guarda el celular
   * como vino y se limpia después, la misma persona escrita de
   * dos formas son dos leads que nadie relaciona.
   */
  private limpiar(dto: EntraLeadDto) {
    const numero = dto.numeroDocumento
      ? normalizarDocumento(dto.numeroDocumento)
      : null;

    const celular = dto.celular ? normalizarCelular(dto.celular) : null;

    return {
      nombreCompleto: dto.nombreCompleto?.trim() || null,
      correo: dto.correo?.trim().toLowerCase() || null,
      /// Vacio si no es un celular: guardar «no tiene» seria
      /// guardar algo que no sirve para llamar a nadie.
      celular: celular && celularValido(celular) ? celular : null,
      tipoDocumentoSepId: dto.tipoDocumentoSepId ?? null,
      numeroDocumento: numero || null,
      /// Si MANDARON algo, aunque no sirviera.
      ///
      /// «No mandaron documento» y «mandaron algo que no sirve»
      /// se arreglan de formas distintas: lo primero es pedirlo,
      /// lo segundo es que el dato esta mal en el origen.
      trajoDocumento: Boolean(dto.numeroDocumento?.trim()),
    };
  }

  /**
   * Qué le falta para poder ser una ficha del CRM.
   *
   * Se calcula al entrar y se guarda dicho, no se deduce después
   * en cada pantalla: es la lección de `completitud.ts`, donde
   * tres reglas distintas hacían que la ficha dijera «completa»
   * mientras la persona desaparecía del archivo.
   */
  private queLeFalta(d: ReturnType<LeadsService['limpiar']>): Faltante[] {
    const falta: Faltante[] = [];

    if (!d.nombreCompleto) falta.push('nombre');
    if (!d.correo && !d.celular) falta.push('correo o celular');

    if (!d.numeroDocumento || d.tipoDocumentoSepId === null) {
      falta.push(
        d.trajoDocumento ? 'un documento con formato válido' : 'documento',
      );
      return falta;
    }
    if (!DOCUMENTOS_DE_PERSONA.some((t) => t.id === d.tipoDocumentoSepId)) {
      falta.push('un tipo de documento admitido');
    } else if (!documentoValido(d.tipoDocumentoSepId, d.numeroDocumento)) {
      falta.push('un documento con formato válido');
    }

    return falta;
  }

  private vista(l: {
    id: string;
    estado: string;
    participanteId: string | null;
    motivo: string | null;
  }) {
    return {
      id: l.id,
      estado: l.estado,
      participanteId: l.participanteId,
      motivo: l.motivo,
    };
  }
}
