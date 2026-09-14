/** El lead que llega completo pasa solo a Gestión de leads. */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import type { OrigenParticipante } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

import { ConversionDeLeads } from './conversion.service';
import { motivoParaNoInscribir } from '../crm/una-sola-accion';
import { autorizoAlRegistrarse, loQueLeFaltaAlLead } from './listo-para-ficha';

/** Qué pasó con un lead al intentar pasarlo. */
export type Intento = {
  paso: boolean;
  /// En palabras, para contestárselo a quien lo mandó.
  porque: string;
  falta?: string[];
  participanteId?: string;
};

// lo mínimo para juzgarlo, en un solo sitio
const CAMPOS = {
  id: true,
  convenioId: true,
  estado: true,
  origen: true,
  aceptaHabeasData: true,
  participanteId: true,
  tipoDocumentoSepId: true,
  numeroDocumento: true,
  nombreCompleto: true,
  primerNombre: true,
  primerApellido: true,
  accionFormacionId: true,
} as const;

type LeadParaPasar = {
  id: string;
  convenioId: string;
  estado: string;
  origen: OrigenParticipante;
  aceptaHabeasData: boolean | null;
  participanteId: string | null;
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  nombreCompleto: string | null;
  primerNombre: string | null;
  primerApellido: string | null;
  accionFormacionId: string | null;
};

const CADA = 60_000;
// tope por vuelta: Cloudflare no interviene, pero una mesa
// de 5.000 no se hace de un tirón
const POR_VUELTA = 50;

@Injectable()
export class ConversionAutomatica implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConversionAutomatica.name);
  private reloj: NodeJS.Timeout | null = null;
  private corriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversion: ConversionDeLeads,
  ) {}

  onModuleInit() {
    if (process.env.CONVERSION_AUTOMATICA === 'no') {
      this.log.warn('Apagada: los leads esperan a un asesor.');
      return;
    }
    this.reloj = setInterval(() => void this.pasar(), CADA);
    this.reloj.unref?.();
  }

  onModuleDestroy() {
    if (this.reloj) clearInterval(this.reloj);
  }

  /**
   * Un lead concreto: ¿pasa a interesado o se queda?
   *
   * La llaman el webhook al entrar y el barrido de después.
   * Una decisión, dos disparadores.
   */
  async intentar(leadId: string): Promise<Intento> {
    const lead = await this.prisma.leadEntrante.findUnique({
      where: { id: leadId },
      select: CAMPOS,
    });
    if (!lead) return { paso: false, porque: 'Ese lead ya no está.', falta: [] };
    return this.conEsteLead(lead);
  }

  /**
   * Si esa persona ya esta en otra accion que no sea el foro.
   *
   * Se cruza por DOCUMENTO, que es la identidad del sistema. Sin
   * documento no hay con que cruzar y el lead ya se queda en la
   * mesa por otra razon, asi que no hace falta adivinar por
   * nombre.
   */
  private async yaEstaEnOtra(lead: LeadParaPasar): Promise<string | null> {
    if (!lead.accionFormacionId) return null;
    if (!lead.tipoDocumentoSepId || !lead.numeroDocumento) return null;

    const pedida = await this.prisma.accionFormacion.findUnique({
      where: { id: lead.accionFormacionId },
      select: { id: true, evento: true },
    });
    if (!pedida) return null;

    const persona = await this.prisma.persona.findUnique({
      where: {
        tipoDocumentoSepId_numeroDocumento: {
          tipoDocumentoSepId: lead.tipoDocumentoSepId,
          numeroDocumento: lead.numeroDocumento,
        },
      },
      select: {
        participaciones: {
          where: { accionFormacionId: { not: null } },
          select: {
            accionFormacionId: true,
            accionFormacion: { select: { codigo: true, nombre: true, evento: true } },
          },
        },
      },
    });
    if (!persona) return null;

    return motivoParaNoInscribir(
      pedida,
      persona.participaciones.flatMap((x) =>
        x.accionFormacionId && x.accionFormacion
          ? [
              {
                accionFormacionId: x.accionFormacionId,
                codigo: x.accionFormacion.codigo,
                nombre: x.accionFormacion.nombre,
                evento: x.accionFormacion.evento,
              },
            ]
          : [],
      ),
    );
  }

  private async conEsteLead(lead: LeadParaPasar): Promise<Intento> {
    // la MISMA regla que enciende la casilla en la mesa
    const falta = loQueLeFaltaAlLead(lead);
    if (falta.length > 0) {
      return {
        paso: false,
        porque: `Se queda en la mesa de entrada: le falta ${falta.join(', ')}.`,
        falta,
      };
    }

    /// UNA SOLA ACCION, y el foro no cuenta.
    ///
    /// Se queda en la MESA y no se rechaza: «mesa de entrada
    /// para que no se pierda nada y no estarle devolviendo»
    /// (cliente, 14 sep 2026). El asesor lo ve, lo llama y le
    /// cambia la accion si quiere.
    const repetida = await this.yaEstaEnOtra(lead);
    if (repetida) {
      return { paso: false, porque: repetida, falta: [] };
    }

    // sin autorización NO se convierte solo: ver CLAUDE.md
    if (!autorizoAlRegistrarse(lead.origen, lead.aceptaHabeasData)) {
      return {
        paso: false,
        porque:
          'Se queda en la mesa de entrada: no consta que autorizara ' +
          'el tratamiento de sus datos.',
        falta: [],
      };
    }

    try {
      const r = await this.conversion.convertirDeLote(
        lead.id,
        // sin asesor: cae al montón común
        null,
        null,
        [lead.convenioId],
      );
      return {
        paso: true,
        porque: 'Trasladado a interesado en Gestión de leads.',
        participanteId: r.participanteId,
      };
    } catch (e) {
      const porque = e instanceof Error ? e.message : String(e);
      return { paso: false, porque: `Se queda en la mesa: ${porque}`, falta: [] };
    }
  }

  /** Los que están listos, a ficha. Devuelve cuántos. */
  async pasar(): Promise<number> {
    // una vuelta a la vez: dos crearían la misma persona
    if (this.corriendo) return 0;
    this.corriendo = true;
    try {
      return await this.vuelta();
    } catch (e) {
      this.log.error(`No se pudo dar la vuelta: ${(e as Error).message}`);
      return 0;
    } finally {
      this.corriendo = false;
    }
  }

  private async vuelta(): Promise<number> {
    const leads = await this.prisma.leadEntrante.findMany({
      where: { estado: 'PENDIENTE', participanteId: null },
      orderBy: { recibidoEn: 'asc' },
      take: POR_VUELTA,
      select: CAMPOS,
    });
    if (leads.length === 0) return 0;

    let hechas = 0;

    for (const lead of leads) {
      // que uno falle no puede parar la vuelta
      const r = await this.conEsteLead(lead);
      if (r.paso) hechas += 1;
    }

    if (hechas > 0) {
      this.log.log(`${hechas} leads pasaron solos a interesados.`);
    }
    return hechas;
  }
}
