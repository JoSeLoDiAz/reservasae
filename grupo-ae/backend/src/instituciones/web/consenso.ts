/** Consenso: funde N fichas del buscador en una sola, por votación. */

/// Google contesta distinto cada vez. En vez de creerle a una consulta,
/// se consulta N veces y se vota por campo. Cada campo sale con un nivel:
///   ALTA    -> todas las corridas coinciden
///   MEDIA   -> mayoría coincide
///   REVISAR -> una sola aparición o sin mayoría (ojo humano)
/// El departamento se deriva de la ciudad consolidada.

import { derivarDepartamento } from './ficha-a-propuesta';
import type { FichaWeb } from './leer-ficha-web';

export type Nivel = 'ALTA' | 'MEDIA' | 'REVISAR';

export type CampoConsolidado = {
  valor: string | null;
  nivel: Nivel;
  /// «c/n»: en cuántas de las n corridas válidas salió el valor ganador.
  detalle: string;
};

export type FichaConsolidada = Record<keyof FichaWeb, CampoConsolidado>;

const CLAVES: Array<keyof FichaWeb> = [
  'razonSocial', 'nombreComercial', 'fechaFundacion', 'direccion', 'telefono',
  'correo', 'paginaWeb', 'ciudadNombre', 'departamentoNombre', 'sectorEconomico',
  'codigoCiiu', 'clasificacion', 'tamano', 'numeroEmpleados',
];

const claveVoto = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^https?:\/\//, '') // http(s):// no cambia el voto
    .replace(/\/+$/, '') // barra final tampoco
    .replace(/www\./, '') // www. tampoco
    .replace(/\s+/g, ' ')
    .trim();

export function consolidarFichas(fichas: FichaWeb[]): FichaConsolidada {
  const validas = fichas.filter((f) => f.razonSocial);
  const n = validas.length || fichas.length || 1;

  const salida = {} as FichaConsolidada;

  for (const clave of CLAVES) {
    const presentes = fichas
      .map((f) => f[clave])
      .filter((v): v is string => v !== null && v !== undefined && v !== '');

    if (presentes.length === 0) {
      salida[clave] = { valor: null, nivel: 'REVISAR', detalle: 'sin dato' };
      continue;
    }

    // Agrupar por clave de voto; el valor mostrado es el crudo más común.
    const grupos = new Map<string, string[]>();
    for (const v of presentes) {
      const k = claveVoto(v);
      (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(v);
    }
    let mejor: string[] = [];
    for (const g of grupos.values()) if (g.length > mejor.length) mejor = g;

    const valor = masComun(mejor);
    const c = mejor.length;
    const ratio = c / n;
    const nivel: Nivel = ratio >= 0.999 ? 'ALTA' : c >= 2 && ratio >= 0.5 ? 'MEDIA' : 'REVISAR';
    salida[clave] = { valor, nivel, detalle: `${c}/${n}` };
  }

  // Capa 2: departamento derivado de la ciudad consolidada.
  const depto = derivarDepartamento(salida.ciudadNombre.valor);
  if (depto) {
    salida.departamentoNombre = { valor: depto, nivel: 'ALTA', detalle: 'derivado de ciudad' };
  }

  return salida;
}

/// Reduce la ficha consolidada a una FichaWeb (solo valores), para pasarla
/// a fichaAPropuesta. Los niveles de confianza se conservan aparte.
export function aFichaWeb(cons: FichaConsolidada): FichaWeb {
  const ficha = {} as FichaWeb;
  for (const clave of CLAVES) ficha[clave] = cons[clave].valor;
  return ficha;
}

function masComun(xs: string[]): string {
  const cuenta = new Map<string, number>();
  for (const x of xs) cuenta.set(x, (cuenta.get(x) ?? 0) + 1);
  let mejor = xs[0];
  let max = 0;
  for (const [v, c] of cuenta) if (c > max) { max = c; mejor = v; }
  return mejor;
}
