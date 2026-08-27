import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  EtapaParticipante,
  type OrigenParticipante,
  Prisma,
  type Admin,
} from '../../generated/prisma';
import { AuditoriaService } from '../comun/auditoria.service';
import { documentoValido, normalizarDocumento } from '../comun/documento';
import { analizar, esInsalvable, repetidosEnElPegado } from './carga';
import {
  exigeCompuertaDeMatricula,
  motivoDeTransicionImposible,
} from './escalera';
import { faltaDeLaPersona, revisar } from './completitud';
import { PanelDeCupos } from './panel-de-cupos';
import { ColaRui } from './rui/cola-rui';
import {
  ETAPAS_DEL_EMBUDO,
  metricasDeInscripciones,
} from './metricas-inscripciones';
import {
  DEPARTAMENTO_POR_ID,
  MUNICIPIO_POR_ID,
  DEPARTAMENTOS_SEP,
  DOCUMENTOS_DE_EMPRESA,
  DOCUMENTOS_DE_PERSONA,
  EDAD_MINIMA,
  edadCumplida,
  ESTRATO_MAXIMO,
  ESTRATO_MINIMO,
  GENEROS_SEP,
  motivoDeIdInvalido,
  MUNICIPIOS_SEP,
  NIVELES_OCUPACIONALES_SEP,
  SECTORES_ECONOMICOS,
  siglaDocumento,
  TAMANOS_EMPRESA_SEP,
} from './catalogos-sep';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarParticipanteDto,
  AsignarAsesorEnLoteDto,
  AsignarFormacionDto,
  CargaDto,
  CambiarEtapaDto,
  CrearNotaDto,
  CrearParticipanteDto,
  FiltrosParticipantesDto,
  RegistrarAutorizacionDto,
} from './dto';

/**
 * El ámbito NO va en el DTO: declararlo ahí lo vuelve una
 * propiedad propia de la clase y el ValidationPipe la
 * rechaza con «property ambito should not exist». Y sobre
 * todo, nunca puede venir de la petición: lo pone el
 * controlador desde el guard.
 */
export type Filtros = FiltrosParticipantesDto & { ambito?: string[] };

const POR_PAGINA = 30;
/// Tope duro aunque el filtro pida mas.
const TOPE_POR_PAGINA = 300;

/**
 * Los que ocupan una silla de verdad.
 *
 * Empieza en INSCRITO. Antes empezaba en INTERESADO, y eso
 * daba por ocupada la silla de alguien que solo es un nombre
 * tecleado: sobre los mismos datos, esta lista contaba 103
 * sillas y la del cronograma 63, cuarenta de diferencia. Una
 * silla se aparta cuando alguien queda inscrito, no cuando
 * alguien pregunta.
 *
 * Cuidado al cambiarla: baja la ocupacion que muestran las
 * ofertas, y puede destapar sobrecupos que antes quedaban
 * escondidos detras de leads que nunca se inscribieron.
 */
export const ETAPAS_VIVAS: EtapaParticipante[] = [
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
];

/// De estas no se sale sin explicar por que.
const ETAPAS_CON_MOTIVO: EtapaParticipante[] = [
  'PERDIDO',
  'RETIRADO',
  'NO_APROBO',
  'DESERTO',
  'ABANDONO',
];

/**
 * El embudo del asesor: TODO lo que se trabaja desde
 * Inscripciones. Es la unica lista, y de aqui la importan
 * las metricas y el control.
 *
 * INSCRITO esta dentro. Antes no, y la razon que se dio fue
 * que dejarlo en las dos pantallas obliga a mirar dos sitios.
 * Lo que pasaba de verdad era peor: el lead desaparecia al
 * marcarlo y parecia perdido, y la misma persona contaba
 * distinto en cada pantalla. Cuatro listas decian ser este
 * embudo y ninguna coincidia con otra: 45, 74, 74 y 29 sobre
 * los mismos ciento veinte leads. Quien quiera ver solo el
 * trabajo pendiente, que filtre por etapa; para eso esta el
 * filtro.
 */
/// Se define en `metricas-inscripciones.ts` y se reexporta
/// aqui para quien la buscaba con el nombre viejo.
export { ETAPAS_DEL_EMBUDO };

/// @deprecated usa ETAPAS_DEL_EMBUDO
export const ETAPAS_DE_INSCRIPCION = ETAPAS_DEL_EMBUDO;

/**
 * Las unicas que un asesor puede elegir a mano.
 *
 * DATOS_COMPLETOS no esta y no volvera: dejo de ser etapa
 * para ser estado calculado, y un estado que alguien puede
 * poner a dedo no prueba nada. El valor sigue en el enum
 * porque el historico de movimientos dice por donde paso
 * cada quien de verdad, y reescribir eso seria borrar la
 * traza que sostiene la auditoria.
 */
export const ETAPAS_A_MANO: EtapaParticipante[] = [
  'INTERESADO',
  'CONTACTADO',
  'INSCRITO',
  // se pasa solo cuando arranca el grupo (`matricula.ts`).
  // Aqui esta para el ingreso tardio y la matricula
  // adelantada, que el calendario no cubre
  'EN_FORMACION',
  'PERDIDO',
];

/// Lo que gobierna el academico y NO sale en Inscripciones.
/// Las cuatro formas de salirse del aula.
export const SALIDAS_DEL_AULA: EtapaParticipante[] = [
  'RETIRADO',
  'NO_APROBO',
  'DESERTO',
  'ABANDONO',
];

export const ETAPAS_DEL_AULA: EtapaParticipante[] = [
  'EN_FORMACION',
  'CERTIFICADO',
  'RETIRADO',
  'NO_APROBO',
  'DESERTO',
  'ABANDONO',
];

/// Las que dan por terminada la formación.
const CIERRES_DE_FORMACION: EtapaParticipante[] = ['CERTIFICADO', 'NO_APROBO'];

/// Quien ya piso el aula y por tanto tiene avance.
const ETAPAS_EN_AULA: EtapaParticipante[] = [
  'EN_FORMACION',
  'CERTIFICADO',
  'NO_APROBO',
  'RETIRADO',
  'DESERTO',
  'ABANDONO',
];

/// Cuantas actividades de retraso se toleran.
const TOLERANCIA = 2;
/// Dias sin entrar al aula a partir de los que esta parado.
const DIAS_PARADO = 14;
/// Lo que hay que aprobar para poder certificar.
export const MINIMO_PARA_CERTIFICAR = 0.8;

/**
 * Los seis que pidio el cliente. Se quitaron PARADO,
 * SIN_ARRANCAR, SALIO y SIN_FECHAS: quien salio ya lo dice
 * su etapa, y sin calendario no se juzga -- esos caen en
 * SIN_EMPEZAR, que es lo que de verdad se sabe de ellos.
 */
type EstadoAcademico =
  | 'SIN_INGRESO'
  | 'SIN_EMPEZAR'
  | 'ATRASADO'
  | 'AL_DIA'
  | 'COMPLETADO'
  | 'CERTIFICADO';

/**
 * Cómo se llama cada dato en el historial.
 *
 * Lo que no está aquí no deja rastro por sí solo: el
 * asesor va aparte porque su nota es la del lote, y hay
 * campos que comparten etiqueta a propósito («nombres»)
 * porque tocarlos es un solo cambio a ojos de quien lee.
 */
const ETIQUETA_DATO: Record<string, string> = {
  primerNombre: 'nombres',
  segundoNombre: 'nombres',
  primerApellido: 'apellidos',
  segundoApellido: 'apellidos',
  sexo: 'sexo',
  correo: 'correo',
  celular: 'celular',
  fechaNacimiento: 'fecha de nacimiento',
  generoSepId: 'género',
  estrato: 'estrato',
  departamentoSepId: 'departamento',
  municipioSepId: 'municipio',
  barrio: 'barrio',
  direccion: 'dirección',
  cargoEnEmpresa: 'cargo',
  nivelEducativo: 'nivel educativo',
  nivelOcupacional: 'nivel ocupacional',
  nivelOcupacionalSepId: 'nivel ocupacional',
  beneficiarioPrevio: 'beneficiario previo',
  coberturaId: 'grupo',
};

/// '' y null quieren decir lo mismo.
function mismoValor(llega: unknown, hay: unknown): boolean {
  const limpio = (v: unknown) => (v === '' || v === undefined ? null : v);
  const a = limpio(llega);
  const b = limpio(hay);
  if (a instanceof Date || b instanceof Date) {
    const ms = (v: unknown) => (v instanceof Date ? v.getTime() : null);
    return ms(a) === ms(b);
  }
  return a === b;
}


/// Como se llama cada campo para quien lo lee. Sin esto la
/// pantalla del asesor diria "departamentoSepId".
const ETIQUETA_CAMPO: Record<string, string> = {
  primerNombre: 'Primer nombre',
  segundoNombre: 'Segundo nombre',
  primerApellido: 'Primer apellido',
  segundoApellido: 'Segundo apellido',
  correo: 'Correo',
  celular: 'Celular',
  generoSepId: 'Género',
  fechaNacimiento: 'Fecha de nacimiento',
  estrato: 'Estrato',
  departamentoSepId: 'Departamento',
  municipioSepId: 'Municipio',
  barrio: 'Barrio o vereda',
  direccion: 'Dirección',
};

/// Para enseñarlo al lado del actual, sin formatear nada
/// raro: lo que importa es que se vea si son distintos.
function aTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor)) {
    return valor.slice(0, 10);
  }
  return String(valor);
}

@Injectable()
export class CrmService {
  private readonly log = new Logger('CRM');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly colaRui: ColaRui,
    private readonly cupos: PanelDeCupos,
  ) {}

  async listar(filtros: Filtros) {
    const donde = this.donde(filtros);
    const pagina = Math.max(1, filtros.pagina ?? 1);
    const porPagina = Math.min(filtros.limite ?? POR_PAGINA, TOPE_POR_PAGINA);

    const [total, filas] = await Promise.all([
      this.prisma.participante.count({ where: donde }),
      this.prisma.participante.findMany({
        where: donde,
        /// Los de pre-reserva primero, y de esos los que aun
        /// no estan inscritos.
        ///
        /// Una empresa que aparto cuarenta cupos tiene
        /// cuarenta turnos preferentes con fecha de
        /// vencimiento: si no se completan antes del cierre
        /// se liberan al monton comun. Ponerlos arriba no es
        /// cosmetica -- es que quien inscribe atienda primero
        /// lo que caduca. Ordenar por fecha de creacion los
        /// hundia entre los leads sueltos.
        orderBy: [
          { reservaId: { sort: 'desc', nulls: 'last' } },
          { creadoEn: 'desc' },
        ],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: {
          persona: true,
          convenio: { select: { sigla: true, slug: true } },
          accionFormacion: { select: { codigo: true, nombre: true } },
          oferta: { select: { ubicacion: { select: { nombre: true } } } },
          asesor: { select: { id: true, nombre: true } },
          empresa: {
            select: {
              razonSocial: true,
              direccion: true,
              telefono: true,
              sectorEconomico: true,
              clasificacion: true,
            },
          },
          // de que reserva viene, si viene de una: es lo que
          // le da prevalencia y hay que poder verlo
          reserva: {
            select: {
              id: true,
              cuposSolicitados: true,
              empresa: { select: { razonSocial: true, nit: true } },
            },
          },
          // los dos ultimos: el de ahora y el de antes
          movimientos: {
            orderBy: { creadoEn: 'desc' },
            take: 2,
            select: { etapaAntes: true, etapaDespues: true, creadoEn: true },
          },
          _count: { select: { notas: true, movimientos: true } },
        },
      }),
    ]);

    /// Cuantas veces se edito cada uno. En una consulta para
    /// toda la pagina: una por fila serian treinta viajes.
    const porFila = await this.prisma.registroAuditoria.groupBy({
      by: ['entidadId'],
      where: {
        entidad: 'Participante',
        accion: 'PARTICIPANTE_EDITADO',
        entidadId: { in: filas.map((f) => f.id) },
      },
      _count: { _all: true },
    });
    const ediciones = new Map(porFila.map((f) => [f.entidadId, f._count._all]));

    return {
      total,
      pagina,
      paginas: Math.max(1, Math.ceil(total / porPagina)),
      participantes: filas.map((p) =>
        this.aFila({ ...p, ediciones: ediciones.get(p.id) ?? 0 }),
      ),
    };
  }

  /** Lo que el panel necesita para dibujar los desplegables. */
  catalogos() {
    return {
      documentosPersona: DOCUMENTOS_DE_PERSONA,
      documentosEmpresa: DOCUMENTOS_DE_EMPRESA,
      generos: GENEROS_SEP,
      nivelesOcupacionales: NIVELES_OCUPACIONALES_SEP,
      tamanosEmpresa: TAMANOS_EMPRESA_SEP,
      departamentos: DEPARTAMENTOS_SEP.filter((d) => d.seleccionable),
      // [id, departamentoId, nombre] para que el navegador
      // filtre sin pedir nada; son 1.126, no 1.126 viajes
      municipios: MUNICIPIOS_SEP.filter((m) => m[3]).map((m) => [m[0], m[1], m[2]]),
      estrato: { minimo: ESTRATO_MINIMO, maximo: ESTRATO_MAXIMO },
      edadMinima: EDAD_MINIMA,
      // los tres del decreto 957, no las 21 del CIIU
      sectoresEconomicos: SECTORES_ECONOMICOS,
      // las unicas que un asesor elige a mano
      etapasAMano: ETAPAS_A_MANO,
      canalesDeContacto: ['CORREO', 'WHATSAPP', 'TEXTO', 'LLAMADA'],
    };
  }

  /** Cuántos hay en cada etapa: las columnas del tablero. */
  /**
   * El tablero de Inscripciones.
   *
   * Respeta los mismos filtros que la tabla: si el asesor
   * filtra por un gremio, las graficas hablan de ese gremio.
   * Una cifra que no obedece al filtro de al lado miente.
   */
  async metricasInscripciones(filtros: Filtros) {
    /// El tramo se descarta y se pone el embudo explicito:
    /// asi esta pantalla mide exactamente la misma poblacion
    /// que la tabla de leads, que ahora usa la misma lista.
    const donde: Prisma.ParticipanteWhereInput = {
      AND: [
        this.donde({ ...filtros, tramo: undefined }),
        { etapa: { in: ETAPAS_DEL_EMBUDO } },
      ],
    };

    return metricasDeInscripciones({
      prisma: this.prisma as unknown as Parameters<
        typeof metricasDeInscripciones
      >[0]['prisma'],
      donde,
    });
  }

  async resumen(filtros: Filtros) {
    // sin el tramo tampoco: si se hereda, la pantalla de
    // leads jura que hay cero inscritos porque su propio
    // recorte los deja fuera antes de contarlos
    const donde = this.donde({ ...filtros, etapa: undefined, tramo: undefined });

    const porEtapa = await this.prisma.participante.groupBy({
      by: ['etapa'],
      where: donde,
      _count: { _all: true },
    });

    const cuenta = new Map(porEtapa.map((f) => [f.etapa, f._count._all]));

    // las opciones de filtro salen de la base, no de la
    // pagina cargada: si no, faltan los de la pagina 2
    const [porAsesor, porAccion] = await Promise.all([
      this.prisma.participante.groupBy({
        by: ['asesorId'],
        where: donde,
        _count: { _all: true },
      }),
      this.prisma.participante.groupBy({
        by: ['accionFormacionId'],
        where: donde,
        _count: { _all: true },
      }),
    ]);

    const idsAsesor = porAsesor.map((f) => f.asesorId).filter((id): id is string => !!id);
    const idsAccion = porAccion
      .map((f) => f.accionFormacionId)
      .filter((id): id is string => !!id);

    const [asesores, acciones] = await Promise.all([
      this.prisma.admin.findMany({
        where: { id: { in: idsAsesor } },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.accionFormacion.findMany({
        where: { id: { in: idsAccion } },
        select: { id: true, codigo: true, nombre: true },
        orderBy: { codigo: 'asc' },
      }),
    ]);

    const totalAsesor = new Map(porAsesor.map((f) => [f.asesorId, f._count._all]));
    const totalAccion = new Map(
      porAccion.map((f) => [f.accionFormacionId, f._count._all]),
    );

    // por donde vive la persona, no por donde se dicta el
    // curso: son cosas distintas y la que interesa a quien
    // inscribe es de donde le esta llegando la gente
    const porDepartamento = await this.prisma.participante.groupBy({
      by: ['personaId'],
      where: donde,
      _count: { _all: true },
    });

    const personas = await this.prisma.persona.findMany({
      where: { id: { in: porDepartamento.map((f) => f.personaId) } },
      select: { departamentoSepId: true },
    });

    const cuentaDepto = new Map<number | null, number>();
    for (const p of personas) {
      const k = p.departamentoSepId ?? null;
      cuentaDepto.set(k, (cuentaDepto.get(k) ?? 0) + 1);
    }

    const departamentos = [...cuentaDepto.entries()]
      .map(([id, total]) => ({
        id,
        nombre:
          id === null
            ? 'Sin departamento'
            : (DEPARTAMENTO_POR_ID.get(id)?.etiqueta ?? `Código ${id}`),
        total,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      etapas: Object.values(EtapaParticipante).map((etapa) => ({
        etapa,
        total: cuenta.get(etapa) ?? 0,
      })),
      total: porEtapa.reduce((s, f) => s + f._count._all, 0),
      asesores: asesores.map((a) => ({ ...a, total: totalAsesor.get(a.id) ?? 0 })),
      acciones: acciones.map((a) => ({ ...a, total: totalAccion.get(a.id) ?? 0 })),
      sinAsesor: totalAsesor.get(null) ?? 0,
      departamentos,
    };
  }

  async obtener(id: string, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      include: {
        persona: {
          include: {
            /// Los otros cursos de la misma persona, SOLO los
            /// del ambito.
            ///
            /// `Persona` no tiene convenio a proposito -- la
            /// misma cedula es una persona con varias
            /// participaciones -- pero eso no es permiso para
            /// ensenarlas todas: sin este filtro, la ficha
            /// decia desde la puerta de un gremio que la
            /// persona esta en el OTRO, en que curso y en que
            /// etapa. Que la base sea una no significa que se
            /// vea todo.
            participaciones: {
              where: { id: { not: id }, convenioId: { in: ambito } },
              select: {
                id: true,
                etapa: true,
                convenio: { select: { sigla: true } },
                accionFormacion: { select: { codigo: true, nombre: true } },
              },
            },
            autorizaciones: {
              // la pantalla ya se queda con la de su convenio,
              // pero mandarlas todas las ensena en la red
              where: { revocadaEn: null, politica: { convenioId: { in: ambito } } },
              select: {
                id: true,
                canal: true,
                otorgadaEn: true,
                politica: {
                  select: { version: true, destinatario: true, convenioId: true },
                },
              },
            },
          },
        },
        convenio: { select: { id: true, sigla: true, nombre: true } },
        accionFormacion: { select: { id: true, codigo: true, nombre: true } },
        oferta: {
          select: {
            id: true,
            cuposMaximos: true,
            ubicacion: { select: { nombre: true } },
          },
        },
        cobertura: {
          select: {
            id: true,
            grupo: {
              select: {
                numero: true,
                fechaInicio: true,
                fechaFin: true,
                horario: true,
              },
            },
          },
        },
        reserva: {
          select: {
            id: true,
            empresa: { select: { nit: true, razonSocial: true } },
          },
        },
        // la suya, no la que lo nomino: es la que el
        // formulario largo le pide llenar.
        //
        // Van los TRECE campos que ese formulario pregunta, no
        // seis: la ficha tiene que poder ensenar todo lo que
        // la persona lleno, o el asesor no puede corroborar
        // nada por telefono.
        empresa: {
          select: {
            id: true,
            nit: true,
            digitoVerificacion: true,
            razonSocial: true,
            direccion: true,
            telefono: true,
            departamentoSepId: true,
            municipioSepId: true,
            sectorEconomico: true,
            numeroTrabajadores: true,
            contactoNombre: true,
            contactoCargo: true,
            contactoCorreo: true,
          },
        },
        asesor: { select: { id: true, nombre: true } },
        sobrecupoPor: { select: { nombre: true } },
        movimientos: {
          orderBy: { creadoEn: 'desc' },
          take: 50,
          // quien lo hizo ya se guardaba y no se veia
          include: { admin: { select: { nombre: true } } },
        },
        notas: { orderBy: { creadoEn: 'desc' }, take: 50 },
      },
    });

    if (!p) throw new NotFoundException('Ese participante no existe.');

    return {
      ...p,
      persona: {
        ...p.persona,
        documento: `${siglaDocumento(p.persona.tipoDocumentoSepId)} ${p.persona.numeroDocumento}`,
      },
      faltantes: await this.faltantesParaMatricular(p.id),
      /// Lo que el enlace le va a pedir, en el orden en que se
      /// lo va a pedir: primero su empresa y despues lo suyo.
      /// Sin esto el asesor manda un enlace sin saber que trae.
      faltaDeLaEmpresa: this.faltaDeLaEmpresa(
        p.empresa,
        p.persona.numeroDocumento,
      ),
      /// Su cédula es su RUT: no tiene empresa, es él mismo.
      trabajaPorSuCuenta: p.empresa?.nit === p.persona.numeroDocumento,
      faltaDeLaPersona: faltaDeLaPersona({
        persona: p.persona,
        nivelOcupacionalSepId: p.nivelOcupacionalSepId,
      }),
      /// En que anda el ultimo enlace que se le mando.
      enlace: await this.estadoDelEnlace(id),
    };
  }

  /**
   * En qué anda el último enlace de esta persona.
   *
   * El aviso dice «antes de generar otro, revise si el que
   * mandó ya fue abierto». Esto es lo que hace esa frase
   * verdad: sin la fecha de apertura era pedirle al asesor
   * una respuesta que nadie guardaba.
   *
   * NO viaja el token: quien mira la ficha no necesita poder
   * entrar por el enlace de otro.
   */
  private async estadoDelEnlace(participanteId: string) {
    const e = await this.prisma.enlaceCompletado.findFirst({
      where: { participanteId },
      orderBy: { creadoEn: 'desc' },
      select: {
        creadoEn: true,
        expiraEn: true,
        abiertoEn: true,
        usadoEn: true,
        anuladoEn: true,
        emitidoPor: { select: { nombre: true } },
      },
    });
    if (!e) return null;

    const ahora = new Date();
    const estado = e.usadoEn
      ? ('COMPLETADO' as const)
      : e.anuladoEn
        ? ('ANULADO' as const)
        : e.expiraEn < ahora
          ? ('CADUCADO' as const)
          : e.abiertoEn
            ? ('ABIERTO' as const)
            : ('SIN_ABRIR' as const);

    return {
      estado,
      creadoEn: e.creadoEn,
      expiraEn: e.expiraEn,
      abiertoEn: e.abiertoEn,
      usadoEn: e.usadoEn,
      emitidoPor: e.emitidoPor?.nombre ?? null,
    };
  }

  /// Lo que el formulario largo le pide de su organizacion.
  /// Solo eso: el maestro de empresas guarda mucho mas, pero
  /// a la persona no se le pregunta el CIIU ni el tamano.
  private faltaDeLaEmpresa(
    e: {
      nit: string;
      razonSocial: string;
      sectorEconomico: string | null;
      contactoNombre: string | null;
      contactoCargo: string | null;
      contactoCorreo: string | null;
    } | null,
    /// Para saber si la «empresa» es la persona misma.
    documentoDeLaPersona?: string,
  ): string[] {
    if (!e) return ['los datos de su organización'];

    /// Quien trabaja por su cuenta no tiene jefe directo.
    ///
    /// Su cédula es su RUT, asi que su NIT y su documento son
    /// el mismo numero. Pedirle «el nombre de su jefe» y «el
    /// correo de su jefe» es pedirle que se invente a
    /// alguien, y mientras no lo haga la ficha lo da por
    /// incompleto para siempre: el enlace no deja de
    /// ofrecerse y el F7 nunca lo ve listo.
    const esElMismo =
      documentoDeLaPersona !== undefined && e.nit === documentoDeLaPersona;

    const falta: string[] = [];
    if (!e.sectorEconomico) falta.push('sector económico');
    if (esElMismo) return falta;

    if (!e.contactoNombre) falta.push('nombre del jefe directo');
    if (!e.contactoCargo) falta.push('cargo del jefe directo');
    if (!e.contactoCorreo) falta.push('correo del jefe directo');
    return falta;
  }

  async crear(dto: CrearParticipanteDto, admin: Admin, ambito: string[], ip?: string) {
    this.exigirConvenio(dto.convenioId, ambito);

    // el tipo tiene que servir para una persona y estar
    // permitido aqui: sin esto la API acepta cualquier
    // entero y el cargue sale con un codigo sin significado
    if (!DOCUMENTOS_DE_PERSONA.some((t) => t.id === dto.tipoDocumentoSepId)) {
      throw new BadRequestException(
        'Ese tipo de documento no se admite para un participante.',
      );
    }

    const numero = normalizarDocumento(dto.numeroDocumento);
    if (!numero || !documentoValido(dto.tipoDocumentoSepId, numero)) {
      throw new BadRequestException(
        'El número de documento no tiene un formato válido para ese tipo.',
      );
    }

    if (dto.fechaNacimiento) {
      const edad = edadCumplida(new Date(dto.fechaNacimiento));
      if (edad < EDAD_MINIMA) {
        throw new BadRequestException(
          `No se admiten menores de ${EDAD_MINIMA} años en esta formación.`,
        );
      }
    }

    const oferta = dto.ofertaId
      ? await this.prisma.oferta.findUnique({
          where: { id: dto.ofertaId },
          select: {
            id: true,
            cuposMaximos: true,
            accionFormacionId: true,
            accionFormacion: { select: { convenioId: true, nombre: true } },
          },
        })
      : null;

    if (dto.ofertaId && !oferta) {
      throw new NotFoundException('Esa oferta no existe.');
    }
    if (oferta && oferta.accionFormacion.convenioId !== dto.convenioId) {
      throw new BadRequestException('Esa oferta no pertenece al convenio indicado.');
    }

    // la reserva se comprobaba: entraba tal cual y una de
    // otro convenio sumaba a la cobertura de este sin
    // sumar su cupo al denominador
    if (dto.reservaId) {
      const reserva = await this.prisma.reserva.findUnique({
        where: { id: dto.reservaId },
        select: { ofertaId: true, oferta: { select: { accionFormacion: { select: { convenioId: true } } } } },
      });
      if (!reserva) throw new NotFoundException('Esa reserva no existe.');
      if (reserva.oferta.accionFormacion.convenioId !== dto.convenioId) {
        throw new BadRequestException('Esa reserva no pertenece al convenio indicado.');
      }
      if (oferta && reserva.ofertaId !== oferta.id) {
        throw new BadRequestException('Esa reserva no es de la formación que se le asigna.');
      }
    }

    // pasarse del cupo se puede, pero deja rastro
    let sobrecupo: { porId: string; motivo: string } | null = null;
    if (oferta) {
      const ocupadas = await this.prisma.participante.count({
        where: { ofertaId: oferta.id, etapa: { in: ETAPAS_VIVAS } },
      });

      if (ocupadas >= oferta.cuposMaximos) {
        if (!dto.sobrecupoMotivo) {
          throw new ConflictException(
            `«${oferta.accionFormacion.nombre}» ya tiene sus ${oferta.cuposMaximos} ` +
              'cupos ocupados. Para inscribir por encima del cupo hay que indicar el motivo.',
          );
        }
        sobrecupo = { porId: admin.id, motivo: dto.sobrecupoMotivo };
      }
    }

    const creado = await this.prisma.$transaction(async (tx) => {
      const persona = await tx.persona.upsert({
        where: {
          tipoDocumentoSepId_numeroDocumento: {
            tipoDocumentoSepId: dto.tipoDocumentoSepId,
            numeroDocumento: numero,
          },
        },
        create: {
          tipoDocumentoSepId: dto.tipoDocumentoSepId,
          numeroDocumento: numero,
          primerNombre: dto.primerNombre,
          segundoNombre: dto.segundoNombre ?? null,
          primerApellido: dto.primerApellido,
          segundoApellido: dto.segundoApellido ?? null,
          fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : null,
          sexo: dto.sexo ?? null,
          correo: dto.correo ?? null,
          celular: dto.celular ?? null,
        },
        // no se pisa lo que ya hay con lo que llega vacio
        update: {
          correo: dto.correo ?? undefined,
          celular: dto.celular ?? undefined,
          fechaNacimiento: dto.fechaNacimiento
            ? new Date(dto.fechaNacimiento)
            : undefined,
        },
      });

      if (oferta) {
        const repetido = await tx.participante.findFirst({
          where: {
            personaId: persona.id,
            accionFormacionId: oferta.accionFormacionId,
          },
          select: { id: true },
        });
        if (repetido) {
          throw new ConflictException(
            'Esta persona ya está en esa acción de formación. ' +
              'Nadie cuenta dos veces contra la meta.',
          );
        }
      }

      const participante = await tx.participante.create({
        data: {
          personaId: persona.id,
          convenioId: dto.convenioId,
          ofertaId: oferta?.id ?? null,
          accionFormacionId: oferta?.accionFormacionId ?? null,
          reservaId: dto.reservaId ?? null,
          origen: dto.origen ?? 'ASESOR',
          asesorId: dto.asesorId ?? admin.id,
          cargoEnEmpresa: dto.cargoEnEmpresa ?? null,
          sobrecupoPorId: sobrecupo?.porId ?? null,
          sobrecupoMotivo: sobrecupo?.motivo ?? null,
        },
      });

      await tx.movimientoParticipante.create({
        data: {
          participanteId: participante.id,
          etapaAntes: null,
          etapaDespues: participante.etapa,
          adminId: admin.id,
          nota: sobrecupo ? `Sobrecupo autorizado: ${sobrecupo.motivo}` : null,
          ip: ip ?? null,
        },
      });

      return participante;
    });

    // fuera de la transaccion a proposito: si encolar falla,
    // el lead ya quedo guardado y no se arrastra con el
    try {
      await this.colaRui.encolarSiHaceFalta(creado.personaId);
    } catch (e) {
      this.log.warn(
        `No se pudo encolar la consulta al RUI: ` +
          (e instanceof Error ? e.message : String(e)),
      );
    }

    return creado;
  }

  /**
   * Edita la ficha y deja UN movimiento con lo que cambió.
   *
   * Se compara contra lo que hay porque la ficha manda el
   * bloque entero en cada guardado: sin comparar, pulsar
   * «Guardar» sin tocar nada dejaría un movimiento igual
   * que haberlo cambiado todo, y el historial dejaría de
   * decir nada.
   */
  async actualizar(
    id: string,
    dto: ActualizarParticipanteDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: {
        id: true,
        personaId: true,
        etapa: true,
        asesorId: true,
        cargoEnEmpresa: true,
        nivelEducativo: true,
        nivelOcupacional: true,
        nivelOcupacionalSepId: true,
        beneficiarioPrevio: true,
        coberturaId: true,
        persona: {
          select: {
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
            sexo: true,
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
    if (!p) throw new NotFoundException('Ese participante no existe.');

    /// La MISMA regla que las rutas públicas, no una copia.
    ///
    /// Estaba aquí y no allí, así que la ruta del asesor
    /// rechazaba un género inventado y la del ciudadano lo
    /// aceptaba: la pública era la más permisiva de las dos.
    const malo = motivoDeIdInvalido(dto, {
      departamentoSepId: p.persona?.departamentoSepId,
    });
    if (malo) throw new BadRequestException(malo);

    // asignar() ya lo comprueba; aqui no se comprobaba
    // nada, y una cobertura de otro curso manda al SEP un
    // AF y un grupo que se contradicen
    if (dto.coberturaId) {
      const cobertura = await this.prisma.grupoCobertura.findUnique({
        where: { id: dto.coberturaId },
        select: { grupo: { select: { accionFormacionId: true } } },
      });
      const suya = await this.prisma.participante.findUnique({
        where: { id },
        select: { accionFormacionId: true },
      });
      if (!cobertura || cobertura.grupo.accionFormacionId !== suya?.accionFormacionId) {
        throw new BadRequestException(
          'Ese grupo no es de la acción de formación de esta persona.',
        );
      }
    }

    if (dto.fechaNacimiento) {
      const edad = edadCumplida(new Date(dto.fechaNacimiento));
      if (edad < EDAD_MINIMA) {
        throw new BadRequestException(
          `No se admiten menores de ${EDAD_MINIMA} años en esta formación.`,
        );
      }
    }

    const dePersona = {
      primerNombre: dto.primerNombre,
      segundoNombre: dto.segundoNombre,
      primerApellido: dto.primerApellido,
      segundoApellido: dto.segundoApellido,
      sexo: dto.sexo,
      correo: dto.correo,
      celular: dto.celular,
      fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
      generoSepId: dto.generoSepId,
      estrato: dto.estrato,
      departamentoSepId: dto.departamentoSepId,
      municipioSepId: dto.municipioSepId,
      barrio: dto.barrio,
      direccion: dto.direccion,
    };

    const deParticipante = {
      cargoEnEmpresa: dto.cargoEnEmpresa,
      nivelEducativo: dto.nivelEducativo,
      nivelOcupacional: dto.nivelOcupacional,
      nivelOcupacionalSepId: dto.nivelOcupacionalSepId,
      beneficiarioPrevio: dto.beneficiarioPrevio,
      asesorId: dto.asesorId,
      coberturaId: dto.coberturaId,
    };

    // el asesor lleva su propia nota
    const cambiaAsesor =
      dto.asesorId !== undefined && (dto.asesorId || null) !== p.asesorId;
    let notaAsesor: string | null = null;

    if (cambiaAsesor && dto.asesorId) {
      const asesor = await this.prisma.admin.findFirst({
        where: { id: dto.asesorId, activo: true },
        select: { nombre: true },
      });
      if (!asesor) {
        throw new BadRequestException(
          'Ese asesor no existe o está desactivado.',
        );
      }
      // el mismo texto que el lote
      notaAsesor = `Asignada a ${asesor.nombre}`;
    } else if (cambiaAsesor) {
      notaAsesor = 'Se le quitó el asesor';
    }

    const datos = [
      ...this.queCambio(dePersona, p.persona),
      ...this.queCambio(deParticipante, p),
    ];

    const partes: string[] = [];
    if (notaAsesor) partes.push(notaAsesor);
    if (datos.length > 0) partes.push(`Datos actualizados: ${datos.join(', ')}`);

    // marcar la ficha solo si el asesor toco datos de la
    // persona: desde ese momento, lo que mande el interesado
    // por su enlace ya no pisa, espera como propuesta.
    // Asignarle un asesor no cuenta, que no toca sus datos
    const tocoDatosDePersona = this.queCambio(dePersona, p.persona).length > 0;

    const escrituras: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.persona.update({ where: { id: p.personaId }, data: dePersona }),
      this.prisma.participante.update({
        where: { id },
        data: {
          ...deParticipante,
          datosTocadosPorAsesorEn: tocoDatosDePersona ? new Date() : undefined,
        },
      }),
    ];

    if (partes.length > 0) {
      escrituras.push(
        this.prisma.movimientoParticipante.create({
          data: {
            participanteId: id,
            // misma etapa: no es una transicion
            etapaAntes: p.etapa,
            etapaDespues: p.etapa,
            adminId: admin.id,
            nota: partes.join('. '),
            ip: ip ?? null,
          },
        }),
      );
    }

    await this.prisma.$transaction(escrituras);

    /// Sin esto, editar un campo no dejaba rastro: la columna
    /// «Cambios realizados» solo veia los movimientos de etapa
    /// y una correccion de correo pasaba invisible.
    const tocados = [
      ...Object.entries(dePersona),
      ...Object.entries(deParticipante),
    ]
      .filter(([, v]) => v !== undefined)
      .map(([campo]) => campo);

    if (tocados.length > 0) {
      await this.auditoria.registrar({
        actor: { id: admin.id, nombre: admin.nombre },
        accion: 'PARTICIPANTE_EDITADO',
        entidad: 'Participante',
        entidadId: id,
        camposTocados: tocados,
        ip: ip ?? null,
      });
    }

    return this.obtener(id, ambito);
  }

  /** Qué datos llegan distintos de los que ya hay. */
  private queCambio(llega: object, hay: object): string[] {
    const viejo = hay as Record<string, unknown>;
    const nombres: string[] = [];

    for (const [clave, valor] of Object.entries(llega)) {
      if (valor === undefined) continue;
      if (mismoValor(valor, viejo[clave])) continue;
      const etiqueta = ETIQUETA_DATO[clave];
      if (etiqueta && !nombres.includes(etiqueta)) nombres.push(etiqueta);
    }

    return nombres;
  }

  /**
   * Asigna el mismo asesor a varias fichas de golpe.
   *
   * Cada una deja su movimiento: sin eso, veinte fichas
   * cambiarian de dueno sin que el historial dijera quien
   * lo hizo, que es justo lo que se pide poder ver.
   */
  async asignarAsesorEnLote(
    dto: AsignarAsesorEnLoteDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    const asesorId = dto.asesorId || null;

    if (asesorId) {
      const asesor = await this.prisma.admin.findFirst({
        where: { id: asesorId, activo: true },
        select: { id: true, nombre: true },
      });
      if (!asesor) throw new BadRequestException('Ese asesor no existe o está desactivado.');
    }

    // solo las del ambito: un id pegado a mano no cuela
    const suyas = await this.prisma.participante.findMany({
      where: { id: { in: dto.ids }, convenioId: { in: ambito } },
      select: { id: true, etapa: true, asesorId: true },
    });

    const cambian = suyas.filter((p) => p.asesorId !== asesorId);
    if (cambian.length === 0) {
      return { cambiadas: 0, fuera: dto.ids.length - suyas.length, sinCambio: suyas.length };
    }

    const nombre = asesorId
      ? (await this.prisma.admin.findUnique({
          where: { id: asesorId },
          select: { nombre: true },
        }))!.nombre
      : null;

    await this.prisma.$transaction([
      this.prisma.participante.updateMany({
        where: { id: { in: cambian.map((p) => p.id) } },
        data: { asesorId },
      }),
      this.prisma.movimientoParticipante.createMany({
        data: cambian.map((p) => ({
          participanteId: p.id,
          etapaAntes: p.etapa,
          etapaDespues: p.etapa,
          adminId: admin.id,
          nota: nombre ? `Asignada a ${nombre}` : 'Se le quitó el asesor',
          ip: ip ?? null,
        })),
      }),
    ]);

    return {
      cambiadas: cambian.length,
      fuera: dto.ids.length - suyas.length,
      sinCambio: suyas.length - cambian.length,
    };
  }

  /**
   * Borra la participación, no a la persona: la misma
   * cédula puede estar en el otro convenio, y ahí sigue.
   * Se lleva sus notas, sus movimientos y su avance.
   */
  async borrarParticipacion(id: string, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: {
        etapa: true,
        persona: { select: { primerNombre: true, primerApellido: true, numeroDocumento: true } },
        _count: { select: { avances: true, notas: true } },
      },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    await this.prisma.$transaction(async (tx) => {
      await tx.avanceActividad.deleteMany({ where: { participanteId: id } });
      await tx.notaParticipante.deleteMany({ where: { participanteId: id } });
      await tx.movimientoParticipante.deleteMany({ where: { participanteId: id } });
      await tx.participante.delete({ where: { id } });
    });

    return {
      borrado: true,
      nombre: `${p.persona.primerNombre} ${p.persona.primerApellido}`,
      documento: p.persona.numeroDocumento,
      avancesBorrados: p._count.avances,
      notasBorradas: p._count.notas,
    };
  }

  /**
   * Nadie se inscribe si no cabe, si no hay grupo, o si ya
   * cerró la ventana del calendario.
   *
   * Una pre-reserva da prevalencia, no cupo: la empresa que
   * apartó cuarenta tiene cuarenta turnos preferentes, y solo
   * se vuelven silla al inscribir a cada persona. Por eso el
   * tope se mira aquí y no al reservar.
   *
   * Y el grupo es obligatorio: si una acción tiene cinco
   * grupos que arrancan en fechas distintas, «inscrito» sin
   * decir a cuál no significa nada, y al llegar la fecha no
   * hay contra qué matricularlo.
   */
  private async exigirQueQuepa(p: {
    id: string;
    ofertaId: string | null;
    coberturaId: string | null;
  }) {
    /// Sin los datos de su organización no se inscribe.
    ///
    /// Es una cadena: inscribir es comprometerse a reportar a
    /// esa persona al SENA, y el F7 se arma POR EMPRESA. Un
    /// inscrito sin organización no se puede reportar, así que
    /// el compromiso no se puede cumplir. Dejarlo pasar aquí
    /// solo mueve el problema al día del cargue, cuando ya no
    /// hay a quién llamar.
    ///
    /// Al independiente se le pide menos -- no tiene jefe
    /// directo --, y de eso ya se encarga `faltaDeLaEmpresa`.
    const conEmpresa = await this.prisma.participante.findUnique({
      where: { id: p.id },
      select: {
        persona: { select: { numeroDocumento: true } },
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
    });

    const faltaEmpresa = this.faltaDeLaEmpresa(
      conEmpresa?.empresa ?? null,
      conEmpresa?.persona.numeroDocumento,
    );

    if (faltaEmpresa.length > 0) {
      throw new BadRequestException(
        conEmpresa?.empresa
          ? `Antes de inscribir hay que completar su organización: ${faltaEmpresa.join(', ')}. ` +
            'Sin eso no entra en el F7.'
          : 'Esta persona no tiene organización. Sin ella no se puede reportar al ' +
            'SENA, así que no se puede inscribir. Mándele el enlace para que la complete.',
      );
    }

    if (!p.ofertaId) {
      throw new BadRequestException(
        'Este lead no tiene una oferta (acción y ciudad). Asígnesela antes de inscribirlo.',
      );
    }

    const panel = await this.cupos.deLaOferta(p.ofertaId);
    if (!panel) {
      throw new BadRequestException('Esa oferta ya no existe.');
    }

    if (!panel.admiteInscripciones) {
      throw new BadRequestException(panel.porQueNo ?? 'No se puede inscribir en esta oferta.');
    }

    if (!p.coberturaId) {
      /// Por número de grupo, sin repetir.
      ///
      /// `panel.grupos` son COBERTURAS: un grupo tiene una por
      /// ciudad y modalidad, así que el Grupo 1 con seis
      /// ciudades salía seis veces y el mensaje decía «Grupo
      /// 1, Grupo 1, Grupo 1...». Lo que se elige es la
      /// cobertura, pero lo que se lee es el grupo.
      const numeros = [
        ...new Set(
          panel.grupos
            .filter(
              (g) =>
                g.ventana.estado === 'ABIERTA' || g.ventana.estado === 'AVISANDO',
            )
            .map((g) => g.numero),
        ),
      ].sort((a, b) => a - b);

      throw new BadRequestException(
        'Falta decir a qué grupo entra. ' +
          (numeros.length
            ? `Hoy admiten: ${numeros.map((n) => `Grupo ${n}`).join(', ')}.`
            : 'Ningún grupo tiene la ventana abierta.'),
      );
    }

    const suyo = panel.grupos.find((g) => g.coberturaId === p.coberturaId);
    if (!suyo) {
      throw new BadRequestException('Ese grupo no es de esta acción de formación.');
    }
    if (suyo.ventana.estado === 'SIN_FECHAS') {
      throw new BadRequestException(
        `El grupo ${suyo.numero} no tiene fecha de inicio. Sin fecha no se puede inscribir: ` +
          'el cronograma es lo que después lo lleva al aula.',
      );
    }
    if (suyo.ventana.estado === 'CERRADA') {
      const cierre = suyo.ventana.cierre?.toISOString().slice(0, 10);
      throw new BadRequestException(
        `La inscripción del grupo ${suyo.numero} cerró el ${cierre}, ` +
          'una semana hábil antes de que arranque. Elija otro grupo.',
      );
    }
    if (suyo.inscritos >= suyo.cuposMaximos) {
      throw new BadRequestException(
        `El grupo ${suyo.numero} ya está lleno (${suyo.inscritos} de ${suyo.cuposMaximos}).`,
      );
    }
  }

  async cambiarEtapa(
    id: string,
    dto: CambiarEtapaDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
    cierran: string[] = [],
  ) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: {
        id: true,
        etapa: true,
        convenioId: true,
        accionFormacionId: true,
        ofertaId: true,
        coberturaId: true,
        fechaRetiro: true,
        fechaMatricula: true,
        fechaCertificacion: true,
      },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    /// Entrar al aula es lo que consume un cupo, se llame
    /// INSCRITO o EN_FORMACION. Ver `escalera.ts`.
    const compuerta = exigeCompuertaDeMatricula(p.etapa, dto.etapa);
    if (compuerta) {
      await this.exigirQueQuepa(p);
    }

    /// Y hay pasos que no son un paso. Ver `escalera.ts`.
    const imposible = motivoDeTransicionImposible(p.etapa, dto.etapa);
    if (imposible) throw new BadRequestException(imposible);

    // certificar exige haber aprobado el 80% de lo
    // obligatorio: sin eso, la fila que se le manda al
    // SENA dice que alguien termino algo que no termino
    if (dto.etapa === 'CERTIFICADO') {
      const [obligatorias, aprobadas] = await Promise.all([
        this.prisma.actividad.count({
          where: {
            accionFormacionId: p.accionFormacionId ?? '',
            publicada: true,
            obligatoria: true,
          },
        }),
        // el numerador tiene que ser de la MISMA accion que
        // el denominador. Sin esa condicion, quien aprobo
        // 10 de 10 en la AF1 y se reasigna a la AF5 se
        // certifica con 10/12 sin haber tocado la AF5, y
        // esa fila entra al reporte del SENA
        this.prisma.avanceActividad.count({
          where: {
            participanteId: id,
            estado: 'APROBADA',
            actividad: {
              obligatoria: true,
              publicada: true,
              accionFormacionId: p.accionFormacionId ?? '',
            },
          },
        }),
      ]);

      if (obligatorias === 0) {
        throw new BadRequestException(
          'Esta acción de formación no tiene actividades obligatorias cargadas: ' +
            'no hay contra qué medir si terminó.',
        );
      }
      const logrado = aprobadas / obligatorias;
      if (logrado < MINIMO_PARA_CERTIFICAR) {
        throw new BadRequestException(
          `Lleva ${aprobadas} de ${obligatorias} actividades obligatorias ` +
            `(${Math.round(logrado * 100)} %). Para certificar hacen falta ` +
            `${Math.round(MINIMO_PARA_CERTIFICAR * 100)} %.`,
        );
      }
    }

    // certificar es lo que paga el SENA: no lo firma quien
    // digita, aunque digite bien
    if (CIERRES_DE_FORMACION.includes(dto.etapa) && !cierran.includes(p.convenioId)) {
      throw new ForbiddenException(
        'Cerrar una formación (certificar o dar por no aprobado) es del líder ' +
          'del área académica.',
      );
    }
    if (p.etapa === dto.etapa) return this.obtener(id, ambito);

    // datos_completos es estado calculado, no etapa: ponerlo
    // a dedo seria poder declararse completo sin estarlo
    if (dto.etapa === 'DATOS_COMPLETOS') {
      throw new BadRequestException(
        '«Datos completos» no se marca a mano: lo calcula el sistema con lo ' +
          'que hay en la ficha.',
      );
    }

    if (ETAPAS_CON_MOTIVO.includes(dto.etapa) && !dto.motivo) {
      throw new BadRequestException(
        'Hay que decir por qué. Dentro de seis meses nadie se acuerda.',
      );
    }

    // matricular es una compuerta, no un paso mas
    if (compuerta) {
      // primero lo de la persona, que es lo que el asesor
      // puede resolver por telefono; el mensaje dice que
      // falta, porque negarse sin decir que no sirve
      const estado = await this.estadoDeDatos(id);
      if (!estado.completo) {
        throw new ConflictException(
          `Faltan datos de la persona: ${estado.falta.join('; ')}.`,
        );
      }

      const { bloquean } = await this.faltantesParaMatricular(id);
      if (bloquean.length > 0) {
        throw new ConflictException(
          `No se puede matricular todavía: ${bloquean.join('; ')}.`,
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.participante.update({
        where: { id },
        data: {
          etapa: dto.etapa,
          motivoSalida: ETAPAS_CON_MOTIVO.includes(dto.etapa) ? dto.motivo : undefined,
          // matricularse y certificarse son hechos que ya
          // ocurrieron: se escriben una vez. Volver a pasar
          // por la etapa no cambia cuando pasaron, y el
          // reporte al SENA lleva esa fecha
          /// La fecha de matricula es de ENTRAR AL AULA.
          ///
          /// Iba colgada de la palabra INSCRITO, asi que quien
          /// entraba directo a EN_FORMACION se quedaba sin
          /// ella. Y el cargue al SEP congela el rango de edad
          /// contra esta fecha: sin fecha lo calcula al
          /// exportar, y la misma persona cambia de rango
          /// entre dos cargues por haber cumplido anos, que es
          /// justo lo que congelarla evita.
          fechaMatricula: compuerta && !p.fechaMatricula ? new Date() : undefined,
          fechaCertificacion:
            dto.etapa === 'CERTIFICADO' && !p.fechaCertificacion ? new Date() : undefined,
          // el retiro NO: es la fecha del retiro vigente, y
          // va con su motivo, que si se sobrescribe. Fijarla
          // dejaba la fecha de marzo con el motivo de agosto
          fechaRetiro: dto.etapa === 'RETIRADO' ? new Date() : undefined,
        },
      }),
      this.prisma.movimientoParticipante.create({
        data: {
          participanteId: id,
          etapaAntes: p.etapa,
          etapaDespues: dto.etapa,
          motivo: dto.motivo ?? null,
          adminId: admin.id,
          ip: ip ?? null,
        },
      }),
    ]);

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'ETAPA_CAMBIADA',
      entidad: 'participante',
      entidadId: id,
      convenioId: p.convenioId,
      resumen: `${p.etapa} → ${dto.etapa}${dto.motivo ? `: ${dto.motivo}` : ''}`,
      ip,
    });

    return this.obtener(id, ambito);
  }

  async agregarNota(id: string, dto: CrearNotaDto, admin: Admin, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const existe = await this.prisma.participante.count({ where: { id } });
    if (!existe) throw new NotFoundException('Ese participante no existe.');

    // el nombre se congela: si el autor cambia el suyo,
    // la nota sigue diciendo quien la escribio
    const nota = await this.prisma.notaParticipante.create({
      data: {
        participanteId: id,
        autorId: admin.id,
        autorNombre: admin.nombre,
        texto: dto.texto,
        canales: dto.canales,
      },
    });

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'NOTA_CREADA',
      entidad: 'participante',
      entidadId: id,
      resumen: `Gestión por ${[...dto.canales].sort().join(' + ')}`,
    });

    return nota;
  }

  /**
   * Completo o parcial, calculado. Nadie lo edita.
   *
   * Ni el asesor ni el admin: es lo unico que garantiza que
   * «completo» quiera decir completo. Si alguien pudiera
   * ponerlo a mano, la cifra dejaria de probar nada y el
   * bloqueo para inscribir se saltaria con un clic.
   */
  async estadoDeDatos(
    id: string,
  ): Promise<{ completo: boolean; falta: string[] }> {
    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: {
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
    if (!p) throw new NotFoundException('Ese participante no existe.');

    const falta = faltaDeLaPersona({
      persona: p.persona,
      nivelOcupacionalSepId: p.nivelOcupacionalSepId,
    });

    return { completo: falta.length === 0, falta };
  }

  /// Lo que el interesado mando despues de que el asesor
  /// ya habia tocado la ficha, campo por campo y con lo que
  /// hay hoy al lado, para poder comparar antes de decidir.
  async propuestaDe(id: string, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const propuesta = await this.prisma.propuestaDeDatos.findFirst({
      where: { participanteId: id, estado: 'PENDIENTE' },
      orderBy: { creadoEn: 'desc' },
    });
    if (!propuesta) return null;

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { persona: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    const actual = p.persona as unknown as Record<string, unknown>;
    const campos = propuesta.campos as Record<string, unknown>;

    return {
      id: propuesta.id,
      creadoEn: propuesta.creadoEn,
      campos: Object.entries(campos).map(([campo, propuesto]) => ({
        campo,
        etiqueta: ETIQUETA_CAMPO[campo] ?? campo,
        actual: aTexto(actual[campo]),
        propuesto: aTexto(propuesto),
      })),
    };
  }

  /**
   * El asesor decide cuales entran.
   *
   * Los que acepta se escriben; los que no, se quedan como
   * estaban. En los dos casos la propuesta se archiva con
   * quien decidio y que dejo entrar, para que dentro de seis
   * meses se pueda responder por que un dato dice lo que dice.
   */
  async resolverPropuesta(
    id: string,
    aceptados: string[],
    admin: Admin,
    ambito: string[],
  ) {
    await this.exigirParticipante(id, ambito);

    const propuesta = await this.prisma.propuestaDeDatos.findFirst({
      where: { participanteId: id, estado: 'PENDIENTE' },
      orderBy: { creadoEn: 'desc' },
    });
    if (!propuesta) throw new NotFoundException('No hay nada pendiente de decidir.');

    const campos = propuesta.campos as Record<string, unknown>;
    const desconocido = aceptados.find((c) => !(c in campos));
    if (desconocido) {
      throw new BadRequestException(`«${desconocido}» no está en esa propuesta.`);
    }

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { personaId: true, convenioId: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    if (aceptados.length > 0) {
      const data: Record<string, unknown> = {};
      for (const campo of aceptados) {
        const v = campos[campo];
        // las fechas viajan como texto dentro del JSON
        data[campo] = campo === 'fechaNacimiento' && typeof v === 'string' ? new Date(v) : v;
      }
      await this.prisma.persona.update({
        where: { id: p.personaId },
        data: data as Prisma.PersonaUpdateInput,
      });
    }

    await this.prisma.propuestaDeDatos.update({
      where: { id: propuesta.id },
      data: {
        estado: aceptados.length > 0 ? 'ACEPTADA' : 'DESCARTADA',
        camposAceptados: aceptados,
        resueltoPorId: admin.id,
        resueltoEn: new Date(),
      },
    });

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'DATOS_DEL_INTERESADO_ACEPTADOS',
      entidad: 'participante',
      entidadId: id,
      convenioId: p.convenioId,
      resumen:
        aceptados.length > 0
          ? `Aceptó ${aceptados.length} de ${Object.keys(campos).length} campos`
          : 'Descartó todo lo que mandó el interesado',
      camposTocados: aceptados,
    });

    return this.obtener(id, ambito);
  }

  /** La persona detrás de un participante, con ámbito. */
  async personaDe(id: string, ambito: string[]): Promise<string> {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { personaId: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    return p.personaId;
  }

  /// Cuántas gestiones hubo por combinación de canales, no
  /// por canal suelto: "correo y llamada" es una gestión
  /// distinta de "solo correo", y sumarlas por separado
  /// contaría dos veces la misma conversación.
  async metricaDeCanales(ambito: string[]) {
    const notas = await this.prisma.notaParticipante.findMany({
      where: {
        canales: { isEmpty: false },
        participante: ambito.length ? { convenioId: { in: ambito } } : undefined,
      },
      select: { canales: true },
    });

    const porCombinacion = new Map<string, number>();
    const porCanal = new Map<string, number>();

    for (const n of notas) {
      // ordenados, para que A+B y B+A sean la misma llave
      const llave = [...n.canales].sort().join(' + ');
      porCombinacion.set(llave, (porCombinacion.get(llave) ?? 0) + 1);
      for (const c of n.canales) porCanal.set(c, (porCanal.get(c) ?? 0) + 1);
    }

    const combinaciones = [...porCombinacion.entries()]
      .map(([combinacion, gestiones]) => ({ combinacion, gestiones }))
      .sort((a, b) => b.gestiones - a.gestiones);

    const canales = [...porCanal.entries()]
      .map(([canal, apariciones]) => ({ canal, apariciones }))
      .sort((a, b) => b.apariciones - a.apariciones);

    return { gestiones: notas.length, combinaciones, canales };
  }

  /** Lo que impide matricular y lo que impide reportar. */
  async faltantesParaMatricular(
    id: string,
  ): Promise<{ bloquean: string[]; avisan: string[]; reporte: string[] }> {
    const p = await this.prisma.participante.findUnique({
      where: { id },
      include: {
        persona: true,
        accionFormacion: { select: { sepAfId: true } },
        cobertura: {
          select: {
            grupo: { select: { fechaInicio: true, sepGrupoId: true } },
          },
        },
      },
    });
    if (!p) return { bloquean: ['el participante no existe'], avisan: [], reporte: [] };

    const autorizacion = await this.prisma.autorizacionDatos.findFirst({
      where: {
        personaId: p.personaId,
        revocadaEn: null,
        politica: { destinatario: 'PARTICIPANTE', convenioId: p.convenioId },
      },
      select: { id: true },
    });

    const { matricula, reporte } = revisar({
      ofertaId: p.ofertaId,
      coberturaId: p.coberturaId,
      accionFormacionId: p.accionFormacionId,
      nivelOcupacionalSepId: p.nivelOcupacionalSepId,
      beneficiarioPrevio: p.beneficiarioPrevio,
      tieneAutorizacion: Boolean(autorizacion),
      grupoConFechas: Boolean(p.cobertura?.grupo.fechaInicio),
      grupoSepId: p.cobertura?.grupo.sepGrupoId ?? null,
      accionSepId: p.accionFormacion?.sepAfId ?? null,
      persona: p.persona,
    });

    // el grupo y sus fechas avisan, no bloquean: las pone
    // el SENA cuando puede
    const avisan: string[] = [];
    if (!p.coberturaId) {
      avisan.push('sin grupo asignado no entra en el reporte al SENA');
    } else if (!p.cobertura?.grupo.fechaInicio) {
      avisan.push('su grupo no tiene fechas: no se puede saber si va al día');
    }

    return { bloquean: matricula, avisan, reporte };
  }




  /** Que pasaria si se confirma este pegado. */
  async previsualizarCarga(dto: CargaDto, ambito: string[]) {
    this.exigirConvenio(dto.convenioId, ambito);

    const filas = analizar(dto.texto);
    if (filas.length === 0) {
      throw new BadRequestException('No encontré ninguna fila con datos.');
    }
    if (filas.length > 1000) {
      throw new BadRequestException(
        `Son ${filas.length} filas. Pegue tandas de 1000 como mucho.`,
      );
    }

    const repes = repetidosEnElPegado(filas);

    // en que acciones ya esta cada persona
    const claves = filas
      .filter((f) => f.numeroDocumento)
      .map((f) => ({
        tipoDocumentoSepId: f.tipoDocumentoSepId,
        numeroDocumento: f.numeroDocumento,
      }));

    const personas = await this.prisma.persona.findMany({
      where: { OR: claves },
      select: {
        id: true,
        tipoDocumentoSepId: true,
        numeroDocumento: true,
        participaciones: {
          select: { accionFormacionId: true, convenioId: true },
        },
      },
    });

    const porDocumento = new Map(
      personas.map((p) => [`${p.tipoDocumentoSepId}:${p.numeroDocumento}`, p]),
    );

    const oferta = dto.ofertaId
      ? await this.prisma.oferta.findUnique({
          where: { id: dto.ofertaId },
          select: { id: true, accionFormacionId: true, cuposMaximos: true },
        })
      : null;

    const previa = filas.map((f) => {
      const clave = `${f.tipoDocumentoSepId}:${f.numeroDocumento}`;
      const problemas = [...f.problemas];
      let estado: 'NUEVA' | 'PERSONA_CONOCIDA' | 'REPETIDA' | 'DESCARTADA' = 'NUEVA';

      if (esInsalvable(f)) {
        estado = 'DESCARTADA';
      } else if (repes.has(clave)) {
        estado = 'REPETIDA';
        problemas.push('el mismo documento aparece más de una vez en lo pegado');
      } else {
        const persona = porDocumento.get(clave);
        if (persona) {
          estado = 'PERSONA_CONOCIDA';
          if (
            oferta &&
            persona.participaciones.some(
              (x) => x.accionFormacionId === oferta.accionFormacionId,
            )
          ) {
            estado = 'DESCARTADA';
            problemas.push('ya está en esa acción de formación');
          }
        }
      }

      return { ...f, problemas, estado };
    });

    const creables = previa.filter((f) => f.estado !== 'DESCARTADA' && f.estado !== 'REPETIDA');

    return {
      total: previa.length,
      creables: creables.length,
      descartadas: previa.filter((f) => f.estado === 'DESCARTADA').length,
      repetidas: previa.filter((f) => f.estado === 'REPETIDA').length,
      conocidas: previa.filter((f) => f.estado === 'PERSONA_CONOCIDA').length,
      cuposDeLaOferta: oferta?.cuposMaximos ?? null,
      filas: previa,
    };
  }

  /** Crea solo las lineas que el asesor confirmo. */
  async confirmarCarga(dto: CargaDto, admin: Admin, ambito: string[], ip?: string) {
    this.exigirConvenio(dto.convenioId, ambito);

    const previa = await this.previsualizarCarga(dto, ambito);
    const permitidas = dto.lineas ? new Set(dto.lineas) : null;

    const aCrear = previa.filas.filter(
      (f) =>
        f.estado !== 'DESCARTADA' &&
        f.estado !== 'REPETIDA' &&
        (!permitidas || permitidas.has(f.linea)),
    );

    let creados = 0;
    const fallos: Array<{ linea: number; motivo: string }> = [];

    // una a una: un fallo no debe tumbar las 39 buenas
    for (const f of aCrear) {
      try {
        await this.crear(
          {
            tipoDocumentoSepId: f.tipoDocumentoSepId,
            numeroDocumento: f.numeroDocumento,
            primerNombre: f.primerNombre,
            segundoNombre: f.segundoNombre ?? undefined,
            primerApellido: f.primerApellido,
            segundoApellido: f.segundoApellido ?? undefined,
            correo: f.correo ?? undefined,
            celular: f.celular ?? undefined,
            convenioId: dto.convenioId,
            ofertaId: dto.ofertaId,
            origen: 'EMPRESA',
          },
          admin,
          ambito,
          ip,
        );
        creados += 1;
      } catch (e) {
        fallos.push({
          linea: f.linea,
          motivo: e instanceof Error ? e.message : 'error desconocido',
        });
      }
    }

    return { creados, fallos, intentadas: aCrear.length };
  }

  /** Cupos reservados sin una persona detras. */
  /**
   * Seguimiento académico: lo hecho contra lo que tocaría
   * a estas alturas del calendario del grupo.
   */
  async academico(filtros: Filtros) {
    const donde: Prisma.ParticipanteWhereInput = {
      AND: [
        this.donde({ ...filtros, etapa: undefined }),
        { etapa: { in: ETAPAS_EN_AULA } },
      ],
    };

    // el total se cuenta en la base, no sobre lo cargado:
    // con mas gente en el aula que el tope, decir que hay
    // 300 seria dar por total el tamano de la pagina
    const enAula = await this.prisma.participante.count({ where: donde });

    const filas = await this.prisma.participante.findMany({
      where: donde,
      orderBy: { creadoEn: 'desc' },
      take: TOPE_POR_PAGINA,
      include: {
        persona: {
          select: { primerNombre: true, primerApellido: true, numeroDocumento: true },
        },
        accionFormacion: { select: { id: true, codigo: true, nombre: true } },
        asesor: { select: { id: true, nombre: true } },
        cobertura: {
          select: {
            grupoId: true,
            grupo: {
              select: { numero: true, fechaInicio: true, fechaFin: true, horario: true },
            },
          },
        },
        avances: {
          select: {
            estado: true,
            actividad: {
              select: { obligatoria: true, publicada: true, accionFormacionId: true },
            },
          },
        },
      },
    });

    // las obligatorias son las que cuentan para el avance
    const obligatorias = await this.prisma.actividad.groupBy({
      by: ['accionFormacionId'],
      where: { publicada: true, obligatoria: true },
      _count: { _all: true },
    });
    const totalDe = new Map(obligatorias.map((a) => [a.accionFormacionId, a._count._all]));

    const ahora = Date.now();

    const personas = filas.map((p) => {
      const total = totalDe.get(p.accionFormacionId ?? '') ?? 0;
      // el numerador, con las MISMAS tres condiciones que
      // el denominador: obligatoria, publicada y de su
      // accion. Sin las dos ultimas salian avances de 111 %
      const hechas = p.avances.filter(
        (a) =>
          a.estado === 'APROBADA' &&
          a.actividad.obligatoria &&
          a.actividad.publicada &&
          a.actividad.accionFormacionId === p.accionFormacionId,
      ).length;

      const grupo = p.cobertura?.grupo ?? null;
      const inicio = grupo?.fechaInicio?.getTime() ?? null;
      const fin = grupo?.fechaFin?.getTime() ?? null;

      // sin calendario no se puede decir si va tarde
      let transcurrido: number | null = null;
      if (inicio !== null && fin !== null && fin > inicio) {
        transcurrido = Math.min(1, Math.max(0, (ahora - inicio) / (fin - inicio)));
      }

      const esperadas = transcurrido === null ? null : Math.round(total * transcurrido);
      const desfase = esperadas === null ? null : hechas - esperadas;

      const diasSinEntrar = p.ultimoAcceso
        ? Math.floor((ahora - p.ultimoAcceso.getTime()) / 86_400_000)
        : null;

      // el 80% de lo obligatorio: es lo que habilita a
      // certificar, y se mide contra el total del curso,
      // no contra lo que tocaria a estas alturas
      const porcentaje = total > 0 ? hechas / total : 0;
      const listoParaCertificar = total > 0 && porcentaje >= MINIMO_PARA_CERTIFICAR;

      // quien se fue no se juzga por su ritmo: su etapa ya
      // dice lo que paso. Se le calcula igual para saber
      // por donde iba cuando lo dejo
      const salio = SALIDAS_DEL_AULA.includes(p.etapa);

      let estado: EstadoAcademico;
      if (p.etapa === 'CERTIFICADO') estado = 'CERTIFICADO';
      else if (listoParaCertificar) estado = 'COMPLETADO';
      // sin calendario no hay contra que medir, y sin
      // grupo arrancado no se juzga a nadie: las dos
      // cosas se dicen igual, que su curso no ha empezado
      else if (esperadas === null) estado = 'SIN_EMPEZAR';
      else if (inicio !== null && ahora < inicio) estado = 'SIN_EMPEZAR';
      // nunca piso el aula, aunque su grupo ya empezo
      else if (p.ultimoAcceso === null) estado = 'SIN_INGRESO';
      else if (desfase! <= -TOLERANCIA) estado = 'ATRASADO';
      else estado = 'AL_DIA';

      return {
        id: p.id,
        nombre: `${p.persona.primerNombre} ${p.persona.primerApellido}`,
        documento: p.persona.numeroDocumento,
        etapa: p.etapa,
        accion: p.accionFormacion
          ? `${p.accionFormacion.codigo} · ${p.accionFormacion.nombre}`
          : null,
        accionFormacionId: p.accionFormacionId,
        grupo: grupo ? grupo.numero : null,
        fechaInicio: grupo?.fechaInicio ?? null,
        fechaFin: grupo?.fechaFin ?? null,
        horario: grupo?.horario ?? null,
        asesor: p.asesor,
        total,
        hechas,
        esperadas,
        desfase,
        porcentaje: total > 0 ? Math.round((hechas / total) * 100) : 0,
        listoParaCertificar,
        /// Si se fue, manda su etapa y no su ritmo.
        salio,
        // para agrupar por acción y grupo en la pantalla
        coberturaId: p.coberturaId,
        ultimoAcceso: p.ultimoAcceso,
        diasSinEntrar,
        notaFinal: p.notaFinal,
        estado,
      };
    });

    const porEtapa = (e: EtapaParticipante) =>
      personas.filter((p) => p.etapa === e).length;

    // los seis miden ritmo, y el ritmo de quien ya se fue
    // no dice nada: esas van contadas por su etapa
    const cuenta = (e: EstadoAcademico) =>
      personas.filter((p) => !p.salio && p.estado === e).length;

    // las opciones salen de quien esta en el aula, no de
    // todo el catalogo: un filtro con 15 acciones vacias
    // hace perder el tiempo
    const acciones = [
      ...new Map(
        filas
          .filter((f) => f.accionFormacion)
          .map((f) => [
            f.accionFormacion!.id,
            {
              id: f.accionFormacion!.id,
              codigo: f.accionFormacion!.codigo,
              nombre: f.accionFormacion!.nombre,
            },
          ]),
      ).values(),
    ].sort((a, b) => a.codigo.localeCompare(b.codigo));

    const grupos = [
      ...new Map(
        filas
          .filter((f) => f.cobertura)
          .map((f) => [
            f.cobertura!.grupoId,
            {
              id: f.cobertura!.grupoId,
              numero: f.cobertura!.grupo.numero,
              accionFormacionId: f.accionFormacionId,
            },
          ]),
      ).values(),
    ].sort((a, b) => a.numero - b.numero);

    const asesores = [
      ...new Map(
        filas.filter((f) => f.asesor).map((f) => [f.asesor!.id, f.asesor!]),
      ).values(),
    ].sort((a, b) => a.nombre.localeCompare(b.nombre));

    return {
      personas,
      acciones,
      grupos,
      asesores,
      sinAsesor: filas.filter((f) => !f.asesor).length,
      resumen: {
        total: enAula,
        /// Sobre cuantas se calculo el reparto de abajo.
        analizadas: personas.length,
        /// Los seis se cuentan solo sobre quien sigue dentro.
        enFormacion: personas.filter((p) => !p.salio).length,
        sinIngreso: cuenta('SIN_INGRESO'),
        sinEmpezar: cuenta('SIN_EMPEZAR'),
        atrasados: cuenta('ATRASADO'),
        alDia: cuenta('AL_DIA'),
        completados: cuenta('COMPLETADO'),
        certificados: cuenta('CERTIFICADO'),
        /// Las salidas van por su etapa, que es lo que
        /// las distingue: aviso, sin aviso, o no aprobo.
        desertaron: porEtapa('DESERTO'),
        abandonaron: porEtapa('ABANDONO'),
        retirados: porEtapa('RETIRADO'),
        noAprobaron: porEtapa('NO_APROBO'),
      },
      // lo que se le exige a "al día", dicho en la pantalla
      criterio: {
        tolerancia: TOLERANCIA,
        diasParado: DIAS_PARADO,
        minimoParaCertificar: MINIMO_PARA_CERTIFICAR,
      },
    };
  }

  /** Ofertas y grupos donde se puede colocar a alguien. */
  async opciones(convenioId: string, ambito: string[]) {
    this.exigirConvenio(convenioId, ambito);

    const ofertas = await this.prisma.oferta.findMany({
      where: { accionFormacion: { convenioId } },
      orderBy: [
        { accionFormacion: { orden: 'asc' } },
        { ubicacion: { nombre: 'asc' } },
      ],
      select: {
        id: true,
        cuposMaximos: true,
        abierta: true,
        modalidad: true,
        ubicacion: { select: { nombre: true } },
        accionFormacion: { select: { id: true, codigo: true, nombre: true } },
        _count: { select: { participantes: { where: { etapa: { in: ETAPAS_VIVAS } } } } },
      },
    });

    const grupos = await this.prisma.grupoCobertura.findMany({
      where: { grupo: { accionFormacion: { convenioId } } },
      orderBy: [{ grupo: { numero: 'asc' } }],
      select: {
        id: true,
        cuposBase: true,
        modalidad: true,
        ubicacion: { select: { nombre: true } },
        grupo: {
          select: {
            numero: true,
            fechaInicio: true,
            fechaFin: true,
            horario: true,
            accionFormacionId: true,
          },
        },
        _count: { select: { participantes: { where: { etapa: { in: ETAPAS_VIVAS } } } } },
      },
    });

    // quien puede llevar leads en este convenio: los que
    // tienen concesion aqui, y no los de solo consulta
    const asesores = await this.prisma.admin.findMany({
      where: {
        activo: true,
        convenios: {
          some: {
            convenioId,
            rol: { in: ['GESTOR_INSCRIPCION', 'LIDER_INSCRIPCION', 'LIDER_SISTEMAS'] },
          },
        },
      },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, correo: true },
    });

    return {
      asesores,
      ofertas: ofertas.map((o) => ({
        id: o.id,
        accionFormacionId: o.accionFormacion.id,
        etiqueta: `${o.accionFormacion.codigo} · ${o.accionFormacion.nombre}`,
        ubicacion: o.ubicacion.nombre,
        modalidad: o.modalidad,
        cupos: o.cuposMaximos,
        ocupados: o._count.participantes,
        disponibles: Math.max(0, o.cuposMaximos - o._count.participantes),
        abierta: o.abierta,
      })),
      grupos: grupos.map((g) => ({
        id: g.id,
        accionFormacionId: g.grupo.accionFormacionId,
        etiqueta: `Grupo ${g.grupo.numero} · ${g.ubicacion.nombre}`,
        modalidad: g.modalidad,
        cupos: g.cuposBase,
        ocupados: g._count.participantes,
        fechaInicio: g.grupo.fechaInicio,
        fechaFin: g.grupo.fechaFin,
        horario: g.grupo.horario,
      })),
    };
  }

  /** Colocar a alguien en una oferta y su grupo. */
  async asignar(
    id: string,
    dto: AsignarFormacionDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: {
        id: true,
        personaId: true,
        convenioId: true,
        accionFormacionId: true,
        etapa: true,
        ofertaId: true,
        coberturaId: true,
      },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    const oferta = await this.prisma.oferta.findUnique({
      where: { id: dto.ofertaId },
      select: {
        id: true,
        cuposMaximos: true,
        accionFormacionId: true,
        ubicacion: { select: { nombre: true } },
        accionFormacion: {
          select: { convenioId: true, codigo: true, nombre: true },
        },
      },
    });
    if (!oferta) throw new NotFoundException('Esa oferta no existe.');

    if (oferta.accionFormacion.convenioId !== p.convenioId) {
      throw new BadRequestException('Esa oferta es de otro convenio.');
    }

    // la misma persona no cuenta dos veces en una accion
    if (oferta.accionFormacionId !== p.accionFormacionId) {
      const repetido = await this.prisma.participante.findFirst({
        where: {
          personaId: p.personaId,
          accionFormacionId: oferta.accionFormacionId,
          id: { not: id },
        },
        select: { id: true },
      });
      if (repetido) {
        throw new ConflictException(
          'Esta persona ya está en esa acción de formación con otra participación.',
        );
      }
    }

    let sobrecupo: { porId: string; motivo: string } | null = null;
    const ocupadas = await this.prisma.participante.count({
      where: { ofertaId: oferta.id, etapa: { in: ETAPAS_VIVAS }, id: { not: id } },
    });

    if (ocupadas >= oferta.cuposMaximos) {
      if (!dto.sobrecupoMotivo) {
        throw new ConflictException(
          `«${oferta.accionFormacion.nombre}» ya tiene sus ${oferta.cuposMaximos} ` +
            'cupos ocupados. Para colocar por encima del cupo hay que indicar el motivo.',
        );
      }
      sobrecupo = { porId: admin.id, motivo: dto.sobrecupoMotivo };
    }

    let numeroDeGrupo: number | null = null;
    if (dto.coberturaId) {
      const cobertura = await this.prisma.grupoCobertura.findUnique({
        where: { id: dto.coberturaId },
        select: {
          grupo: { select: { accionFormacionId: true, numero: true } },
        },
      });
      if (!cobertura) throw new NotFoundException('Ese grupo no existe.');
      if (cobertura.grupo.accionFormacionId !== oferta.accionFormacionId) {
        throw new BadRequestException('Ese grupo es de otra acción de formación.');
      }
      numeroDeGrupo = cobertura.grupo.numero;
    }

    const cobertura = dto.coberturaId ?? null;
    const partes: string[] = [];

    if (oferta.id !== p.ofertaId) {
      partes.push(
        `Formación: ${oferta.accionFormacion.codigo} · ` +
          `${oferta.accionFormacion.nombre} — ${oferta.ubicacion.nombre}`,
      );
    }
    if (cobertura !== p.coberturaId) {
      partes.push(
        numeroDeGrupo === null ? 'Sin grupo' : `Grupo ${numeroDeGrupo}`,
      );
    }
    // como al crear con sobrecupo
    if (sobrecupo) partes.push(`Sobrecupo autorizado: ${sobrecupo.motivo}`);

    const escrituras: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.participante.update({
        where: { id },
        data: {
          ofertaId: oferta.id,
          accionFormacionId: oferta.accionFormacionId,
          coberturaId: cobertura,
          sobrecupoPorId: sobrecupo?.porId ?? null,
          sobrecupoMotivo: sobrecupo?.motivo ?? null,
        },
      }),
    ];

    if (partes.length > 0) {
      escrituras.push(
        this.prisma.movimientoParticipante.create({
          data: {
            participanteId: id,
            // misma etapa: no es una transicion
            etapaAntes: p.etapa,
            etapaDespues: p.etapa,
            adminId: admin.id,
            nota: partes.join('. '),
            ip: ip ?? null,
          },
        }),
      );
    }

    await this.prisma.$transaction(escrituras);

    return this.obtener(id, ambito);
  }

  /** La prueba de que el titular autorizo. */
  async registrarAutorizacion(
    id: string,
    dto: RegistrarAutorizacionDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { personaId: true, convenioId: true, etapa: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    const politica = await this.prisma.politicaDatos.findFirst({
      where: {
        convenioId: p.convenioId,
        destinatario: 'PARTICIPANTE',
        vigenteHasta: null,
      },
      select: { id: true, version: true },
    });

    if (!politica) {
      throw new ConflictException(
        'Este convenio no tiene una política de participantes vigente. ' +
          'Publíquela antes de registrar autorizaciones.',
      );
    }

    const yaEsta = await this.prisma.autorizacionDatos.findFirst({
      where: { personaId: p.personaId, politicaDatosId: politica.id, revocadaEn: null },
      select: { id: true },
    });
    if (yaEsta) return this.obtener(id, ambito);

    // un texto para nota e historial
    const texto =
      `Autorización de tratamiento registrada (v${politica.version}), ` +
      `por ${dto.canal}.` +
      (dto.evidencia ? ` Evidencia: ${dto.evidencia}` : '');

    await this.prisma.$transaction([
      this.prisma.autorizacionDatos.create({
        data: {
          personaId: p.personaId,
          politicaDatosId: politica.id,
          canal: dto.canal,
          evidencia: dto.evidencia ?? null,
          ip: ip ?? null,
        },
      }),
      this.prisma.notaParticipante.create({
        data: {
          participanteId: id,
          autorId: admin.id,
          autorNombre: admin.nombre,
          texto,
        },
      }),
      this.prisma.movimientoParticipante.create({
        data: {
          participanteId: id,
          // misma etapa: no es una transicion
          etapaAntes: p.etapa,
          etapaDespues: p.etapa,
          adminId: admin.id,
          nota: texto,
          ip: ip ?? null,
        },
      }),
    ]);

    return this.obtener(id, ambito);
  }

  /** Sin concesión en ese convenio, no existe. */
  private exigirConvenio(convenioId: string, ambito: string[]) {
    if (!ambito.includes(convenioId)) {
      throw new ForbiddenException('No tiene acceso a ese convenio.');
    }
  }

  /**
   * Un id de otro convenio responde igual que uno que no
   * existe: decir «no tiene permiso» confirmaría que esa
   * persona está en el sistema.
   */
  private async exigirParticipante(id: string, ambito: string[]) {
    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { convenioId: true },
    });
    if (!p || !ambito.includes(p.convenioId)) {
      throw new NotFoundException('Ese participante no existe.');
    }
  }

  private donde(f: Filtros): Prisma.ParticipanteWhereInput {
    const y: Prisma.ParticipanteWhereInput[] = [];

    // el ambito primero y siempre: pedir un convenioId al
    // que no se tiene acceso no puede devolver nada. Una
    // lista vacia deja fuera todo, que es lo correcto
    // cuando la cuenta no tiene concesion en ninguno
    if (f.ambito) {
      y.push({ convenioId: { in: f.ambito } });
    }

    if (f.convenioId) y.push({ convenioId: f.convenioId });
    if (f.etapa) y.push({ etapa: f.etapa });
    // el tramo acota la pantalla entera: Inscripciones no
    // sabe de quien ya esta en el aula, y al reves
    if (f.tramo === 'INSCRIPCION') {
      y.push({ etapa: { in: ETAPAS_DEL_EMBUDO } });
    } else if (f.tramo === 'INSCRITOS') {
      y.push({ etapa: 'INSCRITO' });
    } else if (f.tramo === 'AULA') {
      y.push({ etapa: { in: ETAPAS_DEL_AULA } });
    }
    if (f.accionFormacionId) y.push({ accionFormacionId: f.accionFormacionId });
    if (f.coberturaId) y.push({ coberturaId: f.coberturaId });
    // el grupo cuelga de la cobertura, no del participante
    if (f.grupoId) y.push({ cobertura: { grupoId: f.grupoId } });
    if (f.asesorId) y.push({ asesorId: f.asesorId });
    if (f.departamentoSepId) {
      y.push({ persona: { departamentoSepId: f.departamentoSepId } });
    }

    // «completa» no es una columna: es que no falte ninguno de
    // los diez que exige el reporte. La condicion se escribe
    // aqui igual que en `faltaDeLaPersona`, y si una cambia
    // hay que cambiar la otra
    if (f.estado) {
      const completa: Prisma.ParticipanteWhereInput = {
        AND: [
          { nivelOcupacionalSepId: { not: null } },
          {
            persona: {
              correo: { not: null },
              celular: { not: null },
              fechaNacimiento: { not: null },
              generoSepId: { not: null },
              estrato: { not: null },
              departamentoSepId: { not: null },
              municipioSepId: { not: null },
              direccion: { not: null },
              barrio: { not: null },
            },
          },
        ],
      };
      y.push(f.estado === 'COMPLETO' ? completa : { NOT: completa });
    }

    const buscar = f.buscar?.trim();
    if (buscar) {
      const documento = normalizarDocumento(buscar);
      y.push({
        OR: [
          { persona: { primerNombre: { contains: buscar, mode: 'insensitive' } } },
          { persona: { segundoNombre: { contains: buscar, mode: 'insensitive' } } },
          { persona: { primerApellido: { contains: buscar, mode: 'insensitive' } } },
          { persona: { segundoApellido: { contains: buscar, mode: 'insensitive' } } },
          { persona: { correo: { contains: buscar, mode: 'insensitive' } } },
          ...(documento
            ? [{ persona: { numeroDocumento: { startsWith: documento } } }]
            : []),
        ],
      });
    }

    return y.length ? { AND: y } : {};
  }

  /// Los doce origenes de la base, en los tres que le sirven
  /// al asesor. «Pauta» son las redes de Meta: lo que se paga.
  /// «Organico» es quien llego solo por el formulario.
  private static readonly PAUTA = new Set<OrigenParticipante>([
    'REDES',
    'INSTAGRAM',
    'FACEBOOK',
    'LINKEDIN',
  ]);

  /// Cuanto se sabe de la empresa donde trabaja. Es lo que
  /// decide si su ficha puede salir en el F7.
  private estadoDeEmpresa(
    e: {
      razonSocial: string;
      direccion: string | null;
      telefono: string | null;
      sectorEconomico: string | null;
      clasificacion: string | null;
    } | null,
  ): 'SIN' | 'PARCIAL' | 'COMPLETA' {
    if (!e) return 'SIN';
    const puestos = [e.direccion, e.telefono, e.sectorEconomico, e.clasificacion].filter(
      (v) => v !== null && v !== '',
    ).length;
    if (puestos === 4) return 'COMPLETA';
    return 'PARCIAL';
  }

  private aFila(p: {
    id: string;
    etapa: EtapaParticipante;
    origen: OrigenParticipante;
    creadoEn: Date;
    nivelOcupacionalSepId: number | null;
    persona: {
      tipoDocumentoSepId: number;
      numeroDocumento: string;
      primerNombre: string;
      segundoNombre: string | null;
      primerApellido: string;
      segundoApellido: string | null;
      correo: string | null;
      celular: string | null;
      fechaNacimiento: Date | null;
      generoSepId: number | null;
      estrato: number | null;
      departamentoSepId: number | null;
      municipioSepId: number | null;
      barrio: string | null;
      direccion: string | null;
    };
    actualizadoEn: Date;
    convenio: { sigla: string | null; slug: string };
    accionFormacion: { codigo: string; nombre: string } | null;
    oferta: { ubicacion: { nombre: string } } | null;
    asesor: { id: string; nombre: string } | null;
    reservaId: string | null;
    reserva: {
      id: string;
      cuposSolicitados: number;
      empresa: { razonSocial: string; nit: string };
    } | null;
    empresa: {
      razonSocial: string;
      direccion: string | null;
      telefono: string | null;
      sectorEconomico: string | null;
      clasificacion: string | null;
    } | null;
    movimientos: Array<{
      etapaAntes: EtapaParticipante | null;
      etapaDespues: EtapaParticipante;
      creadoEn: Date;
    }>;
    _count: { notas: number; movimientos: number };
    /// Cuantas veces se le edito un campo. Sale del registro
    /// de auditoria, que es donde queda esa traza.
    ediciones: number;
  }) {
    // lo que la persona dejo a medias: es lo que el asesor
    // tiene que completar por telefono
    const falta = faltaDeLaPersona({
      persona: p.persona,
      nivelOcupacionalSepId: p.nivelOcupacionalSepId,
    });

    return {
      id: p.id,
      etapa: p.etapa,
      origen: p.origen,
      datos: falta.length === 0 ? ('COMPLETOS' as const) : ('PARCIALES' as const),
      faltaDeLaPersona: falta,
      creadoEn: p.creadoEn,
      documento: `${siglaDocumento(p.persona.tipoDocumentoSepId)} ${p.persona.numeroDocumento}`,
      nombre: [
        p.persona.primerNombre,
        p.persona.segundoNombre,
        p.persona.primerApellido,
        p.persona.segundoApellido,
      ]
        .filter(Boolean)
        .join(' '),
      correo: p.persona.correo,
      celular: p.persona.celular,
      convenio: p.convenio.sigla ?? p.convenio.slug,
      accion: p.accionFormacion
        ? `${p.accionFormacion.codigo} · ${p.accionFormacion.nombre}`
        : null,
      ubicacion: p.oferta?.ubicacion.nombre ?? null,
      asesor: p.asesor,
      notas: p._count.notas,

      // --- lo que la tabla de leads pide aparte ---
      tipoDocumento: siglaDocumento(p.persona.tipoDocumentoSepId),
      numeroDocumento: p.persona.numeroDocumento,
      /// Donde vive, no donde se dicta: `ubicacion` es la sede.
      departamento: p.persona.departamentoSepId
        ? (DEPARTAMENTO_POR_ID.get(p.persona.departamentoSepId)?.etiqueta ?? null)
        : null,
      municipio: p.persona.municipioSepId
        ? (MUNICIPIO_POR_ID.get(p.persona.municipioSepId)?.[2] ?? null)
        : null,
      /// Solo el codigo: en una columna no cabe el nombre.
      accionCodigo: p.accionFormacion?.codigo ?? null,
      gremio: p.convenio.sigla ?? p.convenio.slug,
      origenLead: CrmService.PAUTA.has(p.origen)
        ? ('PAUTA' as const)
        : p.origen === 'AUTOGESTION'
          ? ('ORGANICO' as const)
          : ('IMPORTACION' as const),
      /// Viene de una empresa que aparto cupos. Ese turno
      /// caduca en el cierre, y por eso va primero.
      dePreReserva: p.reservaId !== null,
      reservaDe: p.reserva?.empresa.razonSocial ?? null,
      /// Lo ultimo que se le hizo, sea un cambio de etapa o
      /// una edicion de la ficha.
      ultimaActividad: p.movimientos[0]?.creadoEn ?? p.actualizadoEn,
      /// De donde viene: el movimiento anterior al de ahora.
      etapaAnterior: p.movimientos[0]?.etapaAntes ?? null,
      /// Solo ediciones de campos. Los cambios de etapa no
      /// entran: los cuenta «Ultima etapa lead», y sumarlos
      /// aqui contaba dos veces la misma edicion, porque
      /// guardar la ficha tambien deja movimiento.
      cambios: p.ediciones,
      datosEmpresa: this.estadoDeEmpresa(p.empresa),
      antiguedadDias: Math.floor(
        (Date.now() - p.creadoEn.getTime()) / 86_400_000,
      ),
    };
  }
}
