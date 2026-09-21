/** Las cuentas: cada empresa con su gente y sus negocios. */

/**
 * LA FICHA QUE UN CRM DA POR SENTADA Y ESTE NO TENÍA.
 *
 * El negocio de una empresa decía de qué empresa era, pero la empresa
 * no tenía dónde verse: ni sus contactos, ni todo lo que se le ha
 * cotizado, ganado y facturado, ni a quién llamar (auditoría del 18 sep
 * 2026). Los datos estaban —`Empresa`, sus `oportunidades`, la persona
 * de contacto de cada negocio y los campos `contacto*` de la propia
 * empresa—; faltaba juntarlos.
 *
 * SOLO LO DEL ÁMBITO. Una empresa puede tener negocios en varias líneas
 * y quien mira solo ve los de las suyas. Una empresa sin ningún negocio
 * en su ámbito no existe para él: la ficha responde 404, igual que un
 * negocio ajeno, para no confirmar que ese NIT está en la base.
 */

import { Injectable, NotFoundException } from '@nestjs/common';

import { EtapaOportunidad, Prisma } from '../../generated/prisma';
import type { Ambito } from '../admin/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

const CERRADAS: EtapaOportunidad[] = [EtapaOportunidad.GANADO, EtapaOportunidad.PERDIDO];

@Injectable()
export class CuentasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Las empresas con negocios en el ámbito, con sus cifras. */
  async listar(ambito: Ambito, buscar?: string) {
    const texto = buscar?.trim();
    const empresas = await this.prisma.empresa.findMany({
      where: {
        oportunidades: { some: { convenioId: { in: ambito.convenios } } },
        ...(texto
          ? {
              OR: [
                { razonSocial: { contains: texto, mode: 'insensitive' } },
                { nit: { contains: texto.replace(/\D/g, '') || texto } },
              ],
            }
          : {}),
      },
      orderBy: { razonSocial: 'asc' },
      take: 300,
      select: {
        id: true,
        nit: true,
        digitoVerificacion: true,
        razonSocial: true,
        numeroColaboradores: true,
        contactoNombre: true,
        oportunidades: {
          where: { convenioId: { in: ambito.convenios } },
          select: { etapa: true, valor: true, valorFacturado: true, ultimoToqueEn: true },
        },
      },
    });

    return empresas.map((e) => {
      const abiertas = e.oportunidades.filter((o) => !CERRADAS.includes(o.etapa));
      const ganadas = e.oportunidades.filter((o) => o.etapa === EtapaOportunidad.GANADO);
      const ultimo = e.oportunidades
        .map((o) => o.ultimoToqueEn.getTime())
        .reduce((a, b) => Math.max(a, b), 0);
      return {
        id: e.id,
        nit: e.nit,
        digitoVerificacion: e.digitoVerificacion,
        razonSocial: e.razonSocial,
        numeroColaboradores: e.numeroColaboradores,
        contactoNombre: e.contactoNombre,
        negocios: e.oportunidades.length,
        abiertos: abiertas.length,
        valorAbierto: abiertas.reduce((s, o) => s + Number(o.valor), 0),
        ganado: ganadas.reduce((s, o) => s + Number(o.valor), 0),
        facturado: ganadas.reduce((s, o) => s + Number(o.valorFacturado ?? 0), 0),
        ultimoMovimiento: ultimo ? new Date(ultimo) : null,
      };
    });
  }

  /** La ficha de una empresa: datos, contactos y negocios. */
  async ficha(id: string, ambito: Ambito) {
    const e = await this.prisma.empresa.findFirst({
      where: { id, oportunidades: { some: { convenioId: { in: ambito.convenios } } } },
      select: {
        id: true,
        nit: true,
        digitoVerificacion: true,
        razonSocial: true,
        numeroColaboradores: true,
        direccion: true,
        telefono: true,
        sectorEconomico: true,
        contactoNombre: true,
        contactoCargo: true,
        contactoCorreo: true,
        creadoEn: true,
        oportunidades: {
          where: { convenioId: { in: ambito.convenios } },
          orderBy: { creadoEn: 'desc' },
          select: {
            id: true,
            codigo: true,
            titulo: true,
            embudo: true,
            etapa: true,
            valor: true,
            valorFacturado: true,
            cantidad: true,
            cierreEsperado: true,
            creadoEn: true,
            ultimoToqueEn: true,
            servicio: { select: { nombre: true, familia: true, unidad: true } },
            asesor: { select: { id: true, nombre: true } },
            persona: {
              select: {
                id: true,
                primerNombre: true,
                primerApellido: true,
                correo: true,
                celular: true,
              },
            },
          },
        },
      },
    });
    if (!e) throw new NotFoundException('Esa empresa no existe o no está en sus líneas de negocio.');

    /**
     * LOS CONTACTOS, SIN REPETIR.
     *
     * Salen de dos sitios: la persona de cada negocio y el contacto
     * que la empresa dejó en su propia ficha (formulario público).
     * Se juntan por persona y, el de la ficha, por correo, para que
     * la misma gente no salga dos veces.
     */
    const contactos = new Map<
      string,
      { id: string | null; nombre: string; cargo: string | null; correo: string | null; celular: string | null; negocios: number }
    >();
    for (const o of e.oportunidades) {
      const p = o.persona;
      if (!p) continue;
      const clave = `p:${p.id}`;
      const ya = contactos.get(clave);
      if (ya) ya.negocios += 1;
      else
        contactos.set(clave, {
          id: p.id,
          nombre: `${p.primerNombre} ${p.primerApellido}`.trim(),
          cargo: null,
          correo: p.correo,
          celular: p.celular,
          negocios: 1,
        });
    }
    const correosVistos = new Set(
      [...contactos.values()].map((c) => c.correo?.toLowerCase()).filter(Boolean),
    );
    if (e.contactoNombre && !correosVistos.has(e.contactoCorreo?.toLowerCase())) {
      contactos.set('empresa', {
        id: null,
        nombre: e.contactoNombre,
        cargo: e.contactoCargo,
        correo: e.contactoCorreo,
        celular: null,
        negocios: 0,
      });
    }

    const negocios = e.oportunidades.map((o) => ({
      ...o,
      valor: Number(o.valor),
      valorFacturado: o.valorFacturado === null ? null : Number(o.valorFacturado),
    }));
    const abiertos = negocios.filter((o) => !CERRADAS.includes(o.etapa));
    const ganados = negocios.filter((o) => o.etapa === EtapaOportunidad.GANADO);

    return {
      empresa: {
        id: e.id,
        nit: e.nit,
        digitoVerificacion: e.digitoVerificacion,
        razonSocial: e.razonSocial,
        numeroColaboradores: e.numeroColaboradores,
        direccion: e.direccion,
        telefono: e.telefono,
        sectorEconomico: e.sectorEconomico,
        /// Los de la ficha de la empresa, tal cual: son los que se
        /// editan, aunque la lista de contactos los junte con otros.
        contactoNombre: e.contactoNombre,
        contactoCargo: e.contactoCargo,
        contactoCorreo: e.contactoCorreo,
        creadoEn: e.creadoEn,
      },
      cifras: {
        negocios: negocios.length,
        abiertos: abiertos.length,
        valorAbierto: abiertos.reduce((s, o) => s + o.valor, 0),
        ganado: ganados.reduce((s, o) => s + o.valor, 0),
        facturado: ganados.reduce((s, o) => s + (o.valorFacturado ?? 0), 0),
      },
      contactos: [...contactos.values()],
      negocios,
    };
  }

  /**
   * Los datos de contacto de la empresa, que el asesor completa al
   * llamar. Solo estos: el NIT y la razón social vienen del RUES y
   * cambiarlos a mano rompería la búsqueda por NIT.
   */
  async actualizar(
    id: string,
    ambito: Ambito,
    datos: Partial<Record<'direccion' | 'telefono' | 'sectorEconomico' | 'contactoNombre' | 'contactoCargo' | 'contactoCorreo', string | null>> & {
      numeroColaboradores?: number | null;
    },
  ) {
    await this.ficha(id, ambito);
    await this.prisma.empresa.update({
      where: { id },
      data: datos as Prisma.EmpresaUpdateInput,
    });
    return this.ficha(id, ambito);
  }
}
