/** Que el formulario público cree un NEGOCIO, no una reserva. */

/**
 * Lo que reemplaza esto.
 *
 * Hasta hoy el formulario público terminaba en
 * `preinscripcion.service`, creando un `Participante` atado a una
 * oferta: una reserva de cupos. Eso describe otro negocio —el que
 * ya no hacemos— y por eso el embudo estaba vacío mientras el
 * formulario recibía gente todos los días.
 *
 * Aquí entra un LEAD y sale una OPORTUNIDAD en CAPTADO: un negocio
 * con dueño por asignar y un reloj corriendo.
 *
 * TRES REGLAS QUE MANDAN SOBRE TODO LO DEMÁS, porque esta ruta es
 * pública y no hay sesión que la acote:
 *
 * 1. **El ámbito lo fija el slug.** En el panel, cada consulta se
 *    acota con `convenioId: { in: ambito.convenios }`. Aquí no hay
 *    ámbito porque no hay sesión, así que la protección es que el
 *    `convenioId` NO EXISTA en el cuerpo: sale del formulario
 *    resuelto contra la base, y toda consulta cuelga de él. Lo que
 *    no se puede mandar no hay que comprobarlo.
 * 2. **El slug se resuelve contra la base, siempre.** Una lista de
 *    slugs escrita en el código ya dejó mudo al webhook de leads:
 *    se desincronizó al renombrar las unidades de negocio y empezó
 *    a rechazar con 400 slugs que SÍ existían. Ver `leads/dto.ts`.
 * 3. **Antes de escribir nada se comprueba todo.** Rechazar después
 *    de guardar deja los datos dentro de todas formas, que es el
 *    daño entero.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  CanalAutorizacion,
  OrigenParticipante,
  Prisma,
  TipoEmbudo,
  TipoGestion,
  type Admin,
} from '../../generated/prisma';
import {
  DOCUMENTOS_DEL_FORMULARIO,
  DOCUMENTOS_DE_PERSONA,
} from '../crm/catalogos-sep';
import {
  dejarConstancia,
  politicaVigente,
} from '../crm/constancia-de-autorizacion';
import {
  documentoValido,
  nombreCompleto,
  normalizarDocumento,
  sugerirNombre,
  type NombrePartido,
} from '../comun/documento';
import { normalizarNit } from '../comun/nit';
import { FormulariosService } from '../formularios/formularios.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaptarDto } from './dto';
import { embudoDelFormulario, pideElNit } from './embudo-del-formulario';
import { hayComoResponder, type ComoResponder } from './hay-como-responder';
import { queHacerCon } from './no-duplicar';

/// A quién se le vende, ya resuelto contra la base.
type Titular = {
  personaId: string | null;
  empresaId: string | null;
  /// Cómo se le nombra en la tarea del asesor.
  comoSeLlama: string;
  /// Lo que trajo hoy y NO se escribió encima de lo guardado.
  loQueNoSePiso: string[];
};

/// Qué pasó con la constancia de la Ley 1581.
type Constancia = 'REGISTRADA' | 'YA_TENIA' | 'SIN_POLITICA' | 'SIN_PERSONA';

@Injectable()
export class CaptacionService {
  private readonly log = new Logger('Captacion');

  constructor(
    private readonly prisma: PrismaService,
    private readonly formularios: FormulariosService,
    private readonly oportunidades: OportunidadesService,
  ) {}

  /**
   * El formulario, resuelto por su slug.
   *
   * `publicado` y `convenio.activo` van en el `where` y no en un
   * `if` posterior: un formulario en borrador y uno de una cuenta
   * apagada tienen que ser indistinguibles de uno que no existe.
   * Decir «existe, pero está en borrador» le confirma a un
   * desconocido qué estamos preparando.
   */
  private async resolver(slug: string) {
    const formulario = await this.prisma.formulario.findFirst({
      where: { slug, publicado: true, convenio: { activo: true } },
      select: {
        id: true,
        slug: true,
        titulo: true,
        descripcion: true,
        mensajeExito: true,
        convenioId: true,
        convenio: { select: { slug: true, nombre: true, sigla: true } },
        /// Solo el campo del núcleo: es lo único que decide, y
        /// traerse las preguntas enteras sería traerse el
        /// formulario dos veces.
        preguntas: {
          where: { archivada: false },
          select: { campoNucleo: true },
        },
      },
    });

    if (!formulario) {
      throw new NotFoundException(
        'No hay un formulario publicado con ese identificador.',
      );
    }
    return formulario;
  }

  /**
   * Lo que la página pinta.
   *
   * Las preguntas las arma `FormulariosService`, que es de donde
   * salen también las de una reserva: dos vistas del mismo
   * formulario se separarían al primer campo nuevo.
   *
   * Lo que se añade encima es lo que el constructor de formularios
   * no sabe preguntar. Su catálogo de campos del núcleo
   * —`CampoNucleo`— se hizo para reservar cupos: tiene NIT, razón
   * social y contacto, pero no tiene el documento de la persona.
   * Captar sí lo necesita, así que la lista de tipos y a quién se le
   * exige viajan con el formulario. La página NO lleva su propia
   * copia: sería la lista escrita a mano de siempre.
   */
  async formulario(slug: string) {
    const cual = await this.resolver(slug);
    const campos = cual.preguntas.map((p) => p.campoNucleo);
    const embudo = embudoDelFormulario(campos);

    const vista = await this.formularios.obtenerPublico(slug);

    /// La versión vigente la decide la MISMA función que la exige
    /// al recibir, y el texto se busca por su id. Con dos consultas
    /// distintas, la persona podría leer la v3 y firmar la v4.
    const vigente = await politicaVigente(this.prisma, cual.convenioId);
    const politica = vigente
      ? await this.prisma.politicaDatos.findUnique({
          where: { id: vigente.id },
          select: { id: true, version: true, titulo: true, contenido: true },
        })
      : null;

    /// La unidad de negocio no se añade aparte: ya viaja en
    /// `vista.convenio`. Mandarla dos veces con dos nombres es
    /// invitar a que la página lea una y el panel escriba la otra.
    return {
      ...vista,
      embudo,
      /// El texto ENTERO, no un enlace: la pantalla lo muestra antes
      /// de que nadie marque nada, y un enlace que casi nadie abre
      /// no alcanza para decir que lo leyó.
      politica,
      pide: {
        nit: pideElNit(campos),
        /// En el embudo de personas el negocio ES la persona: sin
        /// documento no hay a quién venderle ni a nombre de quién
        /// dejar la autorización.
        documento: embudo === TipoEmbudo.PERSONA,
      },
      tiposDeDocumento: DOCUMENTOS_DEL_FORMULARIO,
    };
  }

  /**
   * Lo que llegó por el formulario, convertido en negocio.
   *
   * El orden de esta función ES la función: cada comprobación está
   * donde está porque moverla hacia abajo deja guardado algo que no
   * debería haber entrado.
   */
  async captar(slug: string, dto: CaptarDto, ip?: string) {
    const formulario = await this.resolver(slug);
    const embudo = embudoDelFormulario(
      formulario.preguntas.map((p) => p.campoNucleo),
    );

    /// 1. ¿Hay con qué responderle? Va primero porque es lo que
    /// decide si esto le sirve a alguien.
    const contacto = hayComoResponder(dto);
    if (!contacto.puede) {
      throw new BadRequestException(contacto.porque);
    }

    /// 2. La Ley 1581, antes de tocar la base.
    const politica = await this.exigirAutorizacion(formulario.convenioId, dto);

    /// 3. Las respuestas libres, contra las preguntas publicadas:
    /// obligatorias, opciones válidas y largos, con el MISMO código
    /// que valida una reserva. No se guardan como `Respuesta` —esa
    /// tabla cuelga de una reserva de cupos, que aquí no hay— sino
    /// en la primera gestión, que es donde el asesor las va a leer.
    const { respuestas } = await this.formularios.prepararRespuestas(
      slug,
      dto.respuestas ?? [],
      formulario.convenioId,
    );

    /// 4. De quién es el negocio.
    const titular = await this.titularDe(embudo, dto, contacto);

    /// 5. La constancia, a nombre de quien se identificó.
    const constancia = await this.dejarLaConstancia(
      titular.personaId,
      formulario,
      ip,
    );

    const ahora = new Date();
    const nota = this.notaDe({
      formulario,
      dto,
      contacto,
      titular,
      respuestas,
      politica,
      constancia,
      ip,
    });

    /**
     * 6. ¿Esto ya lo teníamos?
     *
     * El filtro del titular se arma explícito y NUNCA con un
     * `undefined`: `{ personaId: undefined }` no acota nada, y esta
     * consulta devolvería la oportunidad de cualquier otra persona
     * de la cuenta —que después se le entregaría como suya a quien
     * acaba de escribir—.
     */
    const suyo = titular.empresaId
      ? { empresaId: titular.empresaId }
      : { personaId: titular.personaId as string };

    const anteriores = await this.prisma.oportunidad.findMany({
      where: { convenioId: formulario.convenioId, embudo, ...suyo },
      orderBy: { creadoEn: 'desc' },
      take: 20,
      select: {
        id: true,
        codigo: true,
        etapa: true,
        creadoEn: true,
        ultimoToqueEn: true,
      },
    });

    const veredicto = queHacerCon(anteriores, ahora);

    if (veredicto.que === 'EL_MISMO_ENVIO') {
      /// Ni una fila ni una nota: fue el mismo acto. Se le devuelve
      /// su referencia como si acabara de crearse, porque para quien
      /// escribió eso es exactamente lo que pasó.
      this.log.log(
        `Envío repetido en ${formulario.slug}: ya existe ${veredicto.codigo}`,
      );
      return this.gracias(formulario, veredicto.codigo);
    }

    if (veredicto.que === 'EL_MISMO_NEGOCIO') {
      /// Volver a escribir SÍ se anota: es de las pocas señales que
      /// tiene el asesor de que el interés sigue vivo, y trae lo que
      /// la persona contestó esta vez, que puede no ser lo mismo.
      ///
      /// Lo que NO se toca es `ultimoToqueEn`. Ese reloj mide si
      /// NOSOTROS la estamos trabajando, y que el cliente escriba no
      /// es que nadie la haya trabajado: moverlo la sacaría de la
      /// lista de frías justo cuando más falta hace que salga.
      await this.anotar(
        veredicto.id,
        `Volvió a escribir por «${formulario.titulo}»`,
        nota,
        ahora,
      );
      return this.gracias(formulario, veredicto.codigo);
    }

    const creada = await this.oportunidades.crear(
      {
        embudo,
        titulo: formulario.titulo.slice(0, 160),
        convenioId: formulario.convenioId,
        personaId: titular.personaId,
        empresaId: titular.empresaId,
        /// Por omisión AUTOGESTION: «llegó por el formulario
        /// público», que es lo que `origenDeLead` cuenta como
        /// orgánico. Sin esto, todo lo captado se atribuiría a un
        /// asesor —el valor por defecto de la columna— y la pauta
        /// pagada no aparecería como origen de nada.
        origen: dto.origen ?? OrigenParticipante.AUTOGESTION,
        campana: dto.campana ?? null,
        leadId: await this.leadDeEstaCuenta(dto.leadId, formulario.convenioId),
      },
      this.elFormulario(formulario.titulo),
    );

    await this.anotar(
      creada.id,
      `Contactar a ${titular.comoSeLlama}`,
      nota,
      ahora,
    );

    return this.gracias(formulario, creada.codigo);
  }

  /**
   * La casilla, y contra qué versión se marcó.
   *
   * Sin política publicada NO se capta, igual que en una reserva
   * pública. Es duro —se pierden leads mientras alguien la
   * publica— y es lo correcto: guardar el nombre, el correo y el
   * celular de una persona sin un texto vigente que diga para qué
   * es justo lo que la Ley 1581 prohíbe. El mensaje dice cómo
   * arreglarlo para que eso dure una tarde y no un mes.
   *
   * `!== true` y no `!dto.aceptaPolitica`: cierra las dos puertas,
   * la de no mandar el campo y la de mandarlo en `false`. Es el
   * arreglo que ya tuvo que hacerse en la preinscripción.
   */
  private async exigirAutorizacion(convenioId: string, dto: CaptarDto) {
    const politica = await politicaVigente(this.prisma, convenioId);
    if (!politica) {
      throw new BadRequestException(
        'Esta unidad de negocio todavía no tiene publicada una política de ' +
          'tratamiento de datos, así que no hay contra qué dejar su ' +
          'autorización. Publíquela en Configuración → Políticas y el ' +
          'formulario vuelve a recibir solicitudes.',
      );
    }
    if (dto.aceptaPolitica !== true) {
      throw new BadRequestException(
        'Para dejarnos sus datos hay que aceptar la política de tratamiento ' +
          'de datos.',
      );
    }
    return politica;
  }

  /**
   * La constancia formal cuelga de una `Persona`, y solo de ahí.
   *
   * `AutorizacionDatos.personaId` es obligatorio, así que sin
   * documento no hay fila que escribir. No se inventa una persona
   * para tenerla: un documento inventado es la cédula de un
   * colombiano de verdad —ya pasó, y por eso existe
   * `Persona.esDePrueba`—.
   *
   * Cuando nadie se identificó, la autorización NO se pierde: queda
   * fechada en la nota de la gestión, con la versión del texto y la
   * IP, y el asesor la formaliza en la primera llamada
   * (`VERBAL_ASESOR`). Es el mismo camino que ya recorre un lead de
   * la mesa de entrada, que guarda la casilla en `aceptaHabeasData`
   * y escribe la constancia cuando alguien le pone nombre.
   */
  private async dejarLaConstancia(
    personaId: string | null,
    formulario: { titulo: string; slug: string; convenioId: string },
    ip?: string,
  ): Promise<Constancia> {
    if (!personaId) return 'SIN_PERSONA';
    return dejarConstancia(this.prisma, {
      personaId,
      convenioId: formulario.convenioId,
      canal: CanalAutorizacion.FORMULARIO_WEB,
      evidencia: `Formulario público «${formulario.titulo}» (/captacion/${formulario.slug})`,
      ip,
    });
  }

  /** A quién se le vende: la empresa, la persona, o las dos. */
  private async titularDe(
    embudo: TipoEmbudo,
    dto: CaptarDto,
    contacto: ComoResponder,
  ): Promise<Titular> {
    /// En el embudo de personas el documento no es opcional: es la
    /// identidad con la que esta persona ya existe —o no— en el CRM,
    /// y lo único contra lo que se puede dejar la constancia a su
    /// nombre.
    const persona = await this.personaDe(
      dto,
      contacto,
      embudo === TipoEmbudo.PERSONA,
    );

    if (embudo === TipoEmbudo.PERSONA) {
      /// No puede ser nula: `personaDe` con `exigida` en cierto o
      /// devuelve persona o lanza.
      const suya = persona as NonNullable<typeof persona>;
      return {
        personaId: suya.id,
        empresaId: null,
        comoSeLlama: suya.comoSeLlama,
        loQueNoSePiso: suya.loQueNoSePiso,
      };
    }

    const empresa = await this.empresaDe(dto, contacto);
    const quienEscribe = persona?.comoSeLlama ?? dto.nombre;

    return {
      /// La persona del contacto se guarda TAMBIÉN cuando se
      /// identificó: el negocio es de la empresa, pero a quien se
      /// llama es a ella, y la autorización es suya.
      personaId: persona?.id ?? null,
      empresaId: empresa.id,
      comoSeLlama: quienEscribe
        ? `${quienEscribe}, de ${empresa.razonSocial}`
        : empresa.razonSocial,
      loQueNoSePiso: persona?.loQueNoSePiso ?? [],
    };
  }

  /**
   * La persona, por su documento.
   *
   * La regla del `update` es la de la preinscripción, y es de
   * seguridad y no de estilo: SOLO SE RELLENAN HUECOS. Quien llena
   * este formulario es un desconocido que ha demostrado saberse un
   * número de cédula —que está en cualquier fotocopia—. Si Prisma
   * escribiera encima, un POST con la cédula de otra persona y un
   * correo propio le desviaría al atacante todo lo que el sistema le
   * mande después, sin que la dueña notara nada.
   *
   * Lo que trajo hoy y no se escribió no se tira: viaja a la nota
   * del asesor, que sí puede llamar y preguntar.
   */
  private async personaDe(
    dto: CaptarDto,
    contacto: ComoResponder,
    exigida: boolean,
  ) {
    const tipo = dto.tipoDocumentoSepId;
    const numero = dto.numeroDocumento
      ? normalizarDocumento(dto.numeroDocumento)
      : null;

    if (tipo === undefined || tipo === null || !numero) {
      if (!exigida) return null;
      throw new BadRequestException(
        'Escriba su tipo y su número de documento: es con lo que su ' +
          'solicitud queda a su nombre.',
      );
    }
    if (!DOCUMENTOS_DE_PERSONA.some((d) => d.id === tipo)) {
      throw new BadRequestException('Ese tipo de documento no está permitido.');
    }
    if (!documentoValido(tipo, numero)) {
      throw new BadRequestException(
        'Ese número de documento no corresponde al tipo que eligió. ' +
          'Revíselo y vuelva a enviarlo.',
      );
    }

    const piezas = this.piezasDelNombre(dto);
    if (!piezas) {
      throw new BadRequestException(
        'Escriba su nombre y su apellido: la solicitud queda a ese nombre.',
      );
    }

    const llave = {
      tipoDocumentoSepId_numeroDocumento: {
        tipoDocumentoSepId: tipo,
        numeroDocumento: numero,
      },
    };

    /// Hay que saber si ya estaba ANTES del upsert, porque el upsert
    /// no lo dice: devuelve lo mismo si creó que si encontró, y de
    /// esa diferencia depende qué se puede escribir.
    const ya = await this.prisma.persona.findUnique({
      where: llave,
      select: { id: true, correo: true, celular: true },
    });

    const persona = await this.prisma.persona.upsert({
      where: llave,
      create: {
        tipoDocumentoSepId: tipo,
        numeroDocumento: numero,
        ...piezas,
        correo: contacto.correo,
        celular: contacto.celular,
      },
      update: {
        correo: ya?.correo ?? contacto.correo ?? undefined,
        celular: ya?.celular ?? contacto.celular ?? undefined,
      },
      select: { id: true },
    });

    const loQueNoSePiso: string[] = [];
    if (ya?.correo && contacto.correo && ya.correo !== contacto.correo) {
      loQueNoSePiso.push(`el correo «${contacto.correo}»`);
    }
    if (ya?.celular && contacto.celular && ya.celular !== contacto.celular) {
      loQueNoSePiso.push(`el celular «${contacto.celular}»`);
    }

    return {
      id: persona.id,
      comoSeLlama: nombreCompleto(piezas),
      loQueNoSePiso,
    };
  }

  /**
   * El nombre, en las cuatro piezas que guarda una ficha.
   *
   * Se prefieren las que vinieron separadas: partir «Ana María Ruiz
   * Gómez» es adivinar —pueden ser dos nombres y dos apellidos, o
   * uno y tres— y quien llenó el formulario sí lo sabía.
   *
   * Cuando solo vino la línea completa —que es lo que pregunta el
   * campo `CONTACTO_NOMBRE` del constructor— se parte con el mismo
   * ayudante que usa el resto del sistema, y la nota del asesor
   * avisa de que se partió. Rechazar la captación por la forma del
   * nombre sería perder un lead de verdad por un detalle que
   * cualquiera corrige desde la ficha.
   */
  private piezasDelNombre(dto: CaptarDto): NombrePartido | null {
    if (dto.primerNombre && dto.primerApellido) {
      return {
        primerNombre: dto.primerNombre,
        segundoNombre: dto.segundoNombre ?? null,
        primerApellido: dto.primerApellido,
        segundoApellido: dto.segundoApellido ?? null,
      };
    }
    return dto.nombre ? sugerirNombre(dto.nombre) : null;
  }

  /**
   * La empresa, por su NIT.
   *
   * Un NIT, una organización: la empresa es única en toda la base y
   * no por unidad de negocio, porque la misma empresa le compra a
   * los dos gremios y partirla en dos fichas rompería el
   * directorio. Lo que sí se acota por unidad de negocio es la
   * OPORTUNIDAD, que es lo que hay que separar.
   *
   * El `update` es el de una reserva: solo huecos. Quien escribe es
   * un desconocido, y dejarle cambiar la razón social o el contacto
   * de una empresa que ya está en la base sería dejarle editar la
   * ficha de otro.
   */
  private async empresaDe(dto: CaptarDto, contacto: ComoResponder) {
    const nit = dto.nit ? normalizarNit(dto.nit) : null;
    if (!nit) {
      throw new BadRequestException(
        'Escriba el NIT de la empresa, con o sin dígito de verificación: es ' +
          'con lo que se identifica en todo el sistema.',
      );
    }

    const ya = await this.prisma.empresa.findUnique({
      where: { nit: nit.nit },
      select: {
        id: true,
        razonSocial: true,
        digitoVerificacion: true,
        contactoNombre: true,
        contactoCorreo: true,
        contactoCargo: true,
      },
    });

    if (!ya && !dto.razonSocial) {
      throw new BadRequestException(
        'Escriba la razón social de la empresa: ese NIT todavía no está en ' +
          'nuestro directorio, y sin ella no sabríamos a nombre de quién ' +
          'abrir el negocio.',
      );
    }

    const delContacto = {
      contactoNombre: dto.nombre ?? undefined,
      contactoCorreo: contacto.correo ?? undefined,
      contactoCargo: dto.cargo ?? undefined,
    };

    return this.prisma.empresa.upsert({
      where: { nit: nit.nit },
      create: {
        nit: nit.nit,
        digitoVerificacion: nit.digitoVerificacion,
        razonSocial: dto.razonSocial as string,
        ...delContacto,
      },
      update: {
        razonSocial: ya?.razonSocial || dto.razonSocial || undefined,
        digitoVerificacion: ya?.digitoVerificacion ?? nit.digitoVerificacion,
        contactoNombre: ya?.contactoNombre ?? delContacto.contactoNombre,
        contactoCorreo: ya?.contactoCorreo ?? delContacto.contactoCorreo,
        contactoCargo: ya?.contactoCargo ?? delContacto.contactoCargo,
      },
      select: { id: true, razonSocial: true },
    });
  }

  /**
   * El lead que dice traerla, solo si es de esta misma cuenta.
   *
   * `Oportunidad.leadId` es una columna suelta, sin llave foránea,
   * así que nada impide apuntar al lead del otro gremio. Se
   * comprueba contra la unidad de negocio del formulario: es el
   * mismo criterio del ámbito del panel, con el slug haciendo de
   * ámbito.
   *
   * Y si no cuadra se IGNORA en vez de rechazar: perder una
   * captación de verdad por un identificador viejo que arrastra la
   * página sería cambiar algo que importa por algo que no. Queda en
   * el registro para que se note.
   */
  private async leadDeEstaCuenta(
    leadId: string | undefined,
    convenioId: string,
  ): Promise<string | null> {
    if (!leadId) return null;
    const lead = await this.prisma.leadEntrante.findFirst({
      where: { id: leadId, convenioId },
      select: { id: true },
    });
    if (!lead) {
      this.log.warn(
        `El formulario mandó el lead ${leadId}, que no es de esta unidad de ` +
          'negocio. Se ignora.',
      );
      return null;
    }
    return lead.id;
  }

  /**
   * La primera tarea del negocio, con todo lo que la persona
   * escribió.
   *
   * Existe por lo que dice el propio modelo: una oportunidad sin
   * próximo paso es una oportunidad abandonada. Y además es el único
   * sitio donde caben las respuestas del formulario, porque la tabla
   * `Respuesta` cuelga de una reserva de cupos y aquí no hay
   * ninguna.
   *
   * Nace SIN asesor y venciendo hoy: en CAPTADO todavía no la ha
   * tomado nadie —es justo lo que mide el reloj de respuesta— y
   * cuando alguien la tome se encontrará la tarea ya vencida, que es
   * la verdad.
   *
   * Si esto falla, la captación NO se cae con ella: la persona ya
   * envió el formulario y su negocio ya existe. La nota entera se
   * escribe en el registro para que no se pierda lo que contó.
   */
  private async anotar(
    oportunidadId: string,
    titulo: string,
    nota: string,
    ahora: Date,
  ) {
    try {
      await this.prisma.gestion.create({
        data: {
          oportunidadId,
          tipo: TipoGestion.TAREA,
          titulo: titulo.slice(0, 200),
          nota,
          venceEn: ahora,
        },
      });
    } catch (e) {
      this.log.error(
        `No se pudo anotar la gestión de ${oportunidadId}: ` +
          (e instanceof Error ? e.message : String(e)) +
          `\n${nota}`,
      );
    }
  }

  /**
   * Quién movió la ficha, cuando no fue nadie con sesión.
   *
   * La bitácora exige un nombre y `MovimientoOportunidad.adminId` es
   * opcional justo para esto: fue el formulario, y decirlo así es
   * más honesto que atribuírselo a un administrador que no estaba.
   */
  private elFormulario(titulo: string): Admin {
    return {
      id: null,
      nombre: `Formulario «${titulo}»`,
    } as unknown as Admin;
  }

  /**
   * Lo que se le devuelve a la página.
   *
   * SIEMPRE la misma forma, se haya creado el negocio o se haya
   * reconocido uno que ya estaba. Decir «esto ya lo teníamos» le
   * confirmaría a cualquiera que teclee la cédula o el NIT de otro
   * que esa persona o esa empresa nos escribió, y esta ruta la llama
   * cualquiera.
   */
  private gracias(
    formulario: { mensajeExito: string | null; convenio: { nombre: string } },
    referencia: string,
  ) {
    return {
      recibido: true,
      /// Se dice por teléfono y se busca: para eso existe.
      referencia,
      mensaje:
        formulario.mensajeExito?.trim() ||
        `Recibimos su solicitud en ${formulario.convenio.nombre}. ` +
          'Un asesor se comunicará con usted.',
    };
  }

  /** Todo lo que el asesor necesita saber antes de llamar. */
  private notaDe(datos: {
    formulario: { titulo: string; slug: string };
    dto: CaptarDto;
    contacto: ComoResponder;
    titular: Titular;
    respuestas: Prisma.RespuestaCreateWithoutReservaInput[];
    politica: { version: number };
    constancia: Constancia;
    ip?: string;
  }): string {
    const l: string[] = [];
    l.push(`Llegó por el formulario «${datos.formulario.titulo}».`);
    l.push('');

    if (datos.contacto.correo) l.push(`Correo: ${datos.contacto.correo}`);
    if (datos.contacto.celular) l.push(`Celular: ${datos.contacto.celular}`);
    if (datos.dto.cargo) l.push(`Cargo: ${datos.dto.cargo}`);
    if (datos.dto.nit) l.push(`NIT: ${datos.dto.nit}`);

    const canal = datos.dto.origen ?? OrigenParticipante.AUTOGESTION;
    l.push(
      `Canal: ${canal}` +
        (datos.dto.campana ? ` · Campaña: ${datos.dto.campana}` : ''),
    );

    /**
     * La autorización, escrita aquí aunque ya esté en su tabla.
     *
     * Repetirla es a propósito: esta nota es lo que el asesor lee
     * antes de marcar, y tiene que poder ver de un vistazo si puede
     * llamar o si lo primero es pedirle la autorización.
     */
    l.push('');
    l.push(
      `Autorizó la política de datos v${datos.politica.version} desde ` +
        `${datos.ip ?? 'una dirección desconocida'}.`,
    );
    if (datos.constancia === 'SIN_PERSONA') {
      l.push(
        'La constancia todavía NO está a nombre de nadie: no dejó documento. ' +
          'Pídaselo en la primera llamada y déjela desde su ficha.',
      );
    }

    if (datos.titular.loQueNoSePiso.length > 0) {
      l.push('');
      l.push(
        `OJO: escribió ${datos.titular.loQueNoSePiso.join(' y ')}, distinto ` +
          'de lo que ya teníamos guardado. NO se pisó lo que había. ' +
          'Confirme con ella cuál vale antes de corregirlo.',
      );
    }

    if (
      !datos.dto.primerNombre &&
      datos.dto.nombre &&
      datos.titular.personaId
    ) {
      l.push('');
      l.push(
        `El nombre llegó en una sola línea («${datos.dto.nombre}») y lo ` +
          'partimos nosotros. Confírmelo antes de que viaje a un reporte.',
      );
    }

    if (datos.respuestas.length > 0) {
      l.push('');
      l.push('Lo que contestó:');
      for (const r of datos.respuestas) {
        l.push(`- ${r.etiquetaPregunta}: ${this.valorLegible(r)}`);
      }
    }

    return l.join('\n');
  }

  /// Una respuesta, en la línea que va a leer una persona. Las
  /// etiquetas vienen congeladas de `prepararRespuestas`: si mañana
  /// alguien renombra una opción, la nota sigue diciendo lo que la
  /// persona vio el día que contestó.
  private valorLegible(r: Prisma.RespuestaCreateWithoutReservaInput): string {
    if (Array.isArray(r.etiquetasSeleccion) && r.etiquetasSeleccion.length) {
      return r.etiquetasSeleccion.join(', ');
    }
    if (r.valorNumero !== undefined && r.valorNumero !== null) {
      return String(r.valorNumero);
    }
    if (r.valorBooleano !== undefined && r.valorBooleano !== null) {
      return r.valorBooleano ? 'Sí' : 'No';
    }
    return r.valorTexto ?? '(sin respuesta)';
  }
}
