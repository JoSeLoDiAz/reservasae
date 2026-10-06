/** Con qué se reconoce un lead que ya llegó. */

/**
 * Los webhooks reintentan, y quien los manda ni lo ve. Sin una
 * llave estable, un parpadeo de red crea dos personas.
 *
 * Se admiten TRES llaves, en este orden:
 *
 *   1. `externoId` — el id del emisor, si lo tiene.
 *   2. El DOCUMENTO — que es la identidad en todo el sistema:
 *      `Persona` es única por `(tipoDocumentoSepId,
 *      numeroDocumento)`, así que usarlo aquí es la misma regla
 *      y no una segunda.
 *   3. EL CONTENIDO — correo, celular, nombre y curso. Es la que
 *      hace que NINGÚN lead se pierda: uno de una pauta pagada
 *      que se rechaza es dinero quemado, y quien lo mandó ni se
 *      entera. Entra, y el equipo le pone el documento desde la
 *      mesa de entrada.
 *
 * El documento se NORMALIZA antes de formar la llave, y eso es
 * lo que hace que sirva: `1.020.304.050` y `1020304050` son la
 * misma cédula, y sin normalizar darían dos leads que nadie
 * relaciona. Es el mismo defecto que tuvo la preinscripción
 * pública.
 *
 * El prefijo `doc:` no es decorativo: sin él, un emisor cuyo
 * `externoId` fuera un número de cédula chocaría con el lead
 * derivado de esa misma cédula, y uno se comería al otro.
 *
 * Y EL GREMIO VA DENTRO DE LAS DOS LLAVES DERIVADAS.
 *
 * El único de la base es `(origenSistema, externoId)` y no
 * lleva convenio (`prisma/schema.prisma`), así que la llave es
 * lo ÚNICO que separa los gremios aquí. El código de la acción
 * no los separa: `AF1` existe en ADECOPRIA y en BRITCHAM y no
 * es el mismo curso --el propio `leads.service` resuelve el
 * código contra las acciones DE ESE convenio por eso mismo--.
 * Sin el gremio en la llave, la misma persona pidiendo «AF1» en
 * BRITCHAM daba `doc:1-1020304050:AF1`, idéntica a la de su
 * lead de ADECOPRIA: el segundo gremio NO CREABA NADA, volvía
 * como «repetido» y se le devolvía a quien llamaba el `id`, el
 * `estado` y el `participanteId` del lead del OTRO gremio.
 *
 * No se veía porque el webhook contestaba 200: para Meta el
 * lead había entrado.
 *
 * Va en la del contenido por lo mismo, y no por simetría: dos
 * leads con el mismo correo, celular, nombre y código en
 * gremios distintos también daban la misma llave, y ahí el
 * choque lo habría dado el único de la base --un 500 que el
 * emisor lee como «no llegó»--.
 *
 * El `externoId` propio del emisor se deja tal cual: ese id es
 * su identidad y si manda el mismo para dos gremios está
 * diciendo que es el mismo registro, no una coincidencia.
 */

import { normalizarCelular } from '../comun/celular';
import { normalizarDocumento } from '../comun/documento';

/**
 * La llave, y LA QUE SE USABA ANTES DE QUE LLEVARA GREMIO.
 *
 * El gremio entró en la llave el 5 oct 2026 para que el mismo
 * documento pidiendo «AF1» en los dos convenios dejara de verse como
 * un repetido. Pero ESTA LLAVE SE GUARDA EN LA BASE, en
 * `LeadEntrante.externoId`: los leads que ya están guardados llevan
 * la forma vieja ---`doc:1-1020304050:AF1`--- y al cambiar el formato
 * dejarían de reconocerse.
 *
 * O sea que el arreglo, solo, habría convertido cada reintento de un
 * emisor en un DUPLICADO de un lead que ya existe: justo lo que la
 * llave existe para evitar, y en la puerta por la que entra la pauta
 * pagada.
 *
 * Por eso se devuelven las dos. Quien compara busca por cualquiera de
 * ellas; lo que se ESCRIBE es siempre la nueva, así que esto se va
 * apagando solo según los leads viejos se van gestionando. No hace
 * falta migrar nada ni elegir un día para el cambio.
 */
export type Llave = { llave: string; anterior?: string } | { falta: string };

export function llaveDelLead(
  dto: {
    externoId?: string | null;
    tipoDocumentoSepId?: number | null;
    numeroDocumento?: string | null;
    correo?: string | null;
    celular?: string | null;
    nombres?: string | null;
    primerApellido?: string | null;
  },
  /// El codigo del curso ya resuelto: `AF1`, o null.
  codigoDelCurso?: string | null,
  /// EL GREMIO del lead que entra. Va obligatorio a proposito
  /// --aunque admita null-- para que ningun sitio nuevo pueda
  /// formar una llave olvidandolo: ese olvido es justo el que
  /// se tragaba los leads del segundo gremio en silencio.
  convenioId?: string | null,
): Llave {
  const propio = (dto.externoId ?? '').trim();
  if (propio) return { llave: propio };

  /// Sin gremio la llave se marca, no se calla: asi un lead
  /// huerfano no se mezcla con los de un convenio de verdad.
  const gremio = (convenioId ?? '').trim() || 'sin-gremio';

  const numero = dto.numeroDocumento
    ? normalizarDocumento(dto.numeroDocumento)
    : null;
  const tipo = dto.tipoDocumentoSepId;

  if (numero && tipo !== null && tipo !== undefined) {
    /// El CURSO va en la llave, y esto es lo que permite que la
    /// misma persona se inscriba en varias formaciones.
    ///
    /// Con la cedula sola, quien ya pidio AF1 y despues pide AF2
    /// vuelve como «repetido» y su segunda peticion se pierde en
    /// silencio -- que es justo lo contrario de lo que este
    /// webhook existe para hacer.
    ///
    /// Va el CODIGO resuelto y no el texto: «AF1», «af 1» y
    /// «AF1 - los nuevos metodos» son la misma inscripcion, y
    /// con el texto crudo serian tres.
    const curso = codigoDelCurso ?? 'sin-af';
    /// El gremio DELANTE del documento: el mismo `AF1` de dos
    /// convenios son dos cursos distintos, y sin esto el
    /// segundo gremio volvia como «repetido» del primero.
    return {
      llave: `doc:${gremio}:${tipo}-${numero}:${curso}`,
      /// La de antes del 5 oct 2026, para reconocer lo ya guardado.
      anterior: `doc:${tipo}-${numero}:${curso}`,
    };
  }

  /// SIN DOCUMENTO TAMBIEN ENTRA. La llave sale del contenido.
  ///
  /// Antes se rechazaba, y el razonamiento era bueno --sin llave,
  /// un reintento crea un duplicado que nadie relaciona-- pero la
  /// conclusion era la equivocada: un lead de una pauta PAGADA
  /// que se rechaza es dinero quemado, y quien lo mando ni se
  /// entera. Perderlo es peor que guardarlo raro.
  ///
  /// Y no hay que renunciar a la idempotencia para recibirlo: la
  /// llave se arma con lo que SI trae. Mismo cuerpo, misma llave,
  /// y el reintento vuelve como repetido igual que los demas. Lo
  /// que cambia es que dos personas distintas con los mismos
  /// datos serian el mismo lead -- y eso, sin documento, es
  /// indistinguible de un reintento de todas formas.
  ///
  /// La ficha NO se crea desde aqui: el lead queda en la mesa de
  /// entrada diciendo que le falta el documento, y el equipo lo
  /// completa antes de convertirlo. Que es exactamente para lo
  /// que existe esa pantalla.
  const partes = [
    (dto.correo ?? '').trim().toLowerCase(),
    /// El MISMO normalizador que usa el resto del sistema, no
    /// un `replace` propio: `+57 300 111 2222` y `3001112222`
    /// tienen que dar la misma llave, y un quita-no-digitos deja
    /// el 57 delante en uno y no en el otro.
    dto.celular ? normalizarCelular(dto.celular) : '',
    (dto.nombres ?? '').trim().toLowerCase(),
    (dto.primerApellido ?? '').trim().toLowerCase(),
    codigoDelCurso ?? 'sin-af',
  ].filter(Boolean);

  /// Salvo que no traiga NADA con que formarla.
  ///
  /// Un lead sin documento, sin correo, sin celular y sin nombre
  /// no es un lead incompleto: es una peticion vacia, y guardar
  /// una fila por cada reintento de eso llena la mesa de ruido
  /// que nadie puede atender.
  if (partes.length <= 1) {
    return {
      falta:
        'Este lead no trae nada con que reconocerlo: ni documento, ni ' +
        'externoId, ni correo, ni celular, ni nombre. Aunque sea uno de ' +
        'esos hace falta para poder guardarlo y no duplicarlo al reintentar.',
    };
  }

  /// El prefijo distingue esta llave de las otras dos, por lo
  /// mismo que `doc:` distingue a aquella de un `externoId`.
  return {
    llave: `sin-doc:${gremio}:${partes.join('|')}`,
    anterior: `sin-doc:${partes.join('|')}`,
  };
}
