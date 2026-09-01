/** Convertir varios leads en fichas de una vez. */

/**
 * Existe porque la mesa se llena de a cientos y atenderlos de uno
 * en uno no es trabajo de nadie.
 *
 * La ficha nace en `INTERESADO`, que es la primera etapa: entra a
 * la escalera por arriba y de ahí la mueve el asesor. Convertir no
 * matricula ni reporta nada — para eso hacen falta cosas que un
 * lead de un anuncio no trae.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import type { Admin } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

import { ConversionDeLeads } from './conversion.service';
import { TOPE_DEL_LOTE_DE_LEADS } from './dto';
import { loQueLeFaltaAlLead } from './listo-para-ficha';



type Fila = {
  leadId: string;
  ok: boolean;
  participanteId?: string;
  /// Por qué no se pudo, con el nombre para poder buscarlo.
  porque?: string;
  nombre?: string;
  /// Si quedó con constancia de autorización o sin ella.
  conAutorizacion?: boolean;
};

@Injectable()
export class LoteDeLeads {
  private readonly log = new Logger(LoteDeLeads.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversion: ConversionDeLeads,
  ) {}

  /**
   * Convierte los que se le pidan, uno por uno.
   *
   * SIN transacción y fila a fila, igual que la carga masiva del
   * panel y el lote del webhook: que la 17 traiga un documento
   * inválido no puede tumbar las otras 99.
   */
  async convertir(
    ids: string[],
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    if (ids.length > TOPE_DEL_LOTE_DE_LEADS) {
      throw new BadRequestException(
        `Un lote admite hasta ${TOPE_DEL_LOTE_DE_LEADS} leads. ` +
          'Con más, la petición tardaría más de lo que aguanta la conexión ' +
          'y no sabría cuáles entraron.',
      );
    }

    /// Los ids repetidos se quitan aquí.
    ///
    /// Dos veces el mismo en el array darían dos intentos, y el
    /// segundo chocaría con «este lead ya tiene ficha»: un error
    /// que no es del usuario y que ensucia el recuento.
    const unicos = [...new Set(ids)];

    /// Se traen TODOS de una, acotados por ámbito.
    ///
    /// Un id de otro gremio sencillamente no aparece, así que no
    /// hace falta contestar nada sobre él: decir «ese no es suyo»
    /// confirmaría que existe, y eso es un oráculo. Se cuentan
    /// aparte como `fuera`, sin decir cuáles.
    const leads = await this.prisma.leadEntrante.findMany({
      where: { id: { in: unicos }, convenioId: { in: ambito } },
      select: {
        id: true,
        convenioId: true,
        estado: true,
        participanteId: true,
        tipoDocumentoSepId: true,
        numeroDocumento: true,
        nombreCompleto: true,
        primerNombre: true,
        primerApellido: true,
        accionFormacionId: true,
        origen: true,
        origenSistema: true,
        externoId: true,
        recibidoEn: true,
      },
    });

    const fuera = unicos.length - leads.length;

    const filas: Fila[] = [];
    for (const lead of leads) {
      const nombre = lead.nombreCompleto ?? lead.primerNombre ?? lead.id;

      /// La MISMA regla que enciende la casilla en la pantalla.
      ///
      /// Comprobarla aquí y no solo allá es lo que la convierte en
      /// un control: la ruta se puede llamar directo con cualquier
      /// id, y un control que solo vive en el navegador no es un
      /// control.
      const falta = loQueLeFaltaAlLead({ ...lead, estado: lead.estado });
      if (falta.length) {
        filas.push({
          leadId: lead.id,
          ok: false,
          nombre,
          porque: `Le falta ${falta.join(', ')}.`,
        });
        continue;
      }

      try {
        const r = await this.conversion.convertirDeLote(
          lead.id,
          admin,
          ambito,
          ip,
        );
        filas.push({
          leadId: lead.id,
          ok: true,
          nombre,
          participanteId: r.participanteId,
          conAutorizacion: r.conAutorizacion,
        });
      } catch (e) {
        filas.push({
          leadId: lead.id,
          ok: false,
          nombre,
          porque: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const convertidos = filas.filter((f) => f.ok).length;
    const conAutorizacion = filas.filter((f) => f.ok && f.conAutorizacion).length;
    const fallaron = filas.filter((f) => !f.ok).length;

    this.log.log(
      `Lote de ${unicos.length} leads por ${admin.correo}: ` +
        `${convertidos} fichas (${conAutorizacion} con autorización), ` +
        `${fallaron} con problema, ${fuera} fuera del ámbito.`,
    );

    return {
      pedidos: unicos.length,
      convertidos,
      /// Cuántas quedaron pudiendo matricularse, que no son todas.
      /// Sin este número, «convertí 40» parecería que las 40 están
      /// listas y no lo estarían.
      conAutorizacion,
      sinAutorizacion: convertidos - conAutorizacion,
      fallaron,
      fuera,
      /// Servidos aparte: quien manda 100 no va a leer 100 filas
      /// para encontrar las 6 malas.
      problemas: filas.filter((f) => !f.ok),
      filas,
    };
  }
}
