/** Fichas de mentira para las pruebas del reporte al SEP. */

/**
 * NO ES UN DOBLE QUE DEVUELVE LO QUE SE LE PIDE: devuelve filas.
 *
 * Las pruebas de este reporte venían siendo de dos clases: o leían el
 * fichero fuente ---`caracterizacion-amparada.spec.ts`, que fija la
 * CONSULTA porque es lo único que distingue «filtra» de «trae todo y
 * ya veremos»--- o probaban una función pura.
 *
 * Lo que no había forma de probar era el MEDIO: a quién deja fuera
 * `preparar`, y con cuántos beneficiarios sale cada empresa en el F7.
 * Y ahí estaba el defecto gordo: el F7 contaba 3 donde el cargue
 * mandaba 2, porque cada uno tenía su propia consulta con su propio
 * filtro. Un doble que solo devuelva filas basta para fijarlo, porque
 * lo que se mide es la DECISIÓN que se toma sobre esas filas.
 *
 * El doble ignora `where` y `orderBy` a propósito: eso lo hace
 * Postgres y no se simula aquí. Por eso las pruebas de orden le pasan
 * las filas DESORDENADAS —es el peor caso real, el que se da cuando
 * el empate deja el orden en manos del motor— y comprueban que lo que
 * sale no depende de cómo entró.
 */

import type { PrismaService } from '../../prisma/prisma.service';

/** Una organización con TODO lo que el F7 le pide. */
export function empresaCompleta(
  id: string,
  razonSocial: string,
  nit: string,
  cambios: Record<string, unknown> = {},
) {
  return {
    id,
    nit,
    razonSocial,
    digitoVerificacion: '7',
    numeroColaboradores: 20,
    redAsociada: null,
    redAsociadaOtra: null,
    tamanoSepId: 1,
    tipoDocumentoSepId: 3,
    direccion: 'Calle 10 # 4-20',
    telefono: '6041234567',
    // 5 = ANTIOQUIA, y el municipio es de ese departamento
    departamentoSepId: 5,
    municipioSepId: 5001,
    sectorEconomico: 'Manufactura',
    numeroTrabajadores: 320,
    papelEnConvenio: 'Beneficiaria',
    clasificacion: 'Privada',
    contactoNombre: 'Marta Oquendo',
    contactoCargo: 'Jefa de talento',
    contactoCorreo: 'marta@ejemplo.test',
    institucionId: null,
    creadoEn: new Date('2026-01-01T00:00:00Z'),
    actualizadoEn: new Date('2026-01-01T00:00:00Z'),
    ...cambios,
  };
}

type Pedido = {
  id: string;
  /// Nombre de la acción de formación: con él se agrupa el F7.
  accion: string;
  empresa: ReturnType<typeof empresaCompleta>;
  /// Las horas del evento. `null` = la acción no las tiene puestas.
  horas?: number | null;
  /// Para romper la ficha a propósito y ver si entra o no.
  persona?: Record<string, unknown>;
};

/**
 * Una participación COMPLETA: entra en el cargue sin quejas.
 *
 * Se parte de que está bien y las pruebas rompen lo que quieren
 * mirar. Al contrario ---partir de una ficha a medias--- cada prueba
 * tendría que rellenar veinte campos y la que importa se escondería
 * entre ellos.
 */
export function participacionCompleta(p: Pedido) {
  const accionId = `af-${p.accion}`;
  return {
    id: p.id,
    etapa: 'INSCRITO',
    cargoEnEmpresa: 'Analista',
    nivelOcupacionalSepId: 3,
    beneficiarioPrevio: false,
    fechaMatricula: new Date('2026-02-01T00:00:00Z'),
    ofertaId: 'oferta-1',
    coberturaId: 'cobertura-1',
    accionFormacionId: accionId,
    personaId: `persona-${p.id}`,
    persona: {
      id: `persona-${p.id}`,
      tipoDocumentoSepId: 1,
      numeroDocumento: `10194567${p.id.replace(/\D/g, '') || '0'}`,
      primerNombre: 'Ana',
      segundoNombre: null,
      primerApellido: 'Restrepo',
      segundoApellido: null,
      // mayor de edad contra la fecha de matrícula, que es con la
      // que el cargue congela la edad
      fechaNacimiento: new Date('1995-05-10T00:00:00Z'),
      correo: 'ana@ejemplo.test',
      celular: '3001112222',
      generoSepId: 2,
      estrato: 2,
      departamentoSepId: 5,
      municipioSepId: 5001,
      barrio: 'Laureles',
      direccion: 'Carrera 70 # 1-10',
      caracterizaciones: [],
      ...p.persona,
    },
    empresa: p.empresa,
    reserva: null,
    accionFormacion: {
      codigo: p.accion,
      nombre: `${p.accion} · Curso de prueba`,
      sepAfId: null,
      horas: p.horas === undefined ? 40 : p.horas,
    },
    cobertura: {
      grupo: {
        numero: 1,
        sepGrupoId: null,
        fechaInicio: new Date('2026-02-01T00:00:00Z'),
        // del MISMO AF: si no, `preparar` la saca con razón
        accionFormacionId: accionId,
      },
    },
  };
}

/**
 * El Prisma de mentira: un convenio, las filas que se le den y una
 * autorización viva por cada persona que aparezca.
 *
 * Las autorizaciones se derivan de las filas en vez de pedirse
 * aparte: lo que estas pruebas miran NO es el consentimiento ---eso
 * ya lo fija `caracterizacion-amparada.spec.ts`--- y una lista suelta
 * que hubiera que mantener al día dejaría a cualquiera fuera del
 * reporte por un descuido de la prueba, no del código.
 */
export function prismaDelReporte(
  filas: Array<ReturnType<typeof participacionCompleta>>,
  /// Los `id` de participación cuya persona REVOCÓ: su autorización
  /// no se devuelve, que es lo que ve el servicio.
  revocaron: string[] = [],
): PrismaService {
  const doble = {
    convenio: {
      findUnique: async () => ({
        id: 'convenio-1',
        nombre: 'Convenio de prueba',
        sigla: 'CP',
        sepProyectoId: null,
        sepNombreConviniente: null,
      }),
    },
    participante: { findMany: async () => filas },
    autorizacionDatos: {
      findMany: async () =>
        filas
          .filter((f) => !revocaron.includes(f.id))
          .map((f) => ({ personaId: f.personaId })),
    },
  };
  return doble as unknown as PrismaService;
}
