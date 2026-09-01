/** `CC` es 1, y quien integra no tiene por qué saberlo. */

import { siglasAdmitidas, tipoDeDocumento } from './tipo-de-documento';

describe('la sigla, escrita como la escribe la gente', () => {
  it('CC es cédula de ciudadanía', () => {
    /// El catálogo la guarda como `C.C.` y nadie escribe los
    /// puntos.
    for (const t of ['CC', 'cc', 'C.C.', 'c.c', ' CC ']) {
      expect({ t, id: tipoDeDocumento(t) }).toEqual({ t, id: 1 });
    }
  });

  it('PPT es permiso por protección temporal', () => {
    for (const t of ['PPT', 'ppt', 'P.P.T', 'p.p.t.']) {
      expect({ t, id: tipoDeDocumento(t) }).toEqual({ t, id: 61 });
    }
  });

  it('CE y PASAPORTE también', () => {
    expect(tipoDeDocumento('CE')).toBe(3);
    expect(tipoDeDocumento('PASAPORTE')).toBe(41);
    expect(tipoDeDocumento('pasaporte')).toBe(41);
  });

  it('el nombre entero, con o sin tildes', () => {
    /// Un formulario de Meta rotula la opción con el nombre, no
    /// con la sigla.
    expect(tipoDeDocumento('Cédula de Ciudadanía')).toBe(1);
    expect(tipoDeDocumento('cedula de ciudadania')).toBe(1);
    expect(tipoDeDocumento('Cédula')).toBe(1);
  });
});

describe('el número se sigue admitiendo', () => {
  it('quien ya manda el id no tiene que cambiar', () => {
    expect(tipoDeDocumento(1)).toBe(1);
    expect(tipoDeDocumento('61')).toBe(61);
  });

  it('un id que no está en el catálogo es null', () => {
    /// No se cuela un número cualquiera: acabaría en el cargue
    /// al SEP apuntando a un tipo que no existe.
    expect(tipoDeDocumento(999)).toBeNull();
  });

  it('la tarjeta de identidad NO vale, y es deliberado', () => {
    /// Los menores no entran a esta formación: está fuera del
    /// catálogo de personas a propósito.
    expect(tipoDeDocumento(2)).toBeNull();
    expect(tipoDeDocumento('TI')).toBeNull();
  });
});

describe('lo que no se reconoce es null, nunca «será cédula»', () => {
  it('vacío, nulo o basura', () => {
    for (const t of [null, undefined, '', '   ', 'XYZ', '???']) {
      expect({ t, id: tipoDeDocumento(t) }).toEqual({ t, id: null });
    }
  });

  it('no se supone un tipo por omisión', () => {
    /// Suponer le cambia el documento a una persona, y el
    /// documento es su identidad en todo el sistema: dos
    /// personas distintas acabarían siendo la misma.
    expect(tipoDeDocumento('lo que sea')).toBeNull();
  });
});

describe('las siglas se pueden enumerar para decirlas en un error', () => {
  it('están las que importan', () => {
    const s = siglasAdmitidas();
    for (const q of ['CC', 'CE', 'PPT', 'PEP', 'PASAPORTE']) {
      expect({ q, esta: s.includes(q) }).toEqual({ q, esta: true });
    }
  });
});
