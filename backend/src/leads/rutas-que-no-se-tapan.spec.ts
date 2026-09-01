/** Ninguna ruta de leads tapa a otra. */

/**
 * Pasó de verdad: `POST /admin/leads/lote/convertir` lo capturaba
 * `@Post(':id/convertir')` del otro controlador con `:id = 'lote'`.
 * El lote entero llegaba a la conversión de UNO y contestaba que
 * le faltaba el canal — un 400 que no dice nada de la causa.
 *
 * Es la peor clase de fallo de enrutado: no hay error, hay otro
 * método atendiendo. Y es sensible al ORDEN en que se registran
 * los controladores, así que se arregla hoy y se rompe el día que
 * alguien los reordene sin tocar ninguna de las dos rutas.
 *
 * Este spec recorre la superficie entera en vez de fijar el caso
 * de hoy, que es el criterio de las pruebas de ámbito de este
 * repositorio.
 */

import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';

import { ConversionController } from './conversion.controller';
import { LeadsController } from './leads.controller';
import { MesaDeEntradaController } from './mesa-de-entrada.controller';

type Ruta = { clase: string; metodo: string; verbo: number; camino: string };

/// Las rutas declaradas de un controlador, leídas de su metadata.
function rutasDe(clase: new (...a: never[]) => object): Ruta[] {
  const prefijo = (Reflect.getMetadata(PATH_METADATA, clase) as string) ?? '';
  const proto = clase.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(proto)
    .filter((n) => n !== 'constructor')
    .map((n) => {
      const fn = proto[n];
      if (typeof fn !== 'function') return null;
      const camino = Reflect.getMetadata(PATH_METADATA, fn) as string | undefined;
      if (camino === undefined) return null;
      const verbo = Reflect.getMetadata(METHOD_METADATA, fn) as number;
      return {
        clase: clase.name,
        metodo: n,
        verbo,
        camino: `${prefijo}/${camino}`.replace(/\/+/g, '/').replace(/\/$/, ''),
      };
    })
    .filter((r): r is Ruta => r !== null);
}

/// ¿El molde `patron` se traga el camino `otro`?
///
/// Segmento a segmento: un `:param` se come cualquier segmento
/// literal, que es justo lo que hacía `:id/convertir` con
/// `lote/convertir`.
function seTraga(patron: string, otro: string): boolean {
  const a = patron.split('/');
  const b = otro.split('/');
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg.startsWith(':') || seg === b[i]);
}

const TODAS = [
  ...rutasDe(MesaDeEntradaController),
  ...rutasDe(ConversionController),
  ...rutasDe(LeadsController),
];

describe('ninguna ruta con parámetro se traga a una ruta fija', () => {
  it('hay rutas que examinar', () => {
    /// Si la lectura de metadata se rompe, este spec pasaría
    /// vacío y diría que todo está bien sin haber mirado nada.
    expect(TODAS.length).toBeGreaterThan(3);
  });

  it.each(TODAS.filter((r) => !r.camino.includes(':')))(
    '$clase.$metodo ($camino) no la tapa ninguna otra',
    (fija: Ruta) => {
      const ladrona = TODAS.find(
        (otra) =>
          otra !== fija &&
          otra.verbo === fija.verbo &&
          otra.camino.includes(':') &&
          seTraga(otra.camino, fija.camino),
      );

      expect(
        ladrona
          ? `${fija.camino} la captura ${ladrona.clase}.${ladrona.metodo} (${ladrona.camino})`
          : null,
      ).toBeNull();
    },
  );
});
