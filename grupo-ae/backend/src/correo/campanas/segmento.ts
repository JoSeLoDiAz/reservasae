/** A quiénes les llega una campaña. */

/// El segmento se guarda como REGLAS, no como una lista de
/// personas. Una lista se congela el día que se escribe: si la
/// campaña se lanza el jueves, la gente que entró el miércoles
/// no estaría. Las reglas se resuelven al lanzar.
///
/// Y al lanzar SÍ se congela, en `DestinatarioCampana`: desde
/// ese momento la campaña sabe exactamente a quién le tocaba,
/// aunque la ficha cambie después. Las dos cosas son ciertas
/// en su momento.

import { Prisma, type EtapaParticipante } from '../../../generated/prisma';
import { seLePregunta } from '../../crm/lo-que-no-se-pregunta';

export type Segmento = {
  /// En qué etapas está. Vacío = cualquiera.
  etapas?: EtapaParticipante[];
  /// De qué acción de formación.
  accionFormacionId?: string | null;
  /// De qué grupo (cobertura).
  coberturaId?: string | null;
  /// Solo a quien le falta algo suyo por completar. Es el
  /// caso de «recuérdales que llenen el formulario».
  soloDatosIncompletos?: boolean;
  /// Solo a quien ya tiene grupo con fecha. Es el caso de
  /// «avísales que arranca» o «cambió la fecha».
  soloConGrupo?: boolean;
  /// Sin asesor asignado.
  soloSinAsesor?: boolean;
};

/// Los que se ofrecen hechos, porque son los que se piden.
/// Tener que armar el filtro a mano cada vez es como se manda
/// una campaña al segmento equivocado.
///
/// LOS TÍTULOS NOMBRAN LA ETAPA CON LA PALABRA DEL EMBUDO. Decían
/// «Con propuesta enviada» mientras el embudo, dos pantallas más
/// allá, llamaba a la misma gente «Cotización enviada»: en la
/// demostración nadie supo decir si eran el mismo grupo. Ahora el
/// título empieza por el nombre de la columna del embudo y sigue
/// con lo que lo acota, para que se lea de un vistazo QUÉ columna
/// y QUÉ parte de ella.
///
/// La `clave` NO cambia aunque diga `inscritos`: es el valor de la
/// opción en el desplegable, no un texto que lea nadie. Lo que se
/// guarda con la campaña son las REGLAS del segmento, no la clave,
/// así que renombrarla no le aclararía nada a quien usa el panel.
export const SEGMENTOS_LISTOS: Array<{
  clave: string;
  titulo: string;
  para: string;
  segmento: Segmento;
}> = [
  {
    clave: 'datos-pendientes',
    titulo: 'Por calificar: les faltan datos',
    para: 'Recordarles que completen el formulario: sin sus datos no pasan a Calificado.',
    segmento: {
      etapas: ['INTERESADO', 'CONTACTADO'],
      soloDatosIncompletos: true,
    },
  },
  {
    clave: 'inscritos-inicio',
    titulo: 'Cotización enviada, con fecha de inicio',
    para: 'Hacer seguimiento a quien ya tiene cotización y fecha de inicio.',
    segmento: { etapas: ['INSCRITO'], soloConGrupo: true },
  },
  {
    clave: 'inscritos-todos',
    titulo: 'Cotización enviada, todos',
    para: 'Un aviso general a quien ya tiene una cotización en curso.',
    segmento: { etapas: ['INSCRITO'] },
  },
  {
    clave: 'en-formacion',
    titulo: 'En negociación',
    para: 'Cambios en las condiciones de la cotización.',
    segmento: { etapas: ['EN_FORMACION'] },
  },
  {
    clave: 'sin-asesor',
    titulo: 'Solicitud de negocio, sin asesor',
    para: 'Nadie los está llamando todavía.',
    segmento: { etapas: ['INTERESADO'], soloSinAsesor: true },
  },
];

/**
 * El filtro de Prisma que corresponde al segmento.
 *
 * SIEMPRE se le suman dos cosas que no son negociables: el
 * convenio -- una campaña de BRITCHAM no le escribe a gente de
 * ADECOPRIA -- y tener correo, porque sin correo no hay a
 * dónde mandar nada.
 */
export function comoConsulta(
  convenioId: string,
  s: Segmento,
): Prisma.ParticipanteWhereInput {
  const donde: Prisma.ParticipanteWhereInput = {
    convenioId,
    persona: {
      correo: { not: null },
      /// Y que siga autorizando EN ESTE convenio. Sin esto,
      /// quien revocó entraba en la lista al armarla.
      autorizaciones: {
        some: { revocadaEn: null, politica: { convenioId } },
      },
    },
  };

  if (s.etapas?.length) donde.etapa = { in: s.etapas };
  if (s.accionFormacionId) donde.accionFormacionId = s.accionFormacionId;
  if (s.coberturaId) donde.coberturaId = s.coberturaId;
  if (s.soloSinAsesor) donde.asesorId = null;

  /// «Con grupo» quiere decir con grupo Y con fecha: avisarle
  /// a alguien que su curso arranca, cuando el grupo todavía
  /// no tiene fecha, es mandarle un correo con un hueco.
  if (s.soloConGrupo) {
    donde.cobertura = { grupo: { fechaInicio: { not: null } } };
  }

  return donde;
}

/// Qué se necesita para saber si le falta algo. Se pide en la
/// misma consulta para no traer las fichas dos veces.
export const PARA_SABER_SI_LE_FALTA = {
  id: true,
  persona: {
    select: {
      correo: true,
      primerNombre: true,
      primerApellido: true,
      fechaNacimiento: true,
      estrato: true,
      barrio: true,
      direccion: true,
      generoSepId: true,
      departamentoSepId: true,
      municipioSepId: true,
    },
  },
  cargoEnEmpresa: true,
  nivelOcupacionalSepId: true,
  beneficiarioPrevio: true,
} as const;

/// Si le falta algo suyo. La misma idea que `completitud.ts`,
/// resumida a lo que decide si entra en este segmento.
export function leFaltaAlgo(p: {
  persona: {
    fechaNacimiento: Date | null;
    estrato: number | null;
    barrio: string | null;
    direccion: string | null;
    generoSepId: number | null;
    departamentoSepId: number | null;
    municipioSepId: number | null;
  };
  cargoEnEmpresa: string | null;
  nivelOcupacionalSepId: number | null;
  beneficiarioPrevio: boolean | null;
}): boolean {
  const per = p.persona;
  /// Lo que esta instalación no pregunta no puede faltar. En Grupo
  /// AE la fecha de nacimiento y el estrato no se piden, y exigirlos
  /// aquí metía a TODA la base en «les faltan datos»: la campaña les
  /// mandaba el enlace de completar a gente a la que el enlace ya no
  /// le pregunta nada (auditoría del 18 sep 2026).
  return (
    (seLePregunta('fechaNacimiento') && per.fechaNacimiento === null) ||
    (seLePregunta('estrato') && per.estrato === null) ||
    !per.barrio ||
    !per.direccion ||
    per.generoSepId === null ||
    per.departamentoSepId === null ||
    per.municipioSepId === null ||
    !p.cargoEnEmpresa ||
    p.nivelOcupacionalSepId === null ||
    p.beneficiarioPrevio === null
  );
}

/** Cómo se lee un segmento, para poder confirmarlo antes. */
export function enPalabras(s: Segmento): string {
  const partes: string[] = [];

  if (s.etapas?.length) {
    /// Con «la etapa» y comillas: los rótulos de venta son verbos
    /// («Canceló», «Dejó de responder») y a secas la frase salía
    /// «Personas en Canceló», que no se entiende.
    partes.push(
      `en la etapa ${s.etapas.map((e) => `«${enBonito(e)}»`).join(' o ')}`,
    );
  } else {
    partes.push('en cualquier etapa');
  }

  if (s.soloDatosIncompletos) partes.push('a quienes les falten datos');
  /// «Con fecha de inicio» y no «con grupo y fecha»: es como lo
  /// dice el título del segmento, y el grupo es un detalle de cómo
  /// se guarda, no algo que quien lanza la campaña tenga que saber.
  if (s.soloConGrupo) partes.push('con fecha de inicio');
  if (s.soloSinAsesor) partes.push('sin asesor');
  if (s.accionFormacionId) partes.push('de un producto o servicio');
  if (s.coberturaId) partes.push('de una campaña');

  return `Personas ${partes.join(', ')}, que tengan correo.`;
}

/**
 * El nombre de la etapa dentro de la frase que describe a quién
 * le va a llegar el correo.
 *
 * ES EL MISMO VOCABULARIO que `ETIQUETA_ETAPA` del panel
 * (`frontend/src/lib/crm-api.ts`), que el selector de plantillas
 * y que los tokens de `admin/temas.ts` —y que el aviso de
 * `correo/plantillas/etapas-de-plantilla.ts`, en minúscula—. Se
 * cambian juntos, y `una-etapa-un-nombre.spec.ts` los compara a
 * todos, los del panel incluidos, leyéndolos como texto. El 15
 * sep 2026 estos discrepaban y la frase que decía
 * «Ganado» describía un segmento que la lista llamaba de otra
 * forma, así que una campaña se podía mandar a la gente
 * equivocada creyendo lo contrario.
 *
 * ESTABAN LAS SEIS PRIMERAS Y NADA MÁS, y el `?? e` de abajo
 * tapaba el hueco: una campaña acotada a los perdidos se
 * describía como «en PERDIDO», con el valor crudo de la base en
 * mitad de una frase en español. Ahora están las once.
 *
 * EL 18 SEP 2026 SE PASARON AL VOCABULARIO DEL EMBUDO. Las siete
 * que tienen pareja en `EtapaOportunidad` se llaman exactamente
 * como ella —`rotulo()` de `oportunidades/escalera.ts`—, y las
 * cuatro que no la tienen hablan de venta y no de aula. Es la
 * misma gente vista desde el contacto en vez de desde el negocio,
 * y con dos vocabularios una demostración del Mailing se iba en
 * explicar que «Propuesta enviada» era «Cotización enviada». El
 * porqué de cada palabra está junto a `ETIQUETA_ETAPA` del panel.
 * El enum no se tocó: solo lo que se lee.
 */
function enBonito(e: string): string {
  const m: Record<string, string> = {
    INTERESADO: 'Solicitud de negocio',
    CONTACTADO: 'Contactado',
    DATOS_COMPLETOS: 'Calificado',
    INSCRITO: 'Cotización enviada',
    EN_FORMACION: 'En negociación',
    CERTIFICADO: 'Cerrado ganado',
    PERDIDO: 'Cerrado perdido',
    RETIRADO: 'Canceló',
    NO_APROBO: 'No aprobó la compra',
    DESERTO: 'Desistió',
    ABANDONO: 'Dejó de responder',
  };
  return m[e] ?? e;
}
