/** Las plantillas, y mandar una a un participante. */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CorreoService } from '../correo.service';
import { quienFirma } from '../quien-firma';
import {
  DisparadorDePlantilla,
  type EtapaParticipante,
} from '../../../generated/prisma';
import {
  estadoDeAutorizacion,
  noSeLePuedeEscribir,
  porQueNoSeLeMando,
} from '../autorizacion-vigente';
import { escaparAtributo, escaparHtml } from '../escapar';
import { urlPublicaDeLaApi } from '../url-publica';
import { datosParaPlantilla } from '../campanas/datos-plantilla';
import { EnlaceDeCompletado } from '../../preinscripcion/enlace-de-completado';
import { urlPublica } from '../url-publica';
import { cartaHtml } from '../carta/carta';
import { bloquesDe, comoTexto, resolverBloques } from '../carta/formato';
import { MarcaDeCarta } from '../carta/marca-de-la-carta';
import { porQueNo } from './etapas-de-plantilla';
import {
  resolver,
  valoresDe,
  variablesUsadas,
  VARIABLES,
  type DatosDelParticipante,
} from './variables';

/// Cuánto texto se le deja poner a una plantilla. Un correo
/// no es un documento: si necesita más, va un adjunto o un
/// enlace.
const LARGO_MAXIMO = 8000;

@Injectable()
export class PlantillasCorreoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    /// Al final: hay specs que construyen este servicio a mano.
    private readonly marcaDeCarta: MarcaDeCarta,
    private readonly enlaces: EnlaceDeCompletado,
  ) {}

  /** El catálogo de variables, para quien escribe. */
  variables() {
    return VARIABLES;
  }

  /**
   * Las que puede usar este gremio.
   *
   * Las de `convenioId` nulo sirven para todos; las de un
   * gremio, solo en el suyo. El tono de BRITCHAM no tiene por
   * qué ser el de ADECOPRIA.
   */
  async listar(convenios: string[], soloActivas = false) {
    return this.prisma.plantillaCorreo.findMany({
      where: {
        ...(soloActivas ? { activa: true } : {}),
        OR: [{ convenioId: null }, { convenioId: { in: convenios } }],
      },
      orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        asunto: true,
        cuerpo: true,
        activa: true,
        disparador: true,
        etapasPermitidas: true,
        convenioId: true,
        actualizadoEn: true,
        /// El mime dice SI hay cabezote y la versión rompe el
        /// caché. Los bytes no salen de aquí: son hasta 2 MB
        /// por plantilla y esto lo pide una lista entera.
        bannerMime: true,
        bannerVersion: true,
        convenio: { select: { sigla: true, nombre: true } },
        creadoPor: { select: { nombre: true } },
      },
    });
  }

  /**
   * Las plantillas para UNA ficha, con el motivo del bloqueo.
   *
   * No se esconden las que no aplican: se enseñan apagadas y
   * con el porqué. Una plantilla que desaparece del
   * desplegable manda a la gente a buscarla y a preguntar
   * quién se la borró; una apagada que dice «esta persona
   * está interesada y esto es para inscritos» se entiende
   * sola y enseña cómo funciona.
   */
  async paraLaFicha(participanteId: string, convenios: string[]) {
    const [lista, ficha] = await Promise.all([
      this.listar(convenios, true),
      this.prisma.participante.findUnique({
        where: { id: participanteId, convenioId: { in: convenios } },
        select: { etapa: true },
      }),
    ]);

    return lista.map((p) => ({
      ...p,
      bloqueo: porQueNo(p.etapasPermitidas, ficha?.etapa ?? null),
    }));
  }

  async crear(
    datos: {
      nombre: string;
      asunto: string;
      cuerpo: string;
      convenioId?: string | null;
      etapasPermitidas?: EtapaParticipante[];
      disparador?: DisparadorDePlantilla;
    },
    adminId: string,
    ambito: string[],
  ) {
    /// El convenio viene del cuerpo. Sin esto se creaba una
    /// plantilla colgada del otro gremio, que despues aparece
    /// en SU desplegable.
    if (datos.convenioId && !ambito.includes(datos.convenioId)) {
      throw new NotFoundException('Ese convenio no existe.');
    }
    this.revisar(datos.asunto, datos.cuerpo);
    await this.exigirDisparadorLibre(
      datos.disparador ?? DisparadorDePlantilla.NINGUNO,
      datos.convenioId ?? null,
      true,
      null,
    );
    return this.prisma.plantillaCorreo.create({
      data: {
        nombre: datos.nombre.trim(),
        asunto: datos.asunto.trim(),
        cuerpo: datos.cuerpo,
        convenioId: datos.convenioId ?? null,
        etapasPermitidas: datos.etapasPermitidas ?? [],
        disparador: datos.disparador ?? DisparadorDePlantilla.NINGUNO,
        creadoPorId: adminId,
      },
    });
  }

  async editar(
    id: string,
    ambito: string[],
    datos: Partial<{
      nombre: string;
      asunto: string;
      cuerpo: string;
      convenioId: string | null;
      activa: boolean;
      etapasPermitidas: EtapaParticipante[];
      disparador: DisparadorDePlantilla;
    }>,
  ) {
    const antes = await this.exigir(id, ambito);

    /// El convenio de DESTINO tambien se acota, y no solo el de
    /// origen. `exigir` dice de quien es hoy; sin esto, un
    /// gremio podia MUDARLE una plantilla al otro --y desde que
    /// una plantilla puede salir sola, mudarsela es instalarle
    /// el correo que se le manda a sus ciudadanos--. `crear` ya
    /// lo comprobaba; `editar` no.
    if (datos.convenioId && !ambito.includes(datos.convenioId)) {
      throw new NotFoundException('Ese convenio no existe.');
    }

    this.revisar(datos.asunto ?? antes.asunto, datos.cuerpo ?? antes.cuerpo);

    /// Se juzga como QUEDARIA, no como llega: apagarla libera
    /// el disparador, y volver a encenderla lo vuelve a pedir.
    await this.exigirDisparadorLibre(
      datos.disparador ?? antes.disparador,
      datos.convenioId !== undefined ? datos.convenioId : antes.convenioId,
      datos.activa ?? antes.activa,
      id,
    );

    return this.prisma.plantillaCorreo.update({ where: { id }, data: datos });
  }

  /**
   * Una plantilla no se borra: se apaga.
   *
   * Ya se usó para escribirle a gente. Borrarla dejaría
   * correos enviados sin forma de saber qué decían.
   */
  async apagar(id: string, ambito: string[]) {
    await this.exigir(id, ambito);
    return this.prisma.plantillaCorreo.update({
      where: { id },
      data: { activa: false },
    });
  }

  /**
   * El cabezote: la franja de arriba del correo.
   *
   * A diferencia del de una campaña, este SÍ se puede cambiar
   * cuando quiera. Una campaña ya lanzada dejaría a unos con
   * una imagen y a otros con otra; una plantilla no se ha
   * mandado a nadie todavía —se manda cada vez, desde una
   * ficha—, así que cambiarlo solo afecta a lo que salga de
   * aquí en adelante.
   */
  async guardarBanner(
    id: string,
    datos: Buffer,
    mime: string,
    nombre: string,
    ambito: string[],
  ) {
    await this.exigir(id, ambito);
    await this.prisma.plantillaCorreo.update({
      where: { id },
      data: {
        // Prisma quiere Uint8Array, no Buffer
        bannerDatos: new Uint8Array(datos),
        bannerMime: mime,
        bannerNombre: nombre,
        // la versión sube para que el caché no sirva el viejo
        bannerVersion: { increment: 1 },
      },
    });
    return { listo: true };
  }

  /// Quitarlo es poner los tres campos en null. La versión NO
  /// se toca: si mañana sube otro, tiene que seguir subiendo
  /// desde donde iba o Gmail servirá el que ya tenía guardado.
  async quitarBanner(id: string, ambito: string[]) {
    await this.exigir(id, ambito);
    await this.prisma.plantillaCorreo.update({
      where: { id },
      data: { bannerDatos: null, bannerMime: null, bannerNombre: null },
    });
    return { listo: true };
  }

  /**
   * La plantilla, SI es de un gremio que esta cuenta alcanza.
   *
   * `listar` ya respetaba el ambito; `editar` y `apagar` no lo
   * miraban siquiera. Un gremio podia reescribirle el texto a
   * las plantillas del otro —y ese texto sale firmado por el
   * otro gremio a sus ciudadanos— o apagarselas.
   *
   * Las de convenioId null sirven para todos, asi que las
   * puede tocar cualquiera que tenga permiso de escribir. Es
   * a proposito: son las genericas del sistema.
   */
  private async exigir(id: string, ambito: string[]) {
    const p = await this.prisma.plantillaCorreo.findUnique({ where: { id } });
    if (!p || (p.convenioId !== null && !ambito.includes(p.convenioId))) {
      throw new NotFoundException('Esa plantilla ya no existe.');
    }
    return p;
  }

  /**
   * El enlace de completado, SOLO si la plantilla lo pide.
   *
   * Sin esto, cada previsualización acuñaría un token: el
   * enlace es de un solo uso y emitir uno anula el anterior,
   * así que abrir el desplegable del correo le rompería a la
   * persona el enlace que ya tiene en su bandeja.
   *
   * Y cuando sí se manda se usa `emitirOReusar`: si la persona
   * ya tiene uno vivo --el del botón de la pantalla de
   * gracias, o el que le pasó el asesor-- se manda ESE.
   */
  private async enlaceSiLoPide(
    plantilla: { asunto: string; cuerpo: string },
    participanteId: string,
    deVerdad: boolean,
    emitidoPorId: string | null,
  ): Promise<{ enlace?: string | null }> {
    const usadas = variablesUsadas(`${plantilla.asunto} ${plantilla.cuerpo}`);
    if (!usadas.includes('enlace')) return {};

    const sitio = urlPublica();
    /// Sin `URL_PUBLICA` no hay enlace que mandar. Un
    /// `localhost` en el correo de otra persona no lleva a
    /// ninguna parte, y aquí callar detiene el envío, que es
    /// lo correcto: la plantilla existe PARA mandar el enlace.
    if (!sitio) return { enlace: null };

    if (!deVerdad) return { enlace: `${sitio}/completar/…` };

    const e = await this.enlaces.emitirOReusar(participanteId, emitidoPorId);
    return { enlace: `${sitio}/completar/${e.token}` };
  }

  /**
   * Solo UNA plantilla activa dispara sola en cada gremio.
   *
   * Con dos, cual de las dos sale lo decidiria el orden de la
   * consulta --o sea el azar-- y el sintoma seria que a unos
   * les llega un texto y a otros otro, sin que nada falle.
   *
   * La general (sin gremio) NO estorba a la de un gremio: ahi
   * la regla es la de siempre, la propia gana a la heredada.
   * Lo que no puede haber es dos con el MISMO gremio.
   */
  private async exigirDisparadorLibre(
    disparador: DisparadorDePlantilla,
    convenioId: string | null,
    activa: boolean,
    exceptoId: string | null,
  ): Promise<void> {
    if (disparador === DisparadorDePlantilla.NINGUNO || !activa) return;

    const otra = await this.prisma.plantillaCorreo.findFirst({
      where: {
        disparador,
        activa: true,
        convenioId,
        ...(exceptoId ? { id: { not: exceptoId } } : {}),
      },
      select: { nombre: true },
    });

    if (otra) {
      throw new BadRequestException(
        `«${otra.nombre}» ya sale sola en ese momento para este gremio. ` +
          'Apague esa primero, o quitele el disparador.',
      );
    }
  }

  /// Que no se guarde una plantilla con una variable que no
  /// existe. Se ve al escribirla, no cuando ya salió mal a
  /// cuarenta personas.
  private revisar(asunto: string, cuerpo: string) {
    if (!asunto.trim())
      throw new BadRequestException('El asunto no puede ir vacío.');
    if (!cuerpo.trim())
      throw new BadRequestException('El cuerpo no puede ir vacío.');
    if (cuerpo.length > LARGO_MAXIMO) {
      throw new BadRequestException(
        `El cuerpo pasa de ${LARGO_MAXIMO} caracteres. Para algo más largo, ` +
          'mejor un enlace o un adjunto.',
      );
    }

    const conocidas = new Set(VARIABLES.map((v) => v.clave));
    const malas = [...variablesUsadas(`${asunto} ${cuerpo}`)].filter(
      (v) => !conocidas.has(v),
    );

    if (malas.length > 0) {
      throw new BadRequestException(
        `Estas variables no existen: ${malas.map((v) => `{{${v}}}`).join(', ')}. ` +
          'Si se guarda así, van a salir literales en el correo.',
      );
    }
  }

  /**
   * Cómo le quedaría a ESTA persona, antes de mandarlo.
   *
   * Es el paso que hace que esto sea usable: quien manda ve
   * el texto ya con el nombre puesto, y ve qué huecos no se
   * pudieron llenar. Nadie manda a ciegas.
   */
  async vistaPrevia(
    participanteId: string,
    plantillaId: string,
    ambito: string[],
    /// `true` solo cuando esto va a salir de verdad. Es lo que
    /// decide si `{{enlace}}` acuña un token o enseña una
    /// muestra: la previa la puede pedir cualquiera que VEA la
    /// ficha, y un enlace de un solo uso no puede viajar al
    /// panel solo porque alguien abrió un desplegable.
    deVerdad = false,
    /// Quién lo manda, para que conste quién emitió el enlace.
    emitidoPorId: string | null = null,
  ) {
    const [plantilla, datos] = await Promise.all([
      this.prisma.plantillaCorreo.findUnique({ where: { id: plantillaId } }),
      this.datosDe(participanteId, ambito),
    ]);

    if (!plantilla) throw new NotFoundException('Esa plantilla ya no existe.');

    const valores = {
      ...valoresDe(datos.datos),
      ...(await this.enlaceSiLoPide(
        plantilla,
        participanteId,
        deVerdad,
        emitidoPorId,
      )),
    };
    const asunto = resolver(plantilla.asunto, valores);

    /// EL FORMATO SE APLICA SOBRE EL TEXTO DE LA PLANTILLA y
    /// las variables se ponen DENTRO de cada bloque. Al revés,
    /// una razón social como «# 1 LOGISTICA S.A.S» se
    /// convertiría en el título del correo.
    const puestos = resolverBloques(bloquesDe(plantilla.cuerpo), (t) =>
      resolver(t, valores),
    );

    /// Los faltantes de los dos, juntos y sin repetir: a quien
    /// manda le da igual si el hueco estaba en el asunto o en
    /// el cuerpo, lo que necesita saber es qué le falta.
    const faltantes = [...new Set([...asunto.faltantes, ...puestos.faltantes])];
    const desconocidas = [
      ...new Set([...asunto.desconocidas, ...puestos.desconocidas]),
    ];

    const marca = await this.marcaDeCarta.delConvenio(datos.convenioId);
    const cabezote = plantilla.bannerMime
      ? urlDelCabezote(plantilla.id, plantilla.bannerVersion)
      : null;

    return {
      para: datos.correo,
      nombre: datos.nombre,
      asunto: asunto.texto,
      cuerpo: comoTexto(puestos.bloques),
      /// EL HTML DE VERDAD, el mismo que va a salir.
      ///
      /// La previa pintaba el texto plano mientras el correo
      /// salía con diseño: enseñaba algo que no es. Es
      /// exactamente el defecto de la previsualización de los
      /// logos, que decía lo contrario de lo que hacía la
      /// cabecera. La cura es la misma: un solo renderizador,
      /// llamado por los dos.
      html: cartaHtml({
        asunto: asunto.texto,
        bloques: puestos.bloques,
        marca,
        cabezote,
      }),
      faltantes,
      desconocidas,
      /// Se puede mandar si hay a dónde, no quedó ningún hueco
      /// sin llenar Y no hay ninguna variable inventada.
      ///
      /// Lo último faltaba, y no era teórico: las plantillas
      /// que trae el cliente vienen en MAYUSCULA_CON_GUIONES,
      /// que no existen en el catálogo. Una clave desconocida
      /// no entra en `faltantes` —entra en `desconocidas`— así
      /// que la compuerta la dejaba pasar y el correo salía con
      /// «Estimado {{NOMBRE_PARTICIPANTE}}» impreso, firmado
      /// por el gremio, sin que nada fallara.
      sePuede:
        Boolean(datos.correo) &&
        faltantes.length === 0 &&
        desconocidas.length === 0,
    };
  }

  async enviar(
    participanteId: string,
    plantillaId: string,
    ambito: string[],
    emitidoPorId: string | null = null,
  ) {
    /// La compuerta va en el SERVIDOR, no en el desplegable.
    ///
    /// El desplegable ya las apaga, pero apagar un <option> es
    /// comodidad: quien llame a la API a mano, o tenga la
    /// pantalla abierta desde antes de que a la persona le
    /// cambiaran la etapa, se salta la comodidad. Lo que no se
    /// salta es esto.
    const [plantilla, ficha] = await Promise.all([
      this.prisma.plantillaCorreo.findUnique({
        where: { id: plantillaId },
        select: {
          etapasPermitidas: true,
          bannerMime: true,
          bannerVersion: true,
        },
      }),
      this.prisma.participante.findUnique({
        where: { id: participanteId, convenioId: { in: ambito } },
        select: {
          etapa: true,
          convenio: { select: { sigla: true, nombre: true } },
        },
      }),
    ]);

    if (plantilla) {
      const no = porQueNo(plantilla.etapasPermitidas, ficha?.etapa ?? null);
      if (no) throw new BadRequestException(no);
    }

    /// Y que siga autorizando.
    ///
    /// El panel deja escribirle a una ficha desde su pantalla,
    /// y esa pantalla no miraba la revocación. Alguien que
    /// llamó a pedir que lo sacaran seguía recibiendo correos
    /// del asesor, que es la peor forma de enterarse de que su
    /// petición no se cumplió.
    const estado = await estadoDeAutorizacion(this.prisma, participanteId);
    if (noSeLePuedeEscribir(estado)) {
      throw new BadRequestException(
        `${porQueNoSeLeMando(estado)} No se le puede escribir.`,
      );
    }

    /// DE VERDAD: aquí sí se acuña el enlace si hace falta.
    const vista = await this.vistaPrevia(
      participanteId,
      plantillaId,
      ambito,
      true,
      emitidoPorId,
    );

    if (!vista.para) {
      throw new BadRequestException(
        `${vista.nombre} no tiene correo en la ficha. Sin correo no hay a dónde mandarlo.`,
      );
    }

    /// No se manda con huecos, y no es una manía.
    ///
    /// «Estimado {{saludo}}, su curso empieza el
    /// {{fechaInicio}}» sale una sola vez y ya no se puede
    /// recoger. Se dice qué falta y se arregla la ficha.
    if (vista.faltantes.length > 0) {
      throw new BadRequestException(
        'Faltan datos de esta persona para llenar la plantilla: ' +
          `${vista.faltantes.map((f) => `{{${f}}}`).join(', ')}. ` +
          'Complételos en la ficha, o use otra plantilla.',
      );
    }

    /// Y TAMPOCO SALE CON VARIABLES QUE NO EXISTEN.
    ///
    /// `revisar()` las rechaza al guardar, pero una plantilla
    /// puede haberse guardado antes de que existiera esa
    /// comprobación, o haber perdido una variable que se
    /// quitó del catálogo. Sin esto salía con la llave impresa.
    if (vista.desconocidas.length > 0) {
      throw new BadRequestException(
        'Esta plantilla usa variables que no existen: ' +
          `${vista.desconocidas.map((f) => `{{${f}}}`).join(', ')}. ` +
          'Corríjala antes de mandarla: saldrían literales en el correo.',
      );
    }

    /// El cabezote va por URL y no adjunto: quien lo descarga
    /// es el cliente de correo de la otra persona. La versión
    /// viaja en la dirección porque la respuesta se cachea una
    /// semana; sin ella, cambiar el cabezote no cambiaría nada
    /// en las bandejas que ya lo tienen.
    ///
    /// Y va por `/api/`. `URL_PUBLICA` es la del FRONTEND
    /// --`preinscripcion` la usa para `/completar/<token>`, que
    /// es una pantalla-- y en el servidor nginx solo enruta dos
    /// cosas: `/` al frontend y `/api/` al backend, quitando el
    /// prefijo (`docker/nginx/prueba.conf:55`). Sin `/api/`
    /// esta imagen le pega al Next y devuelve 404, y en el
    /// correo se ve el hueco. En local también funciona: el
    /// rewrite de `next.config.ts` hace lo mismo.
    ///
    /// Sin `URL_PUBLICA` NO se pone cabezote, y aquí no vale el
    /// `?? 'http://localhost:3100'` que usan los enlaces. Un
    /// enlace roto se ve al pulsarlo y quien lo recibe entiende
    /// que algo falló; una imagen rota se pinta sola, arriba
    /// del todo, en el sitio donde va el logo del gremio. Mejor
    /// que no salga a que salga el icono de imagen partida.
    const r = await this.correo.enviar({
      deParte: quienFirma(ficha?.convenio),
      para: vista.para,
      asunto: vista.asunto,
      texto: vista.cuerpo,
      /// El MISMO html que enseñó la vista previa. Armarlo
      /// otra vez aquí sería la segunda verdad de siempre.
      html: vista.html,
    });

    if (r.estado === 'FALLO') throw new BadRequestException(r.error);
    if (r.estado === 'APAGADO') {
      throw new BadRequestException(
        'El correo está apagado en el servidor. Revise Configuración > Correo.',
      );
    }

    /// Se devuelve a dónde fue DE VERDAD, no a dónde iba.
    ///
    /// En pruebas todo se desvía a un buzón nuestro. Decirle
    /// al asesor «se envió a camilapruebas@gmail.com» cuando
    /// eso no pasó es peor que no decir nada: se queda creyendo
    /// que la persona ya está avisada, y no lo está.
    return {
      enviado: true,
      /// A quién iba dirigido.
      para: vista.para,
      /// Dónde cayó. Distinto solo cuando hay desvío.
      entregadoA: r.para,
      desviado: r.desviado,
      asunto: vista.asunto,
      id: r.id,
    };
  }

  /**
   * Los datos de la ficha, SI es de un gremio que esta cuenta
   * alcanza.
   *
   * Los arma `datosParaPlantilla`, la MISMA funcion de las
   * campanas. Habia una copia aqui, y las dos ya discrepaban:
   * esta sacaba la modalidad de la accion --que en AF7 y AF8
   * dice «Hibrida» mientras la celda es virtual-- y la sede
   * solo de la cobertura, que un inscrito sin grupo no tiene.
   * Con la regla 1 de `variables.ts`, eso no era un correo
   * feo: era un correo que no salia.
   *
   * El ambito es obligatorio y va en la firma a proposito.
   * Antes esto buscaba por id y ya, y las dos rutas de correo
   * de la ficha eran las UNICAS de su controlador que no lo
   * recibian: con el id de un participante ajeno se leia su
   * nombre, su cedula y su correo, y `enviar` le mandaba un
   * correo DE VERDAD a un ciudadano del otro gremio.
   */
  private async datosDe(participanteId: string, ambito: string[]) {
    const datos = await datosParaPlantilla(
      this.prisma,
      participanteId,
      ambito,
    );

    if (!datos) throw new NotFoundException('Ese lead ya no existe.');

    const nombre =
      [datos.primerNombre, datos.primerApellido].filter(Boolean).join(' ') ||
      'Este lead';

    /// De que gremio es, para sus logos y sus colores. Va
    /// aparte porque `DatosDelParticipante` es el contrato de
    /// las VARIABLES --lo que se puede escribir entre llaves--
    /// y el id de un convenio no es una variable de plantilla.
    /// CON EL AMBITO TAMBIEN, aunque `datosParaPlantilla` ya
    /// lo comprobo: una consulta sin acotar en este archivo es
    /// la que alguien copia manana para otra cosa. Lo cazo su
    /// propio spec al anadirla.
    const suyo = await this.prisma.participante.findUnique({
      where: { id: participanteId, convenioId: { in: ambito } },
      select: { convenioId: true },
    });

    return {
      datos,
      correo: datos.correo,
      nombre,
      convenioId: suyo?.convenioId ?? null,
    };
  }
}

/**
 * A donde apunta el `<img>` del cabezote dentro del correo.
 *
 * Sale de `urlPublicaDeLaApi()` y no de `urlPublica()`: esto es
 * un endpoint del backend, y nginx solo le manda al backend lo
 * que empieza por `/api/`. La regla entera, con el porque, esta
 * en `correo/url-publica.ts`.
 *
 * La version viaja en la direccion porque la respuesta se
 * cachea una semana: sin ella, cambiar el cabezote no cambia
 * nada en las bandejas que ya lo tienen.
 *
 * Null sin `URL_PUBLICA`, y aqui NO vale el `localhost` que
 * usan los enlaces: un enlace roto se ve al pulsarlo, una
 * imagen rota se pinta sola y arriba del todo, en el sitio
 * donde va el logo del gremio.
 */
export function urlDelCabezote(
  plantillaId: string,
  bannerVersion: number,
): string | null {
  const base = urlPublicaDeLaApi();
  if (!base) return null;
  return `${base}/plantillas-correo/${plantillaId}/banner?v=${bannerVersion}`;
}
