/** El orden de borrado, que solo castiga la base. */

/**
 * POR QUÉ EXISTE ESTE SPEC.
 *
 * Borrar una ficha son cuatro pasos y el orden no es decorativo:
 * `notas_participante.participanteId` es `ON DELETE SET NULL` y
 * encima lleva el CHECK `nota_cuelga_de_algo`, así que un
 * `participante.delete()` a secas —lo obvio, lo que cualquiera
 * escribiría— revienta con un `23514` que no dice nada de lo que
 * pasó. Se descubrió sembrando datos de prueba: la siembra hizo
 * el `deleteMany` directo y la transacción entera se cayó.
 *
 * Nada en TypeScript impide escribirlo mal. Lo único que puede
 * es un test que fije el orden, porque el error solo aparece
 * contra Postgres de verdad — con un doble en memoria, cualquier
 * orden pasa.
 *
 * Y hay un segundo candado que importa tanto como el orden: las
 * notas COMPARTIDAS con un lead no se borran. Sin ese filtro se
 * borraría el historial de gestión de un lead que sigue vivo, y
 * nada fallaría: la nota simplemente desaparecería.
 */

import { borrarParticipaciones } from './borrar-participaciones';

type Llamada = { tabla: string; where: unknown };

/// Un doble que APUNTA lo que se le pide, en orden.
function doble(ids: string[]) {
  const pasos: Llamada[] = [];
  const anotar = (tabla: string) => ({
    deleteMany: (a: { where: unknown }) => {
      pasos.push({ tabla, where: a.where });
      return Promise.resolve({ count: ids.length });
    },
  });
  return {
    pasos,
    db: {
      avanceActividad: anotar('avances'),
      notaDeGestion: anotar('notas'),
      movimientoParticipante: anotar('movimientos'),
      participante: {
        ...anotar('participantes'),
        findMany: () => Promise.resolve(ids.map((id) => ({ id }))),
      },
    },
  };
}

describe('el orden que la base exige', () => {
  it('las notas se borran ANTES que la ficha', async () => {
    /// Es el paso que rompe el CHECK si se hace al revés.
    const d = doble(['p1']);
    await borrarParticipaciones(d.db as never, { id: 'p1' });

    const notas = d.pasos.findIndex((p) => p.tabla === 'notas');
    const fichas = d.pasos.findIndex((p) => p.tabla === 'participantes');
    expect(notas).toBeGreaterThanOrEqual(0);
    expect(notas).toBeLessThan(fichas);
  });

  it('y los avances y los movimientos también', async () => {
    /// Estos van por FK en cascada y sobrevivirían a un `delete`
    /// directo. Se borran explícitamente igual, así que si alguien
    /// los quita «porque la cascada ya lo hace» este test lo
    /// obliga a comprobarlo contra el schema antes.
    const d = doble(['p1']);
    await borrarParticipaciones(d.db as never, { id: 'p1' });

    const fichas = d.pasos.findIndex((p) => p.tabla === 'participantes');
    for (const antes of ['avances', 'movimientos']) {
      const i = d.pasos.findIndex((p) => p.tabla === antes);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(fichas);
    }
  });

  it('la ficha se borra la ÚLTIMA', async () => {
    const d = doble(['p1']);
    await borrarParticipaciones(d.db as never, { id: 'p1' });
    expect(d.pasos.at(-1)?.tabla).toBe('participantes');
  });
});

describe('las notas compartidas con un lead sobreviven', () => {
  it('solo se borran las que NO cuelgan de un lead', async () => {
    /// Una nota re-apuntada al convertir lleva las dos columnas:
    /// es la misma llamada vista desde los dos lados. Borrarla
    /// aquí se llevaría el historial de un lead que sigue vivo, y
    /// nada fallaría — por eso el CHECK es «al menos una».
    const d = doble(['p1']);
    await borrarParticipaciones(d.db as never, { id: 'p1' });

    const notas = d.pasos.find((p) => p.tabla === 'notas');
    expect(notas?.where).toMatchObject({ leadId: null });
  });

  it('y las demás tablas NO llevan ese filtro', async () => {
    /// `leadId` no existe en avances ni en movimientos: copiarlo
    /// ahí sería un `where` sobre una columna que no está.
    const d = doble(['p1']);
    await borrarParticipaciones(d.db as never, { id: 'p1' });

    for (const t of ['avances', 'movimientos', 'participantes']) {
      expect(d.pasos.find((p) => p.tabla === t)?.where).not.toHaveProperty('leadId');
    }
  });
});

describe('lo que NO hace, que es igual de importante', () => {
  it('no toca a la persona', async () => {
    /// La misma cédula puede estar en el otro convenio: es la
    /// razón de que `Persona` no tenga convenio. Si alguien añade
    /// aquí un `persona.deleteMany`, este doble no lo tiene y el
    /// test cae.
    const d = doble(['p1']);
    await borrarParticipaciones(d.db as never, { id: 'p1' });
    expect(d.pasos.map((p) => p.tabla)).not.toContain('personas');
  });

  it('con cero fichas no borra nada de nada', async () => {
    /// Sin la salida temprana, un `{ in: [] }` recorrería las
    /// cuatro tablas para no borrar nada -- y en un `deleteMany`
    /// mal escrito, para borrarlo TODO.
    const d = doble([]);
    const n = await borrarParticipaciones(d.db as never, { id: 'no-existe' });
    expect(n).toBe(0);
    expect(d.pasos).toEqual([]);
  });

  it('borra exactamente las que el `where` encontró', async () => {
    /// El segundo `deleteMany` va por los ids resueltos y no por
    /// el `where` original: repetir el `where` lo evaluaría dos
    /// veces, y entre las dos alguien pudo cambiar de etapa.
    const d = doble(['p1', 'p2', 'p3']);
    await borrarParticipaciones(d.db as never, { etapa: 'INTERESADO' });
    expect(d.pasos.at(-1)?.where).toEqual({ id: { in: ['p1', 'p2', 'p3'] } });
  });
});
