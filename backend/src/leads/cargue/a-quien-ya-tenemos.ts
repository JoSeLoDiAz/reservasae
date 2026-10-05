/** Si esa fila es alguien que ya está en la mesa de este gremio. */

/**
 * EL CRUCE ES DEL CLIENTE: documento, correo o celular.
 *
 * Los tres y no solo el documento, porque el caso que motivó todo
 * esto es justo el del lead que NO tiene documento: entró por una
 * pauta con el celular y nada más, y la base del cliente le tiene
 * la cédula. Cruzar solo por documento no lo encontraría y se
 * crearía un segundo lead de la misma persona ---y entonces dos
 * asesoras la llaman, que es el problema que la mesa de entrada
 * existe para no tener---.
 *
 * YA NORMALIZADOS LOS TRES, y por eso esto funciona. En
 * `LeadEntrante` el correo se guarda en minúsculas, el celular en
 * diez dígitos sin el +57 y el documento sin puntos: lo escribe
 * `leads.service.limpiar()` al entrar. Si aquí se comparara el
 * texto crudo del Excel, «+57 300 111 2222» no encontraría a
 * «3001112222» y el informe diría «todos nuevos» ---que es
 * exactamente lo que uno espera ver en un cargue, así que nadie lo
 * buscaría---.
 *
 * ESTO NO TOCA LA BASE: recibe los candidatos ya leídos y decide.
 * Separarlo es lo que permite probar la regla del cruce sin una
 * base de datos, y es también lo que permite que la vista previa y
 * la aplicación usen la MISMA decisión en vez de dos consultas
 * parecidas.
 */

import type { DatosDeLaFila } from './datos-de-la-fila';

/// Lo mínimo de un lead guardado para poder cruzarlo. Es un
/// supertipo de lo que hace falta: el servicio trae además los
/// campos que se van a comparar para repartir huecos y choques.
export type CandidatoDeLaMesa = {
  id: string;
  externoId: string;
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  correo: string | null;
  celular: string | null;
};

/// Por qué se dice que es la misma persona. Se devuelve y se
/// enseña: «ya estaba» sin decir por dónde obliga a abrir la mesa
/// para entender por qué una fila con otro nombre casó con alguien.
export type PorQueEsLaMisma = 'DOCUMENTO' | 'CORREO' | 'CELULAR' | 'LLAVE';

export type YaLaTeniamos<T extends CandidatoDeLaMesa> = {
  lead: T;
  porque: PorQueEsLaMisma;
};

/**
 * El lead que ya es esta persona, o null.
 *
 * EL ORDEN IMPORTA y no es alfabético: documento, llave, correo,
 * celular. El documento es la identidad en todo el sistema
 * ---`Persona` es única por `(tipo, número)`--- así que manda sobre
 * todo lo demás. Un correo o un celular compartidos no son una
 * identidad: una familia comparte buzón y una empresa pone el
 * teléfono de la secretaria en veinte formularios, que es justo
 * contra lo que avisa `cruzar-con-el-crm.ts`. Sirven para
 * reconocer, pero después del documento.
 */
export function aQuienYaTeniamos<T extends CandidatoDeLaMesa>(
  datos: DatosDeLaFila,
  /// Las llaves de idempotencia de esta fila: la nueva y, si la
  /// hay, la de antes de que la llave llevara gremio.
  llaves: string[],
  candidatos: T[],
): YaLaTeniamos<T> | null {
  /// 1. EL DOCUMENTO.
  ///
  /// El número igual basta, y el tipo solo descarta cuando los DOS
  /// lo tienen y no coinciden. Que un lead guardado tenga el
  /// número sin el tipo es el caso normal ---entra así desde la
  /// pauta--- y exigir que coincida un tipo que no está haría que
  /// no se encontrara nunca: se crearía un segundo lead de la
  /// misma cédula, y el cargue habría empeorado justo lo que viene
  /// a arreglar.
  ///
  /// Y cuando los dos lo tienen y DIFIEREN no se cruza: la misma
  /// numeración en una cédula y en un pasaporte son dos personas,
  /// y unirlas mezcla dos identidades en una ficha.
  if (datos.numeroDocumento) {
    const porDocumento = candidatos.find(
      (c) =>
        c.numeroDocumento === datos.numeroDocumento &&
        (c.tipoDocumentoSepId === null ||
          datos.tipoDocumentoSepId === null ||
          c.tipoDocumentoSepId === datos.tipoDocumentoSepId),
    );
    if (porDocumento) return { lead: porDocumento, porque: 'DOCUMENTO' };
  }

  /// 2. LA LLAVE DE IDEMPOTENCIA, que es la misma fila del mismo
  /// archivo subido otra vez.
  ///
  /// Va antes del correo y del celular porque es exacta: incluye
  /// el gremio y el curso. Sin esto, recargar el archivo después
  /// de un cargue a medias ---porque se cayó la conexión--- podría
  /// casar por correo con OTRO lead de la misma persona para otro
  /// curso y rellenarle huecos del curso equivocado.
  const porLlave = candidatos.find((c) => llaves.includes(c.externoId));
  if (porLlave) return { lead: porLlave, porque: 'LLAVE' };

  /// 3. EL CORREO.
  if (datos.correo) {
    const porCorreo = candidatos.find((c) => c.correo === datos.correo);
    if (porCorreo) return { lead: porCorreo, porque: 'CORREO' };
  }

  /// 4. EL CELULAR.
  if (datos.celular) {
    const porCelular = candidatos.find((c) => c.celular === datos.celular);
    if (porCelular) return { lead: porCelular, porque: 'CELULAR' };
  }

  return null;
}

/** Cómo se dice en la pantalla por dónde se reconoció. */
export const COMO_SE_RECONOCIO: Record<PorQueEsLaMisma, string> = {
  DOCUMENTO: 'por el número de documento',
  LLAVE: 'es la misma fila de un cargue anterior',
  CORREO: 'por el correo',
  CELULAR: 'por el celular',
};
