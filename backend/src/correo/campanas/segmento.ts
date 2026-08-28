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
export const SEGMENTOS_LISTOS: Array<{
  clave: string;
  titulo: string;
  para: string;
  segmento: Segmento;
}> = [
  {
    clave: 'datos-pendientes',
    titulo: 'Les faltan datos',
    para: 'Recordarles que completen el formulario.',
    segmento: {
      etapas: ['INTERESADO', 'CONTACTADO'],
      soloDatosIncompletos: true,
    },
  },
  {
    clave: 'inscritos-inicio',
    titulo: 'Inscritos con grupo',
    para: 'Avisarles cuándo y dónde arranca.',
    segmento: { etapas: ['INSCRITO'], soloConGrupo: true },
  },
  {
    clave: 'inscritos-todos',
    titulo: 'Todos los inscritos',
    para: 'Un aviso general a quien ya tiene su silla.',
    segmento: { etapas: ['INSCRITO'] },
  },
  {
    clave: 'en-formacion',
    titulo: 'En formación',
    para: 'Cambios de fecha, de aula o de horario.',
    segmento: { etapas: ['EN_FORMACION'] },
  },
  {
    clave: 'sin-asesor',
    titulo: 'Sin asesor',
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
    persona: { correo: { not: null } },
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
  return (
    per.fechaNacimiento === null ||
    per.estrato === null ||
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
    partes.push(`en ${s.etapas.map(enBonito).join(' o ')}`);
  } else {
    partes.push('en cualquier etapa');
  }

  if (s.soloDatosIncompletos) partes.push('a quienes les falten datos');
  if (s.soloConGrupo) partes.push('con grupo y fecha');
  if (s.soloSinAsesor) partes.push('sin asesor');
  if (s.accionFormacionId) partes.push('de una acción de formación');
  if (s.coberturaId) partes.push('de un grupo');

  return `Personas ${partes.join(', ')}, que tengan correo.`;
}

function enBonito(e: string): string {
  const m: Record<string, string> = {
    INTERESADO: 'Interesado',
    CONTACTADO: 'Contactado',
    DATOS_COMPLETOS: 'Datos completos',
    INSCRITO: 'Inscrito',
    EN_FORMACION: 'En formación',
    CERTIFICADO: 'Certificado',
  };
  return m[e] ?? e;
}
