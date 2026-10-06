/** Lo que se declara en un gremio no se pierde por lo que pase en otro. */

/**
 * «QUE ESTOS NUNCA SE MEZCLEN: QUE TENGAN LA MISMA ESTRUCTURA NO
 * QUIERE DECIR QUE SON IGUALES» (cliente, 5 oct 2026).
 *
 * La caracterización ---víctima del conflicto armado, una discapacidad,
 * pertenencia étnica--- colgaba de UNA autorización: la del gremio
 * donde la persona lo declaró primero. Y la llave única era
 * `(persona, caracterización)`: una marca, una vez POR PERSONA.
 *
 * De ahí salían dos cosas, las dos malas y ninguna visible:
 *
 *   - revocar en un gremio BORRABA la marca del reporte del OTRO,
 *     donde la persona sigue autorizando. La celda sale vacía, que
 *     parece «no lo declaró», y nadie compara la misma persona entre
 *     dos reportes;
 *   - y al revés: una marca consentida SOLO en un gremio viajaba en el
 *     reporte del otro, que es tratar un dato sensible donde no se
 *     autorizó.
 *
 * Es lo que ve el SENA. Que un gremio dependa de lo que la persona
 * decida en otro no se sostiene.
 *
 * Desde el 5 oct 2026 cada marca lleva su `convenioId` y la llave es
 * `(persona, caracterización, convenio)`: la misma persona puede
 * declarar lo mismo en los dos, y cada declaración la ampara la
 * autorización de SU gremio.
 */

import * as fs from 'fs';
import * as path from 'path';

const leer = (...t: string[]) =>
  fs.readFileSync(path.join(__dirname, ...t), 'utf8');

describe('el modelo guarda en qué gremio se declaró', () => {
  const esquema = () => leer('..', '..', '..', 'prisma', 'schema.prisma');

  const modelo = () => {
    const t = esquema();
    const i = t.indexOf('model CaracterizacionPersona');
    expect(i).toBeGreaterThan(-1);
    return t.slice(i, t.indexOf('\n}', i));
  };

  it('la marca lleva su convenio', () => {
    expect(modelo()).toMatch(/convenioId\s+String/);
  });

  /**
   * LA LLAVE ES LO QUE DE VERDAD LO ARREGLA. Sin el convenio dentro,
   * la base impide que la misma persona declare lo mismo en los dos
   * gremios, y entonces da igual lo que filtre la consulta: la segunda
   * declaración no se puede ni guardar.
   */
  it('y la llave única es por persona, marca Y gremio', () => {
    const m = modelo();
    expect(m).toContain(
      '@@unique([personaId, caracterizacionSepId, convenioId])',
    );
    /// Y la vieja ya no está: con las dos, la de antes seguiría
    /// bloqueando la segunda declaración.
    expect(m).not.toContain('@@unique([personaId, caracterizacionSepId])');
  });
});

describe('el reporte pide las de su gremio', () => {
  it('la consulta filtra por convenio, además de por autorización viva', () => {
    const t = leer('sep.service.ts');
    const i = t.indexOf('caracterizaciones: {');
    expect(i).toBeGreaterThan(-1);
    const bloque = t.slice(i, t.indexOf('\n            },', i));
    expect(bloque).toContain('convenioId');
    /// Lo de antes se queda: revocar en ESTE gremio sí la quita.
    expect(bloque).toContain('revocadaEn: null');
  });
});

/**
 * Y LOS DOS SITIOS QUE ESCRIBEN, ACOTADOS AL GREMIO.
 *
 * Los dos hacían `deleteMany({ where: { personaId } })`: borraban
 * TODAS las de la persona. Mientras la marca era una por persona daba
 * igual; desde que son una por gremio, eso es declarar en ADECOPRIA y
 * borrarle lo que dijo en BRITCHAM.
 *
 * Y el compilador NO puede avisar de esto ---`deleteMany` acepta
 * cualquier filtro--- así que se fija aquí.
 */
describe('declarar en un gremio no borra lo del otro', () => {
  it('el panel borra solo las de su convenio', () => {
    const t = leer('..', 'crm.service.ts');
    const i = t.indexOf('tx.caracterizacionPersona.deleteMany');
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(i, i + 160)).toContain('convenioId');
  });

  it('y el formulario público, también', () => {
    const t = leer('..', '..', 'preinscripcion', 'preinscripcion.service.ts');
    const i = t.indexOf('caracterizacionPersona.deleteMany');
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(i, i + 160)).toContain('convenioId');
  });

  it('los dos guardan en qué gremio se declaró', () => {
    const panel = leer('..', 'crm.service.ts');
    const publico = leer(
      '..',
      '..',
      'preinscripcion',
      'preinscripcion.service.ts',
    );
    for (const t of [panel, publico]) {
      const i = t.indexOf('caracterizacionPersona.createMany');
      expect(i).toBeGreaterThan(-1);
      expect(t.slice(i, i + 400)).toContain('convenioId');
    }
  });
});

/**
 * Y LA MIGRACIÓN NO INVENTA GREMIOS.
 *
 * El relleno saca el convenio de la política que ampara cada
 * autorización, que es de donde se dedujo siempre. Una marca cuya
 * autorización no exista no se puede reportar a nadie: se borra, en vez
 * de quedarse con un convenio supuesto que diría que alguien declaró
 * algo que no consta que declarara.
 */
describe('la migración rellena sin suponer', () => {
  const sql = () =>
    fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'prisma',
        'migrations',
        '20261005120000_caracterizacion_por_gremio',
        'migration.sql',
      ),
      'utf8',
    );

  it('el gremio sale de la política de su autorización', () => {
    const t = sql();
    expect(t).toContain('politicas_datos');
    expect(t).toContain('autorizaciones_datos');
  });

  it('y lo que no se puede atribuir no se queda con un gremio supuesto', () => {
    expect(sql()).toContain(
      'DELETE FROM "caracterizaciones_persona" WHERE "convenioId" IS NULL',
    );
  });
});
