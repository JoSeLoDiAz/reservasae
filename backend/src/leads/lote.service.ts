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

import { CrmService } from '../crm/crm.service';

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
    private readonly crm: CrmService,
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
    pedido: string | undefined,
    admin: Admin,
    ambito: string[],
    /// En que convenios PUEDE repartir. Vacio: no reparte.
    reparten: string[],
    ip?: string,
  ) {
    /// Quien NO reparte se las queda; quien reparte elige.
    ///
    /// Un asesor que convierte acaba de decidir que las atiende
    /// el: pedirle que se elija a si mismo en un desplegable es
    /// un paso que no decide nada. Un lider no las atiende, asi
    /// que tiene que decir de quien son.
    const puedeRepartir = reparten.length > 0;
    if (puedeRepartir && !pedido) {
      throw new BadRequestException(
        'Elija a qué asesor se le asignan: usted reparte fichas, no las atiende.',
      );
    }
    const asesorId = puedeRepartir ? pedido! : admin.id;
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

    /// El asesor se comprueba UNA vez y ANTES de convertir nada.
    ///
    /// Dentro del bucle serian cien consultas iguales; y despues,
    /// tarde: quedarian cien fichas creadas y sin dueño, que es el
    /// estado del que este lote existe para sacarlas. Se mira
    /// contra cada convenio distinto que haya dentro, porque
    /// bastaria con que uno no fuera suyo para dejarle fichas que
    /// no ve -- y una ficha con dueño que nadie mira la cuenta la
    /// brecha de nombres como atendida.
    for (const convenioId of new Set(leads.map((l) => l.convenioId))) {
      await this.crm.exigirAsesorDelConvenio(asesorId, convenioId);
    }

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
          asesorId,
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

  /**
   * Descarta leads de la mesa, con su motivo.
   *
   * No se BORRAN: se marcan. Un lead descartado sigue siendo la
   * prueba de que alguien llego y de que se decidio no atenderlo,
   * y borrarlo deja la mesa limpia y la pregunta «¿por que no me
   * llamaron?» sin respuesta.
   *
   * Y el que ya tiene ficha NO se descarta: eso no es descartar
   * un lead, es contradecir a la ficha que ya existe. Se dice y
   * se cuenta aparte.
   */
  async descartar(
    ids: string[],
    motivo: string,
    admin: Admin,
    ambito: string[],
  ) {
    const unicos = [...new Set(ids)];

    /// Solo los PENDIENTES y de su ambito. El resto ni se
    /// menciona: decir «ese no es suyo» confirma que existe.
    const suyos = await this.prisma.leadEntrante.findMany({
      where: {
        id: { in: unicos },
        convenioId: { in: ambito },
        estado: 'PENDIENTE',
        participanteId: null,
      },
      select: { id: true },
    });

    if (suyos.length > 0) {
      await this.prisma.leadEntrante.updateMany({
        where: { id: { in: suyos.map((l) => l.id) } },
        data: {
          estado: 'DESCARTADO',
          procesadoEn: new Date(),
          motivo: `Descartado por ${admin.nombre}: ${motivo}`,
        },
      });
    }

    this.log.log(
      `${suyos.length} lead(s) descartados por ${admin.correo}: ${motivo}`,
    );

    return {
      pedidos: unicos.length,
      descartados: suyos.length,
      /// Los que no se pudieron: ya atendidos, o de otro gremio.
      /// Se cuentan juntos a proposito -- distinguirlos diria
      /// cuales son del otro gremio, que es lo mismo que decir
      /// que existen.
      sinTocar: unicos.length - suyos.length,
    };
  }
}
