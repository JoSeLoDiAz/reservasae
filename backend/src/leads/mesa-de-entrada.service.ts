/** Lo que llegó por los webhooks, para poder mirarlo. */

/**
 * Sin esto la mesa de entrada era invisible: los leads entraban,
 * se guardaban bien, y la única forma de verlos era abrir la
 * base. Un buzón que nadie puede abrir es un buzón donde los
 * leads se mueren de viejos.
 */

import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

/// Cuántos por página. La mesa se mira, no se estudia.
const POR_PAGINA = 50;
const TOPE = 200;

export type FiltrosDeLaMesa = {
  estado?: string;
  convenioId?: string;
  /// Documento, nombre, correo o celular.
  buscar?: string;
  pagina?: number;
  limite?: number;
};

@Injectable()
export class MesaDeEntrada {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: FiltrosDeLaMesa, ambito: string[]) {
    /// El ámbito ACOTA, nunca lo sustituye el filtro pedido.
    ///
    /// Con `convenioId` de fuera del ámbito la lista sale vacía,
    /// no completa: pedir uno que no es suyo no puede devolverlo
    /// todo. Es la misma regla que en tableros, y el defecto que
    /// ya apareció dos veces por escribirla con un spread.
    const donde: Prisma.LeadEntranteWhereInput = {
      AND: [
        { convenioId: { in: ambito } },
        ...(filtros.convenioId ? [{ convenioId: filtros.convenioId }] : []),
        ...(filtros.estado ? [{ estado: filtros.estado as never }] : []),
        ...(filtros.buscar?.trim() ? [this.comoSeBusca(filtros.buscar)] : []),
      ],
    };

    const pagina = Math.max(1, filtros.pagina ?? 1);
    const porPagina = Math.min(filtros.limite ?? POR_PAGINA, TOPE);

    const [total, filas, porEstado] = await Promise.all([
      this.prisma.leadEntrante.count({ where: donde }),
      this.prisma.leadEntrante.findMany({
        where: donde,
        orderBy: { recibidoEn: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        select: {
          id: true,
          externoId: true,
          origenSistema: true,
          estado: true,
          motivo: true,
          origen: true,
          nombreCompleto: true,
          primerNombre: true,
          segundoNombre: true,
          primerApellido: true,
          segundoApellido: true,
          tipoDocumentoSepId: true,
          numeroDocumento: true,
          correo: true,
          celular: true,
          interes: true,
          recibidoEn: true,
          participanteId: true,
          convenio: { select: { slug: true, sigla: true } },
          accionFormacion: { select: { codigo: true, nombre: true } },
        },
      }),
      /// El recuento por estado, con el MISMO ámbito.
      ///
      /// Sin el ámbito, las cifras de arriba contarían los dos
      /// gremios mientras la tabla enseña uno — que es la clase
      /// de número que parece exacto y no lo es.
      this.prisma.leadEntrante.groupBy({
        by: ['estado'],
        where: { convenioId: { in: ambito } },
        _count: { _all: true },
      }),
    ]);

    return {
      total,
      pagina,
      paginas: Math.max(1, Math.ceil(total / porPagina)),
      resumen: Object.fromEntries(
        porEstado.map((e) => [e.estado, e._count._all]),
      ),
      leads: filas.map((l) => ({
        id: l.id,
        estado: l.estado,
        motivo: l.motivo,
        /// El nombre armado, con las piezas si las hay.
        nombre:
          [l.primerNombre, l.segundoNombre, l.primerApellido, l.segundoApellido]
            .filter(Boolean)
            .join(' ') ||
          l.nombreCompleto ||
          '(sin nombre)',
        documento: l.numeroDocumento
          ? `${l.tipoDocumentoSepId ?? '?'} · ${l.numeroDocumento}`
          : null,
        correo: l.correo,
        celular: l.celular,
        origen: l.origen,
        /// De qué sistema entró: el orquestador, Meta, Postman.
        porDonde: l.origenSistema,
        gremio: l.convenio.sigla ?? l.convenio.slug,
        /// Lo que PIDIÓ y lo que se RESOLVIÓ, que son dos cosas.
        pidio: l.interes,
        curso: l.accionFormacion
          ? `${l.accionFormacion.codigo} · ${l.accionFormacion.nombre}`
          : null,
        recibidoEn: l.recibidoEn,
        /// Si ya tiene ficha, para poder saltar a ella.
        participanteId: l.participanteId,
      })),
    };
  }

  /// Documento, nombre, correo o celular, sin pedir cuál.
  ///
  /// Quien busca a alguien en la mesa tiene UN dato suelto y no
  /// sabe en qué columna vive. Obligarle a elegir el campo es
  /// hacerle adivinar antes de buscar.
  private comoSeBusca(texto: string): Prisma.LeadEntranteWhereInput {
    const t = texto.trim();
    const soloDigitos = t.replace(/\D/g, '');

    return {
      OR: [
        { numeroDocumento: { contains: soloDigitos || t } },
        { celular: { contains: soloDigitos || t } },
        { correo: { contains: t, mode: 'insensitive' } },
        { nombreCompleto: { contains: t, mode: 'insensitive' } },
        { primerNombre: { contains: t, mode: 'insensitive' } },
        { primerApellido: { contains: t, mode: 'insensitive' } },
        { externoId: { contains: t, mode: 'insensitive' } },
      ],
    };
  }
}
