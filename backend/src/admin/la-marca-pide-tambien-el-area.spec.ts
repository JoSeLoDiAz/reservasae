/** Toda ruta de marca pide la LISTA de correos Y el área. */

/**
 * La lista sustituye al ROL, no al ÁREA, y esa distinción es toda
 * la prueba.
 *
 * `EDITORES_DE_MARCA` llegó el 21 sep 2026 para quitarle la marca a
 * los superadministradores («ni yo puedo», dijo el cliente, que lo
 * es). En nueve rutas de `admin.controller.ts` se cambió el par
 * `@Requiere` + `@Roles(SUPERADMIN)` por `@SoloEditoresDeMarca()` a
 * secas, y con el `@Requiere` se fue algo que no se ve al leer el
 * decorador: EL RECORTE DEL ÁMBITO.
 *
 * Sin `@Requiere`, `admin.guard.ts` deja en `ambito.convenios` TODOS
 * los concedidos a cualquier nivel --incluido `CONSULTA`--. Y estas
 * rutas se lo pasan al servicio, que confía en él y no vuelve a
 * mirar: `fijarMarcaDeGremio` es un `if (!ambito.includes(...))`, y
 * `borrarLogo` resuelve logo → formulario → convenio contra esa misma
 * lista. O sea que un editor con solo consulta en un gremio podía
 * borrarle el logo del banner PÚBLICO.
 *
 * No era alcanzable el día que se escribió --los tres editores son
 * líder de sistemas o country manager en los dos gremios, y ahí
 * configuración es ESCRIBIR--, y esa es justo la razón de que haga
 * falta una prueba: se abre sola el día que entre a la lista alguien
 * que no lleve configuración en los dos.
 *
 * Recorre la SUPERFICIE y no las nueve de hoy: una ruta de marca
 * nueva que nazca sin área falla aquí, no en producción.
 */

import 'reflect-metadata';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AREA } from './admin.guard';

type Perm = { areas: string[]; nivel: string } | undefined;

/// Escriben la marca de todos, así que piden ESCRIBIR.
const ESCRIBEN = ['POST', 'PUT', 'PATCH', 'DELETE'];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return n.endsWith('.controller.ts') ? [p] : [];
  });
}

type RutaDeMarca = { nombre: string; metodo: string; permiso: Perm };

function rutasDeMarca(): RutaDeMarca[] {
  const salida: RutaDeMarca[] = [];

  for (const archivo of archivos(join(__dirname, '..'))) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const modulo = require(archivo) as Record<string, unknown>;
    for (const exportado of Object.values(modulo)) {
      if (typeof exportado !== 'function') continue;
      const clase = exportado as new (...a: never[]) => object;
      const permClase = Reflect.getMetadata(AREA, clase) as Perm;

      const proto = clase.prototype as Record<string, unknown>;
      for (const nombre of Object.getOwnPropertyNames(proto)) {
        if (nombre === 'constructor') continue;
        const fn = proto[nombre];
        if (typeof fn !== 'function') continue;

        /// Los metadatos DE VERDAD, no una expresión regular sobre
        /// el texto: es lo que distingue el decorador puesto del
        /// decorador escrito en un comentario.
        const guardias = (Reflect.getMetadata('__guards__', fn) ?? []) as Array<{
          name?: string;
        }>;
        if (!guardias.some((g) => g?.name === 'EditoresDeMarcaGuard')) continue;

        const verbo = Reflect.getMetadata('method', fn);
        const metodos = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD'];
        salida.push({
          nombre: `${clase.name}.${nombre}`,
          metodo: metodos[verbo as number] ?? String(verbo),
          permiso: (Reflect.getMetadata(AREA, fn) as Perm) ?? permClase,
        });
      }
    }
  }

  return salida;
}

describe('la marca pide la lista Y el área', () => {
  const rutas = rutasDeMarca();

  it('hay rutas de marca que mirar', () => {
    /// Si un día el guardia cambia de nombre, esta prueba se
    /// quedaría en cero y pasaría sin comprobar nada.
    expect(rutas.length).toBeGreaterThanOrEqual(9);
  });

  it.each(rutas.map((r) => [r.nombre, r] as const))(
    '%s lleva @Requiere, que es lo que recorta el ámbito',
    (_nombre, ruta) => {
      expect(ruta.permiso?.areas).toContain('configuracion');
    },
  );

  it.each(
    rutas.filter((r) => ESCRIBEN.includes(r.metodo)).map((r) => [r.nombre, r] as const),
  )('%s escribe la marca de todos, así que pide ESCRIBIR', (_nombre, ruta) => {
    expect(ruta.permiso?.nivel).toBe('ESCRIBIR');
  });
});
