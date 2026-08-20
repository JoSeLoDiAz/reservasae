import { COLUMNAS as CARGUE } from './formato-cargue-sep';
import { COLUMNAS as F7 } from './formato-f7';
import { COLUMNAS as USO } from './formato-uso-directo';

/// Copiadas del fichero real que entregó el cliente. El
/// título y el orden SON el contrato: si alguien reordena
/// o corrige una tilde, el cargue se rompe en silencio.
const TITULOS_USO = [
  'AF',
  'Nombre AF',
  'Grupo',
  'Tipo de identificación del Beneficiario',
  'Número de identificación',
  'Nombres',
  '1 Apellidos',
  '2 Apellidos',
  'Género',
  'Estrato socio-económico ',
  'Fecha de nacimiento',
  'Número de Celular',
  'Departamento',
  'Ciudad',
  'Correo',
  'Barrio / Vereda',
  'Dirección',
  'Se ha beneficiado anteriormente',
  'NIT de la empresa',
  'Dígito de verificación',
  'Nombre de la empresa',
  'Tamaño empresa',
  'Marca de caracterización de población a la que pertenece',
  'Nivel ocupacional',
  'Cargo',
  'Transferencia',
  'Perfil de Transferencia',
];

const TITULOS_CARGUE = [
  'NO.',
  'NOMBRE CONVINIENTE',
  'PROYECTO ID',
  'AF ID',
  'ACCION DE FORMACION',
  'ID GRUPO',
  'GRUPO',
  'TOTAL DE HORAS EVENTO',
  'PERSONA ID',
  'POSTULACION 2025',
  'TIPO IDENTIFICACION',
  'ID TIPO DOCUMENTO',
  'NUMERODEIDENTIFICACION',
  'NOMBRES',
  'PRIMER APELLIDO',
  'SEGUNDO APELLIDO',
  'GENERO',
  'ID GENERO',
  'ESTRATO SOCIO-ECONOMICO',
  'FECHA DE NACIMIENTO',
  'EDAD',
  'ID RANGO',
  'RANGO DE EDAD',
  'NUMERODECELULAR',
  'CORREO',
  'CÓDIGO DEPARTAMENTO DE DOMICILIO',
  'DEPARTAMENTO DE DOMICILIO',
  'CÓDIGO MUNICIPIO DOMICILIO',
  'MUNICIPIO DOMICILIO',
  'BARRIO/VEREDA',
  'DIRECCION DOMICILIO',
  'CÓDIGO CARACTERIZACION',
  'CARACTERIZACION',
  'TRANSFERENCIA',
  'PERFIL DE TRANSFERENCIA',
  'PERFIL ID',
  'EMPRESA ID',
  'NÚMERO DE DOCUMENTO EMPRESA DONDE LABORA',
  'DV',
  'NOMBRE EMPRESA DONDE LABORA',
  'TAMAÑO EMPRESA DONDE LABORA',
  'TAMAÑO EMP ID',
  'NIVEL OCUPACIONAL',
  'NV ID',
  'SE HA BENEFICIADO ANTERIORMENTE',
  'CERTIFICA',
  'ESTADO INTERVENTORIA',
  'HORAS PRESENCIALES',
  'HORAS PAT',
  'HORAS VIRTUALES',
  'HORAS HIBRIDAS',
  'PORCENTAJE DE CUMPLIMIENTO',
  'OBSERVACIONES',
  'ESTADO',
];

describe('formato de uso directo', () => {
  it('tiene las 27 columnas del cliente, en su orden y con su título', () => {
    expect(USO.map((c) => c.titulo)).toEqual(TITULOS_USO);
  });

  it('conserva el espacio final de «Estrato socio-económico »', () => {
    const estrato = USO.find((c) => c.clave === 'estrato');
    expect(estrato?.titulo).toBe('Estrato socio-económico ');
  });

  it('no repite una clave', () => {
    expect(new Set(USO.map((c) => c.clave)).size).toBe(USO.length);
  });
});

describe('formato de cargue al SEP', () => {
  it('tiene las 54 columnas del cliente, en su orden y con su título', () => {
    expect(CARGUE.map((c) => c.titulo)).toEqual(TITULOS_CARGUE);
  });

  it('no repite una clave', () => {
    expect(new Set(CARGUE.map((c) => c.clave)).size).toBe(CARGUE.length);
  });

  it('escribe los documentos sin separador de miles', () => {
    // con #,##0 una cedula sale 1.019.456.782
    for (const clave of ['documento', 'nitEmpresa', 'celular']) {
      expect(CARGUE.find((c) => c.clave === clave)?.formato).toBe('entero');
    }
  });
});

/// Copiadas del "F7 - SENA.XLSX" que entregó el cliente.
/// La J lleva un espacio DELANTE y la P un salto de línea
/// dentro: los dos van tal cual, no son erratas nuestras.
const TITULOS_F7 = [
  '#',
  'NOMBRE DE LA ACCIÓN DE FORMACIÓN',
  'NOMBRE EMPRESA',
  'NIT',
  'DV',
  'DEPARTAMENTO SEDE DE LA EMPRESA',
  'MUNICIPIO SEDE DE LA EMPRESA',
  'DIRECCIÓN',
  'TELÉFONO',
  ' NOMBRE PERSONA DE CONTACTO',
  'CARGO PERSONA DE CONTACTO',
  'CORREO ELECTRÓNICO',
  'TAMAÑO DE LA EMPRESA',
  'NÚMERO DE TRABAJADORES TOTALES DE LA EMPRESA',
  'NÚMERO DE BENEFICIARIOS DEL PFCE DE LA  EMPRESA',
  'EMPRESA/GREMIO\n(Conviniente/Beneficiaria/Perteneciente a la Cadena Productiva',
  'SECTOR ECONÓMICO AL QUE PERTENECE',
  'CLASIFICACIÓN DE LA EMPRESA',
];

describe('el F7 de empresas', () => {
  it('tiene las 18 columnas, en su orden', () => {
    expect(F7.map((c) => c.titulo)).toEqual(TITULOS_F7);
  });

  it('conserva el espacio delante de la persona de contacto', () => {
    expect(F7[9].titulo.startsWith(' ')).toBe(true);
  });

  it('conserva el doble espacio de "DE LA  EMPRESA"', () => {
    expect(F7[14].titulo).toContain('DE LA  EMPRESA');
  });

  it('no repite ninguna clave', () => {
    const claves = F7.map((c) => c.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
