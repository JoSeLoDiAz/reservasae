/** A qué grupo del sistema corresponde cada fila del cronograma. */

/**
 * EMPAREJAR ES LA PARTE PELIGROSA, no leer.
 *
 * El cronograma dice «AF1.G1 Bogotá» y el sistema tiene un grupo número
 * 1 de una acción con código AF1. Parece directo, y no lo es: EN LA
 * BASE HAY DOS ACCIONES CON EL MISMO CÓDIGO. ADECOPRIA tiene un AF1
 * «Gestión de la Atención y Neuroeducación» ---el del cronograma--- y
 * la unión temporal BRITCHAM-ADEE tiene otro AF1, «Despliegue de
 * Agentes Autónomos con IA», con sus propios ocho grupos numerados
 * igual. Los códigos AF se repiten entre gremios y no significan lo
 * mismo.
 *
 * Escribir por código y número a secas movería las fechas del gremio
 * equivocado, y nadie lo notaría hasta que un grupo cerrara
 * inscripciones once días antes de tiempo.
 *
 * Por eso aquí se exigen TRES cosas y no dos:
 *
 *   1. El convenio, que lo elige quien importa y no se adivina.
 *   2. El código de la acción y el número del grupo.
 *   3. Y UN CONTROL: que la ciudad o el departamento del rótulo
 *      aparezca entre las coberturas de ese grupo.
 *
 * El tercero es el que convierte un error silencioso en un reparo. Si
 * el G5 del cronograma dice «Cauca, Santander» y el G5 de la base
 * cubre Atlántico, Magdalena y Córdoba, no son el mismo grupo aunque
 * el número coincida: se reporta y no se escribe.
 *
 * NADA SE APLICA DESDE AQUÍ. Esto solo dice qué pasaría.
 */

import type { GrupoDelCronograma } from './lector-del-cronograma';

/** Un grupo del sistema, con lo justo para reconocerlo. */
export type GrupoEnLaBase = {
  id: string;
  numero: number;
  accionCodigo: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  cierreInscripciones: Date | null;
  /// Los nombres de las ubicaciones que cubre, tal como están.
  ubicaciones: string[];
};

/** Un campo que cambiaría, con lo que había y lo que habría. */
export type Cambio = {
  campo: 'fechaInicio' | 'fechaFin' | 'cierreInscripciones';
  de: string | null;
  a: string;
};

/** Qué le pasaría a una fila del cronograma. */
export type Emparejado = {
  /// El rótulo del cronograma, para poder señalarlo en pantalla.
  rotulo: string;
  af: string;
  numeroDeGrupo: number | null;
  /// Null cuando no se encontró a quién corresponde.
  grupoId: string | null;
  cambios: Cambio[];
  /// Por qué no se puede aplicar. Vacío = se puede.
  reparos: string[];
};

export type Comparacion = {
  /// Las que se pueden aplicar y además cambian algo.
  porAplicar: Emparejado[];
  /// Emparejadas y ya iguales: no hay nada que escribir.
  sinCambios: Emparejado[];
  /// Las que no se pueden aplicar, con su motivo.
  conReparos: Emparejado[];
};

/**
 * Un nombre de lugar, comparable.
 *
 * Sin tildes y en mayúsculas porque las dos fuentes las escriben
 * distinto: la hoja dice «Pópayán» ---con la tilde cambiada de sitio---
 * y «Medellín», y la base tiene «POPAYÁN» y «MEDELLÍN». Comparar en
 * crudo daría cero coincidencias y todo saldría con reparo.
 */
export function comparable(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Los lugares que nombra el rótulo de un grupo.
 *
 * El rótulo es «AF1.G4. Huila, Magdalena» o «AF3.G1 Apartadó
 * (Antioquia)»: delante va el código, que hay que quitar, y detrás una
 * lista de lugares separados por comas, barras o paréntesis. También
 * hay aclaraciones pegadas ---«Medellín presencial»--- de las que solo
 * sirve la primera palabra larga.
 */
export function lugaresDelRotulo(rotulo: string): string[] {
  const sinCodigo = rotulo.replace(
    /^\s*AF\s*\d+\s*[.\-]?\s*G\s*\d+\s*[.\-]?\s*/i,
    '',
  );
  return sinCodigo
    .split(/[,/()]/)
    .map((t) => comparable(t))
    .filter((t) => t.length >= 4);
}

/**
 * ¿El rótulo y las coberturas hablan del mismo sitio?
 *
 * Basta UNA coincidencia, no todas: un grupo del cronograma puede
 * nombrar cinco departamentos y la base tenerlos repartidos en varias
 * coberturas, o al revés. Lo que se descarta es que no se toquen en
 * nada, que es la señal de que se emparejó con el gremio equivocado.
 *
 * La comparación es por inclusión en los dos sentidos porque los
 * nombres no son idénticos: «VALLE DEL CAUCA» en la base y «Valle del
 * Cauca» en la hoja coinciden, pero «ANTIOQUIA» contra «APARTADO
 * ANTIOQUIA» solo coincide si uno puede estar dentro del otro.
 */
export function hablanDelMismoSitio(
  lugares: string[],
  ubicaciones: string[],
): boolean {
  /// Sin lugares en el rótulo no hay control que hacer: no se puede
  /// afirmar que estén en desacuerdo.
  if (lugares.length === 0) return true;
  const suyas = ubicaciones.map(comparable).filter((u) => u.length > 0);
  if (suyas.length === 0) return true;
  return lugares.some((l) => suyas.some((u) => u.includes(l) || l.includes(u)));
}

/**
 * La fecha tal como la guarda el sistema: medianoche de Bogotá.
 *
 * Colombia va cinco horas detrás de UTC y no mueve el reloj. Sin esto,
 * un cierre escrito como `2026-10-08` se guardaría a medianoche UTC,
 * que son las siete de la tarde del día 7 en Bogotá: el cierre se
 * adelantaría un día entero, y nadie sabría por qué.
 */
export function medianocheEnBogota(dia: string): Date {
  return new Date(`${dia}T05:00:00.000Z`);
}

const comoDia = (d: Date | null): string | null =>
  d ? new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10) : null;

/**
 * Qué pasaría si se aplicara el cronograma.
 *
 * `delConvenio` son los grupos del gremio elegido, y SOLO de ese: el
 * filtro por convenio se hace al pedirlos, no aquí, porque un error de
 * alcance tiene que notarse al leer la consulta.
 */
export function compararConElCronograma(
  filas: GrupoDelCronograma[],
  delConvenio: GrupoEnLaBase[],
): Comparacion {
  const porAplicar: Emparejado[] = [];
  const sinCambios: Emparejado[] = [];
  const conReparos: Emparejado[] = [];

  for (const f of filas) {
    const salida: Emparejado = {
      rotulo: f.grupo,
      af: f.af,
      numeroDeGrupo: f.numeroDeGrupo,
      grupoId: null,
      cambios: [],
      reparos: [],
    };

    if (f.numeroDeGrupo === null) {
      salida.reparos.push(
        'No se pudo leer el número de grupo del rótulo; se esperaba algo como «AF1.G3».',
      );
      conReparos.push(salida);
      continue;
    }

    const candidatos = delConvenio.filter(
      (g) => g.accionCodigo === f.af && g.numero === f.numeroDeGrupo,
    );

    if (candidatos.length === 0) {
      salida.reparos.push(
        `En este gremio no hay un grupo ${f.numeroDeGrupo} de ${f.af}.`,
      );
      conReparos.push(salida);
      continue;
    }
    if (candidatos.length > 1) {
      /// No debería pasar ---`@@unique([accionFormacionId, numero])`---
      /// salvo que el gremio tenga dos acciones con el mismo código.
      salida.reparos.push(
        `Hay ${candidatos.length} grupos ${f.numeroDeGrupo} de ${f.af} en este ` +
          'gremio y no se puede saber cuál es. Revise los códigos de las acciones.',
      );
      conReparos.push(salida);
      continue;
    }

    const suyo = candidatos[0];
    salida.grupoId = suyo.id;

    if (!hablanDelMismoSitio(lugaresDelRotulo(f.grupo), suyo.ubicaciones)) {
      salida.reparos.push(
        `El cronograma dice «${f.grupo}» y ese grupo cubre ` +
          `${suyo.ubicaciones.join(', ') || 'ninguna ubicación'}. ` +
          'No parecen el mismo grupo, así que no se toca.',
      );
      conReparos.push(salida);
      continue;
    }

    const pretende: Array<[Cambio['campo'], string | null, Date | null]> = [
      ['fechaInicio', f.inicio, suyo.fechaInicio],
      ['fechaFin', f.fin, suyo.fechaFin],
      ['cierreInscripciones', f.cierreInscripciones, suyo.cierreInscripciones],
    ];
    for (const [campo, nuevo, actual] of pretende) {
      /// Lo que el cronograma no dice NO BORRA lo que ya hay: una fila
      /// sin sesiones marcadas no significa que el grupo no tenga
      /// fechas, significa que esa fila no las trae.
      if (!nuevo) continue;
      const antes = comoDia(actual);
      if (antes === nuevo) continue;
      salida.cambios.push({ campo, de: antes, a: nuevo });
    }

    if (salida.cambios.length === 0) sinCambios.push(salida);
    else porAplicar.push(salida);
  }

  return { porAplicar, sinCambios, conReparos };
}
