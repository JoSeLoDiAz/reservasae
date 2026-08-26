import { cuantosTrajo, leerFichaWeb } from './leer-ficha-web';

/// Las dos respuestas son REALES, copiadas tal cual las
/// devolvió el buscador. Si mañana cambia la forma en que
/// contesta, estas pruebas se caen y se sabe por qué.
///
/// Fíjese en que los campos van pegados unos a otros -- «ABC
/// LABORATORIOS S.A.S.Nombre comercial:» -- sin salto ni
/// espacio. Por eso el corte va por etiquetas y no por
/// líneas.

const ABC =
  'Aquí tienes la información detallada correspondiente a la empresa vinculada al ' +
  'NIT 860031945, consolidada a partir de los datos registrados en el portal oficial ' +
  'corporativo de Abc Laboratorios y los perfiles de directorios empresariales como ' +
  'EMIS y DataCrédito Empresas:📌 Identificación y ContactoRazón social: ABC ' +
  'LABORATORIOS S.A.S.Nombre comercial: ABC LaboratoriosDirección: Calle 24 # ' +
  '27A-56Ciudad: Bogotá D.C.Departamento: CundinamarcaTeléfono: (601) 518-6600Correo: ' +
  'ventas@abclaboratorios.comPágina web: abclaboratorios.com📊 Clasificación y ' +
  'Actividad EconómicaSector económico: Otra fabricación diversa / Industrias ' +
  'manufacturerasCódigo CIIU: 3290 (Otras industrias manufactureras n.c.p.)' +
  'Clasificación: Fabricación y provisión de equipamiento científico, didáctico y ' +
  'reactivos de laboratorio📈 Datos Estructurales y de OperaciónFecha de fundación: ' +
  '17 de enero de 1972Tamaño: Pequeña empresaNúmero de empleados: Entre 11 y 50 ' +
  'colaboradores (según reportes financieros oficiales de EMIS)';

const COMFENALCO =
  'Aquí tienes la información detallada para el NIT 890900842:Razón social: Caja de ' +
  'Compensación Familiar Comfenalco AntioquiaNombre comercial: Comfenalco Antioquia' +
  'Fecha de fundación: 30 de agosto de 1957Dirección: Carrera 50 # 53 - 43 (Sede ' +
  'Palacé, Medellín)Teléfono: (604) 444 71 10 (Área Metropolitana) / 01 8000 427 111 ' +
  '(Nacional)Correo: emailinstitucional@comfenalcoantioquia.comPágina web: ' +
  'www.comfenalcoantioquia.com.coCiudad: MedellínDepartamento: AntioquiaSector ' +
  'económico: Seguridad social y subsidio familiar (Entidad Privada Sin Ánimo de ' +
  'Lucro)Código CIIU: 8430 (Actividades de planes de seguridad social de afiliación ' +
  'obligatoria)Clasificación: Persona jurídica - Entidad sin ánimo de lucro (ESAL)' +
  'Tamaño: Grande empresaNúmero de empleados: Más de 2.000 empleados directosSi ' +
  'requieres una copia actualizada o verificar firmas legales, te sugiero consultar ' +
  'directamente el Registro Único Empresarial y Social (RUES) o solicitar el ' +
  'certificado en la Cámara de Comercio de Medellín para Antioquia. ¿Hay alguna otra ' +
  'empresa o NIT de la cual desees que busquemos datos?';

describe('ABC Laboratorios, NIT 860031945', () => {
  const f = leerFichaWeb(ABC);

  it('saca los catorce campos', () => {
    expect(cuantosTrajo(f)).toBe(14);
  });

  it('no se lleva la etiqueta siguiente pegada al valor', () => {
    // el fallo clásico: «ABC LABORATORIOS S.A.S.Nombre comercial: …»
    expect(f.razonSocial).toBe('ABC LABORATORIOS S.A.S');
    expect(f.nombreComercial).toBe('ABC Laboratorios');
  });

  it('lee el contacto', () => {
    expect(f.direccion).toBe('Calle 24 # 27A-56');
    expect(f.ciudadNombre).toBe('Bogotá D.C');
    expect(f.departamentoNombre).toBe('Cundinamarca');
    expect(f.telefono).toBe('(601) 518-6600');
    expect(f.correo).toBe('ventas@abclaboratorios.com');
    expect(f.paginaWeb).toBe('abclaboratorios.com');
  });

  it('los títulos con emoji no se cuelan en el valor', () => {
    // «…abclaboratorios.com📊 Clasificación y Actividad Económica»
    expect(f.paginaWeb).not.toMatch(/Clasificación|📊/);
    expect(f.clasificacion).not.toMatch(/📈|Datos Estructurales/);
  });

  it('lee la actividad', () => {
    expect(f.sectorEconomico).toBe(
      'Otra fabricación diversa / Industrias manufactureras',
    );
    expect(f.codigoCiiu).toBe('3290 (Otras industrias manufactureras n.c.p.)');
  });

  it('lee lo estructural', () => {
    expect(f.fechaFundacion).toBe('17 de enero de 1972');
    expect(f.tamano).toBe('Pequeña empresa');
    expect(f.numeroEmpleados).toBe(
      'Entre 11 y 50 colaboradores (según reportes financieros oficiales de EMIS)',
    );
  });
});

describe('Comfenalco Antioquia, NIT 890900842', () => {
  const f = leerFichaWeb(COMFENALCO);

  it('saca los catorce campos', () => {
    expect(cuantosTrajo(f)).toBe(14);
  });

  it('parte bien aunque los campos vayan pegados', () => {
    expect(f.razonSocial).toBe(
      'Caja de Compensación Familiar Comfenalco Antioquia',
    );
    expect(f.nombreComercial).toBe('Comfenalco Antioquia');
    expect(f.fechaFundacion).toBe('30 de agosto de 1957');
  });

  it('aguanta paréntesis y barras dentro del valor', () => {
    expect(f.direccion).toBe('Carrera 50 # 53 - 43 (Sede Palacé, Medellín)');
    expect(f.telefono).toBe(
      '(604) 444 71 10 (Área Metropolitana) / 01 8000 427 111 (Nacional)',
    );
  });

  it('corta el remate de cortesía del final', () => {
    // «…empleados directosSi requieres una copia actualizada…»
    expect(f.numeroEmpleados).toBe('Más de 2.000 empleados directos');
    expect(f.numeroEmpleados).not.toMatch(/requieres|RUES|Cámara/);
  });
});

describe('cuando la respuesta no sirve', () => {
  it('sin nada devuelve todo vacío', () => {
    expect(cuantosTrajo(leerFichaWeb(''))).toBe(0);
  });

  it('prosa sin etiquetas no inventa campos', () => {
    const f = leerFichaWeb(
      'No encontré información para ese NIT en ninguna fuente.',
    );
    expect(cuantosTrajo(f)).toBe(0);
  });

  it('«no disponible» no es un dato', () => {
    const f = leerFichaWeb(
      'Razón social: ACME S.A.S.Correo: No disponiblePágina web: N/A',
    );
    expect(f.razonSocial).toBe('ACME S.A.S');
    expect(f.correo).toBeNull();
    expect(f.paginaWeb).toBeNull();
  });

  it('un párrafo entero no pasa por dato', () => {
    const largo = 'Razón social: ' + 'a'.repeat(250);
    expect(leerFichaWeb(largo).razonSocial).toBeNull();
  });

  it('lee aunque la respuesta venga en líneas sueltas', () => {
    const f = leerFichaWeb(
      'Razón social: ACME S.A.S.\nCiudad: Cali\nDepartamento: Valle del Cauca',
    );
    expect(f.razonSocial).toBe('ACME S.A.S');
    expect(f.ciudadNombre).toBe('Cali');
    expect(f.departamentoNombre).toBe('Valle del Cauca');
  });
});
