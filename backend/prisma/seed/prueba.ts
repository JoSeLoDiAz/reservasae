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
  TipoDocumento,
} from '../../generated/prisma';
import { hashearClave } from '../../src/admin/claves';

const prisma = new PrismaClient();

const CLAVE_DEMO = 'Prueba2026*';

// ---------------------------------------------------------------------------

/** Solo corre contra la base de pruebas. */
function comprobarQueEsPruebas() {
  const url = process.env.DATABASE_URL ?? '';
  const nombreBase = url.split('/').pop()?.split('?')[0] ?? '';

  const problemas: string[] = [];
  if (process.env.ENTORNO !== 'prueba') {
    problemas.push('ENTORNO no vale "prueba"');
  }
  if (!nombreBase.includes('prueba')) {
    problemas.push(`la base se llama "${nombreBase}" y no lleva "prueba"`);
  }

  if (problemas.length > 0) {
    console.error('\n✗ Esta siembra inventa datos y NO debe tocar producción.');
    for (const p of problemas) console.error(`  · ${p}`);
    // la imagen de produccion no trae ts-node: va desde
    // el clon del servidor, contra el puerto publicado
    console.error('\n  Se ejecuta desde /opt/sep/reservasae-prueba/backend así:');
    console.error('    export ENTORNO=prueba');
    console.error('    export DATABASE_URL=...@127.0.0.1:5434/reservasae_prueba');
    console.error('    pnpm db:sembrar-prueba\n');
    process.exit(1);
  }
}

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

const ASESORES = [
  ['ana.jaramillo@ejemplo.test', 'Ana Jaramillo'],
  ['carlos.mesa@ejemplo.test', 'Carlos Mesa'],
  ['lucia.parra@ejemplo.test', 'Lucía Parra'],
  ['hector.ramos@ejemplo.test', 'Héctor Ramos'],
] as const;

const CARGOS = [
  'Analista de talento humano', 'Jefe de producción', 'Auxiliar administrativo',
  'Coordinadora de calidad', 'Supervisor de planta', 'Asistente contable',
  'Director comercial', 'Operario', 'Tecnóloga en logística',
];

const NOTAS = [
  'Se llama y confirma interés. Pide que le manden el temario por correo.',
  'Correo devuelto: la empresa dio uno que ya no existe. Se pide otro.',
  'Confirma que puede en jornada de la tarde.',
  'Pendiente de que la empresa mande el documento.',
  'Se le explica que la formación es gratuita y no exige pago alguno.',
  'Contesta por WhatsApp: sigue interesada pero está de vacaciones.',
  'No contesta el celular en tres intentos.',
  'Queda de confirmar con su jefe antes del viernes.',
];

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
  [EtapaParticipante.NUEVO, 12],
  [EtapaParticipante.CONTACTADO, 15],
  [EtapaParticipante.DATOS_COMPLETOS, 13],
  [EtapaParticipante.MATRICULADO, 16],
  [EtapaParticipante.EN_FORMACION, 22],
  [EtapaParticipante.CERTIFICADO, 12],
  [EtapaParticipante.PERDIDO, 5],
  [EtapaParticipante.RETIRADO, 3],
  [EtapaParticipante.NO_APROBO, 2],
];

/** Quien ya pisó el aula y por tanto tiene avance. */
const ETAPAS_EN_AULA: EtapaParticipante[] = [
  EtapaParticipante.EN_FORMACION,
  EtapaParticipante.CERTIFICADO,
  EtapaParticipante.NO_APROBO,
  EtapaParticipante.RETIRADO,
];

/** De estas no se sale sin explicar por qué. */
const ETAPAS_SALIDA: EtapaParticipante[] = [
  EtapaParticipante.PERDIDO,
  EtapaParticipante.RETIRADO,
  EtapaParticipante.NO_APROBO,
];

/** Por dónde ha pasado quien está en cada etapa. */
const CAMINO: Record<EtapaParticipante, EtapaParticipante[]> = {
  NUEVO: ['NUEVO'],
  CONTACTADO: ['NUEVO', 'CONTACTADO'],
  DATOS_COMPLETOS: ['NUEVO', 'CONTACTADO', 'DATOS_COMPLETOS'],
  MATRICULADO: ['NUEVO', 'CONTACTADO', 'DATOS_COMPLETOS', 'MATRICULADO'],
  EN_FORMACION: ['NUEVO', 'CONTACTADO', 'DATOS_COMPLETOS', 'MATRICULADO', 'EN_FORMACION'],
  CERTIFICADO: [
    'NUEVO', 'CONTACTADO', 'DATOS_COMPLETOS', 'MATRICULADO', 'EN_FORMACION', 'CERTIFICADO',
  ],
  PERDIDO: ['NUEVO', 'CONTACTADO', 'PERDIDO'],
  RETIRADO: ['NUEVO', 'CONTACTADO', 'DATOS_COMPLETOS', 'MATRICULADO', 'RETIRADO'],
  NO_APROBO: [
    'NUEVO', 'CONTACTADO', 'DATOS_COMPLETOS', 'MATRICULADO', 'EN_FORMACION', 'NO_APROBO',
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
  await prisma.notaParticipante.deleteMany();
  await prisma.participante.deleteMany();
  await prisma.autorizacionDatos.deleteMany();
  await prisma.persona.deleteMany();
  await prisma.actividad.deleteMany();
  await prisma.movimientoReserva.deleteMany();
  await prisma.respuesta.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.empresa.deleteMany();
  await prisma.oferta.updateMany({ data: { cuposOcupados: 0 } });
  console.log('  se borró lo sembrado antes');
}

async function ponerFechasYPublicar() {
  const grupos = await prisma.grupo.findMany({ orderBy: { id: 'asc' } });

  for (const [i, grupo] of grupos.entries()) {
    // la mayoria ya arranco: si no, nadie puede ir tarde.
    // Los tres ultimos de cada tanda quedan por empezar
    const arranque = 84 - (i % 16) * 7;
    const inicio = hace(arranque, 8);
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
  console.log(`  ${grupos.length} grupos con fechas · ${count} acciones publicadas`);
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

async function sembrarAsesores(convenios: Array<{ id: string }>) {
  const hash = await hashearClave(CLAVE_DEMO);
  const creados: Array<{ id: string; nombre: string }> = [];

  for (const [correo, nombre] of ASESORES) {
    const admin = await prisma.admin.upsert({
      where: { correo },
      create: {
        correo,
        nombre,
        rol: RolAdmin.GESTOR,
        hashClave: hash,
        // en pruebas se entra a mirar, no a estrenar clave
        debeCambiarClave: false,
        organizacion: 'Grupo AE',
        cargo: 'Asesor de inscripciones',
      },
      update: { hashClave: hash, debeCambiarClave: false, activo: true },
    });
    creados.push(admin);

    for (const convenio of convenios) {
      await prisma.adminConvenio.upsert({
        where: {
          adminId_convenioId_rol: {
            adminId: admin.id,
            convenioId: convenio.id,
            rol: RolConvenio.GESTOR_INSCRIPCION,
          },
        },
        create: {
          adminId: admin.id,
          convenioId: convenio.id,
          rol: RolConvenio.GESTOR_INSCRIPCION,
        },
        update: {},
      });
    }
  }

  console.log(`  ${creados.length} asesores (clave ${CLAVE_DEMO})`);
  return creados;
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

type Cobertura = { id: string; inicio: Date | null };

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

  for (const [i, [razonSocial, red]] of EMPRESAS.entries()) {
    const nit = String(900_100_000 + i * 1_337);
    const empresa = await prisma.empresa.create({
      data: {
        nit,
        digitoVerificacion: String(i % 10),
        razonSocial,
        numeroColaboradores: entre(8, 480),
        redAsociada: red,
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

  for (const oferta of ofertas) {
    if (oferta.ocupados > 0) {
      await prisma.oferta.update({
        where: { id: oferta.id },
        data: { cuposOcupados: oferta.ocupados },
      });
    }
  }

  const cupos = reservas.reduce((s, r) => s + r.confirmados, 0);
  console.log(`  ${EMPRESAS.length} empresas · ${reservas.length} reservas · ${cupos} cupos`);
  return reservas;
}

// ---------------------------------------------------------------------------

async function main() {
  comprobarQueEsPruebas();
  console.log('\nSembrando el entorno de pruebas…\n');

  const convenios = await prisma.convenio.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { orden: 'asc' },
  });
  if (convenios.length === 0) {
    console.error('✗ No hay catálogo. Corra antes: pnpm prisma db seed');
    process.exit(1);
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
      grupo: { select: { accionFormacionId: true, fechaInicio: true } },
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
      .map((c) => ({ id: c.id, inicio: c.grupo.fechaInicio })),
  }));

  const reservas = await sembrarEmpresasYReservas(ofertas);
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

    // la mayoria llega nominada por una empresa
    const porEmpresa = azar() < 0.78;
    const reserva = porEmpresa ? unoDe(reservas) : null;
    const oferta = reserva ? porOferta.get(reserva.ofertaId)! : unoDe(ofertas);

    const camino = CAMINO[etapa];
    const esSalida = ETAPAS_SALIDA.includes(etapa);
    const diasDesdeAlta = entre(4, 80);
    const enAula = ETAPAS_EN_AULA.includes(etapa);

    // quien ya esta en el aula va en un grupo que arranco:
    // si no, sale "atrasado" en un curso que no ha empezado
    const arrancadas = oferta.coberturas.filter(
      (c) => c.inicio !== null && c.inicio.getTime() <= Date.now(),
    );
    const cobertura = enAula
      ? (arrancadas.length > 0 ? unoDe(arrancadas) : null)
      : oferta.coberturas.length > 0
        ? unoDe(oferta.coberturas)
        : null;
    const necesitaFormacion = camino.includes(EtapaParticipante.MATRICULADO);
    const asesor = azar() < 0.85 ? unoDe(asesores) : null;

    // la misma cedula en dos convenios es UNA persona con
    // dos participaciones: hay que poder verlo. Se excluye
    // a quien YA esta en esta accion, que no cabe dos veces
    const candidatas = yaCreadas.filter(
      (id) => !usados.has(`${oferta.accionFormacionId}:${id}`),
    );
    const reutilizar = candidatas.length > 0 && azar() < 0.09 ? unoDe(candidatas) : null;
    if (reutilizar) repetidas += 1;

    const personaId =
      reutilizar ??
      (
        await prisma.persona.create({
          data: {
            tipoDocumento: azar() < 0.93 ? TipoDocumento.CC : TipoDocumento.CE,
            numeroDocumento,
            primerNombre,
            segundoNombre,
            primerApellido,
            segundoApellido,
            correo:
              `${primerNombre}.${primerApellido}${i}`
                .toLowerCase()
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '') + '@ejemplo.test',
            celular: `3${entre(0, 2)}${entre(1000000, 9999999)}`,
            fechaNacimiento: hace(entre(6_600, 18_000)),
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
    for (const [paso, etapaDespues] of camino.entries()) {
      const cuandoDias = Math.round(
        diasDesdeAlta - (diasDesdeAlta / camino.length) * paso,
      );
      const salida = ETAPAS_SALIDA.includes(etapaDespues);

      await prisma.movimientoParticipante.create({
        data: {
          participanteId: participante.id,
          etapaAntes: paso === 0 ? null : camino[paso - 1],
          etapaDespues,
          motivo: salida ? unoDe(MOTIVOS_SALIDA) : null,
          adminId: asesor?.id ?? null,
          creadoEn: hace(Math.max(0, cuandoDias)),
        },
      });
    }

    // ── notas ──
    for (let n = 0; n < entre(0, 3); n++) {
      await prisma.notaParticipante.create({
        data: {
          participanteId: participante.id,
          autorId: asesor?.id ?? null,
          autorNombre: asesor?.nombre ?? 'Sistema',
          texto: unoDe(NOTAS),
          creadoEn: hace(entre(1, Math.max(2, diasDesdeAlta))),
        },
      });
    }

    // ── autorizacion: desde DATOS_COMPLETOS ──
    const politicaId = politicaDe.get(oferta.convenioId);
    if (politicaId && camino.includes(EtapaParticipante.DATOS_COMPLETOS)) {
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
          otorgadaEn: hace(entre(1, diasDesdeAlta)),
          evidencia: 'Registro de prueba',
        },
      });
    }

    if (necesitaFormacion) {
      await prisma.participante.update({
        where: { id: participante.id },
        data: { fechaMatricula: hace(entre(5, diasDesdeAlta)) },
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
      const aprobada = etapa === 'NO_APROBO' && ultima ? false : azar() < 0.9;
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
