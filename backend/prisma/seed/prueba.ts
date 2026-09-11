/** Datos inventados para el entorno de pruebas. */

import {
  AccionMovimiento,
  CanalAutorizacion,
  DestinatarioPolitica,
  EstadoAvance,
  EstadoReserva,
  EtapaParticipante,
  OrigenParticipante,
  PrismaClient,
  RolAdmin,
  RolConvenio,
  TipoActividad,
  TipoPregunta,
} from '../../generated/prisma';
import { hashearClave } from '../../src/admin/claves';
import {
  CARACTERIZACIONES_SEP,
  DEPARTAMENTOS_SEP,
  DOCUMENTOS_DE_PERSONA,
  GENEROS_SEP,
  MUNICIPIOS_SEP,
  NIVELES_OCUPACIONALES_SEP,
  TAMANOS_EMPRESA_SEP,
} from '../../src/crm/catalogos-sep';
import { PLANTILLAS, temasDePlantilla } from '../../src/admin/plantillas-tema';
import { conValoresPorDefecto } from '../../src/admin/temas';
import { soloEnPruebas } from './solo-pruebas';

const prisma = new PrismaClient();

const CLAVE_DEMO = 'Prueba2026*';

// ---------------------------------------------------------------------------

// numeros repetibles: dos revisiones ven lo mismo
function generador(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const azar = generador(20260814);
const entre = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
const unoDe = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)];
// nunca al futuro: un "ultimo acceso" por delante de hoy
// da dias negativos en el seguimiento
const hace = (dias: number, horas = 12) =>
  new Date(Math.min(Date.now(), Date.now() - dias * 86_400_000 + horas * 3_600_000));

// ---------------------------------------------------------------------------

const NOMBRES_M = [
  'Andrés', 'Carlos', 'Julián', 'Miguel', 'David', 'Santiago', 'Felipe', 'Ricardo',
  'Óscar', 'Javier', 'Sebastián', 'Mauricio', 'Camilo', 'Diego', 'Jorge', 'Iván',
];
const NOMBRES_F = [
  'Laura', 'Camila', 'Sofía', 'Paula', 'Diana', 'Natalia', 'Ángela', 'Carolina',
  'Mariana', 'Valentina', 'Claudia', 'Adriana', 'Luisa', 'Patricia', 'Juliana', 'Sandra',
];
const SEGUNDOS = ['', '', 'José', 'María', 'Alejandro', 'Isabel', 'Andrea', 'Antonio'];
const APELLIDOS = [
  'Gómez', 'Rodríguez', 'Martínez', 'Pinzón', 'Rojas', 'Torres', 'Herrera', 'Suárez',
  'León', 'Castaño', 'Vargas', 'Beltrán', 'Ospina', 'Quintero', 'Cárdenas', 'Molina',
  'Peña', 'Guerrero', 'Salazar', 'Mendoza', 'Arias', 'Bermúdez', 'Cifuentes', 'Zapata',
];

const EMPRESAS = [
  ['Aceros del Norte S.A.S.', 'BRITCHAM'], ['Textiles La Sabana Ltda.', 'ADEE'],
  ['Agroinsumos del Llano S.A.S.', 'Ninguno'], ['Constructora Vía Verde S.A.', 'BRITCHAM'],
  ['Alimentos Doña Rosa S.A.S.', 'ADEE'], ['Transportes El Cóndor Ltda.', 'Ninguno'],
  ['Plásticos Andinos S.A.S.', 'Ambos'], ['Café de Altura S.A.S.', 'BRITCHAM'],
  ['Metalmecánica Bolívar Ltda.', 'ADEE'], ['Distribuidora El Faro S.A.S.', 'Otro'],
  ['Confecciones Aurora S.A.S.', 'ADEE'], ['Lácteos San Rafael Ltda.', 'Ninguno'],
  ['Maderas del Pacífico S.A.S.', 'BRITCHAM'], ['Servicios Integrales Zafiro S.A.S.', 'Ambos'],
  ['Panificadora La Espiga Ltda.', 'Ninguno'], ['Química Industrial Kairós S.A.', 'BRITCHAM'],
  ['Comercializadora Puerto Azul S.A.S.', 'ADEE'], ['Ingeniería y Montajes Delta Ltda.', 'Otro'],
  ['Avícola El Amanecer S.A.S.', 'Ninguno'], ['Turismo Ruta Dorada S.A.S.', 'BRITCHAM'],
  ['Calzado Prisma S.A.S.', 'ADEE'], ['Refrigeración Polar Ltda.', 'Ninguno'],
  ['Editorial Tinta Viva S.A.S.', 'Ambos'], ['Logística Sur Express S.A.S.', 'BRITCHAM'],
] as const;

/**
 * Qué rol tiene cada quien y en qué convenio. '*' es el
 * mismo rol en los dos. Quien no lleva '*' solo ve los
 * convenios que aparezcan: sin eso el ámbito no se puede
 * comprobar, porque todos verían todo y parecería que
 * funciona. Carlos lleva áreas distintas en cada uno, que
 * es el caso que de verdad prueba el recorte por área.
 */
const CONCESIONES: Record<string, Record<string, RolConvenio>> = {
  'ana.jaramillo@ejemplo.test': { '*': RolConvenio.LIDER_SISTEMAS },
  'carlos.mesa@ejemplo.test': {
    adecopria: RolConvenio.LIDER_INSCRIPCION,
    'britcham-adee': RolConvenio.GESTOR_ACADEMICO,
  },
  'lucia.parra@ejemplo.test': { adecopria: RolConvenio.GESTOR_INSCRIPCION },
  'hector.ramos@ejemplo.test': { 'britcham-adee': RolConvenio.GESTOR_ACADEMICO },
  'marta.oquendo@ejemplo.test': { '*': RolConvenio.LIDER_ACADEMICO },
  'sofia.rendon@ejemplo.test': { '*': RolConvenio.CONSULTA },
  // lider de sistemas SIN ser superadmin: es quien
  // distingue construir un formulario de publicarlo
  'diego.salas@ejemplo.test': { '*': RolConvenio.LIDER_SISTEMAS },
};

const CARGO_DEL_ROL: Record<RolConvenio, string> = {
  LIDER_SISTEMAS: 'Líder de sistemas de información',
  LIDER_INSCRIPCION: 'Líder de inscripciones',
  GESTOR_INSCRIPCION: 'Gestora de inscripciones',
  LIDER_ACADEMICO: 'Líder de seguimiento académico',
  GESTOR_ACADEMICO: 'Gestor de seguimiento académico',
  COUNTRY_MANAGER: 'Country Manager',
  CONSULTA: 'Consulta',
};

const ASESORES = [
  ['ana.jaramillo@ejemplo.test', 'Ana Jaramillo'],
  ['carlos.mesa@ejemplo.test', 'Carlos Mesa'],
  ['lucia.parra@ejemplo.test', 'Lucía Parra'],
  ['hector.ramos@ejemplo.test', 'Héctor Ramos'],
  ['marta.oquendo@ejemplo.test', 'Marta Oquendo'],
  ['sofia.rendon@ejemplo.test', 'Sofía Rendón'],
  ['diego.salas@ejemplo.test', 'Diego Salas'],
] as const;

const CARGOS = [
  'Analista de talento humano', 'Jefe de producción', 'Auxiliar administrativo',
  'Coordinadora de calidad', 'Supervisor de planta', 'Asistente contable',
  'Director comercial', 'Operario', 'Tecnóloga en logística',
];

/// El texto y el resultado van juntos a proposito.
///
/// Sueltos, la siembra sacaba notas que dicen "no contesta"
/// marcadas como contacto logrado. Un dato de mentira puede ser
/// inventado; incoherente consigo mismo, no.
const NOTAS: Array<{
  texto: string;
  resultado: 'CONTACTO' | 'SIN_RESPUESTA' | 'DATO_MALO';
  canales: Array<'CORREO' | 'WHATSAPP' | 'TEXTO' | 'LLAMADA'>;
}> = [
  {
    texto: 'Se llama y confirma interés. Pide que le manden el temario por correo.',
    resultado: 'CONTACTO',
    canales: ['LLAMADA'],
  },
  {
    texto: 'Confirma que puede en jornada de la tarde.',
    resultado: 'CONTACTO',
    canales: ['LLAMADA'],
  },
  {
    texto: 'Se le explica que la formación es gratuita y no exige pago alguno.',
    resultado: 'CONTACTO',
    canales: ['LLAMADA', 'CORREO'],
  },
  {
    texto: 'Contesta por WhatsApp: sigue interesada pero está de vacaciones.',
    resultado: 'CONTACTO',
    canales: ['WHATSAPP'],
  },
  {
    texto: 'Queda de confirmar con su jefe antes del viernes.',
    resultado: 'CONTACTO',
    canales: ['LLAMADA'],
  },
  {
    texto: 'No contesta el celular. Se deja mensaje de voz.',
    resultado: 'SIN_RESPUESTA',
    canales: ['LLAMADA'],
  },
  {
    texto: 'Segundo intento en la mañana, tampoco contesta.',
    resultado: 'SIN_RESPUESTA',
    canales: ['LLAMADA'],
  },
  {
    texto: 'Se le escribe por WhatsApp y no responde.',
    resultado: 'SIN_RESPUESTA',
    canales: ['WHATSAPP'],
  },
  {
    texto: 'Correo devuelto: la empresa dio uno que ya no existe. Se pide otro.',
    resultado: 'DATO_MALO',
    canales: ['CORREO'],
  },
  {
    texto: 'El número marca apagado desde hace días. Se pide otro a la empresa.',
    resultado: 'DATO_MALO',
    canales: ['LLAMADA'],
  },
];

const NOTAS_LOGRADAS = NOTAS.filter((n) => n.resultado === 'CONTACTO');
const NOTAS_FALLIDAS = NOTAS.filter((n) => n.resultado !== 'CONTACTO');

const BARRIOS = [
  'La Candelaria', 'El Poblado', 'Villa del Río', 'San Antonio', 'Los Alcázares',
  'Modelia', 'Cedritos', 'Vereda El Salitre', 'Barrio Obrero', 'Las Acacias',
];

const CALLES = ['Calle', 'Carrera', 'Diagonal', 'Transversal', 'Avenida'];

const MOTIVOS_SALIDA = [
  'No contesta después de cinco intentos en dos semanas.',
  'La empresa retiró el cupo: reasignó al colaborador a otra sede.',
  'Cambió de trabajo y ya no pertenece a la empresa que lo nominó.',
  'Cruce de horario con su turno de producción.',
  'No alcanzó el porcentaje mínimo de asistencia.',
];

/** Los pasos de un curso, iguales para todos sus grupos. */
const ACTIVIDADES: Array<[string, TipoActividad, boolean]> = [
  ['Bienvenida y acuerdos de la formación', TipoActividad.LECCION, false],
  ['Encuesta de caracterización', TipoActividad.ENCUESTA, true],
  ['Unidad 1 — Conceptos fundamentales', TipoActividad.LECCION, true],
  ['Material de apoyo de la unidad 1', TipoActividad.RECURSO, false],
  ['Taller práctico 1', TipoActividad.TAREA, true],
  ['Foro: casos de mi empresa', TipoActividad.FORO, true],
  ['Unidad 2 — Aplicación en el puesto de trabajo', TipoActividad.LECCION, true],
  ['Quiz de la unidad 2', TipoActividad.QUIZ, true],
  ['Taller práctico 2', TipoActividad.TAREA, true],
  ['Unidad 3 — Cierre y buenas prácticas', TipoActividad.LECCION, true],
  ['Evaluación final', TipoActividad.EVALUACION, true],
  ['Encuesta de satisfacción', TipoActividad.ENCUESTA, false],
];

/** Cuántas etapas hay que llenar y con cuánta gente. */
const REPARTO: Array<[EtapaParticipante, number]> = [
  [EtapaParticipante.INTERESADO, 12],
  [EtapaParticipante.CONTACTADO, 15],
  [EtapaParticipante.DATOS_COMPLETOS, 13],
  [EtapaParticipante.INSCRITO, 16],
  [EtapaParticipante.EN_FORMACION, 22],
  [EtapaParticipante.CERTIFICADO, 12],
  [EtapaParticipante.PERDIDO, 5],
  [EtapaParticipante.RETIRADO, 3],
  [EtapaParticipante.NO_APROBO, 2],
  [EtapaParticipante.DESERTO, 3],
  [EtapaParticipante.ABANDONO, 4],
];

/**
 * Quien ya pisó el aula y por tanto tiene avance.
 *
 * Las seis, y tiene que ser las seis: los caminos de
 * DESERTO y ABANDONO pasan por EN_FORMACION, así que el
 * ancla los mete en el tablero. Faltando aquí, entraban
 * sin un solo avance y hundían el avance medio con ceros.
 */
const ETAPAS_EN_AULA: EtapaParticipante[] = [
  EtapaParticipante.EN_FORMACION,
  EtapaParticipante.CERTIFICADO,
  EtapaParticipante.NO_APROBO,
  EtapaParticipante.RETIRADO,
  EtapaParticipante.DESERTO,
  EtapaParticipante.ABANDONO,
];

/** De estas no se sale sin explicar por qué. */
const ETAPAS_SALIDA: EtapaParticipante[] = [
  EtapaParticipante.PERDIDO,
  EtapaParticipante.RETIRADO,
  EtapaParticipante.NO_APROBO,
];

/** Por dónde ha pasado quien está en cada etapa. */
const CAMINO: Record<EtapaParticipante, EtapaParticipante[]> = {
  INTERESADO: ['INTERESADO'],
  CONTACTADO: ['INTERESADO', 'CONTACTADO'],
  DATOS_COMPLETOS: ['INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS'],
  INSCRITO: ['INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS', 'INSCRITO'],
  EN_FORMACION: ['INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS', 'INSCRITO', 'EN_FORMACION'],
  CERTIFICADO: [
    'INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS', 'INSCRITO', 'EN_FORMACION', 'CERTIFICADO',
  ],
  PERDIDO: ['INTERESADO', 'CONTACTADO', 'PERDIDO'],
  // pasa por EN_FORMACION: se le siembran avances, y sin
  // ese movimiento el ancla del aula lo deja fuera
  RETIRADO: [
    'INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS', 'INSCRITO', 'EN_FORMACION', 'RETIRADO',
  ],
  NO_APROBO: [
    'INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS', 'INSCRITO', 'EN_FORMACION', 'NO_APROBO',
  ],
  // aviso / sin aviso: los dos salen del aula
  DESERTO: [
    'INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS', 'INSCRITO', 'EN_FORMACION', 'DESERTO',
  ],
  ABANDONO: [
    'INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS', 'INSCRITO', 'EN_FORMACION', 'ABANDONO',
  ],
};

/** Cómo va cada quien en el aula. */
const RITMOS = [
  { clave: 'AL_DIA', factor: 1.0, peso: 8 },
  { clave: 'JUSTO', factor: 0.75, peso: 6 },
  { clave: 'ATRASADO', factor: 0.4, peso: 5 },
  { clave: 'PARADO', factor: 0.15, peso: 3 },
] as const;

function ritmoAlAzar() {
  const total = RITMOS.reduce((s, r) => s + r.peso, 0);
  let n = azar() * total;
  for (const r of RITMOS) {
    n -= r.peso;
    if (n <= 0) return r;
  }
  return RITMOS[0];
}

// ---------------------------------------------------------------------------

async function borrarLoSembrado() {
  // orden inverso a las dependencias
  await prisma.avanceActividad.deleteMany();
  await prisma.movimientoParticipante.deleteMany();
  await prisma.notaDeGestion.deleteMany();
  await prisma.participante.deleteMany();
  await prisma.autorizacionDatos.deleteMany();
  await prisma.persona.deleteMany();
  await prisma.actividad.deleteMany();
  await prisma.movimientoReserva.deleteMany();
  await prisma.respuesta.deleteMany();
  await prisma.reserva.deleteMany();
  // las propias las crea esta siembra; el nucleo no se toca
  await prisma.pregunta.deleteMany({ where: { campoNucleo: null } });
  await prisma.empresa.deleteMany();
  await prisma.oferta.updateMany({ data: { cuposOcupados: 0 } });
  console.log('  se borró lo sembrado antes');
}

async function ponerFechasYPublicar() {
  const grupos = await prisma.grupo.findMany({ orderBy: { id: 'asc' } });

  for (const [i, grupo] of grupos.entries()) {
    // fechas de prueba de septiembre a diciembre, que es
    // la ventana que pidio el cliente para el cronograma.
    // OJO: sin hace(), cuyo clamp es para ultimoAcceso y
    // aplastaria contra hoy las que aun no han empezado
    const ANO = new Date().getFullYear();
    // escalonados por semanas desde el 1 de septiembre
    const inicio = new Date(Date.UTC(ANO, 8, 1 + (i % 14) * 7, 13));
    const fin = new Date(inicio.getTime() + entre(28, 56) * 86_400_000);

    await prisma.grupo.update({
      where: { id: grupo.id },
      data: {
        fechaInicio: inicio,
        fechaFin: fin,
        horario: unoDe([
          'Lunes a jueves, 6:00 p. m. a 9:00 p. m.',
          'Martes y jueves, 7:00 a. m. a 11:00 a. m.',
          'Sábados, 8:00 a. m. a 4:00 p. m.',
          'Lunes a viernes, 2:00 p. m. a 5:00 p. m.',
        ]),
      },
    });
  }

  const { count } = await prisma.accionFormacion.updateMany({ data: { visible: true } });

  // los ids con que el SEP conoce esto. En produccion los
  // teclea un admin; aqui van NEGATIVOS a proposito: el SEP
  // no los tiene, asi que un archivo salido de pruebas no
  // puede apuntar a un proyecto de verdad
  const convenios = await prisma.convenio.findMany({ orderBy: { orden: 'asc' } });
  for (const [i, convenio] of convenios.entries()) {
    await prisma.convenio.update({
      where: { id: convenio.id },
      data: {
        sepProyectoId: -(2959 + i),
        sepNombreConviniente: convenio.sigla ?? convenio.nombre,
      },
    });
  }

  const acciones = await prisma.accionFormacion.findMany({ orderBy: { codigo: 'asc' } });
  for (const [i, accion] of acciones.entries()) {
    await prisma.accionFormacion.update({
      where: { id: accion.id },
      data: { sepAfId: -(9087 + i) },
    });
  }

  for (const [i, grupo] of grupos.entries()) {
    await prisma.grupo.update({
      where: { id: grupo.id },
      data: { sepGrupoId: -(17689 + i) },
    });
  }

  console.log(
    `  ${grupos.length} grupos con fechas · ${count} acciones publicadas · ids del SEP puestos`,
  );
}

async function sembrarPoliticas(convenios: Array<{ id: string; nombre: string }>) {
  for (const convenio of convenios) {
    for (const destinatario of [
      DestinatarioPolitica.RESERVA,
      DestinatarioPolitica.PARTICIPANTE,
    ]) {
      const vigente = await prisma.politicaDatos.findFirst({
        where: { convenioId: convenio.id, destinatario, vigenteHasta: null },
      });
      if (vigente) continue;

      await prisma.politicaDatos.create({
        data: {
          convenioId: convenio.id,
          destinatario,
          version: 1,
          titulo:
            destinatario === DestinatarioPolitica.RESERVA
              ? 'Tratamiento de datos — quien reserva'
              : 'Tratamiento de datos — participante',
          contenido:
            'TEXTO DE PRUEBA, SIN VALOR LEGAL. Sirve para que el sistema tenga ' +
            'una versión vigente a la que apuntar mientras se redacta la política real.',
        },
      });
    }
  }
  console.log('  políticas de prueba vigentes en los dos convenios');
}

async function sembrarAsesores(convenios: Array<{ id: string; slug: string }>) {
  const hash = await hashearClave(CLAVE_DEMO);
  const creados: Array<{ id: string; nombre: string }> = [];

  for (const [indice, [correo, nombre]] of ASESORES.entries()) {
    // el primero manda: sin un SUPERADMIN no existe la
    // seccion Usuarios y no se pueden ver los roles
    const rol = indice === 0 ? RolAdmin.SUPERADMIN : RolAdmin.GESTOR;

    const admin = await prisma.admin.upsert({
      where: { correo },
      create: {
        correo,
        nombre,
        rol,
        hashClave: hash,
        // en pruebas se entra a mirar, no a estrenar clave
        debeCambiarClave: false,
        organizacion: 'Grupo AE',
        cargo: CARGO_DEL_ROL[Object.values(CONCESIONES[correo] ?? {})[0] ?? 'CONSULTA'],
      },
      // el rol y el cargo tambien: solo en create, una
      // cuenta que ya existia se queda con el cargo viejo
      update: {
        hashClave: hash,
        rol,
        debeCambiarClave: false,
        activo: true,
        cargo: CARGO_DEL_ROL[Object.values(CONCESIONES[correo] ?? {})[0] ?? 'CONSULTA'],
      },
    });
    creados.push(admin);

    // upsert solo anade: sin borrar antes, una resiembra
    // conserva las concesiones viejas y el ambito no cambia
    await prisma.adminConvenio.deleteMany({ where: { adminId: admin.id } });

    const concesion = CONCESIONES[correo] ?? {};
    for (const convenio of convenios) {
      const rolAqui = concesion['*'] ?? concesion[convenio.slug];
      if (!rolAqui) continue;
      await prisma.adminConvenio.create({
        data: { adminId: admin.id, convenioId: convenio.id, rol: rolAqui },
      });
    }
  }

  console.log(`  ${creados.length} asesores (clave ${CLAVE_DEMO})`);
  return creados;
}

/** Cada formulario con su paleta, heredando lo que no cambie. */
async function aparienciaPorFormulario() {
  const temas = await prisma.tema.findMany();
  const general = {
    CLARO: conValoresPorDefecto(
      'CLARO',
      temas.find((t) => t.esquema === 'CLARO')?.colores,
    ),
    OSCURO: conValoresPorDefecto(
      'OSCURO',
      temas.find((t) => t.esquema === 'OSCURO')?.colores,
    ),
  };

  /// La paleta es del GREMIO, no del formulario.
  ///
  /// Alternaba por indice de formulario, y ordenados por slug
  /// eso daba: adecopria vino, adecopria-medellin turquesa y
  /// britcham-adee vino OTRA VEZ. O sea que el turquesa se lo
  /// llevaba el segundo formulario del MISMO gremio y los dos
  /// gremios salian identicos -- justo lo contrario de lo que la
  /// demostracion existe para ensenar, y sin que nada fallara.
  ///
  /// Repartiendo por convenio, los dos formularios de ADECOPRIA
  /// comparten su color y BRITCHAM tiene el suyo, que es como se
  /// ve en produccion.
  const elegidas = ['vino', 'turquesa'];
  const formularios = await prisma.formulario.findMany({
    orderBy: { slug: 'asc' },
    include: { convenio: { select: { slug: true } } },
  });

  const gremios = [...new Set(formularios.map((f) => f.convenio.slug))].sort();

  for (const formulario of formularios) {
    const suGremio = gremios.indexOf(formulario.convenio.slug);
    const plantilla = PLANTILLAS.find(
      (p) => p.clave === elegidas[suGremio % elegidas.length],
    );
    if (!plantilla) continue;
    const suyos = temasDePlantilla(plantilla);

    // SOLO lo que difiere: guardar los 37 mata la herencia
    const soloDiferentes = (esquema: 'CLARO' | 'OSCURO') => {
      const salida: Record<string, string> = {};
      for (const [clave, valor] of Object.entries(suyos[esquema])) {
        if (general[esquema][clave] !== valor) salida[clave] = valor;
      }
      return salida;
    };

    await prisma.formulario.update({
      where: { id: formulario.id },
      data: {
        publicado: true,
        coloresClaro: soloDiferentes('CLARO'),
        coloresOscuro: soloDiferentes('OSCURO'),
      },
    });
  }

  console.log(`  ${formularios.length} formularios publicados, cada uno con su paleta`);
}

/** Preguntas que no son del núcleo: lo que se agrega. */
const PROPIAS = [
  {
    etiqueta: '¿Cómo se enteró de esta convocatoria?',
    tipo: TipoPregunta.SELECCION_UNICA,
    opciones: [
      ['Correo del gremio', 'gremio'],
      ['Redes sociales', 'redes'],
      ['Un colega me la compartió', 'referido'],
      ['Feria o evento', 'evento'],
      ['Otro medio', 'otro'],
    ] as Array<[string, string]>,
  },
  {
    etiqueta: '¿Qué espera resolver su empresa con esta formación?',
    tipo: TipoPregunta.TEXTO_LARGO,
    opciones: [] as Array<[string, string]>,
  },
];

const TEXTOS_LIBRES = [
  'Necesitamos estandarizar los procesos de la planta.',
  'Queremos que el equipo comercial maneje mejor las herramientas.',
  'Nos exigen certificación para poder licitar.',
  'Bajar los reprocesos, que hoy nos cuestan mucho.',
  'Formar a los que llevan años sin capacitarse.',
];

async function sembrarPreguntasPropias() {
  const formularios = await prisma.formulario.findMany({
    select: { id: true, secciones: { select: { id: true }, orderBy: { orden: 'desc' } } },
  });

  const creadas: Array<{ id: string; formularioId: string; etiqueta: string; tipo: TipoPregunta }> =
    [];

  for (const formulario of formularios) {
    const seccionId = formulario.secciones[0]?.id ?? null;

    for (const [n, propia] of PROPIAS.entries()) {
      const pregunta = await prisma.pregunta.create({
        data: {
          formularioId: formulario.id,
          seccionId,
          etiqueta: propia.etiqueta,
          tipo: propia.tipo,
          obligatoria: n === 0,
          orden: 900 + n,
          opciones: {
            create: propia.opciones.map(([etiqueta, valor], orden) => ({
              etiqueta,
              valor,
              orden,
            })),
          },
        },
        select: { id: true, formularioId: true, etiqueta: true, tipo: true },
      });
      creadas.push(pregunta);
    }
  }

  console.log(`  ${creadas.length} preguntas propias en ${formularios.length} formularios`);
  return creadas;
}

async function sembrarActividades(acciones: Array<{ id: string; codigo: string }>) {
  let total = 0;
  for (const accion of acciones) {
    for (const [orden, [titulo, tipo, obligatoria]] of ACTIVIDADES.entries()) {
      await prisma.actividad.create({
        data: {
          accionFormacionId: accion.id,
          orden: orden + 1,
          titulo,
          tipo,
          obligatoria,
          publicada: true,
          duracion: entre(30, 180),
          ponderacion: tipo === TipoActividad.EVALUACION ? 30 : obligatoria ? 7 : null,
        },
      });
      total += 1;
    }
  }
  console.log(`  ${total} actividades en ${acciones.length} acciones`);
}

// ---------------------------------------------------------------------------

type Cobertura = { id: string; inicio: Date | null; fin: Date | null };

type OfertaViva = {
  id: string;
  accionFormacionId: string;
  convenioId: string;
  cuposMaximos: number;
  ocupados: number;
  coberturas: Cobertura[];
};

async function sembrarEmpresasYReservas(ofertas: OfertaViva[]) {
  const reservas: Array<{ id: string; ofertaId: string; confirmados: number }> = [];

  // de que formulario "vino" cada reserva: sin esto la
  // pantalla de respuestas cuenta 0 y el tablero 60
  const formularios = await prisma.formulario.findMany({
    select: { id: true, convenioId: true },
  });
  const formularioDe = new Map(formularios.map((f) => [f.convenioId, f.id]));

  for (const [i, [razonSocial, red]] of EMPRESAS.entries()) {
    const nit = String(900_100_000 + i * 1_337);
    const empresa = await prisma.empresa.create({
      data: {
        nit,
        digitoVerificacion: String(i % 10),
        razonSocial,
        numeroColaboradores: entre(8, 480),
        redAsociada: red,
        redAsociadaOtra:
          red === 'Otro'
            ? unoDe(['ANDI', 'FENALCO', 'ACOPI', 'Cámara de Comercio local'])
            : null,
        // 6 = Nit en el catalogo del SEP
        tipoDocumentoSepId: 6,
        tamanoSepId: unoDe(TAMANOS_EMPRESA_SEP).id,
      },
    });

    // una empresa reserva en dos o tres cursos
    const cuantas = entre(2, 3);
    const elegidas = new Set<string>();

    for (let n = 0; n < cuantas; n++) {
      const oferta = unoDe(ofertas);
      if (elegidas.has(oferta.id)) continue;
      elegidas.add(oferta.id);

      const libres = oferta.cuposMaximos - oferta.ocupados;
      if (libres <= 0) continue;

      const solicitados = entre(4, 18);
      const confirmados = Math.min(solicitados, libres);
      const enEspera = solicitados - confirmados;
      const creadoEn = hace(entre(3, 75), entre(8, 20));

      const reserva = await prisma.reserva.create({
        data: {
          empresaId: empresa.id,
          ofertaId: oferta.id,
          formularioId: formularioDe.get(oferta.convenioId) ?? null,
          cuposSolicitados: solicitados,
          cuposConfirmados: confirmados,
          cuposEnEspera: enEspera,
          estado: confirmados > 0 ? EstadoReserva.CONFIRMADA : EstadoReserva.LISTA_ESPERA,
          contactoNombre: `${unoDe([...NOMBRES_F, ...NOMBRES_M])} ${unoDe(APELLIDOS)}`,
          contactoCorreo: `contacto${i}@ejemplo.test`,
          contactoCelular: `3${entre(0, 2)}${entre(1000000, 9999999)}`,
          contactoCargo: unoDe(CARGOS),
          aceptaTerminos: true,
          aceptaPoliticaDatos: true,
          ipOrigen: `181.${entre(1, 254)}.${entre(1, 254)}.${entre(1, 254)}`,
          creadoEn,
        },
      });

      // el ritmo del tablero sale de aqui, no de creadoEn
      await prisma.movimientoReserva.create({
        data: {
          reservaId: reserva.id,
          accion: AccionMovimiento.CREACION,
          confirmadosAntes: 0,
          confirmadosDespues: confirmados,
          enEsperaAntes: 0,
          enEsperaDespues: enEspera,
          ip: reserva.ipOrigen,
          userAgent: 'Mozilla/5.0 (siembra de pruebas)',
          creadoEn,
        },
      });

      oferta.ocupados += confirmados;
      reservas.push({ id: reserva.id, ofertaId: oferta.id, confirmados });
    }
  }

  // sin una sola cancelada, dos de los tres filtros de
  // /admin/reservas salen vacios y la tasa marca 0 %.
  // Va antes de escribir cuposOcupados: asi cuadra solo
  const cancelables = reservas.filter((r) => r.confirmados > 0);
  const canceladas: string[] = [];

  for (let n = 0; n < 4 && cancelables.length > 0; n++) {
    const cual = cancelables.splice(Math.floor(azar() * cancelables.length), 1)[0];
    const cuando = hace(entre(1, 20));

    await prisma.reserva.update({
      where: { id: cual.id },
      data: {
        estado: EstadoReserva.CANCELADA,
        cuposConfirmados: 0,
        cuposEnEspera: 0,
        canceladaEn: cuando,
      },
    });
    await prisma.movimientoReserva.create({
      data: {
        reservaId: cual.id,
        accion: AccionMovimiento.CANCELACION,
        confirmadosAntes: cual.confirmados,
        confirmadosDespues: 0,
        enEsperaAntes: 0,
        enEsperaDespues: 0,
        creadoEn: cuando,
      },
    });

    const oferta = ofertas.find((o) => o.id === cual.ofertaId);
    if (oferta) oferta.ocupados -= cual.confirmados;
    canceladas.push(cual.id);
  }

  // y dos que no cupieron: espera pura, sin confirmar
  const enEsperaPura: string[] = [];
  for (let n = 0; n < 2 && cancelables.length > 0; n++) {
    const cual = cancelables.splice(Math.floor(azar() * cancelables.length), 1)[0];
    const solicitados = cual.confirmados;

    await prisma.reserva.update({
      where: { id: cual.id },
      data: {
        estado: EstadoReserva.LISTA_ESPERA,
        cuposConfirmados: 0,
        cuposEnEspera: solicitados,
      },
    });

    const oferta = ofertas.find((o) => o.id === cual.ofertaId);
    if (oferta) oferta.ocupados -= cual.confirmados;
    enEsperaPura.push(cual.id);
  }

  const tocadas = new Set([...canceladas, ...enEsperaPura]);
  const vivas = reservas.filter((r) => !tocadas.has(r.id));

  for (const oferta of ofertas) {
    if (oferta.ocupados > 0) {
      await prisma.oferta.update({
        where: { id: oferta.id },
        data: { cuposOcupados: oferta.ocupados },
      });
    }
  }

  const cupos = vivas.reduce((s, r) => s + r.confirmados, 0);
  console.log(
    `  ${EMPRESAS.length} empresas · ${reservas.length} reservas ` +
      `(${canceladas.length} canceladas, ${enEsperaPura.length} en espera) · ${cupos} cupos`,
  );
  return vivas;
}

/** Lo que contestó cada reserva a las preguntas propias. */
async function sembrarRespuestas(
  preguntas: Array<{ id: string; formularioId: string; etiqueta: string; tipo: TipoPregunta }>,
) {
  const reservas = await prisma.reserva.findMany({
    where: { formularioId: { not: null } },
    select: { id: true, formularioId: true },
  });

  const opciones = await prisma.opcion.findMany({
    select: { id: true, preguntaId: true, etiqueta: true, valor: true },
  });

  let escritas = 0;

  for (const reserva of reservas) {
    // ~15 % no contesta: una tasa del 100 % no es creíble
    if (azar() < 0.15) continue;

    for (const pregunta of preguntas) {
      if (pregunta.formularioId !== reserva.formularioId) continue;

      if (pregunta.tipo === TipoPregunta.SELECCION_UNICA) {
        const suyas = opciones.filter((o) => o.preguntaId === pregunta.id);
        if (suyas.length === 0) continue;
        const elegida = unoDe(suyas);

        await prisma.respuesta.create({
          data: {
            reservaId: reserva.id,
            preguntaId: pregunta.id,
            // congeladas: la exportación dice lo que leyó
            etiquetaPregunta: pregunta.etiqueta,
            valoresSeleccion: [elegida.valor],
            etiquetasSeleccion: [elegida.etiqueta],
          },
        });
        escritas += 1;
        continue;
      }

      // el texto libre no se agrega, y así se ve
      if (azar() < 0.5) continue;
      await prisma.respuesta.create({
        data: {
          reservaId: reserva.id,
          preguntaId: pregunta.id,
          etiquetaPregunta: pregunta.etiqueta,
          valorTexto: unoDe(TEXTOS_LIBRES),
        },
      });
      escritas += 1;
    }
  }

  console.log(`  ${escritas} respuestas sobre ${reservas.length} reservas`);
}

// ---------------------------------------------------------------------------

async function main() {
  soloEnPruebas('db:sembrar-prueba');
  console.log('\nSembrando el entorno de pruebas…\n');

  const convenios = await prisma.convenio.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, slug: true },
    orderBy: { orden: 'asc' },
  });
  if (convenios.length === 0) {
    console.error('✗ No hay catálogo. Corra antes: pnpm prisma db seed');
    process.exit(1);
  }

  // rehacer las cuentas sin tocar el resto. El rol y las
  // concesiones cambian mas que los datos, y `--rehacer`
  // obligaria a tirar un entorno entero por corregir uno
  if (process.argv.includes('--solo-cuentas')) {
    const cuentas = await sembrarAsesores(convenios);
    console.log(`
✓ ${cuentas.length} cuentas al día. Nada más se tocó.
`);
    return;
  }

  if ((await prisma.participante.count()) > 0 || (await prisma.empresa.count()) > 0) {
    if (!process.argv.includes('--rehacer')) {
      console.error('✗ Ya hay datos sembrados. Para rehacerlos: --rehacer');
      process.exit(1);
    }
    await borrarLoSembrado();
  }

  await ponerFechasYPublicar();
  await sembrarPoliticas(convenios);
  await aparienciaPorFormulario();
  const preguntasPropias = await sembrarPreguntasPropias();
  const asesores = await sembrarAsesores(convenios);

  const acciones = await prisma.accionFormacion.findMany({
    select: { id: true, codigo: true, convenioId: true },
    orderBy: { codigo: 'asc' },
  });
  await sembrarActividades(acciones);

  const convenioDeAccion = new Map(acciones.map((a) => [a.id, a.convenioId]));

  const ofertasCrudas = await prisma.oferta.findMany({
    where: { abierta: true },
    select: {
      id: true,
      accionFormacionId: true,
      cuposMaximos: true,
      ubicacionId: true,
    },
  });

  // la cobertura del grupo, para poder matricular
  const coberturas = await prisma.grupoCobertura.findMany({
    select: {
      id: true,
      ubicacionId: true,
      grupo: {
        select: { accionFormacionId: true, fechaInicio: true, fechaFin: true },
      },
    },
  });

  const ofertas: OfertaViva[] = ofertasCrudas.map((o) => ({
    id: o.id,
    accionFormacionId: o.accionFormacionId,
    convenioId: convenioDeAccion.get(o.accionFormacionId)!,
    cuposMaximos: o.cuposMaximos,
    ocupados: 0,
    coberturas: coberturas
      .filter(
        (c) =>
          c.ubicacionId === o.ubicacionId &&
          c.grupo.accionFormacionId === o.accionFormacionId,
      )
      .map((c) => ({ id: c.id, inicio: c.grupo.fechaInicio, fin: c.grupo.fechaFin })),
  }));

  const reservas = await sembrarEmpresasYReservas(ofertas);
  await sembrarRespuestas(preguntasPropias);
  const porOferta = new Map(ofertas.map((o) => [o.id, o]));

  const politicas = await prisma.politicaDatos.findMany({
    where: { destinatario: DestinatarioPolitica.PARTICIPANTE, vigenteHasta: null },
    select: { id: true, convenioId: true },
  });
  const politicaDe = new Map(politicas.map((p) => [p.convenioId, p.id]));

  const actividades = await prisma.actividad.findMany({
    where: { publicada: true },
    select: { id: true, accionFormacionId: true, orden: true, obligatoria: true },
    orderBy: { orden: 'asc' },
  });

  // ── las personas ────────────────────────────────────────────
  // pares accion:persona ya ocupados
  const usados = new Set<string>();
  const yaCreadas: string[] = [];
  let documento = 1_010_200_000;
  let creados = 0;
  let repetidas = 0;
  let conAvance = 0;

  const plan = REPARTO.flatMap(([etapa, cuantos]) =>
    Array.from({ length: cuantos }, () => etapa),
  );

  for (const [i, etapa] of plan.entries()) {
    const esMujer = azar() < 0.52;
    const primerNombre = unoDe(esMujer ? NOMBRES_F : NOMBRES_M);
    const segundoNombre = unoDe(SEGUNDOS) || null;
    const primerApellido = unoDe(APELLIDOS);
    const segundoApellido = unoDe(APELLIDOS);

    documento += entre(700, 9_000);
    const numeroDocumento = String(documento);

    const camino = CAMINO[etapa];
    const esSalida = ETAPAS_SALIDA.includes(etapa);
    const enAula = ETAPAS_EN_AULA.includes(etapa);
    const ahora = Date.now();

    // el grupo tiene que casar con la etapa: quien cursa va
    // en uno abierto y quien acabo en uno cerrado. Se elige
    // la OFERTA que lo tenga, no solo la cobertura: si no,
    // el respaldo mete gente "en formacion" en curso vencido
    const abiertas = (o: OfertaViva) =>
      o.coberturas.filter(
        (c) => c.inicio && c.fin && c.inicio.getTime() <= ahora && c.fin.getTime() > ahora,
      );
    const cerradas = (o: OfertaViva) =>
      o.coberturas.filter((c) => c.fin && c.fin.getTime() <= ahora);
    const porEmpezar = (o: OfertaViva) =>
      o.coberturas.filter((c) => c.inicio && c.inicio.getTime() > ahora);

    const yaAcabo =
      etapa === EtapaParticipante.CERTIFICADO || etapa === EtapaParticipante.NO_APROBO;
    const quiere: (o: OfertaViva) => Cobertura[] = yaAcabo
      ? cerradas
      : enAula
        ? abiertas
        : etapa === EtapaParticipante.INSCRITO
          ? (o) => [...porEmpezar(o), ...abiertas(o)]
          : (o) => o.coberturas;

    // la mayoria llega nominada por una empresa
    const porEmpresa = azar() < 0.78;
    const reservasQueSirven = reservas.filter((r) => {
      const o = porOferta.get(r.ofertaId);
      return o ? quiere(o).length > 0 : false;
    });

    const reserva = porEmpresa
      ? (reservasQueSirven.length > 0 ? unoDe(reservasQueSirven) : unoDe(reservas))
      : null;

    const sueltas = ofertas.filter((o) => quiere(o).length > 0);
    const oferta = reserva
      ? porOferta.get(reserva.ofertaId)!
      : sueltas.length > 0
        ? unoDe(sueltas)
        : unoDe(ofertas);

    const posibles = quiere(oferta);
    const cobertura =
      posibles.length > 0
        ? unoDe(posibles)
        : oferta.coberturas.length > 0
          ? unoDe(oferta.coberturas)
          : null;

    // nadie se da de alta despues de arrancar su curso
    const diasDelInicio = cobertura?.inicio
      ? Math.floor((ahora - cobertura.inicio.getTime()) / 86_400_000)
      : 0;
    const diasDesdeAlta = Math.max(diasDelInicio, 0) + entre(4, 26);
    const necesitaFormacion = camino.includes(EtapaParticipante.INSCRITO);

    // quien acaba de llegar por el formulario corto trae
    // solo lo basico. De CONTACTADO en adelante el asesor
    // ya se lo saco, asi que ahi nadie sigue a medias
    const aMedias =
      (etapa === EtapaParticipante.INTERESADO && azar() < 0.65) ||
      (etapa === EtapaParticipante.CONTACTADO && azar() < 0.3);
    const asesor = azar() < 0.85 ? unoDe(asesores) : null;

    // la misma cedula en dos convenios es UNA persona con
    // dos participaciones: hay que poder verlo. Se excluye
    // a quien YA esta en esta accion, que no cabe dos veces
    const candidatas = yaCreadas.filter(
      (id) => !usados.has(`${oferta.accionFormacionId}:${id}`),
    );
    const reutilizar = candidatas.length > 0 && azar() < 0.09 ? unoDe(candidatas) : null;
    if (reutilizar) repetidas += 1;

    // un municipio real, con su departamento
    const domicilio = unoDe(MUNICIPIOS_SEP.filter((m) => m[3]));

    const personaId =
      reutilizar ??
      (
        await prisma.persona.create({
          data: {
            tipoDocumentoSepId: azar() < 0.93 ? 1 : 3,
            numeroDocumento,
            // los numeros de aqui arriba caen en rango real de
            // cedulas colombianas: cada uno le pertenece a
            // alguien. Marcadas, el RUI no las consulta nunca
            esDePrueba: true,
            primerNombre,
            segundoNombre,
            primerApellido,
            segundoApellido,
            correo:
              `${primerNombre}.${primerApellido}${i}`
                .toLowerCase()
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '') + '@ejemplo.test',
            // 10 digitos: `3` + operador + siete. Salian de
            // NUEVE y no era un celular colombiano; lo destapo
            // el validador nuevo, que rechazo la siembra entera
            celular: `3${entre(0, 2)}${entre(0, 9)}${entre(1000000, 9999999)}`,
            // el formulario corto solo pide hasta aqui; lo
            // de abajo llega cuando la persona completa su
            // ficha o cuando el asesor se lo saca por
            // telefono. Dos tercios de los interesados
            // siguen a medias: es el trabajo pendiente
            fechaNacimiento: aMedias ? null : hace(entre(6_600, 18_000)),
            generoSepId: esMujer ? 2 : unoDe([1, 3]),
            estrato: aMedias ? null : entre(1, 6),
            departamentoSepId: aMedias ? null : domicilio[1],
            municipioSepId: aMedias ? null : domicilio[0],
            barrio: aMedias ? null : unoDe(BARRIOS),
            direccion: aMedias
              ? null
              : `${unoDe(CALLES)} ${entre(1, 180)} #${entre(1, 90)}-${entre(1, 99)}`,
          },
          select: { id: true },
        })
      ).id;

    const participante = await prisma.participante.create({
      data: {
        convenioId: oferta.convenioId,
        reservaId: reserva?.id ?? null,
        ofertaId: necesitaFormacion ? oferta.id : azar() < 0.6 ? oferta.id : null,
        accionFormacionId: oferta.accionFormacionId,
        coberturaId: necesitaFormacion ? (cobertura?.id ?? null) : null,
        etapa,
        origen: porEmpresa
          ? OrigenParticipante.EMPRESA
          : unoDe([
              OrigenParticipante.REDES,
              OrigenParticipante.REFERIDO,
              OrigenParticipante.EVENTO,
              OrigenParticipante.AUTOGESTION,
            ]),
        asesorId: asesor?.id ?? null,
        cargoEnEmpresa: azar() < 0.8 ? unoDe(CARGOS) : null,
        nivelOcupacionalSepId: aMedias ? null : unoDe(NIVELES_OCUPACIONALES_SEP).id,
        beneficiarioPrevio: azar() < 0.18,
        creadoEn: hace(diasDesdeAlta),
        personaId,
        // el CHECK exige la fecha en el propio INSERT
        motivoSalida: esSalida ? unoDe(MOTIVOS_SALIDA) : null,
        fechaRetiro: etapa === EtapaParticipante.RETIRADO ? hace(entre(1, 20)) : null,
      },
      select: { id: true },
    });
    creados += 1;
    yaCreadas.push(personaId);
    usados.add(`${oferta.accionFormacionId}:${personaId}`);

    // ── su historia de etapas ──
    // cuantos dias atras cae cada peldano del camino
    const diaDelPaso = (paso: number) =>
      Math.max(0, Math.round(diasDesdeAlta - (diasDesdeAlta / camino.length) * paso));

    for (const [paso, etapaDespues] of camino.entries()) {
      const cuandoDias = diaDelPaso(paso);
      const salida = ETAPAS_SALIDA.includes(etapaDespues);

      await prisma.movimientoParticipante.create({
        data: {
          participanteId: participante.id,
          etapaAntes: paso === 0 ? null : camino[paso - 1],
          etapaDespues,
          motivo: salida ? unoDe(MOTIVOS_SALIDA) : null,
          adminId: asesor?.id ?? null,
          creadoEn: hace(cuandoDias),
        },
      });
    }

    // ── notas ──
    //
    // el resultado casa con la etapa: a quien avanzo se le
    // hablo, y quien sigue en INTERESADO es justo el que se
    // quiere ver en "nunca se ha logrado contactar". Sin esa
    // coherencia la pantalla ensena estados imposibles
    const seLeHablo = etapa !== 'INTERESADO';
    const cuantas = seLeHablo ? entre(1, 3) : entre(1, 4);

    for (let n = 0; n < cuantas; n++) {
      // la primera de quien avanzo es el contacto logrado
      const pool =
        seLeHablo && n === 0 ? NOTAS_LOGRADAS : NOTAS_FALLIDAS;
      const cual = unoDe(pool);

      await prisma.notaDeGestion.create({
        data: {
          participanteId: participante.id,
          autorId: asesor?.id ?? null,
          autorNombre: asesor?.nombre ?? 'Sistema',
          texto: cual.texto,
          canales: cual.canales,
          resultado: cual.resultado,
          // la lograda va primero en el tiempo, no despues:
          // si el contacto queda al final, "intentos desde el
          // ultimo contacto" sale cero en todo el mundo
          creadoEn: hace(
            seLeHablo && n === 0
              ? diasDesdeAlta
              : entre(0, Math.max(1, diasDesdeAlta - 1)),
          ),
        },
      });
    }

    // ── autorizacion: en el paso de DATOS_COMPLETOS ──
    // nunca despues de matricular: es la compuerta que el
    // sistema dice imponer, y el codigo real no la permite
    const politicaId = politicaDe.get(oferta.convenioId);
    const pasoDatos = camino.indexOf(EtapaParticipante.DATOS_COMPLETOS);
    if (politicaId && pasoDatos >= 0) {
      await prisma.autorizacionDatos.create({
        data: {
          personaId,
          politicaDatosId: politicaId,
          canal: unoDe([
            CanalAutorizacion.FORMULARIO_WEB,
            CanalAutorizacion.CARGA_EMPRESA,
            CanalAutorizacion.CORREO,
            CanalAutorizacion.VERBAL_ASESOR,
          ]),
          // 6 h y no 12: en caminos cortos empataria
          otorgadaEn: hace(diaDelPaso(pasoDatos), 6),
          evidencia: 'Registro de prueba',
        },
      });
    }

    const pasoMatricula = camino.indexOf(EtapaParticipante.INSCRITO);
    if (pasoMatricula >= 0) {
      await prisma.participante.update({
        where: { id: participante.id },
        data: { fechaMatricula: hace(diaDelPaso(pasoMatricula)) },
      });
    }

    // ── el aula: solo quien ya entro a formacion ──
    if (!enAula) continue;

    const suyas = actividades.filter((a) => a.accionFormacionId === oferta.accionFormacionId);
    if (suyas.length === 0) continue;

    const ritmo = etapa === 'CERTIFICADO' ? RITMOS[0] : ritmoAlAzar();
    const esperadas =
      etapa === 'CERTIFICADO' ? suyas.length : Math.round(suyas.length * entre(50, 95) / 100);
    const hechas = Math.max(1, Math.round(esperadas * ritmo.factor));

    for (const [orden, actividad] of suyas.entries()) {
      if (orden >= hechas) break;

      const ultima = orden === hechas - 1;
      // certificado quiere decir todo aprobado
      const aprobada =
        etapa === 'NO_APROBO' && ultima
          ? false
          : etapa === 'CERTIFICADO' || azar() < 0.9;
      const iniciada = hace(entre(2, 45));

      await prisma.avanceActividad.create({
        data: {
          participanteId: participante.id,
          actividadId: actividad.id,
          estado:
            ultima && ritmo.clave !== 'AL_DIA'
              ? EstadoAvance.EN_CURSO
              : aprobada
                ? EstadoAvance.APROBADA
                : EstadoAvance.NO_APROBADA,
          calificacion: aprobada ? entre(35, 50) / 10 : entre(10, 29) / 10,
          intentos: entre(1, 3),
          iniciadaEn: iniciada,
          completadaEn: ultima && ritmo.clave !== 'AL_DIA' ? null : iniciada,
        },
      });
    }
    conAvance += 1;

    // "parado" es justamente el que no entra hace dias.
    // Nunca antes de que el grupo empezara: seria no haber
    // entrado a un curso que aun no existia
    const diasDelGrupo = cobertura?.inicio
      ? Math.floor((Date.now() - cobertura.inicio.getTime()) / 86_400_000)
      : 999;
    const pedido =
      ritmo.clave === 'PARADO'
        ? entre(21, 60)
        : ritmo.clave === 'ATRASADO'
          ? entre(8, 20)
          : entre(0, 5);
    const diasSinEntrar = Math.min(pedido, Math.max(0, diasDelGrupo));

    await prisma.participante.update({
      where: { id: participante.id },
      data: {
        ultimoAcceso: hace(diasSinEntrar),
        porcentajeAsistencia: Math.min(100, Math.round((hechas / suyas.length) * 100)),
        notaFinal:
          etapa === 'CERTIFICADO'
            ? entre(40, 50) / 10
            : etapa === 'NO_APROBO'
              ? entre(20, 29) / 10
              : null,
        fechaCertificacion: etapa === 'CERTIFICADO' ? hace(entre(1, 15)) : null,
      },
    });
  }

  console.log(`  ${creados} participaciones por las nueve etapas`);
  console.log(`  ${repetidas} de ellas son la misma persona en otro curso`);
  console.log(`  ${conAvance} con avance en el aula, a distintos ritmos`);

  // ── lo que hay que poder mirar ──
  const cuposConfirmados = await prisma.reserva.aggregate({
    where: { estado: { not: EstadoReserva.CANCELADA } },
    _sum: { cuposConfirmados: true },
  });
  const vivos = await prisma.participante.count({
    where: { etapa: { notIn: ['PERDIDO', 'RETIRADO', 'NO_APROBO'] } },
  });
  const brecha = (cuposConfirmados._sum.cuposConfirmados ?? 0) - vivos;

  console.log('\n✓ Listo.');
  console.log(`  brecha de nombres: ${brecha} cupos sin nadie detrás`);
  console.log(`  entrar con: ${ASESORES[0][0]} / ${CLAVE_DEMO}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
