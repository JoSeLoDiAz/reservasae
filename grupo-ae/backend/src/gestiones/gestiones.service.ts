/** Lo que un asesor hizo o hará por un negocio, y qué le falta. */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  EtapaOportunidad,
  Prisma,
  RolAdmin,
  TipoGestion,
  type Admin,
} from '../../generated/prisma';
import { conveniosQueReparten } from '../admin/permisos';
import type { Ambito } from '../admin/admin.guard';
import { llevanFichasEn } from '../crm/quien-lleva-fichas';
import { ETAPAS_ABIERTAS } from '../oportunidades/embudos';
import { PrismaService } from '../prisma/prisma.service';
import {
  cuboSegun,
  limitesDeAgenda,
  puedeBorrarse,
  type Cubo,
  type Limites,
} from './agenda';

/// Lo que llega del panel al crear.
export type NuevaGestion = {
  tipo: TipoGestion;
  titulo: string;
  nota?: string | null;
  venceEn?: string | null;
  hechaEn?: string | null;
  asesorId?: string | null;
};

export type CambiosDeGestion = {
  tipo?: TipoGestion;
  titulo?: string;
  nota?: string | null;
  venceEn?: string | null;
  asesorId?: string | null;
};

/// De quién se quiere ver la agenda.
export type Mirada = {
  /// Null es «de todo el equipo», y solo lo puede pedir un líder.
  asesorId: string | null;
  todos?: boolean;
};

/// Todas las etapas vivas de los dos embudos, sin repetir.
const ETAPAS_VIVAS: EtapaOportunidad[] = [
  ...new Set([...ETAPAS_ABIERTAS.EMPRESA, ...ETAPAS_ABIERTAS.PERSONA]),
];

const CAMPOS = {
  id: true,
  tipo: true,
  titulo: true,
  nota: true,
  venceEn: true,
  hechaEn: true,
  creadoEn: true,
  actualizadoEn: true,
  asesor: { select: { id: true, nombre: true } },
  creadaPor: { select: { id: true, nombre: true } },
} satisfies Prisma.GestionSelect;

/// En la agenda cada renglón tiene que decir de qué negocio es:
/// una lista de «Llamar» sin el nombre de la empresa no se puede
/// trabajar sin abrir doce pestañas.
const CAMPOS_CON_NEGOCIO = {
  ...CAMPOS,
  oportunidad: {
    select: {
      id: true,
      codigo: true,
      titulo: true,
      etapa: true,
      embudo: true,
      valor: true,
      empresa: { select: { razonSocial: true } },
      persona: { select: { primerNombre: true, primerApellido: true } },
    },
  },
} satisfies Prisma.GestionSelect;

@Injectable()
export class GestionesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear una gestión sobre una oportunidad.
   *
   * Sirve para las dos mitades del trabajo: agendar lo que hay
   * que hacer (`venceEn`) y registrar lo que ya se hizo
   * (`hechaEn`). No son dos rutas porque el caso más común es
   * mandar las dos —«llamé y quedé en volver el martes»— y
   * partirlo obligaría al panel a hacer dos peticiones que pueden
   * fallar por la mitad.
   */
  async crear(
    oportunidadId: string,
    datos: NuevaGestion,
    admin: Admin,
    ambito: Ambito,
  ) {
    /// El ámbito acota, y se comprueba contra la OPORTUNIDAD: la
    /// gestión no lleva convenio propio, lo hereda del negocio.
    /// Buscar la gestión por id sin pasar por aquí sería dejar
    /// que un id adivinado escriba en la cuenta de otro.
    const o = await this.prisma.oportunidad.findFirst({
      where: { id: oportunidadId, convenioId: { in: ambito.convenios } },
      select: { id: true, convenioId: true, asesorId: true },
    });
    if (!o) {
      throw new NotFoundException(
        'No encontramos esa oportunidad en las cuentas que usted trabaja.',
      );
    }

    const ahora = new Date();
    const venceEn = datos.venceEn ? new Date(datos.venceEn) : null;
    const hechaEn = datos.hechaEn ? new Date(datos.hechaEn) : null;

    /// Marcar hecha una gestión en el futuro es afirmar que ya
    /// pasó algo que no ha pasado. Se rechaza aquí y no en el DTO
    /// porque «futuro» depende del momento de la petición y eso
    /// un decorador no lo sabe.
    if (hechaEn && hechaEn.getTime() > ahora.getTime()) {
      throw new BadRequestException(
        'Esa gestión está fechada en el futuro. Si todavía no la ha hecho, ' +
          'póngale fecha de vencimiento y márquela cuando la haga.',
      );
    }

    /**
     * De quién es.
     *
     * Si no lo dicen, la hereda el dueño del negocio, y si el
     * negocio tampoco tiene dueño, se queda con quien la escribe.
     * Dejarla sin asesor sería crear una tarea que no sale en la
     * agenda de nadie: existe, nadie la ve y el negocio se muere
     * igual, que es exactamente lo que este módulo evita.
     */
    const asesorId = datos.asesorId ?? o.asesorId ?? admin.id;
    if (datos.asesorId) await this.compruebaAsesor(datos.asesorId, o.convenioId);

    return this.prisma.$transaction(async (tx) => {
      const creada = await tx.gestion.create({
        data: {
          oportunidadId: o.id,
          tipo: datos.tipo,
          titulo: datos.titulo.trim(),
          nota: datos.nota?.trim() || null,
          venceEn,
          hechaEn,
          asesorId,
          creadaPorId: admin.id,
        },
        select: CAMPOS,
      });

      /**
       * SÍ se toca `ultimoToqueEn`, también al agendar algo futuro.
       *
       * Es la decisión que más se discute y la respuesta corta es
       * que `ultimoToqueEn` mide ABANDONO, no actividad reciente:
       * de ahí sale la lista de «frías», que es la de negocios que
       * no está trabajando nadie. Un negocio con una visita
       * agendada para el martes no está abandonado, y sacarlo en
       * frías es un falso positivo — y una lista con falsos
       * positivos deja de leerse entera.
       *
       * El riesgo evidente es el contrario: agendar algo, no
       * hacerlo nunca y que el negocio quede fuera de frías para
       * siempre. Ese agujero lo tapa `esProximoPaso`, que deja de
       * contar los compromisos vencidos: al vencerse la tarea, el
       * negocio reaparece en «sin próximo paso». Las dos listas se
       * cubren la espalda, y por eso este módulo tiene las dos.
       *
       * Se usa `ahora` y no `hechaEn` aunque se esté registrando
       * la llamada de ayer: quien está tecleando está mirando ese
       * negocio hoy. Atrasar el reloj con la fecha tecleada haría
       * que «lleva N días quieta» dependiera del orden en que
       * alguien pone al día sus apuntes.
       */
      await tx.oportunidad.update({
        where: { id: o.id },
        data: { ultimoToqueEn: ahora },
      });

      return creada;
    });
  }

  /**
   * Marcarla hecha.
   *
   * Si ya lo estaba NO se reescribe la hora. Es lo mismo que hace
   * `primeraRespuestaEn` en el embudo y por lo mismo: la hora en
   * que se hizo de verdad es un dato, y el segundo clic —o el
   * reintento de una red mala— no debería moverlo. Devolver la
   * fila tal cual, en vez de un error, es lo correcto para el
   * panel: pidió que quedara hecha y está hecha.
   */
  async marcarHecha(id: string, ambito: Ambito) {
    const g = await this.buscar(id, ambito);
    if (g.hechaEn !== null) return this.leer(id);

    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      const hecha = await tx.gestion.update({
        where: { id },
        data: { hechaEn: ahora },
        select: CAMPOS,
      });
      /// Hacer la gestión es trabajar el negocio; el reloj de
      /// frías se mueve aquí igual que al crearla.
      await tx.oportunidad.update({
        where: { id: g.oportunidadId },
        data: { ultimoToqueEn: ahora },
      });
      return hecha;
    });
  }

  /**
   * Desmarcarla, para cuando se marcó por error.
   *
   * NO mueve `ultimoToqueEn`. La línea que separa las dos cosas es
   * la misma en todo el módulo: el reloj lo mueve el trabajo
   * —crear una gestión, hacerla—, no la corrección de un tecleo.
   * Si deshacer un clic contara como trabajar el negocio, el reloj
   * mediría tecleo y no gestión.
   */
  async desmarcar(id: string, ambito: Ambito) {
    const g = await this.buscar(id, ambito);
    if (g.hechaEn === null) return this.leer(id);

    return this.prisma.gestion.update({
      where: { id },
      data: { hechaEn: null },
      select: CAMPOS,
    });
  }

  /**
   * Editar.
   *
   * `undefined` deja el campo como está y `null` lo borra; el DTO
   * explica por qué hacen falta las dos. Una gestión ya hecha
   * también se puede editar: completar la nota de la llamada
   * después de colgar es el uso normal, y lo que no se puede es
   * borrarla.
   */
  async editar(
    id: string,
    cambios: CambiosDeGestion,
    ambito: Ambito,
  ) {
    const g = await this.buscar(id, ambito);

    /// Se puede cambiar de dueño, no quedarse sin ninguno. Es la
    /// misma razón por la que al crear se hereda uno: una gestión
    /// sin asesor no sale en la agenda de nadie, así que existe,
    /// nadie la ve y el negocio se muere igual. Aquí el `null`
    /// significaría borrar el dato, y por eso se niega en vez de
    /// ignorarse en silencio.
    if (cambios.asesorId !== undefined) {
      if (!cambios.asesorId) {
        throw new BadRequestException(
          'Una gestión necesita un responsable: sin él no aparece en la ' +
            'agenda de nadie. Pásesela a otra persona en vez de dejarla sin dueño.',
        );
      }
      await this.compruebaAsesor(cambios.asesorId, g.oportunidad.convenioId);
    }

    return this.prisma.gestion.update({
      where: { id },
      data: {
        ...(cambios.tipo !== undefined ? { tipo: cambios.tipo } : {}),
        ...(cambios.titulo !== undefined
          ? { titulo: cambios.titulo.trim() }
          : {}),
        ...(cambios.nota !== undefined
          ? { nota: cambios.nota?.trim() || null }
          : {}),
        ...(cambios.venceEn !== undefined
          ? { venceEn: cambios.venceEn ? new Date(cambios.venceEn) : null }
          : {}),
        ...(cambios.asesorId ? { asesorId: cambios.asesorId } : {}),
      },
      select: CAMPOS,
    });
  }

  /** Borrar, que solo vale para lo que todavía no se ha hecho. */
  async borrar(id: string, ambito: Ambito) {
    const g = await this.buscar(id, ambito);

    if (!puedeBorrarse(g.hechaEn)) {
      throw new BadRequestException(
        'Esa gestión ya está hecha y lo hecho es el historial del negocio: ' +
          'no se borra. Si la marcó por error, desmárquela primero y ' +
          'entonces sí podrá borrarla.',
      );
    }

    await this.prisma.gestion.delete({ where: { id } });
    return { borrada: true, id };
  }

  /**
   * Las de una oportunidad, en el orden en que se leen.
   *
   * Primero lo pendiente y por fecha —lo que hay que hacer, lo
   * más urgente arriba—, y debajo lo hecho de lo más reciente a
   * lo más viejo. Se ordena aquí y no en la base porque son dos
   * criterios en la misma lista y en un solo `orderBy` no caben;
   * son las gestiones de UN negocio, así que la lista es corta.
   */
  async deUnaOportunidad(oportunidadId: string, ambito: Ambito) {
    const o = await this.prisma.oportunidad.findFirst({
      where: { id: oportunidadId, convenioId: { in: ambito.convenios } },
      select: { id: true },
    });
    if (!o) {
      throw new NotFoundException(
        'No encontramos esa oportunidad en las cuentas que usted trabaja.',
      );
    }

    const filas = await this.prisma.gestion.findMany({
      where: { oportunidadId },
      select: CAMPOS,
    });

    const pendientes = filas
      .filter((g) => g.hechaEn === null)
      /// Las que no tienen fecha van al final de su grupo: son
      /// notas sueltas, no compromisos, y no compiten por la
      /// atención con lo que sí vence.
      .sort((a, b) => orden(a.venceEn) - orden(b.venceEn));
    const hechas = filas
      .filter((g) => g.hechaEn !== null)
      .sort((a, b) => (b.hechaEn as Date).getTime() - (a.hechaEn as Date).getTime());

    return { pendientes, hechas, cuantas: filas.length };
  }

  /**
   * La agenda: lo vencido, lo de hoy y lo que queda de semana.
   *
   * Una sola consulta y los tres cubos se reparten en memoria,
   * contra UN mismo corte de medianoche. Tres consultas con tres
   * rangos darían el mismo resultado el 99 % de las veces y
   * duplicarían o perderían un renglón justo a la medianoche, que
   * es cuando nadie lo está mirando y nadie lo va a saber
   * explicar después.
   */
  async agenda(admin: Admin, ambito: Ambito, mirada: Mirada, ahora = new Date()) {
    const deQuien = this.aQuienMira(admin, ambito, mirada);
    const limites = limitesDeAgenda(ahora);

    const filas = await this.prisma.gestion.findMany({
      where: {
        hechaEn: null,
        /// Sin fecha no es un compromiso y no se agenda; sale en
        /// la ficha del negocio, que es su sitio.
        venceEn: { not: null, lt: limites.finDeSemana },
        ...(deQuien ? { asesorId: deQuien } : {}),
        oportunidad: {
          convenioId: { in: ambito.convenios },
          /// Las tareas de un negocio ya ganado o perdido no son
          /// trabajo pendiente: son restos de cuando estaba vivo.
          /// Se quedan en su ficha como historial, pero ensucian
          /// una lista cuyo único propósito es «qué hago hoy».
          etapa: { in: ETAPAS_VIVAS },
        },
      },
      orderBy: [{ venceEn: 'asc' }],
      select: CAMPOS_CON_NEGOCIO,
    });

    const cubos: Record<Cubo, ReturnType<typeof this.paraLaAgenda>[]> = {
      VENCIDA: [],
      HOY: [],
      ESTA_SEMANA: [],
      MAS_ADELANTE: [],
    };
    for (const g of filas) {
      cubos[cuboSegun(g.venceEn as Date, limites)].push(
        this.paraLaAgenda(g, limites),
      );
    }

    return {
      dia: limites.dia,
      /// Se dice de quién es lo que se está mirando: un líder que
      /// ve la agenda del equipo tiene que saber que no es la
      /// suya, o la leerá como si lo fuera.
      deQuien: deQuien ?? 'EQUIPO',
      vencidas: cubos.VENCIDA,
      hoy: cubos.HOY,
      estaSemana: cubos.ESTA_SEMANA,
      cuantas: {
        vencidas: cubos.VENCIDA.length,
        hoy: cubos.HOY.length,
        estaSemana: cubos.ESTA_SEMANA.length,
        total: filas.length,
      },
    };
  }

  /**
   * Las oportunidades SIN PRÓXIMO PASO.
   *
   * La razón de ser de este módulo. Un negocio no se pierde de
   * golpe: se pierde porque nadie quedó en hacer nada y pasaron
   * tres semanas. Esta lista es la única que enseña ese vacío,
   * porque en el tablero esas oportunidades se ven idénticas a
   * las que van bien — misma columna, mismo color.
   *
   * Qué cuenta como próximo paso lo decide `esProximoPaso` en el
   * módulo puro, y aquí se traduce a un `where` con el mismo
   * corte de medianoche: pendiente, con fecha y sin vencer.
   */
  async sinProximoPaso(
    admin: Admin,
    ambito: Ambito,
    mirada: Mirada,
    ahora = new Date(),
  ) {
    const deQuien = this.aQuienMira(admin, ambito, mirada);
    const limites = limitesDeAgenda(ahora);

    const filas = await this.prisma.oportunidad.findMany({
      where: {
        convenioId: { in: ambito.convenios },
        etapa: { in: ETAPAS_VIVAS },
        ...(deQuien ? { asesorId: deQuien } : {}),
        gestiones: {
          none: { hechaEn: null, venceEn: { gte: limites.inicioDeHoy } },
        },
      },
      /// Lo más olvidado primero. El valor no manda el orden a
      /// propósito: un negocio pequeño abandonado hace un mes ya
      /// no se recupera, y uno grande de ayer sí — la urgencia la
      /// da el tiempo. El valor va en cada fila para que el panel
      /// pueda reordenar quien quiera.
      orderBy: { ultimoToqueEn: 'asc' },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        etapa: true,
        embudo: true,
        valor: true,
        ultimoToqueEn: true,
        asesor: { select: { id: true, nombre: true } },
        empresa: { select: { razonSocial: true } },
        persona: { select: { primerNombre: true, primerApellido: true } },
        /// Si hay alguna pendiente, por el `where` de arriba solo
        /// puede ser una vencida o una sin fecha: justo lo que
        /// distingue «nunca hubo plan» de «hubo plan y se
        /// incumplió», que se trabajan distinto.
        gestiones: {
          where: { hechaEn: null },
          orderBy: { venceEn: { sort: 'asc', nulls: 'last' } },
          take: 1,
          select: { id: true, tipo: true, titulo: true, venceEn: true },
        },
      },
    });

    const oportunidades = filas.map((o) => {
      const olvidada = o.gestiones[0] ?? null;
      return {
        id: o.id,
        codigo: o.codigo,
        titulo: o.titulo,
        etapa: o.etapa,
        embudo: o.embudo,
        valor: Number(o.valor),
        asesor: o.asesor,
        deQuien: nombreDe(o),
        ultimoToqueEn: o.ultimoToqueEn,
        diasQuieta: diasEntre(o.ultimoToqueEn, ahora),
        /// El compromiso que se quedó sin cumplir, si lo hubo.
        compromisoIncumplido: olvidada,
      };
    });

    return { dia: limites.dia, cuantas: oportunidades.length, oportunidades };
  }

  /**
   * Quién puede mirar la agenda de quién.
   *
   * Por omisión, la suya: es lo que abre el panel y es lo que un
   * asesor necesita. Ver la del equipo —o la de otra persona— es
   * organizar el trabajo ajeno, y eso lo hace quien responde por
   * el equipo. Se reutiliza `REPARTEN_FICHAS`, que es esa misma
   * decisión ya tomada para las fichas, en vez de inventar una
   * cuarta lista de quién es líder: dos listas de lo mismo acaban
   * discrepando y el síntoma es un botón que aparece y da 403.
   *
   * Pedir la agenda de un asesor de otra cuenta no hace falta
   * negarlo aquí: la consulta filtra por el ámbito y devolvería
   * una agenda vacía. Lo que sí se niega es que alguien sin
   * mando mire la de otro, que es lo que sería una fuga.
   */
  private aQuienMira(admin: Admin, ambito: Ambito, mirada: Mirada): string | null {
    const lidera =
      admin.rol === RolAdmin.SUPERADMIN ||
      conveniosQueReparten(ambito.roles).length > 0;

    const pedida = mirada.todos ? null : (mirada.asesorId ?? admin.id);
    if (pedida === admin.id) return admin.id;

    if (!lidera) {
      throw new ForbiddenException(
        'Su rol le deja ver su propia agenda. Para ver la del equipo pídale ' +
          'acceso de líder a quien administra el panel.',
      );
    }
    return pedida;
  }

  /// Que el asesor al que se le carga la gestión trabaje de
  /// verdad esa cuenta y siga activo. Sin esto se le puede
  /// agendar una visita a alguien que no ve el negocio —o que ya
  /// no entra al panel—, y la tarea existe sin que nadie la vea.
  private async compruebaAsesor(asesorId: string, convenioId: string) {
    const vale = await this.prisma.admin.findFirst({
      where: { id: asesorId, ...llevanFichasEn(convenioId) },
      select: { id: true },
    });
    if (!vale) {
      throw new BadRequestException(
        'Esa persona no trabaja los negocios de esta cuenta. Elija a alguien ' +
          'del equipo comercial del convenio.',
      );
    }
  }

  /// La gestión con su ámbito ya comprobado. Todas las rutas que
  /// tocan una gestión por id pasan por aquí: es el único sitio
  /// donde se ata la gestión a los convenios de quien pregunta.
  private async buscar(id: string, ambito: Ambito) {
    const g = await this.prisma.gestion.findFirst({
      where: { id, oportunidad: { convenioId: { in: ambito.convenios } } },
      select: {
        id: true,
        hechaEn: true,
        oportunidadId: true,
        oportunidad: { select: { convenioId: true } },
      },
    });
    if (!g) {
      throw new NotFoundException(
        'No encontramos esa gestión en las cuentas que usted trabaja.',
      );
    }
    return g;
  }

  private leer(id: string) {
    return this.prisma.gestion.findUniqueOrThrow({
      where: { id },
      select: CAMPOS,
    });
  }

  /// Un renglón de agenda: la gestión, de qué negocio es y cuánto
  /// lleva esperando.
  private paraLaAgenda(
    g: Prisma.GestionGetPayload<{ select: typeof CAMPOS_CON_NEGOCIO }>,
    limites: Limites,
  ) {
    const vence = g.venceEn as Date;
    return {
      id: g.id,
      tipo: g.tipo,
      titulo: g.titulo,
      nota: g.nota,
      venceEn: vence,
      asesor: g.asesor,
      creadaPor: g.creadaPor,
      /// Días de atraso, ya en días de Bogotá: 0 es «vence hoy» y
      /// los negativos son lo que todavía no vence.
      diasDeAtraso: Math.round(
        (limites.inicioDeHoy.getTime() - vence.getTime()) / 86_400_000,
      ),
      oportunidad: {
        id: g.oportunidad.id,
        codigo: g.oportunidad.codigo,
        titulo: g.oportunidad.titulo,
        etapa: g.oportunidad.etapa,
        embudo: g.oportunidad.embudo,
        valor: Number(g.oportunidad.valor),
        deQuien: nombreDe(g.oportunidad),
      },
    };
  }
}

/// A quién se le vende, en una línea, venga del embudo que venga.
function nombreDe(o: {
  empresa: { razonSocial: string } | null;
  persona: { primerNombre: string; primerApellido: string } | null;
}): string | null {
  if (o.empresa) return o.empresa.razonSocial;
  if (o.persona) return `${o.persona.primerNombre} ${o.persona.primerApellido}`;
  return null;
}

/// Las sin fecha al final, con un valor que ninguna fecha real
/// alcanza. Comparar `null` directamente lo colaría al principio.
function orden(fecha: Date | null): number {
  return fecha === null ? Number.MAX_SAFE_INTEGER : fecha.getTime();
}

function diasEntre(desde: Date, hasta: Date): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / 86_400_000);
}
