/** Crea los dos formularios iniciales. */

import {
  CampoNucleo,
  PrismaClient,
  TipoPregunta,
  type Prisma,
} from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';

// el 5433 es produccion, aunque diga localhost
exigirBaseSegura('La siembra de formularios');

const prisma = new PrismaClient();

type PreguntaSemilla = {
  etiqueta: string;
  tipo: TipoPregunta;
  campoNucleo?: CampoNucleo;
  ayuda?: string;
  marcador?: string;
  obligatoria?: boolean;
  opciones?: string[];
  /** De qué pregunta depende y con qué valor. */
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
    titulo: '¿Qué servicio necesita?',
    descripcion: 'Elija el servicio que le interesa y la ciudad desde la que nos escribe.',
    preguntas: [
      {
        etiqueta: 'Servicio de interés',
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
          'volver a consultar el estado de su solicitud.',
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
    titulo: 'Datos de contacto',
    descripcion:
      'Usaremos estos datos para comunicarnos con usted ' +
      'sobre su solicitud.',
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
    titulo: 'Alcance del requerimiento',
    preguntas: [
      {
        etiqueta: '¿Para cuántas personas necesita el servicio?',
        tipo: TipoPregunta.NUMERO,
        campoNucleo: CampoNucleo.CUPOS_SOLICITADOS,
        ayuda: 'Un estimado es suficiente. El alcance final se define en la propuesta.',
      },
    ],
  },
  {
    titulo: 'Autorizaciones',
    preguntas: [
      {
        etiqueta:
          'Acepto los términos y condiciones y autorizo que Grupo AE me contacte ' +
          'para atender esta solicitud.',
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
    slug: 'empresas',
    titulo: 'Solicitud de información — Empresas',
    descripcion:
      'Cuéntenos qué necesita su organización. Un asesor comercial se ' +
      'comunicará con usted para entender el requerimiento y preparar ' +
      'una propuesta.',
    secciones: SECCIONES_COMUNES(
      'Nombre de la empresa',
      'Razón social como aparece en el RUT.',
      [],
    ),
  },
  {
    convenioSlug: 'adecopria',
    slug: 'personas',
    titulo: 'Solicitud de información — Personas',
    descripcion:
      'Déjenos sus datos y el servicio que le interesa. Un asesor se ' +
      'comunicará con usted.',
    // ADECOPRIA no tiene gremios
    secciones: SECCIONES_COMUNES(
      'Institución educativa',
      'Nombre de la institución como aparece en el RUT.',
      [],
    ),
  },
];

/** Deja el gremio apuntando a su formulario. */
async function marcarGremio(convenioId: string, formularioId: string) {
  // no pisa lo que un admin eligio
  const { count } = await prisma.convenio.updateMany({
    where: { id: convenioId, formularioMarcaId: null },
    data: { formularioMarcaId: formularioId },
  });
  if (count) console.log('  y queda como marca del gremio.');
}

async function sembrar(entrada: (typeof FORMULARIOS)[number]) {
  const existente = await prisma.formulario.findUnique({ where: { slug: entrada.slug } });
  if (existente) {
    console.log(`${entrada.slug}: ya existe, no se toca.`);
    // pero el gremio puede seguir sin marca
    await marcarGremio(existente.convenioId, existente.id);
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
      // nace en borrador: publicar lo decide una persona
      publicado: false,
    },
  });

  await marcarGremio(convenio.id, formulario.id);

  // segunda pasada: la madre puede no existir aun
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

/** Los campos del sistema nacen obligatorios. */
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
