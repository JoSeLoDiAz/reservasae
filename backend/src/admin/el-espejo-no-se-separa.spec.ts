/** La copia del panel dice lo mismo que la matriz. */

/// `PERMISOS_POR_ROL` del frontend es un espejo declarado de
/// `PERMISOS`, y su propio comentario pide mantenerlo a mano.
/// Dos verdades sin nada que las sujete acaban discrepando —
/// y aquí el síntoma sería una pantalla que promete a un
/// administrador un permiso que el guard después le niega.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AREAS, PERMISOS } from './permisos';
import { ROL_EN_PALABRAS } from './roles-en-palabras';

const ARCHIVO = join(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'lib',
  'admin-api.ts',
);

/** El literal que abre en `desde`, con los pares casados. */
function literal(texto: string, desde: number, abre: string, cierra: string): string {
  let hondo = 0;
  for (let i = desde; i < texto.length; i++) {
    if (texto[i] === abre) hondo++;
    else if (texto[i] === cierra) {
      hondo--;
      if (hondo === 0) return texto.slice(desde, i + 1);
    }
  }
  throw new Error('literal sin cerrar');
}

/// Las claves van sin comillas en TypeScript, y la ultima
/// entrada lleva coma. JSON no admite ninguna de las dos.
function aJson(crudo: string): unknown {
  return JSON.parse(
    crudo
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/,(\s*[}\]])/g, '$1'),
  );
}

function espejoDelPanel(): Record<string, Record<string, string>> {
  const texto = readFileSync(ARCHIVO, 'utf8');
  const marca = 'PERMISOS_POR_ROL: Record<RolConvenio, Record<Area, Nivel>> = ';
  const i = texto.indexOf(marca);
  if (i < 0) throw new Error('no encontré PERMISOS_POR_ROL en el panel');

  return aJson(literal(texto, i + marca.length, '{', '}')) as Record<
    string,
    Record<string, string>
  >;
}

/** Las etiquetas del desplegable de usuarios. */
function etiquetasDelPanel(): Record<string, string> {
  const texto = readFileSync(ARCHIVO, 'utf8');
  const donde = texto.indexOf('ROLES_DE_CONVENIO');
  const i = donde < 0 ? -1 : texto.indexOf('= [', donde);
  if (i < 0) throw new Error('no encontré ROLES_DE_CONVENIO en el panel');

  const filas = aJson(literal(texto, i + 2, '[', ']')) as Array<{
    valor: string;
    etiqueta: string;
  }>;
  return Object.fromEntries(filas.map((f) => [f.valor, f.etiqueta]));
}

describe('el espejo del panel no se separa de la matriz', () => {
  const espejo = espejoDelPanel();

  it('tiene exactamente los mismos roles', () => {
    expect(Object.keys(espejo).sort()).toEqual(Object.keys(PERMISOS).sort());
  });

  it.each(Object.keys(PERMISOS))('%s dice lo mismo en los dos sitios', (rol) => {
    for (const area of AREAS) {
      expect(espejo[rol]?.[area]).toBe(
        PERMISOS[rol as keyof typeof PERMISOS][area],
      );
    }
  });
});

/// El correo de bienvenida las lee del backend y el
/// desplegable de usuarios del frontend: si discrepan, a
/// alguien le llega por correo un rol que el panel no
/// reconoce.
describe('los roles se llaman igual en el correo y en el panel', () => {
  const delPanel = etiquetasDelPanel();

  it('el panel ofrece exactamente los roles que existen', () => {
    expect(Object.keys(delPanel).sort()).toEqual(
      Object.keys(ROL_EN_PALABRAS).sort(),
    );
  });

  it.each(Object.keys(ROL_EN_PALABRAS))('%s se llama igual', (rol) => {
    expect(delPanel[rol]).toBe(
      ROL_EN_PALABRAS[rol as keyof typeof ROL_EN_PALABRAS],
    );
  });
});
