/** Qué le falta a una ficha, y para qué le falta. */

import { celularUtil } from '../comun/celular';
import { EDAD_MINIMA, edadCumplida } from './catalogos-sep';

/// Lo mínimo para existir en el CRM lo impone el modelo.
/// Aquí va lo que exige cada cosa que se quiere hacer.
export type Revision = {
  /// Sin esto no se puede matricular.
  matricula: string[];
  /// Sin esto la fila no entra en el reporte al SENA.
  reporte: string[];
};

export type ParaRevisar = {
  ofertaId: string | null;
  coberturaId: string | null;
  accionFormacionId: string | null;
  nivelOcupacionalSepId: number | null;
  beneficiarioPrevio: boolean | null;
  tieneAutorizacion: boolean;
  grupoConFechas: boolean;
  grupoSepId: number | null;
  accionSepId: number | null;
  persona: {
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
};

/**
 * Lo que falta de la PERSONA, y solo de ella.
 *
 * Es un corte distinto del de `reporte`: aquel incluye el
 * grupo y los ids del SEP, que no dependen de quien se
 * inscribe. Un lead no es "parcial" porque el SENA no haya
 * asignado grupo todavia -- lo es porque la persona dejo
 * el formulario a medias, que es lo que el asesor tiene
 * que ir a completar por telefono.
 */
export function faltaDeLaPersona(p: {
  persona: ParaRevisar['persona'];
  nivelOcupacionalSepId: number | null;
}): string[] {
  const falta: string[] = [];
  const persona = p.persona;

  if (!persona.correo) falta.push('correo');
  /// `celularUtil` y no `!celular`, igual que abajo.
  ///
  /// Con `!celular`, un «no tiene» escrito en la casilla hacía
  /// que la ficha dijera que no falta nada mientras la
  /// compuerta de matrícula lo rechazaba: la pantalla decía una
  /// cosa y el servidor otra sobre el mismo dato.
  if (!celularUtil(persona.celular)) {
    falta.push(persona.celular ? 'un celular que sea un número' : 'celular');
  }
  if (!persona.fechaNacimiento) falta.push('fecha de nacimiento');
  if (persona.generoSepId === null) falta.push('género');
  if (persona.estrato === null) falta.push('estrato');
  if (persona.departamentoSepId === null) falta.push('departamento');
  if (persona.municipioSepId === null) falta.push('municipio');
  if (!persona.direccion?.trim()) falta.push('dirección');
  if (!persona.barrio?.trim()) falta.push('barrio o vereda');
  if (p.nivelOcupacionalSepId === null) falta.push('nivel ocupacional');

  return falta;
}

/**
 * La única fuente. El panel pinta lo que devuelve esto, en
 * vez de llevar su propia lista: tres reglas distintas
 * hacían que la ficha dijera «completa» y la persona
 * desapareciera del archivo sin que nadie lo notara.
 */
export function revisar(p: ParaRevisar): Revision {
  const matricula: string[] = [];
  const reporte: string[] = [];
  const persona = p.persona;

  // ── matrícula ──
  if (!p.ofertaId) matricula.push('falta asignarle una acción de formación');
  /// `celularUtil` y no `!!celular`: un «no tiene» escrito en
  /// la casilla pasaba la compuerta y dejaba matriculado a
  /// alguien a quien nadie puede llamar, que es justo lo que
  /// esta compuerta existe para evitar.
  if (!persona.correo && !celularUtil(persona.celular)) {
    matricula.push('no hay forma de contactarla: falta correo o celular');
  }
  if (!p.tieneAutorizacion) {
    matricula.push('no ha autorizado el tratamiento de sus datos para este convenio');
  }

  // ── reporte al SENA ──
  // lo de matricular también lo exige el reporte
  reporte.push(...matricula);

  if (!persona.correo) reporte.push('falta el correo');
  /// Y aquí es donde de verdad importaba.
  ///
  /// Esta lista decide quién ENTRA en el archivo del SEP, y el
  /// celular viaja en la columna de contacto. Con `!celular`,
  /// una fila con «no tiene» pasaba el filtro y se le mandaba al
  /// SENA como número de teléfono. El arreglo se había aplicado
  /// solo a la compuerta de matrícula -- una de las tres reglas
  /// que miran este campo--, que es la lección que este
  /// repositorio repite: un arreglo aplicado en un sitio y no a
  /// la clase.
  if (!celularUtil(persona.celular)) {
    reporte.push(
      persona.celular ? 'el celular no es un número' : 'falta el celular',
    );
  }
  if (!persona.fechaNacimiento) reporte.push('falta la fecha de nacimiento');
  else if (edadCumplida(persona.fechaNacimiento) < EDAD_MINIMA) {
    reporte.push(`es menor de ${EDAD_MINIMA} años`);
  }
  if (persona.generoSepId === null) reporte.push('falta el género');
  if (persona.estrato === null) reporte.push('falta el estrato');
  if (persona.departamentoSepId === null) reporte.push('falta el departamento de domicilio');
  if (persona.municipioSepId === null) reporte.push('falta el municipio de domicilio');
  if (!persona.direccion?.trim()) reporte.push('falta la dirección');
  if (!persona.barrio?.trim()) reporte.push('falta el barrio o vereda');
  if (p.nivelOcupacionalSepId === null) reporte.push('falta el nivel ocupacional');
  if (p.beneficiarioPrevio === null) {
    reporte.push('falta decir si se benefició anteriormente');
  }

  // sin los ids del SEP la fila no la reconoce nadie
  if (!p.coberturaId) reporte.push('no tiene grupo asignado');
  if (p.accionSepId === null) reporte.push('la acción no tiene su id del SEP');
  if (p.grupoSepId === null) reporte.push('el grupo no tiene su id del SEP');

  return { matricula, reporte };
}
