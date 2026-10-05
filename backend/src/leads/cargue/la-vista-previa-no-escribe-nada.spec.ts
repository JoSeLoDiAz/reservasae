/** Primero se enseña y después se aplica, y los dos dicen lo mismo. */

/**
 * «Nadie debería descubrir que un cargue pisó dos mil filas después
 * de que las pisó» es la razón escrita en el cargue de empresas, y
 * el volcado del cronograma la repite: «NO ESCRIBE SIN QUE SE LO
 * PIDAN».
 *
 * Con una base de leads hay un motivo más, y es el que de verdad
 * importa: la vista previa es lo ÚNICO que delata un archivo mal
 * rotulado. «3.000 filas, 0 reconocidas» se ve de un golpe.
 * Después de aplicar, «3.000 nuevas» cuando ya estaban todas no se
 * ve nunca --suena a que el cargue funcionó--.
 *
 * Y las dos tienen que contar LO MISMO. Si la revisión dijera «dos
 * nuevas» y la aplicación creara una, la vista previa no sería una
 * vista previa: sería una segunda opinión.
 */

import { CargueDeLeads } from './cargue-de-leads.service';
import { baseDeMentira, hojaDeExcel, leadGuardado } from './arnes-del-cargue';

const AMBITO = ['conv-adecopria'];
const QUIEN = { id: 'admin-1', nombre: 'Mauricio' };

const ROTULOS = [
  'Nombres',
  'Apellidos',
  'Correo',
  'Celular',
  'Número de documento',
  'Tipo de documento',
];

async function con(
  filas: unknown[][],
  yaEstan: ReturnType<typeof leadGuardado>[] = [],
) {
  const archivo = await hojaDeExcel(filas);
  const previa = baseDeMentira(yaEstan);
  const aplica = baseDeMentira(yaEstan);

  return {
    archivo,
    previa,
    aplica,
    revisar: () =>
      new CargueDeLeads(
        previa.prisma as never,
        { registrar: () => Promise.resolve() } as never,
      ).revisar(archivo, 'bbdd.xlsx', 'adecopria', AMBITO),
    aplicar: () =>
      new CargueDeLeads(
        aplica.prisma as never,
        { registrar: () => Promise.resolve() } as never,
      ).aplicar(archivo, 'bbdd.xlsx', 'adecopria', AMBITO, QUIEN),
  };
}

describe('la revisión no toca la base', () => {
  it('no crea, no actualiza y no escribe notas', async () => {
    const c = await con(
      [
        ROTULOS,
        ['Ana', 'Ruiz', 'ana@correo.com', '3001112222', '', ''],
        ['Luis', 'Pérez', 'luis@correo.com', '', '', ''],
      ],
      [
        leadGuardado({
          id: 'ya-1',
          correo: 'ana@correo.com',
          celular: '3009998888',
        }),
      ],
    );

    const r = await c.revisar();

    expect(r.aplicado).toBe(false);
    expect({
      creados: c.previa.creados.length,
      actualizados: c.previa.actualizados.length,
      notas: c.previa.notas.length,
    }).toEqual({ creados: 0, actualizados: 0, notas: 0 });
  });

  it('y dice lo MISMO que la aplicación', async () => {
    const c = await con(
      [
        ROTULOS,
        /// Una que ya está y a la que le falta el documento: se
        /// rellena.
        ['Ana', 'Ruiz', 'ana@correo.com', '', '1020304050', 'CC'],
        /// Una nueva.
        ['Luis', 'Pérez', 'luis@correo.com', '', '', ''],
        /// Una repetida DENTRO del archivo.
        ['Luis', 'Pérez', 'luis@correo.com', '3002223333', '', ''],
        /// Una que no se puede reconocer.
        ['', '', '', '', '', 'CC'],
      ],
      [leadGuardado({ id: 'ya-1', correo: 'ana@correo.com' })],
    );

    const previa = await c.revisar();
    const aplicado = await c.aplicar();

    const resumen = (r: typeof previa) => ({
      leidas: r.leidas,
      nuevas: r.nuevas,
      yaEstaban: r.yaEstaban,
      seRellenan: r.seRellenan,
      repetidasEnElArchivo: r.repetidasEnElArchivo,
      sinReconocer: r.sinReconocer,
      fallaron: r.fallaron,
    });

    expect(resumen(previa)).toEqual(resumen(aplicado));
    expect(resumen(previa)).toEqual({
      leidas: 4,
      nuevas: 1,
      yaEstaban: 1,
      /// Dos: el documento que le faltaba a la que ya estaba, y el
      /// celular que la cuarta fila le añade a la tercera. La
      /// segunda aparición de alguien en el archivo no es una
      /// nueva, pero sí puede completar a la primera.
      seRellenan: 2,
      repetidasEnElArchivo: 1,
      sinReconocer: 1,
      fallaron: 0,
    });
  });
});

describe('aplicar escribe lo que la revisión prometió', () => {
  it('tapa el hueco y deja el `motivo` al día', async () => {
    const c = await con(
      [ROTULOS, ['Ana', 'Ruiz', 'ana@correo.com', '', '1020304050', 'CC']],
      [
        leadGuardado({
          id: 'ya-1',
          correo: 'ana@correo.com',
          nombreCompleto: 'Ana Ruiz',
          primerNombre: 'Ana',
          primerApellido: 'Ruiz',
          accionFormacionId: 'af1-adecopria',
          motivo: 'Falta: el documento.',
        }),
      ],
    );

    await c.aplicar();

    expect(c.aplica.actualizados).toHaveLength(1);
    const data = c.aplica.actualizados[0].data;
    expect(data.numeroDocumento).toBe('1020304050');
    expect(data.tipoDocumentoSepId).toBe(1);
    /// El `motivo` se RECALCULA con lo ya rellenado: dejarlo como
    /// estaba diría que le falta el documento que este cargue le
    /// acaba de poner, y es lo que la mesa enseña.
    expect(data.motivo).toBeNull();
  });

  it('lo distinto queda en una nota de gestión y NO en la fila', async () => {
    const c = await con(
      [ROTULOS, ['Ana', 'Ruiz', 'ana@correo.com', '3009998888', '', '']],
      [
        leadGuardado({
          id: 'ya-1',
          correo: 'ana@correo.com',
          /// Lo que el asesor corrigió por teléfono.
          celular: '3001112222',
        }),
      ],
    );

    const r = await c.aplicar();

    /// El nombre SÍ se escribe ---estaba vacío, no pisa nada--- y
    /// el celular NO: el que corrigió el asesor se queda. Que la
    /// misma fila haga las dos cosas a la vez es justo lo que hay
    /// que comprobar: un cargue que decidiera «hay un choque,
    /// entonces no escribo nada» perdería el nombre, y uno que
    /// escribiera la fila entera borraría la corrección.
    expect(Object.keys(c.aplica.actualizados[0].data).sort()).toEqual([
      'motivo',
      'nombreCompleto',
      'primerApellido',
      'primerNombre',
    ]);
    expect(c.aplica.actualizados[0].data.celular).toBeUndefined();

    expect(c.aplica.notas).toHaveLength(1);
    expect(c.aplica.notas[0].leadId).toBe('ya-1');
    expect(String(c.aplica.notas[0].texto)).toContain('3009998888');
    /// Y quién subió el archivo, para que el historial lo diga.
    expect(c.aplica.notas[0].autorNombre).toBe('Mauricio');
    expect(r.conChoques).toBe(1);
  });

  it('el nuevo entra PENDIENTE, con el origen del cargue y la fila dentro', async () => {
    const c = await con([
      ROTULOS,
      ['Ana', 'Ruiz', 'ana@correo.com', '', '', ''],
    ]);

    await c.aplicar();

    const creado = c.aplica.creados[0];
    /// `estado` no se manda: el valor por omisión de la columna es
    /// PENDIENTE, y escribirlo aquí sería una segunda verdad sobre
    /// dónde empieza un lead.
    expect(creado.estado).toBeUndefined();
    expect(creado.origenSistema).toBe('cargue-masivo');
    /// Lo que la pantalla usa para no mezclarlos con la pauta.
    expect(creado.origen).toBe('ASESOR');
    /// El archivo y la fila dentro de `carga`: «¿de dónde salió
    /// este celular?» se contesta sin abrir nada.
    expect(creado.carga).toMatchObject({ archivo: 'bbdd.xlsx', fila: 2 });
    /// Nadie firmó nada en una hoja de cálculo.
    expect(creado.aceptaHabeasData).toBeNull();
  });

  it('la observación del archivo entra como primera nota', async () => {
    /// Es lo único de la base del cliente que ninguna columna del
    /// lead puede guardar, y es lo que el asesor lee antes de
    /// llamar.
    const c = await con([
      ['Correo', 'Observación'],
      ['ana@correo.com', 'Llamó por la feria de agosto'],
    ]);

    await c.aplicar();

    expect(c.aplica.notas).toHaveLength(1);
    expect(String(c.aplica.notas[0].texto)).toContain('feria de agosto');
  });

  it('un lead YA ATENDIDO no se toca', async () => {
    /// Rellenarle campos cambiaría los datos de los que ya salió
    /// una ficha sin pasar por la ficha. Es la misma frontera que
    /// pone `loQueLeFaltaAlLead`: «ya se atendió», y no sigue
    /// mirando.
    const c = await con(
      [ROTULOS, ['Ana', 'Ruiz', 'ana@correo.com', '3001112222', '', '']],
      [
        leadGuardado({
          id: 'ya-ficha',
          correo: 'ana@correo.com',
          estado: 'CONVERTIDO',
          participanteId: 'p-1',
        }),
      ],
    );

    const r = await c.aplicar();

    expect(c.aplica.actualizados).toHaveLength(0);
    expect(r.filas[0].rellena).toEqual([]);
    expect(r.filas[0].avisos.join(' ')).toMatch(/ya se atendió/i);
  });
});

describe('el gremio acota y no se adivina', () => {
  it('un convenio fuera del ámbito no existe: 404 y no 403', async () => {
    /// Un 403 confirmaría que el otro gremio está ahí, y eso es un
    /// oráculo. Mismo criterio que `mesa.arreglar`.
    const base = baseDeMentira([]);
    const s = new CargueDeLeads(
      base.prisma as never,
      { registrar: () => Promise.resolve() } as never,
    );
    const archivo = await hojaDeExcel([['Correo'], ['ana@correo.com']]);

    /// El arnés devuelve siempre un convenio, así que para esta
    /// prueba se le hace devolver null: lo que se comprueba es qué
    /// pasa cuando la consulta ---que YA lleva el ámbito en el
    /// `where`--- no encuentra nada.
    (base.prisma as { convenio: { findFirst: unknown } }).convenio.findFirst =
      () => Promise.resolve(null);

    await expect(
      s.aplicar(archivo, 'bbdd.xlsx', 'britcham-adee', AMBITO, QUIEN),
    ).rejects.toThrow(/britcham-adee/);
  });

  it('el ámbito va DENTRO del `where`, no se comprueba después', async () => {
    /// Comprobarlo después de leer sería leerlo primero. Y escrito
    /// con un spread, la clave repetida borraría la anterior: el
    /// defecto que ya apareció dos veces en este repositorio.
    const c = await con([['Correo'], ['ana@correo.com']]);
    await c.revisar();

    expect(JSON.stringify(c.previa.dondes[0])).toContain('conv-adecopria');
  });
});
