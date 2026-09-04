/** Las plantillas, y mandar una a un participante. */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CorreoService } from '../correo.service';
import { quienFirma } from '../quien-firma';
import type { EtapaParticipante } from '../../../generated/prisma';
import {
  estadoDeAutorizacion,
  noSeLePuedeEscribir,
  porQueNoSeLeMando,
} from '../autorizacion-vigente';
import { escaparAtributo, escaparHtml } from '../escapar';
import { urlPublicaDeLaApi } from '../url-publica';
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
    return this.prisma.plantillaCorreo.create({
      data: {
        nombre: datos.nombre.trim(),
        asunto: datos.asunto.trim(),
        cuerpo: datos.cuerpo,
        convenioId: datos.convenioId ?? null,
        etapasPermitidas: datos.etapasPermitidas ?? [],
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
    }>,
  ) {
    const antes = await this.exigir(id, ambito);

    this.revisar(datos.asunto ?? antes.asunto, datos.cuerpo ?? antes.cuerpo);

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
  ) {
    const [plantilla, datos] = await Promise.all([
      this.prisma.plantillaCorreo.findUnique({ where: { id: plantillaId } }),
      this.datosDe(participanteId, ambito),
    ]);

    if (!plantilla) throw new NotFoundException('Esa plantilla ya no existe.');

    const valores = valoresDe(datos.datos);
    const asunto = resolver(plantilla.asunto, valores);
    const cuerpo = resolver(plantilla.cuerpo, valores);

    /// Los faltantes de los dos, juntos y sin repetir: a quien
    /// manda le da igual si el hueco estaba en el asunto o en
    /// el cuerpo, lo que necesita saber es qué le falta.
    const faltantes = [...new Set([...asunto.faltantes, ...cuerpo.faltantes])];

    return {
      para: datos.correo,
      nombre: datos.nombre,
      asunto: asunto.texto,
      cuerpo: cuerpo.texto,
      faltantes,
      desconocidas: [
        ...new Set([...asunto.desconocidas, ...cuerpo.desconocidas]),
      ],
      /// Se puede mandar si hay a dónde y no quedó ningún
      /// hueco sin llenar.
      sePuede: Boolean(datos.correo) && faltantes.length === 0,
    };
  }

  async enviar(participanteId: string, plantillaId: string, ambito: string[]) {
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

    const vista = await this.vistaPrevia(participanteId, plantillaId, ambito);

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
    const cabezote = plantilla?.bannerMime
      ? urlDelCabezote(plantillaId, plantilla.bannerVersion)
      : null;

    const r = await this.correo.enviar({
      deParte: quienFirma(ficha?.convenio),
      para: vista.para,
      asunto: vista.asunto,
      texto: vista.cuerpo,
      html: aHtml(vista.cuerpo, cabezote),
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
   * Todo lo que una plantilla puede necesitar de un lead.
   *
   * Una sola consulta: la vista previa se pide cada vez que
   * alguien cambia de plantilla en el desplegable, y no vale
   * la pena ir cinco veces a la base por cada clic.
   */
  /**
   * Los datos de la ficha, SI es de un gremio que esta cuenta
   * alcanza.
   *
   * El ambito es obligatorio y va en la firma a proposito.
   * Antes esto buscaba por id y ya, y las dos rutas de correo
   * de la ficha eran las UNICAS de su controlador que no lo
   * recibian: con el id de un participante ajeno se leia su
   * nombre, su cedula y su correo, y `enviar` le mandaba un
   * correo DE VERDAD a un ciudadano del otro gremio.
   */
  private async datosDe(participanteId: string, ambito: string[]) {
    const p = await this.prisma.participante.findUnique({
      where: { id: participanteId, convenioId: { in: ambito } },
      select: {
        persona: {
          select: {
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
            generoSepId: true,
            numeroDocumento: true,
            correo: true,
            celular: true,
          },
        },
        empresa: { select: { razonSocial: true } },
        reserva: { select: { empresa: { select: { razonSocial: true } } } },
        accionFormacion: {
          select: { codigo: true, nombre: true, modalidad: true },
        },
        cobertura: {
          select: {
            modalidad: true,
            ubicacion: { select: { nombre: true } },
            grupo: { select: { numero: true, fechaInicio: true } },
          },
        },
        asesor: { select: { nombre: true } },
        convenio: { select: { sigla: true, nombre: true } },
      },
    });

    if (!p) throw new NotFoundException('Ese lead ya no existe.');

    const persona = p.persona;
    /// La empresa propia y si no la de la reserva: `empresaId`
    /// se llena en el formulario largo, pero quien llegó por
    /// una reserva la tiene colgando de ahí.
    const empresa =
      p.empresa?.razonSocial ?? p.reserva?.empresa?.razonSocial ?? null;

    const datos: DatosDelParticipante = {
      primerNombre: persona.primerNombre,
      segundoNombre: persona.segundoNombre,
      primerApellido: persona.primerApellido,
      segundoApellido: persona.segundoApellido,
      generoSepId: persona.generoSepId,
      numeroDocumento: persona.numeroDocumento,
      correo: persona.correo,
      celular: persona.celular,
      empresa,
      accionFormacion: p.accionFormacion
        ? `${p.accionFormacion.codigo} · ${p.accionFormacion.nombre}`
        : null,
      grupo: p.cobertura?.grupo.numero ?? null,
      fechaInicio: p.cobertura?.grupo.fechaInicio ?? null,
      ubicacion: p.cobertura?.ubicacion.nombre ?? null,
      modalidad: enBonito(
        p.cobertura?.modalidad ?? p.accionFormacion?.modalidad,
      ),
      asesor: p.asesor?.nombre ?? null,
      gremio: p.convenio?.sigla ?? p.convenio?.nombre ?? null,
    };

    const nombre =
      [persona.primerNombre, persona.primerApellido]
        .filter(Boolean)
        .join(' ') || 'Este lead';

    return { datos, correo: persona.correo, nombre };
  }
}

/// PRESENCIAL -> Presencial. En un correo no se le grita a
/// nadie.
function enBonito(m: string | null | undefined): string | null {
  if (!m) return null;
  return m[0] + m.slice(1).toLocaleLowerCase('es-CO');
}

/**
 * El mismo texto, servible como HTML.
 *
 * Se escapa TODO antes de tocar nada: el cuerpo lo escribe
 * una persona y puede llevar `<`, `&` o comillas sin querer
 * decir nada de HTML. Después los saltos de línea se vuelven
 * párrafos, que es lo que quien escribió esperaba ver.
 */
export function aHtml(texto: string, cabezote?: string | null): string {
  /// El escapado vive en un solo sitio: habia tres copias en
  /// el modulo y no coincidian entre si.
  const escapado = escaparHtml(texto);

  const parrafos = escapado
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  /// Ancho tope 600 y `display:block`: es lo que aguantan
  /// Gmail y Outlook sin meter un hueco blanco debajo. El
  /// `alt` va vacio a proposito -- es decoracion, y con texto
  /// alternativo quien tenga las imagenes apagadas empieza el
  /// correo leyendo el nombre de un archivo.
  const franja = cabezote
    ? `<img src="${escaparAtributo(cabezote)}" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0">`
    : '';

  return (
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;' +
    'font-size:15px;line-height:1.55;color:#161a26">' +
    franja +
    parrafos +
    '</div>'
  );
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
