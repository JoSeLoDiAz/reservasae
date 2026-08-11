/**
 * Genera las dos paletas completas a partir de un solo color.
 *
 * Existe para que un administrador no tecnico no tenga que elegir 28 colores a
 * mano. Los estados NO se derivan: sus escalones estan validados contra
 * deuteranopia y sacarlos de un tono cualquiera tiraria esa garantia.
 */

import { EsquemaColor } from '../../generated/prisma';
import { contraste, minimoExigido } from './contraste';
import { conLuminosidad, hexAOklch, oklchAHex, type Oklch } from './oklch';
import {
  COMPROBACIONES_CONTRASTE,
  TEMAS_POR_DEFECTO,
  TOKENS,
  type ColoresTema,
} from './temas';

export type OpcionesDerivacion = {
  /** El color principal, en #rrggbb. */
  principal: string;
  /** Encabezado del color de la marca en vez de neutro. */
  encabezadoDeColor?: boolean;
  /** Retoques que se aplican al final, ya derivado. */
  ajustes?: Partial<Record<EsquemaColor, ColoresTema>>;
};

type Receta = { l: number; c: number };

// neutros con una pizca del tono de la marca
const NEUTROS: Record<EsquemaColor, Record<string, Receta>> = {
  CLARO: {
    fondo: { l: 0.978, c: 0.006 },
    superficie: { l: 1.0, c: 0 },
    superficieAlterna: { l: 0.958, c: 0.008 },
    borde: { l: 0.902, c: 0.01 },

    titulo: { l: 0.22, c: 0.02 },
    texto: { l: 0.25, c: 0.02 },
    textoSuave: { l: 0.55, c: 0.015 },

    tablaCabeceraFondo: { l: 0.958, c: 0.008 },
    tablaCabeceraTexto: { l: 0.4, c: 0.015 },
    tablaFilaAlterna: { l: 0.978, c: 0.006 },
    tablaFilaResaltada: { l: 0.955, c: 0.025 },
    tablaBorde: { l: 0.902, c: 0.01 },

    campoFondo: { l: 1.0, c: 0 },
    campoBorde: { l: 0.855, c: 0.012 },
  },
  OSCURO: {
    fondo: { l: 0.175, c: 0.022 },
    superficie: { l: 0.235, c: 0.022 },
    superficieAlterna: { l: 0.275, c: 0.024 },
    borde: { l: 0.335, c: 0.026 },

    titulo: { l: 0.97, c: 0.01 },
    texto: { l: 0.94, c: 0.012 },
    textoSuave: { l: 0.715, c: 0.02 },

    tablaCabeceraFondo: { l: 0.275, c: 0.024 },
    tablaCabeceraTexto: { l: 0.845, c: 0.016 },
    tablaFilaAlterna: { l: 0.155, c: 0.022 },
    tablaFilaResaltada: { l: 0.29, c: 0.055 },
    tablaBorde: { l: 0.335, c: 0.026 },

    campoFondo: { l: 0.2, c: 0.024 },
    campoBorde: { l: 0.375, c: 0.03 },
  },
};

// la marca, por esquema
const MARCA: Record<EsquemaColor, { l: number; factorCroma: number; fuerte: number }> = {
  CLARO: { l: 0.5, factorCroma: 1, fuerte: -0.09 },
  OSCURO: { l: 0.72, factorCroma: 0.75, fuerte: 0.08 },
};

const CLAVES_ESTADO = ['exito', 'exitoSuave', 'aviso', 'avisoSuave', 'error', 'errorSuave'];

/** El que se lea mejor sobre el fondo dado. */
function textoLegible(fondo: string, claro: string, oscuro: string): string {
  return (contraste(claro, fondo) ?? 0) >= (contraste(oscuro, fondo) ?? 0) ? claro : oscuro;
}

function derivarEsquema(
  esquema: EsquemaColor,
  base: Oklch,
  encabezadoDeColor: boolean,
): ColoresTema {
  const receta = MARCA[esquema];
  const croma = base.c * receta.factorCroma;
  const colores: ColoresTema = {};

  colores.marca = oklchAHex({ l: receta.l, c: croma, h: base.h });
  colores.marcaFuerte = oklchAHex({ l: receta.l + receta.fuerte, c: croma, h: base.h });
  colores.marcaSuave =
    esquema === 'CLARO'
      ? oklchAHex({ l: 0.965, c: Math.min(croma, 0.03), h: base.h })
      : oklchAHex({ l: 0.25, c: Math.min(croma, 0.06), h: base.h });
  // el oscuro sale del mismo tono: negro azulado sobre un boton verde canta
  const casiNegro = oklchAHex({ l: 0.16, c: Math.min(croma, 0.03), h: base.h });
  colores.marcaTexto = textoLegible(colores.marca, '#ffffff', casiNegro);

  for (const [clave, { l, c }] of Object.entries(NEUTROS[esquema])) {
    colores[clave] = oklchAHex({ l, c, h: base.h });
  }

  if (encabezadoDeColor) {
    const lFondo = esquema === 'CLARO' ? 0.42 : 0.28;
    const cFondo = Math.min(croma, esquema === 'CLARO' ? 0.16 : 0.09);
    colores.encabezadoFondo = oklchAHex({ l: lFondo, c: cFondo, h: base.h });
    colores.encabezadoTexto = textoLegible(colores.encabezadoFondo, '#ffffff', casiNegro);
    colores.encabezadoBorde = oklchAHex({ l: lFondo - 0.07, c: cFondo, h: base.h });
  } else {
    colores.encabezadoFondo = colores.superficie;
    colores.encabezadoTexto = colores.texto;
    colores.encabezadoBorde = colores.borde;
  }

  // el aro de foco tiene que verse contra el fondo del campo
  const contra = contraste(colores.marca, colores.campoFondo) ?? 0;
  colores.campoFoco = contra >= 3 ? colores.marca : colores.marcaFuerte;

  for (const clave of CLAVES_ESTADO) {
    colores[clave] = TEMAS_POR_DEFECTO[esquema][clave];
  }

  return colores;
}

/** Empuja el color de frente hasta que el par se lea. */
export function corregirContraste(colores: ColoresTema): ColoresTema {
  const salida = { ...colores };

  for (let pasada = 0; pasada < 3; pasada++) {
    let quedanFallos = false;

    for (const par of COMPROBACIONES_CONTRASTE) {
      const minimo = minimoExigido(par.grande);
      const fondo = salida[par.fondo];
      let frente = salida[par.frente];
      if (!fondo || !frente) continue;
      if ((contraste(frente, fondo) ?? 0) >= minimo) continue;

      const oklch = hexAOklch(frente);
      const fondoOklch = hexAOklch(fondo);
      if (!oklch || !fondoOklch) continue;

      const sentido = oklch.l >= fondoOklch.l ? 1 : -1;
      let corregido = false;
      for (let paso = 1; paso <= 8; paso++) {
        frente = conLuminosidad(oklch, oklch.l + sentido * 0.02 * paso);
        if ((contraste(frente, fondo) ?? 0) >= minimo) {
          salida[par.frente] = frente;
          corregido = true;
          break;
        }
      }
      if (!corregido) {
        salida[par.frente] = sentido > 0 ? '#ffffff' : '#000000';
      }
      quedanFallos = true;
    }

    if (!quedanFallos) break;
  }

  return salida;
}

/** Las dos paletas completas a partir del color principal. */
export function derivarTemas(
  opciones: OpcionesDerivacion,
): Record<EsquemaColor, ColoresTema> {
  const base = hexAOklch(opciones.principal);
  if (!base) throw new Error('El color principal debe ser #rrggbb.');

  const esquemas: EsquemaColor[] = ['CLARO', 'OSCURO'];
  const salida = {} as Record<EsquemaColor, ColoresTema>;

  for (const esquema of esquemas) {
    const derivado = derivarEsquema(esquema, base, opciones.encabezadoDeColor ?? false);
    const conAjustes = { ...derivado, ...(opciones.ajustes?.[esquema] ?? {}) };
    const corregido = corregirContraste(conAjustes);

    // solo tokens del catalogo, en su orden
    const limpio: ColoresTema = {};
    for (const token of TOKENS) limpio[token.clave] = corregido[token.clave];
    salida[esquema] = limpio;
  }

  return salida;
}
