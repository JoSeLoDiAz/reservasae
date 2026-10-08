/** Un filtro de opciones tiene que poder ofrecer «los que no tienen». */

/**
 * EL DESPLEGABLE SE ARMA CON LOS VALORES NO VACÍOS.
 *
 * `tabla.tsx` hace `const t = texto(r.v[c.clave]); if (t) vistos.add(t)`,
 * y `texto(null)` devuelve `""`. O sea que una columna cuyo `valor`
 * devuelva `null` --o `""`-- **nunca** ofrece una opción para el caso
 * vacío: se puede filtrar por el grupo 1, el 2 y el 3, y no por los
 * que no tienen ninguno. Justo los que hay que repartir.
 *
 * Lo encontró Josse en producción el 7 oct 2026, en Gestión de leads.
 *
 * Este spec recorre la SUPERFICIE: si alguien añade una columna
 * filtrable sobre un campo que puede venir vacío y no le pone
 * etiqueta, cae aquí y no en la pantalla de alguien.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/// El panel no tiene jest ---este repositorio lo resuelve asi, como
/// `el-espejo-no-se-separa` y `el-cumplimiento-no-se-separa`---.
const DIR = join(
  __dirname, '..', '..', '..', 'frontend', 'src', 'components', 'admin',
);

/// Un bloque de columna por elemento.
function columnasFiltrables(fichero: string) {
  const texto = readFileSync(join(DIR, fichero), 'utf8');
  return texto
    .split(/\n {4}\{\n/)
    .slice(1)
    .filter((b) => /filtro:\s*"opciones"/.test(b))
    .map((b) => ({
      clave: (/clave:\s*"([^"]+)"/.exec(b) ?? [])[1] ?? '?',
      valor: (/valor:\s*\([^)]*\)\s*=>([\s\S]*?)(?:\n\s{6}\w+:|\n\s{4}\})/.exec(b) ?? [])[1] ?? '',
    }));
}

describe('el filtro de grupo ofrece «Sin grupo»', () => {
  const fuente = readFileSync(join(DIR, 'columnas-participante.tsx'), 'utf8');

  it('el valor y la celda dicen lo mismo, por la misma función', () => {
    expect(fuente).toMatch(/const nombreDelGrupo = /);
    /// Las dos puntas: si una deja de usarla, vuelven a discrepar.
    const usos = (fuente.match(/nombreDelGrupo\(/g) ?? []).length;
    expect(usos).toBeGreaterThanOrEqual(3);
  });

  it('«Sin grupo» no es la cadena vacía, que el filtro descarta', () => {
    expect(fuente).toMatch(/g === null \? "Sin grupo"/);
    /// `?? ""` no vale aqui: `texto("")` es vacio y `if (t)` lo tira.
    expect(fuente).not.toMatch(/valor: \(f\) => f\.grupo,/);
  });

  /// EL CANDADO AL REVES: que no se «arregle» volviendo numerica la
  /// columna, que rompe el orden --Number("Grupo 1") es NaN--.
  it('la columna no se declara numérica', () => {
    const bloque = /clave: "grupo",[\s\S]{0,2000}?\n    \},/.exec(fuente)?.[0] ?? '';
    expect(bloque).not.toMatch(/numerica:\s*true/);
  });
});

describe('las demás columnas filtrables declaran su vacío', () => {
  /// Lo que se ha revisado y se deja fuera a proposito va aqui, con
  /// su porque. Vacia la lista, el spec vuelve a caer.
  const PERDONADAS = new Set([
    /// Enums obligatorios: no pueden venir vacios.
    'estado', 'etapa', 'gremio', 'origen', 'origenLead', 'tipoDocumento',
    'datosEmpresa', 'importacion', 'puedoContactar', 'sinIngreso',
    'sinActividades', 'accion', 'accionCodigo', 'falta', 'porDonde',
    'etapaAnterior', 'fuenteFormulario',
    /// Pendientes de decidir con Josse (7 oct 2026): se pueden quedar
    /// vacias y hoy no ofrecen opcion para ello.
    'departamento', 'municipio', 'curso', 'sede', 'ciudad',
    'campanaDeEntrada', 'asesor',
  ]);

  for (const f of readdirSync(DIR).filter(
    (x) => x.startsWith('columnas-') && x.endsWith('.tsx'),
  )) {
    it(`${f}`, () => {
      const sinEtiqueta = columnasFiltrables(f).filter(
        (c) =>
          !PERDONADAS.has(c.clave) &&
          !/\? ["`]|=== null \?|\?\? ["`]\w/.test(c.valor),
      );
      expect(sinEtiqueta.map((c) => c.clave)).toEqual([]);
    });
  }
});
