/** La mesa de entrada: recibir un lead y decidir qué hacer. */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import type { AvisoDeMeta } from './meta';
import {
  cruzarConElCrm,
  partirNombreCompleto,
  porDondeSeEncontro,
  type Coincidencia,
} from './cruzar-con-el-crm';
import { Prisma } from '../../generated/prisma';
import { celularValido, normalizarCelular } from '../comun/celular';
import { documentoValido, normalizarDocumento } from '../comun/documento';
import { DOCUMENTOS_DE_PERSONA } from '../crm/catalogos-sep';
import { ColaRui } from '../crm/rui/cola-rui';
import { PrismaService } from '../prisma/prisma.service';

import type { EntraLeadDto } from './dto';

/// Lo que el CRM necesita para que un lead sea una ficha.
type Faltante = string;

/// Los conectores que traen leads PAGADOS.
///
/// Se mira quien lo manda —la cabecera `x-origen-sistema`— y
/// no lo que venga en el cuerpo. Si viniera en el JSON, quien
/// llama podria marcarse sus propios leads como pauta, y la
/// metrica de cuanto cuesta un inscrito dejaria de valer justo
/// para lo que se creo.
const SISTEMAS_DE_PAUTA = ['meta', 'facebook', 'instagram', 'pauta', 'ads'];

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
  async entra(
    dto: EntraLeadDto,
    origenSistema: string,
    /// El gremio que dice la DIRECCION, si el host es de uno.
    delHost: string | null = null,
  ) {
    /// El gremio: primero el SUBDOMINIO, y si no, el cuerpo.
    ///
    /// `adecopria.reservasae.com/api/webhooks/leads` dice de
    /// quien es el lead en la propia URL, que es como el resto
    /// del sistema resuelve el gremio y se equivoca menos que un
    /// campo dentro del JSON.
    ///
    /// Si vienen los DOS y no coinciden se rechaza, no se elige
    /// uno: mandar a la URL de ADECOPRIA un cuerpo que dice
    /// britcham-adee es una contradiccion, y resolverla en
    /// silencio es exactamente como un lead acaba en el gremio
    /// equivocado. Ver «Un subdominio por gremio» en CLAUDE.md.
    const slug = delHost ?? dto.convenio;
    if (delHost && dto.convenio && dto.convenio !== delHost) {
      throw new BadRequestException(
        `La direccion dice «${delHost}» y el cuerpo dice «${dto.convenio}». ` +
          'No se adivina cual: mande uno de los dos, o los dos iguales.',
      );
    }
    if (!slug) {
      throw new BadRequestException(
        'Falta el convenio. Mandelo en el cuerpo, o llame al subdominio del ' +
          'gremio: adecopria.reservasae.com o britcham-adee.reservasae.com.',
      );
    }

    const convenio = await this.prisma.convenio.findFirst({
      where: { slug, activo: true },
      select: { id: true, slug: true },
    });
    /// El gremio va explicito y no se adivina.
    ///
    /// Son dos convenios y adivinarlo mal mete a una persona de
    /// ADECOPRIA en BRITCHAM, que es peor que perder el lead.
    if (!convenio) {
      throw new BadRequestException(
        `«${slug}» no es una convocatoria activa. Mande el slug: adecopria o britcham-adee.`,
      );
    }

    const datos = this.limpiar(dto);
    const falta = this.queLeFalta(datos);

    /// Pagado u orgánico, y lo decide QUIÉN LO MANDA, no el
    /// cuerpo. Si viniera en el JSON, quien llama podría
    /// marcarse sus propios leads como pauta y la métrica de
    /// cuánto cuesta un inscrito dejaría de valer.
    const esPauta = SISTEMAS_DE_PAUTA.some((x: string) =>
      origenSistema.toLowerCase().includes(x),
    );

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

    /// EL CRUCE contra Gestión de leads. Es la mitad que
    /// faltaba: sin esto el lead se quedaba en su buzón y
    /// nadie se enteraba.
    const coincide = await cruzarConElCrm(this.prisma, convenio.id, {
      tipoDocumentoSepId: datos.tipoDocumentoSepId,
      numeroDocumento: datos.numeroDocumento,
      correo: datos.correo,
      celular: datos.celular,
    });

    if (coincide) {
      await this.avisarQueYaEstaba(lead.id, coincide, datos, esPauta);
      this.log.log(
        `Lead ${dto.externoId}: ya estaba (por ${coincide.por}). ` +
          'Queda propuesta para el asesor.',
      );
      return {
        ...this.vista({ ...lead, participanteId: coincide.participanteId }),
        repetido: false,
        yaEstaba: true,
        encontradoPor: coincide.por,
      };
    }

    this.log.log(
      `Lead ${dto.externoId} de ${origenSistema} para ${convenio.slug}` +
        (falta.length ? ` — pendiente (${falta.join(', ')})` : ' — completo'),
    );

    return { ...this.vista(lead), repetido: false, yaEstaba: false };
  }

  /**
   * Los avisos que manda Meta, guardados sin perder ninguno.
   *
   * Meta NO manda los datos de la persona: manda un
   * `leadgen_id` y ya. Para saber cómo se llama hay que volver
   * a llamar a su Graph API con un token de la página, y ese
   * token puede no estar puesto todavía.
   *
   * Por eso el aviso se guarda SIEMPRE, con o sin token: un
   * lead pagado que se pierde porque a nosotros nos faltaba
   * una credencial es plata tirada. Queda PENDIENTE con su
   * `leadgen_id`, y completarlo después es una consulta más.
   *
   * Y se contesta 200 pase lo que pase: Meta reintenta cuando
   * no recibe 200, y si insiste sin éxito APAGA el webhook. Un
   * aviso que no entendemos no puede costar que dejen de
   * llegar los que sí.
   */
  async deMeta(avisos: AvisoDeMeta[], slugDelHost: string | null = null) {
    if (avisos.length === 0) {
      /// Meta manda por este mismo webhook cosas que no son
      /// leads. No es un error y no se registra como tal.
      return { recibidos: 0, guardados: 0 };
    }

    /// A qué convenio entran los leads de Meta.
    ///
    /// Va en el entorno y no se adivina: son dos gremios, y
    /// meter a alguien de ADECOPRIA en BRITCHAM es peor que
    /// dejar el lead esperando.
    /// El gremio lo dice el SUBDOMINIO por el que entro.
    ///
    /// Antes salia de `META_CONVENIO_SLUG`, una variable con un
    /// solo valor — o sea que solo UN gremio podia recibir
    /// leads de Meta, nunca los dos. Con una app por gremio,
    /// cada una tiene su URL de devolucion y la direccion ya
    /// dice de quien es el lead.
    const slug = slugDelHost;
    const convenio = slug
      ? await this.prisma.convenio.findFirst({
          where: { slug, activo: true },
          select: { id: true, slug: true },
        })
      : null;

    if (!convenio) {
      /// NO se pierde: se avisa fuerte y se contesta 200 para
      /// que Meta no apague el webhook. Lo que falta es
      /// configuración nuestra, no un problema de ellos.
      this.log.error(
        `Llegaron ${avisos.length} leads de Meta` +
          (slug
            ? ` por el subdominio «${slug}», que no es una convocatoria activa.`
            : ' por la direccion general, que no dice de que gremio son. ' +
              'Meta tiene que llamar al subdominio del gremio.') +
          ' NO se guardaron. Corrijalo y pidale a Meta que los reenvie.',
      );
      return { recibidos: avisos.length, guardados: 0, sinConvenio: true };
    }

    let guardados = 0;
    for (const aviso of avisos) {
      /// Uno a uno y con su propio try: si el tercero falla,
      /// los dos primeros ya están guardados. Un lote entero
      /// perdido por una fila mala es lo que no puede pasar.
      try {
        await this.prisma.leadEntrante.upsert({
          where: {
            origenSistema_externoId: {
              origenSistema: 'meta',
              externoId: aviso.leadgenId,
            },
          },
          /// Si ya estaba, no se toca: Meta reintenta y un
          /// reintento no puede duplicar ni pisar lo que ya se
          /// completó.
          update: {},
          create: {
            convenioId: convenio.id,
            origenSistema: 'meta',
            externoId: aviso.leadgenId,
            origen: 'FACEBOOK',
            carga: {
              leadgenId: aviso.leadgenId,
              formularioId: aviso.formularioId,
              paginaId: aviso.paginaId,
              anuncioId: aviso.anuncioId,
              creadoEn: aviso.creadoEn?.toISOString() ?? null,
            } as Prisma.InputJsonValue,
            motivo:
              'Meta solo manda el identificador. Faltan sus datos: hay que ' +
              'pedírselos a la Graph API con el token de la página.',
          },
        });
        guardados += 1;
      } catch (e) {
        this.log.error(
          `No se pudo guardar el lead ${aviso.leadgenId} de Meta: ` +
            (e as Error).message,
        );
      }
    }

    this.log.log(`Meta: ${guardados} de ${avisos.length} avisos guardados.`);
    return { recibidos: avisos.length, guardados };
  }

  /**
   * Ya estaba: NO se pisa nada, se deja una propuesta.
   *
   * Es lo que el dueño pidió con «le va a salir la ventana de
   * los datos que puede cambiar»: la misma pieza que usa el
   * enlace de completar datos, y la misma pantalla donde el
   * asesor escoge campo por campo.
   *
   * Se marca el origen en la ficha AUNQUE no se toque nada
   * más. Saber que esa persona volvió por una pauta es la
   * métrica que se pidió, y no depende de que el asesor
   * acepte los datos nuevos.
   */
  private async avisarQueYaEstaba(
    leadId: string,
    coincide: Coincidencia,
    datos: ReturnType<LeadsService['limpiar']>,
    esPauta: boolean,
  ): Promise<void> {
    const actual = await this.prisma.persona.findUnique({
      where: { id: coincide.personaId },
      select: {
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
        correo: true,
        celular: true,
      },
    });
    if (!actual) return;

    /// Solo lo que es DISTINTO. Proponerle al asesor un campo
    /// que ya dice lo mismo es hacerle decidir sobre nada.
    const nombre = datos.nombreCompleto
      ? partirNombreCompleto(datos.nombreCompleto)
      : null;

    const llega: Record<string, unknown> = {
      correo: datos.correo ?? undefined,
      celular: datos.celular ?? undefined,
      primerNombre: nombre?.primerNombre || undefined,
      segundoNombre: nombre?.segundoNombre ?? undefined,
      primerApellido: nombre?.primerApellido || undefined,
      segundoApellido: nombre?.segundoApellido ?? undefined,
    };

    const distintos: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(llega)) {
      if (valor === undefined) continue;
      if ((actual as Record<string, unknown>)[campo] === valor) continue;
      distintos[campo] = valor;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.leadEntrante.update({
        where: { id: leadId },
        data: {
          participanteId: coincide.participanteId,
          /// CONVERTIDO: este lead YA es una ficha. No se creó
          /// una nueva porque ya existía, que es justo lo que
          /// este cruce evita —el solapamiento de leads.
          estado: 'CONVERTIDO',
          motivo: porDondeSeEncontro(coincide),
        },
      });

      /// El origen se marca SIEMPRE, haya o no datos nuevos.
      await tx.participante.update({
        where: { id: coincide.participanteId },
        data: { origenLead: esPauta ? 'PAUTA' : 'ORGANICO' },
      });

      if (Object.keys(distintos).length > 0) {
        /// Una pendiente por ficha: la última es la que vale.
        await tx.propuestaDeDatos.deleteMany({
          where: {
            participanteId: coincide.participanteId,
            estado: 'PENDIENTE',
          },
        });
        await tx.propuestaDeDatos.create({
          data: {
            participanteId: coincide.participanteId,
            campos: distintos as Prisma.InputJsonValue,
          },
        });
      }
    });
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
