/** El que manda los correos que salen solos. */

import { Injectable, Logger } from '@nestjs/common';

import {
  DisparadorDePlantilla,
  EstadoCorreoAutomatico,
  MotivoDeCorreoAutomatico,
} from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import {
  estadoDeAutorizacion,
  noSeLePuedeEscribir,
  porQueNoSeLeMando,
} from '../autorizacion-vigente';
import { datosParaPlantilla } from '../campanas/datos-plantilla';
import { CorreoService } from '../correo.service';
import { porQueNo } from '../plantillas/etapas-de-plantilla';
import { cartaHtml } from '../carta/carta';
import { bloquesDe, comoTexto, resolverBloques } from '../carta/formato';
import { MarcaDeCarta } from '../carta/marca-de-la-carta';
import { urlDelCabezote } from '../plantillas/plantillas-correo.service';
import { quienFirma } from '../quien-firma';
import { resolver, valoresDe, variablesUsadas } from '../plantillas/variables';
import { EnlaceDeCompletado } from '../../preinscripcion/enlace-de-completado';
import { urlPublica } from '../url-publica';

/// Cuantas veces se reintenta un fallo de SMTP antes de darlo
/// por perdido, y cuanto se espera entre intentos. Cinco
/// intentos separados diez minutos cubren un corte de casi
/// una hora; tres seguidos cubrian cuatro segundos.
const INTENTOS = 5;
const ESPERA_ENTRE_INTENTOS = 10 * 60 * 1000;

/**
 * Cuanto puede esperar un acuse a que exista su plantilla.
 *
 * Al desplegar esto NINGUNA plantilla lleva disparador --la
 * columna nace en `NINGUNO`--, asi que hasta que alguien marque
 * una, todo lo que entre se queda esperando. Esperar esta bien;
 * esperar para siempre no: «recibimos su preinscripcion» una
 * semana tarde es peor que no mandarlo, y la fila se cierra
 * diciendo por que.
 */
const DIAS_ESPERANDO_PLANTILLA = 3;

@Injectable()
export class CorreoAutomaticoService {
  private readonly log = new Logger('CorreoAutomatico');

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    /// Al final: hay un spec que lo construye a mano.
    private readonly marcaDeCarta: MarcaDeCarta,
    private readonly enlaces: EnlaceDeCompletado,
  ) {}

  /**
   * Manda el mas viejo que este esperando.
   *
   * Devuelve si hubo trabajo, para que el trabajador sepa
   * cuanto dormir. `false` tambien cuando el correo esta
   * apagado en el servidor o cuando lo que espera no tiene
   * plantilla todavia: la fila se queda PENDIENTE --no es un
   * intento fallido, es que no se intento-- y el trabajador se
   * echa a dormir en vez de girar en vacio.
   */
  async mandarUno(): Promise<boolean> {
    await this.caducarLasQueSeQuedaronSinPlantilla();

    const plantillas = await this.plantillasQueDisparan();
    if (plantillas.length === 0) return false;

    /// Solo se toma lo que HOY se puede mandar. Si la cola
    /// tuviera delante un acuse de un gremio sin plantilla y
    /// se cogiera igual, esa fila taparia a todas las demas
    /// cada segundo y medio sin llegar a salir nunca.
    const conPlantillaGeneral = plantillas.some((p) => p.convenioId === null);
    const gremios = plantillas
      .map((p) => p.convenioId)
      .filter((id): id is string => id !== null);

    const fila = await this.prisma.correoAutomatico.findFirst({
      where: {
        estado: EstadoCorreoAutomatico.PENDIENTE,
        ...(conPlantillaGeneral ? {} : { convenioId: { in: gremios } }),
        /// Un fallo no se reintenta en el acto: se espera.
        OR: [
          { ultimoIntentoEn: null },
          { ultimoIntentoEn: { lt: new Date(Date.now() - ESPERA_ENTRE_INTENTOS) } },
        ],
      },
      orderBy: { creadoEn: 'asc' },
      select: {
        id: true,
        motivo: true,
        participanteId: true,
        convenioId: true,
        intentos: true,
      },
    });
    if (!fila) return false;

    /// SE RECLAMA ANTES DE MANDAR, y con un UPDATE condicional.
    ///
    /// Es el mismo candado que el de los cupos: si dos procesos
    /// leen la misma fila --un despliegue que solapa dos
    /// contenedores un instante-- solo uno la escribe, y el
    /// otro se encuentra 0 filas y se va. Sin esto los dos
    /// mandarian el mismo acuse y la persona recibiria dos.
    const tomada = await this.prisma.correoAutomatico.updateMany({
      where: { id: fila.id, estado: EstadoCorreoAutomatico.PENDIENTE },
      data: { intentos: fila.intentos + 1, ultimoIntentoEn: new Date() },
    });
    if (tomada.count === 0) return true;

    const plantilla = this.laQueLeToca(plantillas, fila.motivo, fila.convenioId);
    if (!plantilla) return true;

    /// La ficha: su etapa y su gremio. El gremio es el de QUIEN
    /// LO RECIBE y no el de la plantilla — con la general, esta
    /// firmaria «Convoca CRM» a alguien que se inscribio en
    /// ADECOPRIA. Es la regla del correo de acceso, escrita.
    const ficha = await this.prisma.participante.findUnique({
      where: { id: fila.participanteId },
      select: {
        etapa: true,
        convenio: { select: { sigla: true, nombre: true } },
      },
    });
    if (!ficha) {
      await this.cerrar(
        fila.id,
        EstadoCorreoAutomatico.OMITIDO,
        'Esa ficha ya no existe.',
      );
      return true;
    }

    /// La compuerta de etapa vale igual sin nadie mirando. El
    /// envio manual la comprueba en el SERVIDOR y no solo en el
    /// desplegable; este no tiene desplegable que valga.
    const noPorLaEtapa = porQueNo(plantilla.etapasPermitidas, ficha.etapa);
    if (noPorLaEtapa) {
      await this.cerrar(fila.id, EstadoCorreoAutomatico.OMITIDO, noPorLaEtapa);
      return true;
    }

    /// Que siga autorizando. Entre encolar y mandar pueden
    /// pasar minutos, y revocar es un derecho que no espera.
    const autorizacion = await estadoDeAutorizacion(
      this.prisma,
      fila.participanteId,
    );
    if (noSeLePuedeEscribir(autorizacion)) {
      await this.cerrar(
        fila.id,
        EstadoCorreoAutomatico.OMITIDO,
        porQueNoSeLeMando(autorizacion),
      );
      return true;
    }

    /// El ambito va en `null` porque aqui no hay sesion: lo
    /// escribe el sistema sobre la ficha que acaba de crear,
    /// no un gremio sobre la de otro.
    const datos = await datosParaPlantilla(
      this.prisma,
      fila.participanteId,
      null,
    );
    if (!datos) {
      await this.cerrar(
        fila.id,
        EstadoCorreoAutomatico.OMITIDO,
        'Esa ficha ya no existe.',
      );
      return true;
    }

    if (!datos.correo) {
      await this.cerrar(
        fila.id,
        EstadoCorreoAutomatico.OMITIDO,
        'No dejo correo: no hay a donde mandarlo.',
      );
      return true;
    }

    /**
     * EL ENLACE, si la plantilla lo pide.
     *
     * Con `emitirOReusar` y no `emitir`: el registro publico
     * ya emitio uno para el boton de la pantalla de gracias, y
     * es EL MISMO token. Acunar otro aqui mataria el que la
     * persona puede tener abierto en una pestana.
     *
     * `null` como emisor: lo manda el sistema, no una persona.
     */
    const valores = {
      ...valoresDe(datos),
      ...(await this.enlaceSiLoPide(plantilla, fila.participanteId)),
    };
    const asunto = resolver(plantilla.asunto, valores);

    /// El formato va sobre el texto de la PLANTILLA y las
    /// variables se ponen dentro de cada bloque: al revés, un
    /// valor que empiece por `#` se volvería el título.
    const puestos = resolverBloques(bloquesDe(plantilla.cuerpo), (t) =>
      resolver(t, valores),
    );
    const faltantes = [...new Set([...asunto.faltantes, ...puestos.faltantes])];
    const desconocidas = [
      ...new Set([...asunto.desconocidas, ...puestos.desconocidas]),
    ];

    /// La regla 1 de `variables.ts` vale igual cuando no hay
    /// nadie mirando: un hueco sin llenar no se manda. Aqui
    /// ademas queda escrito CUAL falto, que es lo unico que
    /// deja arreglar la plantilla.
    if (faltantes.length > 0) {
      await this.cerrar(
        fila.id,
        EstadoCorreoAutomatico.OMITIDO,
        `La plantilla pide datos que esta ficha no tiene: ${faltantes
          .map((f) => `{{${f}}}`)
          .join(', ')}.`,
      );
      return true;
    }

    /// Una variable que no existe tampoco sale: saldría la
    /// llave impresa en la bandeja de alguien, firmada por el
    /// gremio y sin que nada fallara.
    if (desconocidas.length > 0) {
      await this.cerrar(
        fila.id,
        EstadoCorreoAutomatico.OMITIDO,
        `La plantilla usa variables que no existen: ${desconocidas
          .map((f) => `{{${f}}}`)
          .join(', ')}.`,
      );
      return true;
    }

    const cabezote = plantilla.bannerMime
      ? urlDelCabezote(plantilla.id, plantilla.bannerVersion)
      : null;

    const r = await this.correo.enviar({
      deParte: quienFirma(ficha.convenio),
      para: datos.correo,
      asunto: asunto.texto,
      texto: comoTexto(puestos.bloques),
      html: cartaHtml({
        asunto: asunto.texto,
        bloques: puestos.bloques,
        marca: await this.marcaDeCarta.delConvenio(fila.convenioId),
        cabezote,
      }),
    });

    if (r.estado === 'APAGADO') {
      this.log.warn(
        'Hay correos automaticos esperando y el correo esta apagado en el servidor.',
      );
      /// Se devuelve el intento que se habia tomado: no se
      /// intento nada, y quemarlos dejaria el acuse en FALLO
      /// por una variable que falta.
      await this.prisma.correoAutomatico.update({
        where: { id: fila.id },
        data: { intentos: fila.intentos, ultimoIntentoEn: null },
      });
      return false;
    }

    if (r.estado === 'FALLO') {
      const intentos = fila.intentos + 1;
      const agotado = intentos >= INTENTOS;
      await this.prisma.correoAutomatico.update({
        where: { id: fila.id },
        data: {
          detalle: r.error,
          ...(agotado
            ? {
                estado: EstadoCorreoAutomatico.FALLO,
                procesadoEn: new Date(),
              }
            : {}),
        },
      });
      this.log.warn(
        `Fallo el correo de ${fila.motivo} (intento ${intentos}/${INTENTOS}): ${r.error}`,
      );
      return true;
    }

    await this.prisma.correoAutomatico.update({
      where: { id: fila.id },
      data: {
        estado: EstadoCorreoAutomatico.ENVIADO,
        detalle: null,
        entregadoA: r.para.join(', '),
        procesadoEn: new Date(),
      },
    });
    return true;
  }

  /// El enlace de completado, solo si la plantilla lo pide.
  private async enlaceSiLoPide(
    plantilla: { asunto: string; cuerpo: string },
    participanteId: string,
  ): Promise<{ enlace?: string | null }> {
    const usadas = variablesUsadas(`${plantilla.asunto} ${plantilla.cuerpo}`);
    if (!usadas.includes('enlace')) return {};

    const sitio = urlPublica();
    if (!sitio) return { enlace: null };

    const e = await this.enlaces.emitirOReusar(participanteId, null);
    return { enlace: `${sitio}/completar/${e.token}` };
  }

  /// Las que salen solas, activas, de cualquier gremio.
  private plantillasQueDisparan() {
    return this.prisma.plantillaCorreo.findMany({
      where: {
        activa: true,
        disparador: { not: DisparadorDePlantilla.NINGUNO },
      },
      select: {
        id: true,
        asunto: true,
        cuerpo: true,
        disparador: true,
        etapasPermitidas: true,
        bannerMime: true,
        bannerVersion: true,
        convenioId: true,
      },
    });
  }

  /**
   * Cual le toca a esa fila.
   *
   * La del gremio gana a la general. Sin la del gremio, la
   * general sirve para los dos: es lo mismo que hacen los
   * logos y la paleta.
   */
  private laQueLeToca<T extends { convenioId: string | null; disparador: DisparadorDePlantilla }>(
    plantillas: T[],
    motivo: MotivoDeCorreoAutomatico,
    convenioId: string,
  ): T | null {
    const suyas = plantillas.filter((p) => p.disparador === DISPARADOR[motivo]);
    return (
      suyas.find((p) => p.convenioId === convenioId) ??
      suyas.find((p) => p.convenioId === null) ??
      null
    );
  }

  /// Lo que lleva demasiado esperando una plantilla que nadie
  /// creo. Se cierra diciendolo, no se manda tarde.
  private async caducarLasQueSeQuedaronSinPlantilla(): Promise<void> {
    const limite = new Date(
      Date.now() - DIAS_ESPERANDO_PLANTILLA * 24 * 60 * 60 * 1000,
    );
    const r = await this.prisma.correoAutomatico.updateMany({
      where: {
        estado: EstadoCorreoAutomatico.PENDIENTE,
        intentos: 0,
        creadoEn: { lt: limite },
      },
      data: {
        estado: EstadoCorreoAutomatico.OMITIDO,
        detalle:
          `Estuvo ${DIAS_ESPERANDO_PLANTILLA} dias esperando una plantilla ` +
          'con ese disparador y no se creo ninguna. Un acuse tan tarde ' +
          'confunde mas de lo que ayuda.',
        procesadoEn: new Date(),
      },
    });
    if (r.count > 0) {
      this.log.warn(
        `${r.count} correo(s) automatico(s) caducaron sin plantilla que los mandara.`,
      );
    }
  }

  private async cerrar(
    id: string,
    estado: EstadoCorreoAutomatico,
    detalle: string,
  ): Promise<void> {
    await this.prisma.correoAutomatico.update({
      where: { id },
      data: { estado, detalle, procesadoEn: new Date() },
    });
  }

  /** Cuantos hay en cada estado, para la pantalla. */
  async resumen(convenios: string[]) {
    const filas = await this.prisma.correoAutomatico.groupBy({
      by: ['estado'],
      where: { convenioId: { in: convenios } },
      _count: { _all: true },
    });

    const cuenta = (e: EstadoCorreoAutomatico) =>
      filas.find((f) => f.estado === e)?._count._all ?? 0;

    /// El ultimo que no salio, con su motivo en palabras. Un
    /// contador de omitidos sin el porque no es accionable.
    const ultimoProblema = await this.prisma.correoAutomatico.findFirst({
      where: {
        convenioId: { in: convenios },
        estado: {
          in: [EstadoCorreoAutomatico.OMITIDO, EstadoCorreoAutomatico.FALLO],
        },
      },
      orderBy: { procesadoEn: 'desc' },
      select: { estado: true, detalle: true, procesadoEn: true },
    });

    return {
      pendientes: cuenta(EstadoCorreoAutomatico.PENDIENTE),
      enviados: cuenta(EstadoCorreoAutomatico.ENVIADO),
      omitidos: cuenta(EstadoCorreoAutomatico.OMITIDO),
      fallidos: cuenta(EstadoCorreoAutomatico.FALLO),
      ultimoProblema,
    };
  }
}

/// Que disparador le toca a cada motivo. Uno por uno y no un
/// `as unknown`: si manana hay un motivo nuevo, el
/// compilador pide su disparador.
const DISPARADOR: Record<MotivoDeCorreoAutomatico, DisparadorDePlantilla> = {
  PREINSCRIPCION: DisparadorDePlantilla.PREINSCRIPCION,
};
