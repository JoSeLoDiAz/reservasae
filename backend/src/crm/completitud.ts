/** Qué le falta a una ficha, y para qué le falta. */

import { celularUtil } from '../comun/celular';
import { correoUtil } from '../comun/correo';
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

  if (!correoUtil(persona.correo)) falta.push('correo');
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

/// Lo que la ficha necesita de la organización de la persona.
export type EmpresaDeLaFicha = {
  nit: string;
  sectorEconomico: string | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoCorreo: string | null;
} | null;

/**
 * Lo que el enlace le pide de su organización, y solo eso.
 *
 * El maestro de empresas guarda mucho más --tamaño, número de
 * trabajadores, el CIIU-- pero al EMPLEADO no se le pregunta eso:
 * no lo sabe. Por eso esta lista NO es `faltaEnF7`, que son ocho
 * campos y tres de ellos no los escribe nadie hoy.
 *
 * Estaba escrita DOS veces --privada en `crm.service` y exportada
 * en `preinscripcion/empresa-incompleta.ts`-- y las dos diferían:
 * aquella tenía la excepción del independiente y el trato del
 * nulo, y esta el `trim()`. O sea que a quien trabaja por su
 * cuenta el enlace le pedía el correo de un jefe que su propia
 * ficha ya daba por no aplicable. Aquí van las dos mitades buenas.
 */
export function faltaDeLaEmpresa(
  e: EmpresaDeLaFicha,
  /// Para saber si la «empresa» es la persona misma.
  documentoDeLaPersona?: string | null,
): string[] {
  if (!e) return ['los datos de su organización'];

  /// Quien trabaja por su cuenta no tiene jefe directo.
  ///
  /// Su cédula es su RUT, así que su NIT y su documento son el
  /// mismo número. Pedirle «el nombre de su jefe» es pedirle que
  /// se invente a alguien, y mientras no lo haga la ficha lo da
  /// por incompleto para siempre.
  const esElMismo =
    documentoDeLaPersona != null && e.nit === documentoDeLaPersona;

  const falta: string[] = [];
  if (!e.sectorEconomico?.trim()) falta.push('sector económico');
  if (esElMismo) return falta;

  if (!e.contactoNombre?.trim()) falta.push('nombre del jefe directo');
  if (!e.contactoCargo?.trim()) falta.push('cargo del jefe directo');
  if (!e.contactoCorreo?.trim()) falta.push('correo del jefe directo');
  return falta;
}

/**
 * QUÉ LE FALTA A LA FICHA: la persona Y su organización.
 *
 * Es la regla de «Datos completos» desde el 24 sep 2026, y la
 * pidió Josse: «datos completos deben estar los datos de la
 * persona y los datos de la empresa».
 *
 * NACE APARTE Y NO DENTRO DE `faltaDeLaPersona`, y ese es el
 * candado que sostiene todo lo demás: aquella la leen doce
 * sitios, y uno es la COMPUERTA DE MATRÍCULA (`estadoDeDatos`).
 * Metiéndole la empresa, nadie con la organización a medias
 * podría inscribirse --en producción eran 86 de 86-- y eso
 * derogaría la decisión del cliente del 30 ago 2026: «los tres
 * datos del jefe directo NO bloquean la inscripción; un empleado
 * puede no saberse el correo de su jefe, y perder la inscripción
 * entera por eso es peor que perseguir el dato con una llamada».
 *
 * O sea: esto decide la ETAPA y lo que se PINTA. Lo que deja
 * MATRICULAR sigue siendo `faltaDeLaPersona`.
 */
export function faltaDeLaFicha(p: {
  persona: ParaRevisar['persona'];
  nivelOcupacionalSepId: number | null;
  empresa: EmpresaDeLaFicha;
  documentoDeLaPersona?: string | null;
}): string[] {
  return [
    ...faltaDeLaPersona(p),
    ...faltaDeLaEmpresa(p.empresa, p.documentoDeLaPersona),
  ];
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
  /// Falta el CURSO o falta la SEDE: no es lo mismo.
  ///
  /// Esto decía siempre «falta asignarle una acción de formación»
  /// mirando `ofertaId`, y `Oferta` es acción × ubicación. Una
  /// ficha que llega con su curso —las del webhook llegan así—
  /// leía que le faltaba justo lo que sí tenía, y quien lo leyera
  /// se iba a buscar el defecto al sitio equivocado. Pasó.
  ///
  /// Y llevan a cosas distintas: sin curso hay que preguntarle
  /// qué quiere estudiar; con curso y sin sede hay que
  /// preguntarle DÓNDE VIVE, que es de donde sale la sede.
  if (!p.ofertaId) {
    matricula.push(
      p.accionFormacionId
        ? 'falta la sede: se sabe qué curso quiere, pero no dónde lo va a tomar. ' +
          'Sale del departamento y la ciudad de la persona — y si su ' +
          'departamento no tiene ese curso, no se la puede inscribir.'
        : 'falta asignarle una acción de formación',
    );
  }
  /// `celularUtil` y no `!!celular`: un «no tiene» escrito en
  /// la casilla pasaba la compuerta y dejaba matriculado a
  /// alguien a quien nadie puede llamar, que es justo lo que
  /// esta compuerta existe para evitar.
  if (!correoUtil(persona.correo) && !celularUtil(persona.celular)) {
    matricula.push('no hay forma de contactarla: falta correo o celular');
  }
  if (!p.tieneAutorizacion) {
    matricula.push('no ha autorizado el tratamiento de sus datos para este convenio');
  }

  // ── reporte al SENA ──
  // lo de matricular también lo exige el reporte
  reporte.push(...matricula);

  if (!correoUtil(persona.correo)) reporte.push('falta el correo');
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

  /// El GRUPO sí se exige: es del proceso, no del SEP.
  ///
  /// Sin grupo asignado la fila no dice a qué cohorte pertenece
  /// esa persona, y eso lo decidimos aquí — no depende de nadie
  /// de fuera.
  if (!p.coberturaId) reporte.push('no tiene grupo asignado');

  /// Los IDS DEL SEP ya NO sacan la fila del reporte.
  ///
  /// Los asigna el SENA y todavía no los ha dado. Exigirlos
  /// dejaba el reporte VACÍO —cero filas— y con él no se puede
  /// ni revisar, ni contar cuántos entran, ni enseñárselo a
  /// nadie: un control puesto para proteger el cargue estaba
  /// impidiendo el trabajo de antes del cargue.
  ///
  /// Salen con la celda vacía, igual que `PERSONA ID` y
  /// `EMPRESA ID`, que el cliente completa cuando los tiene.
  /// Decisión suya, 2 sep 2026.
  ///
  /// Cuando lleguen, esta regla se puede devolver en una línea —
  /// y entonces sí volverá a tener sentido, porque el archivo
  /// tendrá que cargar de verdad.

  return { matricula, reporte };
}
