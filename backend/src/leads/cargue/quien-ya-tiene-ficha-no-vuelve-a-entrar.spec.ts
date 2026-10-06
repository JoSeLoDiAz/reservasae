/** Quien ya está en Gestión de leads no vuelve a entrar como lead nuevo. */

/**
 * «¿PERO CON GESTIÓN DE LEADS?» (cliente, 6 oct 2026), preguntando
 * cómo sabe lo que le proponen al subir una base.
 *
 * El cruce miraba la MESA ---`leads_entrantes`--- y no las fichas. Y
 * las dos poblaciones casi no se solapan: quien llega por el
 * formulario público nace FICHA y no deja fila en la mesa. En la base
 * de pruebas, de 1.480 fichas NINGUNA tenía lead en la mesa.
 *
 * Así que subir una base con gente que ya está en Gestión de leads
 * ---incluso ya inscrita--- las daba por NUEVAS y creaba un lead de
 * cada una: dos registros de la misma persona y dos asesoras
 * llamándola, que es exactamente el duplicado que la mesa existe para
 * no tener.
 *
 * La prueba va por el SERVICIO y con un .xlsx de verdad, porque lo que
 * hay que fijar no es la regla suelta sino que el cargue la use antes
 * de crear.
 */

import { CargueDeLeads } from './cargue-de-leads.service';
import {
  baseDeMentira,
  hojaDeExcel,
  type FichaDeMentira,
} from './arnes-del-cargue';

const AMBITO = ['conv-adecopria'];

const CABECERA = ['Nombre', 'Correo', 'Celular', 'Documento'];

async function cargar(
  filas: unknown[][],
  fichas: FichaDeMentira[] = [],
  yaEstan: never[] = [],
) {
  const base = baseDeMentira(yaEstan, { fichas });
  const s = new CargueDeLeads(
    base.prisma as never,
    { registrar: () => Promise.resolve() } as never,
  );
  const archivo = await hojaDeExcel([CABECERA, ...filas]);
  const r = await s.aplicar(archivo, 'bbdd.xlsx', 'adecopria', AMBITO, {
    id: 'admin-1',
    nombre: 'Mauricio',
  });
  return { r, base };
}

const INSCRITA: FichaDeMentira = {
  etapa: 'INSCRITO',
  numeroDocumento: '52123456',
  correo: 'ana@ejemplo.test',
  celular: '3001112222',
};

describe('quien ya tiene ficha no se vuelve a crear', () => {
  it('por el documento', async () => {
    const { r, base } = await cargar(
      [['Ana Pérez', 'otro@ejemplo.test', '3009998888', '52123456']],
      [INSCRITA],
    );
    expect(r.yaTienenFicha).toBe(1);
    expect(r.nuevas).toBe(0);
    /// Y NO SE ESCRIBIÓ NADA. Es la mitad del arreglo: contarlo bien
    /// y crear el lead igual dejaría el duplicado con mejor informe.
    expect(base.creados).toHaveLength(0);
  });

  it('por el correo, aunque el documento no venga', async () => {
    const { r, base } = await cargar(
      [['Ana Pérez', 'ana@ejemplo.test', '', '']],
      [INSCRITA],
    );
    expect(r.yaTienenFicha).toBe(1);
    expect(base.creados).toHaveLength(0);
  });

  it('y por el celular, que es el caso del que entró por pauta', async () => {
    const { r, base } = await cargar(
      [['Ana Pérez', '', '3001112222', '']],
      [INSCRITA],
    );
    expect(r.yaTienenFicha).toBe(1);
    expect(base.creados).toHaveLength(0);
  });

  /**
   * Y LA FILA LO DICE, con la etapa. «Ya está» a secas obliga a
   * buscarla a mano para saber si hay algo que hacer con ella: no es
   * lo mismo que esté inscrita que que esté perdida.
   */
  it('la fila dice que ya tiene ficha, por dónde y en qué etapa', async () => {
    const { r } = await cargar(
      [['Ana Pérez', 'ana@ejemplo.test', '', '52123456']],
      [INSCRITA],
    );
    const fila = r.filas[0];
    expect(fila.que).toBe('YA_TIENE_FICHA');
    expect(fila.porque).toBe('DOCUMENTO');
    expect(fila.avisos.join(' ')).toContain('Gestión de leads');
    expect(fila.avisos.join(' ')).toContain('inscrito');
  });

  /// NO SE LE TOCA LA FICHA. Rellenarle campos desde un archivo
  /// cambiaría lo que se le reportó al SENA sin pasar por la ficha, y
  /// es la misma frontera que ya pone el lead convertido.
  it('no se le rellena nada a la ficha', async () => {
    const { r, base } = await cargar(
      [['Ana Pérez', 'ana@ejemplo.test', '3001112222', '52123456']],
      [INSCRITA],
    );
    expect(r.filas[0].rellena).toEqual([]);
    expect(base.actualizados).toHaveLength(0);
    expect(r.seRellenan).toBe(0);
  });
});

describe('lo que NO es «ya tiene ficha»', () => {
  it('quien no está en ninguna parte entra como nueva', async () => {
    const { r, base } = await cargar(
      [['Nueva Persona', 'nueva@ejemplo.test', '3005554444', '1098765']],
      [INSCRITA],
    );
    expect(r.nuevas).toBe(1);
    expect(r.yaTienenFicha).toBe(0);
    expect(base.creados).toHaveLength(1);
  });

  /**
   * Y LA FICHA DE OTRO GREMIO NO CUENTA. La consulta va acotada al
   * convenio: sin eso, un cargue de ADECOPRIA se frenaría por una
   * ficha de BRITCHAM, y son dos tratamientos de datos distintos.
   *
   * Se comprueba sobre el `where` que sale hacia Prisma, porque es lo
   * único que distingue «filtra» de «trae todo y ya veremos».
   */
  it('la consulta de fichas va acotada al convenio', async () => {
    const { base } = await cargar(
      [['Ana Pérez', 'ana@ejemplo.test', '', '52123456']],
      [INSCRITA],
    );
    const deFichas = base.dondes.filter(
      (d): d is Record<string, unknown> =>
        Boolean(d) && typeof d === 'object' && 'persona' in (d as object),
    );
    expect(deFichas.length).toBeGreaterThan(0);
    for (const d of deFichas) expect(d.convenioId).toBe('conv-adecopria');
  });

  /// Sin nada con que cruzar no se pregunta a la base: una consulta
  /// con tres `IN` vacíos trae el gremio entero.
  it('una fila sin documento, correo ni celular no busca fichas', async () => {
    const { base } = await cargar([['Solo Un Nombre', '', '', '']], [INSCRITA]);
    const deFichas = base.dondes.filter(
      (d): d is Record<string, unknown> =>
        Boolean(d) && typeof d === 'object' && 'persona' in (d as object),
    );
    expect(deFichas).toHaveLength(0);
  });
});
