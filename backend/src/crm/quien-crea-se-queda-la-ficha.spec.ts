/** Todo el que crea una ficha dice si se la queda. */

/**
 * POR QUÉ EXISTE, y es un caso real de hoy (2 oct 2026).
 *
 * `crear()` dejó de deducir el asesor de `admin.id` y pasó a recibirlo
 * en un parámetro, `creadorLlevaFichas`, **con valor por defecto
 * `false`**. El arreglo era correcto —cerraba la tercera puerta de la
 * regla de los roles— pero de los TRES llamadores solo se actualizó
 * uno, el del panel.
 *
 * Los otros dos son justo los que más fichas crean:
 *
 *   - convertir un lead: el gestor lo convertía y la ficha se le iba
 *     al montón común, de donde se la podía llevar otro;
 *   - la carga masiva: una lista pegada entera nacía sin dueño.
 *
 * No lo cazó nada. `tsc` no se queja porque el parámetro tiene valor
 * por defecto; las 2.446 pruebas pasaron en verde; y el spec de la
 * tercera puerta leía `crear()` y la llamada del panel, de los otros
 * dos no decía nada. El único sitio donde esto se ve es RECORRIENDO
 * LA SUPERFICIE, que es lo que hace este fichero —el mismo criterio
 * de `escribir-pide-escribir` y de `fuera-del-ambito`—.
 *
 * Si mañana aparece un cuarto llamador y se olvida, esto falla y le
 * obliga a declarar qué pasa con el asesor antes de seguir.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');

function todosLosFuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return todosLosFuentes(ruta);
    if (!nombre.endsWith('.ts')) return [];
    if (nombre.endsWith('.spec.ts')) return [];
    return [ruta];
  });
}

/// El texto de la llamada, desde `crear(` hasta su paréntesis de
/// cierre. Se cuenta la profundidad para no cortar en el primer `)`
/// que aparezca dentro de un argumento.
function cuerpoDeLaLlamada(texto: string, desde: number): string {
  let profundidad = 0;
  for (let i = desde; i < texto.length; i += 1) {
    if (texto[i] === '(') profundidad += 1;
    if (texto[i] === ')') {
      profundidad -= 1;
      if (profundidad === 0) return texto.slice(desde, i + 1);
    }
  }
  return texto.slice(desde);
}

type Llamada = { archivo: string; cuerpo: string };

function llamadasACrear(): Llamada[] {
  const fuera: Llamada[] = [];

  for (const ruta of todosLosFuentes(RAIZ)) {
    /// SIN COMENTARIOS, y no es un detalle: este proyecto explica sus
    /// decisiones en docblocks, así que `crm.crear()` aparece citado
    /// en prosa más veces que llamado. Sin quitarlos, el spec acusa
    /// dos docblocks de `preinscripcion.service.ts` que no llaman a
    /// nada ---pasó al escribirlo---.
    const texto = readFileSync(ruta, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    /// `crm.crear(` y `this.crear(`, que son las dos formas con que
    /// se llama al de participantes. Se excluye la declaración.
    const patron = /(?:crm|this)\.crear\(/g;
    let hallado: RegExpExecArray | null;

    while ((hallado = patron.exec(texto)) !== null) {
      fuera.push({
        archivo: ruta.replace(RAIZ, '').replace(/\\/g, '/'),
        cuerpo: cuerpoDeLaLlamada(texto, hallado.index),
      });
    }
  }

  return fuera;
}

/// Los que crean una ficha de participante. `enlace-de-completado`
/// tiene su propio `this.crear` --crea un ENLACE, no una ficha-- y no
/// entra: se reconoce porque su llamada no lleva un `dto`.
const DE_PARTICIPANTE = (l: Llamada) =>
  !l.archivo.includes('enlace-de-completado');

describe('quien crea una ficha dice si se la queda', () => {
  it('hay llamadas que mirar, o este spec no prueba nada', () => {
    const llamadas = llamadasACrear().filter(DE_PARTICIPANTE);

    /// Si un día alguien renombra `crear` y este patrón deja de
    /// encontrar nada, el spec pasaría en verde sin mirar nada. Esta
    /// es la línea que lo impide.
    expect(llamadas.length).toBeGreaterThanOrEqual(3);
  });

  it('todas resuelven el asesor de forma explícita', () => {
    const mudas = llamadasACrear()
      .filter(DE_PARTICIPANTE)
      .filter((l) => !/conveniosQueLlevanFichas/.test(l.cuerpo))
      .map((l) => l.archivo);

    /// Cada llamada tiene que DECIR si quien crea se queda la ficha.
    /// No vale el valor por defecto: fue justo lo que dejó sin asesor
    /// a la conversión y a la carga masiva.
    expect(mudas).toEqual([]);
  });
});
