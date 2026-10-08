/** Un filtro de opciones tiene que poder ofrecer «los que no tienen». */

/**
 * EL DESPLEGABLE SE ARMA CON LOS VALORES NO VACÍOS.
 *
 * `tabla.tsx` hace `const t = texto(r.v[c.clave]); if (t) vistos.add(t)`,
 * y `texto(null)` devuelve `""`. O sea que una columna cuyo `valor`
 * devuelva `null` --o `""`-- nunca ofrece opción para el caso vacío: se
 * podía filtrar por el grupo 1, el 2 y el 3, y no por los que no tienen
 * ninguno. Justo los que hay que repartir.
 *
 * Lo encontró Josse en producción el 7 oct 2026, en Gestión de leads.
 *
 * Recorre la SUPERFICIE de los tres ficheros de columnas: si alguien
 * añade una filtrable sobre un campo que puede venir vacío y no le pone
 * etiqueta, cae aquí y no en la pantalla de alguien.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(
  __dirname, '..', '..', '..', 'frontend', 'src', 'components', 'admin',
);

/// Un bloque por columna. EL `\r?` NO SOBRA: los ficheros del panel son
/// CRLF, y sin él este split no casaba NINGUNO. El describe de abajo
/// recorría una lista vacía y pasaba en verde sin mirar nada ---y eso
/// solo lo caza una mutación, nunca el verde---.
const SEPARADOR = new RegExp('\r?\n {4}\{\r?\n');

function columnasFiltrables(fichero: string) {
  return readFileSync(join(DIR, fichero), 'utf8')
    .split(SEPARADOR)
    .slice(1)
    .filter((b) => /filtro:\s*"opciones"/.test(b))
    .map((b) => ({
      clave: (/clave:\s*"([^"]+)"/.exec(b) ?? [])[1] ?? '?',
      valor: (/valor:\s*\([^)]*\)\s*=>([^\n]*)/.exec(b) ?? [])[1] ?? '',
    }));
}

const FICHEROS = readdirSync(DIR).filter(
  (x) => x.startsWith('columnas-') && x.endsWith('.tsx'),
);

describe('el spec ve de verdad lo que dice mirar', () => {
  /// Sin esto, un separador que no case deja los describes de abajo
  /// recorriendo listas vacías. Ya pasó.
  it('encuentra columnas filtrables en los tres ficheros', () => {
    expect(FICHEROS.length).toBeGreaterThanOrEqual(3);
    for (const f of FICHEROS) {
      expect({ f, n: columnasFiltrables(f).length }).toEqual({
        f,
        n: expect.any(Number),
      });
      expect(columnasFiltrables(f).length).toBeGreaterThan(0);
    }
  });
});

describe('el filtro de grupo ofrece «Sin grupo»', () => {
  const fuente = readFileSync(
    join(DIR, 'columnas-participante.tsx'), 'utf8',
  );

  it('el valor y la celda dicen lo mismo, por la misma función', () => {
    expect(fuente).toMatch(/const nombreDelGrupo = /);
    /// Las dos puntas: si una deja de usarla, vuelven a discrepar.
    expect((fuente.match(/nombreDelGrupo\(/g) ?? []).length)
      .toBeGreaterThanOrEqual(3);
  });

  it('«Sin grupo» no es la cadena vacía, que el filtro descarta', () => {
    expect(fuente).toMatch(/g === null \? "Sin grupo"/);
    expect(fuente).not.toMatch(/valor: \(f\) => f\.grupo,/);
  });

  /// EL CANDADO AL REVÉS: que no se «arregle» volviendo numérica la
  /// columna, que rompe el orden ---Number("Grupo 1") es NaN---.
  it('la columna no se declara numérica', () => {
    const bloque = /clave: "grupo",[\s\S]{0,2500}?\n {4}\},/.exec(fuente)?.[0] ?? '';
    expect(bloque).not.toMatch(/numerica:\s*true/);
  });
});

describe('toda columna filtrable declara su vacío', () => {
  /// Lo revisado y dejado fuera a propósito, con su porqué. Son enums y
  /// campos obligatorios: no pueden venir vacíos, así que una opción de
  /// «sin» nunca tendría filas. Vaciar la lista hace caer el spec.
  const PERDONADAS = new Set([
    'estado', 'etapa', 'gremio', 'origen', 'origenLead', 'tipoDocumento',
    'datosEmpresa', 'importacion', 'puedoContactar', 'sinIngreso',
    'sinActividades', 'accion', 'accionCodigo', 'falta', 'porDonde',
    'etapaAnterior', 'fuenteFormulario', 'grupo',
    /// `pendientes()` nunca devuelve vacio: siempre da «Sin
    /// pendientes», «Falta algun dato» o «Faltan N».
    'datos',
  ]);

  for (const f of FICHEROS) {
    it(f, () => {
      const sinEtiqueta = columnasFiltrables(f).filter(
        (c) =>
          !PERDONADAS.has(c.clave) &&
          /// Una etiqueta de verdad vale; `?? ""` NO: la cadena vacía
          /// se descarta igual que el nulo.
          !/\?\?\s*"[^"]+"|=== null \? "[^"]+"|\? "[^"]+"/.test(c.valor),
      );
      expect(sinEtiqueta.map((c) => c.clave)).toEqual([]);
    });
  }
});
