/** Convertir un lead en ficha: lo hace un asesor, no el webhook. */

/**
 * La decisión que sostiene todo este fichero, y no es técnica.
 *
 * Un lead de un anuncio llenó un formulario de Facebook, no el
 * nuestro. Meta exige un enlace a la política, pero eso es un
 * enlace nuestro dentro de un formulario suyo: no es la
 * constancia que este sistema guarda —contra la versión exacta
 * del texto, con canal y evidencia— y que existe justamente para
 * poder demostrar qué leyó cada persona.
 *
 * Convertirlo automáticamente significaría crear una `Persona` y
 * consultarla en el RUI, que es un portal del Estado, sin nada
 * que demostrar. Y fabricar una `AutorizacionDatos` a partir del
 * clic en Facebook sería inventarse la prueba, que es peor que
 * no tenerla.
 *
 * Así que convertir es una acción de quien LLAMÓ: la persona
 * confirma, ahí hay autorización de verdad, y en la misma
 * transacción se crea la ficha y su constancia. El RUI va
 * después, nunca antes.
 */

import type { Admin } from '../../generated/prisma';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { documentoValido, normalizarDocumento } from '../comun/documento';
import {
  DEPARTAMENTO_POR_ID,
  DOCUMENTOS_DE_PERSONA,
  MUNICIPIO_POR_ID,
} from '../crm/catalogos-sep';
import { sedeQueTendra } from './sede-que-tendra';
import {
  dejarConstancia,
  politicaVigente,
} from '../crm/constancia-de-autorizacion';
import { CrmService } from '../crm/crm.service';
import { AQuienSeParece } from './a-quien-se-parece';
import {
  DeQuienEsEseDocumento,
  porQueNoEsSuya,
} from './de-quien-es-ese-documento';
import { partirNombreCompleto } from './cruzar-con-el-crm';
import { ColaRui } from '../crm/rui/cola-rui';
import { PrismaService } from '../prisma/prisma.service';

import type { ConvertirLeadDto } from './dto';
import {
  autorizoAlRegistrarse,
  evidenciaDelLead,
} from './listo-para-ficha';

@Injectable()
export class ConversionDeLeads {
  private readonly log = new Logger('Leads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly crm: CrmService,
    private readonly colaRui: ColaRui,
    private readonly seParece: AQuienSeParece,
    private readonly deQuienEs: DeQuienEsEseDocumento,
  ) {}

  /**
   * Convierte un lead en ficha.
   *
   * `sinConstancia` es para el lote, y solo para el lead que NO
   * llego por un formulario: a quien escribio por WhatsApp nadie
   * le enseño un texto que aceptar, asi que no hay autorizacion
   * que registrar. La ficha nace igual --crearla nunca ha exigido
   * autorizacion, solo matricular la exige-- y queda diciendo que
   * le falta.
   *
   * NO es un atajo para saltarse la constancia cuando la hay:
   * quien decide es `convertirDeLote`, mirando por donde entro.
   */
  /// `admin` null: lo convierte el sistema, no una persona.
  async convertir(
    leadId: string,
    dto: ConvertirLeadDto,
    admin: Admin | null,
    ambito: string[],
    ip?: string,
    opciones?: { sinConstancia?: boolean; asesorId?: string },
  ) {
    const quien = admin?.nombre ?? 'el sistema';

    /// Fuera del ámbito la fila NO EXISTE: 404 y no 403.
    ///
    /// Un 403 confirma que ese lead existe en el otro gremio, y
    /// eso es un oráculo. Misma regla que en formularios.
    const lead = await this.prisma.leadEntrante.findFirst({
      where: { id: leadId, convenioId: { in: ambito } },
      select: {
        id: true,
        convenioId: true,
        estado: true,
        participanteId: true,
        nombreCompleto: true,
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
        correo: true,
        celular: true,
        tipoDocumentoSepId: true,
        numeroDocumento: true,
        origen: true,
        interes: true,
        accionFormacionId: true,
        recibidoEn: true,
        departamentoSepId: true,
        municipioSepId: true,
        generoSepId: true,
        sedePedida: true,
      },
    });
    if (!lead) throw new NotFoundException('No existe ese lead.');

    if (lead.participanteId) {
      throw new ConflictException(
        'Este lead ya tiene ficha. Ábrala desde Gestión de leads.',
      );
    }

    /// El documento puede venir del lead o de la llamada.
    ///
    /// Casi nunca lo trae un anuncio, así que lo normal es que
    /// el asesor lo consiga hablando. Se admite por el cuerpo, y
    /// se valida con la MISMA regla del resto del sistema.
    const tipo = dto.tipoDocumentoSepId ?? lead.tipoDocumentoSepId;
    const crudo = dto.numeroDocumento ?? lead.numeroDocumento;
    const numero = crudo ? normalizarDocumento(crudo) : null;

    if (tipo === null || tipo === undefined || !numero) {
      throw new BadRequestException(
        'Falta el documento. Sin él no se puede crear la ficha: es la llave ' +
          'con la que la misma persona es la misma en todo el sistema.',
      );
    }
    if (!DOCUMENTOS_DE_PERSONA.some((t) => t.id === tipo)) {
      throw new BadRequestException('Ese tipo de documento no se admite aquí.');
    }
    if (!documentoValido(tipo, numero)) {
      throw new BadRequestException(
        'Ese número no tiene un formato válido para ese tipo de documento.',
      );
    }

    /// Sin política publicada NO se convierte, y es deliberado.
    ///
    /// Esta acción existe PARA dejar la constancia. Si no hay
    /// texto contra el que dejarla, convertir crearía una ficha
    /// que dice estar autorizada y no puede demostrarlo — que es
    /// exactamente lo que no puede pasar. El arreglo está a una
    /// pantalla: publicar la política del convenio.
    const politica = opciones?.sinConstancia
      ? null
      : await politicaVigente(this.prisma, lead.convenioId);
    if (!opciones?.sinConstancia && !politica) {
      throw new BadRequestException(
        'Este convenio no tiene política de tratamiento de datos publicada, ' +
          'así que no hay contra qué dejar la constancia. Publíquela en ' +
          'Configuración → Políticas y vuelva a intentarlo.',
      );
    }

    /// Las piezas que mando el emisor, si las mando.
    ///
    /// Volver a partir lo que ya venia partido cambia un dato
    /// cierto por uno adivinado -- y estas cuatro son columnas
    /// del reporte al SENA.
    const nombre = lead.primerApellido
      ? {
          primerNombre: lead.primerNombre ?? '',
          segundoNombre: lead.segundoNombre ?? undefined,
          primerApellido: lead.primerApellido,
          segundoApellido: lead.segundoApellido ?? undefined,
        }
      : partirNombreCompleto(lead.nombreCompleto ?? '');
    if (!nombre.primerNombre || !nombre.primerApellido) {
      throw new BadRequestException(
        'Falta el nombre o el apellido. Complételos en el lead antes de convertirlo.',
      );
    }

    /// ¿DE QUIÉN ES ESA CÉDULA?
    ///
    /// Va aquí, después de tener el nombre y ANTES de crear nada:
    /// `crm.crear` hace `upsert` por (tipo, número), así que un
    /// dígito mal reutiliza la Persona de un tercero y le pisa el
    /// correo, el celular y el domicilio con los de este lead. Eso
    /// no se deshace con un botón.
    ///
    /// Es el caso que previó el cliente: «puede ser que lo pongan
    /// mal». Se comprueba en LA QUE MANDA, no solo en la pantalla.
    const deQuien = await this.deQuienEs.mirar(
      tipo,
      numero,
      [
        nombre.primerNombre,
        nombre.segundoNombre,
        nombre.primerApellido,
        nombre.segundoApellido,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (deQuien.que === 'ES_DE_OTRO') {
      throw new ConflictException(porQueNoEsSuya(deQuien.pista));
    }

    /// LA SEDE, que es lo que faltaba para poder matricular.
    ///
    /// `Oferta` es accion x ubicacion: con el curso solo se sabe
    /// QUE quiere y no DONDE lo va a tomar, asi que la ficha
    /// nacia con la accion puesta y el panel decia «falta la
    /// sede». Con el domicilio ya se puede elegir.
    ///
    /// Si ninguna sede lo cubre queda en null y la ficha nace
    /// solo con la accion, que es lo correcto: asignarle una
    /// sede donde no puede ir seria peor que dejarla sin sede.
    const oferta = lead.accionFormacionId
      ? await this.sedeDelLead(lead)
      : null;

    /// Se crea con `crm.crear`, no con un `persona.create` de
    /// aquí. Es la MISMA puerta que usa el asesor desde el
    /// panel: una tercera forma de crear una persona sería una
    /// tercera regla, y ya sabemos cómo acaban.
    const ficha = await this.crm.crear(
      {
        convenioId: lead.convenioId,
        tipoDocumentoSepId: tipo,
        numeroDocumento: numero,
        primerNombre: nombre.primerNombre,
        segundoNombre: nombre.segundoNombre ?? undefined,
        primerApellido: nombre.primerApellido,
        segundoApellido: nombre.segundoApellido ?? undefined,
        correo: lead.correo ?? undefined,
        celular: lead.celular ?? undefined,
        origen: lead.origen,
        /// El curso que pidio, sin sede: un lead no dice donde
        /// vive, asi que no hay con que elegir la oferta. Sin
        /// esto la ficha nacia sin curso y el dato se perdia --
        /// justo el que la mesa usa para saber si esta listo.
        accionFormacionId: lead.accionFormacionId ?? undefined,
        /// La sede, si alguna lo cubre. Con ella la ficha nace
        /// pudiendo matricularse; sin ella, el panel dice que
        /// falta y el asesor la resuelve al llamar.
        ofertaId: oferta?.id,
        generoSepId: lead.generoSepId ?? undefined,
        departamentoSepId: lead.departamentoSepId ?? undefined,
        municipioSepId: lead.municipioSepId ?? undefined,
        /// A quien lo va a llamar, no a quien pulso el boton.
        ///
        /// `crm.crear` cae en `admin.id` si no viene nadie, y en
        /// un lote de cien eso es asignarselas todas a quien las
        /// importo. Un lote se reparte.
        asesorId: opciones?.asesorId,
      },
      admin,
      ambito,
      ip,
      /// El RUI lo encolamos NOSOTROS, despues de la constancia.
      /// `crear` lo hacia por dentro, asi que la cedula salia
      /// hacia el portal del DNP antes de que hubiera nada que
      /// demostrar -- lo contrario de lo que este fichero dice
      /// hacer dos lineas mas abajo.
      { encolarRui: false },
    );

    const participanteId = (ficha as { id: string }).id;
    const personaId = (ficha as { personaId: string }).personaId;

    /// La constancia, con el canal y la prueba que dio el
    /// asesor. Sin esto la ficha nace sin autorización y no se
    /// puede matricular ni reportar -- que es correcto, pero
    /// entonces convertir no habría servido de nada.
    const constancia = opciones?.sinConstancia
      ? 'SIN_AUTORIZACION'
      : await dejarConstancia(this.prisma, {
          personaId,
          convenioId: lead.convenioId,
          canal: dto.canal,
          evidencia: dto.evidencia,
          ip,
        });

    await this.prisma.leadEntrante.update({
      where: { id: lead.id },
      data: {
        participanteId,
        estado: 'CONVERTIDO',
        procesadoEn: new Date(),
        motivo: opciones?.sinConstancia
          ? `Convertido por ${quien}. SIN autorización de datos: ` +
            'no llegó por un formulario, hay que pedírsela.'
          : `Convertido por ${quien}. Autorizó por ${dto.canal}.`,
      },
    });

    /// Las llamadas que costo conseguir la cedula pasan a la ficha.
    ///
    /// Se RELLENA `participanteId` y NO se borra `leadId`: la nota
    /// queda colgando de los dos, que es lo que hace continuo el
    /// rastro. Con las dos columnas, `gestionDe()` cuenta los
    /// intentos desde el ultimo contacto sin tocar una linea, y la
    /// mesa sigue enseñando el historial del lead.
    ///
    /// Sin esto, el trabajo de conseguir el documento por telefono
    /// desaparecia justo al convertir -- y era el trabajo entero.
    await this.prisma.notaDeGestion.updateMany({
      where: { leadId: lead.id, participanteId: null },
      data: { participanteId },
    });

    /// El RUI, AHORA y no antes.
    ///
    /// Es una consulta a un portal del Estado sobre una persona.
    /// Hacerla antes de que exista la autorización sería
    /// consultarla sin permiso, y el orden es toda la diferencia.
    try {
      await this.colaRui.encolarSiHaceFalta(personaId);
    } catch (e) {
      this.log.warn(
        `Ficha creada pero no se pudo encolar el RUI: ` +
          (e instanceof Error ? e.message : String(e)),
      );
    }

    this.log.log(
      `Lead ${lead.id} convertido en ficha ${participanteId} por ${quien} ` +
        `(autorización: ${dto.canal}, constancia: ${constancia}).`,
    );

    return {
      participanteId,
      constancia,
      conAutorizacion: constancia === 'REGISTRADA' || constancia === 'YA_TENIA',
    };
  }

  /**
   * La conversion del lote: la autorizacion NO la teclea nadie.
   *
   * Esto es lo que separa esta constancia de un invento. Al asesor
   * no se le pide que afirme nada sobre cien personas: se mira por
   * donde entro CADA lead y, si fue por un formulario --el de una
   * pauta de Meta o el nuestro, donde no se puede enviar sin
   * aceptar la politica--, la evidencia sale de su propio registro:
   * el id que le dio el emisor, cuando llego y por donde. El cuerpo
   * entero de esa peticion sigue guardado en su `carga`.
   *
   * Cien constancias distintas, cada una apuntando a su prueba. No
   * una frase estampada cien veces, que es lo que este archivo
   * lleva advirtiendo desde que existe la mesa de entrada.
   */
  /// `asesorId` y `admin` en null: lo hace el sistema y la
  /// ficha nace sin dueño, en el montón común.
  async convertirDeLote(
    leadId: string,
    asesorId: string | null,
    admin: Admin | null,
    ambito: string[],
    ip?: string,
  ) {
    const lead = await this.prisma.leadEntrante.findFirst({
      where: { id: leadId, convenioId: { in: ambito } },
      select: {
        id: true,
        externoId: true,
        origen: true,
        origenSistema: true,
        recibidoEn: true,
        convenioId: true,
        tipoDocumentoSepId: true,
        numeroDocumento: true,
        aceptaHabeasData: true,
        /// Para cruzar la revocacion tambien por aqui: un lead de
        /// pauta no trae cedula y solo con ella no se comprueba
        /// nada.
        correo: true,
        celular: true,
      },
    });
    if (!lead) throw new NotFoundException('Ese lead no existe.');

    /// Lo que la persona MARCO manda sobre la puerta por la que
    /// entro. Un `false` explicito no se convierte en constancia
    /// ni viniendo de un formulario.
    const porFormulario = autorizoAlRegistrarse(
      lead.origen,
      lead.aceptaHabeasData,
    );

    /// Y si revoco DESPUES de registrarse, manda la revocacion.
    ///
    /// La autorizacion de este lead es un hecho del pasado: la dio
    /// al llenar el formulario. Si mas tarde pidio que dejaran de
    /// usar sus datos, escribirla ahora resucitaria en silencio un
    /// derecho que ya ejercio -- y `dejarConstancia` no lo ve,
    /// porque solo mira las que siguen vivas.
    const revocoDespues = porFormulario
      ? await this.revocoDespuesDe(lead, lead.recibidoEn)
      : false;

    const conConstancia = porFormulario && !revocoDespues;

    return this.convertir(
      leadId,
      {
        /// Lleno el formulario: ese es el canal, literalmente.
        canal: 'FORMULARIO_WEB' as ConvertirLeadDto['canal'],
        evidencia: evidenciaDelLead(lead),
      } as ConvertirLeadDto,
      admin,
      ambito,
      ip,
      { sinConstancia: !conConstancia, asesorId: asesorId ?? undefined },
    );
  }

  /// ¿Revoco despues de esta fecha?
  ///
  /// Buscaba SOLO por documento y salia con `false` sin mirar
  /// cuando el lead no traia cedula. O sea que para el caso que
  /// mas importa --el lead de pauta sin documento, que es todo
  /// este encargo-- la comprobacion era un no-op: un control en
  /// pie y vacio de efecto, como la casilla de habeas data que
  /// se guardaba y no leia nadie.
  ///
  /// Ahora cruza tambien por correo y celular, con las mismas
  /// llaves que usa `cruzarConElCrm` para reconocer a alguien.
  private async revocoDespuesDe(
    lead: {
      tipoDocumentoSepId: number | null;
      numeroDocumento: string | null;
      correo: string | null;
      celular: string | null;
    },
    desde: Date,
  ): Promise<boolean> {
    return this.seParece.revoco(lead, desde);
  }

  /**
   * La sede que le toca, contra donde vive.
   *
   * Se traen SOLO las ofertas de su accion —no las 106— y se
   * elige con `sedeQueLeToca`, que es la misma regla de la ficha
   * del asesor: dos formas de elegir sede acaban eligiendo sedes
   * distintas para la misma persona.
   */
  private async sedeDelLead(lead: {
    accionFormacionId: string | null;
    departamentoSepId: number | null;
    municipioSepId: number | null;
    sedePedida?: string | null;
  }) {
    if (!lead.accionFormacionId) return null;

    const ofertas = await this.prisma.oferta.findMany({
      where: { accionFormacionId: lead.accionFormacionId },
      select: {
        id: true,
        accionFormacionId: true,
        cuposMaximos: true,
        cuposOcupados: true,
        ubicacion: {
          select: { nombre: true, tipo: true, departamento: true },
        },
      },
    });

    /// Los NOMBRES, que es con lo que compara `cubreA`.
    ///
    /// El lead guarda ids del SEP y la cobertura se decide por
    /// nombre normalizado, porque `Ubicacion` no lleva codigo
    /// DANE. Traducir aqui es lo que junta las dos mitades.
    const vive = {
      departamento: lead.departamentoSepId
        ? (DEPARTAMENTO_POR_ID.get(lead.departamentoSepId)?.etiqueta ?? null)
        : null,
      ciudad: lead.municipioSepId
        ? (MUNICIPIO_POR_ID.get(lead.municipioSepId)?.[2] ?? null)
        : null,
    };

    /// La decision entera vive en `sedeQueTendra`, no aqui.
    ///
    /// Tenerla aqui dejaba a la mesa con media --deducia del
    /// domicilio y no miraba `sedePedida`--, asi que pintaba una
    /// sede y la conversion elegia otra. Comprobado en vivo.
    return sedeQueTendra(lead, ofertas, vive);
  }
}
