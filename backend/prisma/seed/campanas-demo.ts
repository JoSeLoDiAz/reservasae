/** Campañas y plantillas de mentira, para ver el módulo lleno. */

/// Un módulo de campañas vacío no se puede evaluar: no se
/// sabe si el informe sirve hasta que hay un informe con
/// números dentro. Esto siembra unas cuantas ya enviadas, con
/// aperturas y clics repartidos como se reparten de verdad,
/// para poder mirar la pantalla y decir si dice algo o no.
///
/// LO IMPORTANTE DE ESTE ARCHIVO no son las campañas: es que
/// NINGUNA deje un destinatario PENDIENTE.
///
/// El worker busca exactamente eso -- pendientes de una
/// campaña ENVIANDO -- y le manda un correo de verdad a una
/// persona de verdad. Sembrar «una campaña a medio enviar»
/// para que se vea bonita la barra de progreso sería sembrar
/// una tanda de correos reales a 124 personas que no pidieron
/// nada. Aquí todo destinatario nace ya resuelto: ENVIADO,
/// OMITIDO o FALLIDO.

import {
  EstadoCampana,
  EstadoDestinatario,
  type EtapaParticipante,
  PrismaClient,
} from '../../generated/prisma';

const prisma = new PrismaClient();

/// Solo contra la base de pruebas. La misma guarda que el
/// resto de siembras, por la misma razón: un `.env` de
/// portátil puede estar apuntando a producción.
function comprobarQueEsPruebas() {
  const url = process.env.DATABASE_URL ?? '';
  const nombreBase = url.split('/').pop()?.split('?')[0] ?? '';

  const problemas: string[] = [];
  if (process.env.ENTORNO !== 'prueba') {
    problemas.push('ENTORNO no vale "prueba"');
  }
  if (!nombreBase.includes('prueba')) {
    problemas.push(`la base «${nombreBase}» no lleva "prueba" en el nombre`);
  }

  if (problemas.length > 0) {
    console.error('\n  Esto NO corre aquí:');
    for (const p of problemas) console.error(`   · ${p}`);
    console.error('\n  Siembra datos inventados. Solo en pruebas.\n');
    process.exit(1);
  }
}

/// Por aquí se reconocen las de mentira para volver a
/// sembrarlas sin duplicarlas. Va en el nombre y se ve en la
/// pantalla: quien la mire sabe que no le llegó a nadie.
const MARCA = '[demo]';

/// Números al azar pero SIEMPRE LOS MISMOS. Con `Math.random`
/// cada siembra daba otras cifras y era imposible decir si un
/// cambio en el informe lo hizo uno o lo hizo el azar.
function dado(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const diasAtras = (d: number) => new Date(Date.now() - d * 86_400_000);

// ---------------------------------------------------------------------------
// Las plantillas: sirven de ejemplo de cómo se escriben.

/// Las etapas en que tiene sentido cada una. Es lo que impide
/// mandar «quedó inscrito» a quien todavía no lo está.
const PLANTILLAS: Array<{
  nombre: string;
  asunto: string;
  cuerpo: string;
  etapas?: string[];
}> = [
  {
    nombre: 'Bienvenida a la formación',
    etapas: ['INSCRITO', 'EN_FORMACION'],
    asunto: '{{tratamiento}} {{primerApellido}}, quedó inscrito en {{accionFormacion}}',
    cuerpo: `{{saludo}}:

Confirmamos su inscripción en {{accionFormacion}}.

Su grupo es el {{grupo}} y arranca el {{fechaInicio}} en {{ubicacion}}, en modalidad {{modalidad}}.

Si algo no le cuadra, respóndanos este correo.

{{gremio}}`,
  },
  {
    nombre: 'Le faltan datos por completar',
    etapas: ['INTERESADO', 'CONTACTADO'],
    asunto: '{{primerNombre}}, nos falta un dato suyo',
    cuerpo: `{{saludo}}:

Para poder formalizar su inscripción en {{accionFormacion}} nos hace falta completar su ficha.

Es cosa de tres minutos. Si prefiere, llámenos y lo hacemos por teléfono.

{{gremio}}`,
  },
  {
    nombre: 'Recordatorio: arranca su curso',
    etapas: ['INSCRITO'],
    asunto: 'Su formación arranca el {{fechaInicio}}',
    cuerpo: `{{saludo}}:

Le recordamos que {{accionFormacion}} arranca el {{fechaInicio}}.

Lugar: {{ubicacion}}
Modalidad: {{modalidad}}
Grupo: {{grupo}}

Lo esperamos.

{{gremio}}`,
  },
  {
    nombre: 'Su asesor se presenta',
    etapas: ['CONTACTADO', 'DATOS_COMPLETOS', 'INSCRITO'],
    asunto: '{{primerNombre}}, soy {{asesor}} y lo acompaño en su proceso',
    cuerpo: `{{saludo}}:

Mi nombre es {{asesor}} y voy a acompañarlo durante su formación con {{gremio}}.

Cualquier duda que le surja, escríbame a este correo.

{{asesor}}
{{gremio}}`,
  },
  {
    /// A propósito sin variables: enseña que una plantilla
    /// puede no llevar ninguna, y esa le sirve a todo el
    /// mundo aunque su ficha esté a medias.
    nombre: 'Aviso general (sin datos personales)',
    asunto: 'Cambio de fecha en la jornada de inducción',
    cuerpo: `Buen día:

La jornada de inducción se corre para la próxima semana. Les confirmamos día y hora en los próximos días.

Gracias por su paciencia.`,
  },
];

// ---------------------------------------------------------------------------
// Las campañas.

type Guion = {
  nombre: string;
  asunto: string;
  cuerpo: string;
  estado: EstadoCampana;
  /// Cuántos destinatarios coger de la base.
  cuantos: number;
  /// Hace cuántos días se lanzó.
  hace: number;
  /// De los enviados, qué proporción abrió y cuántos de esos
  /// pulsaron. Repartidos como se reparten de verdad: abrir
  /// es común, pulsar no.
  abren: number;
  pulsan: number;
  /// Cuántos se quedaron fuera, y por qué.
  omitidos?: number;
  fallidos?: number;
};

const GUIONES: Guion[] = [
  {
    nombre: `${MARCA} Bienvenida grupo 1`,
    asunto: 'Quedó inscrito en su formación',
    cuerpo:
      'Buen día:\n\nConfirmamos su inscripción. En los próximos días le llega la citación con el sitio y la hora.\n\nGracias por inscribirse.',
    estado: EstadoCampana.TERMINADA,
    cuantos: 42,
    hace: 21,
    abren: 0.62,
    pulsan: 0.24,
    fallidos: 2,
  },
  {
    nombre: `${MARCA} Recordatorio de inicio`,
    asunto: 'Su curso arranca la próxima semana',
    cuerpo:
      'Buen día:\n\nLe recordamos que su formación arranca la próxima semana.\n\nSi ya no puede asistir, avísenos para liberar el cupo.',
    estado: EstadoCampana.TERMINADA,
    cuantos: 35,
    hace: 12,
    abren: 0.71,
    pulsan: 0.31,
    omitidos: 3,
  },
  {
    nombre: `${MARCA} Encuesta de satisfacción`,
    asunto: '¿Cómo le pareció la formación?',
    cuerpo:
      'Buen día:\n\nNos ayudaría mucho saber qué le pareció la formación. Son dos preguntas.\n\nGracias.',
    estado: EstadoCampana.TERMINADA,
    cuantos: 28,
    hace: 5,
    abren: 0.39,
    pulsan: 0.11,
    fallidos: 1,
  },
  {
    /// Una pausada, para que se vea el estado. Sus
    /// destinatarios están TODOS resueltos: ni uno pendiente,
    /// o al reanudarla saldrían correos de verdad.
    nombre: `${MARCA} Jornada de inducción`,
    asunto: 'Jornada de inducción: confirme su asistencia',
    cuerpo:
      'Buen día:\n\nLa jornada de inducción es el próximo jueves. Confírmenos si puede asistir.',
    estado: EstadoCampana.PAUSADA,
    cuantos: 18,
    hace: 2,
    abren: 0.44,
    pulsan: 0.17,
  },
  {
    /// En borrador no lleva destinatarios: la lista se
    /// congela al lanzar, y esta no se ha lanzado.
    nombre: `${MARCA} Convocatoria segundo semestre`,
    asunto: 'Abrimos inscripciones para el segundo semestre',
    cuerpo:
      'Buen día:\n\nAbrimos inscripciones para la siguiente cohorte.\n\nEscríbanos si le interesa.',
    estado: EstadoCampana.BORRADOR,
    cuantos: 0,
    hace: 0,
    abren: 0,
    pulsan: 0,
  },
];

const MOTIVOS_OMITIDO = [
  'Ya había recibido dos correos hoy.',
  'Le faltan datos que la plantilla necesita: grupo.',
  'Se dio de baja de los envíos.',
];

const MOTIVOS_FALLIDO = [
  'El servidor de destino rechazó el correo: buzón inexistente.',
  'El buzón está lleno.',
];

async function sembrar() {
  comprobarQueEsPruebas();

  const convenios = await prisma.convenio.findMany({
    select: { id: true, sigla: true, nombre: true },
  });
  if (convenios.length === 0) {
    console.error('  No hay convenios. Corra primero db:sembrar-prueba.');
    process.exit(1);
  }

  // ── plantillas ──
  let plantillasPuestas = 0;
  for (const p of PLANTILLAS) {
    const ya = await prisma.plantillaCorreo.findFirst({
      where: { nombre: p.nombre },
      select: { id: true },
    });
    if (ya) continue;
    await prisma.plantillaCorreo.create({
      data: {
        nombre: p.nombre,
        asunto: p.asunto,
        cuerpo: p.cuerpo,
        /// Sin etapas: sirve en cualquiera. Es el caso del
        /// aviso general, que no afirma nada sobre el estado
        /// de nadie.
        etapasPermitidas: (p.etapas ?? []) as EtapaParticipante[],
      },
    });
    plantillasPuestas += 1;
  }

  // ── campañas ──
  // se rehacen enteras: así se puede volver a correr esto sin
  // ir acumulando copias
  const viejas = await prisma.campana.findMany({
    where: { nombre: { startsWith: MARCA } },
    select: { id: true },
  });
  if (viejas.length > 0) {
    await prisma.campana.deleteMany({
      where: { id: { in: viejas.map((c) => c.id) } },
    });
  }

  let campanas = 0;
  let destinatarios = 0;

  for (const [i, convenio] of convenios.entries()) {
    /// Solo gente de prueba. Los correos son inventados, pero
    /// aun así: marcar como «enviado» algo que nunca se mandó
    /// a una persona real deja un registro falso en su ficha.
    const gente = await prisma.participante.findMany({
      where: {
        convenioId: convenio.id,
        /// `esDePrueba` cuelga de la persona, no del
        /// participante: la marca es de quién es, no de en
        /// qué está inscrito.
        persona: { esDePrueba: true, correo: { not: null } },
      },
      select: { id: true, persona: { select: { correo: true } } },
      orderBy: { creadoEn: 'asc' },
    });

    if (gente.length === 0) {
      console.warn(
        `  ${convenio.sigla ?? convenio.nombre}: sin gente de prueba con correo, se salta.`,
      );
      continue;
    }

    for (const [j, g] of GUIONES.entries()) {
      const azar = dado((i + 1) * 1000 + j * 37);
      const lanzada = g.cuantos > 0 ? diasAtras(g.hace) : null;

      const campana = await prisma.campana.create({
        data: {
          convenioId: convenio.id,
          nombre: g.nombre,
          asunto: g.asunto,
          cuerpo: g.cuerpo,
          segmento: { todos: true },
          estado: g.estado,
          lanzadaEn: lanzada,
          terminadaEn:
            g.estado === EstadoCampana.TERMINADA ? diasAtras(g.hace - 1) : null,
        },
        select: { id: true },
      });
      campanas += 1;

      if (g.cuantos === 0) continue;

      const elegidos = gente.slice(0, Math.min(g.cuantos, gente.length));
      const nOmitidos = g.omitidos ?? 0;
      const nFallidos = g.fallidos ?? 0;

      const filas = elegidos.map((p, k) => {
        const correo = p.persona.correo as string;
        const base = {
          campanaId: campana.id,
          participanteId: p.id,
          correo,
        };

        if (k < nOmitidos) {
          return {
            ...base,
            estado: EstadoDestinatario.OMITIDO,
            motivo: MOTIVOS_OMITIDO[k % MOTIVOS_OMITIDO.length],
          };
        }
        if (k < nOmitidos + nFallidos) {
          return {
            ...base,
            estado: EstadoDestinatario.FALLIDO,
            motivo: MOTIVOS_FALLIDO[k % MOTIVOS_FALLIDO.length],
            intentos: 3,
          };
        }

        /// Enviado. La hora se reparte a lo largo de la
        /// jornada, que es como sale de verdad: de a uno, en
        /// horario de oficina.
        const minuto = Math.floor(azar() * 9 * 60);
        const enviadoEn = new Date(
          (lanzada as Date).getTime() + minuto * 60_000,
        );

        const abrio = azar() < g.abren;
        /// Se pulsa DESPUÉS de abrir, nunca antes. Un clic sin
        /// apertura es posible en la vida real -- el pixel se
        /// bloquea y el enlace no -- pero sembrarlo así
        /// enseñaría un informe que se contradice.
        const pulso = abrio && azar() < g.pulsan;

        /// Se abre a las horas, no en el mismo segundo: nadie
        /// tiene el correo abierto esperando.
        const abiertoEn = abrio
          ? new Date(enviadoEn.getTime() + Math.floor(azar() * 30 * 3_600_000))
          : null;

        return {
          ...base,
          estado: EstadoDestinatario.ENVIADO,
          enviadoEn,
          intentos: 1,
          abiertoEn,
          /// Más de una apertura es lo normal: el mismo
          /// correo se abre en el teléfono y luego en el
          /// computador.
          aperturas: abrio ? 1 + Math.floor(azar() * 3) : 0,
          clicEn: pulso
            ? new Date(
                (abiertoEn as Date).getTime() +
                  Math.floor(azar() * 20 * 60_000),
              )
            : null,
          clics: pulso ? 1 + Math.floor(azar() * 2) : 0,
        };
      });

      await prisma.destinatarioCampana.createMany({
        data: filas,
        skipDuplicates: true,
      });
      destinatarios += filas.length;
    }
  }

  /// La comprobación que de verdad importa: que no quede ni
  /// un pendiente suelto en una campaña que el worker mire.
  const peligro = await prisma.destinatarioCampana.count({
    where: {
      estado: EstadoDestinatario.PENDIENTE,
      campana: { nombre: { startsWith: MARCA } },
    },
  });
  if (peligro > 0) {
    console.error(
      `\n  ALTO: quedaron ${peligro} destinatarios PENDIENTES en campañas de demo.`,
    );
    console.error('  Eso le mandaría correos de verdad a gente. Revíselo.\n');
    process.exit(1);
  }

  console.log(`\n  Listo.`);
  console.log(`   · ${plantillasPuestas} plantillas nuevas`);
  console.log(`   · ${campanas} campañas de demo`);
  console.log(`   · ${destinatarios} destinatarios, todos ya resueltos`);
  console.log(`\n  Se reconocen por «${MARCA}» en el nombre.`);
  console.log(`  Ninguna puede enviar nada: no tienen pendientes.\n`);
}

sembrar()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
