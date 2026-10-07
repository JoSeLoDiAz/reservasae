/** Con qué se reconoce una fila del cargue. Y de dónde viene. */

/**
 * NO HAY REGLA NUEVA AQUÍ, Y ESO ES LO IMPORTANTE.
 *
 * «Qué hace falta para poder guardar a alguien sin duplicarlo» ya
 * está decidido, una sola vez, en `llave-del-lead.ts`: hace falta
 * al menos uno de documento, correo, celular o nombre. Esa es
 * exactamente la regla que el cliente pidió para el cargue ---«que
 * no sea restrictiva porque no tengo todos los datos»--- así que
 * escribir aquí una segunda sería tener dos respuestas para la
 * misma pregunta, y el día que una cambie el cargue admitiría
 * filas que el webhook rechaza, o al revés.
 *
 * Este fichero solo pone el convenio y el origen en su sitio.
 *
 * EL CONVENIO EN LA LLAVE NO ES OPCIONAL. Se arregló el 5 oct 2026
 * y el defecto que tapaba es este: `AF1` existe en ADECOPRIA y en
 * BRITCHAM y no es el mismo curso, así que sin el gremio dentro, la
 * misma cédula pidiendo «AF1» daba la misma llave en los dos. Un
 * cargue de la base de BRITCHAM se habría tragado en silencio todos
 * los leads que coincidieran con ADECOPRIA ---volvían como
 * «repetido», sin crear nada--- y el informe habría dicho «ya
 * estaban», que es lo que uno espera ver al recargar un archivo.
 * Nadie lo habría buscado.
 */

import { llaveDelLead, type Llave } from '../llave-del-lead';

import type { DatosDeLaFila } from './datos-de-la-fila';

/**
 * De dónde salieron estos leads, para que la pantalla los separe.
 *
 * Va en `origenSistema`, que es la columna que la mesa ya enseña
 * como `porDonde` y por la que se puede filtrar sin tocar el
 * esquema. `meta` son los de la pauta pagada; esto es la base que
 * el equipo cargó a mano, y mezclarlas haría que el coste por
 * inscrito de una campaña contara gente que nunca vio un anuncio.
 *
 * Y entra en el único de la base ---`(origenSistema, externoId)`---
 * así que además hace que el cargue no pueda chocar con la llave de
 * un lead de Meta que casualmente coincida.
 */
export const ORIGEN_DEL_CARGUE = 'cargue-masivo';

/**
 * LO QUE ESCRIBIMOS NOSOTROS, para poder apartarlo del buzon.
 *
 * La mesa de entrada es «lo que nos mandan de fuera», y eso NO se
 * puede escribir como una lista blanca: `origenSistema` es texto
 * libre ---lo elige quien llama al webhook--- asi que el dia que
 * el orquestador cambie su valor, una lista blanca lo haria
 * DESAPARECER de la mesa sin que nada fallara. Justo lo contrario
 * de tener el control de lo que entra.
 *
 * Por eso se excluye lo nuestro, que es lo unico que conocemos con
 * certeza: lo que no reconocemos aparece, que en un buzon es la
 * respuesta correcta. Si manana hay otro cargue propio, va aqui.
 */
export const ORIGENES_PROPIOS: readonly string[] = [ORIGEN_DEL_CARGUE];

/**
 * La llave de esta fila, o por qué no se puede reconocer.
 *
 * El convenio va SIEMPRE y el código de la acción también: los dos
 * entran en la llave, así que la misma persona pidiendo AF1 y AF2
 * son dos leads ---que es lo correcto, se inscribe en dos cosas--- y
 * la misma persona en dos gremios también.
 */
export function llaveDeLaFila(
  datos: DatosDeLaFila,
  codigoDeLaAccion: string | null,
  convenioId: string,
): Llave {
  return llaveDelLead(
    {
      /// El cargue NO trae `externoId`: la base del cliente no es
      /// un sistema emisor con ids propios, es una hoja de
      /// cálculo. Se deja explícito en null para que se vea que no
      /// es un olvido ---con un id propio, la llave sería ese id y
      /// ni el documento ni el gremio entrarían en ella---.
      externoId: null,
      tipoDocumentoSepId: datos.tipoDocumentoSepId,
      numeroDocumento: datos.numeroDocumento,
      correo: datos.correo,
      celular: datos.celular,
      /// `llaveDelLead` espera el nombre en `nombres` y el apellido
      /// aparte. Cuando el archivo trae la frase entera va ahí
      /// completa, que es lo que hay: la llave del contenido pega
      /// los trozos que existan, así que una frase entera da una
      /// llave igual de estable que dos columnas.
      nombres: datos.primerNombre ?? datos.nombreCompleto,
      primerApellido: datos.primerApellido,
    },
    codigoDeLaAccion,
    convenioId,
  );
}
