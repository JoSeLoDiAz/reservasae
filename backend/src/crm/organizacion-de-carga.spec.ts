/** La organización de una importación: qué se lee, qué impide y qué se escribe. */

import ExcelJS from 'exceljs';

import { organizacionDelArchivo, textoDelArchivo } from './carga-archivo';
import { libroDePlantilla } from './plantilla-de-carga';
import { leerOrganizacion, queSeEscribe } from './organizacion-de-carga';

describe('leer la organización', () => {
  it('normaliza el NIT con puntos y dígito de verificación', () => {
    const o = leerOrganizacion({
      nit: '900.123.456-8',
      razonSocial: '  Lácteos   San Rafael Ltda. ',
      jefeNombre: 'Marta Ruiz',
      jefeCargo: 'Jefe de talento humano',
      jefeCorreo: 'Marta@Lacteos.com',
    });
    expect(o.nit).toBe('900123456');
    expect(o.digitoVerificacion).toBe('8');
    expect(o.razonSocial).toBe('Lácteos San Rafael Ltda.');
    expect(o.jefeCorreo).toBe('marta@lacteos.com');
    expect(o.problemas).toEqual([]);
    expect(o.avisos).toEqual([]);
  });

  it('sin NIT o sin razón social no se puede importar', () => {
    expect(leerOrganizacion({ razonSocial: 'X' }).problemas).toEqual([
      'Falta el NIT de la organización.',
    ]);
    expect(leerOrganizacion({ nit: '12' , razonSocial: 'X' }).problemas[0]).toMatch(/no es válido/);
    expect(leerOrganizacion({ nit: '900123456' }).problemas).toEqual([
      'Falta el nombre (razón social) de la organización.',
    ]);
  });

  it('un correo del jefe mal escrito impide importar', () => {
    const o = leerOrganizacion({ nit: '900123456', razonSocial: 'X', jefeCorreo: 'marta@' });
    expect(o.problemas).toEqual(['El correo del jefe inmediato no es válido.']);
  });

  it('sin los datos del jefe se importa, pero se avisa qué falta', () => {
    const o = leerOrganizacion({ nit: '900123456', razonSocial: 'X', jefeNombre: 'Marta' });
    expect(o.problemas).toEqual([]);
    expect(o.avisos[0]).toMatch(/^Falta el cargo y el correo del jefe inmediato/);
  });
});

describe('qué se escribe en una organización que ya existe', () => {
  const leida = leerOrganizacion({
    nit: '900123456',
    razonSocial: 'Lacteos San Rafael',
    jefeNombre: 'Marta Ruiz',
    jefeCargo: 'Jefe de talento humano',
    jefeCorreo: 'marta@lacteos.com',
  });

  it('llena lo vacío', () => {
    const r = queSeEscribe(
      { razonSocial: 'Lacteos San Rafael', contactoNombre: null, contactoCargo: null, contactoCorreo: null },
      leida,
    );
    expect(r.datos).toEqual({
      contactoNombre: 'Marta Ruiz',
      contactoCargo: 'Jefe de talento humano',
      contactoCorreo: 'marta@lacteos.com',
    });
    expect(r.seQuedan).toEqual([]);
  });

  it('no pisa lo guardado, y lo dice', () => {
    const r = queSeEscribe(
      {
        razonSocial: 'Lácteos San Rafael Ltda.',
        contactoNombre: 'Pedro Gómez',
        contactoCargo: null,
        contactoCorreo: 'MARTA@lacteos.com',
      },
      leida,
    );
    expect(r.datos).toEqual({ contactoCargo: 'Jefe de talento humano' });
    expect(r.seQuedan).toEqual([
      'el nombre del jefe («Pedro Gómez»)',
      'la razón social («Lácteos San Rafael Ltda.»)',
    ]);
  });
});

describe('la plantilla y su hoja «Organización»', () => {
  async function libroCon(organizacion: Array<[string, string]>, primeraOrganizacion = false) {
    const libro = new ExcelJS.Workbook();
    const agregarOrg = () => {
      const h = libro.addWorksheet('Organización');
      h.addRow(['Dato', 'Valor']);
      for (const fila of organizacion) h.addRow(fila);
    };
    if (primeraOrganizacion) agregarOrg();
    const p = libro.addWorksheet('Participantes');
    p.addRow(['CC', '1019456782', 'Laura', '', 'Gomez', '', 'laura@x.com', '3001234567']);
    if (!primeraOrganizacion) agregarOrg();
    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  it('la plantilla trae las dos hojas y la de organización en blanco', async () => {
    const plantilla = await libroDePlantilla({
      acciones: [{ etiqueta: 'AF1 · UNA ACCIÓN', departamentos: [5] }],
      municipiosConAula: [5001],
    });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(plantilla as unknown as ExcelJS.Buffer);
    /// «Listas» va oculta: es de donde salen los desplegables.
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Participantes', 'Organización', 'Listas']);
    /// En blanco: un NIT de ejemplo olvidado vincularía toda la carga.
    expect(await organizacionDelArchivo(plantilla, 'plantilla.xlsx')).toBeNull();
  });

  it('lee la organización por el rótulo, aunque cambien el orden', async () => {
    const datos = await libroCon([
      ['Correo del jefe inmediato', 'marta@lacteos.com'],
      ['NIT', '900123456'],
      ['Razon social', 'Lacteos San Rafael'],
      ['Cargo del jefe inmediato', 'Jefe de talento humano'],
      ['Nombre del jefe inmediato', 'Marta Ruiz'],
    ]);
    expect(await organizacionDelArchivo(datos, 'lista.xlsx')).toEqual({
      nit: '900123456',
      razonSocial: 'Lacteos San Rafael',
      jefeNombre: 'Marta Ruiz',
      jefeCargo: 'Jefe de talento humano',
      jefeCorreo: 'marta@lacteos.com',
    });
  });

  it('las personas salen de su hoja aunque la de organización vaya primero', async () => {
    const datos = await libroCon([['NIT', '900123456']], true);
    const texto = await textoDelArchivo(datos, 'lista.xlsx');
    expect(texto).toContain('1019456782');
    expect(texto).not.toContain('900123456');
  });

  it('un .csv no tiene hoja de organización', async () => {
    expect(await organizacionDelArchivo(Buffer.from('CC;1;A;;B;;;'), 'lista.csv')).toBeNull();
  });
});
