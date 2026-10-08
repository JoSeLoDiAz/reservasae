/** El calendario de los grupos, que es de donde cuelga todo. */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { RolConvenio } from '../../generated/prisma';
import { fraseDeHorario } from '../comun/horario-de-grupo';
import { ETAPAS_VIVAS } from '../crm/crm.service';
import {
  AuditoriaService,
  ENTIDADES,
  type Actor,
} from '../comun/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarCuposDto,
  ActualizarGrupoDto,
  ActualizarInformacionDto,
} from './dto';
import { loQueEstaMal } from './sesiones';

/**
 * Quién puede llevar un grupo como asesor académico.
 *
 * Los TRES roles cuya tabla de permisos da ESCRIBIR en «académico»
 * ---`PERMISOS` en `admin/permisos.ts`---. Se lista aquí y no se
 * calcula sobre aquella tabla porque asignar un grupo es una decisión
 * de negocio: el día que un rol nuevo pueda escribir en académico, que
 * alguien decida a mano si además debe poder llevar grupos.
 *
 * COUNTRY_MANAGER queda fuera a propósito: su permiso en «académico»
 * es de VER, no de escribir. Dirige y supervisa; no lleva grupos.
 */
const ROLES_ACADEMICOS: RolConvenio[] = [
  RolConvenio.GESTOR_ACADEMICO,
  RolConvenio.LIDER_ACADEMICO,
  RolConvenio.LIDER_SISTEMAS,
];

/// `ETAPAS_VIVAS` se importa del CRM. Aqui habia una copia
/// tecleada aparte que decia lo mismo con otras etapas, y
/// el mismo grupo reportaba una ocupacion en el cronograma
/// y otra en las ofertas.

/** En qué punto está un grupo respecto de hoy. */
export type EstadoGrupo =
  'SIN_FECHAS' | 'POR_EMPEZAR' | 'EN_CURSO' | 'TERMINADO';

export function estadoDeGrupo(
  inicio: Date | null,
  fin: Date | null,
  hoy = new Date(),
): EstadoGrupo {
  if (!inicio) return 'SIN_FECHAS';
  if (hoy < inicio) return 'POR_EMPEZAR';
  if (fin && hoy > fin) return 'TERMINADO';
  return 'EN_CURSO';
}

@Injectable()
export class CronogramaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Las acciones con sus grupos y sus fechas. */
  async listar(ambito: string[]) {
    const acciones = await this.prisma.accionFormacion.findMany({
      where: { convenioId: { in: ambito } },
      orderBy: [{ convenio: { orden: 'asc' } }, { orden: 'asc' }],
      select: {
        id: true,
        codigo: true,
        nombre: true,
        horas: true,
        visible: true,
        evento: true,
        modalidad: true,
        convenioId: true,
        convenio: { select: { slug: true, sigla: true } },
        grupos: {
          orderBy: { numero: 'asc' },
          select: {
            id: true,
            numero: true,
            modalidad: true,
            fechaInicio: true,
            fechaFin: true,
            dias: true,
            sesiones: {
              orderBy: { orden: 'asc' },
              select: {
                id: true,
                orden: true,
                tipo: true,
                dia: true,
                horaInicio: true,
                horaFin: true,
                ubicacionId: true,
                ubicacion: { select: { nombre: true, tipo: true } },
              },
            },
            sepGrupoId: true,
            asesorAcademicoId: true,
            asesorAcademico: { select: { id: true, nombre: true } },
            sede: { select: { nombre: true } },
            coberturas: {
              orderBy: { ubicacion: { nombre: 'asc' } },
              select: {
                id: true,
                cuposBase: true,
                cuposMaximos: true,
                ubicacionId: true,
                ubicacion: { select: { nombre: true, tipo: true } },
                _count: {
                  select: {
                    participantes: {
                      where: { etapa: { in: [...ETAPAS_VIVAS] } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const hoy = new Date();

    return acciones.map((a) => {
      const grupos = a.grupos.map((g) => {
        const cupos = g.coberturas.reduce((s, c) => s + c.cuposBase, 0);
        /// El TOPE, con el 30 % dentro: es contra lo que se
        /// mide la ocupacion en todo el panel.
        const tope = g.coberturas.reduce((s, c) => s + c.cuposMaximos, 0);
        const inscritos = g.coberturas.reduce(
          (s, c) => s + c._count.participantes,
          0,
        );
        return {
          id: g.id,
          numero: g.numero,
          modalidad: g.modalidad,
          fechaInicio: g.fechaInicio,
          fechaFin: g.fechaFin,
          dias: g.dias,
          sesiones: g.sesiones,
          /// La frase, para quien solo la pinta.
          horario: fraseDeHorario(g),
          sepGrupoId: g.sepGrupoId,
          sede: g.sede?.nombre ?? null,
          /// Quién lleva el grupo. El id, para el selector; el
          /// nombre, para pintarlo sin pedir la lista de cuentas
          /// ---que es de SUPERADMIN y aquí entra un gestor---.
          asesorAcademicoId: g.asesorAcademicoId,
          asesorAcademico: g.asesorAcademico?.nombre ?? null,
          estado: estadoDeGrupo(g.fechaInicio, g.fechaFin, hoy),
          cupos,
          tope,
          inscritos,
          ubicaciones: g.coberturas.map((c) => ({
            id: c.id,
            ubicacionId: c.ubicacionId,
            nombre: c.ubicacion.nombre,
            tipo: c.ubicacion.tipo,
            cupos: c.cuposBase,
            /// El tope con sobrecupo, para poder editarlo: la pildora
            /// ensenia lo comprometido --lo que se le prometio al SENA--
            /// pero quien reparte plazas necesita ver los dos.
            tope: c.cuposMaximos,
            inscritos: c._count.participantes,
          })),
        };
      });

      return {
        id: a.id,
        codigo: a.codigo,
        nombre: a.nombre,
        horas: a.horas,
        /// El id del gremio, no su sigla: con él la ficha del grupo
        /// sabe a quién puede ofrecer como asesor.
        convenioId: a.convenioId,
        visible: a.visible,
        // qué es: CURSO, FORO, TALLER…
        evento: a.evento,
        modalidad: a.modalidad,
        convenio: a.convenio.sigla ?? a.convenio.slug,
        grupos,
        // lo que se mira de un vistazo por acción
        cupos: grupos.reduce((s, g) => s + g.cupos, 0),
        tope: grupos.reduce((s, g) => s + g.tope, 0),
        inscritos: grupos.reduce((s, g) => s + g.inscritos, 0),
        sinFechas: grupos.filter((g) => g.estado === 'SIN_FECHAS').length,
      };
    });
  }

  /**
   * Quiénes pueden llevar un grupo, para el selector de la ficha.
   *
   * Va aquí y no en `admin/usuarios` porque aquella lista es de
   * SUPERADMIN ---administra cuentas, claves y roles--- y quien asigna
   * un grupo es un gestor con permiso de configuración. Son dos cosas
   * distintas y no tienen por qué compartir puerta.
   *
   * Devuelve una cuenta por persona con los gremios en los que puede
   * llevar grupos: la misma persona puede ser académica en uno y de
   * inscripción en otro, y solo debe aparecer donde manda.
   */
  async asesoresPosibles(ambito: string[]) {
    const filas = await this.prisma.adminConvenio.findMany({
      where: {
        convenioId: { in: ambito },
        rol: { in: ROLES_ACADEMICOS },
        admin: { activo: true },
      },
      select: {
        convenioId: true,
        admin: { select: { id: true, nombre: true } },
      },
      orderBy: { admin: { nombre: 'asc' } },
    });

    /// Una fila por persona: la tabla trae una por rol y gremio, y en
    /// el desplegable el mismo nombre tres veces no es una opción.
    const porPersona = new Map<
      string,
      { id: string; nombre: string; convenios: string[] }
    >();
    for (const f of filas) {
      const ya = porPersona.get(f.admin.id);
      if (ya) {
        if (!ya.convenios.includes(f.convenioId)) {
          ya.convenios.push(f.convenioId);
        }
      } else {
        porPersona.set(f.admin.id, {
          id: f.admin.id,
          nombre: f.admin.nombre,
          convenios: [f.convenioId],
        });
      }
    }
    return [...porPersona.values()];
  }

  /**
   * Los tres textos de la accion. Un vacio los borra.
   *
   * Lo que NO se manda no se toca: Prisma trata `undefined` como «deja
   * lo que hay», y asi guardar solo el contenido no borra el objetivo.
   */
  async actualizarInformacion(
    id: string,
    dto: ActualizarInformacionDto,
    ambito: string[],
  ) {
    const accion = await this.prisma.accionFormacion.findFirst({
      where: { id, convenioId: { in: ambito } },
      select: { id: true },
    });
    if (!accion)
      throw new NotFoundException('Esa acción de formación no existe.');

    const limpio = (v?: string | null) =>
      v === undefined
        ? undefined
        : v === null || v.trim() === ''
          ? null
          : v.trim();

    return this.prisma.accionFormacion.update({
      where: { id },
      data: {
        objetivo: limpio(dto.objetivo),
        contenido: limpio(dto.contenido),
        competencia: limpio(dto.competencia),
      },
      select: {
        id: true,
        codigo: true,
        objetivo: true,
        contenido: true,
        competencia: true,
      },
    });
  }

  /** Pone o corrige las fechas de un grupo. */
  async actualizarGrupo(
    id: string,
    dto: ActualizarGrupoDto,
    ambito: string[],
    actor: Actor,
    ip?: string,
  ) {
    const grupo = await this.prisma.grupo.findFirst({
      where: { id, accionFormacion: { convenioId: { in: ambito } } },
      select: {
        id: true,
        fechaInicio: true,
        fechaFin: true,
        accionFormacion: { select: { convenioId: true } },
        coberturas: { select: { ubicacionId: true } },
        /// Los días de antes, para que la huella diga de qué a qué.
        sesiones: { select: { dia: true }, orderBy: { orden: 'asc' } },
      },
    });
    if (!grupo) throw new NotFoundException('Ese grupo no existe.');

    const inicio =
      dto.fechaInicio === null
        ? null
        : dto.fechaInicio
          ? new Date(dto.fechaInicio)
          : grupo.fechaInicio;
    const fin =
      dto.fechaFin === null
        ? null
        : dto.fechaFin
          ? new Date(dto.fechaFin)
          : grupo.fechaFin;

    // un grupo que termina antes de empezar deja el
    // seguimiento academico sin forma de medir el avance
    if (inicio && fin && fin < inicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio.',
      );
    }

    // sin inicio, el fin no significa nada
    if (!inicio && fin) {
      throw new BadRequestException(
        'Ponga primero la fecha de inicio: sin ella no se puede medir el avance.',
      );
    }

    /// LAS SESIONES, si vienen. `undefined` es «no las mandes
    /// y no las toques»; una lista vacia SI las borra todas.
    ///
    /// Se juzgan contra las fechas que QUEDARAN, no contra las
    /// que habia: mover el rango tambien saca una sesion que
    /// estaba bien.
    if (dto.sesiones) {
      const ubicaciones = grupo.coberturas.map((c) => c.ubicacionId);
      const mal = dto.sesiones.flatMap((ses, i) =>
        loQueEstaMal(ses, { inicio, fin, ubicaciones }).map(
          (m) => `Sesión ${i + 1}: ${m}`,
        ),
      );
      if (mal.length) throw new BadRequestException(mal.join(' '));
    }

    /// EL ASESOR SE COMPRUEBA CONTRA EL GREMIO DEL GRUPO, no contra
    /// el ámbito de quien edita. Son dos cosas distintas: un líder de
    /// sistemas ve los dos gremios, y sin esto podría poner de asesor
    /// de un grupo de ADECOPRIA a alguien que solo responde por
    /// BRITCHAM. El asesor tiene que poder entrar a lo que se le
    /// asigna.
    if (dto.asesorAcademicoId) {
      const suyo = await this.prisma.adminConvenio.findFirst({
        where: {
          adminId: dto.asesorAcademicoId,
          /// Con  a proposito: la consulta de arriba lo pide, pero si
          /// alguien recorta ese  manana, la edicion del grupo NO
          /// puede caerse por culpa de la bitacora. Se apunta sin convenio
          /// antes que no apuntar nada.
          convenioId: grupo.accionFormacion?.convenioId ?? null,
          rol: { in: ROLES_ACADEMICOS },
          admin: { activo: true },
        },
        select: { adminId: true },
      });
      if (!suyo) {
        throw new BadRequestException(
          'Esa cuenta no puede llevar este grupo: hace falta que sea del mismo ' +
            'gremio y que tenga permiso de escritura en «académico».',
        );
      }
    }

    await this.prisma.grupo.update({
      where: { id },
      data: {
        /// `undefined` no lo toca; `null` lo suelta.
        asesorAcademicoId:
          dto.asesorAcademicoId === undefined
            ? undefined
            : dto.asesorAcademicoId,
        fechaInicio: inicio,
        fechaFin: fin,
        dias: dto.dias === undefined ? undefined : dto.dias || null,
        sepGrupoId: dto.sepGrupoId === undefined ? undefined : dto.sepGrupoId,
        /// Se reescriben enteras y no se parchean una a una: la
        /// pantalla manda la lista que quedo, y casar filas por
        /// id para saber cual se borro es mas codigo y mas
        /// formas de equivocarse que volver a escribirlas.
        ...(dto.sesiones
          ? {
              sesiones: {
                deleteMany: {},
                create: dto.sesiones.map((ses, i) => ({
                  orden: i + 1,
                  tipo: ses.tipo,
                  dia: ses.dia ? new Date(ses.dia) : null,
                  horaInicio: ses.horaInicio,
                  horaFin: ses.horaFin,
                  ubicacionId: ses.ubicacionId ?? null,
                })),
              },
            }
          : {}),
      },
    });

    /**
     * Y DEJA HUELLA, que hasta hoy no dejaba ninguna.
     *
     * No es que nadie la hubiera escrito: `entidad` va tipada contra
     * el catálogo de `auditoria.service.ts` y allí NO EXISTÍAN `GRUPO`
     * ni `COBERTURA`, así que auditar esto no compilaba. Había que
     * ampliar el catálogo primero, y mientras tanto el módulo entero
     * escribía sin dejar una sola fila.
     *
     * Y mueve más de lo que parece: la fecha de inicio de un grupo
     * decide su cierre de inscripciones, los días que le quedan al
     * asesor y su meta diaria. Se cambia un campo y se nota en tres
     * pantallas, sin que hubiera forma de saber quién lo tocó.
     */
    const tocados = Object.keys(dto).filter(
      (k) => dto[k as keyof ActualizarGrupoDto] !== undefined,
    );
    await this.auditoria.registrar({
      actor,
      accion: 'GRUPO_EDITADO',
      entidad: ENTIDADES.GRUPO,
      entidadId: id,
      /// Con `?.` a propósito: la consulta de arriba lo pide, pero si
      /// alguien recorta ese `select` mañana, la edición del grupo NO
      /// puede caerse por culpa de la bitácora. Apuntar sin convenio es
      /// peor que apuntar con él, y mucho mejor que no apuntar nada.
      convenioId: grupo.accionFormacion?.convenioId ?? null,
      /// Las fechas SÍ van en el resumen: no son dato personal, son
      /// calendario del proyecto, y sin el antes y el después esta
      /// fila no responde la única pregunta que se le va a hacer.
      resumen: fraseDelCambioDeFechas(
        grupo,
        inicio,
        fin,
        dto.sesiones?.map((ses) => (ses.dia ? new Date(ses.dia) : null)),
      ),
      camposTocados: tocados,
      ip,
    });

    return { actualizado: true };
  }

  /**
   * QUIÉN MOVIÓ LAS FECHAS DE ESTE GRUPO, lo más nuevo primero.
   *
   * La huella se escribía desde que existe `GRUPO_EDITADO`, pero no
   * había dónde leerla: la pregunta «¿por qué este grupo arranca el 19
   * y no el 12?» seguía sin respuesta en pantalla. El grupo se busca
   * dentro del ámbito antes de leer nada, para que nadie lea la
   * bitácora de un gremio que no es el suyo.
   */
  async cambiosDelGrupo(id: string, ambito: string[]) {
    const grupo = await this.prisma.grupo.findFirst({
      where: { id, accionFormacion: { convenioId: { in: ambito } } },
      select: { id: true },
    });
    if (!grupo) throw new NotFoundException('Ese grupo no existe.');
    return this.auditoria.historial(ENTIDADES.GRUPO, id, 50);
  }

  /**
   * Los cupos de un grupo en una ubicacion.
   *
   * Es lo que hacia falta y no existia: si el proyecto suma plazas en un
   * departamento y las quita en otro, hasta hoy habia que tocar el Excel
   * y volver a sembrar, o entrar a la base a mano.
   *
   * EL INVARIANTE. `Oferta.cuposMaximos` es la SUMA de los topes de sus
   * coberturas -- asi lo produce el script que lee los Excel --, pero
   * nada lo ataba: eran dos numeros que podian separarse para siempre
   * sin que nadie avisara. Aqui se recalcula la oferta en la misma
   * transaccion, con su fila tomada, cada vez que cambia una cobertura.
   * Asi la suma no se puede romper por este camino.
   *
   * Y la ultima linea de defensa sigue siendo de la base: el CHECK
   * `ofertas_cupos_dentro_del_tope` rechaza dejar el tope por debajo de
   * lo ya apartado por las empresas, y aborta la transaccion entera.
   */
  async actualizarCupos(
    id: string,
    dto: ActualizarCuposDto,
    ambito: string[],
    actor: Actor,
    ip?: string,
  ) {
    const cobertura = await this.prisma.grupoCobertura.findFirst({
      where: { id, grupo: { accionFormacion: { convenioId: { in: ambito } } } },
      select: {
        id: true,
        cuposBase: true,
        cuposMaximos: true,
        ubicacionId: true,
        ubicacion: { select: { nombre: true } },
        grupo: { select: { numero: true, accionFormacionId: true } },
        _count: {
          select: { participantes: { where: { etapa: { in: ETAPAS_VIVAS } } } },
        },
      },
    });
    if (!cobertura)
      throw new NotFoundException('Ese grupo no existe en esa sede.');

    const base = dto.cuposBase ?? cobertura.cuposBase;
    const tope = dto.cuposMaximos ?? cobertura.cuposMaximos;

    if (tope < base) {
      throw new BadRequestException(
        'El tope no puede quedar por debajo de lo comprometido: el sobrecupo suma, no resta.',
      );
    }

    /// Nadie se queda fuera de un sitio que ya ocupa.
    const dentro = cobertura._count.participantes;
    if (tope < dentro) {
      throw new BadRequestException(
        `El grupo ${cobertura.grupo.numero} de ${cobertura.ubicacion.nombre} ya tiene ` +
          `${dentro} personas dentro: el tope no puede bajar de ahi. Muevalas primero.`,
      );
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      /// La oferta de esa accion en esa sede, tomada antes de tocar
      /// nada: es la que hay que dejar cuadrada, y es la misma fila que
      /// bloquean las reservas.
      const oferta = await tx.oferta.findUnique({
        where: {
          accionFormacionId_ubicacionId: {
            accionFormacionId: cobertura.grupo.accionFormacionId,
            ubicacionId: cobertura.ubicacionId,
          },
        },
        select: { id: true },
      });
      if (!oferta) {
        throw new BadRequestException(
          'Esa sede no tiene oferta de esta accion: no hay donde sumar los cupos.',
        );
      }
      await tx.$queryRaw`SELECT "id" FROM "ofertas" WHERE "id" = ${oferta.id} FOR UPDATE`;

      await tx.grupoCobertura.update({
        where: { id },
        data: { cuposBase: base, cuposMaximos: tope },
      });

      /// El tope de la oferta vuelve a ser la suma de sus coberturas.
      const suma = await tx.grupoCobertura.aggregate({
        where: {
          ubicacionId: cobertura.ubicacionId,
          grupo: { accionFormacionId: cobertura.grupo.accionFormacionId },
        },
        _sum: { cuposMaximos: true },
      });
      const nuevoTope = suma._sum.cuposMaximos ?? 0;

      await tx.oferta.update({
        where: { id: oferta.id },
        data: { cuposMaximos: nuevoTope },
      });

      return {
        coberturaId: id,
        cuposBase: base,
        cuposMaximos: tope,
        topeDeLaOferta: nuevoTope,
      };
    });

    /**
     * LA HUELLA, DESPUÉS DE QUE LA TRANSACCIÓN CONFIRME.
     *
     * Y no dentro, que fue lo primero que escribí: `registrar` abre su
     * propia conexión y no admite la transacción de aquí, así que
     * meterla dentro habría dejado la fila escrita aunque el CHECK
     * `ofertas_cupos_dentro_del_tope` abortara ---y aborta cuando se
     * intenta dejar el tope por debajo de lo ya apartado---.
     *
     * Fuera es además lo correcto: una bitácora que apunta cambios que
     * no ocurrieron es peor que no tenerla, porque manda a buscar la
     * causa de algo que nunca pasó.
     */
    await this.auditoria.registrar({
      actor,
      accion: 'CUPOS_EDITADOS',
      entidad: ENTIDADES.COBERTURA,
      entidadId: id,
      convenioId: ambito[0] ?? null,
      resumen:
        `${cobertura.ubicacion.nombre}, grupo ${cobertura.grupo.numero}: ` +
        `base ${cobertura.cuposBase} → ${resultado.cuposBase}, ` +
        `tope ${cobertura.cuposMaximos} → ${resultado.cuposMaximos} ` +
        `(la oferta queda en ${resultado.topeDeLaOferta})`,
      camposTocados: Object.keys(dto).filter(
        (k) => dto[k as keyof ActualizarCuposDto] !== undefined,
      ),
      ip,
    });

    return resultado;
  }
}

/**
 * El antes y el después de las fechas, en una línea.
 *
 * Sin esto el resumen diría «se editó el grupo», que no responde la
 * única pregunta que se le va a hacer a esta fila: por qué este grupo
 * arranca el 19 y no el 12.
 */
export function fraseDelCambioDeFechas(
  antes: {
    fechaInicio: Date | null;
    fechaFin: Date | null;
    sesiones?: Array<{ dia: Date | null }>;
  },
  inicio: Date | null,
  fin: Date | null,
  /// Los días de las sesiones que quedan. `undefined`: no se tocaron.
  dias?: Array<Date | null>,
): string {
  const d = (x: Date | null) =>
    x ? x.toISOString().slice(0, 10) : 'sin fecha';
  const partes: string[] = [];
  if (d(antes.fechaInicio) !== d(inicio))
    partes.push(`inicio ${d(antes.fechaInicio)} → ${d(inicio)}`);
  if (d(antes.fechaFin) !== d(fin))
    partes.push(`fin ${d(antes.fechaFin)} → ${d(fin)}`);
  /**
   * Y LOS DÍAS DE LAS SESIONES, que también son fechas del
   * cronograma y hasta hoy solo dejaban «sesiones» en los campos
   * tocados, sin decir de qué día a qué día. Se dicen en orden: la
   * sesión 2 pasó del 14 al 21.
   */
  if (dias) {
    const viejos = (antes.sesiones ?? []).map((s) => d(s.dia));
    const nuevos = dias.map(d);
    const n = Math.max(viejos.length, nuevos.length);
    for (let i = 0; i < n; i++) {
      const v = viejos[i] ?? 'no existía';
      const w = nuevos[i] ?? 'quitada';
      if (v !== w) partes.push(`sesión ${i + 1} ${v} → ${w}`);
    }
  }
  return partes.length ? partes.join(', ') : 'sin cambio de fechas';
}
