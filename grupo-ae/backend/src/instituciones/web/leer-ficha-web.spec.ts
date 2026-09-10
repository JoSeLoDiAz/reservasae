import { cuantosTrajo, leerFichaWeb } from './leer-ficha-web';

const ABC =
  'Aquí tienes la información detallada correspondiente a la empresa vinculada al ' +
  'NIT 860031945:📌 Identificación y ContactoRazón social: ABC ' +
  'LABORATORIOS S.A.S.Nombre comercial: ABC LaboratoriosDirección: Calle 24 # ' +
  '27A-56Ciudad: Bogotá D.C.Departamento: CundinamarcaTeléfono: (601) 518-6600Correo: ' +
  'ventas@abclaboratorios.comPágina web: abclaboratorios.com📊 Clasificación y ' +
  'Actividad EconómicaSector económico: Otra fabricación diversa / Industrias ' +
  'manufacturerasCódigo CIIU: 3290 (Otras industrias manufactureras n.c.p.)' +
  'Clasificación: Fabricación y provisión de equipamiento científico, didáctico y ' +
  'reactivos de laboratorio📈 Datos Estructurales y de OperaciónFecha de fundación: ' +
  '17 de enero de 1972Tamaño: Pequeña empresaNúmero de empleados: Entre 11 y 50 ' +
  'colaboradores (según reportes financieros oficiales de EMIS)';

describe('regresión: ABC (todo pegado)', () => {
  const f = leerFichaWeb(ABC);
  it('saca los catorce campos', () => expect(cuantosTrajo(f)).toBe(14));
  it('no se lleva la etiqueta pegada', () => {
    expect(f.razonSocial).toBe('ABC LABORATORIOS S.A.S');
    expect(f.nombreComercial).toBe('ABC Laboratorios');
  });
  it('emoji no se cuela', () => {
    expect(f.paginaWeb).toBe('abclaboratorios.com');
    expect(f.clasificacion).not.toMatch(/📈|Datos Estructurales/);
  });
  it('el último campo conserva su paréntesis (glued)', () => {
    expect(f.numeroEmpleados).toBe(
      'Entre 11 y 50 colaboradores (según reportes financieros oficiales de EMIS)',
    );
  });
});

describe('mejora: corta las citas cuando viene por líneas', () => {
  it('empleados sin citas pegadas debajo', () => {
    const f = leerFichaWeb(
      'Número de empleados: 6.265 \nVeritrade\n +8\nLa IA puede cometer errores',
    );
    expect(f.numeroEmpleados).toBe('6.265');
  });
  it('lee por líneas sueltas', () => {
    const f = leerFichaWeb('Razón social: ACME S.A.S.\nCiudad: Cali\nDepartamento: Valle del Cauca');
    expect(f.razonSocial).toBe('ACME S.A.S');
    expect(f.ciudadNombre).toBe('Cali');
    expect(f.departamentoNombre).toBe('Valle del Cauca');
  });
});

describe('regresión: descartes', () => {
  it('vacío -> 0', () => expect(cuantosTrajo(leerFichaWeb(''))).toBe(0));
  it('prosa sin etiquetas -> 0', () =>
    expect(cuantosTrajo(leerFichaWeb('No encontré nada'))).toBe(0));
  it('«no disponible» no es dato', () => {
    const f = leerFichaWeb('Razón social: ACME S.A.S.Correo: No disponiblePágina web: N/A');
    expect(f.razonSocial).toBe('ACME S.A.S');
    expect(f.correo).toBeNull();
    expect(f.paginaWeb).toBeNull();
  });
  it('párrafo largo no pasa', () =>
    expect(leerFichaWeb('Razón social: ' + 'a'.repeat(250)).razonSocial).toBeNull());
});
