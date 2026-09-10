/** Al SENA solo va la marca sensible que sigue amparada. */

/**
 * La caracterización es etnia, discapacidad, condición de víctima
 * y diversidad sexual: datos sensibles del art. 5 de la Ley 1581.
 * Cada marca cuelga de la autorización exacta que la ampara, y el
 * esquema lo exige — `autorizacionId` no es opcional.
 *
 * Pero el reporte las traía TODAS, sin mirar si esa autorización
 * seguía viva. Alguien que revocó en un gremio seguía exportando
 * su marca en el reporte del otro, donde su autorización sí sigue
 * viva: un dato sensible viajando al Estado amparado por un
 * consentimiento retirado.
 *
 * Este spec mira el `include` que sale hacia Prisma, no el
 * resultado. Es lo único que distingue «filtra» de «trae todo y
 * ya veremos»: con un doble que devolviera datos, cualquier
 * implementación pasaría.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FUENTE = readFileSync(join(__dirname, 'sep.service.ts'), 'utf8');

/// El bloque del include de caracterizaciones, tal como se
/// escribe hoy. Se lee del fichero porque el servicio necesita
/// media docena de dependencias para instanciarse, y lo que hay
/// que fijar es la CONSULTA.
function bloqueDeCaracterizaciones(): string {
  /// Se busca la CLAVE del include, no la palabra suelta: la
  /// palabra sale antes dentro de un comentario y el spec pasaba
  /// leyendo prosa en vez de código.
  const i = FUENTE.indexOf('caracterizaciones: {');
  if (i === -1) return '';
  return FUENTE.slice(i, i + 400);
}

describe('el reporte solo manda lo que sigue amparado', () => {
  it('la consulta filtra por autorización VIVA', () => {
    /// Sin esto, quien revocó en un gremio sigue exportando su
    /// marca sensible en el reporte del otro.
    const b = bloqueDeCaracterizaciones();
    expect(b).toContain('autorizacion');
    expect(b).toContain('revocadaEn');
  });

  it('y NO se traen todas a secas', () => {
    /// `caracterizaciones: true` es lo que había, y es
    /// exactamente lo que no puede volver.
    expect(FUENTE).not.toContain('caracterizaciones: true');
  });
});

describe('cuál viaja no lo decide Postgres', () => {
  it('la consulta lleva orden', () => {
    /// Abajo se manda `[0]` y el comentario dice «la primera que
    /// marcó». Sin `orderBy` eso lo decidía el motor, así que dos
    /// exportaciones del mismo día podían mandar marcas distintas
    /// de la misma persona — y el comentario afirmaba algo que el
    /// código no garantizaba.
    expect(bloqueDeCaracterizaciones()).toContain('orderBy');
  });

  it('se sigue mandando UNA, que es lo que el formato admite', () => {
    expect(FUENTE).toContain('caracterizaciones[0]?.caracterizacionSepId');
  });
});

describe('el 35 = NINGUNA no se manda por omisión', () => {
  it('cuando no hay ninguna marca, la celda va VACÍA', () => {
    /// Mandar 35 es declarar por la persona que no pertenece a
    /// ninguna población, y eso solo consta si ella lo dijo.
    /// Vacío es «no se recogió»; 35 es «dijo que no».
    ///
    /// El `?? null` es lo que lo sostiene: si algún día alguien
    /// lo cambia por `?? CARACTERIZACION_NINGUNA`, esto cae.
    const i = FUENTE.indexOf('caracterizaciones[0]?.caracterizacionSepId');
    expect(FUENTE.slice(i, i + 120)).toContain('?? null');
  });
});
