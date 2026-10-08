/** Las conversaciones de Lucid, colgadas de quien corresponde. */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { CanalContacto, EstadoConversacion } from '../../generated/prisma';
import { normalizarCelular } from '../comun/celular';
import { PrismaService } from '../prisma/prisma.service';
import { firmaDe, type Proveedor } from '../integraciones/proveedores';
import { aQuienSePega, type Candidato } from './a-quien-se-pega';
import { limiteDelOlvido } from './olvido';
import type { LoteDeNotasDto, NotaDeLucidDto } from './dto';

/// CUANTAS SE MIRAN POR PASADA. Cada una pregunta por su celular,
/// asi que un barrido sin tope en una base con miles de huerfanas
/// seria una tormenta de consultas cada vez. Con 200 y una pasada
/// cada media hora se recuperan 9.600 al dia, de sobra.
const POR_PASADA = 200;

@Injectable()
export class LucidService {
  private readonly log = new Logger('Lucid');

  constructor(private readonly prisma: PrismaService) {}

  async entra(dto: NotaDeLucidDto, sistema: Proveedor, delHost: string | null) {
    /// El gremio lo AFIRMA la direccion. Si vienen los dos y no
    /// coinciden se rechaza: resolverlo en silencio es como una
    /// conversacion acaba en el historial del otro gremio, que
    /// es mezclar dos tratamientos de datos distintos.
    if (delHost && dto.convenio && dto.convenio !== delHost) {
      throw new BadRequestException(
        `La dirección dice «${delHost}» y el cuerpo dice «${dto.convenio}». ` +
          'No se adivina cuál: mande uno de los dos, o los dos iguales.',
      );
    }
    const slug = delHost ?? dto.convenio ?? null;
    if (!slug) {
      throw new BadRequestException(
        'Falta el convenio. Mándelo en el cuerpo, o llame al subdominio del gremio.',
      );
    }

    const convenio = await this.prisma.convenio.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!convenio) throw new BadRequestException(`No existe el convenio «${slug}».`);

    /// Un reintento no deja dos notas. A 200 por minuto los
    /// reintentos son certeza, no hipotesis.
    const yaEstaba = await this.prisma.conversacionEntrante.findUnique({
      where: {
        origenSistema_externoId: { origenSistema: sistema, externoId: dto.externoId },
      },
      select: { id: true, estado: true, notaId: true },
    });
    if (yaEstaba) {
      return {
        estado: yaEstaba.estado,
        conversacionId: yaEstaba.id,
        notaId: yaEstaba.notaId,
        repetido: true,
        motivo: 'Esa conversación ya había llegado.',
      };
    }

    const celular = normalizarCelular(dto.telefono);
    const candidatos = await this.candidatosDe(celular, convenio.id);
    const donde = aQuienSePega(candidatos);

    const conversacion = await this.prisma.conversacionEntrante.create({
      data: {
        convenioId: convenio.id,
        origenSistema: sistema,
        externoId: dto.externoId,
        celular,
        ocurridoEn: dto.ocurridoEn ? new Date(dto.ocurridoEn) : null,
        resumen: dto.resumen,
        carga: (dto.carga ?? null) as never,
        estado: donde.estado,
        candidatos: donde.estado === 'PEGADA' ? undefined : (candidatos as never),
      },
      select: { id: true },
    });

    if (donde.estado !== 'PEGADA') {
      this.log.log(`Conversación ${dto.externoId}: ${donde.estado} — ${donde.motivo}`);
      return {
        estado: donde.estado,
        conversacionId: conversacion.id,
        notaId: null,
        repetido: false,
        motivo: donde.motivo,
      };
    }

    const notaId = await this.pegarLaNota(
      conversacion.id,
      donde.destino,
      dto.resumen,
      sistema,
    );

    return {
      estado: 'PEGADA' as const,
      conversacionId: conversacion.id,
      notaId: notaId,
      repetido: false,
      motivo: donde.motivo,
      adjuntadaA: { tipo: donde.destino.tipo, id: donde.destino.id },
    };
  }

  /**
   * VARIAS CONVERSACIONES, CONTESTADAS FILA POR FILA.
   *
   * Llama a `entra()` una por una a proposito, y no en una
   * transaccion: en un historico de 500, que la fila 17 traiga un
   * telefono imposible no puede tumbar las otras 499. Es el mismo
   * criterio que la carga masiva de personas ---«las filas se crean
   * una a una, no en transaccion»--- y que el lote de leads.
   *
   * Y SE CONTESTA QUE PASO CON CADA UNA, no un total: «pegadas: 300»
   * no le dice a quien lo manda cual se quedo sin dueno ni cual estaba
   * ya. Con el `externoId` de vuelta puede reintentar solo lo que
   * haga falta.
   */
  async entraLote(dto: LoteDeNotasDto, sistema: Proveedor, delHost: string | null) {
    const filas: Array<Record<string, unknown>> = [];
    for (const nota of dto.notas) {
      try {
        filas.push({ externoId: nota.externoId, ...(await this.entra(nota, sistema, delHost)) });
      } catch (e) {
        /// El fallo de una fila es un DATO de la respuesta, no una
        /// excepcion: si subiera, el lote entero contestaria 400 y
        /// quien lo manda no sabria cuantas si entraron.
        filas.push({
          externoId: nota.externoId,
          estado: 'RECHAZADA',
          motivo: (e as Error).message,
        });
      }
    }

    const cuenta = (x: string) => filas.filter((f) => f.estado === x).length;
    return {
      recibidas: filas.length,
      pegadas: cuenta('PEGADA'),
      sinDueno: cuenta('SIN_DUENO'),
      ambiguas: cuenta('AMBIGUA'),
      rechazadas: cuenta('RECHAZADA'),
      /// Las que ya estaban no son un fallo ni una escritura: es la
      /// idempotencia funcionando, y hay que poder distinguirlas.
      repetidas: filas.filter((f) => f.repetido === true).length,
      filas,
    };
  }

  /**
   * LAS HUERFANAS QUE YA TIENEN DUENO: se les cuelga su nota.
   *
   * «Los que no estan registrados se ingresen de manera masiva y
   * POSTERIORMENTE guarde la gestion de los mensajes que haya hecho el
   * bot con la persona» (Josse, 8 oct 2026). En ese orden no
   * funcionaba: una conversacion de alguien que no esta en el CRM
   * nacia `SIN_DUENO` y NADA la volvia a mirar. El unico proceso que
   * las tocaba era el olvidador, que a los 60 dias LAS BORRA.
   *
   * Y el propio codigo lo tenia escrito como intencion sin cumplir:
   * «el numero sin dueno de hoy es el dueno de manana».
   *
   * ES UN BARRIDO Y NO UN GANCHO EN CADA ALTA, y eso es deliberado:
   * hay muchos caminos que crean una ficha o un lead ---el panel, la
   * carga masiva, los dos webhooks, la conversion automatica--- y
   * colgarlo de cada uno se olvida en alguno. Es la leccion de
   * `crear()`, que dejo sin asesor a dos de sus tres llamadores sin
   * que nada fallara. Aqui, con un solo sitio, un camino nuevo no
   * puede olvidarse de nada.
   *
   * SOLO `SIN_DUENO`, igual que el olvidador, y por lo mismo:
   *   PEGADA  ya tiene su nota.
   *   AMBIGUA SI es de alguien ---de varios, por eso no se eligio---.
   *           Que aparezca otra persona mas no lo resuelve: lo
   *           empeora. Esas se miran, no se repescan.
   *
   * LA VENTANA ES LA MISMA DEL OLVIDADOR, 60 dias, y tampoco es
   * casualidad: mas alla de ahi la fila ya no existe, asi que una
   * ventana mas corta dejaria un hueco ---conversaciones vivas que
   * nadie vuelve a mirar y que despues se borran--- y una mas larga no
   * encontraria nada.
   */
  async repescar(hoy = new Date()): Promise<{ miradas: number; pegadas: number }> {
    const huerfanas = await this.prisma.conversacionEntrante.findMany({
      where: {
        estado: EstadoConversacion.SIN_DUENO,
        recibidoEn: { gte: limiteDelOlvido(hoy) },
      },
      select: {
        id: true,
        convenioId: true,
        celular: true,
        resumen: true,
        origenSistema: true,
      },
      /// De las mas viejas primero: son las que menos les queda
      /// antes de que el olvidador se las lleve.
      orderBy: { recibidoEn: 'asc' },
      take: POR_PASADA,
    });

    let pegadas = 0;
    for (const c of huerfanas) {
      const donde = aQuienSePega(await this.candidatosDe(c.celular, c.convenioId));
      if (donde.estado !== 'PEGADA') continue;
      await this.pegarLaNota(
        c.id,
        donde.destino,
        c.resumen,
        c.origenSistema as Proveedor,
      );
      pegadas += 1;
      this.log.log(
        `Repescada una conversación de ${c.celular}: ya es ${donde.destino.tipo.toLowerCase()}.`,
      );
    }

    return { miradas: huerfanas.length, pegadas };
  }

  /**
   * CUELGA LA NOTA Y DEJA LA CONVERSACION PEGADA.
   *
   * Extraido de `entra()` cuando llego el repescador, porque los dos
   * tienen que hacer EXACTAMENTE esto: la firma que sale de la llave,
   * la nota SIN resultado, mover la ultima gestion si es de un lead, y
   * dejar `notaId` y `estado` cuadrados. Con dos copias, el dia que
   * una aprenda algo ---otro canal, otra firma--- la otra no.
   *
   * Devuelve el id de la nota.
   */
  private async pegarLaNota(
    conversacionId: string,
    destino: { tipo: 'FICHA' | 'LEAD'; id: string },
    texto: string,
    sistema: Proveedor,
  ): Promise<string> {
    const nota = await this.prisma.notaDeGestion.create({
      data: {
        participanteId: destino.tipo === 'FICHA' ? destino.id : null,
        leadId: destino.tipo === 'LEAD' ? destino.id : null,
        autorId: null,
        /// La firma sale del MISMO sitio que la llave. Estaba
        /// escrita a fuego como «Lucid (WhatsApp)», asi que la
        /// nota de otro proveedor quedaba firmada por Lucid --y
        /// las notas no se borran: «una correccion es otra nota».
        autorNombre: firmaDe(sistema),
        texto,
        canales: [CanalContacto.WHATSAPP],
        /// SIN resultado, y no es un descuido. `gestionDe()`
        /// cuenta los intentos con `resultado: { not: null }` y
        /// los «sin respuesta» desde el ultimo CONTACTO. Poner
        /// CONTACTO aqui vaciaria sola la lista de a quien hay
        /// que insistirle, que es el producto. La regla ya
        /// estaba escrita: las notas del sistema no son intentos.
        resultado: null,
      },
      select: { id: true },
    });

    /// El `estado` va aqui y no solo en `entra()`: una repescada
    /// nace SIN_DUENO y hay que dejarla PEGADA, o el olvidador la
    /// borraria a los 60 dias con su nota ya colgada.
    await this.prisma.conversacionEntrante.update({
      where: { id: conversacionId },
      data: { notaId: nota.id, estado: EstadoConversacion.PEGADA },
    });

    /// Si es de un lead, se mueve su ultima gestion: es verdad
    /// que se le toco, y la cola del asesor se ordena por eso.
    if (destino.tipo === 'LEAD') {
      await this.prisma.leadEntrante.update({
        where: { id: destino.id },
        data: { ultimaGestionEn: new Date() },
      });
    }

    return nota.id;
  }

  /**
   * Quien puede ser el dueno de ese numero, dentro del gremio.
   *
   * Los leads YA convertidos no son candidato aparte: son su
   * ficha, y contarlos dos veces mandaria a cuarentena a todo el
   * que llego por pauta y despues se inscribio.
   */
  private async candidatosDe(celular: string, convenioId: string): Promise<Candidato[]> {
    if (!celular) return [];

    const [fichas, leads] = await Promise.all([
      this.prisma.participante.findMany({
        where: { convenioId, persona: { celular } },
        select: { id: true, personaId: true, creadoEn: true },
        take: 20,
      }),
      this.prisma.leadEntrante.findMany({
        where: { convenioId, celular, participanteId: null },
        select: { id: true, recibidoEn: true },
        take: 20,
      }),
    ]);

    return [
      ...fichas.map((f) => ({
        tipo: 'FICHA' as const,
        id: f.id,
        personaId: f.personaId,
        creadoEn: f.creadoEn,
      })),
      ...leads.map((l) => ({ tipo: 'LEAD' as const, id: l.id, creadoEn: l.recibidoEn })),
    ];
  }
}
