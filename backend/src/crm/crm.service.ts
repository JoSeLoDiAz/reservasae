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
import {
  ENTIDADES,
  AuditoriaService,
  type Actor,
} from '../comun/auditoria.service';
import { taparDocumento } from '../comun/tapar';
import { DisparadorInscripcion } from '../instituciones/web/disparador';
import {
  CLASE_POR_CAMPO,
  enPalabras as enPalabrasElCampo,
  seGuardaElValor,
  seHistoria,
} from './clase-de-dato';
import { documentoValido, normalizarDocumento } from '../comun/documento';
import { analizar, esInsalvable, repetidosEnElPegado } from './carga';
import {
  esRegresoAlAula,
  saleDelCupo,
  exigeCupo,
  exigeDatosParaElAula,
  motivoDeTransicionImposible,
} from './escalera';
import { cubreA, exigirCoberturaDeLaOferta, repartirPorCobertura } from './cobertura';
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
import { OCUPAN_SILLA } from './etapas';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarParticipanteDto,
  AsignarAsesorEnLoteDto,
  AsignarFormacionDto,
  CargaDto,
  CambiarEtapaDto,
  RevocarAutorizacionDto,
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
export const ETAPAS_VIVAS = OCUPAN_SILLA;

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
  return aTextoLlano(valor);
}

/**
 * Un valor cualquiera como texto, sin perderlo por el camino.
 *
 * `String(valor)` sobre un objeto da «[object Object]», que no
 * es un texto: es la desaparicion del dato con forma de texto.
 * Ya paso en la celda del F7 y ahi al menos se veia; en el
 * historial de «que decia antes» no se ve, y el valor viejo ya
 * no esta en ningun otro sitio.
 */
function aTextoLlano(valor: unknown): string {
  if (typeof valor === 'object' && valor !== null) {
    try {
      return JSON.stringify(valor);
    } catch {
      return '(no se pudo leer)';
    }
  }
  return String(valor);
}

/// Lo que el F7 necesita de una organizacion.
///
/// Una sola lista: la piden la compuerta de matricula y el
/// reporte, y si se separan, la compuerta deja pasar a quien el
/// reporte despues rechaza.
const CAMPOS_DE_EMPRESA = {
  nit: true,
  razonSocial: true,
  sectorEconomico: true,
  contactoNombre: true,
  contactoCargo: true,
  contactoCorreo: true,
} as const;

@Injectable()
export class CrmService {
  private readonly log = new Logger('CRM');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly colaRui: ColaRui,
    private readonly cupos: PanelDeCupos,
    private readonly disparador: DisparadorInscripcion,
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
        entidad: ENTIDADES.PARTICIPANTE,
        accion: 'PARTICIPANTE_EDITADO',
        entidadId: { in: filas.map((f) => f.id) },
      },
      _count: { _all: true },
    });
    const ediciones = new Map(porFila.map((f) => [f.entidadId, f._count._all]));

    /// La gestion de toda la pagina, en dos consultas.
    ///
    /// Aqui el "sin respuesta" es el de SIEMPRE y no el de
    /// desde el ultimo contacto, que si da la ficha. Acotarlo
    /// por fila necesitaria una fecha distinta en cada una, y
    /// eso ya no es un groupBy. Para lo que sirve la columna
    /// —a quien no se ha logrado contactar— las dos coinciden,
    /// porque a esa gente no hay ningun contacto que descontar.
    const ids = filas.map((f) => f.id);
    const [contactos, fallidos] = await Promise.all([
      this.prisma.notaParticipante.groupBy({
        by: ['participanteId'],
        where: { participanteId: { in: ids }, resultado: 'CONTACTO' },
        _max: { creadoEn: true },
      }),
      this.prisma.notaParticipante.groupBy({
        by: ['participanteId'],
        where: {
          participanteId: { in: ids },
          resultado: { in: ['SIN_RESPUESTA', 'DATO_MALO'] },
        },
        _count: { _all: true },
      }),
    ]);
    const ultimoContacto = new Map(
      contactos.map((c) => [c.participanteId, c._max.creadoEn]),
    );
    const sinRespuesta = new Map(
      fallidos.map((c) => [c.participanteId, c._count._all]),
    );

    return {
      total,
      pagina,
      paginas: Math.max(1, Math.ceil(total / porPagina)),
      participantes: filas.map((p) =>
        this.aFila({
          ...p,
          ediciones: ediciones.get(p.id) ?? 0,
          ultimoContacto: ultimoContacto.get(p.id) ?? null,
          sinRespuesta: sinRespuesta.get(p.id) ?? 0,
        }),
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
      municipios: MUNICIPIOS_SEP.filter((m) => m[3]).map((m) => [
        m[0],
        m[1],
        m[2],
      ]),
      estrato: { minimo: ESTRATO_MINIMO, maximo: ESTRATO_MAXIMO },
      edadMinima: EDAD_MINIMA,
      // los tres del decreto 957, no las 21 del CIIU
      sectoresEconomicos: SECTORES_ECONOMICOS,
      // las unicas que un asesor elige a mano
      etapasAMano: ETAPAS_A_MANO,
      canalesDeContacto: ['CORREO', 'WHATSAPP', 'TEXTO', 'LLAMADA'],
      // como salio la gestion; el panel los dibuja de aqui
      resultadosDeGestion: ['CONTACTO', 'SIN_RESPUESTA', 'DATO_MALO'],
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
      prisma: this.prisma,
      donde,
    });
  }

  async resumen(filtros: Filtros) {
    // sin el tramo tampoco: si se hereda, la pantalla de
    // leads jura que hay cero inscritos porque su propio
    // recorte los deja fuera antes de contarlos
    const donde = this.donde({
      ...filtros,
      etapa: undefined,
      tramo: undefined,
    });

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

    const idsAsesor = porAsesor
      .map((f) => f.asesorId)
      .filter((id): id is string => !!id);
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

    const totalAsesor = new Map(
      porAsesor.map((f) => [f.asesorId, f._count._all]),
    );
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
      asesores: asesores.map((a) => ({
        ...a,
        total: totalAsesor.get(a.id) ?? 0,
      })),
      acciones: acciones.map((a) => ({
        ...a,
        total: totalAccion.get(a.id) ?? 0,
      })),
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
              /// Las REVOCADAS también viajan, y hace falta.
              ///
              /// Solo iban las vivas, así que tras revocar la
              /// ficha decía «todavía no ha autorizado» y
              /// ofrecía registrarla con un clic: la pantalla
              /// borraba de la vista un derecho que la persona
              /// acababa de ejercer, e invitaba a deshacerlo sin
              /// que nadie supiera que estaba deshaciendo algo.
              ///
              /// El ámbito sigue: mandarlas todas las enseñaría
              /// en la red.
              where: { politica: { convenioId: { in: ambito } } },
              orderBy: { otorgadaEn: 'desc' },
              select: {
                id: true,
                canal: true,
                otorgadaEn: true,
                revocadaEn: true,
                politica: {
                  select: {
                    version: true,
                    destinatario: true,
                    convenioId: true,
                  },
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
      /// Cuantas veces se le intento y si alguna se logro.
      gestion: await this.gestionDe(id),
    };
  }

  /**
   * Cuántas veces se intentó contactar a esta persona.
   *
   * NO se cuenta sobre las 50 notas que trae la ficha: con más
   * de 50 la cifra diría 50 y parecería exacta, que es la peor
   * clase de número. Va en su propia consulta, sobre el índice
   * `(participanteId, resultado)`.
   *
   * `sinContacto` se cuenta DESDE el último contacto y no desde
   * siempre: a quien se le habló ayer no se le deben tres
   * llamadas por las tres de la semana pasada. Es la cifra que
   * responde a quién hay que insistirle hoy.
   */
  private async gestionDe(id: string) {
    const ultimo = await this.prisma.notaParticipante.findFirst({
      where: { participanteId: id, resultado: 'CONTACTO' },
      orderBy: { creadoEn: 'desc' },
      select: { creadoEn: true },
    });

    const [intentos, sinContacto, datoMalo] = await Promise.all([
      this.prisma.notaParticipante.count({
        where: { participanteId: id, resultado: { not: null } },
      }),
      this.prisma.notaParticipante.count({
        where: {
          participanteId: id,
          resultado: { in: ['SIN_RESPUESTA', 'DATO_MALO'] },
          ...(ultimo ? { creadoEn: { gt: ultimo.creadoEn } } : {}),
        },
      }),
      this.prisma.notaParticipante.count({
        where: { participanteId: id, resultado: 'DATO_MALO' },
      }),
    ]);

    return {
      intentos,
      sinContacto,
      datoMalo,
      ultimoContacto: ultimo?.creadoEn ?? null,
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

  /**
   * Crea la ficha.
   *
   * `encolarRui: false` es para quien tiene que dejar la
   * constancia ANTES de que la cedula salga hacia el portal del
   * DNP -- hoy solo la conversion de un lead. Encolar aqui dentro
   * hacia imposible ese orden desde fuera, porque `crear` volvia
   * con la consulta ya encolada.
   */
  async crear(
    dto: CrearParticipanteDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
    opciones?: { encolarRui?: boolean },
  ) {
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
      throw new BadRequestException(
        'Esa oferta no pertenece al convenio indicado.',
      );
    }

    /// La accion puede venir SIN oferta: es el caso del lead, que
    /// dice que curso quiere y no dice donde vive.
    ///
    /// Se comprueba que sea del convenio por lo mismo que la
    /// oferta: sin esto, una accion del otro gremio entraria y la
    /// ficha contaria contra la cobertura de quien no es.
    const accionSuelta =
      !oferta && dto.accionFormacionId
        ? await this.prisma.accionFormacion.findUnique({
            where: { id: dto.accionFormacionId },
            select: { id: true, convenioId: true },
          })
        : null;

    if (dto.accionFormacionId && !oferta && !accionSuelta) {
      throw new NotFoundException('Esa accion de formacion no existe.');
    }
    if (accionSuelta && accionSuelta.convenioId !== dto.convenioId) {
      throw new BadRequestException(
        'Esa accion de formacion no pertenece al convenio indicado.',
      );
    }

    /// Manda la oferta si vino: lleva la sede dentro.
    const accionId = oferta?.accionFormacionId ?? accionSuelta?.id ?? null;

    // la reserva se comprobaba: entraba tal cual y una de
    // otro convenio sumaba a la cobertura de este sin
    // sumar su cupo al denominador
    if (dto.reservaId) {
      const reserva = await this.prisma.reserva.findUnique({
        where: { id: dto.reservaId },
        select: {
          ofertaId: true,
          oferta: {
            select: { accionFormacion: { select: { convenioId: true } } },
          },
        },
      });
      if (!reserva) throw new NotFoundException('Esa reserva no existe.');
      if (reserva.oferta.accionFormacion.convenioId !== dto.convenioId) {
        throw new BadRequestException(
          'Esa reserva no pertenece al convenio indicado.',
        );
      }
      if (oferta && reserva.ofertaId !== oferta.id) {
        throw new BadRequestException(
          'Esa reserva no es de la formación que se le asigna.',
        );
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
          fechaNacimiento: dto.fechaNacimiento
            ? new Date(dto.fechaNacimiento)
            : null,
          sexo: dto.sexo ?? null,
          correo: dto.correo ?? null,
          celular: dto.celular ?? null,
          /// El domicilio es de donde sale la SEDE, asi que
          /// perderlo aqui obliga a pedirlo despues por el
          /// enlace de completado -- un dato que ya habia dado.
          generoSepId: dto.generoSepId ?? null,
          departamentoSepId: dto.departamentoSepId ?? null,
          municipioSepId: dto.municipioSepId ?? null,
        },
        // no se pisa lo que ya hay con lo que llega vacio
        update: {
          correo: dto.correo ?? undefined,
          celular: dto.celular ?? undefined,
          generoSepId: dto.generoSepId ?? undefined,
          departamentoSepId: dto.departamentoSepId ?? undefined,
          municipioSepId: dto.municipioSepId ?? undefined,
          fechaNacimiento: dto.fechaNacimiento
            ? new Date(dto.fechaNacimiento)
            : undefined,
        },
      });

      /// Va contra `accionId`, no contra `oferta`.
      ///
      /// Estaba dentro de un `if (oferta)`, asi que el camino que
      /// NO manda oferta --convertir un lead-- no lo corria nunca:
      /// dos leads de la misma persona daban dos fichas. Y el
      /// unique de la base tampoco lo paraba, porque con la accion
      /// en NULL Postgres trata cada nulo como distinto.
      if (accionId) {
        const repetido = await tx.participante.findFirst({
          where: { personaId: persona.id, accionFormacionId: accionId },
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
          accionFormacionId: accionId,
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
      if (opciones?.encolarRui !== false) {
        await this.colaRui.encolarSiHaceFalta(creado.personaId);
      }
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
        // hace falta para saber si el asesor la veria
        convenioId: true,
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
      municipioSepId: p.persona?.municipioSepId,
    });
    if (malo) throw new BadRequestException(malo);

    // asignar() ya lo comprueba; aqui no se comprobaba
    // nada, y una cobertura de otro curso manda al SEP un
    // AF y un grupo que se contradicen
    if (dto.coberturaId) {
      const suya = await this.prisma.participante.findUnique({
        where: { id },
        select: {
          accionFormacionId: true,
          /// La sede sale de su oferta. Sin esto solo se comprobaba la
          /// acción, y entraba un grupo de otra ciudad por esta puerta
          /// aunque `asignar` lo cerrara por la suya.
          oferta: { select: { ubicacionId: true } },
        },
      });
      if (!suya?.accionFormacionId) {
        throw new BadRequestException(
          'Esta persona todavía no tiene acción de formación: no se le puede poner grupo.',
        );
      }
      await exigirCoberturaDeLaOferta(this.prisma, dto.coberturaId, {
        accionFormacionId: suya.accionFormacionId,
        ubicacionId: suya.oferta?.ubicacionId ?? null,
      });
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
      fechaNacimiento: dto.fechaNacimiento
        ? new Date(dto.fechaNacimiento)
        : undefined,
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
      const asesor = await this.exigirAsesorDelConvenio(
        dto.asesorId,
        p.convenioId,
      );
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
    if (datos.length > 0)
      partes.push(`Datos actualizados: ${datos.join(', ')}`);

    // marcar la ficha solo si el asesor toco datos de la
    // persona: desde ese momento, lo que mande el interesado
    // por su enlace ya no pisa, espera como propuesta.
    // Asignarle un asesor no cuenta, que no toca sus datos
    const tocoDatosDePersona = this.queCambio(dePersona, p.persona).length > 0;

    /// El histórico, calculado ANTES de escribir: después del
    /// update ya no se puede saber qué decía.
    const historico = [
      ...this.valoresQueSeVan(
        dePersona,
        p.persona,
        id,
        { id: admin.id, nombre: admin.nombre },
        ip,
      ),
      ...this.valoresQueSeVan(
        deParticipante,
        p,
        id,
        { id: admin.id, nombre: admin.nombre },
        ip,
      ),
    ];

    const escrituras: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.persona.update({
        where: { id: p.personaId },
        data: dePersona,
      }),
      this.prisma.participante.update({
        where: { id },
        data: {
          ...deParticipante,
          datosTocadosPorAsesorEn: tocoDatosDePersona ? new Date() : undefined,
        },
      }),
    ];

    if (historico.length > 0) {
      escrituras.push(
        this.prisma.valorAnterior.createMany({ data: historico }),
      );
    }

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
        entidad: ENTIDADES.PARTICIPANTE,
        entidadId: id,
        camposTocados: tocados,
        ip: ip ?? null,
      });
    }

    return this.obtener(id, ambito);
  }

  /** Qué datos llegan distintos de los que ya hay. */
  /**
   * Las filas del histórico de valores, para lo que cambió.
   *
   * Se calcula ANTES de escribir, con lo que había: después
   * del update ya no se puede saber qué decía.
   *
   * La política de qué se guarda vive en `clase-de-dato.ts`,
   * en un solo sitio. Aquí solo se aplica.
   */
  /**
   * El «Historial Logs» de una ficha: qué decía antes.
   *
   * Recortado por ámbito como todo lo demás. `exigirParticipante`
   * ya responde «no existe» si la ficha es de otro gremio, así
   * que el histórico no puede ser una puerta nueva para verlo.
   */
  async historicoDeValores(id: string, ambito: string[]) {
    await this.exigirParticipante(id, ambito);

    const filas = await this.prisma.valorAnterior.findMany({
      where: { participanteId: id },
      orderBy: { creadoEn: 'desc' },
      take: 200,
      select: {
        id: true,
        campo: true,
        clase: true,
        valorAnterior: true,
        habiaValor: true,
        actorNombre: true,
        creadoEn: true,
        restauradoEn: true,
        restauradoPor: { select: { nombre: true } },
      },
    });

    return filas.map((f) => ({
      ...f,
      etiqueta: enPalabrasElCampo(f.campo),
      /// Se dice explícitamente por qué no hay valor, en vez
      /// de enseñar un hueco: un hueco se lee como un error.
      porQueSinValor:
        f.clase === 'SENSIBLE'
          ? 'Es población vulnerable: queda que cambió, nunca qué decía.'
          : !f.habiaValor
            ? 'Estaba vacío.'
            : null,
      /// Restablecer solo tiene sentido si hay a qué volver.
      sePuedeRestablecer:
        f.restauradoEn === null && f.clase !== 'SENSIBLE' && f.habiaValor,
    }));
  }

  /**
   * Devolver un campo a como estaba.
   *
   * No borra la fila: deshacer TAMBIÉN es un cambio, y se
   * tiene que poder ver quién lo deshizo. La fila se marca
   * como restaurada y el cambio nuevo deja su propia fila.
   */
  async restablecerValor(
    participanteId: string,
    valorId: string,
    ambito: string[],
    admin: Admin,
    ip?: string,
  ) {
    await this.exigirParticipante(participanteId, ambito);

    const fila = await this.prisma.valorAnterior.findUnique({
      where: { id: valorId },
      select: {
        id: true,
        campo: true,
        clase: true,
        valorAnterior: true,
        habiaValor: true,
        restauradoEn: true,
        participanteId: true,
      },
    });

    /// La fila tiene que ser DE ESTA ficha. Sin esto, un id de
    /// otra ficha —de otro gremio— restablecería su valor
    /// aquí, y de paso lo revelaría.
    if (!fila || fila.participanteId !== participanteId) {
      throw new NotFoundException('Ese cambio ya no existe.');
    }
    if (fila.restauradoEn) {
      throw new BadRequestException('Ese cambio ya se había restablecido.');
    }
    if (fila.clase === 'SENSIBLE' || !fila.habiaValor) {
      throw new BadRequestException(
        'De ese dato no se guardó el valor anterior, así que no hay a qué volver.',
      );
    }

    /// Se pasa por `actualizar`, que es la única puerta que
    /// escribe datos: así el restablecimiento deja su propio
    /// movimiento y su propia fila de histórico, como
    /// cualquier otro cambio. Si escribiera directo, deshacer
    /// sería el único cambio invisible del sistema.
    await this.actualizar(
      participanteId,
      { [fila.campo]: fila.valorAnterior },
      admin,
      ambito,
      ip,
    );

    await this.prisma.valorAnterior.update({
      where: { id: valorId },
      data: { restauradoEn: new Date(), restauradoPorId: admin.id },
    });

    return { restablecido: true, campo: fila.campo };
  }

  /**
   * Los tres datos del jefe directo, desde la ficha del lead.
   *
   * Una puerta ESTRECHA a propósito. El asesor llama a la
   * persona y consigue el nombre, el cargo y el correo de su
   * jefe: son los mismos tres que pide el enlace de completar
   * datos, y son los únicos que se le sabe un empleado.
   *
   * Lo demás de la empresa —dirección, teléfono, número de
   * trabajadores, tamaño— lo trae la consulta al RUES por el
   * NIT o lo llena el analista de información. Y la RAZÓN
   * SOCIAL no se toca por aquí de ninguna manera: la valida el
   * código contra el registro, y dejar que se escriba a mano
   * es volver a abrir lo que ya se cerró en la ruta pública.
   *
   * Antes esto obligaba a ir a «Empresas registradas», que un
   * gestor de inscripciones no tiene, así que el dato se
   * quedaba sin poner.
   */
  async guardarContactoDeLaEmpresa(
    id: string,
    datos: {
      contactoNombre?: string;
      contactoCargo?: string;
      contactoCorreo?: string;
    },
    ambito: string[],
    actor: Actor,
    ip?: string,
  ) {
    const suyo = await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: {
        empresaId: true,
        reserva: { select: { empresaId: true } },
      },
    });

    /// La de la reserva manda, igual que en todo el resto: la
    /// nominó ella.
    const empresaId = p?.reserva?.empresaId ?? p?.empresaId ?? null;
    if (!empresaId) {
      throw new BadRequestException(
        'Esta persona todavía no tiene organización. Primero hay que ' +
          'decirle en cuál trabaja.',
      );
    }

    /// Solo lo que venga, y solo estos tres. Un campo ausente
    /// no borra: `undefined` en Prisma es «no lo toque».
    const limpio = {
      contactoNombre: datos.contactoNombre?.trim() || undefined,
      contactoCargo: datos.contactoCargo?.trim() || undefined,
      contactoCorreo: datos.contactoCorreo?.trim() || undefined,
    };

    const tocados = Object.entries(limpio)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);

    if (tocados.length === 0) {
      throw new BadRequestException('No llegó ningún dato que guardar.');
    }

    await this.prisma.empresa.update({
      where: { id: empresaId },
      data: limpio,
    });

    /// Queda la huella. Son datos de una empresa que van al
    /// F7, y quien los puso responde por ellos.
    await this.auditoria.registrar({
      actor,
      accion: 'EMPRESA_EDITADA',
      entidad: ENTIDADES.EMPRESA,
      entidadId: empresaId,
      convenioId: suyo?.convenioId ?? null,
      resumen: `Desde la ficha de un lead, por su asesor.`,
      camposTocados: tocados,
      ip,
    });

    return this.obtener(id, ambito);
  }

  private valoresQueSeVan(
    llega: object,
    hay: object,
    participanteId: string,
    actor: Actor,
    ip?: string,
  ): Prisma.ValorAnteriorCreateManyInput[] {
    const viejo = hay as Record<string, unknown>;
    const filas: Prisma.ValorAnteriorCreateManyInput[] = [];

    for (const [campo, valor] of Object.entries(llega)) {
      if (valor === undefined) continue;
      if (mismoValor(valor, viejo[campo])) continue;
      if (!seHistoria(campo)) continue;

      const antes = viejo[campo];
      const habiaValor = antes !== null && antes !== undefined && antes !== '';

      filas.push({
        participanteId,
        campo,
        clase: CLASE_POR_CAMPO[campo],
        /// Sin valor cuando la clase es SENSIBLE. Queda la
        /// constancia del cambio, nunca qué decía.
        /// `aTextoLlano` y no `String()`.
        ///
        /// `String({})` da «[object Object]», y esto es EL
        /// registro de que decia antes: si sale asi, el valor
        /// viejo se perdio y este historial --que existe para
        /// poder volver-- no sirve para volver. Es el mismo
        /// defecto que tuvo la celda del F7.
        valorAnterior:
          seGuardaElValor(campo) && habiaValor
            ? antes instanceof Date
              ? antes.toISOString()
              : aTextoLlano(antes)
            : null,
        habiaValor,
        adminId: actor.id ?? null,
        actorNombre: actor.nombre,
        ip: ip ?? null,
      });
    }

    return filas;
  }

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
  /**
   * El asesor tiene que poder VER la ficha que se le asigna.
   *
   * Se comprobaba que existiera y estuviera activo, y nada más.
   * Asignarle una ficha de ADECOPRIA a quien solo tiene
   * concesión en BRITCHAM no da error: la deja asignada a
   * alguien que no la ve, así que desaparece de la lista de
   * todos, y la brecha de nombres --«a quién llamar hoy»--
   * cuenta como atendida una ficha que no atiende nadie.
   *
   * Va aquí una vez porque la usan la ficha y el lote, que
   * tenían cada una su media comprobación.
   */
  /// Publico: lo usa tambien el lote de la mesa de entrada.
  ///
  /// Un asesor sin concesion en ese convenio no VE la ficha que
  /// se le asigna: quedaria con dueño y sin nadie que la mire, y
  /// la brecha de nombres la contaria como atendida.
  async exigirAsesorDelConvenio(asesorId: string, convenioId: string) {
    const asesor = await this.prisma.admin.findFirst({
      where: { id: asesorId, activo: true },
      select: { id: true, nombre: true, rol: true },
    });
    if (!asesor) {
      throw new BadRequestException('Ese asesor no existe o está desactivado.');
    }

    /// El superadmin entra a todo, igual que en el guard.
    if (asesor.rol === 'SUPERADMIN') return asesor;

    const concesion = await this.prisma.adminConvenio.findFirst({
      where: { adminId: asesorId, convenioId },
      select: { id: true },
    });
    if (!concesion) {
      throw new BadRequestException(
        `${asesor.nombre} no trabaja en este convenio, así que no vería esta ficha. ` +
          'Déle acceso primero, o elija a otra persona.',
      );
    }
    return asesor;
  }

  async asignarAsesorEnLote(
    dto: AsignarAsesorEnLoteDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
    reparten: string[] = [],
  ) {
    const asesorId = dto.asesorId || null;

    // solo las del ambito: un id pegado a mano no cuela
    const suyas = await this.prisma.participante.findMany({
      where: { id: { in: dto.ids }, convenioId: { in: ambito } },
      select: { id: true, etapa: true, asesorId: true, convenioId: true },
    });

    /// Repartir fichas es de quien responde por el equipo.
    ///
    /// Un gestor de inscripciones ES un asesor: las suyas las
    /// trabaja, no las reparte. Sin esto, cualquiera podia
    /// pasarle sus fichas a otro -- o quitarselas.
    ///
    /// Se comprueba por convenio y sobre las fichas de VERDAD,
    /// no sobre lo que venga en el cuerpo.
    const ajenos = [...new Set(suyas.map((p) => p.convenioId))].filter(
      (c) => !reparten.includes(c),
    );
    if (ajenos.length > 0) {
      throw new ForbiddenException(
        'Repartir fichas entre asesores lo hace un lider: es organizar el ' +
          'trabajo del equipo, no atender un lead.',
      );
    }

    /// El asesor tiene que ver TODAS las que se le asignan.
    ///
    /// Un lote puede traer fichas de los dos convenios, asi que
    /// se comprueba contra cada convenio distinto que haya
    /// dentro: bastaria con que uno no fuera suyo para dejarle
    /// fichas que no ve.
    if (asesorId) {
      for (const convenioId of new Set(suyas.map((p) => p.convenioId))) {
        await this.exigirAsesorDelConvenio(asesorId, convenioId);
      }
    }

    const cambian = suyas.filter((p) => p.asesorId !== asesorId);
    if (cambian.length === 0) {
      return {
        cambiadas: 0,
        fuera: dto.ids.length - suyas.length,
        sinCambio: suyas.length,
      };
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
  async borrarParticipacion(
    id: string,
    ambito: string[],
    actor: Actor,
    ip?: string,
  ) {
    const suyo = await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: {
        etapa: true,
        persona: {
          select: {
            primerNombre: true,
            primerApellido: true,
            numeroDocumento: true,
          },
        },
        _count: { select: { avances: true, notas: true } },
      },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    await this.prisma.$transaction(async (tx) => {
      await tx.avanceActividad.deleteMany({ where: { participanteId: id } });
      await tx.notaParticipante.deleteMany({ where: { participanteId: id } });
      await tx.movimientoParticipante.deleteMany({
        where: { participanteId: id },
      });
      await tx.participante.delete({ where: { id } });
    });

    /// La huella, DESPUÉS de borrar y fuera de la transacción.
    ///
    /// Esto era lo único destructivo del CRM que no dejaba
    /// rastro: se llevaba por delante avances, notas y los
    /// movimientos de etapa —o sea, su propio historial— y
    /// nadie podía decir después quién lo hizo ni a quién.
    /// Preguntar «¿y dónde está Fulano?» no tenía respuesta.
    ///
    /// Fuera de la transacción porque auditar no puede tumbar
    /// el borrado que ya ocurrió, y `registrar()` se traga sus
    /// propios errores por lo mismo.
    ///
    /// El nombre y el documento van en el resumen a propósito:
    /// la ficha ya no existe, así que `entidadId` apunta a
    /// nada. Sin decir de quién era, la huella no sirve. Es la
    /// excepción escrita de la regla de PII, y el motivo es
    /// que sin ella no queda NADA.
    await this.auditoria.registrar({
      actor,
      accion: 'PARTICIPANTE_BORRADO',
      entidad: ENTIDADES.PARTICIPANTE,
      entidadId: id,
      convenioId: suyo?.convenioId ?? null,
      resumen:
        `Se borró la participación de ${p.persona.primerNombre} ` +
        `${p.persona.primerApellido} (doc. ${taparDocumento(p.persona.numeroDocumento)}), ` +
        `que estaba en etapa ${p.etapa}. Con ella se fueron ` +
        `${p._count.avances} avances y ${p._count.notas} notas.`,
      ip,
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
  private async exigirQueQuepa(
    p: {
      id: string;
      ofertaId: string | null;
      coberturaId: string | null;
    },
    /// `exigirVentana` distingue entrar de VOLVER.
    ///
    /// La ventana de inscripcion cierra una semana habil ANTES
    /// de que el grupo arranque, asi que un grupo en curso
    /// siempre la tiene cerrada. A quien vuelve al aula hay que
    /// pedirle cupo -- al retirarse libero su silla -- pero no
    /// una ventana que no puede estar abierta: seria negarle el
    /// regreso siempre, y con el, el paso por «En formacion»
    /// que hay que dar antes de certificarlo.
    { exigirVentana = true }: { exigirVentana?: boolean } = {},
  ) {
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
    /// La suya, y si no, la de la RESERVA que la trajo.
    ///
    /// Es la misma regla que ya usan el F7 y el reporte al SEP
    /// -- `p.empresa ?? p.reserva?.empresa` --, y aqui faltaba.
    /// Habia TRES reglas para «cual es la empresa de esta
    /// persona» y la compuerta usaba la mas estrecha: quien
    /// llego por la reserva de una empresa --que es el camino
    /// principal, una empresa aparta N cupos y despues nomina a
    /// su gente-- no se podia matricular, con el mensaje «no se
    /// puede reportar al SENA», que ademas es FALSO: el reporte
    /// si la resuelve por la reserva.
    const conEmpresa = await this.prisma.participante.findUnique({
      where: { id: p.id },
      select: {
        persona: { select: { numeroDocumento: true } },
        empresa: { select: CAMPOS_DE_EMPRESA },
        reserva: { select: { empresa: { select: CAMPOS_DE_EMPRESA } } },
      },
    });

    // la suya manda: si dijo donde trabaja de verdad, vale eso
    const empresa = conEmpresa?.empresa ?? conEmpresa?.reserva?.empresa ?? null;

    const faltaEmpresa = this.faltaDeLaEmpresa(
      empresa,
      conEmpresa?.persona.numeroDocumento,
    );

    if (faltaEmpresa.length > 0) {
      throw new BadRequestException(
        empresa
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

    /// La ventana se comprueba en DOS sitios, y la exencion
    /// tiene que cubrir los dos.
    ///
    /// Aqui llega antes, dentro de `admiteInscripciones`, que
    /// junta cuatro razones distintas en un booleano. La
    /// primera version solo apago la de mas abajo, asi que el
    /// regreso al aula seguia muriendo aqui con «Se cerró la
    /// ventana de inscripción de todos los grupos» -- y con el,
    /// certificar a quien volvio, porque hay que pasar por «En
    /// formacion». La regla se bloqueaba a si misma otra vez.
    ///
    /// Se exime SOLO de la ventana: que la oferta este llena o
    /// cerrada sigue bloqueando a quien vuelve, porque su silla
    /// se libero al retirarse y esta pidiendo una nueva.
    const soloLaVentana =
      panel.motivo === 'VENTANA_CERRADA' || panel.motivo === 'SIN_FECHAS';
    if (!panel.admiteInscripciones && !(soloLaVentana && !exigirVentana)) {
      throw new BadRequestException(
        panel.porQueNo ?? 'No se puede inscribir en esta oferta.',
      );
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
                g.ventana.estado === 'ABIERTA' ||
                g.ventana.estado === 'AVISANDO',
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
      throw new BadRequestException(
        'Ese grupo no es de esta acción de formación.',
      );
    }
    if (suyo.ventana.estado === 'SIN_FECHAS') {
      throw new BadRequestException(
        `El grupo ${suyo.numero} no tiene fecha de inicio. Sin fecha no se puede inscribir: ` +
          'el cronograma es lo que después lo lleva al aula.',
      );
    }
    if (exigirVentana && suyo.ventana.estado === 'CERRADA') {
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

  /**
   * Revoca la autorización de tratamiento de datos.
   *
   * `revocadaEn` se leía en SIETE consultas —la ficha, la
   * compuerta de matrícula, el alistamiento del SEP, el propio
   * reporte— y no se escribía en NINGUNA: la columna existía,
   * el índice existía, todo lo de abajo la honraba, y no había
   * puerta. O sea que el sistema decía poder demostrar la
   * autorización y era incapaz de honrar su revocación, que es
   * el otro lado del mismo artículo (Ley 1581, art. 8).
   *
   * NO se borra la fila. Una revocación es un hecho nuevo, no
   * una enmienda: hay que poder decir que hubo autorización
   * desde tal día hasta tal otro. Es el mismo criterio de las
   * notas, que tampoco se borran.
   *
   * Y se marcan TODAS las vivas de ese convenio, no una: si por
   * lo que sea hay dos, dejar una viva deja a la persona dentro
   * del reporte, que es exactamente lo que pidió que no pasara.
   */
  async revocarAutorizacion(
    id: string,
    dto: RevocarAutorizacionDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    await this.exigirParticipante(id, ambito);

    const p = await this.prisma.participante.findUnique({
      where: { id },
      select: { id: true, personaId: true, convenioId: true, etapa: true },
    });
    if (!p) throw new NotFoundException('Ese participante no existe.');

    const vivas = await this.prisma.autorizacionDatos.findMany({
      where: {
        personaId: p.personaId,
        revocadaEn: null,
        politica: { convenioId: p.convenioId },
      },
      select: { id: true },
    });

    if (vivas.length === 0) {
      throw new BadRequestException(
        'Esta persona no tiene una autorización vigente en este convenio.',
      );
    }

    const cuando = new Date();

    await this.prisma.$transaction([
      this.prisma.autorizacionDatos.updateMany({
        where: { id: { in: vivas.map((a) => a.id) } },
        data: { revocadaEn: cuando },
      }),
      /// Queda en el historial de la ficha, con quién lo hizo.
      ///
      /// La etapa no cambia: revocar no es salirse del proceso,
      /// y decidir por la persona que se retira seria poner en
      /// su boca algo que no dijo. Lo que si pasa es que deja
      /// de poder matricularse y sale del reporte, y eso lo
      /// hacen solas las consultas que ya leian la columna.
      this.prisma.movimientoParticipante.create({
        data: {
          participanteId: id,
          etapaAntes: p.etapa,
          etapaDespues: p.etapa,
          motivo: null,
          nota:
            `Revocó la autorización de tratamiento de datos ` +
            `(${dto.canal}): ${dto.motivo}`,
          adminId: admin.id,
          ip: ip ?? null,
        },
      }),
    ]);

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'REVOCAR_AUTORIZACION',
      entidad: ENTIDADES.PERSONA,
      entidadId: p.personaId,
      convenioId: p.convenioId,
      /// El canal y cuantas, NO el motivo.
      ///
      /// El motivo es texto libre y puede traer datos de la
      /// persona; la auditoria no debe ser una segunda copia de
      /// la PII. Queda entero en el movimiento de la ficha, que
      /// es donde vive lo que hay que poder demostrar.
      resumen: `Revocó ${vivas.length} autorización(es) · ${dto.canal}`,
      ip,
    });

    return this.obtener(id, ambito);
  }

  async cambiarEtapa(
    id: string,
    dto: CambiarEtapaDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
    cierran: string[] = [],
    muevenInscrito: string[] = [],
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

    /// Poner la etapa que ya tiene no es una transicion.
    ///
    /// Va ANTES de todo: `CERTIFICADO -> CERTIFICADO` no es
    /// «certificar a alguien que salio del aula», es no hacer
    /// nada, y contestarle con ese mensaje seria mentir sobre lo
    /// que pasa.
    if (p.etapa === dto.etapa) return this.obtener(id, ambito);

    /// Ya inscrito: de aqui no lo mueve un gestor.
    ///
    /// Inscribir es el punto de no retorno: a partir de ahi la
    /// persona cuenta en el cupo, entra en el reporte al SENA y
    /// le llegan las citaciones. Sacarla no es corregir un
    /// tecleo, es deshacer algo que ya salio del sistema.
    ///
    /// Va en el SERVIDOR y no en el boton: esconder el boton es
    /// comodidad, y quien tenga la pantalla abierta desde antes
    /// --o llame a la API-- se la salta.
    /// «Deshacer» es SALIR DEL CUPO, no moverse desde INSCRITO.
    ///
    /// Con `dto.etapa !== 'INSCRITO'` tambien caia
    /// `INSCRITO → EN_FORMACION`, que es el ingreso tardio: no
    /// deshace nada, las dos ocupan silla y la persona sigue en
    /// el cupo y en el reporte. Lo cazo `cambiar-etapa.spec.ts`.
    if (
      saleDelCupo(p.etapa, dto.etapa) &&
      !muevenInscrito.includes(p.convenioId)
    ) {
      throw new ForbiddenException(
        'Esta persona ya esta inscrita. Sacarla de ahi la quita del cupo y ' +
          'del reporte al SENA, asi que lo hace un lider. Pidalo con el ' +
          'motivo y queda registrado.',
      );
    }

    /// Primero: ¿es este paso un paso? Ver `escalera.ts`.
    ///
    /// Va ANTES del cupo, y el orden importa. `CERTIFICADO`
    /// ocupa silla, asi que `exigeCupo` es cierto viniendo de
    /// una salida del aula y `exigirQueQuepa` contestaba con un
    /// error de cupos a quien intentaba `RETIRADO -> CERTIFICADO`
    /// -- tapando justo el mensaje que dice como hacerlo bien,
    /// que es para lo que existe esta regla.

    const imposible = motivoDeTransicionImposible(p.etapa, dto.etapa);
    if (imposible) throw new BadRequestException(imposible);

    const compuerta = exigeDatosParaElAula(p.etapa, dto.etapa);
    if (exigeCupo(p.etapa, dto.etapa)) {
      await this.exigirQueQuepa(p, {
        exigirVentana: !esRegresoAlAula(p.etapa),
      });
    }

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
    if (
      CIERRES_DE_FORMACION.includes(dto.etapa) &&
      !cierran.includes(p.convenioId)
    ) {
      throw new ForbiddenException(
        'Cerrar una formación (certificar o dar por no aprobado) es del líder ' +
          'del área académica.',
      );
    }
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

    /**
     * El candado del aforo.
     *
     * `exigirQueQuepa` mira las sillas y las escribe DESPUÉS, en otra
     * consulta. Entre lo uno y lo otro cabe otro asesor haciendo lo
     * mismo: los dos ven la última silla libre y los dos entran. Las
     * reservas ya se protegían así (`bloquearOferta`, con `FOR UPDATE`);
     * inscribir no.
     *
     * Se vuelve a contar aquí dentro, con la fila de la oferta tomada,
     * de modo que el segundo espera al primero y ve el sitio ya lleno.
     * La comprobación de arriba se queda: falla antes y con mejores
     * mensajes. Esta es la que no se puede saltar.
     */
    const cuentaSillas = exigeCupo(p.etapa, dto.etapa) && p.ofertaId !== null;

    await this.prisma.$transaction(async (tx) => {
      if (cuentaSillas) {
        await tx.$queryRaw`SELECT "id" FROM "ofertas" WHERE "id" = ${p.ofertaId} FOR UPDATE`;

        if (p.coberturaId) {
          const [cobertura, dentro] = await Promise.all([
            tx.grupoCobertura.findUnique({
              where: { id: p.coberturaId },
              select: { cuposMaximos: true, grupo: { select: { numero: true } } },
            }),
            tx.participante.count({
              where: {
                coberturaId: p.coberturaId,
                etapa: { in: OCUPAN_SILLA },
                id: { not: id },
              },
            }),
          ]);
          if (cobertura && dentro >= cobertura.cuposMaximos) {
            throw new BadRequestException(
              `El grupo ${cobertura.grupo.numero} se acaba de llenar ` +
                `(${dentro} de ${cobertura.cuposMaximos}). Elija otro grupo.`,
            );
          }
        }
      }

      await tx.participante.update({
        where: { id },
        data: {
          etapa: dto.etapa,
          motivoSalida: ETAPAS_CON_MOTIVO.includes(dto.etapa)
            ? dto.motivo
            : undefined,
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
          fechaMatricula:
            compuerta && !p.fechaMatricula ? new Date() : undefined,
          fechaCertificacion:
            dto.etapa === 'CERTIFICADO' && !p.fechaCertificacion
              ? new Date()
              : undefined,
          // el retiro NO: es la fecha del retiro vigente, y
          // va con su motivo, que si se sobrescribe. Fijarla
          // dejaba la fecha de marzo con el motivo de agosto
          fechaRetiro: dto.etapa === 'RETIRADO' ? new Date() : undefined,
        },
      });

      await tx.movimientoParticipante.create({
        data: {
          participanteId: id,
          etapaAntes: p.etapa,
          etapaDespues: dto.etapa,
          motivo: dto.motivo ?? null,
          adminId: admin.id,
          ip: ip ?? null,
        },
      });
    });

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'ETAPA_CAMBIADA',
      entidad: ENTIDADES.PARTICIPANTE,
      entidadId: id,
      convenioId: p.convenioId,
      resumen: `${p.etapa} → ${dto.etapa}${dto.motivo ? `: ${dto.motivo}` : ''}`,
      ip,
    });

    /// Al entrar a INSCRITO se completan los datos de su empresa: si es
    /// NIT va a la cola del buscador web, y si es persona natural se
    /// propone con reglas fijas, sin buscar nada.
    ///
    /// Va FUERA de la transaccion y no puede tumbar el cambio de etapa.
    /// Completar la ficha es un complemento, no un requisito: si a la
    /// empresa le faltan los 3 datos de contacto, o no tiene empresa, el
    /// disparador se queja y aqui solo queda anotado. Bloquear la
    /// inscripcion por eso seria una regla de negocio nueva, y no es la
    /// que hay hoy.
    ///
    /// Llegar aqui ya implica que es una transicion real: poner la etapa
    /// que ya se tenia sale mucho antes.
    if (dto.etapa === EtapaParticipante.INSCRITO) {
      try {
        await this.disparador.alInscribir(id);
      } catch (e) {
        this.log.warn(
          `Participante ${id} paso a INSCRITO, pero no se disparo la ` +
            `validacion de su empresa: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return this.obtener(id, ambito);
  }

  async agregarNota(
    id: string,
    dto: CrearNotaDto,
    admin: Admin,
    ambito: string[],
  ) {
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
        resultado: dto.resultado,
      },
    });

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'NOTA_CREADA',
      entidad: ENTIDADES.PARTICIPANTE,
      entidadId: id,
      // el resultado va aqui: sin el, la auditoria no
      // distingue un intento de una conversacion
      resumen: `Gestión por ${[...dto.canales].sort().join(' + ')} · ${dto.resultado}`,
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
    if (!propuesta)
      throw new NotFoundException('No hay nada pendiente de decidir.');

    const campos = propuesta.campos as Record<string, unknown>;
    const desconocido = aceptados.find((c) => !(c in campos));
    if (desconocido) {
      throw new BadRequestException(
        `«${desconocido}» no está en esa propuesta.`,
      );
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
        data[campo] =
          campo === 'fechaNacimiento' && typeof v === 'string'
            ? new Date(v)
            : v;
      }
      await this.prisma.persona.update({
        where: { id: p.personaId },
        data: data,
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
      entidad: ENTIDADES.PARTICIPANTE,
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
        participante: ambito.length
          ? { convenioId: { in: ambito } }
          : undefined,
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
    if (!p)
      return {
        bloquean: ['el participante no existe'],
        avisan: [],
        reporte: [],
      };

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
      let estado: 'NUEVA' | 'PERSONA_CONOCIDA' | 'REPETIDA' | 'DESCARTADA' =
        'NUEVA';

      if (esInsalvable(f)) {
        estado = 'DESCARTADA';
      } else if (repes.has(clave)) {
        estado = 'REPETIDA';
        problemas.push(
          'el mismo documento aparece más de una vez en lo pegado',
        );
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

    const creables = previa.filter(
      (f) => f.estado !== 'DESCARTADA' && f.estado !== 'REPETIDA',
    );

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
  async confirmarCarga(
    dto: CargaDto,
    admin: Admin,
    ambito: string[],
    ip?: string,
  ) {
    this.exigirConvenio(dto.convenioId, ambito);

    const previa = await this.previsualizarCarga(dto, ambito);
    const permitidas = dto.lineas ? new Set(dto.lineas) : null;

    const aCrear = previa.filas.filter(
      (f) =>
        f.estado !== 'DESCARTADA' &&
        f.estado !== 'REPETIDA' &&
        (!permitidas || permitidas.has(f.linea)),
    );

    /// El registro se abre ANTES de crear a nadie.
    ///
    /// Si se abriera al final, una importacion que se caiga a
    /// la mitad no dejaria rastro -- y es justo la que hay que
    /// poder mirar. El historico existe para saber que paso, no
    /// solo lo que salio bien.
    const carga = await this.prisma.cargaDeParticipantes.create({
      data: {
        convenioId: dto.convenioId,
        ofertaId: dto.ofertaId ?? null,
        adminId: admin.id,
        // congelado, como el autor de una nota
        autor: admin.nombre,
        origen: dto.origenDeCarga ?? 'PEGADO',
        nombreArchivo: dto.nombreArchivo ?? null,
        filas: previa.total,
        yaExistian: previa.conocidas,
        duplicados: previa.repetidas,
        descartados: previa.descartadas,
        ip: ip ?? null,
      },
    });

    let creados = 0;
    const nuevos: string[] = [];
    const fallos: Array<{ linea: number; motivo: string }> = [];

    // una a una: un fallo no debe tumbar las 39 buenas
    for (const f of aCrear) {
      try {
        const hecho = await this.crear(
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
        if (hecho?.id) nuevos.push(hecho.id);
      } catch (e) {
        fallos.push({
          linea: f.linea,
          motivo: e instanceof Error ? e.message : 'error desconocido',
        });
      }
    }

    /// De una sola vez y no dentro de `crear`: asi la firma de
    /// la unica puerta que crea gente no cambia por esto.
    if (nuevos.length) {
      await this.prisma.participante.updateMany({
        where: { id: { in: nuevos } },
        data: { cargaId: carga.id },
      });
    }

    await this.prisma.cargaDeParticipantes.update({
      where: { id: carga.id },
      data: { creados, fallidos: fallos.length },
    });

    return { creados, fallos, intentadas: aCrear.length, cargaId: carga.id };
  }

  /** El historico de importaciones del ambito. */
  async cargas(ambito: string[], convenioId?: string) {
    /// El filtro pedido se INTERSECA con el ambito, nunca lo
    /// sustituye: pedir un convenio de fuera devuelve vacio, no
    /// el de otro gremio.
    const convenios = convenioId
      ? ambito.filter((c) => c === convenioId)
      : ambito;
    if (!convenios.length) return [];

    const filas = await this.prisma.cargaDeParticipantes.findMany({
      where: { convenioId: { in: convenios } },
      orderBy: { creadoEn: 'desc' },
      take: 100,
      select: {
        id: true,
        creadoEn: true,
        autor: true,
        origen: true,
        nombreArchivo: true,
        filas: true,
        creados: true,
        yaExistian: true,
        duplicados: true,
        descartados: true,
        fallidos: true,
        convenio: { select: { sigla: true, nombre: true } },
        oferta: {
          select: {
            ubicacion: { select: { nombre: true } },
            accionFormacion: { select: { codigo: true, nombre: true } },
          },
        },
      },
    });

    return filas.map((f) => ({
      ...f,
      convenio: f.convenio.sigla ?? f.convenio.nombre,
      /// El curso al que fue la importacion, ya escrito: la
      /// pantalla no tiene por que rearmar la etiqueta.
      destino: f.oferta
        ? `${f.oferta.accionFormacion.codigo} · ${f.oferta.ubicacion.nombre}`
        : null,
      oferta: undefined,
    }));
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
          select: {
            primerNombre: true,
            primerApellido: true,
            numeroDocumento: true,
          },
        },
        accionFormacion: { select: { id: true, codigo: true, nombre: true } },
        asesor: { select: { id: true, nombre: true } },
        cobertura: {
          select: {
            grupoId: true,
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
        avances: {
          select: {
            estado: true,
            actividad: {
              select: {
                obligatoria: true,
                publicada: true,
                accionFormacionId: true,
              },
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
    const totalDe = new Map(
      obligatorias.map((a) => [a.accionFormacionId, a._count._all]),
    );

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
        transcurrido = Math.min(
          1,
          Math.max(0, (ahora - inicio) / (fin - inicio)),
        );
      }

      const esperadas =
        transcurrido === null ? null : Math.round(total * transcurrido);
      const desfase = esperadas === null ? null : hechas - esperadas;

      const diasSinEntrar = p.ultimoAcceso
        ? Math.floor((ahora - p.ultimoAcceso.getTime()) / 86_400_000)
        : null;

      // el 80% de lo obligatorio: es lo que habilita a
      // certificar, y se mide contra el total del curso,
      // no contra lo que tocaria a estas alturas
      const porcentaje = total > 0 ? hechas / total : 0;
      const listoParaCertificar =
        total > 0 && porcentaje >= MINIMO_PARA_CERTIFICAR;

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

  /**
   * Donde vive, en los nombres con que se llaman las
   * ubicaciones de los grupos.
   *
   * La persona guarda codigos del DANE; las ubicaciones,
   * nombres. La traduccion va aqui y no en la comparacion,
   * para que la regla de cobertura se pueda probar sola.
   */
  private async dondeVive(participanteId: string) {
    const p = await this.prisma.participante.findUnique({
      where: { id: participanteId },
      select: {
        persona: { select: { departamentoSepId: true, municipioSepId: true } },
      },
    });

    const dep = p?.persona.departamentoSepId;
    const mun = p?.persona.municipioSepId;

    return {
      departamento: dep
        ? (DEPARTAMENTO_POR_ID.get(dep)?.etiqueta ?? null)
        : null,
      // el municipio es una tupla [id, depto, nombre, ...]
      ciudad: mun ? (MUNICIPIO_POR_ID.get(mun)?.[2] ?? null) : null,
    };
  }

  /** Ofertas y grupos donde se puede colocar a alguien. */
  async opciones(
    convenioId: string,
    ambito: string[],
    participanteId?: string,
  ) {
    this.exigirConvenio(convenioId, ambito);

    /// Donde vive la persona a la que se le va a asignar.
    ///
    /// Con esto se le ofrecen SOLO los grupos que la cubren.
    /// Ofrecerle a alguien de Bogota un grupo de Medellin no
    /// es una opcion: es un error esperando a que alguien lo
    /// cometa con prisa. Y cuando se comete no se nota -- la
    /// ficha queda con grupo -- hasta el dia que la persona
    /// no llega al curso.
    const vive = participanteId
      ? await this.dondeVive(participanteId)
      : { departamento: null, ciudad: null };

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
        /// `tipo` y `departamento` ademas del nombre: son lo
        /// que necesita `cubreA` para decidir si esta sede
        /// llega a donde vive la persona. Con solo el nombre no
        /// se puede distinguir un grupo departamental de uno
        /// de ciudad, que es justo la diferencia que importa.
        ubicacion: { select: { nombre: true, tipo: true, departamento: true } },
        accionFormacion: { select: { id: true, codigo: true, nombre: true } },
        _count: {
          select: { participantes: { where: { etapa: { in: ETAPAS_VIVAS } } } },
        },
      },
    });

    const grupos = await this.prisma.grupoCobertura.findMany({
      where: { grupo: { accionFormacion: { convenioId } } },
      orderBy: [{ grupo: { numero: 'asc' } }],
      select: {
        id: true,
        cuposBase: true,
        modalidad: true,
        ubicacion: { select: { nombre: true, tipo: true, departamento: true } },
        grupo: {
          select: {
            numero: true,
            fechaInicio: true,
            fechaFin: true,
            horario: true,
            accionFormacionId: true,
          },
        },
        _count: {
          select: { participantes: { where: { etapa: { in: ETAPAS_VIVAS } } } },
        },
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
            rol: {
              in: ['GESTOR_INSCRIPCION', 'LIDER_INSCRIPCION', 'LIDER_SISTEMAS'],
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, correo: true },
    });

    const { cubren, fuera } = repartirPorCobertura(grupos, vive);

    /// LAS ACCIONES DE FORMACION, una por una y ya resueltas.
    ///
    /// `ofertas` es la tabla cruda: accion x sede. Como una
    /// accion se oferta en seis departamentos, la pantalla
    /// enseñaba AF1 seis veces y el asesor tenia que saber cual
    /// le tocaba a esta persona. Eso no es una decision suya:
    /// se deduce de donde vive.
    ///
    /// Aqui se colapsa a UNA fila por accion, con la sede que
    /// le corresponde ya elegida. Si no hay ninguna que la
    /// cubra, la fila sale igual con `cubre: false` -- no se
    /// esconde. Esconderla dejaria al asesor sin saber por que
    /// falta un curso que sabe que existe, y lo que hay que
    /// decirle es justo lo contrario: que ese curso no llega a
    /// su departamento y que corresponde agradecerle.
    const porAccion = new Map<string, (typeof ofertas)[number][]>();
    for (const o of ofertas) {
      const lista = porAccion.get(o.accionFormacion.id) ?? [];
      lista.push(o);
      porAccion.set(o.accionFormacion.id, lista);
    }

    const acciones = [...porAccion.entries()].map(([accionFormacionId, suyas]) => {
      /// Las que llegan a donde vive. Puede haber mas de una
      /// —una ciudad y su departamento, o una virtual—, y
      /// entonces manda la que MAS cupo libre tenga: es la
      /// unica desempate que no perjudica a nadie.
      const alcanzan = suyas
        .filter((o) => cubreA({ tipo: o.ubicacion.tipo, nombre: o.ubicacion.nombre, departamento: o.ubicacion.departamento }, vive))
        .sort(
          (a, b) =>
            b.cuposMaximos -
            b._count.participantes -
            (a.cuposMaximos - a._count.participantes),
        );

      const elegida = alcanzan[0] ?? null;
      const primera = suyas[0];

      return {
        accionFormacionId,
        codigo: primera.accionFormacion.codigo,
        nombre: primera.accionFormacion.nombre,
        etiqueta: `${primera.accionFormacion.codigo} · ${primera.accionFormacion.nombre}`,
        /// La oferta que le toca a ESTA persona. Null cuando su
        /// departamento no tiene cobertura.
        ofertaId: elegida?.id ?? null,
        ubicacion: elegida?.ubicacion.nombre ?? null,
        cupos: elegida?.cuposMaximos ?? 0,
        disponibles: elegida
          ? Math.max(0, elegida.cuposMaximos - elegida._count.participantes)
          : 0,
        abierta: elegida?.abierta ?? false,
        cubre: elegida !== null,
        /// En cuantas sedes se dicta, para poder decir «se
        /// dicta en 6 departamentos, ninguno el suyo».
        sedes: suyas.length,
      };
    });

    return {
      asesores,
      acciones,
      /// Cuantos se dejaron fuera por vivir en otra parte. Una
      /// lista que se acorta sola sin decir por que parece un
      /// sistema roto.
      gruposFueraDeCobertura: fuera,
      domicilio: vive,
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
      grupos: cubren.map((g) => ({
        id: g.id,
        accionFormacionId: g.grupo.accionFormacionId,
        /// La ubicacion, SUELTA y no solo dentro de la
        /// etiqueta.
        ///
        /// Hace falta para que la pantalla pueda casar el
        /// grupo con la OFERTA elegida. Sin esto solo se podia
        /// filtrar por accion de formacion, y como la misma
        /// accion se oferta en seis departamentos, elegir la
        /// de Bogota sacaba los grupos de todos ellos.
        ubicacion: g.ubicacion.nombre,
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
        /// Suelto, para poder exigir que el grupo sea de ESTA sede.
        ubicacionId: true,
        abierta: true,
        ubicacion: { select: { nombre: true } },
        accionFormacion: {
          select: { convenioId: true, codigo: true, nombre: true },
        },
      },
    });
    if (!oferta) throw new NotFoundException('Esa oferta no existe.');

    /**
     * Una oferta cerrada está cerrada también para el asesor.
     *
     * El interruptor existía y solo lo miraba el catálogo público
     * (`catalogo.service.ts`): en el CRM se leía únicamente para
     * pintarlo en pantalla, nunca para bloquear. Se podía cerrar una
     * oferta, dejar de ofrecerla a la calle, y seguir metiéndole gente
     * desde dentro.
     *
     * Se cierra volviendo a abrirla, a propósito: que quede el rastro
     * de quién la reabrió y no una excepción silenciosa por ficha.
     */
    if (!oferta.abierta) {
      throw new BadRequestException(
        `«${oferta.accionFormacion.codigo}» está cerrada en ${oferta.ubicacion.nombre}. ` +
          'Para inscribir aquí hay que volver a abrirla.',
      );
    }

    if (oferta.accionFormacion.convenioId !== p.convenioId) {
      throw new BadRequestException('Esa oferta es de otro convenio.');
    }

    /// LA COBERTURA SE COMPRUEBA AQUI, no solo en la pantalla.
    ///
    /// Un control que solo vive en el navegador no es un
    /// control: la ruta se puede llamar directamente. Si esta
    /// sede no llega a donde vive la persona, no se le asigna
    /// -- y el mensaje dice que hacer en su lugar, porque
    /// negarse sin decir para donde no sirve de nada.
    const vive = await this.dondeVive(id);
    const sede = await this.prisma.oferta.findUnique({
      where: { id: dto.ofertaId },
      select: {
        ubicacion: { select: { nombre: true, tipo: true, departamento: true } },
      },
    });
    if (sede && !cubreA(sede.ubicacion, vive)) {
      const donde =
        [vive.ciudad, vive.departamento].filter(Boolean).join(', ') ||
        'su domicilio';
      throw new BadRequestException(
        `«${oferta.accionFormacion.codigo}» se dicta en ${sede.ubicacion.nombre}, ` +
          `que no cubre ${donde}. No se puede inscribir a esta persona en esa ` +
          'accion: corresponde escribirle un correo de agradecimiento.',
      );
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
      where: {
        ofertaId: oferta.id,
        etapa: { in: ETAPAS_VIVAS },
        id: { not: id },
      },
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
      const cobertura = await exigirCoberturaDeLaOferta(this.prisma, dto.coberturaId, {
        accionFormacionId: oferta.accionFormacionId,
        ubicacionId: oferta.ubicacionId,
      });
      numeroDeGrupo = cobertura.numero;
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
      where: {
        personaId: p.personaId,
        politicaDatosId: politica.id,
        revocadaEn: null,
      },
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
    /// Devuelve el convenio: quien audita después necesita
    /// saber de qué gremio era, y volver a consultarlo sería
    /// preguntar dos veces lo mismo.
    return p;
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
          {
            persona: {
              primerNombre: { contains: buscar, mode: 'insensitive' },
            },
          },
          {
            persona: {
              segundoNombre: { contains: buscar, mode: 'insensitive' },
            },
          },
          {
            persona: {
              primerApellido: { contains: buscar, mode: 'insensitive' },
            },
          },
          {
            persona: {
              segundoApellido: { contains: buscar, mode: 'insensitive' },
            },
          },
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
    const puestos = [
      e.direccion,
      e.telefono,
      e.sectorEconomico,
      e.clasificacion,
    ].filter((v) => v !== null && v !== '').length;
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
    /// Cuando se hablo con ella por ultima vez. Nulo = nunca.
    ultimoContacto: Date | null;
    /// Intentos que no llegaron a nadie.
    sinRespuesta: number;
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
      datos:
        falta.length === 0 ? ('COMPLETOS' as const) : ('PARCIALES' as const),
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
      /// Nulo = no se ha hablado con ella nunca.
      ultimoContacto: p.ultimoContacto,
      sinRespuesta: p.sinRespuesta,

      // --- lo que la tabla de leads pide aparte ---
      tipoDocumento: siglaDocumento(p.persona.tipoDocumentoSepId),
      numeroDocumento: p.persona.numeroDocumento,
      /// Donde vive, no donde se dicta: `ubicacion` es la sede.
      departamento: p.persona.departamentoSepId
        ? (DEPARTAMENTO_POR_ID.get(p.persona.departamentoSepId)?.etiqueta ??
          null)
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
