/** La talla se cuenta con el criterio del SEP, no con el viejo. */

/**
 * Los dos proyectos comprometen un número de MIPYMES, y el corte
 * de `/analisis` lo contaba por número de empleados (Ley 590 de
 * 2000) mientras el SEP clasifica por ingresos y sector (Decreto
 * 957 de 2019). No son el mismo criterio, así que la pantalla y
 * el archivo que se le manda al cliente decían cosas distintas
 * de la misma empresa.
 */

import { TALLAS, tallaDeOrganizacion } from './catalogos-sep';
import { TAMANOS_EMPRESA_SEP } from './catalogos-sep.generado';

describe('el id del SEP manda cuando está', () => {
  it('los DOCE valores del catálogo dan una talla', () => {
    /// La talla se deriva de la etiqueta y no de un mapa a mano:
    /// esto es lo que garantiza que un valor nuevo del SEP no se
    /// quede fuera en silencio.
    for (const v of TAMANOS_EMPRESA_SEP) {
      const { talla, origen } = tallaDeOrganizacion({ tamanoSepId: v.id });
      expect(TALLAS).toContain(talla);
      expect(origen).toBe('DECRETO_957');
    }
  });

  it('cada valor cae en la talla que dice su etiqueta', () => {
    for (const v of TAMANOS_EMPRESA_SEP) {
      const { talla } = tallaDeOrganizacion({ tamanoSepId: v.id });
      const cabeza = v.etiqueta.split('-')[0].trim().toUpperCase();
      const esperada =
        cabeza === 'MICROEMPRESA'
          ? 'Microempresa'
          : cabeza === 'PEQUEÑA'
            ? 'Pequeña'
            : cabeza === 'MEDIANA'
              ? 'Mediana'
              : 'Grande';
      expect(talla).toBe(esperada);
    }
  });

  it('el caso que estaba mal: 8 empleados y $30.000 millones', () => {
    /// Por empleados salía «Microempresa»; por ingresos es
    /// GRANDE - SERVICIOS. Es el ejemplo que el contexto del
    /// proyecto ya traía escrito como defecto.
    const { talla, origen } = tallaDeOrganizacion({
      tamanoSepId: 2,
      numeroColaboradores: 8,
    });
    expect(talla).toBe('Grande');
    expect(origen).toBe('DECRETO_957');
  });
});

describe('sin el id del SEP se cae al criterio viejo, y lo dice', () => {
  it('por empleados, marcado como tal', () => {
    /// Que lo diga es el punto: una cifra de mipymes mezclada
    /// con dos criterios sin avisar es la peor clase de cifra.
    expect(tallaDeOrganizacion({ numeroColaboradores: 8 })).toEqual({
      talla: 'Microempresa',
      origen: 'EMPLEADOS',
    });
    expect(tallaDeOrganizacion({ numeroColaboradores: 500 })).toEqual({
      talla: 'Grande',
      origen: 'EMPLEADOS',
    });
  });

  it('los bordes de la Ley 590', () => {
    expect(tallaDeOrganizacion({ numeroColaboradores: 10 }).talla).toBe('Microempresa');
    expect(tallaDeOrganizacion({ numeroColaboradores: 11 }).talla).toBe('Pequeña');
    expect(tallaDeOrganizacion({ numeroColaboradores: 50 }).talla).toBe('Pequeña');
    expect(tallaDeOrganizacion({ numeroColaboradores: 51 }).talla).toBe('Mediana');
    expect(tallaDeOrganizacion({ numeroColaboradores: 200 }).talla).toBe('Mediana');
    expect(tallaDeOrganizacion({ numeroColaboradores: 201 }).talla).toBe('Grande');
  });

  it('cero empleados es un dato, no un hueco', () => {
    /// Una empresa unipersonal declara 0 y sigue siendo micro.
    /// Con un `if (colaboradores)` se iba a «sin dato».
    expect(tallaDeOrganizacion({ numeroColaboradores: 0 })).toEqual({
      talla: 'Microempresa',
      origen: 'EMPLEADOS',
    });
  });

  it('sin ninguno de los dos, no se inventa una talla', () => {
    expect(tallaDeOrganizacion({})).toEqual({ talla: null, origen: 'SIN_DATO' });
    expect(tallaDeOrganizacion({ tamanoSepId: null, numeroColaboradores: null })).toEqual({
      talla: null,
      origen: 'SIN_DATO',
    });
  });

  it('un id que no está en el catálogo no cuela como talla', () => {
    /// La siembra de pruebas usa ids NEGATIVOS a propósito.
    expect(tallaDeOrganizacion({ tamanoSepId: -2959 })).toEqual({
      talla: null,
      origen: 'SIN_DATO',
    });
    expect(
      tallaDeOrganizacion({ tamanoSepId: 9999, numeroColaboradores: 5 }),
    ).toEqual({ talla: 'Microempresa', origen: 'EMPLEADOS' });
  });
});
