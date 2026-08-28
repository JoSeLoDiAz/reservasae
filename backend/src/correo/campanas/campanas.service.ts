/** Campañas: armar, lanzar y vaciar la cola. */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { construirFormato, leerPlantilla } from '../../plantillas/plantillas';
import { PrismaService } from '../../prisma/prisma.service';
import { CorreoService } from '../correo.service';
import {
  resolver,
  valoresDe,
  VARIABLES,
  variablesUsadas,
} from '../plantillas/variables';
import { escaparHtml } from '../escapar';
import {
  PORQUE_NO_SE_LE_MANDO,
  puedeRecibir,
} from '../autorizacion-vigente';
import { revisarBase } from './base-cargada';
import { datosParaPlantilla, deLaListaSubida } from './datos-plantilla';
import { destinoPermitido, reescribirEnlaces } from './enlaces-medidos';
import {
  inicioDelDiaColombiano,
  sePuedeAhora,
  TOPE_DIARIO,
  TOPE_POR_PERSONA_AL_DIA,
} from './ritmo';
import {
  comoConsulta,
  leFaltaAlgo,
  PARA_SABER_SI_LE_FALTA,
  SEGMENTOS_LISTOS,
  type Segmento,
} from './segmento';

@Injectable()
export class CampanasService {
  private readonly log = new Logger('Campanas');

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  segmentosListos() {
    return SEGMENTOS_LISTOS;
  }

  variables() {
    return VARIABLES;
  }

  async listar(convenios: string[]) {
    const campanas = await this.prisma.campana.findMany({
      where: { convenioId: { in: convenios } },
      orderBy: { creadoEn: 'desc' },
      select: {
        id: true,
        nombre: true,
        asunto: true,
        estado: true,
        lanzadaEn: true,
        terminadaEn: true,
        creadoEn: true,
        convenio: { select: { sigla: true, nombre: true } },
        creadoPor: { select: { nombre: true } },
        _count: { select: { destinatarios: true } },
      },
    });

    return campanas;
  }

  /**
   * Cuántos le tocarían HOY, sin mandar nada.
   *
   * Es lo que se mira antes de lanzar. Una campaña que uno
   * lanza sin saber a cuántos le va es como se le escribe a
   * cuatrocientas personas por error.
   */
  async aCuantos(convenioId: string, segmento: Segmento, ambito: string[]) {
    this.exigirConvenio(convenioId, ambito);

    const candidatos = await this.prisma.participante.findMany({
      where: comoConsulta(convenioId, segmento),
      select: PARA_SABER_SI_LE_FALTA,
    });

    const filtrados = segmento.soloDatosIncompletos
      ? candidatos.filter((p) => leFaltaAlgo(p))
      : candidatos;

    return { total: filtrados.length, ejemplo: filtrados.slice(0, 5) };
  }

  async crear(
    ambito: string[],
    convenioId: string,
    datos: {
      nombre: string;
      asunto: string;
      cuerpo: string;
      segmento: Segmento;
      origen?: 'SEGMENTO' | 'CARGUE';
    },
    adminId: string,
  ) {
    /// El convenio viene del CUERPO de la petición y solo lo
    /// validaba `@IsString()`. Con el id del otro gremio se
    /// creaba una campaña sobre sus participantes y se le
    /// escribía a sus ciudadanos.
    this.exigirConvenio(convenioId, ambito);
    this.revisarTexto(datos.asunto, datos.cuerpo);

    return this.prisma.campana.create({
      data: {
        convenioId,
        nombre: datos.nombre.trim(),
        asunto: datos.asunto.trim(),
        cuerpo: datos.cuerpo,
        segmento: datos.segmento,
        origen: datos.origen ?? 'SEGMENTO',
        creadoPorId: adminId,
      },
      select: { id: true, nombre: true, estado: true, origen: true },
    });
  }

  async editar(
    ambito: string[],
    id: string,
    datos: Partial<{
      nombre: string;
      asunto: string;
      cuerpo: string;
      segmento: Segmento;
    }>,
  ) {
    const c = await this.exigir(id, ambito);

    /// Una campaña lanzada NO se edita.
    ///
    /// Ya salieron correos con ese texto. Cambiarlo dejaría a
    /// unos con una versión y a otros con otra, y a nadie con
    /// forma de saber qué recibió cada quien.
    if (c.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Esta campaña ya se lanzó, así que su texto no se puede cambiar: ' +
          'hay gente que ya lo recibió. Duplíquela si necesita otra versión.',
      );
    }

    this.revisarTexto(datos.asunto ?? c.asunto, datos.cuerpo ?? c.cuerpo);

    return this.prisma.campana.update({
      where: { id },
      data: {
        ...datos,
        segmento: datos.segmento ? (datos.segmento as object) : undefined,
      },
      select: { id: true, nombre: true, estado: true },
    });
  }

  /**
   * Congela la lista y abre la llave.
   *
   * Lanzar NO manda nada: arma los destinatarios y pone la
   * campaña en ENVIANDO. El trabajador la va vaciando despacio,
   * dentro del horario y de los topes. Es lo que permite mandar
   * doscientos correos por una cuenta de Gmail sin que la
   * cierren.
   */
  async lanzar(id: string, ambito: string[]) {
    const c = await this.exigir(id, ambito);

    if (c.estado !== 'BORRADOR') {
      throw new BadRequestException('Esta campaña ya se había lanzado.');
    }

    /// La de cargue ya tiene su lista: se congeló al subir el
    /// archivo, no al lanzar. Aquí solo se abre la llave.
    if (c.origen === 'CARGUE') {
      const cuantos = await this.prisma.destinatarioCampana.count({
        where: { campanaId: id },
      });
      if (cuantos === 0) {
        throw new BadRequestException(
          'Todavía no ha subido la base. Descargue el formato, llénelo y súbalo antes de lanzar.',
        );
      }
      await this.prisma.campana.update({
        where: { id },
        data: { estado: 'ENVIANDO', lanzadaEn: new Date() },
      });
      this.log.log(`Campaña «${c.nombre}» lanzada a ${cuantos} correos subidos.`);
      return { lanzada: true, destinatarios: cuantos, repetidos: 0 };
    }

    const segmento = c.segmento as Segmento;
    const candidatos = await this.prisma.participante.findMany({
      where: comoConsulta(c.convenioId, segmento),
      select: PARA_SABER_SI_LE_FALTA,
    });

    const elegidos = segmento.soloDatosIncompletos
      ? candidatos.filter((p) => leFaltaAlgo(p))
      : candidatos;

    if (elegidos.length === 0) {
      throw new BadRequestException(
        'Ese segmento no le corresponde a nadie hoy. Revise las reglas antes de lanzar.',
      );
    }

    /// Un BUZON, no una ficha.
    ///
    /// Hay gente con dos participaciones -- inscrita en dos
    /// cosas -- y el mismo correo en las dos. Sin esto le
    /// llegaba el mismo mensaje dos veces, y el tope de dos
    /// al dia tampoco la salvaba porque contaba por
    /// participante. Recibir dos veces lo mismo es de las
    /// cosas que hacen que a uno lo marquen como spam.
    const porBuzon = new Map<string, (typeof elegidos)[number]>();
    for (const p of elegidos) {
      const correo = (p.persona.correo as string).trim().toLowerCase();
      if (!porBuzon.has(correo)) porBuzon.set(correo, p);
    }
    const repetidos = elegidos.length - porBuzon.size;

    await this.prisma.$transaction([
      this.prisma.destinatarioCampana.createMany({
        data: [...porBuzon.entries()].map(([correo, p]) => ({
          campanaId: id,
          participanteId: p.id,
          correo,
        })),
        skipDuplicates: true,
      }),
      this.prisma.campana.update({
        where: { id },
        data: { estado: 'ENVIANDO', lanzadaEn: new Date() },
      }),
    ]);

    this.log.log(
      `Campaña «${c.nombre}» lanzada a ${porBuzon.size} buzones` +
        (repetidos > 0 ? ` (${repetidos} repetidos, una sola vez)` : '') +
        '.',
    );
    return {
      lanzada: true,
      destinatarios: porBuzon.size,
      /// Se devuelve para poder decirlo en pantalla: «iban 40,
      /// salen 38, dos tenian el correo repetido» explica un
      /// numero que si no, parece un error.
      repetidos,
    };
  }

  /// Parar y seguir. Una campaña que va mal se para en el
  /// acto: es lo que hace que lanzar no dé miedo.
  async pausar(id: string, ambito: string[]) {
    await this.exigir(id, ambito);
    return this.prisma.campana.update({
      where: { id },
      data: { estado: 'PAUSADA' },
      select: { id: true, estado: true },
    });
  }

  async reanudar(id: string, ambito: string[]) {
    await this.exigir(id, ambito);
    return this.prisma.campana.update({
      where: { id },
      data: { estado: 'ENVIANDO' },
      select: { id: true, estado: true },
    });
  }

  /** Cómo va: lo firme y lo aproximado, separados. */
  async resultados(id: string, ambito: string[]) {
    const c = await this.exigir(id, ambito);

    const [porEstado, abiertos, conClic] = await Promise.all([
      this.prisma.destinatarioCampana.groupBy({
        by: ['estado'],
        where: { campanaId: id },
        _count: true,
      }),
      this.prisma.destinatarioCampana.count({
        where: { campanaId: id, abiertoEn: { not: null } },
      }),
      this.prisma.destinatarioCampana.count({
        where: { campanaId: id, clicEn: { not: null } },
      }),
    ]);

    const cuenta = (e: string) =>
      porEstado.find((x) => x.estado === e)?._count ?? 0;

    const enviados = cuenta('ENVIADO');

    return {
      id: c.id,
      nombre: c.nombre,
      estado: c.estado,
      lanzadaEn: c.lanzadaEn,
      total: porEstado.reduce((s, x) => s + x._count, 0),
      pendientes: cuenta('PENDIENTE'),
      enviados,
      fallidos: cuenta('FALLIDO'),
      omitidos: cuenta('OMITIDO'),
      /// Firme: el clic pasa por nuestro servidor.
      conClic,
      /// APROXIMADO, y por eso va con su nombre. Gmail
      /// descarga la imagen él mismo y Apple marca abierto a
      /// todos: este número tira para arriba y no sirve para
      /// decidir nada solo.
      aperturasEstimadas: abiertos,
    };
  }

  /// Quiénes, uno por uno. Para poder mirar a quién falló.
  async destinatarios(id: string, ambito: string[]) {
    /// Esta es la que más dolía: devolvía la lista ENTERA de
    /// correos de la campaña consultando por `campanaId` a
    /// secas, sin pasar siquiera por `exigir`. Con el id de
    /// una campaña ajena, el directorio del otro gremio.
    await this.exigir(id, ambito);

    return this.prisma.destinatarioCampana.findMany({
      where: { campanaId: id },
      orderBy: [{ estado: 'asc' }, { enviadoEn: 'asc' }],
      take: 500,
      select: {
        id: true,
        correo: true,
        estado: true,
        motivo: true,
        enviadoEn: true,
        abiertoEn: true,
        clics: true,
        participante: {
          select: {
            persona: { select: { primerNombre: true, primerApellido: true } },
          },
        },
      },
    });
  }

  // --- el envío, de a uno ---

  /**
   * Manda UNO y devuelve si hizo algo.
   *
   * Lo llama el trabajador en bucle. Todo el freno vive aquí:
   * si no es hora, si ya se llegó al tope o si a esa persona ya
   * le escribimos dos veces hoy, no sale.
   */
  async enviarUno(baseUrl: string): Promise<boolean> {
    const ahora = new Date();
    const desdeHoy = inicioDelDiaColombiano(ahora);
    const haceUnaHora = new Date(ahora.getTime() - 60 * 60 * 1000);

    const [enviadosHoy, enviadosEstaHora] = await Promise.all([
      this.prisma.destinatarioCampana.count({
        where: { estado: 'ENVIADO', enviadoEn: { gte: desdeHoy } },
      }),
      this.prisma.destinatarioCampana.count({
        where: { estado: 'ENVIADO', enviadoEn: { gte: haceUnaHora } },
      }),
    ]);

    const veredicto = sePuedeAhora(ahora, enviadosHoy, enviadosEstaHora);
    if (!veredicto.puede) return false;

    const siguiente = await this.prisma.destinatarioCampana.findFirst({
      where: { estado: 'PENDIENTE', campana: { estado: 'ENVIANDO' } },
      orderBy: { creadoEn: 'asc' },
      select: {
        id: true,
        correo: true,
        participanteId: true,
        nombre: true,
        campana: {
          select: { id: true, asunto: true, cuerpo: true, bannerDatos: true },
        },
      },
    });
    if (!siguiente) {
      await this.cerrarLasQueTerminaron();
      return false;
    }

    /// Dos al día por persona, y se cuenta TODO lo que le
    /// llegó de campañas, no solo de esta. Si hoy le llegaron
    /// dos de otra campaña, esta espera a mañana.
    const yaHoy = await this.prisma.destinatarioCampana.count({
      where: {
        /// Por CORREO y no por participante: quien recibe es
        /// el buzon. Contando por ficha, alguien con dos
        /// participaciones se llevaba cuatro correos al dia
        /// en vez de dos.
        correo: siguiente.correo,
        estado: 'ENVIADO',
        enviadoEn: { gte: desdeHoy },
      },
    });

    if (yaHoy >= TOPE_POR_PERSONA_AL_DIA) {
      // no se descarta: se deja para mañana
      return false;
    }

    /// ANTES DE NADA: ¿sigue autorizando?
    ///
    /// La lista se congeló al lanzar. Quien revocó DESPUÉS
    /// sigue en esa lista, así que si no se comprueba aquí, se
    /// le manda igual. Revocar es un derecho (Ley 1581, art.
    /// 8); si le seguimos escribiendo, el derecho no existió.
    const autoriza = await puedeRecibir(
      this.prisma,
      siguiente.participanteId,
    );
    if (autoriza === false) {
      await this.omitir(siguiente.id, PORQUE_NO_SE_LE_MANDO);
      return true;
    }

    /// De donde salen los datos con los que se llena la
    /// plantilla. Dos caminos, y no se pueden mezclar:
    ///
    /// - De la BASE: se lee su ficha entera, que esta al dia.
    /// - De un CARGUE: solo hay lo que traia el archivo, un
    ///   correo y un primer nombre. Lo demas NO se inventa:
    ///   si la plantilla pide {{grupo}}, este se omite con su
    ///   motivo, igual que se omite a quien le falta el dato
    ///   en su ficha.
    const datos = siguiente.participanteId
      ? await datosParaPlantilla(this.prisma, siguiente.participanteId)
      : deLaListaSubida(siguiente.nombre, siguiente.correo);

    if (!datos) {
      await this.omitir(siguiente.id, 'Ese lead ya no existe.');
      return true;
    }

    const valores = valoresDe(datos);
    const asunto = resolver(siguiente.campana.asunto, valores);
    const cuerpo = resolver(siguiente.campana.cuerpo, valores);
    const faltantes = [...new Set([...asunto.faltantes, ...cuerpo.faltantes])];

    /// No sale con huecos, igual que el envío individual. Un
    /// «Estimado {{saludo}}» sale una vez y no se recoge.
    if (faltantes.length > 0) {
      await this.omitir(
        siguiente.id,
        `Le faltan datos para esta plantilla: ${faltantes.join(', ')}.`,
      );
      return true;
    }

    const r = await this.correo.enviar({
      para: siguiente.correo,
      asunto: asunto.texto,
      texto: cuerpo.texto,
      html: this.armarHtml(
        cuerpo.texto,
        siguiente.campana.id,
        siguiente.id,
        Boolean(siguiente.campana.bannerDatos),
        baseUrl,
      ),
    });

    if (r.estado === 'ENVIADO') {
      await this.prisma.destinatarioCampana.update({
        where: { id: siguiente.id },
        data: {
          estado: 'ENVIADO',
          enviadoEn: new Date(),
          intentos: { increment: 1 },
        },
      });
      return true;
    }

    /// Falló: se anota y se deja PENDIENTE para reintentar,
    /// salvo que ya se hayan gastado los intentos.
    const fila = await this.prisma.destinatarioCampana.update({
      where: { id: siguiente.id },
      data: { intentos: { increment: 1 } },
      select: { intentos: true },
    });

    const error = r.estado === 'FALLO' ? r.error : 'El correo está apagado.';
    if (fila.intentos >= 3) {
      await this.prisma.destinatarioCampana.update({
        where: { id: siguiente.id },
        data: { estado: 'FALLIDO', motivo: error.slice(0, 300) },
      });
    }

    return true;
  }

  private async omitir(id: string, motivo: string) {
    await this.prisma.destinatarioCampana.update({
      where: { id },
      data: { estado: 'OMITIDO', motivo },
    });
  }

  /// Las que ya no tienen a quién mandarle, se cierran. Si no,
  /// se quedan «enviando» para siempre y nadie sabe si acabó.
  private async cerrarLasQueTerminaron() {
    const abiertas = await this.prisma.campana.findMany({
      where: { estado: 'ENVIANDO' },
      select: {
        id: true,
        _count: {
          select: { destinatarios: { where: { estado: 'PENDIENTE' } } },
        },
      },
    });

    for (const c of abiertas) {
      if (c._count.destinatarios === 0) {
        await this.prisma.campana.update({
          where: { id: c.id },
          data: { estado: 'TERMINADA', terminadaEn: new Date() },
        });
      }
    }
  }

  /**
   * El HTML del correo: banner, texto y el pixel.
   *
   * Los enlaces se reescriben para que pasen por el servidor
   * y se pueda contar el clic. Eso SÍ es medible: no depende
   * de que el cliente de correo cargue imágenes.
   */
  private armarHtml(
    texto: string,
    campanaId: string,
    destinatarioId: string,
    conBanner: boolean,
    baseUrl: string,
  ): string {
    const escapado = escaparHtml(texto);

    const conEnlaces = reescribirEnlaces(
      escapado,
      baseUrl,
      campanaId,
      destinatarioId,
    );

    const parrafos = conEnlaces
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('\n');

    const banner = conBanner
      ? `<img src="${baseUrl}/campanas/${campanaId}/banner" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0">`
      : '';

    /// El pixel va al final y mide APROXIMADO. Se pone porque
    /// se pidió, no porque el número sea de fiar.
    const pixel = `<img src="${baseUrl}/campanas/${campanaId}/abierto/${destinatarioId}" width="1" height="1" alt="" style="display:block">`;

    return (
      '<div style="max-width:600px;margin:0 auto;font-family:system-ui,-apple-system,' +
      'Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#161a26">' +
      banner +
      `<div style="padding:${conBanner ? '20px 4px' : '4px'}">${parrafos}</div>` +
      pixel +
      '</div>'
    );
  }

  /// El formato que se descarga para llenar. Dos columnas y
  /// ya: pedir mas de una lista subida es pedir que la
  /// rellenen a mano, y a mano se rellena mal.
  formatoDeBase(): Promise<Buffer> {
    return construirFormato({
      nombre: 'Base',
      columnas: [
        {
          titulo: 'Correo',
          clave: 'correo',
          ancho: 34,
          ayuda: 'Obligatorio. Uno por fila. Sin espacios ni tildes.',
        },
        {
          titulo: 'Primer nombre',
          clave: 'nombre',
          ancho: 22,
          ayuda:
            'Opcional, pero sin el no se puede personalizar. Solo el primer nombre.',
        },
      ],
    });
  }

  /**
   * Sube la base, la revisa y guarda lo que sirve.
   *
   * Revisa ANTES y devuelve TODO lo que encontro, incluida la
   * fila de cada descarte: decir «hay errores» sin decir
   * cuales obliga a repasar trescientas filas a ojo.
   *
   * Reemplaza lo que hubiera. Subir el archivo otra vez es lo
   * que uno hace despues de corregirlo, y si se acumulara,
   * los correos malos de la primera version seguirian ahi.
   */
  async cargarBase(id: string, archivo: Buffer, ambito: string[]) {
    const c = await this.exigir(id, ambito);

    if (c.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Esta campaña ya se lanzó: la lista se congeló y no se puede cambiar.',
      );
    }
    if (c.origen !== 'CARGUE') {
      throw new BadRequestException(
        'Esta campaña sale de un segmento de su base, no de un archivo.',
      );
    }

    const lectura = await leerPlantilla(archivo, {
      nombre: 'Base',
      columnas: [
        { titulo: 'Correo', clave: 'correo' },
        { titulo: 'Primer nombre', clave: 'nombre' },
      ],
    });

    if (!lectura.columnasTraidas.includes('correo')) {
      throw new BadRequestException(
        'El archivo no trae la columna «Correo». Descargue el formato y no le cambie los títulos de la primera fila.',
      );
    }

    const revision = revisarBase(
      lectura.filas.map((f) => ({
        fila: f.fila,
        correo: f.valores.correo ?? '',
        nombre: f.valores.nombre ?? '',
      })),
    );

    await this.prisma.$transaction([
      this.prisma.destinatarioCampana.deleteMany({ where: { campanaId: id } }),
      this.prisma.destinatarioCampana.createMany({
        data: revision.listos.map((l) => ({
          campanaId: id,
          correo: l.correo,
          nombre: l.nombre,
        })),
        skipDuplicates: true,
      }),
    ]);

    this.log.log(
      `Base cargada en «${c.nombre}»: ${revision.listos.length} listos, ` +
        `${revision.descartados.length} descartados.`,
    );

    return {
      listos: revision.listos.length,
      /// Con su fila y su motivo, para poder ir a corregirlas.
      descartados: revision.descartados,
      repetidos: revision.repetidos,
      vacias: revision.vacias,
      /// Los que entraron pero huelen a dedazo. Entran igual:
      /// decide quien conoce la lista.
      sospechosos: revision.listos
        .filter((l) => l.sospecha)
        .map((l) => ({ fila: l.fila, correo: l.correo, sospecha: l.sospecha })),
      /// Cuantos dias va a tardar con los topes puestos. Se
      /// dice ANTES de lanzar: una lista de 900 no sale hoy,
      /// y enterarse mañana es enterarse tarde.
      diasQueTarda: Math.ceil(revision.listos.length / TOPE_DIARIO),
    };
  }

  async guardarBanner(
    id: string,
    datos: Buffer,
    mime: string,
    nombre: string,
    ambito: string[],
  ) {
    const c = await this.exigir(id, ambito);
    if (c.estado !== 'BORRADOR') {
      throw new BadRequestException(
        'Esta campaña ya se lanzó: cambiarle el banner ahora dejaría a unos ' +
          'con una imagen y a otros con otra.',
      );
    }

    await this.prisma.campana.update({
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

    return { nombre, tipo: mime, bytes: datos.length };
  }

  /**
   * Anota una apertura.
   *
   * `abiertoEn` guarda la PRIMERA; el contador sube siempre.
   * Los dos hacen falta: la primera dice cuándo lo vio, el
   * contador dice cuántas veces volvió -- que es lo poco que
   * el pixel puede decir con algo de sentido.
   */
  async anotarApertura(destinatarioId: string): Promise<void> {
    const d = await this.prisma.destinatarioCampana.findUnique({
      where: { id: destinatarioId },
      select: { abiertoEn: true },
    });
    if (!d) return;

    await this.prisma.destinatarioCampana.update({
      where: { id: destinatarioId },
      data: {
        aperturas: { increment: 1 },
        abiertoEn: d.abiertoEn ?? new Date(),
      },
    });
  }

  /** Anota un clic. Este sí es un hecho. */
  /**
   * A dónde puede llevar este clic, si es que puede.
   *
   * Público a propósito, como el resto de la ruta: quien lo
   * pulsa es una persona en su correo, sin sesión. Lo que se
   * comprueba no es quién pide, sino que el destino sea uno de
   * los que la propia campaña escribió.
   */
  async destinoDelClic(
    campanaId: string,
    destino: string | undefined,
  ): Promise<string | null> {
    const c = await this.prisma.campana.findUnique({
      where: { id: campanaId },
      select: { cuerpo: true },
    });
    if (!c) return null;
    return destinoPermitido(c.cuerpo, destino);
  }

  async anotarClic(destinatarioId: string): Promise<void> {
    const d = await this.prisma.destinatarioCampana.findUnique({
      where: { id: destinatarioId },
      select: { clicEn: true },
    });
    if (!d) return;

    await this.prisma.destinatarioCampana.update({
      where: { id: destinatarioId },
      data: { clics: { increment: 1 }, clicEn: d.clicEn ?? new Date() },
    });
  }

  /**
   * La campaña, SI es de un gremio que esta cuenta alcanza.
   *
   * El ámbito es obligatorio y va en la firma a propósito:
   * antes esto buscaba por id y ya, así que un admin de
   * ADECOPRIA que escribiera el id de una campaña de BRITCHAM
   * podía leerle los resultados, editarle el texto, pausarla o
   * lanzarla. Y `destinatarios()` le devolvía la lista entera
   * de correos, que es el activo comercial del gremio.
   *
   * Con el parámetro obligatorio, una ruta nueva que se olvide
   * de pasarlo no compila. Es la única forma de que esto no
   * vuelva a pasar cuando alguien añada la siguiente.
   */
  /// Un convenio que esta cuenta no alcanza no existe para
  /// ella. Mismo criterio que el resto del CRM.
  private exigirConvenio(convenioId: string, ambito: string[]) {
    if (!ambito.includes(convenioId)) {
      throw new ForbiddenException('No tiene acceso a ese convenio.');
    }
  }

  private async exigir(id: string, ambito: string[]) {
    const c = await this.prisma.campana.findUnique({ where: { id } });

    /// Una campaña de otro gremio responde IGUAL que una que
    /// no existe. Decir «no tiene permiso» confirmaría que ese
    /// id es real, y con eso se recorre el catálogo ajeno a
    /// base de probar.
    if (!c || !ambito.includes(c.convenioId)) {
      throw new NotFoundException('Esa campaña ya no existe.');
    }
    return c;
  }

  private revisarTexto(asunto: string, cuerpo: string) {
    if (!asunto.trim())
      throw new BadRequestException('El asunto no puede ir vacío.');
    if (!cuerpo.trim())
      throw new BadRequestException('El mensaje no puede ir vacío.');

    const conocidas = new Set(VARIABLES.map((v) => v.clave));
    const malas = variablesUsadas(`${asunto} ${cuerpo}`).filter(
      (v) => !conocidas.has(v),
    );
    if (malas.length > 0) {
      throw new BadRequestException(
        `Estas variables no existen: ${malas.map((v) => `{{${v}}}`).join(', ')}.`,
      );
    }
  }
}
