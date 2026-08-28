/** La cola de consultas al RUI. */

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

import { EstadoConsultaRui } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { nombreCompleto } from '../../comun/documento';
import { AuditoriaService, type Actor } from '../../comun/auditoria.service';
import { ColaRui } from './cola-rui';
import { partirNombre } from './partir-nombre';
import { nombreCoincide } from './comparar-nombres';
import { permisoDeRui } from './permiso-rui';
import { taparDocumento } from '../../comun/tapar';
import {
  PROVEEDOR_RUI,
  ProveedorRuiLocal,
  ruiEsSimulado,
  type ProveedorRui,
} from './proveedor';

/// Cuántas veces se reintenta antes de rendirse. Tres es
/// suficiente para un corte de red y poco para no dejar
/// una consulta rota girando toda la noche.
const INTENTOS_MAXIMOS = 3;

/// Lo que ve el asesor mientras espera.
export type EstadoRuiDeLaFicha = {
  estado: EstadoConsultaRui | 'SIN_CONSULTA';
  nombreEncontrado: string | null;
  nombreTecleado: string | null;
  nombreCoincide: boolean | null;
  resueltaEn: Date | null;
  /// Cuántas hay por delante. Solo cuando está esperando.
  porDelante: number | null;
  /// El detector es el de mentira: lo que sale no es el RUI.
  simulado: boolean;
  /// La persona es inventada: no se consulta y se dice.
  esDePrueba: boolean;
  /// POR QUE salio del simulador y no del RUI.
  ///
  /// Antes la ficha traia el motivo escrito a mano -- «se
  /// enciende con RUI_PROVEEDOR=VENTANILLA» -- y desde que
  /// hay mas de una razon para simular, ese texto manda a
  /// arreglar algo que ya estaba bien. El motivo lo sabe el
  /// servidor; que lo diga el servidor.
  motivoSimulado: string | null;
};

@Injectable()
export class RuiService {
  private readonly log = new Logger('RUI');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cola: ColaRui,
    private readonly auditoria: AuditoriaService,
    @Inject(PROVEEDOR_RUI) private readonly proveedor: ProveedorRui,
  ) {}

  /// Encolar y priorizar viven en `ColaRui`, que solo
  /// escribe filas. Aqui quedan como puerta de entrada para
  /// que quien ya llamaba a este servicio no tenga que
  /// cambiar de sitio.
  encolar(personaId: string, prioridad = 0): Promise<void> {
    return this.cola.encolar(personaId, prioridad);
  }

  priorizar(personaId: string): Promise<void> {
    return this.cola.priorizar(personaId);
  }

  /**
   * Se queda con el nombre del RUI.
   *
   * Cuando los dos no coinciden hay que decidir cuál vale, y
   * hasta ahora la ficha enseñaba la diferencia sin ofrecer
   * salida: el asesor veía «no coinciden» y tenía que ir a
   * teclear el nombre bueno a mano, campo por campo,
   * mirándolo en otra tarjeta.
   *
   * Del lado del Estado viene el nombre legal, que es el que
   * el SENA espera en el F7. Por eso esta es la única
   * dirección que se ofrece con un botón: al revés -- pisar
   * el RUI con lo que tecleó una persona -- no tendría
   * sentido, porque el RUI no es nuestro para corregirlo.
   *
   * Se parte con `partirNombre`, que sabe de nombres
   * compuestos colombianos. Y queda movimiento: mañana hay
   * que poder decir por qué cambió un nombre.
   */
  async tomarElNombreDelRui(
    personaId: string,
    participanteId: string,
    actor: Actor,
  ) {
    const c = await this.prisma.consultaRui.findFirst({
      where: { personaId, estado: EstadoConsultaRui.LISTA },
      orderBy: { creadoEn: 'desc' },
      select: { nombreEncontrado: true, simulado: true },
    });

    if (!c?.nombreEncontrado) {
      throw new BadRequestException(
        'Todavía no hay un nombre del RUI para esta persona.',
      );
    }
    if (c.simulado) {
      throw new BadRequestException(
        'Esa respuesta la dio el simulador, no el RUI. No se puede tomar como buena.',
      );
    }

    const partes = partirNombre(c.nombreEncontrado);

    const antes = await this.prisma.persona.findUnique({
      where: { id: personaId },
      select: {
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
      },
    });

    await this.prisma.persona.update({
      where: { id: personaId },
      data: {
        primerNombre: partes.primerNombre,
        segundoNombre: partes.segundoNombre || null,
        primerApellido: partes.primerApellido,
        segundoApellido: partes.segundoApellido || null,
      },
    });

    /// Se anotan los CAMPOS, no los nombres.
    ///
    /// Es la regla de este servicio de auditoria y es buena:
    /// guardar el valor viejo y el nuevo convertiria la
    /// auditoria en una segunda copia de los datos
    /// personales, y es la copia que nadie se acuerda de
    /// proteger. Que cambio se sabe; que decia antes, se
    /// mira en el historial de movimientos.
    /// Y queda en el HISTORIAL, no solo en la auditoría.
    ///
    /// La auditoría la miran los de sistemas; el historial lo
    /// mira el asesor, en la ficha, y es donde tiene que
    /// poder ver qué se le hizo a este lead y por qué. Un
    /// cambio de nombre que solo aparece en un registro
    /// interno es un cambio que nadie va a encontrar.
    ///
    /// Etapa antes y después iguales: no se movió de etapa,
    /// y así el historial lo pinta como «otra cosa que se le
    /// hizo», con su nota.
    const etapa = await this.prisma.participante.findUnique({
      where: { id: participanteId },
      select: { etapa: true },
    });

    if (etapa) {
      await this.prisma.movimientoParticipante.create({
        data: {
          participanteId,
          etapaAntes: etapa.etapa,
          etapaDespues: etapa.etapa,
          adminId: actor.id ?? null,
          nota:
            `Se dejó el nombre del RUI: «${antes ? nombreCompleto(antes) : '—'}» ` +
            `pasó a «${c.nombreEncontrado}»`,
        },
      });
    }

    await this.auditoria.registrar({
      actor,
      accion: 'PARTICIPANTE_EDITADO',
      entidad: 'Persona',
      entidadId: personaId,
      resumen: 'Se tomó el nombre que devolvió el RUI',
      camposTocados: [
        'primerNombre',
        'segundoNombre',
        'primerApellido',
        'segundoApellido',
      ],
    });

    return { nombre: c.nombreEncontrado, partes };
  }

  /** Lo que la ficha enseña mientras tanto. */
  async estadoDe(personaId: string): Promise<EstadoRuiDeLaFicha> {
    const c = await this.prisma.consultaRui.findFirst({
      where: { personaId },
      orderBy: { creadoEn: 'desc' },
    });

    const persona = await this.prisma.persona.findUnique({
      where: { id: personaId },
      select: { esDePrueba: true, numeroDocumento: true },
    });
    const esDePrueba = persona?.esDePrueba ?? false;

    /// El motivo se calcula con la misma funcion que decide
    /// si se consulta: si manana cambia la regla, el mensaje
    /// cambia con ella y no se queda mintiendo.
    const permiso = permisoDeRui(persona?.numeroDocumento ?? '');
    const motivo = (simulado: boolean) =>
      simulado ? (permiso.motivo || null) : null;

    if (!c) {
      return {
        estado: 'SIN_CONSULTA',
        nombreEncontrado: null,
        nombreTecleado: null,
        nombreCoincide: null,
        resueltaEn: null,
        porDelante: null,
        // aqui si vale la variable: no hay respuesta que
        // describir, sino con que se va a consultar
        simulado: ruiEsSimulado(),
        esDePrueba,
        motivoSimulado: motivo(ruiEsSimulado()),
      };
    }

    const esperando =
      c.estado === EstadoConsultaRui.PENDIENTE ||
      c.estado === EstadoConsultaRui.EN_CURSO;

    return {
      estado: c.estado,
      nombreEncontrado: c.nombreEncontrado,
      nombreTecleado: c.nombreTecleado,
      nombreCoincide: c.nombreCoincide,
      resueltaEn: c.resueltaEn,
      porDelante: esperando
        ? await this.porDelanteDe(c.prioridad, c.creadoEn)
        : null,
      // de la fila, no de la variable: describe ESTA
      // respuesta, no con que corre el servidor ahora
      simulado: esperando ? ruiEsSimulado() : c.simulado,
      esDePrueba,
      motivoSimulado: motivo(esperando ? ruiEsSimulado() : c.simulado),
    };
  }

  private async porDelanteDe(
    prioridad: number,
    creadoEn: Date,
  ): Promise<number> {
    return this.prisma.consultaRui.count({
      where: {
        estado: EstadoConsultaRui.PENDIENTE,
        OR: [
          { prioridad: { gt: prioridad } },
          { prioridad, creadoEn: { lt: creadoEn } },
        ],
      },
    });
  }

  /// Toma una y la marca EN_CURSO en la misma sentencia.
  /// SKIP LOCKED es lo que permite levantar un segundo
  /// worker sin que los dos agarren la misma fila.
  async tomarSiguiente() {
    const filas = await this.prisma.$queryRaw<
      Array<{ id: string; tipoDocumentoSepId: number; numeroDocumento: string }>
    >`
      UPDATE "consultas_rui"
      SET "estado" = 'EN_CURSO', "tomadaEn" = NOW(), "intentos" = "intentos" + 1
      WHERE "id" = (
        SELECT "id" FROM "consultas_rui"
        WHERE "estado" = 'PENDIENTE'
        ORDER BY "prioridad" DESC, "creadoEn" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id", "tipoDocumentoSepId", "numeroDocumento"
    `;

    return filas[0] ?? null;
  }

  /** Consulta una y guarda lo que salga. */
  async procesarUna(): Promise<boolean> {
    const tarea = await this.tomarSiguiente();
    if (!tarea) return false;

    /// El permiso se mira POR DOCUMENTO, no una vez al
    /// arrancar.
    ///
    /// En pruebas solo salen al portal del DNP los documentos
    /// cuyo dueño lo autorizó; el resto va al simulador. El
    /// candado de `esDePrueba` no bastaba: solo cubría las
    /// filas de la siembra, y quien se registrara despues
    /// nacia sin la marca y salia a internet.
    const permiso = permisoDeRui(tarea.numeroDocumento);
    if (!permiso.real) {
      this.log.warn(
        `No se consulta el RUI de ${taparDocumento(tarea.numeroDocumento)}: ${permiso.motivo}`,
      );
    }

    let resultado;
    try {
      resultado = permiso.real
        ? await this.proveedor.consultar(
            tarea.tipoDocumentoSepId,
            tarea.numeroDocumento,
          )
        : await this.simulador.consultar(
            tarea.tipoDocumentoSepId,
            tarea.numeroDocumento,
          );
    } catch (e) {
      resultado = { estado: 'FALLO' as const, error: (e as Error).message };
    }

    await this.guardar(tarea.id, resultado, !permiso.real);
    return true;
  }

  /// El simulador, para cuando el permiso lo manda ahi.
  private readonly simulador = new ProveedorRuiLocal(0);

  private async guardar(
    id: string,
    resultado: Awaited<ReturnType<ProveedorRui['consultar']>>,
    /// Si ESTA consulta la dio el simulador. No vale
    /// `ruiEsSimulado()`: eso dice con que arranco el
    /// servidor, no quien contesto a esta.
    fueSimulada = ruiEsSimulado(),
  ): Promise<void> {
    const c = await this.prisma.consultaRui.findUnique({
      where: { id },
      select: { intentos: true, nombreTecleado: true, personaId: true },
    });
    if (!c) return;

    if (resultado.estado === 'ENCONTRADO') {
      const coincide = c.nombreTecleado
        ? nombreCoincide(c.nombreTecleado, resultado.nombreCompleto)
        : null;

      await this.prisma.consultaRui.update({
        where: { id },
        data: {
          estado: EstadoConsultaRui.LISTA,
          nombreEncontrado: resultado.nombreCompleto,
          nombreCoincide: coincide,
          resueltaEn: new Date(),
          ultimoError: null,
          simulado: fueSimulada,
        },
      });
      return;
    }

    if (resultado.estado === 'SIN_RESULTADO') {
      await this.prisma.consultaRui.update({
        where: { id },
        data: {
          estado: EstadoConsultaRui.SIN_RESULTADO,
          resueltaEn: new Date(),
          simulado: fueSimulada,
        },
      });
      return;
    }

    // se rinde solo cuando se acabaron los intentos
    const seRinde = c.intentos >= INTENTOS_MAXIMOS;
    await this.prisma.consultaRui.update({
      where: { id },
      data: {
        estado: seRinde
          ? EstadoConsultaRui.FALLIDA
          : EstadoConsultaRui.PENDIENTE,
        ultimoError: resultado.error.slice(0, 500),
        resueltaEn: seRinde ? new Date() : null,
      },
    });

    if (seRinde)
      this.log.warn(`Consulta ${id} fallida tras ${c.intentos} intentos.`);
  }

  /** Para el tablero: cómo va la cola. */
  async resumen() {
    const filas = await this.prisma.consultaRui.groupBy({
      by: ['estado'],
      _count: { _all: true },
    });

    const porEstado = Object.fromEntries(
      filas.map((f) => [f.estado, f._count._all]),
    ) as Record<EstadoConsultaRui, number>;

    return {
      pendientes: porEstado.PENDIENTE ?? 0,
      enCurso: porEstado.EN_CURSO ?? 0,
      listas: porEstado.LISTA ?? 0,
      sinResultado: porEstado.SIN_RESULTADO ?? 0,
      fallidas: porEstado.FALLIDA ?? 0,
    };
  }

  /// Las que hay que mirar: el RUI trajo un nombre que no
  /// se parece al que tecleó la persona.
  async discrepancias(ambito: string[], limite = 50) {
    return this.prisma.consultaRui.findMany({
      // solo de gente con participacion en el ambito: el
      // resto del bloque RUI ya pasa por personaDe()
      where: {
        estado: EstadoConsultaRui.LISTA,
        nombreCoincide: false,
        persona: { participaciones: { some: { convenioId: { in: ambito } } } },
      },
      orderBy: { resueltaEn: 'desc' },
      take: limite,
      select: {
        id: true,
        personaId: true,
        nombreTecleado: true,
        nombreEncontrado: true,
        resueltaEn: true,
      },
    });
  }
}
