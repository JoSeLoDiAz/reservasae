/** Las preguntas de los dos formularios públicos. */

/**
 * ESTO NO ES UN CATÁLOGO: ES UNA PUERTA DE ENTRADA.
 *
 * Lo que había preguntaba «¿qué formación desea reservar?» y
 * «¿cuántos cupos desea reservar?»: quien llegaba tenía que elegir
 * un curso de una lista y decir cuántas sillas quería. Eso era el
 * mundo de la convocatoria —oferta cerrada, cupos, gremios— y ese
 * mundo se acabó. Aquí una empresa o una persona cuenta QUÉ
 * NECESITA y deja cómo contactarla; lo que nace al enviar es una
 * oportunidad en CAPTADO, no una reserva contra un cupo.
 *
 * De ahí que NO se use ninguno de estos campos del núcleo:
 * `ACCION_FORMACION` y `OFERTA` (sus opciones salían del catálogo
 * publicado), `CUPOS_SOLICITADOS` (descuenta cupos de una oferta) y
 * `EMPRESA_RED_ASOCIADA` (BRITCHAM y ADEE, los gremios del convenio
 * anterior). Todo lo que no mapea a la ficha va como pregunta
 * libre, sin `campoNucleo`, y el asesor lo lee en la oportunidad.
 *
 * LOS DOS FORMULARIOS YA NO COMPARTEN SECCIONES, y es deliberado.
 * Antes salían de una misma función y por eso al de personas se le
 * pedía NIT y razón social. No es un detalle cosmético:
 * `captacion/embudo-del-formulario.ts` decide el embudo mirando si
 * el formulario PREGUNTA el NIT, así que un formulario de personas
 * que lo pregunta manda sus leads al tablero de empresas, que es el
 * que se mira para pronosticar.
 *
 * Correo obligatorio y celular no, en los dos: la regla de
 * `captacion/hay-como-responder.ts` es que con una vía de contacto
 * sobra, y cada campo obligatorio de un formulario público se paga
 * en gente que no lo termina.
 *
 * VOLVER A CORRERLO REESCRIBE LAS PREGUNTAS. Antes se plantaba con
 * «ya existe, no se toca», que es justo lo que dejaba las preguntas
 * viejas sembradas para siempre. Nada se borra: lo que ya no se
 * pregunta se ARCHIVA —`Respuesta.pregunta` no lleva `onDelete`, así
 * que una pregunta contestada no se puede borrar aunque se
 * quisiera— y las respuestas viejas siguen legibles con su etiqueta
 * congelada. `publicado` tampoco se toca: publicar lo decide una
 * persona.
 */

import {
  CampoNucleo,
  PrismaClient,
  TipoPregunta,
  type Opcion,
  type Pregunta,
} from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';

// el 5433 es produccion, aunque diga localhost
exigirBaseSegura('La siembra de formularios');

const prisma = new PrismaClient();

/** Lo que se ve y lo que se guarda: `[etiqueta, valor]`. */
type OpcionSemilla = [etiqueta: string, valor: string];

type PreguntaSemilla = {
  etiqueta: string;
  tipo: TipoPregunta;
  campoNucleo?: CampoNucleo;
  ayuda?: string;
  marcador?: string;
  obligatoria?: boolean;
  opciones?: OpcionSemilla[];
  /** De qué pregunta depende y con qué valor de opción. */
  dependeDe?: { etiqueta: string; valor: string };
};

type SeccionSemilla = {
  titulo: string;
  descripcion?: string;
  preguntas: PreguntaSemilla[];
};

/// Se pregunta igual en los dos: el canal es lo que dice qué
/// campaña trajo el lead, y con dos listas distintas no se suma.
const COMO_SE_ENTERO: OpcionSemilla[] = [
  ['Búsqueda en internet', 'buscador'],
  ['Redes sociales', 'redes'],
  ['Correo de Grupo AE', 'correo'],
  ['Alguien nos recomendó', 'referido'],
  ['Feria o evento', 'evento'],
  ['Un asesor me contactó', 'asesor'],
  ['Otro medio', 'otro'],
];

const PREGUNTA_ORIGEN: PreguntaSemilla = {
  etiqueta: '¿Cómo se enteró de nosotros?',
  tipo: TipoPregunta.SELECCION_UNICA,
  opciones: COMO_SE_ENTERO,
};

// --- Empresas ---------------------------------------------------

const SECCIONES_EMPRESAS: SeccionSemilla[] = [
  {
    titulo: 'Su empresa',
    preguntas: [
      {
        etiqueta: 'NIT',
        tipo: TipoPregunta.TEXTO_CORTO,
        campoNucleo: CampoNucleo.EMPRESA_NIT,
        marcador: '860505081',
        obligatoria: true,
        ayuda: 'Sin puntos, con o sin dígito de verificación.',
      },
      {
        etiqueta: 'Razón social',
        tipo: TipoPregunta.TEXTO_CORTO,
        campoNucleo: CampoNucleo.EMPRESA_RAZON_SOCIAL,
        obligatoria: true,
        ayuda: 'Como aparece en el RUT.',
      },
      {
        etiqueta: 'Sector',
        tipo: TipoPregunta.SELECCION_UNICA,
        opciones: [
          ['Industria y manufactura', 'industria'],
          ['Construcción', 'construccion'],
          ['Comercio', 'comercio'],
          ['Transporte y logística', 'transporte'],
          ['Agroindustria', 'agroindustria'],
          ['Minería, energía e hidrocarburos', 'energia'],
          ['Salud', 'salud'],
          ['Educación', 'educacion'],
          ['Servicios financieros', 'financiero'],
          ['Tecnología y comunicaciones', 'tecnologia'],
          ['Hotelería, turismo y alimentos', 'turismo'],
          ['Servicios profesionales', 'servicios'],
          ['Sector público', 'publico'],
          ['Otro', 'otro'],
        ],
      },
      {
        etiqueta: '¿Cuál?',
        tipo: TipoPregunta.TEXTO_CORTO,
        dependeDe: { etiqueta: 'Sector', valor: 'otro' },
      },
      {
        etiqueta: 'Número de colaboradores',
        tipo: TipoPregunta.NUMERO,
        campoNucleo: CampoNucleo.EMPRESA_COLABORADORES,
        marcador: '120',
      },
    ],
  },
  {
    titulo: 'Datos de contacto',
    preguntas: [
      {
        etiqueta: 'Nombre completo',
        tipo: TipoPregunta.TEXTO_CORTO,
        campoNucleo: CampoNucleo.CONTACTO_NOMBRE,
        obligatoria: true,
      },
      {
        etiqueta: 'Cargo',
        tipo: TipoPregunta.TEXTO_CORTO,
        campoNucleo: CampoNucleo.CONTACTO_CARGO,
      },
      {
        etiqueta: 'Correo corporativo',
        tipo: TipoPregunta.CORREO,
        campoNucleo: CampoNucleo.CONTACTO_CORREO,
        obligatoria: true,
      },
      {
        etiqueta: 'Celular',
        tipo: TipoPregunta.TELEFONO,
        campoNucleo: CampoNucleo.CONTACTO_CELULAR,
      },
    ],
  },
  {
    titulo: 'Lo que necesita',
    preguntas: [
      {
        etiqueta: '¿Qué necesidad quiere resolver su empresa?',
        tipo: TipoPregunta.TEXTO_LARGO,
        obligatoria: true,
        marcador:
          'Por ejemplo: migrar 80 cuentas de correo a Google Workspace antes ' +
          'de fin de año.',
      },
      {
        etiqueta: '¿Para cuántas personas?',
        tipo: TipoPregunta.NUMERO,
        marcador: '40',
        ayuda: 'Un estimado basta.',
      },
      {
        etiqueta: '¿Para cuándo lo necesita?',
        tipo: TipoPregunta.SELECCION_UNICA,
        opciones: [
          ['Este mes', 'este-mes'],
          ['En los próximos tres meses', 'tres-meses'],
          ['En más de tres meses', 'despues'],
          ['Todavía sin fecha', 'sin-fecha'],
        ],
      },
      {
        /// La que califica. Con una salida honesta —«todavía sin
        /// definir»— porque obligar a inventarse una cifra ensucia
        /// el dato con el que se prioriza la cartera.
        etiqueta: 'Rango de presupuesto',
        tipo: TipoPregunta.SELECCION_UNICA,
        obligatoria: true,
        ayuda: 'Orienta el alcance de la propuesta; no compromete nada.',
        opciones: [
          ['Menos de $10 millones', 'menos-10'],
          ['Entre $10 y $30 millones', '10-30'],
          ['Entre $30 y $60 millones', '30-60'],
          ['Entre $60 y $100 millones', '60-100'],
          ['Más de $100 millones', 'mas-100'],
          ['Todavía sin definir', 'sin-definir'],
        ],
      },
    ],
  },
  {
    titulo: 'Antes de enviar',
    preguntas: [
      {
        etiqueta:
          'Autorizo a Grupo AE a tratar mis datos personales y los de mi ' +
          'empresa para atender esta solicitud, conforme a la Ley 1581 de 2012.',
        tipo: TipoPregunta.CASILLA,
        campoNucleo: CampoNucleo.ACEPTA_POLITICA_DATOS,
        obligatoria: true,
      },
      PREGUNTA_ORIGEN,
    ],
  },
];

// --- Personas ---------------------------------------------------

/// Más corto a propósito: el ciclo son días. Aquí no hay NIT
/// —es lo que lo manda al embudo de personas—, ni razón social,
/// ni tramos de presupuesto.
const SECCIONES_PERSONAS: SeccionSemilla[] = [
  {
    titulo: 'Sus datos',
    preguntas: [
      {
        etiqueta: 'Nombre completo',
        tipo: TipoPregunta.TEXTO_CORTO,
        campoNucleo: CampoNucleo.CONTACTO_NOMBRE,
        obligatoria: true,
      },
      {
        etiqueta: 'Correo electrónico',
        tipo: TipoPregunta.CORREO,
        campoNucleo: CampoNucleo.CONTACTO_CORREO,
        obligatoria: true,
      },
      {
        etiqueta: 'Celular',
        tipo: TipoPregunta.TELEFONO,
        campoNucleo: CampoNucleo.CONTACTO_CELULAR,
      },
      {
        etiqueta: 'Ciudad',
        tipo: TipoPregunta.TEXTO_CORTO,
        obligatoria: true,
        marcador: 'Bogotá',
      },
    ],
  },
  {
    titulo: 'Lo que busca',
    preguntas: [
      {
        etiqueta: '¿Qué le interesa?',
        tipo: TipoPregunta.TEXTO_LARGO,
        obligatoria: true,
        marcador:
          'Por ejemplo: un curso de Google Workspace o un Chromebook para estudiar.',
      },
      {
        etiqueta: '¿Para cuándo lo necesita?',
        tipo: TipoPregunta.SELECCION_UNICA,
        opciones: [
          ['Cuanto antes', 'ya'],
          ['En el próximo mes', 'un-mes'],
          ['En los próximos tres meses', 'tres-meses'],
          ['Todavía estoy averiguando', 'averiguando'],
        ],
      },
    ],
  },
  {
    titulo: 'Antes de enviar',
    preguntas: [
      {
        etiqueta:
          'Autorizo a Grupo AE a tratar mis datos personales para atender ' +
          'esta solicitud, conforme a la Ley 1581 de 2012.',
        tipo: TipoPregunta.CASILLA,
        campoNucleo: CampoNucleo.ACEPTA_POLITICA_DATOS,
        obligatoria: true,
      },
      PREGUNTA_ORIGEN,
    ],
  },
];

type FormularioSemilla = {
  /**
   * De qué unidad de negocio cuelga, por orden de preferencia.
   * Van varios porque los slugs del convenio anterior
   * —`britcham-adee`, `adecopria`— siguen en bases que no se han
   * vuelto a sembrar, y un guión que solo conoce el nombre de hoy
   * no arrancaría allí.
   */
  convenioSlugs: string[];
  slug: string;
  titulo: string;
  descripcion: string;
  secciones: SeccionSemilla[];
};

const FORMULARIOS: FormularioSemilla[] = [
  {
    convenioSlugs: ['grupo-ae', 'britcham-adee'],
    slug: 'empresas',
    titulo: 'Contacto de empresas',
    descripcion:
      'Cuéntenos qué necesita su organización. Un asesor se comunica con ' +
      'usted para precisar el alcance y preparar una propuesta.',
    secciones: SECCIONES_EMPRESAS,
  },
  {
    convenioSlugs: ['grupo-ae-b2c', 'adecopria'],
    slug: 'personas',
    titulo: 'Contacto de personas',
    descripcion:
      'Déjenos sus datos y lo que busca. Un asesor se comunica con usted ' +
      'para orientarlo.',
    secciones: SECCIONES_PERSONAS,
  },
];

/** Para comparar etiquetas sin que una tilde cuente como otra pregunta. */
function clave(etiqueta: string): string {
  return etiqueta
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** La unidad de negocio de la que cuelga el formulario. */
async function convenioDe(entrada: FormularioSemilla) {
  for (const slug of entrada.convenioSlugs) {
    const convenio = await prisma.convenio.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (convenio) return convenio;
  }

  // ninguno de los nombres conocidos: cuelga del primero activo
  const primero = await prisma.convenio.findFirst({
    where: { activo: true },
    orderBy: { orden: 'asc' },
    select: { id: true, slug: true },
  });
  if (primero) {
    console.warn(
      `${entrada.slug}: no existe ${entrada.convenioSlugs.join(' ni ')}; ` +
        `cuelga de «${primero.slug}».`,
    );
  }
  return primero;
}

/** Deja el convenio apuntando a su formulario. */
async function marcarConvenio(convenioId: string, formularioId: string) {
  // no pisa lo que un admin eligio
  const { count } = await prisma.convenio.updateMany({
    where: { id: convenioId, formularioMarcaId: null },
    data: { formularioMarcaId: formularioId },
  });
  if (count) console.log('  y queda como marca del convenio.');
}

/**
 * Deja las opciones como dicen las semillas.
 *
 * La llave es el `valor`, no la etiqueta: es lo que quedó guardado
 * en las respuestas y en los filtros, así que reescribir un texto
 * —«Otro» a «Otro medio»— no puede partir el histórico en dos.
 */
async function reconciliarOpciones(
  preguntaId: string,
  declaradas: OpcionSemilla[],
  previas: Opcion[],
) {
  const vivas = new Set<string>();

  for (const [orden, [etiqueta, valor]] of declaradas.entries()) {
    vivas.add(valor);
    const previa = previas.find((o) => o.valor === valor);
    if (previa) {
      await prisma.opcion.update({
        where: { id: previa.id },
        data: { etiqueta, orden, archivada: false },
      });
    } else {
      await prisma.opcion.create({
        data: { preguntaId, etiqueta, valor, orden },
      });
    }
  }

  for (const previa of previas) {
    if (vivas.has(previa.valor) || previa.archivada) continue;
    await prisma.opcion.update({
      where: { id: previa.id },
      data: { archivada: true },
    });
  }
}

/**
 * Con qué pregunta ya sembrada se corresponde una semilla.
 *
 * Por `campoNucleo` cuando lo tiene —es único por formulario, así
 * que no hay dos candidatas— y por etiqueta cuando es libre. Una
 * semilla libre NUNCA se queda con una pregunta que ya lleva un
 * campo del núcleo: moverle el campo a otra fila es lo que rompe
 * el `@@unique([formularioId, campoNucleo])`.
 */
function buscarPrevia(
  semilla: PreguntaSemilla,
  porCampo: Map<CampoNucleo, Pregunta & { opciones: Opcion[] }>,
  porEtiqueta: Map<string, Pregunta & { opciones: Opcion[] }>,
  usadas: Set<string>,
) {
  if (semilla.campoNucleo) {
    const previa = porCampo.get(semilla.campoNucleo);
    return previa && !usadas.has(previa.id) ? previa : undefined;
  }
  const previa = porEtiqueta.get(clave(semilla.etiqueta));
  if (!previa || previa.campoNucleo || usadas.has(previa.id)) return undefined;
  return previa;
}

async function sembrar(entrada: FormularioSemilla) {
  const existente = await prisma.formulario.findUnique({
    where: { slug: entrada.slug },
    select: { id: true, convenioId: true },
  });

  let formularioId: string;
  let convenioId: string;

  if (existente) {
    // `publicado` no se toca: publicar lo decide una persona
    await prisma.formulario.update({
      where: { id: existente.id },
      data: { titulo: entrada.titulo, descripcion: entrada.descripcion },
    });
    formularioId = existente.id;
    convenioId = existente.convenioId;
  } else {
    const convenio = await convenioDe(entrada);
    if (!convenio) {
      console.warn(`${entrada.slug}: no hay ningún convenio en la base.`);
      return;
    }
    const creado = await prisma.formulario.create({
      data: {
        convenioId: convenio.id,
        slug: entrada.slug,
        titulo: entrada.titulo,
        descripcion: entrada.descripcion,
        // nace en borrador: publicar lo decide una persona
        publicado: false,
      },
      select: { id: true },
    });
    formularioId = creado.id;
    convenioId = convenio.id;
  }

  await marcarConvenio(convenioId, formularioId);

  // las secciones se reusan por posicion: conservan su id y no
  // quedan bloques huerfanos con el titulo viejo
  const seccionesPrevias = await prisma.seccion.findMany({
    where: { formularioId },
    orderBy: { orden: 'asc' },
  });
  const seccionIds: string[] = [];
  for (const [orden, seccion] of entrada.secciones.entries()) {
    const previa = seccionesPrevias[orden];
    const datos = {
      titulo: seccion.titulo,
      descripcion: seccion.descripcion ?? null,
      orden,
    };
    const guardada = previa
      ? await prisma.seccion.update({ where: { id: previa.id }, data: datos })
      : await prisma.seccion.create({ data: { formularioId, ...datos } });
    seccionIds.push(guardada.id);
  }

  const preguntasPrevias = await prisma.pregunta.findMany({
    where: { formularioId },
    include: { opciones: true },
  });

  const porCampo = new Map<CampoNucleo, (typeof preguntasPrevias)[number]>();
  const porEtiqueta = new Map<string, (typeof preguntasPrevias)[number]>();
  for (const previa of preguntasPrevias) {
    if (previa.campoNucleo) porCampo.set(previa.campoNucleo, previa);
    // la primera gana: si hay dos con el mismo texto, la otra se archiva
    else if (!porEtiqueta.has(clave(previa.etiqueta))) {
      porEtiqueta.set(clave(previa.etiqueta), previa);
    }
  }

  const usadas = new Set<string>();
  const idPorEtiqueta = new Map<string, string>();
  const pendientes: Array<{ id: string; madre: string; valor: string }> = [];
  let creadas = 0;
  let orden = 0;

  for (const [indice, seccion] of entrada.secciones.entries()) {
    for (const semilla of seccion.preguntas) {
      const previa = buscarPrevia(semilla, porCampo, porEtiqueta, usadas);
      const datos = {
        seccionId: seccionIds[indice],
        etiqueta: semilla.etiqueta,
        tipo: semilla.tipo,
        campoNucleo: semilla.campoNucleo ?? null,
        ayuda: semilla.ayuda ?? null,
        marcador: semilla.marcador ?? null,
        obligatoria: semilla.obligatoria ?? false,
        orden: orden++,
        archivada: false,
        // se rellenan en la segunda pasada
        dependeDePreguntaId: null,
        dependeDeValor: null,
      };

      const guardada = previa
        ? await prisma.pregunta.update({
            where: { id: previa.id },
            data: datos,
          })
        : await prisma.pregunta.create({ data: { formularioId, ...datos } });

      if (!previa) creadas++;
      usadas.add(guardada.id);
      idPorEtiqueta.set(clave(semilla.etiqueta), guardada.id);

      await reconciliarOpciones(
        guardada.id,
        semilla.opciones ?? [],
        previa?.opciones ?? [],
      );

      if (semilla.dependeDe) {
        pendientes.push({
          id: guardada.id,
          madre: clave(semilla.dependeDe.etiqueta),
          valor: semilla.dependeDe.valor,
        });
      }
    }
  }

  // segunda pasada: la madre puede no existir aun
  for (const pendiente of pendientes) {
    const madre = idPorEtiqueta.get(pendiente.madre);
    if (!madre) continue;
    await prisma.pregunta.update({
      where: { id: pendiente.id },
      data: { dependeDePreguntaId: madre, dependeDeValor: pendiente.valor },
    });
  }

  // lo que ya no se pregunta se archiva: borrarlo se llevaria por
  // delante las respuestas que lo contestaron
  let archivadas = 0;
  for (const previa of preguntasPrevias) {
    if (usadas.has(previa.id) || previa.archivada) continue;
    await prisma.pregunta.update({
      where: { id: previa.id },
      data: { archivada: true },
    });
    archivadas++;
  }

  // las secciones sobrantes ya no tienen ninguna pregunta viva:
  // se retiran, o quedarian como bloques vacios en el constructor
  const sobrantes = seccionesPrevias.slice(entrada.secciones.length);
  for (const seccion of sobrantes) {
    await prisma.seccion.delete({ where: { id: seccion.id } });
  }

  const vivas = await prisma.pregunta.count({
    where: { formularioId, archivada: false },
  });
  console.log(
    `${entrada.slug}: ${entrada.secciones.length} secciones y ${vivas} preguntas ` +
      `(${creadas} nuevas, ${archivadas} archivadas, ` +
      `${sobrantes.length} secciones retiradas).`,
  );
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
