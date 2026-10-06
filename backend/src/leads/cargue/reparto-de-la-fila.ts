/** Qué se rellena y qué choca, cuando la persona ya estaba. */

/**
 * LA REGLA ES DEL CLIENTE, TEXTUAL: «Complete lo que no tiene
 * datos y los que estén diferentes como la alerta cuando lo
 * volvieron a llenar» (5 oct 2026).
 *
 * Son dos frases y dos cosas distintas:
 *
 *   - LO VACÍO SE RELLENA. Un campo vacío no es la corrección de
 *     nadie, así que escribirlo no pisa trabajo de ningún asesor.
 *     Es el lead que entró por una pauta sin cédula y al que la
 *     base del cliente sí le tiene la cédula: ese hueco es
 *     exactamente lo que este cargue viene a tapar.
 *
 *   - LO DISTINTO NO SE PISA. Se deja constancia y decide una
 *     persona. Un cargue que sobrescribe lo que un asesor
 *     corrigió por teléfono es un cargue que borra el trabajo de
 *     la semana, y no se nota: la pantalla enseña un número
 *     limpio y lo que había ya no está para compararlo.
 *
 * Y «como la alerta cuando lo volvieron a llenar» no es una
 * comparación suya: es el mecanismo que ya existe. Cuando alguien
 * reenvía el formulario público con datos distintos de los que el
 * asesor corrigió, `repartirDatosDeLaFicha` parte lo que llega en
 * `{huecos, choques}`, los huecos se escriben y los choques se
 * nombran en el aviso `CAMBIOS_PROPUESTOS`
 * (`preinscripcion.service.ts`). Aquí se usa ESA función y no una
 * copia: el día que cambie qué cuenta como «vacío» ---hoy son
 * `null`, `undefined` y la cadena en blanco--- las dos puertas
 * tienen que cambiar juntas o una empezará a pisar lo que la otra
 * respeta.
 *
 * Lo que cambia es dónde va la constancia. Allí va a
 * `Notificacion`, que cuelga de `participanteId`; un lead de la
 * mesa todavía no tiene ficha ---es justo su definición---, así que
 * aquí va a `NotaDeGestion` con `leadId`, que es la tabla donde ya
 * vive la gestión de los leads sin ficha. No hay tabla nueva, por
 * lo mismo que no la hubo para las llamadas: dos tablas dando
 * cuenta de lo que le pasó a un lead acaban discrepando.
 */

import {
  repartirDatosDeLaFicha,
  type RepartoDeLaFicha,
} from '../../preinscripcion/datos-de-la-participacion';

import { NOMBRE_DEL_CAMPO_DEL_LEAD } from './columnas-del-cargue';
import type { DatosDeLaFila } from './datos-de-la-fila';

/// Lo que el lead guardado tiene en esos mismos campos.
export type LeadGuardado = Partial<Record<keyof DatosDeLaFila, unknown>>;

export type ChoqueDelCargue = {
  campo: string;
  /// En castellano, para la nota y para la pantalla.
  comoSeLlama: string;
  dice: string;
  guardado: string;
};

export type RepartoDelCargue = {
  /// Lo que se puede escribir ya: estaba vacío y no pisa nada.
  huecos: Record<string, unknown>;
  /// Los nombres en castellano de esos huecos, para el informe.
  rellena: string[];
  choques: ChoqueDelCargue[];
};

/**
 * Reparte la fila contra el lead que ya estaba.
 *
 * `null` en la fila es «el archivo no trae ese dato» y NO es
 * ninguna de las dos cosas: ni rellena ni choca. Esto es lo que
 * hace el cargue no restrictivo de verdad ---una base con la mitad
 * de las columnas vacías no propone vaciar media mesa de entrada---
 * y es la misma regla 3 que gobierna el cargue de empresas: «una
 * celda vacía nunca borra».
 *
 * Por eso se convierte a `undefined` antes de llamar: la función
 * que se reutiliza salta los `undefined` y trata los `null` como
 * un valor que llega.
 */
export function repartirLaFila(
  dice: DatosDeLaFila,
  guardado: LeadGuardado,
): RepartoDelCargue {
  const loQueTrae: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(dice)) {
    if (valor === null || valor === undefined) continue;
    if (typeof valor === 'string' && valor.trim() === '') continue;
    loQueTrae[campo] = valor;
  }

  const reparto: RepartoDeLaFicha = repartirDatosDeLaFicha(loQueTrae, guardado);

  return {
    huecos: reparto.huecos,
    rellena: Object.keys(reparto.huecos).map(comoSeLlama),
    choques: reparto.choques.map((c) => ({
      campo: c.campo,
      comoSeLlama: comoSeLlama(c.campo),
      dice: enTexto(c.dice),
      guardado: enTexto(c.guardado),
    })),
  };
}

/**
 * La línea de la nota de gestión, con los dos valores delante.
 *
 * Con los VALORES y no solo los nombres de campo, y es a propósito:
 * «el celular es distinto» obliga a abrir el archivo del cliente
 * para saber qué decía, y el archivo no va a estar ahí dentro de
 * dos semanas. Con los dos números delante, el asesor llama y
 * resuelve en la misma llamada.
 *
 * Es el mismo criterio ---y el mismo formato--- que
 * `comoSeCuentanLosChoques` en la preinscripción. Esa no se usa tal
 * cual porque su diccionario de nombres es el de los cuatro campos
 * de la participación y aquí los campos son los del lead: pasarle
 * `correo` devolvería «correo» igual, pero `tipoDocumentoSepId`
 * devolvería `tipoDocumentoSepId`, que no es castellano.
 */
export function comoSeCuentanLosChoquesDelCargue(
  choques: ChoqueDelCargue[],
): string {
  return choques
    .map(
      (c) =>
        `${c.comoSeLlama}: el archivo dice «${c.dice}», está «${c.guardado}»`,
    )
    .join('; ');
}

function comoSeLlama(campo: string): string {
  return NOMBRE_DEL_CAMPO_DEL_LEAD[campo] ?? campo;
}

function enTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor === true) return 'sí';
  if (valor === false) return 'no';
  /// Solo los tipos que de verdad pueden estar en estas columnas:
  /// texto y números. Un `String(valor)` a secas sobre un objeto
  /// escribiría «[object Object]» en la nota que el asesor va a
  /// leer para decidir, y eso no es un dato: es ruido con pinta de
  /// dato.
  if (typeof valor === 'string' || typeof valor === 'number') {
    return String(valor);
  }
  return JSON.stringify(valor);
}
