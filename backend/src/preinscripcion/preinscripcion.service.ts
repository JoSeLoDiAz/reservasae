/** Quien se inscribe por su cuenta, y completa sus datos. */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { Prisma } from '../../generated/prisma';
import { ENTIDADES, AuditoriaService } from '../comun/auditoria.service';
import { CorreoService } from '../correo/correo.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  dejarConstancia,
  politicaVigente,
} from '../crm/constancia-de-autorizacion';
import { GENEROS_SEP } from '../crm/catalogos-sep.generado';
import {
  DEPARTAMENTOS_SEP,
  DOCUMENTOS_DE_PERSONA,
  DOCUMENTOS_DEL_FORMULARIO,
  edadCumplida,
  motivoDeIdInvalido,
  MUNICIPIOS_SEP,
  NIVELES_OCUPACIONALES_SEP,
} from '../crm/catalogos-sep';
import { faltaDeLaPersona } from '../crm/completitud';
import { normalizarDocumento } from '../comun/documento';
import { DirectorioService } from '../crm/directorio.service';
import { aQueOrganizacionSeAta } from './organizacion-de-la-ficha';
import { entraAlDirectorio } from './entra-al-directorio';
import { faltaDeLaEmpresa } from './empresa-incompleta';
import { ColaRui } from '../crm/rui/cola-rui';
import { CARACTERIZACION_POR_ID } from '../crm/catalogos-sep';
import { CARACTERIZACIONES_SEP } from '../crm/catalogos-sep.generado';
import {
  CrearPreinscripcionDto,
  DatosEmpresaDto,
  DatosPersonaDto,
} from './dto';

import { cerrarLeadsQueEsperaban } from '../leads/leads-que-esperaban';

/// Cuánto vale un enlace antes de caducar solo.
const DIAS_DE_VIDA = 15;
/// La menor edad que el SENA admite en estos programas.
const EDAD_MINIMA = 18;

@Injectable()
export class PreinscripcionService {
  private readonly log = new Logger('Preinscripcion');

  constructor(
    private readonly prisma: PrismaService,
    private readonly colaRui: ColaRui,
    private readonly auditoria: AuditoriaService,
    private readonly correo: CorreoService,
    private readonly directorio: DirectorioService,
  ) {}

  /** Lo que el formulario necesita para dibujarse. */
  async catalogo(slug: string) {
    const convenio = await this.prisma.convenio.findFirst({
      where: { slug, activo: true },
      select: { id: true, slug: true, nombre: true, sigla: true },
    });
    if (!convenio)
      throw new NotFoundException('No hay una convocatoria con ese nombre.');

    const acciones = await this.prisma.accionFormacion.findMany({
      where: { convenioId: convenio.id, visible: true },
      orderBy: { orden: 'asc' },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        horas: true,
        modalidad: true,
        objetivo: true,
        resumenPublico: true,
        ofertas: {
          where: { abierta: true },
          orderBy: { ubicacion: { nombre: 'asc' } },
          select: {
            id: true,
            modalidad: true,
            cuposMaximos: true,
            cuposOcupados: true,
            // el departamento de la ciudad decide la cobertura
            ubicacion: {
              select: { nombre: true, tipo: true, departamento: true },
            },
          },
        },
      },
    });

    /// El texto completo del habeas data. Va en el catalogo
    /// porque la pantalla lo muestra entero antes de que
    /// nadie marque nada: un enlace que casi nadie abre no
    /// alcanza para decir que lo leyo.
    const politica = await this.prisma.politicaDatos.findFirst({
      where: {
        convenioId: convenio.id,
        destinatario: 'PARTICIPANTE',
        vigenteDesde: { lte: new Date() },
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, titulo: true, contenido: true },
    });

    return {
      convenio,
      politica,
      // sin ofertas abiertas no hay dónde inscribirse
      acciones: acciones
        .filter((a) => a.ofertas.length > 0)
        .map((a) => ({
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          horas: a.horas,
          modalidad: a.modalidad,
          /// Lo que la tarjeta ensena. El `objetivo` del
          /// catalogo esta escrito para el convenio y no
          /// sirve aqui: solo se usa si nadie ha escrito el
          /// resumen todavia.
          resumen: a.resumenPublico,
          ofertas: a.ofertas.map((o) => ({
            id: o.id,
            ubicacion: o.ubicacion.nombre,
            tipo: o.ubicacion.tipo,
            departamento: o.ubicacion.departamento,
            modalidad: o.modalidad,
            libres: Math.max(0, o.cuposMaximos - o.cuposOcupados),
          })),
        })),
      /// Donde se puede elegir domicilio: solo lo que tiene
      /// alguna oferta abierta. Ofrecer un departamento sin
      /// cobertura solo sirve para decepcionar despues.
      ubicaciones: this.ubicacionesConOferta(acciones),
      documentos: DOCUMENTOS_DEL_FORMULARIO,
      generos: GENEROS_SEP,
    };
  }

  /**
   * Los departamentos con cobertura, y sus ciudades.
   *
   * Una oferta de tipo DEPARTAMENTO cubre a todo el que viva
   * ahi. Una de tipo CIUDAD cubre solo a esa ciudad: por eso
   * la ciudad se pregunta, y por eso quien vive en Bello no
   * ve la presencial que se dicta en Medellin.
   */
  private ubicacionesConOferta(
    acciones: Array<{
      ofertas: Array<{
        ubicacion: {
          nombre: string;
          tipo: string;
          departamento: string | null;
        };
      }>;
    }>,
  ) {
    const ciudades = new Map<string, Set<string>>();

    for (const a of acciones) {
      for (const o of a.ofertas) {
        const u = o.ubicacion;
        const depto = u.tipo === 'CIUDAD' ? u.departamento : u.nombre;
        if (!depto) continue;
        if (!ciudades.has(depto)) ciudades.set(depto, new Set());
        if (u.tipo === 'CIUDAD') ciudades.get(depto)!.add(u.nombre);
      }
    }

    return [...ciudades.entries()]
      .map(([departamento, cs]) => ({
        departamento,
        ciudades: [...cs].sort((x, y) => x.localeCompare(y, 'es')),
      }))
      .sort((x, y) => x.departamento.localeCompare(y.departamento, 'es'));
  }

  /**
   * El registro mínimo. Devuelve el enlace con el que la
   * persona puede seguir completando su ficha, para que
   * pueda parar aquí y continuar después.
   */
  async registrar(slug: string, dto: CrearPreinscripcionDto, ip?: string) {
    const convenio = await this.prisma.convenio.findFirst({
      where: { slug, activo: true },
      // el nombre, para poder decir de quien es el correo
      select: { id: true, nombre: true },
    });
    if (!convenio)
      throw new NotFoundException('No hay una convocatoria con ese nombre.');

    const oferta = await this.prisma.oferta.findFirst({
      where: {
        id: dto.ofertaId,
        abierta: true,
        accionFormacion: { convenioId: convenio.id, visible: true },
      },
      select: { id: true, accionFormacionId: true },
    });
    if (!oferta) {
      throw new BadRequestException('Esa opción ya no está disponible.');
    }

    this.exigirDocumentoValido(dto.tipoDocumentoSepId);

    /// Sin aceptar la política no se guarda NADA, y se
    /// comprueba ANTES de crear a la persona.
    ///
    /// El único candado estaba en el navegador: el DTO la
    /// declara opcional y la constancia se dejaba dentro de un
    /// `if`, así que un POST directo metía cédula, nombre,
    /// correo y celular sin la constancia que hay que poder
    /// demostrar. Y mandando `false` -- el rechazo explícito --
    /// entraba igual. `!== true` cierra las dos puertas.
    ///
    /// Va antes de crear porque rechazar después dejaría los
    /// datos dentro de todos modos, que es el daño entero.
    const politica = await this.politicaVigente(convenio.id);
    if (politica && dto.aceptaPolitica !== true) {
      throw new BadRequestException(
        'Para registrarse hay que aceptar la política de tratamiento de datos.',
      );
    }

    /// Y los ids del SEP, con la MISMA regla que el panel.
    const malo = motivoDeIdInvalido(dto);
    if (malo) throw new BadRequestException(malo);

    /// Normalizado, como en TODAS las demás puertas.
    ///
    /// Aquí solo se hacía `.trim()`, y esta es la puerta por la
    /// que entra más gente. `1.020.304.050` y `1020304050` son
    /// la misma cédula y creaban dos `Persona` distintas: el
    /// `@@unique` no las ve iguales porque el texto no lo es.
    ///
    /// O sea que el duplicado por documento —el que este
    /// sistema declara imposible, y por lo que no existe
    /// pantalla de fusionar— sí se podía crear, justo por el
    /// formulario público. La carga masiva, el panel, la
    /// búsqueda, la conversión de leads y el webhook ya
    /// normalizaban; faltaba esta.
    const documento = normalizarDocumento(dto.numeroDocumento);
    if (!documento) {
      throw new BadRequestException(
        'Ese número de documento no tiene forma de documento.',
      );
    }

    const domicilio = this.domicilioSep(
      dto.departamentoNombre,
      dto.ciudadNombre,
    );

    /// ¿Esta cédula ya estaba en el sistema?
    ///
    /// Hay que saberlo ANTES del upsert, porque el upsert no
    /// lo dice: devuelve la persona igual si la creó que si la
    /// encontró. Y de esa diferencia depende todo lo que pasa
    /// al final de esta función.
    ///
    /// Quien llena este formulario es un DESCONOCIDO. Si la
    /// cédula es nueva, lo que hay en la ficha es lo que él
    /// mismo acaba de escribir y devolverle su enlace no
    /// revela nada. Si la cédula YA ESTABA, la ficha es de
    /// otra persona, con su dirección, su celular y su
    /// caracterización de población vulnerable, y él solo ha
    /// demostrado saberse un número de cédula.
    const yaHabiaPersona = await this.prisma.persona.findUnique({
      where: {
        tipoDocumentoSepId_numeroDocumento: {
          tipoDocumentoSepId: dto.tipoDocumentoSepId,
          numeroDocumento: documento,
        },
      },
      select: { id: true, correo: true, celular: true },
    });

    // la misma cedula es la misma persona en todo el
    // sistema, venga por donde venga
    const persona = await this.prisma.persona.upsert({
      where: {
        tipoDocumentoSepId_numeroDocumento: {
          tipoDocumentoSepId: dto.tipoDocumentoSepId,
          numeroDocumento: documento,
        },
      },
      create: {
        tipoDocumentoSepId: dto.tipoDocumentoSepId,
        numeroDocumento: documento,
        primerNombre: dto.primerNombre,
        segundoNombre: dto.segundoNombre,
        primerApellido: dto.primerApellido,
        segundoApellido: dto.segundoApellido,
        generoSepId: dto.generoSepId,
        generoOtroTexto: dto.generoOtroTexto,
        celular: dto.celular,
        correo: dto.correo,
        ...domicilio,
      },
      /// Solo se rellenan HUECOS, y lo decide la base, no el
      /// formulario.
      ///
      /// `dto.celular ?? undefined` solo protege del caso en
      /// que el campo no venga. Si el desconocido SÍ lo manda,
      /// Prisma lo escribe y machaca el que había: un POST con
      /// la cédula de otra persona y un correo propio desviaba
      /// hacia el atacante todo lo que el sistema le mandara
      /// después —el enlace de completado, la citación— sin
      /// que la dueña notara nada.
      ///
      /// Con esto, si ya hay valor guardado, se queda el
      /// guardado. Lo que traiga el formulario para un campo
      /// ya lleno se ignora aquí; corregirlo es trabajo del
      /// asesor, que sí sabe con quién está hablando.
      update: {
        celular: yaHabiaPersona?.celular ?? dto.celular ?? undefined,
        correo: yaHabiaPersona?.correo ?? dto.correo ?? undefined,
        generoSepId: dto.generoSepId ?? undefined,
        generoOtroTexto: dto.generoOtroTexto ?? undefined,
        departamentoSepId: domicilio.departamentoSepId ?? undefined,
        municipioSepId: domicilio.municipioSepId ?? undefined,
      },
      select: { id: true },
    });

    // ya inscrita en esta misma acción: se le devuelve su
    // enlace en vez de decirle que no, que es lo mismo
    // que echarla
    const yaEsta = await this.prisma.participante.findFirst({
      where: {
        personaId: persona.id,
        accionFormacionId: oferta.accionFormacionId,
      },
      select: { id: true },
    });

    const participante =
      yaEsta ??
      (await this.prisma.participante.create({
        data: {
          personaId: persona.id,
          convenioId: convenio.id,
          ofertaId: oferta.id,
          accionFormacionId: oferta.accionFormacionId,
          origen: 'AUTOGESTION',
          etapa: 'INTERESADO',
          movimientos: {
            create: {
              etapaDespues: 'INTERESADO',
              motivo: 'Se inscribió por su cuenta',
            },
          },
        },
        select: { id: true },
      }));

    /// Los leads que esta persona tenía esperando en la mesa.
    ///
    /// El cruce funcionaba en un solo sentido: si el lead llegaba
    /// DESPUÉS lo ataba `cruzar-con-el-crm`, pero si llegaba
    /// ANTES se quedaba en «Sin atender» para siempre. Un asesor
    /// acababa llamándola para ofrecerle esto mismo.
    ///
    /// Va en try/catch y no dentro de una transacción: que esto
    /// falle no puede tumbar una inscripción que la persona ya
    /// completó. Un lead sin cerrar se arregla desde la mesa; una
    /// inscripción perdida, no.
    try {
      await cerrarLeadsQueEsperaban(this.prisma as never, {
        participanteId: participante.id,
        convenioId: convenio.id,
        tipoDocumentoSepId: dto.tipoDocumentoSepId,
        numeroDocumento: documento,
      });
    } catch (e) {
      this.log.warn(
        'No se pudieron cerrar los leads que esperaban: ' +
          (e instanceof Error ? e.message : String(e)),
      );
    }

    /// Si trajo datos DISTINTOS de los que ya teníamos, se
    /// deja como PROPUESTA para que un asesor decida.
    ///
    /// La cédula es la llave: la misma cédula es la misma
    /// persona, venga por donde venga. Así que cuando alguien
    /// se registra otra vez con otro correo hay dos
    /// posibilidades y desde aquí no se distinguen:
    ///
    ///   - Es ella y cambió de correo. Descartarlo la deja sin
    ///     recibir nada.
    ///   - Es otra persona que escribió mal la cédula, o
    ///     alguien apuntando a una ficha ajena. Escribirlo le
    ///     desvía el correo a la dueña.
    ///
    /// Ninguna de las dos se puede resolver sin hablar con
    /// alguien, y este formulario no habla con nadie. Así que
    /// no se pisa lo guardado NI se tira lo nuevo: queda en la
    /// bandeja del asesor, que sí puede llamar y preguntar.
    if (yaHabiaPersona) {
      await this.dejarPropuesta(participante.id, persona.id, {
        correo: dto.correo ?? undefined,
        celular: dto.celular ?? undefined,
        primerNombre: dto.primerNombre,
        segundoNombre: dto.segundoNombre ?? undefined,
        primerApellido: dto.primerApellido,
        segundoApellido: dto.segundoApellido ?? undefined,
      });
    }

    // ya se exigio arriba: aqui solo se deja constancia
    await this.dejarConstancia(persona.id, convenio.id, participante.id, ip);

    await this.pedirElRui(persona.id);

    const enlace = await this.emitirEnlace(participante.id, null);

    /// EL TOKEN NO SALE SI LA CÉDULA YA ESTABA.
    ///
    /// Este enlace abre la ficha ENTERA de la persona: su
    /// dirección, su celular, su estrato y su caracterización
    /// de población vulnerable —si es víctima del conflicto,
    /// si tiene una discapacidad, si está en reintegración—.
    /// Eso es dato sensible del artículo 5 de la Ley 1581, y
    /// en Colombia divulgarlo puede poner a alguien en riesgo
    /// físico.
    ///
    /// Antes se devolvía siempre, con buena intención: «ya
    /// inscrita, se le devuelve su enlace en vez de decirle
    /// que no». Pero quien llena este formulario es un
    /// DESCONOCIDO, y lo único que ha demostrado es saberse un
    /// número de cédula —que está en cualquier fotocopia, en
    /// cualquier planilla—. Dos peticiones sin sesión y salía
    /// la ficha completa de otra persona.
    ///
    /// Cuando la cédula es nueva sí se devuelve: la ficha solo
    /// contiene lo que él mismo acaba de escribir.
    if (!yaHabiaPersona) {
      return {
        registrado: true,
        yaEstaba: false,
        token: enlace.token,
        expiraEn: enlace.expiraEn,
      };
    }

    /// Ya existía: el enlace va al correo QUE YA ESTÁ EN LA
    /// BASE, nunca al que vino en el formulario. Quien
    /// controla ese buzón es la dueña de la ficha.
    const suCorreo = yaHabiaPersona.correo;
    let enviado = false;

    if (suCorreo) {
      const r = await this.correo.enviar({
        para: suCorreo,
        asunto: 'Su enlace para completar la inscripción',
        texto:
          `Buen día:

` +
          `Recibimos un registro con su documento en ${convenio.nombre}.

` +
          `Si fue usted, complete sus datos aquí:
${this.urlPublica()}/completar/${enlace.token}

` +
          `El enlace vence el ${enlace.expiraEn.toLocaleDateString('es-CO')}.

` +
          `Si NO fue usted, no haga nada y avísenos respondiendo este correo.
`,
      });
      enviado = r.estado === 'ENVIADO';
    }

    return {
      registrado: true,
      yaEstaba: true,
      /// Nunca. Es el punto entero de este cambio.
      token: null,
      expiraEn: null,
      enlaceEnviado: enviado,
      /// Se dice a dónde fue SIN enseñar la dirección: «se lo
      /// mandamos a su correo registrado» le sirve a la dueña
      /// y no le dice nada a un desconocido.
      mensaje: enviado
        ? 'Ya tenía un registro con ese documento. Le mandamos el enlace al correo que tiene registrado.'
        : 'Ya tenía un registro con ese documento. Comuníquese con el gremio para continuar.',
    };
  }

  /// La URL con la que se arman los enlaces que ve una
  /// persona. Tiene que ser la PÚBLICA: `localhost` en el
  /// computador de otro no lleva a ninguna parte.
  private urlPublica(): string {
    return (process.env.URL_PUBLICA ?? 'http://localhost:3100').replace(
      /\/+$/,
      '',
    );
  }

  /**
   * Manda a verificar el nombre contra el RUI, en segundo
   * plano.
   *
   * Se pide al inscribirse y no cuando el asesor abre la
   * ficha: asi, cuando la abra, la respuesta ya esta. El
   * portal del DNP tarda entre cinco y quince segundos y la
   * cola espera su turno; nada de eso puede hacer esperar a
   * quien esta llenando el formulario.
   *
   * Y si la cola falla, la inscripcion NO se cae con ella:
   * perder un lead por un tropiezo del RUI seria cambiar
   * algo que importa por algo que no.
   */
  private async pedirElRui(personaId: string) {
    try {
      await this.colaRui.encolarSiHaceFalta(personaId);
    } catch (e) {
      this.log.warn(
        `No se pudo encolar la consulta al RUI de ${personaId}: ` +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  }

  /**
   * La autorizacion queda contra la version que leyo.
   *
   * Un booleano suelto no prueba nada: si manana cambia el
   * texto, hay que poder decir cual acepto esta persona y
   * cuando. Por eso se guarda contra el id de la politica.
   */
  /** La política que la persona tiene que aceptar. */
  /// La misma que usa la conversión de un lead.
  private async politicaVigente(convenioId: string) {
    return politicaVigente(this.prisma, convenioId);
  }

  /**
   * La constancia, con la regla COMPARTIDA.
   *
   * Estaba escrita aquí y la conversión de un lead necesita la
   * misma: dos copias serían dos reglas sobre lo que hay que
   * poder demostrar. Ver `crm/constancia-de-autorizacion.ts`.
   */
  private async dejarConstancia(
    personaId: string,
    convenioId: string,
    participanteId: string,
    ip?: string,
  ) {
    await dejarConstancia(this.prisma, {
      personaId,
      convenioId,
      canal: 'FORMULARIO_WEB',
      evidencia: `Formulario de preinscripción, participante ${participanteId}`,
      ip,
    });
  }

  /** Un enlace nuevo. Los anteriores dejan de valer. */
  async emitirEnlace(participanteId: string, emitidoPorId: string | null) {
    const ahora = new Date();
    // «anulado», no «usado»: los dos lo dejan sin valor, pero
    // dicen cosas distintas. Marcar como usado un enlace que
    // nadie abrio hacia creer que la persona lo completo.
    await this.prisma.enlaceCompletado.updateMany({
      where: { participanteId, usadoEn: null, anuladoEn: null },
      data: { anuladoEn: ahora },
    });

    const expiraEn = new Date(ahora.getTime() + DIAS_DE_VIDA * 86_400_000);
    return this.prisma.enlaceCompletado.create({
      data: {
        // 32 bytes: no se adivina probando
        token: randomBytes(32).toString('base64url'),
        participanteId,
        expiraEn,
        emitidoPorId,
      },
      select: { token: true, expiraEn: true },
    });
  }

  /** Lo que ve quien abre el enlace. */
  async abrir(token: string) {
    const enlace = await this.exigirEnlaceVivo(token);

    /// Queda anotado que lo abrieron, y solo la primera vez.
    ///
    /// Es lo que hace verdad el aviso del asesor: «si el que
    /// mando aun no ha sido abierto, no genere otro». Sin
    /// esto, esa frase le pedia una respuesta que nadie tenia.
    ///
    /// Va sin await y con el error tragado: esta es una ruta
    /// publica y sin guard; si la anotacion falla, la persona
    /// tiene que poder llenar su formulario igual.
    if (!enlace.abiertoEn) {
      void this.prisma.enlaceCompletado
        .update({ where: { id: enlace.id }, data: { abiertoEn: new Date() } })
        .catch(() => undefined);
    }

    const p = await this.prisma.participante.findUnique({
      where: { id: enlace.participanteId },
      select: {
        id: true,
        convenio: { select: { nombre: true, sigla: true } },
        accionFormacion: {
          select: { codigo: true, nombre: true, horas: true, modalidad: true },
        },
        oferta: { select: { ubicacion: { select: { nombre: true } } } },
        convenioId: true,
        cargoEnEmpresa: true,
        nivelOcupacionalSepId: true,
        beneficiarioPrevio: true,
        /// Los campos de la empresa, no solo su nombre.
        ///
        /// Hacen falta para saber QUÉ le falta y no preguntar
        /// de más: a quien lo nominó una empresa no se le
        /// puede pedir el sector económico de esa empresa si
        /// ya lo tenemos.
        reserva: {
          select: {
            empresa: {
              select: {
                nit: true,
                razonSocial: true,
                sectorEconomico: true,
                contactoNombre: true,
                contactoCargo: true,
                contactoCorreo: true,
              },
            },
          },
        },
        empresa: {
          select: {
            nit: true,
            razonSocial: true,
            sectorEconomico: true,
            contactoNombre: true,
            contactoCargo: true,
            contactoCorreo: true,
          },
        },
        persona: {
          include: {
            autorizaciones: {
              where: { revocadaEn: null },
              select: { id: true },
            },
            /// Lo que ya marco de poblacion vulnerable. Sin
            /// esto, volver al enlace le preguntaria en blanco
            /// algo que ya contesto.
            caracterizaciones: { select: { caracterizacionSepId: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Ese enlace ya no apunta a nadie.');

    // el texto que tiene que aceptar, si el convenio lo tiene
    const politica = await this.prisma.politicaDatos.findFirst({
      where: {
        convenioId: p.convenioId,
        destinatario: 'PARTICIPANTE',
        vigenteDesde: { lte: new Date() },
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, titulo: true, contenido: true },
    });

    // la de la reserva manda: es la que la nominó
    const suya = p.reserva?.empresa ?? p.empresa ?? null;
    const { autorizaciones, caracterizaciones, ...persona } = p.persona;
    const caracterizacionesElegidas = caracterizaciones.map(
      (c) => c.caracterizacionSepId,
    );

    return {
      expiraEn: enlace.expiraEn,
      convenio: p.convenio,
      formacion: p.accionFormacion
        ? {
            codigo: p.accionFormacion.codigo,
            nombre: p.accionFormacion.nombre,
            horas: p.accionFormacion.horas,
            // se seleccionaba y no se devolvia: el mensaje
            // final salia siempre el de virtual, tambien a
            // quien tiene que presentarse en una sede
            modalidad: p.accionFormacion.modalidad,
            ubicacion: p.oferta?.ubicacion.nombre ?? null,
          }
        : null,
      empresa: suya?.razonSocial ?? null,
      nitEmpresa: suya?.nit ?? null,
      /// Si la nominó una empresa, no la cambia ella.
      empresaFijada: p.reserva !== null,
      /// Lo que le falta A LA EMPRESA, en palabras.
      ///
      /// Vacío quiere decir que no hay nada que preguntarle de
      /// su organización, y entonces ese paso del formulario
      /// no tiene por qué existir para esta persona.
      faltaDeLaEmpresa: suya ? faltaDeLaEmpresa(suya) : [],
      /// Lo que le falta A ELLA, con la MISMA regla del panel.
      ///
      /// El formulario tenía su propia lista y no coincidía:
      /// decía «sus datos están completos» mientras el panel
      /// decía «le falta un dato». Peor, el dato que faltaba era
      /// el municipio, que esta pantalla ni preguntaba — así que
      /// generar otro enlace no arreglaba nada y la ficha
      /// quedaba imposible de completar.
      faltaDeLaPersona: faltaDeLaPersona({
        persona: persona as never,
        nivelOcupacionalSepId: p.nivelOcupacionalSepId,
      }),
      cargoEnEmpresa: p.cargoEnEmpresa,
      nivelOcupacionalSepId: p.nivelOcupacionalSepId,
      beneficiarioPrevio: p.beneficiarioPrevio,
      persona,
      yaAutorizo: autorizaciones.length > 0,
      politica,
      documentos: DOCUMENTOS_DEL_FORMULARIO,
      generos: GENEROS_SEP,
      /// Las 43 del SEP, que es lo que el F7 admite. Se manda
      /// la lista entera: filtrarla seria decidir por la
      /// persona cual de sus condiciones cuenta.
      caracterizaciones: CARACTERIZACIONES_SEP,
      /// Lo que ya marco, para no volver a preguntarselo en
      /// blanco si vuelve al enlace.
      caracterizacionesElegidas: caracterizacionesElegidas,
      caracterizacionRechazada: persona.caracterizacionRechazada,
      nivelesOcupacionales: NIVELES_OCUPACIONALES_SEP,
      departamentos: DEPARTAMENTOS_SEP.filter((d) => d.seleccionable),
      // [id, departamentoId, nombre]: el navegador filtra
      // sin pedir nada. Son 1.126, no 1.126 viajes
      municipios: MUNICIPIOS_SEP.filter((m) => m[3]).map((m) => [
        m[0],
        m[1],
        m[2],
      ]),
    };
  }

  /** Guarda los datos de la persona. El enlace sigue vivo. */
  async guardarPersona(token: string, dto: DatosPersonaDto, ip?: string) {
    const enlace = await this.exigirEnlaceVivo(token);

    if (dto.fechaNacimiento) {
      const edad = edadCumplida(new Date(dto.fechaNacimiento));
      if (edad < EDAD_MINIMA) {
        throw new BadRequestException(
          `Esta formación es para mayores de ${EDAD_MINIMA} años.`,
        );
      }
    }

    const p = await this.prisma.participante.findUnique({
      where: { id: enlace.participanteId },
      select: {
        personaId: true,
        datosTocadosPorAsesorEn: true,
        persona: { select: { departamentoSepId: true, municipioSepId: true } },
      },
    });
    if (!p) throw new NotFoundException('Ese enlace ya no apunta a nadie.');
    const tocada = p;

    /// Contra el catálogo Y contra lo que ya está guardado.
    ///
    /// Antes solo se miraba si llegaban departamento Y
    /// municipio a la vez, así que partiendo la petición en dos
    /// entraba un par imposible -- y después la ficha contaba
    /// como completa, lista para el cargue al SEP, con un
    /// municipio que no existe.
    const malo = motivoDeIdInvalido(dto, {
      departamentoSepId: p.persona?.departamentoSepId,
      municipioSepId: p.persona?.municipioSepId,
    });
    if (malo) throw new BadRequestException(malo);

    // el nivel educativo y el cargo son de la participación,
    // no de la persona: cambian entre un curso y el siguiente
    await this.prisma.participante.update({
      where: { id: enlace.participanteId },
      data: {
        nivelEducativo: dto.nivelEducativo,
        cargoEnEmpresa: dto.cargoEnEmpresa,
        nivelOcupacionalSepId: dto.nivelOcupacionalSepId,
        beneficiarioPrevio: dto.beneficiarioPrevio,
      },
    });

    // aceptar la politica es lo que hay que poder demostrar:
    // se guarda contra la version exacta que leyo, no como
    // un booleano suelto que no prueba nada
    if (dto.aceptaPolitica) {
      const politica = await this.prisma.politicaDatos.findFirst({
        where: {
          convenio: { participantes: { some: { id: enlace.participanteId } } },
          destinatario: 'PARTICIPANTE',
          vigenteDesde: { lte: new Date() },
        },
        orderBy: { version: 'desc' },
        select: { id: true },
      });

      if (politica) {
        const ya = await this.prisma.autorizacionDatos.findFirst({
          where: {
            personaId: p.personaId,
            politicaDatosId: politica.id,
            revocadaEn: null,
          },
          select: { id: true },
        });
        if (!ya) {
          await this.prisma.autorizacionDatos.create({
            data: {
              personaId: p.personaId,
              politicaDatosId: politica.id,
              canal: 'FORMULARIO_WEB',
              evidencia: `Enlace de completado ${enlace.id}`,
              ip: ip ?? null,
            },
          });
        }
      }
    }

    const suyos = {
      primerNombre: dto.primerNombre ?? undefined,
      segundoNombre: dto.segundoNombre,
      primerApellido: dto.primerApellido ?? undefined,
      segundoApellido: dto.segundoApellido,
      celular: dto.celular,
      correo: dto.correo,
      generoSepId: dto.generoSepId,
      fechaNacimiento: dto.fechaNacimiento
        ? new Date(dto.fechaNacimiento)
        : undefined,
      estrato: dto.estrato,
      departamentoSepId: dto.departamentoSepId,
      municipioSepId: dto.municipioSepId,
      barrio: dto.barrio,
      direccion: dto.direccion,
    };

    // si un asesor ya toco la ficha, lo del interesado no
    // pisa: espera como propuesta y alguien decide campo a
    // campo. Pisar borraria el trabajo del asesor; tirarlo
    // perderia lo que la persona se molesto en escribir
    if (tocada.datosTocadosPorAsesorEn) {
      await this.dejarPropuesta(enlace.participanteId, p.personaId, suyos);
      return { guardado: true, enEspera: true };
    }

    await this.prisma.persona.update({
      where: { id: p.personaId },
      data: suyos,
    });
    await this.guardarCaracterizaciones(p.personaId, dto);

    return { guardado: true, enEspera: false };
  }

  /**
   * La población vulnerable, que va aparte.
   *
   * No entra en la propuesta al asesor ni se mezcla con el
   * resto: es un dato SENSIBLE de la ley 1581, y solo su
   * dueño puede decirlo. Un asesor no debe poder proponerle a
   * nadie que alguien es víctima del conflicto.
   *
   * Se reemplaza entero, no se suma: si la persona vuelve y
   * quita una casilla, quitarla tiene que servir de algo.
   *
   * Y se distingue «no contestó» de «prefirió no decirlo»:
   * lo primero es un campo que nadie preguntó, lo segundo es
   * una decisión suya, y solo la segunda se puede defender
   * ante una auditoría.
   */
  private async guardarCaracterizaciones(
    personaId: string,
    dto: DatosPersonaDto,
  ): Promise<void> {
    const contesto =
      dto.caracterizaciones !== undefined ||
      dto.caracterizacionRechazada !== undefined;
    if (!contesto) return;

    const elegidas = dto.caracterizacionRechazada
      ? []
      : [...new Set(dto.caracterizaciones ?? [])].filter((id) =>
          CARACTERIZACION_POR_ID.has(id),
        );

    /**
     * Cada marca cuelga de una autorización, y el esquema lo
     * exige: `autorizacionId` no es opcional.
     *
     * Es lo correcto. Ser víctima del conflicto o tener una
     * discapacidad es dato sensible de la ley 1581, y un dato
     * sensible sin un consentimiento concreto detrás no se
     * puede guardar. Si no hay autorización viva, no se
     * guarda: se anota que se preguntó y ahí queda.
     */
    const autorizacion = await this.prisma.autorizacionDatos.findFirst({
      where: { personaId, revocadaEn: null },
      orderBy: { otorgadaEn: 'desc' },
      select: { id: true },
    });

    const marcar = this.prisma.persona.update({
      where: { id: personaId },
      data: {
        caracterizacionRechazada: dto.caracterizacionRechazada ?? false,
        caracterizacionPreguntada: new Date(),
      },
    });

    if (!autorizacion) {
      this.log.warn(
        `No se guardó la caracterización de ${personaId}: no tiene ninguna ` +
          'autorización vigente, y es un dato sensible.',
      );
      await marcar;
      return;
    }

    /// Se reemplaza entera, no se suma: si la persona vuelve
    /// y quita una casilla, quitarla tiene que servir de algo.
    await this.prisma.$transaction([
      this.prisma.caracterizacionPersona.deleteMany({ where: { personaId } }),
      ...(elegidas.length > 0
        ? [
            this.prisma.caracterizacionPersona.createMany({
              data: elegidas.map((caracterizacionSepId) => ({
                personaId,
                caracterizacionSepId,
                autorizacionId: autorizacion.id,
              })),
            }),
          ]
        : []),
      marcar,
    ]);
  }

  /// Guarda lo que difiere de lo que ya hay. Lo que llega
  /// igual no es una propuesta de nada y solo haria ruido
  /// en la pantalla del asesor.
  private async dejarPropuesta(
    participanteId: string,
    personaId: string,
    suyos: Record<string, unknown>,
  ): Promise<void> {
    const actual = await this.prisma.persona.findUnique({
      where: { id: personaId },
      select: {
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
        celular: true,
        correo: true,
        generoSepId: true,
        fechaNacimiento: true,
        estrato: true,
        departamentoSepId: true,
        municipioSepId: true,
        barrio: true,
        direccion: true,
      },
    });
    if (!actual) return;

    const distintos: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(suyos)) {
      if (valor === undefined) continue;
      const antes = (actual as Record<string, unknown>)[campo];
      const iguales =
        antes instanceof Date && valor instanceof Date
          ? antes.getTime() === valor.getTime()
          : antes === valor;
      if (!iguales) distintos[campo] = valor;
    }

    if (Object.keys(distintos).length === 0) return;

    // una pendiente por ficha: la ultima es la que vale
    await this.prisma.propuestaDeDatos.deleteMany({
      where: { participanteId, estado: 'PENDIENTE' },
    });

    await this.prisma.propuestaDeDatos.create({
      data: { participanteId, campos: distintos as Prisma.InputJsonValue },
    });
  }

  /**
   * Los datos de su empresa, que son los que el F7 pide y
   * nadie más puede dar. Al guardarlos se cierra el enlace.
   *
   * Quien se inscribió por su cuenta también trabaja en
   * algún sitio: antes esto se negaba si no venía de una
   * reserva, así que sus datos de empresa no tenían dónde
   * ir y su fila del F7 nacía incompleta. Si trae NIT se
   * busca o se crea la organización y se le engancha.
   */
  /// Apunta lo que dijo de su situación laboral, y si se
  /// contradice con lo que dijo antes, lo dice.
  ///
  /// El caso concreto: la persona marca «desempleado», ve que
  /// ahí se le acaba el formulario, refresca y vuelve a
  /// empezar marcando «con vínculo laboral». El enlace ya no
  /// sirve pero el formulario se deja recorrer otra vez, así
  /// que sin esto no queda ni rastro de la primera respuesta.
  ///
  /// No bloquea nada: cambiar de respuesta puede ser
  /// perfectamente honesto -- se equivocó de botón, o consiguió
  /// trabajo. Solo lo deja escrito para que quien revise lo
  /// vea, que es lo que se pidió.
  private async apuntarSituacion(
    participanteId: string,
    convenioId: string | null,
    dice: string | undefined,
    ip?: string,
  ): Promise<void> {
    if (!dice) return;

    const previas = await this.prisma.registroAuditoria.findMany({
      where: {
        entidad: ENTIDADES.PARTICIPANTE,
        entidadId: participanteId,
        accion: 'SITUACION_LABORAL_DECLARADA',
      },
      orderBy: { creadoEn: 'desc' },
      take: 1,
      select: { resumen: true },
    });

    const antes = previas[0]?.resumen ?? null;
    /// El resumen anterior empieza por la situación, así que
    /// basta con mirar si la nueva ya está ahí.
    const seContradice = antes !== null && !antes.startsWith(dice);

    await this.auditoria.registrar({
      actor: { nombre: 'La persona, desde su enlace' },
      accion: 'SITUACION_LABORAL_DECLARADA',
      entidad: ENTIDADES.PARTICIPANTE,
      entidadId: participanteId,
      convenioId,
      resumen: seContradice
        ? `${dice} — OJO: antes había dicho otra cosa (${antes})`
        : dice,
      ip,
    });
  }

  async guardarEmpresa(token: string, dto: DatosEmpresaDto) {
    const enlace = await this.exigirEnlaceVivo(token);

    const p = await this.prisma.participante.findUnique({
      where: { id: enlace.participanteId },
      select: {
        id: true,
        convenioId: true,
        reserva: { select: { empresaId: true } },
        empresaId: true,
        persona: {
          select: {
            tipoDocumentoSepId: true,
            numeroDocumento: true,
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
            // para el independiente: su casa y su celular son
            // el domicilio y el telefono de su unidad economica
            direccion: true,
            celular: true,
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Ese enlace ya no apunta a nadie.');

    /// El municipio de la ORGANIZACION, con la misma regla.
    ///
    /// Tenia el mismo `if` de los dos campos, asi que aqui
    /// tambien entraba un municipio inexistente llegando solo.
    const malo = motivoDeIdInvalido(dto);
    if (malo) throw new BadRequestException(malo);

    /// Antes de guardar nada: queda escrito lo que dijo, y si
    /// se contradice con lo anterior, queda escrito eso
    /// tambien.
    await this.apuntarSituacion(p.id, p.convenioId, dto.situacionLaboral);

    /// El desempleado no tiene organizacion que guardar.
    ///
    /// Sin esta salida caia en la rama del NIT, se le exigia
    /// uno que no tiene, y quedaba dando vueltas en un
    /// formulario que le pedia los datos de una empresa donde
    /// no trabaja.
    if (dto.situacionLaboral === 'DESEMPLEADO') {
      await this.prisma.enlaceCompletado.update({
        where: { id: enlace.id },
        data: { usadoEn: new Date() },
      });
      const etapaFinal = await this.inscribirSiEstaCompleto(
        enlace.participanteId,
      );
      return { guardado: true, enlaceCerrado: true, etapa: etapaFinal };
    }

    const datos = {
      direccion: dto.direccion,
      telefono: dto.telefono,
      departamentoSepId: dto.departamentoSepId,
      municipioSepId: dto.municipioSepId,
      sectorEconomico: dto.sectorEconomico,
      numeroTrabajadores: dto.numeroTrabajadores,
      contactoNombre: dto.contactoNombre,
      contactoCargo: dto.contactoCargo,
      contactoCorreo: dto.contactoCorreo,
    };

    /// La de la RESERVA manda y no se cambia: la nominó ella.
    ///
    /// La suya propia SÍ se cambia, y ahí estaba el defecto:
    /// `p.empresaId` no es una nominación, es su respuesta
    /// anterior. Corregirla es justo para lo que existe este
    /// enlace.
    ///
    /// Con las dos en el mismo `??`, quien volvía diciendo «me
    /// equivoqué, trabajo en Vise LTDA» reescribía la
    /// organización VIEJA con los datos de la nueva. Y como el
    /// NIT y la razón social no van en `datos`, quedaba una
    /// fila imposible: el NIT y el nombre de la primera con la
    /// persona de contacto de la segunda. Visto en producción,
    /// y la organización nueva no llegaba a crearse.
    const nitPedido = dto.nit ? dto.nit.replace(/\D/g, '') : null;

    const laDeAhora = p.empresaId
      ? await this.prisma.empresa.findUnique({
          where: { id: p.empresaId },
          select: { id: true, nit: true },
        })
      : null;

    /// Al cambiarse cae en la rama del NIT, que hace `upsert` y
    /// vuelve a atar la ficha. La vieja se queda como estaba:
    /// puede tener a otra gente detrás.
    const { atar: suya, cambia: seCambia } = aQueOrganizacionSeAta({
      nominadaPorReserva: p.reserva?.empresaId ?? null,
      suyaAhora: laDeAhora,
      nitQueDice: nitPedido,
    });

    /// Cambiar de organización queda escrito, como la
    /// contradicción de situación laboral.
    ///
    /// No es un error de la persona —corregirse es legítimo—
    /// pero sí cambia de quién se la reporta al SENA, y el F7
    /// va por organización. Sin esta línea el cambio ocurría en
    /// silencio y nadie podía explicar después por qué esa
    /// ficha cuenta en otra empresa.
    if (seCambia && laDeAhora) {
      await this.auditoria.registrar({
        actor: { nombre: 'La persona, desde su enlace' },
        accion: 'ORGANIZACION_CAMBIADA',
        entidad: ENTIDADES.PARTICIPANTE,
        entidadId: p.id,
        convenioId: p.convenioId,
        resumen:
          `Cambió de organización: antes NIT ${laDeAhora.nit}, ` +
          `ahora NIT ${nitPedido}${dto.razonSocial ? ` (${dto.razonSocial})` : ''}`,
      });

      /// Y en «Cambios realizados», que es donde se mira.
      ///
      /// La auditoría de arriba responde «quién hizo qué»; esta
      /// fila responde «qué decía antes», y son dos preguntas
      /// distintas — está escrito en la propia pantalla. Sin
      /// ella, el cambio existía en el registro pero la ficha
      /// no enseñaba de qué organización venía.
      ///
      /// El histórico solo lo escribía el panel. Por esta
      /// puerta —la pública— no se guardaba nada, y es
      /// justamente la que usa la persona para corregirse.
      await this.prisma.valorAnterior.create({
        data: {
          participanteId: p.id,
          campo: 'empresaNit',
          clase: 'FORMACION',
          valorAnterior: laDeAhora.nit,
          habiaValor: true,
          actorNombre: 'La persona, desde su enlace',
        },
      });
    }

    if (suya) {
      await this.prisma.empresa.update({ where: { id: suya }, data: datos });
      // y se ata al lead, que es lo que faltaba. Esta rama
      // actualizaba la empresa y se iba sin dejar constancia
      // de a quien pertenece: el lead quedaba con empresaId
      // en null y el F7, que la busca ahi, no lo veia nunca
      await this.prisma.participante.update({
        where: { id: p.id },
        data: { empresaId: suya },
      });
    } else if (dto.nit) {
      const nit = dto.nit.replace(/\D/g, '');
      if (!nit)
        throw new BadRequestException('Ese NIT no tiene ningún dígito.');

      const empresa = await this.prisma.empresa.upsert({
        where: { nit },
        create: {
          nit,
          digitoVerificacion: dto.digitoVerificacion ?? null,
          razonSocial: dto.razonSocial ?? `Organización ${nit}`,
          ...datos,
        },
        // lo que ya se sabía no se pisa con un hueco
        update: Object.fromEntries(
          Object.entries(datos).filter(
            ([, v]) => v !== undefined && v !== null,
          ),
        ),
        select: { id: true },
      });

      await this.prisma.participante.update({
        where: { id: p.id },
        data: { empresaId: empresa.id },
      });

      /// Y entra al DIRECTORIO, marcada como tecleada.
      ///
      /// `empresas` e `instituciones` son dos tablas distintas
      /// a propósito: la primera son las organizaciones del
      /// CRM, la segunda el maestro de NIT compartido entre los
      /// gremios. Nadie las conectaba, así que una organización
      /// que llegaba por el formulario público no aparecía en
      /// «Empresas registradas» ni la veía el buscador del
      /// RUES, que trabaja sobre el directorio.
      ///
      /// Va por `agregarManual`, que la marca `fuente: HUMANO`:
      /// es texto que escribió una persona, no una fuente
      /// oficial, y esa marca es lo que permite revisarla
      /// después y que el RUES la corrija.
      ///
      /// No se hace en la rama del RUT propio: ahí el NIT es la
      /// CÉDULA de alguien, y el directorio es una tabla
      /// compartida de organizaciones. Meter cédulas ahí es
      /// esparcir un dato personal a un sitio que nadie
      /// consideró personal.
      if (
        entraAlDirectorio({
          nit,
          razonSocial: dto.razonSocial ?? '',
          esRutPropio: false,
        })
      ) {
        try {
          await this.directorio.agregarManual(nit, dto.razonSocial!);
        } catch (e) {
          /// Que no llegue al directorio NO puede tumbar la
          /// inscripción: es un apunte de apoyo, y la persona
          /// ya dijo lo suyo.
          this.log.warn(
            `No se pudo apuntar el NIT ${nit} en el directorio: ` +
              (e instanceof Error ? e.message : String(e)),
          );
        }
      }
    } else if (dto.rutPropio) {
      // su cedula es su RUT: la persona es su propia unidad
      // economica y asi la reporta el F7
      const nit = p.persona.numeroDocumento.replace(/\D/g, '');
      const nombre = [
        p.persona.primerNombre,
        p.persona.segundoNombre,
        p.persona.primerApellido,
        p.persona.segundoApellido,
      ]
        .filter(Boolean)
        .join(' ');

      /// La direccion y el telefono son los SUYOS.
      ///
      /// Un independiente no tiene una sede aparte ni un
      /// conmutador: su casa es su domicilio fiscal y su
      /// celular es su telefono. Preguntarselos otra vez es
      /// pedirle que copie lo que ya escribio dos pantallas
      /// atras, y mientras no lo copie el F7 lo da por
      /// incompleto.
      ///
      /// Si el formulario trajo algo distinto, manda eso: se
      /// rellena el hueco, no se pisa lo que dijo.
      const suyos = {
        direccion: datos.direccion ?? p.persona.direccion ?? undefined,
        telefono: datos.telefono ?? p.persona.celular ?? undefined,
      };

      if (nit) {
        const empresa = await this.prisma.empresa.upsert({
          where: { nit },
          create: {
            nit,
            razonSocial: nombre || `Independiente ${nit}`,
            tipoDocumentoSepId: p.persona.tipoDocumentoSepId,
            ...datos,
            ...suyos,
          },
          update: Object.fromEntries(
            Object.entries({ ...datos, ...suyos }).filter(
              ([, v]) => v !== undefined && v !== null,
            ),
          ),
          select: { id: true },
        });

        await this.prisma.participante.update({
          where: { id: p.id },
          data: { empresaId: empresa.id },
        });
      }
    }

    // aquí acaba: el enlace era de un solo uso
    await this.prisma.enlaceCompletado.update({
      where: { id: enlace.id },
      data: { usadoEn: new Date() },
    });

    const etapa = await this.inscribirSiEstaCompleto(enlace.participanteId);

    return { guardado: true, enlaceCerrado: true, etapa };
  }

  /**
   * Quien completa su ficha queda con los DATOS COMPLETOS.
   * No inscrito.
   *
   * Antes esto lo pasaba a INSCRITO solo, y estaba mal:
   * llenar un formulario no aparta una silla. Una
   * pre-inscripcion da prevalencia, no cupo. Inscribir es
   * responder por alguien ante el SENA, consume un cupo de
   * verdad y exige grupo con fechas -- eso lo decide una
   * persona, nunca un formulario.
   *
   * DATOS_COMPLETOS dice justo lo que paso: ya no le falta
   * nada para poder reportarse, y esta listo para que un
   * lider lo inscriba.
   */
  private async inscribirSiEstaCompleto(participanteId: string) {
    const p = await this.prisma.participante.findUnique({
      where: { id: participanteId },
      select: {
        etapa: true,
        nivelOcupacionalSepId: true,
        persona: {
          select: {
            correo: true,
            celular: true,
            fechaNacimiento: true,
            generoSepId: true,
            estrato: true,
            departamentoSepId: true,
            municipioSepId: true,
            barrio: true,
            direccion: true,
          },
        },
      },
    });
    if (!p) return null;

    // solo desde el embudo del asesor: si ya esta en el aula
    // no se le toca la etapa por completar unos datos
    const enElEmbudo = p.etapa === 'INTERESADO' || p.etapa === 'CONTACTADO';
    if (!enElEmbudo) return p.etapa;

    const falta = faltaDeLaPersona({
      persona: p.persona,
      nivelOcupacionalSepId: p.nivelOcupacionalSepId,
    });
    if (falta.length > 0) return p.etapa;

    await this.prisma.$transaction([
      this.prisma.participante.update({
        where: { id: participanteId },
        // sin fechaMatricula: no se ha matriculado en nada
        data: { etapa: 'DATOS_COMPLETOS' },
      }),
      this.prisma.movimientoParticipante.create({
        data: {
          participanteId,
          etapaAntes: p.etapa,
          etapaDespues: 'DATOS_COMPLETOS',
          motivo: 'Completó su ficha por su cuenta desde el enlace',
        },
      }),
    ]);

    return 'DATOS_COMPLETOS' as const;
  }

  /** Termina sin llenar lo de la empresa. */
  async cerrar(token: string) {
    const enlace = await this.exigirEnlaceVivo(token);
    await this.prisma.enlaceCompletado.update({
      where: { id: enlace.id },
      data: { usadoEn: new Date() },
    });
    return { cerrado: true };
  }

  private async exigirEnlaceVivo(token: string) {
    const enlace = await this.prisma.enlaceCompletado.findUnique({
      where: { token },
      select: {
        id: true,
        participanteId: true,
        expiraEn: true,
        usadoEn: true,
        anuladoEn: true,
        abiertoEn: true,
      },
    });
    // el mismo mensaje para todos los casos: decir "ya se
    // usó" confirma que existió, y eso es un oráculo
    if (
      !enlace ||
      enlace.usadoEn ||
      enlace.anuladoEn ||
      enlace.expiraEn < new Date()
    ) {
      throw new NotFoundException(
        'Este enlace ya no está disponible. Pida uno nuevo a quien lo atendió.',
      );
    }
    return enlace;
  }

  /// Del nombre que eligio a los ids del SEP. El formulario
  /// trabaja con nombres porque es lo que tiene la ubicacion
  /// de la oferta; el cargue al SENA exige ids del DANE.
  private domicilioSep(departamento?: string, ciudad?: string) {
    const clave = (t: string) =>
      t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

    const depto = departamento
      ? DEPARTAMENTOS_SEP.find((d) => clave(d.etiqueta) === clave(departamento))
      : undefined;

    const muni =
      ciudad && depto
        ? MUNICIPIOS_SEP.find(
            (m) => m[1] === depto.id && clave(m[2]) === clave(ciudad),
          )
        : undefined;

    return {
      departamentoSepId: depto?.id ?? null,
      municipioSepId: muni?.[0] ?? null,
    };
  }

  private exigirDocumentoValido(id: number) {
    if (!DOCUMENTOS_DE_PERSONA.some((d) => d.id === id)) {
      throw new BadRequestException('Ese tipo de documento no está permitido.');
    }
  }
}
