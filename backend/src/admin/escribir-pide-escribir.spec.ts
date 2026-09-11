/** Toda ruta del panel que escribe pide ESCRIBIR. */

/// Recorre la SUPERFICIE, no los casos de hoy: un arreglo
/// ruta por ruta se olvida de alguna.

import 'reflect-metadata';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AREA, ROLES } from './admin.guard';

type Perm = { areas: string[]; nivel: string } | undefined;

/// Escriben, y por eso no pueden entrar con permiso de mirar.
const ESCRIBEN = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Lo que se deja pasar, y por qué.
 *
 * Cada línea es una declaración: quien añada una tiene que
 * decir por qué su POST no escribe nada.
 */
const PERMITIDAS: Record<string, string> = {
  'AdminController.iniciarSesion': 'inicio de sesión, pública',
  'AdminController.cerrarSesion': 'cierra la suya',
  'AdminController.cambiarClave': 'la suya, y antes de tener permisos',
  'AdminController.actualizarPerfil': 'su propio perfil',
  'AdminController.derivar': 'calcula una paleta, no escribe',
  'AdminController.corregir': 'calcula contrastes, no escribe',
  'MetaPruebasController.probarVerificacion': 'pregunta, no escribe',
};

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return n.endsWith('.controller.ts') ? [p] : [];
  });
}

type Ruta = {
  nombre: string;
  metodo: string;
  permiso: Perm;
  soloSuperadmin: boolean;
};

function rutasDelPanel(): Ruta[] {
  const salida: Ruta[] = [];

  for (const archivo of archivos(join(__dirname, '..'))) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const modulo = require(archivo) as Record<string, unknown>;
    for (const exportado of Object.values(modulo)) {
      if (typeof exportado !== 'function') continue;
      const clase = exportado as new (...a: never[]) => object;

      // solo el panel: lo público no lleva este guardia
      const guardias = (Reflect.getMetadata('__guards__', clase) ??
        []) as Array<{ name?: string }>;
      if (!guardias.some((g) => g?.name === 'AdminGuard')) continue;

      const permClase = Reflect.getMetadata(AREA, clase) as Perm;
      const rolesClase = (Reflect.getMetadata(ROLES, clase) ?? []) as string[];

      const proto = clase.prototype as Record<string, unknown>;
      for (const nombre of Object.getOwnPropertyNames(proto)) {
        if (nombre === 'constructor') continue;
        const fn = proto[nombre];
        if (typeof fn !== 'function') continue;

        const verbo = Reflect.getMetadata('method', fn) as number | undefined;
        const ruta = Reflect.getMetadata('path', fn) as string | undefined;
        if (ruta === undefined) continue;

        const roles = (Reflect.getMetadata(ROLES, fn) ?? rolesClase) as string[];
        salida.push({
          nombre: `${clase.name}.${nombre}`,
          metodo: String(verbo),
          permiso: (Reflect.getMetadata(AREA, fn) as Perm) ?? permClase,
          soloSuperadmin:
            roles.length > 0 && roles.every((r) => r === 'SUPERADMIN'),
        });
      }
    }
  }
  return salida;
}

/// El verbo llega como el enum de Nest, no como texto.
const VERBOS: Record<string, string> = {
  '0': 'GET',
  '1': 'POST',
  '2': 'PUT',
  '3': 'DELETE',
  '4': 'PATCH',
};

describe('lo que escribe pide ESCRIBIR', () => {
  const todas = rutasDelPanel();
  const escriben = todas.filter((r) => ESCRIBEN.includes(VERBOS[r.metodo]));

  it('encontró la superficie del panel', () => {
    expect(todas.length).toBeGreaterThan(80);
    expect(escriben.length).toBeGreaterThan(40);
  });

  it.each(escriben.map((r) => [r.nombre, r]))(
    '%s',
    (_n, r: unknown) => {
      const ruta = r as Ruta;
      if (PERMITIDAS[ruta.nombre]) return;
      // el superadmin es una cerradura mas fuerte que el area
      if (ruta.soloSuperadmin) return;
      expect(ruta.permiso?.nivel).toBe('ESCRIBIR');
    },
  );

  it('lo permitido sigue existiendo: nada sobra en la lista', () => {
    for (const nombre of Object.keys(PERMITIDAS)) {
      expect(todas.map((r) => r.nombre)).toContain(nombre);
    }
  });
});
