import {
  CLASE_POR_CAMPO,
  enPalabras,
  seGuardaElValor,
  seHistoria,
} from './clase-de-dato';

/// Esto ES la política de privacidad del histórico. Si una de
/// estas pruebas se cae, lo que se rompió es la regla que
/// decide qué dato personal se copia a una segunda tabla.

describe('lo que NUNCA se guarda', () => {
  it('la caracterización de población vulnerable', () => {
    // artículo 5 de la Ley 1581. Que alguien fue víctima del
    // conflicto y lo desmarcó no puede quedar escrito en otra
    // tabla: en Colombia eso pone a una persona en riesgo
    expect(seGuardaElValor('caracterizaciones')).toBe(false);
    expect(seGuardaElValor('caracterizacionRechazada')).toBe(false);
  });

  it('pero SÍ queda constancia de que cambió', () => {
    // se guarda la fila sin el valor: el cambio se ve, el dato
    // no. Si tampoco se historiara, desmarcar sería invisible
    expect(seHistoria('caracterizaciones')).toBe(true);
  });

  it('el documento no se historia: no se edita por esa puerta', () => {
    expect(seHistoria('numeroDocumento')).toBe(false);
    expect(seHistoria('tipoDocumentoSepId')).toBe(false);
  });
});

describe('lo que sí se guarda, y por qué', () => {
  it('los nombres, aunque sean datos personales', () => {
    // corregir «Perez → Pérez» y sustituirle la identidad a un
    // lead se ven IDÉNTICOS en una lista de nombres de campo.
    // Sin el valor de antes, el histórico deja pasar justo el
    // fraude para el que existe
    expect(seGuardaElValor('primerApellido')).toBe(true);
  });

  it('el contacto, para poder deshacer', () => {
    expect(seGuardaElValor('correo')).toBe(true);
    expect(seGuardaElValor('celular')).toBe(true);
  });

  it('lo de la formación', () => {
    expect(seGuardaElValor('nivelOcupacionalSepId')).toBe(true);
  });
});

describe('la lista falla CERRADA', () => {
  it('un campo que no está no se historia', () => {
    // a propósito: un campo nuevo no empieza a guardar valores
    // viejos solo porque alguien lo añadió al formulario
    expect(seHistoria('campoQueAlguienInvento')).toBe(false);
    expect(seGuardaElValor('campoQueAlguienInvento')).toBe(false);
  });
});

describe('los nombres que ve una persona', () => {
  it('no salen en jerga de base de datos', () => {
    expect(enPalabras('nivelOcupacionalSepId')).toBe('Nivel ocupacional');
    expect(enPalabras('departamentoSepId')).toBe('Departamento');
  });

  it('TODOS los campos historiados tienen su nombre', () => {
    // si falta uno, la pantalla diría «beneficiarioPrevio
    // cambió» y nadie lo lee
    for (const campo of Object.keys(CLASE_POR_CAMPO)) {
      expect(enPalabras(campo)).not.toBe(campo);
    }
  });
});
