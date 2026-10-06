/** En 500 filas, que la 17 reviente no puede llevarse las otras 499. */

/**
 * Es la misma lección que `lote-fila-a-fila.spec.ts` dejó escrita
 * para el lote del webhook y que la carga masiva del panel aprendió
 * antes, y aquí el daño es mayor: el lote de un webhook se
 * reintenta, pero un archivo de tres mil leads se sube una vez. Si
 * la fila 17 devuelve un 500, el cliente ve «falló» y no sabe
 * cuántas entraron ---así que vuelve a subirlo, que es lo correcto,
 * y si el cargue no fuera idempotente duplicaría lo que sí entró---.
 *
 * Y se contesta FILA POR FILA. «Falló» a secas obliga a comparar a
 * mano un Excel de tres mil filas contra la mesa de entrada.
 */

import { CargueDeLeads } from './cargue-de-leads.service';
import { baseDeMentira, hojaDeExcel } from './arnes-del-cargue';

const AMBITO = ['conv-adecopria'];
const QUIEN = { id: 'admin-1', nombre: 'Mauricio' };

const CINCO = [
  ['Nombres', 'Correo'],
  ['Ana', 'ana@correo.com'],
  ['Luis', 'luis@correo.com'],
  /// La mala: la 4 del Excel.
  ['Pedro', 'pedro@correo.com'],
  ['Sara', 'sara@correo.com'],
  ['Juan', 'juan@correo.com'],
];

async function cargar(opciones: Parameters<typeof baseDeMentira>[1]) {
  const base = baseDeMentira([], opciones);
  const s = new CargueDeLeads(
    base.prisma as never,
    { registrar: () => Promise.resolve() } as never,
  );
  const archivo = await hojaDeExcel(CINCO);
  const r = await s.aplicar(archivo, 'bbdd.xlsx', 'adecopria', AMBITO, QUIEN);
  return { r, base };
}

describe('una fila que revienta no se lleva a las demás', () => {
  it('las otras cuatro entran igual', async () => {
    const { r, base } = await cargar({ revientaEnLaFila: 4 });

    expect({ nuevas: r.nuevas, fallaron: r.fallaron }).toEqual({
      nuevas: 4,
      fallaron: 1,
    });
    expect(base.creados).toHaveLength(4);
  });

  it('y se sigue DESPUÉS del fallo, no se corta ahí', async () => {
    /// Un `try` mal puesto ---alrededor del bucle y no dentro---
    /// pararía en la primera excepción y las siguientes ni se
    /// intentarían. El recuento diría «4 de 5» igual, así que esto
    /// se comprueba por el número de fila de las que entraron.
    const { r } = await cargar({ revientaEnLaFila: 2 });

    expect(r.filas.filter((f) => f.que === 'NUEVA').map((f) => f.fila)).toEqual(
      [3, 4, 5, 6],
    );
  });

  it('la fila mala dice su número, de quién era y por qué falló', async () => {
    const { r } = await cargar({ revientaEnLaFila: 4 });

    const mala = r.filas.find((f) => f.que === 'FALLO');
    expect(mala?.fila).toBe(4);
    /// Con qué reconocerla en el archivo: una lista de números de
    /// fila obliga a abrir el Excel al lado.
    expect(mala?.quien).toBe('pedro@correo.com');
    expect(mala?.avisos.join(' ')).toMatch(/No se pudo guardar/);
  });
});

describe('si otro cargue se adelanta, no se duplica ni se cuenta como fallo', () => {
  it('se completa el que ya estaba', async () => {
    /**
     * Entre la lectura de los candidatos y el INSERT cabe otro
     * cargue ---dos personas subiendo la misma base, que con un
     * archivo que se tarda en revisar es el caso normal--- o un
     * lead que acabe de entrar por el webhook con la misma llave.
     *
     * Sin este remate, ese choque sale como un 500 en una fila que
     * de hecho ya está: el cliente lee «falló» sobre un lead que
     * existe. Es la misma carrera que `leads.service` resuelve para
     * los reintentos de Meta, y se resuelve igual: el que pierde
     * relee lo que escribió el que ganó.
     */
    const { r } = await cargar({ seAdelantanEnLaFila: 4 });

    expect({ nuevas: r.nuevas, fallaron: r.fallaron }).toEqual({
      nuevas: 4,
      fallaron: 0,
    });

    const alcanzada = r.filas.find((f) => f.fila === 4);
    expect(alcanzada?.que).toBe('YA_ESTABA');
    expect(alcanzada?.avisos.join(' ')).toMatch(
      /mientras se aplicaba este archivo/i,
    );
  });
});

describe('el archivo repetido no duplica a nadie', () => {
  it('subirlo dos veces deja los mismos leads', async () => {
    /// La llave de idempotencia es lo que lo sostiene, y es la
    /// razón por la que se le puede decir al cliente «si se cortó,
    /// vuelva a subirlo». Sin esto, ese consejo duplicaría la base.
    const primero = baseDeMentira([]);
    const archivo = await hojaDeExcel(CINCO);
    await new CargueDeLeads(
      primero.prisma as never,
      { registrar: () => Promise.resolve() } as never,
    ).aplicar(archivo, 'bbdd.xlsx', 'adecopria', AMBITO, QUIEN);

    /// La segunda vez, los cinco ya están: se le dan a la base de
    /// mentira como los leads guardados, con la llave que se
    /// escribió.
    const yaEstan = primero.creados.map((c, i) => ({
      ...c,
      id: `ya-${i}`,
      estado: 'PENDIENTE',
      participanteId: null,
    })) as never[];

    const segundo = baseDeMentira(yaEstan);
    const r = await new CargueDeLeads(
      segundo.prisma as never,
      { registrar: () => Promise.resolve() } as never,
    ).aplicar(archivo, 'bbdd.xlsx', 'adecopria', AMBITO, QUIEN);

    expect({ nuevas: r.nuevas, yaEstaban: r.yaEstaban }).toEqual({
      nuevas: 0,
      yaEstaban: 5,
    });
    expect(segundo.creados).toHaveLength(0);
    /// Y sin notas: nada choca, porque es el mismo archivo. Un
    /// cargue que dejara cinco notas por recargarlo llenaría la
    /// mesa de ruido.
    expect(segundo.notas).toHaveLength(0);
  });
});
