/**
 * Crea los dos formularios iniciales con la estructura que hoy está escrita a
 * mano en el frontend.
 *
 *   pnpm --filter backend db:sembrar-formularios
 *
 * Es idempotente por slug: si el formulario ya existe no se toca, para no
 * pisar lo que un administrador haya cambiado desde el panel.
 */

import {
  CampoNucleo,
  PrismaClient,
  TipoPregunta,
  type Prisma,
} from '../../generated/prisma';

const prisma = new PrismaClient();

type PreguntaSemilla = {
  etiqueta: string;
  tipo: TipoPregunta;
  campoNucleo?: CampoNucleo;
  ayuda?: string;
  marcador?: string;
  obligatoria?: boolean;
  opciones?: string[];
  /** Etiqueta de la pregunta de la que depende, y valor que la muestra. */
  dependeDe?: { etiqueta: string; valor: string };
};

type SeccionSemilla = {
  titulo: string;
  descripcion?: string;
  preguntas: PreguntaSemilla[];
};

const SECCIONES_COMUNES = (
  etiquetaOrganizacion: string,
  ayudaOrganizacion: string,
  gremios: string[],
): SeccionSemilla[] => [
  {
    titulo: '¿Qué formación desea reservar?',
    descripcion: 'Elija el curso y después el lugar desde el que participará.',
    preguntas: [
      {
        etiqueta: 'Curso',
        tipo: TipoPregunta.SELECCION_UNICA,
        campoNucleo: CampoNucleo.ACCION_FORMACION,
      },
      {
        etiqueta: 'Ciudad o departamento',
        tipo: TipoPregunta.SELECCION_UNICA,
        campoNucleo: CampoNucleo.OFERTA,
      },
    ],
  },
  {
    titulo: 'Datos de la organización',
    preguntas: [
      {
        etiqueta: 'NIT',
        tipo: TipoPregunta.TEXTO_CORTO,
        campoNucleo: CampoNucleo.EMPRESA_NIT,
        marcador: '860505081',
        ayuda:
          'Sin puntos. Con o sin dígito de verificación. Es lo que le permitirá ' +
          'volver a consultar o modificar su reserva.',
      },
      {
        etiqueta: etiquetaOrganizacion,
        tipo: TipoPregunta.TEXTO_CORTO,
        campoNucleo: CampoNucleo.EMPRESA_RAZON_SOCIAL,
        ayuda: ayudaOrganizacion,
      },
      {
        etiqueta: 'Número de colaboradores',
        tipo: TipoPregunta.NUMERO,
        campoNucleo: CampoNucleo.EMPRESA_COLABORADORES,
      },
      ...(gremios.length
        ? [
            {
              etiqueta: `¿Es afiliado o aliado a alguno de estos ${
                gremios.length === 2 ? 'dos gremios' : 'gremios'
              }: ${gremios.join(' o ')}?`,
              tipo: TipoPregunta.SELECCION_UNICA,
              campoNucleo: CampoNucleo.EMPRESA_RED_ASOCIADA,
              opciones: [...gremios, 'Ambos', 'Otro', 'Ninguno'],
            } satisfies PreguntaSemilla,
            {
              etiqueta: '¿A cuál?',
              tipo: TipoPregunta.TEXTO_CORTO,
              campoNucleo: CampoNucleo.EMPRESA_RED_ASOCIADA_OTRA,
              marcador: 'Nombre del gremio o asociación',
              dependeDe: {
                etiqueta: `¿Es afiliado o aliado a alguno de estos ${
                  gremios.length === 2 ? 'dos gremios' : 'gremios'
                }: ${gremios.join(' o ')}?`,
                valor: 'Otro',
              },
            } satisfies PreguntaSemilla,
          ]
        : []),
    ],
  },
  {
    titulo: 'Datos de quien hace la reserva',
    descripcion:
      'No tiene que ser quien asista a la formación. Usaremos estos datos para ' +
      'contactarla sobre los cupos reservados.',
    preguntas: [
      {
        etiqueta: 'Nombre completo',
        tipo: TipoPregunta.TEXTO_CORTO,
        campoNucleo: CampoNucleo.CONTACTO_NOMBRE,
      },
      {
        etiqueta: 'Correo electrónico corporativo',
        tipo: TipoPregunta.CORREO,
        campoNucleo: CampoNucleo.CONTACTO_CORREO,
      },
      {
        etiqueta: 'Celular',
        tipo: TipoPregunta.TELEFONO,
        campoNucleo: CampoNucleo.CONTACTO_CELULAR,
      },
      {
        etiqueta: 'Cargo',
        tipo: TipoPregunta.TEXTO_CORTO,
        campoNucleo: CampoNucleo.CONTACTO_CARGO,
      },
    ],
  },
  {
    titulo: 'Cupos',
    preguntas: [
      {
        etiqueta: '¿Cuántos cupos desea reservar?',
        tipo: TipoPregunta.NUMERO,
        campoNucleo: CampoNucleo.CUPOS_SOLICITADOS,
        ayuda: 'Si pide más de los disponibles, la diferencia queda en lista de espera.',
      },
    ],
  },
  {
    titulo: 'Autorizaciones',
    preguntas: [
      {
        etiqueta:
          'Acepto los términos de participación y me comprometo a garantizar la ' +
          'asistencia de las personas inscritas con estos cupos.',
        tipo: TipoPregunta.CASILLA,
        campoNucleo: CampoNucleo.ACEPTA_TERMINOS,
      },
      {
        etiqueta:
          'Autorizo el tratamiento de mis datos personales y de los de mi ' +
          'organización conforme a la Ley 1581 de 2012.',
        tipo: TipoPregunta.CASILLA,
        campoNucleo: CampoNucleo.ACEPTA_POLITICA_DATOS,
      },
    ],
  },
];

const FORMULARIOS: Array<{
  convenioSlug: string;
  slug: string;
  titulo: string;
  descripcion: string;
  secciones: SeccionSemilla[];
}> = [
  {
    convenioSlug: 'britcham-adee',
    slug: 'britcham-adee',
    titulo: 'Reserva de cupos — BRITCHAM y ADEE',
    descripcion:
      'La formación es gratuita y los cupos son limitados. Una organización ' +
      'puede reservar varios cupos; quien diligencia este formulario no tiene ' +
      'que ser quien asista.',
    secciones: SECCIONES_COMUNES(
      'Nombre de la empresa',
      'Razón social como aparece en el RUT.',
      ['BRITCHAM', 'ADEE'],
    ),
  },
  {
    convenioSlug: 'adecopria',
    slug: 'adecopria',
    titulo: 'Reserva de cupos — ADECOPRIA',
    descripcion:
      'La formación es gratuita y los cupos son limitados. Una institución ' +
      'puede reservar varios cupos; quien diligencia este formulario no tiene ' +
      'que ser quien asista.',
    // ADECOPRIA no tiene gremios: su público son instituciones educativas.
    secciones: SECCIONES_COMUNES(
      'Institución educativa',
      'Nombre de la institución como aparece en el RUT.',
      [],
    ),
  },
];

async function sembrar(entrada: (typeof FORMULARIOS)[number]) {
  const existente = await prisma.formulario.findUnique({ where: { slug: entrada.slug } });
  if (existente) {
    console.log(`${entrada.slug}: ya existe, no se toca.`);
    return;
  }

  const convenio = await prisma.convenio.findUnique({
    where: { slug: entrada.convenioSlug },
  });
  if (!convenio) {
    console.warn(`${entrada.slug}: no existe el convenio ${entrada.convenioSlug}.`);
    return;
  }

  const formulario = await prisma.formulario.create({
    data: {
      convenioId: convenio.id,
      slug: entrada.slug,
      titulo: entrada.titulo,
      descripcion: entrada.descripcion,
      // Nace en borrador aunque esté completo: publicar es una decisión de
      // quien administra, no del script.
      publicado: false,
    },
  });

  // Las dependencias se resuelven en una segunda pasada porque una pregunta
  // puede depender de otra que aún no existe cuando se crea.
  const porEtiqueta = new Map<string, string>();
  const pendientes: Array<{ id: string; etiquetaMadre: string; valor: string }> = [];
  let orden = 0;

  for (const [indice, seccion] of entrada.secciones.entries()) {
    const creada = await prisma.seccion.create({
      data: {
        formularioId: formulario.id,
        titulo: seccion.titulo,
        descripcion: seccion.descripcion,
        orden: indice,
      },
    });

    for (const pregunta of seccion.preguntas) {
      const datos: Prisma.PreguntaCreateInput = {
        formulario: { connect: { id: formulario.id } },
        seccion: { connect: { id: creada.id } },
        etiqueta: pregunta.etiqueta,
        tipo: pregunta.tipo,
        campoNucleo: pregunta.campoNucleo ?? null,
        ayuda: pregunta.ayuda,
        marcador: pregunta.marcador,
        obligatoria: pregunta.obligatoria ?? esObligatorio(pregunta.campoNucleo),
        orden: orden++,
      };

      const nueva = await prisma.pregunta.create({ data: datos });
      porEtiqueta.set(pregunta.etiqueta, nueva.id);

      for (const [i, opcion] of (pregunta.opciones ?? []).entries()) {
        await prisma.opcion.create({
          data: { preguntaId: nueva.id, etiqueta: opcion, valor: opcion, orden: i },
        });
      }

      if (pregunta.dependeDe) {
        pendientes.push({
          id: nueva.id,
          etiquetaMadre: pregunta.dependeDe.etiqueta,
          valor: pregunta.dependeDe.valor,
        });
      }
    }
  }

  for (const pendiente of pendientes) {
    const madre = porEtiqueta.get(pendiente.etiquetaMadre);
    if (!madre) continue;
    await prisma.pregunta.update({
      where: { id: pendiente.id },
      data: { dependeDePreguntaId: madre, dependeDeValor: pendiente.valor },
    });
  }

  const total = await prisma.pregunta.count({ where: { formularioId: formulario.id } });
  console.log(
    `${entrada.slug}: creado con ${entrada.secciones.length} secciones y ${total} preguntas (en borrador).`,
  );
}

/** Los campos que el sistema necesita nacen obligatorios. */
function esObligatorio(campo?: CampoNucleo): boolean {
  const requeridos: CampoNucleo[] = [
    CampoNucleo.EMPRESA_NIT,
    CampoNucleo.EMPRESA_RAZON_SOCIAL,
    CampoNucleo.CONTACTO_NOMBRE,
    CampoNucleo.CONTACTO_CORREO,
    CampoNucleo.ACCION_FORMACION,
    CampoNucleo.OFERTA,
    CampoNucleo.CUPOS_SOLICITADOS,
    CampoNucleo.ACEPTA_TERMINOS,
    CampoNucleo.ACEPTA_POLITICA_DATOS,
  ];
  return campo !== undefined && requeridos.includes(campo);
}

async function main() {
  for (const entrada of FORMULARIOS) {
    await sembrar(entrada);
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
