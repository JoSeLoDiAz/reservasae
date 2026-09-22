/** La marca de todos solo la cambian los correos de `EDITORES_DE_MARCA`. */

/// Lo que se fija aquí es lo que pidió el cliente: ni un
/// superadministrador que no esté en la lista entra, y si la lista
/// falta no entra nadie.

import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { FormulariosAdminController } from '../formularios/formularios.controller';
import { AdminController } from './admin.controller';
import { ROLES } from './admin.guard';
import {
  editoresDeMarca,
  EditoresDeMarcaGuard,
  esEditorDeMarca,
} from './editores-de-marca';

describe('la lista de editores de marca', () => {
  it('lee correos separados por comas, sin espacios y en minúsculas', () => {
    expect(editoresDeMarca(' Jose@Grupo-AE.com.co , diana@grupo-ae.com.co,,')).toEqual([
      'jose@grupo-ae.com.co',
      'diana@grupo-ae.com.co',
    ]);
  });

  it('sin lista, nadie', () => {
    expect(editoresDeMarca(undefined)).toEqual([]);
    expect(editoresDeMarca('')).toEqual([]);
    expect(esEditorDeMarca('jose@grupo-ae.com.co', [])).toBe(false);
  });

  it('el correo casa sin importar mayúsculas ni espacios', () => {
    const lista = ['catalina@grupo-ae.com.co'];
    expect(esEditorDeMarca('  Catalina@Grupo-AE.com.co ', lista)).toBe(true);
    expect(esEditorDeMarca('otra@grupo-ae.com.co', lista)).toBe(false);
    expect(esEditorDeMarca(null, lista)).toBe(false);
  });
});

describe('la cerradura', () => {
  const guardia = new EditoresDeMarcaGuard();
  const conCuenta = (admin: { correo: string; rol: string } | undefined) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ admin }) }),
    }) as unknown as ExecutionContext;

  const antes = process.env.EDITORES_DE_MARCA;
  afterEach(() => {
    if (antes === undefined) delete process.env.EDITORES_DE_MARCA;
    else process.env.EDITORES_DE_MARCA = antes;
  });

  it('deja pasar a quien está en la lista', () => {
    process.env.EDITORES_DE_MARCA = 'diana@grupo-ae.com.co';
    expect(guardia.canActivate(conCuenta({ correo: 'diana@grupo-ae.com.co', rol: 'ADMIN' }))).toBe(true);
  });

  it('un superadministrador que no está, no pasa', () => {
    process.env.EDITORES_DE_MARCA = 'diana@grupo-ae.com.co';
    expect(() =>
      guardia.canActivate(conCuenta({ correo: 'proyectos@grupo-ae.com.co', rol: 'SUPERADMIN' })),
    ).toThrow(ForbiddenException);
  });

  it('sin la variable, no pasa nadie', () => {
    delete process.env.EDITORES_DE_MARCA;
    expect(() =>
      guardia.canActivate(conCuenta({ correo: 'diana@grupo-ae.com.co', rol: 'SUPERADMIN' })),
    ).toThrow(ForbiddenException);
    expect(() => guardia.canActivate(conCuenta(undefined))).toThrow(ForbiddenException);
  });
});

describe('qué rutas cierra', () => {
  /// Todo lo que cambia la marca de todos. Si alguien añade una ruta
  /// de logos o de paleta general sin la cerradura, esta lista lo dice.
  const CERRADAS = [
    'actualizarMarca',
    'marcaDeGremios',
    'fijarMarcaDeGremio',
    'actualizarTema',
    'restablecerTema',
    'listarLogos',
    'subirLogo',
    'actualizarLogo',
    'borrarLogo',
  ];
  /// Y lo que no: los colores propios los cambia cualquiera.
  const ABIERTAS = ['miTema', 'guardarMiTema', 'restablecerMiTema'];

  const guardias = (metodo: string, clase: object = AdminController.prototype) =>
    ((Reflect.getMetadata('__guards__', (clase as Record<string, object>)[metodo]) ??
      []) as Array<{ name?: string }>).map((g) => g?.name);

  it.each(CERRADAS)('%s pide ser editor de marca', (metodo) => {
    expect(guardias(metodo)).toContain('EditoresDeMarcaGuard');
  });

  it('los colores del formulario de un gremio, también', () => {
    expect(guardias('actualizarApariencia', FormulariosAdminController.prototype)).toContain(
      'EditoresDeMarcaGuard',
    );
    /// Y sin rol: un superadministrador que no está no pasa, y quien
    /// está no necesita serlo.
    expect(
      Reflect.getMetadata(
        ROLES,
        (FormulariosAdminController.prototype as unknown as Record<string, object>)
          .actualizarApariencia,
      ),
    ).toEqual([]);
  });

  it.each(ABIERTAS)('%s no', (metodo) => {
    expect(guardias(metodo)).not.toContain('EditoresDeMarcaGuard');
  });
});
