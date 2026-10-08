/** El NIT/RUT y el papel en el convenio se corrigen, pero solo con valores del F7. */

/**
 * El servidor ya aceptaba los dos campos y el formulario de corregir
 * la organización no los tenía (pendiente 6, 7 oct 2026). Al ponerlos
 * en pantalla, la puerta deja de aceptar cualquier cosa: el papel es
 * una de las tres palabras de la cabecera del F7 y el tipo de
 * documento tiene que ser de organización.
 */

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { TIPO_DOCUMENTO_POR_ID } from '../crm/catalogos-sep';
import {
  EditarEmpresaDto,
  PAPELES_EN_EL_CONVENIO,
} from './editar-empresa.dto';

const errores = (cuerpo: Record<string, unknown>) =>
  validateSync(plainToInstance(EditarEmpresaDto, cuerpo)).map(
    (e) => e.property,
  );

describe('el papel en el convenio', () => {
  it.each(PAPELES_EN_EL_CONVENIO)('acepta «%s»', (papel) => {
    expect(errores({ papelEnConvenio: papel })).toEqual([]);
  });

  it('rechaza uno inventado', () => {
    expect(errores({ papelEnConvenio: 'Aliada' })).toContain(
      'papelEnConvenio',
    );
  });

  /// En blanco es «sin definir», que también es un valor válido.
  it('en blanco se borra, no falla', () => {
    expect(errores({ papelEnConvenio: '' })).toEqual([]);
  });

  /// Las tres son las de la cabecera del F7, letra por letra.
  it('son las mismas que dice el F7', () => {
    const f7 = require('fs').readFileSync(
      require('path').join(__dirname, '../crm/sep/formato-f7.ts'),
      'utf8',
    ) as string;
    expect(f7).toContain(
      '(Conviniente/Beneficiaria/Perteneciente a la Cadena Productiva',
    );
  });
});

describe('el tipo de documento es de organización', () => {
  it('NIT y RUT lo son', () => {
    expect(TIPO_DOCUMENTO_POR_ID.get(6)?.empresa).toBe(true);
    expect(TIPO_DOCUMENTO_POR_ID.get(21)?.empresa).toBe(true);
  });

  it('una cédula no', () => {
    expect(TIPO_DOCUMENTO_POR_ID.get(1)?.empresa).toBe(false);
  });

  it('y la puerta lo comprueba', () => {
    const t = require('fs').readFileSync(
      require('path').join(__dirname, 'tableros.service.ts'),
      'utf8',
    ) as string;
    const i = t.indexOf('async editarEmpresa');
    const cuerpo = t.slice(i, t.indexOf('\n  async ', i + 10));
    expect(cuerpo).toContain(
      'TIPO_DOCUMENTO_POR_ID.get(dto.tipoDocumentoSepId)?.empresa',
    );
  });
});
