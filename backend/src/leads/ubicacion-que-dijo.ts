/** Del departamento y la ciudad que escribió, a los ids del SEP. */

/**
 * Un lead de una pauta no manda códigos DANE: manda lo que la
 * persona eligió en un desplegable de Meta, o lo que tecleó.
 * «Antioquia», «ANTIOQUIA», «Medellín», «MEDELLIN».
 *
 * Se resuelve aquí y no en el emisor por lo de siempre: pedirle
 * al que integra que aprenda nuestros catálogos es garantizar
 * que mande el id equivocado, y un id equivocado no falla — se
 * guarda y sale mal en el reporte al SENA meses después.
 *
 * Y se admite el número también, para quien sí lo tenga: los
 * ids del SEP para departamento y ciudad SON los códigos DANE,
 * así que quien los conozca puede mandarlos directamente.
 */

import {
  DEPARTAMENTOS_SEP,
  MUNICIPIOS_SEP,
} from '../crm/catalogos-sep.generado';

/// Sin tildes, sin puntos, sin dobles espacios y en minúscula.
///
/// Es la MISMA normalización que usa `cobertura.ts` para decidir
/// si una sede cubre a alguien, y tiene que serlo: si aquí
/// «BOGOTÁ D.C.» y allá «Bogota DC» se normalizan distinto, la
/// ubicación se guarda bien y después no encuentra ninguna
/// oferta que la cubra.
function limpiar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type UbicacionResuelta = {
  departamentoSepId: number | null;
  municipioSepId: number | null;
  /// Lo que no se pudo reconocer, para poder decirlo.
  noReconocido: string[];
};

/**
 * Resuelve lo que mandó. Nunca lanza.
 *
 * Un webhook que contesta 400 porque no reconoce un municipio
 * invita a que el emisor reintente en bucle o descarte el lead.
 * Lo que no se reconoce se dice en `noReconocido` y el lead entra
 * igual: perderlo es peor que guardarlo incompleto.
 */
export function ubicacionQueDijo(
  departamento?: string | number | null,
  ciudad?: string | number | null,
): UbicacionResuelta {
  const noReconocido: string[] = [];

  const dep = resolver(departamento, DEPARTAMENTOS_SEP);
  if (departamento != null && `${departamento}`.trim() && !dep) {
    noReconocido.push(`departamento «${departamento}»`);
  }

  /// El municipio se busca DENTRO de su departamento cuando se
  /// conoce, y no en los 1.100 del país.
  ///
  /// Sin acotar, «San Antonio» son ocho municipios en ocho
  /// departamentos distintos y elegir uno al azar es peor que no
  /// elegir: la ficha saldría con un domicilio inventado y
  /// ninguna oferta de su departamento la cubriría.
  /// Las tuplas del catálogo generado, con nombre.
  const todos = MUNICIPIOS_SEP.map(([id, depId, etiqueta, elegible]) => ({
    id,
    depId,
    etiqueta,
    elegible,
  })).filter((m) => m.elegible);

  const candidatos = dep ? todos.filter((m) => m.depId === dep.id) : todos;

  const mun = resolver(ciudad, candidatos);
  if (ciudad != null && `${ciudad}`.trim() && !mun) {
    noReconocido.push(`ciudad «${ciudad}»`);
  }

  /// Si no se reconocio el departamento pero SI el municipio, el
  /// departamento es el suyo.
  ///
  /// Es lo que arregla Bogota, y no es un caso especial escrito a
  /// mano: el catalogo llama al departamento «BOGOTA D.C» y al
  /// municipio «BOGOTA», y la gente escribe «Bogota» en los dos
  /// campos. Hoy eso deja el departamento en NULL --comprobado--
  /// y entonces NINGUNA oferta de tipo DEPARTAMENTO lo cubre: la
  /// persona se queda sin las virtuales de su propia ciudad.
  ///
  /// Deducirlo del municipio no adivina nada: un municipio
  /// pertenece a un solo departamento, siempre.
  const depFinal = dep?.id ?? mun?.depId ?? null;

  return {
    departamentoSepId: depFinal,
    /// El municipio SOLO si cuadra con su departamento.
    ///
    /// Guardar uno de otro departamento es exactamente lo que
    /// `motivoDeIdInvalido` rechaza en el panel, y la ficha
    /// quedaría imposible de terminar por el enlace público.
    municipioSepId:
      mun && (depFinal === null || mun.depId === depFinal) ? mun.id : null,
    /// El departamento deducido del municipio NO es un dato sin
    /// reconocer: se reconocio, por el otro lado.
    noReconocido: noReconocido.filter(
      (x) => !(depFinal !== null && x.startsWith('departamento')),
    ),
  };
}

/// Por id si mandó un número, y si no por nombre normalizado.
function resolver<T extends { id: number; etiqueta: string }>(
  valor: string | number | null | undefined,
  catalogo: T[],
): T | null {
  if (valor === null || valor === undefined) return null;

  const texto = `${valor}`.trim();
  if (!texto) return null;

  /// Un numero es el codigo DANE, que ES el id del SEP.
  if (/^\d+$/.test(texto)) {
    return catalogo.find((x) => x.id === Number(texto)) ?? null;
  }

  const buscado = limpiar(texto);
  return catalogo.find((x) => limpiar(x.etiqueta) === buscado) ?? null;
}
