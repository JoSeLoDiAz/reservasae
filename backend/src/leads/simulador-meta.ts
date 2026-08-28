/** Un aviso de Meta, hecho por nosotros, para probar. */

/// Por qué existe esto.
///
/// Conectar Meta de verdad necesita tres cosas que no
/// dependen de nosotros: una app de Facebook aprobada, una
/// página con permisos, y un dominio público al que Meta
/// pueda llegar. Mientras falte cualquiera de las tres, el
/// webhook no se puede probar tocándolo desde Meta.
///
/// Pero SÍ se puede probar entero desde este lado: armamos el
/// mismo cuerpo que manda Meta, lo firmamos con el mismo
/// secreto y lo mandamos a nuestra propia ruta. Lo que se
/// prueba así es todo lo nuestro —la firma, el `rawBody`, que
/// el ValidationPipe no se meta, el guardado— que es
/// justamente donde están los errores que podemos cometer.
///
/// Lo que NO prueba: que Meta llegue al dominio. Eso solo se
/// sabe el día que se conecta, y por eso el panel muestra
/// aparte la URL y el token que hay que pegarle a Meta.

import { createHmac } from 'node:crypto';

/// Qué se le pide al simulador.
export type Encargo = {
  /// Cuántos avisos van en el mismo POST. Meta agrupa, y
  /// mandar dos en uno es la prueba que de verdad importa:
  /// quedarse con el primero y perder el resto es un fallo
  /// que nadie nota hasta que faltan leads.
  cuantos: number;
  /// El momento, en milisegundos. Entra por parámetro para
  /// que la prueba no dependa del reloj.
  ahora: number;
};

/// El cuerpo firmado y listo para mandar.
export type Simulado = {
  /// El JSON EXACTO que va en el POST. Se firma esta cadena y
  /// se manda esta cadena: si se vuelve a serializar por el
  /// camino, la firma deja de cuadrar y el fallo parece de
  /// Meta cuando es nuestro.
  cuerpo: string;
  /// La cabecera `x-hub-signature-256`, ya con su prefijo.
  firma: string;
  /// Los identificadores que se inventaron, para poder
  /// buscarlos después en la tabla.
  leadgenIds: string[];
};

/// Los leads de prueba se llaman así a propósito.
///
/// Van por el MISMO camino que los de verdad —misma tabla,
/// misma llave de idempotencia, mismo origen— porque probar
/// por un camino distinto no prueba nada. Lo único que
/// cambia es que el identificador se ve a un metro de que es
/// inventado, y así nadie llama a un teléfono que no existe.
export const PREFIJO_DE_PRUEBA = 'PRUEBA';

/** ¿Este lead lo inventó el simulador? */
export function esDePrueba(leadgenId: string): boolean {
  return leadgenId.startsWith(`${PREFIJO_DE_PRUEBA}-`);
}

/**
 * Arma el cuerpo que mandaría Meta, y lo firma.
 *
 * Sin secreto NO se firma nada: devolver una firma inventada
 * haría que la prueba fallara con «firma inválida», que es
 * cierto pero no es el problema. Quien llama distingue los
 * dos casos y dice cuál es.
 */
export function simularAviso(
  encargo: Encargo,
  secreto: string | undefined,
): Simulado | null {
  if (!secreto) return null;

  const cuantos = Math.max(1, Math.min(10, Math.floor(encargo.cuantos)));
  /// Segundos, que es lo que manda Meta. El backend lo
  /// multiplica por mil; si aquí mandáramos milisegundos, la
  /// prueba pasaría y en producción los leads saldrían con
  /// fecha del año 57000.
  const segundos = Math.floor(encargo.ahora / 1000);

  const leadgenIds: string[] = [];
  const cambios = [];

  for (let i = 0; i < cuantos; i += 1) {
    /// El milisegundo y el número de orden: dos pruebas
    /// seguidas tienen que dar ids distintos, o la segunda no
    /// crea nada —la llave es única— y parecería que falló.
    const id = `${PREFIJO_DE_PRUEBA}-${encargo.ahora}-${i + 1}`;
    leadgenIds.push(id);
    cambios.push({
      field: 'leadgen',
      value: {
        ad_id: `${PREFIJO_DE_PRUEBA}-anuncio`,
        form_id: `${PREFIJO_DE_PRUEBA}-formulario`,
        leadgen_id: id,
        created_time: segundos,
        page_id: `${PREFIJO_DE_PRUEBA}-pagina`,
      },
    });
  }

  /// La forma es la de Meta, no una parecida: `object: page`,
  /// `entry` con su `id` y su `time`, y los cambios dentro.
  /// Una forma aproximada probaría un lector aproximado.
  const cuerpo = JSON.stringify({
    object: 'page',
    entry: [
      {
        id: `${PREFIJO_DE_PRUEBA}-pagina`,
        time: segundos,
        changes: cambios,
      },
    ],
  });

  const firma =
    'sha256=' + createHmac('sha256', secreto).update(cuerpo).digest('hex');

  return { cuerpo, firma, leadgenIds };
}
