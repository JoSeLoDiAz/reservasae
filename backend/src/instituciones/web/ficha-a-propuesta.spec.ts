import {
  ciiuCuadraConSector,
  ciiuPorSector,
  derivarDepartamento,
  fichaAPropuesta,
  leerCiiu,
  leerCorreo,
  leerEmpleados,
  leerFecha,
} from './ficha-a-propuesta';
import { leerFichaWeb, type FichaWeb } from './leer-ficha-web';

const ABC = leerFichaWeb(
  'Razón social: ABC LABORATORIOS S.A.S.Nombre comercial: ABC Laboratorios' +
    'Dirección: Calle 24 # 27A-56Ciudad: Bogotá D.C.Departamento: Cundinamarca' +
    'Teléfono: (601) 518-6600Correo: ventas@abclaboratorios.comPágina web: ' +
    'abclaboratorios.comSector económico: Otra fabricación diversa / Industrias ' +
    'manufacturerasCódigo CIIU: 3290 (Otras industrias manufactureras n.c.p.)' +
    'Clasificación: Fabricación y provisión de equipamiento científico, didáctico ' +
    'y reactivos de laboratorioFecha de fundación: 17 de enero de 1972Tamaño: ' +
    'Pequeña empresaNúmero de empleados: Entre 11 y 50 colaboradores',
);

const COMFENALCO = leerFichaWeb(
  'Razón social: Caja de Compensación Familiar Comfenalco Antioquia' +
    'Nombre comercial: Comfenalco AntioquiaFecha de fundación: 30 de agosto de 1957' +
    'Dirección: Carrera 50 # 53 - 43 (Sede Palacé, Medellín)Teléfono: (604) 444 71 10' +
    'Correo: emailinstitucional@comfenalcoantioquia.comPágina web: ' +
    'www.comfenalcoantioquia.com.coCiudad: MedellínDepartamento: Antioquia' +
    'Sector económico: Seguridad social y subsidio familiarCódigo CIIU: 8430 ' +
    '(Actividades de planes de seguridad social)Clasificación: Persona jurídica - ' +
    'Entidad sin ánimo de lucro (ESAL)Tamaño: Grande empresaNúmero de empleados: ' +
    'Más de 2.000 empleados directos',
);

describe('regresión: ABC', () => {
  const p = fichaAPropuesta(ABC);
  it('mayúsculas', () => {
    expect(p.razonSocial).toBe('ABC LABORATORIOS S.A.S');
    expect(p.nombreComercial).toBe('ABC LABORATORIOS');
  });
  it('CIIU en código', () => expect(p.codigoCiiu).toBe('3290'));
  it('tamaño enum', () => expect(p.tamano).toBe('PEQUENA'));
  it('fecha ISO', () => expect(p.fechaFundacion).toBe('1972-01-17'));
  it('NO empleados (rango)', () => expect(p.numeroEmpleados).toBeUndefined());
  it('NO clasificación (no es del enum)', () => expect(p.clasificacion).toBeUndefined());
  it('correo (dominio cuadra con web)', () => expect(p.correo).toBe('ventas@abclaboratorios.com'));
});

describe('regresión: Comfenalco', () => {
  const p = fichaAPropuesta(COMFENALCO);
  it('clasificación ESAL', () => expect(p.clasificacion).toBe('ENTIDAD_SIN_ANIMO_DE_LUCRO'));
  it('tamaño y fecha', () => {
    expect(p.tamano).toBe('GRANDE');
    expect(p.fechaFundacion).toBe('1957-08-30');
  });
  it('ciudad sin paréntesis', () => expect(p.ciudadNombre).toBe('Medellín'));
  it('web con www (sin cambios)', () => expect(p.paginaWeb).toBe('www.comfenalcoantioquia.com.co'));
  it('correo pasa aunque el TLD difiera del de la web (.com vs .com.co)', () =>
    expect(p.correo).toBe('emailinstitucional@comfenalcoantioquia.com'));
  it('departamento derivado de Medellín = Antioquia', () =>
    expect(p.departamentoNombre).toBe('Antioquia'));
});

describe('regresión: no propone lo que ya está', () => {
  it('valores iguales no entran', () => {
    const p = fichaAPropuesta(COMFENALCO, {
      ciudadNombre: 'MEDELLIN', departamentoNombre: 'Antioquia', tamano: 'GRANDE',
    });
    expect(p.ciudadNombre).toBeUndefined();
    expect(p.departamentoNombre).toBeUndefined();
    expect(p.tamano).toBeUndefined();
  });
  it('fecha ya guardada no reentra', () => {
    const p = fichaAPropuesta(COMFENALCO, { fechaFundacion: new Date('1957-08-30T00:00:00.000Z') });
    expect(p.fechaFundacion).toBeUndefined();
  });
});

describe('NUEVO: correo con chequeo de dominio', () => {
  it('dominio que cuadra pasa', () =>
    expect(leerCorreo('egomez@vise.com.co', 'vise.com.co')).toBe('egomez@vise.com.co'));
  it('dominio que no cuadra -> null', () =>
    expect(leerCorreo('x@otracosa.com', 'vise.com.co')).toBeNull());
  it('sin web: personal -> null', () =>
    expect(leerCorreo('egomez@vise.com.co', null)).toBeNull());
  it('sin web: institucional -> ok', () =>
    expect(leerCorreo('contacto@vise.com.co', null)).toBe('contacto@vise.com.co'));
});

describe('NUEVO: empleados descarta el año adorno', () => {
  const casos: Array<[string, number | null]> = [
    ['6.265 (a año 2026)', 6265],
    ['6,265 (dato reportado a 2026)', 6265],
    ['150', 150],
    ['Entre 11 y 50', null],
    ['200+', null],
  ];
  it.each(casos)('«%s» -> %s', (t: string, esperado: number | null) =>
    expect(leerEmpleados(t)).toBe(esperado));
});

describe('NUEVO: departamento derivado de la ciudad', () => {
  it('Bogotá D.C -> Bogotá D.C.', () => expect(derivarDepartamento('Bogotá D.C')).toBe('Bogotá D.C.'));
  it('Medellín -> Antioquia', () => expect(derivarDepartamento('Medellín')).toBe('Antioquia'));
  it('desconocida -> null', () => expect(derivarDepartamento('Pueblito X')).toBeNull());
});

describe('NUEVO: sector -> CIIU y validación cruzada', () => {
  it('Comercio -> 4719', () => expect(ciiuPorSector('Comercio')?.ciiu).toBe('4719'));
  it('Manufactura -> 3290', () => expect(ciiuPorSector('Manufactura')?.ciiu).toBe('3290'));
  it('4719 cuadra con Comercio', () => expect(ciiuCuadraConSector('4719', 'Comercio')).toBe(true));
  it('3290 NO cuadra con Comercio', () => expect(ciiuCuadraConSector('3290', 'Comercio')).toBe(false));
  it('9609 cuadra con Servicios', () => expect(ciiuCuadraConSector('9609', 'Servicios')).toBe(true));
});

describe('regresión: helpers sueltos', () => {
  it('leerCiiu G4711 -> 4711', () => expect(leerCiiu('G4711')).toBe('4711'));
  it('leerFecha 17/01/1972', () => expect(leerFecha('17/01/1972')).toBe('1972-01-17'));
  const clasificar = (v: string) => fichaAPropuesta({ clasificacion: v } as FichaWeb).clasificacion;
  it('alcaldía -> territorial', () => expect(clasificar('Alcaldía de Medellín')).toBe('ENTIDAD_TERRITORIAL'));
  it('privada -> empresa privada', () => expect(clasificar('Empresa privada')).toBe('EMPRESA_PRIVADA'));
});
