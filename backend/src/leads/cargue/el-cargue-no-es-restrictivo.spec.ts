/** Una fila entra con UN solo dato, y la que no trae ninguno no tumba el resto. */

/**
 * Es la frase del encargo: «donde no sea restrictiva porque no
 * tengo todos los datos, necesito montarla donde sí tiene, correo
 * y celular» (cliente, 5 oct 2026).
 *
 * Y es lo primero que se rompería al endurecer el cargue. La
 * tentación es exigir el documento ---es la identidad del sistema,
 * y sin él el lead no se puede convertir a ficha--- pero exigirlo
 * aquí tira a la basura la mitad de la base del cliente, y una
 * persona con celular y sin cédula se puede llamar: la cédula se
 * la piden por teléfono, que es justo el proceso que la mesa de
 * entrada existe para sostener.
 *
 * La prueba va por el SERVICIO y con un .xlsx de verdad, no por la
 * regla suelta: la regla ya tiene su prueba en
 * `llave-del-lead.spec.ts`. Lo que aquí se comprueba es que el
 * cargue no haya añadido una exigencia propia por el camino, que
 * es cómo esto se rompe de verdad.
 */

import { CargueDeLeads } from './cargue-de-leads.service';
import { baseDeMentira, hojaDeExcel } from './arnes-del-cargue';

const AMBITO = ['conv-adecopria'];

async function cargar(filas: unknown[][], yaEstan = []) {
  const base = baseDeMentira(yaEstan);
  const s = new CargueDeLeads(
    base.prisma as never,
    { registrar: () => Promise.resolve() } as never,
  );
  const archivo = await hojaDeExcel(filas);
  const r = await s.aplicar(archivo, 'bbdd.xlsx', 'adecopria', AMBITO, {
    id: 'admin-1',
    nombre: 'Mauricio',
  });
  return { r, base };
}

const ROTULOS = [
  'Nombres',
  'Apellidos',
  'Correo',
  'Celular',
  'Tipo de documento',
  'Número de documento',
];

describe('basta uno de los cuatro para entrar', () => {
  it('con SOLO el correo, la persona entra', async () => {
    const { r } = await cargar([
      ROTULOS,
      ['', '', 'ana@correo.com', '', '', ''],
    ]);

    expect({ nuevas: r.nuevas, sinReconocer: r.sinReconocer }).toEqual({
      nuevas: 1,
      sinReconocer: 0,
    });
  });

  it('con SOLO el celular, la persona entra', async () => {
    const { r, base } = await cargar([
      ROTULOS,
      ['', '', '', '3001112222', '', ''],
    ]);

    expect(r.nuevas).toBe(1);
    /// Y entra con el celular ya normalizado a diez dígitos: es lo
    /// que permite que el día que llegue otra vez con el +57
    /// delante se reconozca como la misma persona.
    expect(base.creados[0].celular).toBe('3001112222');
  });

  it('con SOLO el nombre, la persona entra', async () => {
    /// Sin forma de contactarla todavía, pero el nombre es lo que
    /// el asesor necesita para cruzarla con lo que ya tiene. La
    /// alternativa es tirarla, y entonces esa persona no existe.
    const { r } = await cargar([
      ROTULOS,
      ['Ana María', 'Ruiz Gómez', '', '', '', ''],
    ]);

    expect(r.nuevas).toBe(1);
  });

  it('con SOLO el documento y su tipo, la persona entra', async () => {
    const { r, base } = await cargar([
      ROTULOS,
      ['', '', '', '', 'CC', '1.020.304.050'],
    ]);

    expect(r.nuevas).toBe(1);
    /// Sin puntos: «1.020.304.050» y «1020304050» son la misma
    /// cédula, y sin normalizar el segundo cargue la metería otra
    /// vez.
    expect(base.creados[0].numeroDocumento).toBe('1020304050');
  });

  it('ninguna columna es obligatoria: un archivo con solo correo y celular se carga', async () => {
    /// El archivo del cliente, tal como lo describió: dos columnas
    /// y nada más. Con una columna llave obligatoria ---como la
    /// tiene el cargue de empresas--- esto no se cargaría.
    const { r } = await cargar([
      ['Correo', 'Celular'],
      ['ana@correo.com', '3001112222'],
      ['', '3002223333'],
      ['luis@correo.com', ''],
    ]);

    expect({ leidas: r.leidas, nuevas: r.nuevas }).toEqual({
      leidas: 3,
      nuevas: 3,
    });
  });
});

describe('la fila sin nada con que reconocerla se reporta, no tumba el cargue', () => {
  it('se dice su número de fila DEL EXCEL y las demás entran', async () => {
    const { r } = await cargar([
      ROTULOS,
      ['Ana', 'Ruiz', 'ana@correo.com', '', '', ''],
      /// Solo la ciudad: no hay nada con que reconocer a nadie, y
      /// guardarla crearía una persona nueva por cada vez que se
      /// suba el archivo.
      ['', '', '', '', 'CC', ''],
      ['Luis', 'Pérez', '', '3002223333', '', ''],
    ]);

    expect({ nuevas: r.nuevas, sinReconocer: r.sinReconocer }).toEqual({
      nuevas: 2,
      sinReconocer: 1,
    });

    const mala = r.filas.find((f) => f.que === 'NO_SE_RECONOCE');
    /// LA 3 y no «la 2»: la 1 son los títulos. El cliente busca la
    /// fila en SU archivo, y el número que cuenta es el del Excel.
    expect(mala?.fila).toBe(3);
    expect(mala?.avisos.join(' ')).toMatch(/no trae nada con que reconocerlo/i);
  });

  it('el número de documento SIN tipo se explica, no se calla', async () => {
    /// `llaveDelLead` arma la llave del documento con la pareja
    /// `(tipo, número)`, así que sin el tipo no hay llave y la fila
    /// se queda fuera. Decir solo «no se reconoce» haría que el
    /// cliente creyera que su base está mal, cuando lo que falta es
    /// UNA columna.
    const { r } = await cargar([
      ['Número de documento'],
      ['1020304050'],
      ['1020304051'],
    ]);

    expect(r.sinReconocer).toBe(2);
    expect(r.filas[0].avisos.join(' ')).toMatch(
      /trae el número de documento pero no el tipo/i,
    );
  });
});

describe('lo que llega mal se avisa y la fila entra igual', () => {
  it('un celular que no es un celular no se guarda, pero la persona sí', async () => {
    const { r, base } = await cargar([
      ROTULOS,
      ['Ana', 'Ruiz', 'ana@correo.com', 'no tiene', '', ''],
    ]);

    expect(r.nuevas).toBe(1);
    /// Guardar «no tiene» como celular es peor que no guardar
    /// nada: la compuerta de matrícula lo cuenta como «hay forma
    /// de contactarla» y viaja al reporte del SEP.
    expect(base.creados[0].celular).toBeNull();
    expect(r.filas[0].avisos.join(' ')).toMatch(/no es un celular colombiano/i);
  });

  it('un curso que este gremio no tiene no tumba la fila', async () => {
    /// `AF9` no existe en el catálogo que se le dio al arnés. El
    /// lead entra sin curso y el asesor pregunta: meterlo en otro
    /// es inscribirlo en algo que no pidió.
    const { r, base } = await cargar([
      ['Correo', 'Acción de formación'],
      ['ana@correo.com', 'AF9'],
    ]);

    expect(r.nuevas).toBe(1);
    expect(base.creados[0].accionFormacionId).toBeNull();
    expect(r.filas[0].avisos.join(' ')).toMatch(/no es una acción publicada/i);
  });
});
