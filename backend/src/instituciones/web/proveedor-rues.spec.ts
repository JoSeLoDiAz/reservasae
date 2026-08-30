/** Lo que decide el proveedor del registro mercantil, sin salir a la red. */

import { aFichaWeb, aIso, clasificar, elMejorRegistro, esDeRelleno } from './proveedor-rues';

/// Filas de verdad, recortadas: salieron de consultar el RUES.
const VISE_BOGOTA = {
  codigo_camara: '04',
  camara_comercio: 'BOGOTA',
  matricula: '171944',
  razon_social: 'VISE LTDA',
  clase_identificacion: 'NIT',
  numero_identificacion: '860507033',
  cod_ciiu_act_econ_pri: '8010',
  fecha_matricula: '19820531',
  fecha_renovacion: '20260331',
  ultimo_ano_renovado: '2026',
  organizacion_juridica: 'SOCIEDAD LIMITADA',
  estado_matricula: 'ACTIVA',
};

const VISE_CALI = {
  codigo_camara: '08',
  camara_comercio: 'CALI',
  matricula: '377673',
  razon_social: 'VIGILANCIA Y SEGURIDAD LIMITADA VISE LTDA',
  clase_identificacion: 'NIT',
  numero_identificacion: '860507033',
  fecha_matricula: '19921125',
  ultimo_ano_renovado: '1994',
  organizacion_juridica: 'OTRAS SOCIEDADES',
  estado_matricula: 'NO ASIGNADO',
};

describe('elegir entre las matrículas de un mismo NIT', () => {
  it('se queda con la ACTIVA, no con la primera', () => {
    expect(elMejorRegistro([VISE_CALI, VISE_BOGOTA])?.camara_comercio).toBe('BOGOTA');
  });

  it('entre dos activas, la renovada más recientemente', () => {
    const vieja = { ...VISE_BOGOTA, camara_comercio: 'TUNJA', ultimo_ano_renovado: '2019' };
    expect(elMejorRegistro([vieja, VISE_BOGOTA])?.ultimo_ano_renovado).toBe('2026');
  });

  it('la misma empresa con el nombre largo y el corto no es ambigua', () => {
    const caliActiva = { ...VISE_CALI, estado_matricula: 'ACTIVA' };
    expect(elMejorRegistro([caliActiva, VISE_BOGOTA])?.razon_social).toBe('VISE LTDA');
  });

  it('descarta las filas sin identificación', () => {
    const sinId = { ...VISE_BOGOTA, clase_identificacion: 'SIN IDENTIFICACION' };
    expect(elMejorRegistro([sinId])).toBeNull();
  });

  it('sin razón social no sirve', () => {
    expect(elMejorRegistro([{ ...VISE_BOGOTA, razon_social: '  ' }])).toBeNull();
  });

  /// El caso peligroso: un número de relleno devuelve empresas reales
  /// que no tienen nada que ver. Antes que proponer la de otro, nada.
  it('varias empresas DISTINTAS con el mismo número -> no se elige ninguna', () => {
    const filas = [
      { ...VISE_BOGOTA, razon_social: 'PREVEA ASESORES Y CONSULTORES SAS' },
      { ...VISE_BOGOTA, razon_social: 'SUPER HELADOS OSITO LTDA' },
      { ...VISE_BOGOTA, razon_social: 'DISTRIBUIDORA DE MINERALES INDUSTRIALES LTDA' },
    ];
    expect(elMejorRegistro(filas)).toBeNull();
  });

  /// «LTDA» y «ASESORES» las tiene media Colombia: compartirlas no
  /// convierte a dos empresas en la misma.
  it('compartir solo palabras genéricas no las hace la misma', () => {
    const filas = [
      { ...VISE_BOGOTA, razon_social: 'PREVEA ASESORES LTDA' },
      { ...VISE_BOGOTA, razon_social: 'GLORIA RAMIREZ ASESORES LTDA' },
    ];
    expect(elMejorRegistro(filas)).toBeNull();
  });
});

describe('números que no se consultan', () => {
  it.each(['999999999', '111111111', '000000000', '0', '1234'])('«%s» es de relleno', (n) => {
    expect(esDeRelleno(n)).toBe(true);
  });

  it.each(['860507033', '900654922', '79812345'])('«%s» sí se consulta', (n) => {
    expect(esDeRelleno(n)).toBe(false);
  });
});

describe('las fechas del registro', () => {
  it('19820531 -> 1982-05-31', () => expect(aIso('19820531')).toBe('1982-05-31'));
  it('00000000 es «no hay fecha»', () => expect(aIso('00000000')).toBeNull());
  it('99991231 tampoco es una fecha', () => expect(aIso('99991231')).toBeNull());
  it('un mes imposible se descarta', () => expect(aIso('19821331')).toBeNull());
  it('vacío', () => expect(aIso(undefined)).toBeNull());
});

describe('la figura jurídica, dicha como la entiende la ficha', () => {
  it.each([
    ['SOCIEDAD LIMITADA', 'empresa privada'],
    ['SOCIEDADES POR ACCIONES SIMPLIFICADAS SAS', 'empresa privada'],
    ['PERSONA NATURAL', 'empresa privada'],
    ['ENTIDAD SIN ANIMO DE LUCRO', 'entidad sin animo de lucro'],
    ['COOPERATIVA DE TRABAJO ASOCIADO', 'entidad de economia solidaria'],
    ['EMPRESA ASOCIATIVA DE TRABAJO', 'empresa asociativa de trabajo'],
  ])('«%s» -> %s', (entra, sale) => expect(clasificar(entra)).toBe(sale));

  /// Mejor un campo vacío que clasificar mal a alguien en un reporte.
  it('lo que no se reconoce queda vacío', () => {
    expect(clasificar('FIGURA RARISIMA')).toBeNull();
    expect(clasificar(undefined)).toBeNull();
  });
});

describe('del registro a los catorce campos', () => {
  const ficha = aFichaWeb(VISE_BOGOTA, {
    desc_ciiu_act_econ_pri: 'Actividades de seguridad privada',
  });

  it('trae lo que el registro sí sabe', () => {
    expect(ficha.razonSocial).toBe('VISE LTDA');
    expect(ficha.fechaFundacion).toBe('1982-05-31');
    expect(ficha.codigoCiiu).toBe('8010');
    expect(ficha.sectorEconomico).toBe('Actividades de seguridad privada');
    expect(ficha.clasificacion).toBe('empresa privada');
  });

  /// El RUES no publica contacto, y la cámara de comercio NO es el
  /// municipio -- la de Bogotá cubre decenas. Poner ahí algo verosímil
  /// pero falso es justo lo que este sistema evita.
  it('deja vacío lo que no sabe, incluida la ciudad', () => {
    expect(ficha.direccion).toBeNull();
    expect(ficha.telefono).toBeNull();
    expect(ficha.correo).toBeNull();
    expect(ficha.paginaWeb).toBeNull();
    expect(ficha.ciudadNombre).toBeNull();
    expect(ficha.departamentoNombre).toBeNull();
    expect(ficha.tamano).toBeNull();
    expect(ficha.numeroEmpleados).toBeNull();
  });
});
