/** Los colores de una persona no le llegan a nadie más. */

/**
 * El defecto que este spec existe para que no vuelva:
 *
 * Los colores del panel eran UNA paleta para todos, y quien los
 * cambiaba en Apariencia se los cambiaba a todo el equipo. En
 * producción el panel amaneció granate para todos (21 sep 2026). El
 * cliente: «que sea individual, porque si alguien modifica queda para
 * todos».
 *
 * Lo que se fija aquí es la línea que no se puede cruzar: guardar o
 * restablecer los colores PROPIOS escribe en la cuenta de esa persona
 * y NUNCA en la tabla `temas`, que es lo que ven todos.
 */

import { AdminService } from './admin.service';
import { conColores, leerTemaPropio, sinEsquema } from './tema-propio';

describe('lo que se lee de la base, limpio', () => {
  it('descarta claves que no existen y colores mal escritos', () => {
    const limpio = leerTemaPropio({
      CLARO: { marca: '#1d4ed8', inventada: '#000000', exito: 'verde' },
      OSCURO: 'no es un objeto',
      OTRO: { marca: '#111111' },
    });
    expect(limpio).toEqual({ CLARO: { marca: '#1d4ed8' } });
  });

  it('una columna vacía es un objeto vacío, no un error', () => {
    expect(leerTemaPropio(null)).toEqual({});
    expect(leerTemaPropio([])).toEqual({});
  });
});

describe('guardar suma, restablecer quita', () => {
  it('suma a lo que ya había elegido en ese esquema', () => {
    const antes = { CLARO: { marca: '#1d4ed8' } };
    expect(conColores(antes, 'CLARO', { exito: '#15803d' })).toEqual({
      CLARO: { marca: '#1d4ed8', exito: '#15803d' },
    });
  });

  it('restablecer un esquema no toca el otro', () => {
    const antes = { CLARO: { marca: '#1d4ed8' }, OSCURO: { marca: '#93c5fd' } };
    expect(sinEsquema(antes, 'CLARO')).toEqual({ OSCURO: { marca: '#93c5fd' } });
  });
});

describe('guardar mis colores NO cambia los de los demás', () => {
  function armar(guardado: unknown) {
    const escrituras: string[] = [];
    const prisma = {
      admin: {
        findUnique: () => Promise.resolve({ temaPropio: guardado }),
        update: (a: { where: { id: string } }) => {
          escrituras.push(`admin.update:${a.where.id}`);
          return Promise.resolve({});
        },
      },
      tema: {
        update: () => {
          escrituras.push('tema.update');
          return Promise.resolve({});
        },
      },
    };
    const s = Object.create(AdminService.prototype) as AdminService;
    (s as unknown as { prisma: unknown }).prisma = prisma;
    return { s, escrituras };
  }

  const ANA = { id: 'ana' } as never;

  it('guardar escribe en SU cuenta y nunca en la paleta de todos', async () => {
    const { s, escrituras } = armar(null);
    const r = await s.guardarMiTema(ANA, 'CLARO', { colores: { marca: '#7f1d1d' } });
    expect(r).toEqual({ CLARO: { marca: '#7f1d1d' } });
    expect(escrituras).toEqual(['admin.update:ana']);
  });

  it('restablecer también: solo su cuenta', async () => {
    const { s, escrituras } = armar({ CLARO: { marca: '#7f1d1d' } });
    const r = await s.restablecerMiTema(ANA, 'CLARO');
    expect(r).toEqual({});
    expect(escrituras).toEqual(['admin.update:ana']);
  });
});
