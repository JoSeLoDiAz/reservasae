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
import { registrarToqueDeOrigen } from '../crm/origen-del-lead';
import { accionQuePidio } from './accion-que-pidio';
import { generoQueDijo } from './genero-que-dijo';
import { ubicacionQueDijo } from './ubicacion-que-dijo';
import { llaveDelLead } from './llave-del-lead';
import { siglasAdmitidas, tipoDeDocumento } from './tipo-de-documento';

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
      select: {
        id: true,
        slug: true,
        /// Para resolver QUE CURSO pidio. Van las de este
        /// convenio y nada mas: el mismo codigo es otro curso
        /// en el otro gremio.
        acciones: { select: { id: true, codigo: true, visible: true } },
      },
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

    /// El tipo de documento, dicho como lo dice la gente.
    ///
    /// Se admite `CC`, `PPT`, el nombre entero o el numero. Se
    /// resuelve ANTES de limpiar porque de el depende la llave.
    const tipoDoc = tipoDeDocumento(dto.tipoDocumento ?? dto.tipoDocumentoSepId);
    if (dto.numeroDocumento?.trim() && tipoDoc === null) {
      throw new BadRequestException(
        'Mando un documento sin decir de que tipo, o con un tipo que no ' +
          `reconocemos. Use la sigla: ${siglasAdmitidas().slice(0, 6).join(', ')}...`,
      );
    }

    const datos = this.limpiar(dto, tipoDoc);
    const falta = this.queLeFalta(datos);

    /// Que curso pidio, si lo nombro.
    const pedida = accionQuePidio(dto.interes, convenio.acciones);

    /// Donde vive, resuelto contra el catalogo del SEP.
    ///
    /// Lo que no se reconozca NO tumba el lead: se apunta y se
    /// dice en `motivo`. Un webhook que contesta 400 porque no
    /// conoce un municipio invita a reintentar en bucle o a
    /// descartar el lead, y perderlo es peor que guardarlo
    /// incompleto.
    const donde = ubicacionQueDijo(dto.departamento, dto.ciudad);

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
    /// La llave: su id si lo trae, y si no el DOCUMENTO.
    ///
    /// El documento es la identidad en todo el sistema, asi que
    /// sirve de llave sin inventar una segunda regla. Va
    /// normalizado: `1.020.304.050` y `1020304050` tienen que
    /// dar la MISMA, o el reintento duplica.
    const llave = llaveDelLead(
      { ...dto, tipoDocumentoSepId: tipoDoc },
      pedida?.codigo ?? null,
    );
    if ('falta' in llave) throw new BadRequestException(llave.falta);
    const externoId = llave.llave;

    const ya = await this.prisma.leadEntrante.findUnique({
      where: {
        origenSistema_externoId: { origenSistema, externoId },
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
        externoId,
        origen: dto.origen ?? 'OTRO',
        nombreCompleto: datos.nombreCompleto,
        /// Tal como llegaron, si llegaron separadas.
        primerNombre: datos.piezasDelNombre?.primerNombre ?? null,
        segundoNombre: datos.piezasDelNombre?.segundoNombre ?? null,
        primerApellido: datos.piezasDelNombre?.primerApellido ?? null,
        segundoApellido: datos.piezasDelNombre?.segundoApellido ?? null,
        correo: datos.correo,
        celular: datos.celular,
        tipoDocumentoSepId: datos.tipoDocumentoSepId,
        numeroDocumento: datos.numeroDocumento,
        interes: dto.interes ?? null,
        /// Resuelta AL ENTRAR, como el celular. Nula si no
        /// nombra ninguna o si nombra una que este gremio no
        /// tiene: las dos cosas quedan igual y el asesor
        /// pregunta, que es mejor que meterlo en otro curso.
        accionFormacionId: pedida?.id ?? null,
        /// Donde vive, ya resuelto contra el catalogo del SEP.
        ///
        /// Se resuelve AL ENTRAR y no al convertir, por lo mismo
        /// que el celular: guardarlo como vino y limpiarlo
        /// despues deja el mismo sitio escrito de dos formas y
        /// nadie las relaciona.
        departamentoSepId: donde.departamentoSepId,
        municipioSepId: donde.municipioSepId,
        generoSepId: generoQueDijo(dto.genero),
        aceptaHabeasData: dto.aceptaHabeasData ?? null,
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
        `Lead ${externoId}: ${coincide.firme ? 'ya estaba' : 'se PARECE a uno'} ` +
          `(por ${coincide.por}). Queda propuesta para el asesor.`,
      );
      return {
        /// El id de la ficha, solo si de verdad se ató.
        ///
        /// Devolverlo en una coincidencia floja le diría a quien
        /// llama que el lead YA es esa persona — que es lo mismo
        /// que haberlo decidido, solo que por fuera.
        ...this.vista(
          coincide.firme
            ? { ...lead, participanteId: coincide.participanteId }
            : lead,
        ),
        repetido: false,
        yaEstaba: coincide.firme,
        encontradoPor: coincide.por,
        /// Hay a quién parecerse, pero falta confirmarlo.
        porConfirmar: !coincide.firme,
      };
    }

    this.log.log(
      `Lead ${externoId} de ${origenSistema} para ${convenio.slug}` +
        (falta.length ? ` — pendiente (${falta.join(', ')})` : ' — completo'),
    );

    return { ...this.vista(lead), repetido: false, yaEstaba: false };
  }

  /**
   * Varios leads de una vez, para cargar un historico.
   *
   * FILA A FILA y SIN transaccion, igual que la carga masiva del
   * panel y por lo mismo: en un lote de 500, que la 17 traiga un
   * documento invalido no puede tumbar las otras 499.
   *
   * Y se contesta fila por fila. Un lote que devuelve «ok» y se
   * traga trece errores es peor que mandar mil peticiones: quien
   * lo mando cree que entraron todos, y los trece se pierden sin
   * que nadie lo sepa nunca.
   */
  async entraLote(
    leads: EntraLeadDto[],
    origenSistema: string,
    delHost: string | null = null,
  ) {
    const filas: Array<Record<string, unknown>> = [];

    for (let i = 0; i < leads.length; i++) {
      /// La posicion viaja en la respuesta. Sin ella, «el 17
      /// fallo» obliga a contar a mano en un JSON de 500.
      const fila: Record<string, unknown> = { fila: i + 1 };
      try {
        const r = await this.entra(leads[i], origenSistema, delHost);
        Object.assign(fila, {
          ok: true,
          id: r.id,
          estado: r.estado,
          repetido: r.repetido,
          motivo: r.motivo ?? null,
        });
      } catch (e) {
        /// El error de ESA fila, no del lote. Se dice cual era
        /// el lead para poder encontrarlo en el origen.
        Object.assign(fila, {
          ok: false,
          porque: e instanceof Error ? e.message : String(e),
          documento: leads[i].numeroDocumento ?? null,
          externoId: leads[i].externoId ?? null,
        });
      }
      filas.push(fila);
    }

    const entraron = filas.filter((f) => f.ok && !f.repetido).length;
    const repetidos = filas.filter((f) => f.ok && f.repetido).length;
    const fallaron = filas.filter((f) => !f.ok).length;

    this.log.log(
      `Lote de ${leads.length} por ${origenSistema}: ` +
        `${entraron} nuevos, ${repetidos} repetidos, ${fallaron} con error.`,
    );

    return {
      recibidos: leads.length,
      entraron,
      repetidos,
      fallaron,
      /// Solo las que fallaron, arriba y aparte.
      ///
      /// Quien manda un lote de 500 no va a leer 500 filas para
      /// encontrar las 13 malas. Se le dan servidas, y la lista
      /// completa queda debajo para quien la quiera.
      errores: filas.filter((f) => !f.ok),
      filas,
    };
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
      /// Solo la coincidencia FIRME ata el lead a la ficha.
      ///
      /// `firme` se calculaba y no la leía nadie: se ataba
      /// `participanteId` y se marcaba CONVERTIDO con cualquier
      /// coincidencia, también con las del correo y el celular.
      /// El log decía «queda propuesta para el asesor» y la
      /// propuesta sí se creaba, pero la decisión ya estaba
      /// tomada: el lead quedaba pegado a esa persona.
      ///
      /// Y es justo el caso contra el que el fichero del cruce
      /// avisa: una familia comparte buzón y una empresa pone
      /// el correo de la secretaria en veinte formularios. Un
      /// lead nuevo caía sobre la ficha de otra persona.
      ///
      /// Con documento se ata; con correo o celular se deja
      /// PENDIENTE y la propuesta espera a que un asesor
      /// confirme, que es lo que el diseño decía y no hacía.
      await tx.leadEntrante.update({
        where: { id: leadId },
        data: coincide.firme
          ? {
              participanteId: coincide.participanteId,
              /// CONVERTIDO: este lead YA es una ficha. No se
              /// creó una nueva porque ya existía, que es justo
              /// lo que este cruce evita.
              estado: 'CONVERTIDO',
              motivo: porDondeSeEncontro(coincide),
            }
          : {
              /// Sin atar. El motivo dice a quién se PARECE,
              /// para que el asesor sepa dónde mirar.
              estado: 'PENDIENTE',
              motivo: `Posible repetido — ${porDondeSeEncontro(coincide)}. Confirme antes de unirlos.`,
            },
      });

      /// El toque se deja SIEMPRE, haya o no datos nuevos:
      /// que esta persona volviera por una pauta es la
      /// metrica que se pidio.
      await registrarToqueDeOrigen(
        tx,
        coincide.participanteId,
        esPauta ? 'REDES' : 'AUTOGESTION',
      );

      /// Pero el PRIMER origen no se pisa. A quien ya estaba
      /// —lo subio el community manager en una lista— la pauta
      /// no le quita el lead: consta que volvio por ahi, y a
      /// quien lo trajo se le sigue reconociendo.
      await tx.participante.updateMany({
        where: { id: coincide.participanteId, origenLead: null },
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
  private limpiar(dto: EntraLeadDto, tipoDoc: number | null) {
    const numero = dto.numeroDocumento
      ? normalizarDocumento(dto.numeroDocumento)
      : null;

    const celular = dto.celular ? normalizarCelular(dto.celular) : null;

    /// Las piezas mandan sobre la frase entera.
    ///
    /// Partir un nombre es adivinar: «Ana Maria Ruiz Gomez»
    /// pueden ser dos nombres y dos apellidos, o uno y tres.
    /// Si el emisor las manda separadas, ya no hay que adivinar
    /// -- y quien lleno el formulario si lo sabia.
    const enPiezas = [dto.nombres, dto.primerApellido, dto.segundoApellido]
      .map((x) => x?.trim())
      .filter(Boolean)
      .join(' ');

    return {
      nombreCompleto: enPiezas || dto.nombreCompleto?.trim() || null,
      /// Se guardan tambien sueltas: al convertir se usan tal
      /// cual en vez de volver a partir lo que ya venia partido.
      /// Los nombres llegan juntos y los apellidos separados,
      /// que es como los escribe la gente. Los dos nombres se
      /// parten aqui --«Ana Maria» -> «Ana» + «Maria»-- y eso SI
      /// se puede: lo dificil es saber donde acaban los nombres
      /// y empiezan los apellidos, y eso ya viene resuelto.
      piezasDelNombre: dto.primerApellido?.trim()
        ? (() => {
            const ns = (dto.nombres ?? '').trim().split(/\s+/).filter(Boolean);
            return {
              primerNombre: ns[0] ?? null,
              segundoNombre: ns.slice(1).join(' ') || null,
              primerApellido: dto.primerApellido!.trim(),
              segundoApellido: dto.segundoApellido?.trim() || null,
            };
          })()
        : null,
      correo: dto.correo?.trim().toLowerCase() || null,
      /// Vacio si no es un celular: guardar «no tiene» seria
      /// guardar algo que no sirve para llamar a nadie.
      celular: celular && celularValido(celular) ? celular : null,
      tipoDocumentoSepId: tipoDoc,
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
