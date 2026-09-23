/** La organización de una importación: sus datos se ponen UNA vez para todos. */

/// Por qué existe.
///
/// «Importar participantes debe tener la opción de si es una
/// importación de una reserva de cupos, porque masivamente se deben
/// colocar los datos de la empresa: NIT, nombre y los tres datos del
/// jefe inmediato (nombre, cargo y correo)» (cliente, 22 sep 2026).
///
/// La importación solo traía los datos de cada persona. La organización
/// quedaba para después, lead por lead --el enlace de completar datos o
/// el editor de la ficha--, cuando la lista la manda justamente la
/// organización y sus datos son los mismos para todas las filas. Sin
/// ellos cada lead nacía sin empresa: no se podía pasar a Inscrito (lo
/// único que exige es la organización) y su cupo no contaba como «con
/// nombre» en la reserva.
///
/// Van aparte de las filas y no como cinco columnas más porque son de
/// la organización, no de la persona: repetirlos en cada fila invita a
/// que dos filas digan dos jefes distintos para la misma empresa, y el
/// jefe se guarda en la EMPRESA (`contactoNombre`, `contactoCargo`,
/// `contactoCorreo`), uno por organización.

import { normalizarNit } from '../comun/nit';

/** Lo que llega del formulario o de la hoja «Organización». */
export type OrganizacionCruda = {
  nit?: string | null;
  razonSocial?: string | null;
  jefeNombre?: string | null;
  jefeCargo?: string | null;
  jefeCorreo?: string | null;
};

/** Ya leída: normalizada, con lo que impide importar y lo que solo avisa. */
export type OrganizacionLeida = {
  /** Solo dígitos, sin DV. Vacío si no se pudo leer. */
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  jefeNombre: string | null;
  jefeCargo: string | null;
  jefeCorreo: string | null;
  /** Impiden importar: sin esto no hay organización a la que vincular. */
  problemas: string[];
  /** No impiden importar, pero cada lead lo va a seguir pidiendo. */
  avisos: string[];
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpio(v: string | null | undefined): string {
  return (v ?? '').replace(/\s+/g, ' ').trim();
}

/// «nombre, cargo y correo», con la «y» donde va.
function enLista(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

export function leerOrganizacion(o: OrganizacionCruda): OrganizacionLeida {
  const problemas: string[] = [];
  const avisos: string[] = [];

  const nitTecleado = limpio(o.nit);
  const nit = nitTecleado ? normalizarNit(nitTecleado) : null;
  if (!nitTecleado) {
    problemas.push('Falta el NIT de la organización.');
  } else if (!nit) {
    problemas.push(
      'El NIT de la organización no es válido: van de 5 a 15 dígitos, con o sin el dígito de verificación.',
    );
  }

  const razonSocial = limpio(o.razonSocial);
  if (!razonSocial) problemas.push('Falta el nombre (razón social) de la organización.');

  const jefeNombre = limpio(o.jefeNombre) || null;
  const jefeCargo = limpio(o.jefeCargo) || null;
  const jefeCorreo = limpio(o.jefeCorreo).toLowerCase() || null;
  if (jefeCorreo && !CORREO.test(jefeCorreo)) {
    problemas.push('El correo del jefe inmediato no es válido.');
  }

  const faltan = [
    !jefeNombre && 'el nombre',
    !jefeCargo && 'el cargo',
    !jefeCorreo && 'el correo',
  ].filter((x): x is string => Boolean(x));
  if (faltan.length > 0) {
    avisos.push(
      `Falta ${enLista(faltan)} del jefe inmediato. Se puede importar igual, pero cada lead lo va a seguir pidiendo hasta que se complete.`,
    );
  }

  return {
    nit: nit?.nit ?? '',
    digitoVerificacion: nit?.digitoVerificacion ?? null,
    razonSocial,
    jefeNombre,
    jefeCargo,
    jefeCorreo,
    problemas,
    avisos,
  };
}

/** Lo que ya hay guardado de esa organización. */
export type EmpresaGuardada = {
  razonSocial: string;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoCorreo: string | null;
};

/**
 * Qué se escribe en la empresa que YA existe, y qué se deja como está.
 *
 * SOLO SE LLENA LO VACÍO. Si la organización ya tiene un jefe guardado
 * y la carga trae otro, se queda el guardado y se dice: pisarlo en
 * silencio desde un archivo borraría un dato que alguien corrigió a
 * mano, y ese cambio no deja rastro en ninguna parte. La razón social
 * tampoco se toca: la del maestro es la que vale para el SENA.
 */
export function queSeEscribe(
  guardada: EmpresaGuardada,
  leida: OrganizacionLeida,
): {
  datos: { contactoNombre?: string; contactoCargo?: string; contactoCorreo?: string };
  seQuedan: string[];
} {
  const datos: { contactoNombre?: string; contactoCargo?: string; contactoCorreo?: string } = {};
  const seQuedan: string[] = [];

  const campos = [
    ['contactoNombre', leida.jefeNombre, 'el nombre del jefe'],
    ['contactoCargo', leida.jefeCargo, 'el cargo del jefe'],
    ['contactoCorreo', leida.jefeCorreo, 'el correo del jefe'],
  ] as const;

  for (const [campo, nuevo, rotulo] of campos) {
    if (!nuevo) continue;
    const actual = guardada[campo];
    if (!actual) datos[campo] = nuevo;
    else if (actual.trim().toLowerCase() !== nuevo.toLowerCase()) {
      seQuedan.push(`${rotulo} («${actual}»)`);
    }
  }

  if (
    leida.razonSocial &&
    guardada.razonSocial.trim().toLowerCase() !== leida.razonSocial.toLowerCase()
  ) {
    seQuedan.push(`la razón social («${guardada.razonSocial}»)`);
  }

  return { datos, seQuedan };
}
