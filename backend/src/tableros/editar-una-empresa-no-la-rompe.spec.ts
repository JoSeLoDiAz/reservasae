/** Editar una organización desde tableros no la deja inservible para el SENA. */

/**
 * DOS PUERTAS AL MISMO DATO Y SOLO UNA COMPROBABA.
 *
 * `PATCH /admin/tableros/empresas/:id` hacía `data: { ...dto }` tal
 * cual. La puerta gemela del CRM ya validaba las tres cosas de abajo,
 * con sus comentarios escritos; esta no.
 *
 * Y los tres fallos tienen la misma forma: NO REVIENTAN AQUÍ. La fila
 * se guarda, el panel la da por completa, y lo que falla es el cargue
 * al SENA, que es donde ya no se puede arreglar a tiempo.
 *
 *   - EL DÍGITO DE VERIFICACIÓN no se teclea: es una función del NIT.
 *     Al corregir el NIT, la fila se quedaba con el DV del viejo, y
 *     ese par viaja junto a los tres formatos.
 *   - EL TAMAÑO DE EMPRESA se validaba con `@IsInt()`, que acepta
 *     cualquier entero. Un 99 pasaba, `faltaEnF7` lo daba por relleno
 *     ---solo mira que no sea nulo--- y la columna salía VACÍA con la
 *     fila dada por completa.
 *   - EL MUNICIPIO Y SU DEPARTAMENTO: el F7 los resuelve por separado,
 *     así que uno de otro departamento sale con los dos valores
 *     puestos y la pareja imposible.
 */

import { BadRequestException } from '@nestjs/common';

import { TAMANO_EMPRESA_POR_ID, municipioCuadra } from '../crm/catalogos-sep';
import { calcularDigitoVerificacion } from '../comun/nit';

const leer = () =>
  require('fs').readFileSync(
    require('path').join(__dirname, 'tableros.service.ts'),
    'utf8',
  ) as string;

/// El cuerpo de `editarEmpresa`, que es donde tiene que estar todo.
const editarEmpresa = () => {
  const t = leer();
  const i = t.indexOf('async editarEmpresa');
  expect(i).toBeGreaterThan(-1);
  return t.slice(i, t.indexOf('\n  async ', i + 10));
};

describe('el dígito de verificación se deriva, no se arrastra', () => {
  /**
   * EL CASO. `9001234567` y `900123456` son NITs distintos y sus
   * dígitos no tienen por qué coincidir: arrastrar el viejo manda al
   * SENA una pareja que no existe.
   */
  it('dos NITs distintos no comparten dígito', () => {
    expect(calcularDigitoVerificacion('900123456')).not.toBe(
      calcularDigitoVerificacion('900421154'),
    );
  });

  it('al cambiar el NIT sin mandar DV, se recalcula', () => {
    const cuerpo = editarEmpresa();
    expect(cuerpo).toContain('calcularDigitoVerificacion(dto.nit!)');
    /// Y solo entonces: si quien edita manda un DV explícito puede
    /// estar corrigiendo justo eso, y se respeta.
    expect(cuerpo).toContain('dto.digitoVerificacion === undefined');
  });
});

describe('los ids del SEP, contra su catálogo', () => {
  /// El 99 no existe y por eso salía la celda vacía.
  it('el tamaño 99 no está en el catálogo', () => {
    expect(TAMANO_EMPRESA_POR_ID.has(99)).toBe(false);
  });

  it('la puerta lo rechaza', () => {
    expect(editarEmpresa()).toContain('TAMANO_EMPRESA_POR_ID.has');
  });

  it('y el sector se comprueba contra la lista, no es texto libre', () => {
    expect(editarEmpresa()).toContain('SECTORES_ECONOMICOS.some');
  });
});

describe('el municipio es de su departamento', () => {
  it('la regla ya existía y dice que no cuadran', () => {
    /// Bogotá (11) y un municipio de Antioquia: no cuadran.
    expect(municipioCuadra(11, 5001)).toBe(false);
    /// Y el municipio de su propio departamento, sí.
    expect(municipioCuadra(5, 5001)).toBe(true);
  });

  /**
   * CONTRA LO QUE VA A QUEDAR, NO CONTRA LO QUE VIENE. Se puede
   * cambiar solo el municipio y que el departamento siga siendo el
   * guardado: comprobar únicamente el `dto` dejaría pasar justo ese
   * caso, que es el más probable de todos.
   */
  it('se comprueba sobre el resultado, no sobre el dto', () => {
    const cuerpo = editarEmpresa();
    expect(cuerpo).toContain(
      'municipioCuadra(departamentoFinal, municipioFinal)',
    );
    expect(cuerpo).toContain('antes.departamentoSepId');
    expect(cuerpo).toContain('antes.municipioSepId');
  });

  it('y para eso la lectura previa los trae', () => {
    const cuerpo = editarEmpresa();
    const i = cuerpo.indexOf('select: {');
    expect(cuerpo.slice(i, i + 220)).toContain('municipioSepId: true');
  });
});

describe('se avisa, no se rompe', () => {
  /// Los tres rechazos son `BadRequestException` con un motivo en
  /// castellano: quien edita tiene que saber qué corregir, no leer un
  /// 500. Y el nombre del tipo se comprueba para que nadie lo cambie
  /// por un throw pelado.
  it('los tres rechazos explican qué pasa', () => {
    const cuerpo = editarEmpresa();
    expect(cuerpo).toContain('no está en el catálogo del SEP');
    expect(cuerpo).toContain('no es un sector económico');
    expect(cuerpo).toContain('no es de ese departamento');
    expect(new BadRequestException('x')).toBeInstanceOf(BadRequestException);
  });
});

/**
 * Y CANCELAR UNA RESERVA PIDE ESCRIBIR, NO VER.
 *
 * Cancelar devuelve los cupos a la oferta, cambia el estado y puede
 * desatar la lista de espera. Pedía `reserva · VER` ---el mismo nivel
 * que abrir la pantalla--- mientras su gemela de al lado,
 * `reservas/:id/estado`, que hace menos, ya pedía `ESCRIBIR`.
 *
 * No era acceso cruzado: el ámbito ya recortaba el gremio. Era nivel
 * insuficiente, y lo tapaba que en la práctica los superadmin tienen
 * concesiones de líder.
 */
describe('cancelar una reserva es escribir', () => {
  const controlador = () =>
    require('fs').readFileSync(
      require('path').join(__dirname, 'tableros.controller.ts'),
      'utf8',
    ) as string;

  it('la ruta de cancelar exige ESCRIBIR', () => {
    const t = controlador();
    const i = t.indexOf("@Post('reservas/:id/cancelar')");
    expect(i).toBeGreaterThan(-1);
    /// Los decoradores van ENCIMA del método, así que se mira el
    /// trozo entre la ruta y el nombre de la función.
    const decoradores = t.slice(i, t.indexOf('cancelarReserva(', i));
    expect(decoradores).toContain("@Requiere('reserva', 'ESCRIBIR')");
    expect(decoradores).not.toContain("@Requiere('reserva', 'VER')");
  });

  /// Y la gemela sigue como estaba: es la referencia de lo correcto.
  it('y su gemela de estado sigue exigiéndolo', () => {
    const t = controlador();
    const i = t.indexOf("@Post('reservas/:id/estado')");
    const decoradores = t.slice(i, t.indexOf('cambiarEstadoReserva(', i));
    expect(decoradores).toContain("@Requiere('reserva', 'ESCRIBIR')");
  });
});
