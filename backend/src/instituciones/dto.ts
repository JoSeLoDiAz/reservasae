/** Lo que se puede editar a mano de una institución. */

import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ClasificacionEmpresa, TamanoEmpresa } from '../../generated/prisma';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/// "" del formulario vale como "no lo puso".
const aTexto = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : recortar({ value });

const aNumero = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined
    ? undefined
    : Number(value);

/**
 * Lo que un humano corrige de una ficha.
 *
 * Todo lo que entre por aquí queda con fuente HUMANO: es lo
 * que distingue un dato que alguien miró de uno que trajo un
 * robot y nadie ha revisado.
 */
export class EditarInstitucionDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  razonSocial?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(200)
  nombreComercial?: string;

  @IsOptional() @IsISO8601() fechaFundacion?: string;

  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(300)
  direccion?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(60) telefono?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(160) correo?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(200)
  paginaWeb?: string;

  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(120)
  ciudadNombre?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(120)
  departamentoNombre?: string;
  @IsOptional() @Transform(aNumero) @IsInt() departamentoSepId?: number;
  @IsOptional() @Transform(aNumero) @IsInt() municipioSepId?: number;

  @IsOptional() @IsEnum(TamanoEmpresa) tamano?: TamanoEmpresa;

  /// Un número, no un rango. El tope es alto a propósito:
  /// hay entidades territoriales con decenas de miles.
  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  @Min(1)
  @Max(2_000_000)
  numeroEmpleados?: number;

  @IsOptional()
  @IsEnum(ClasificacionEmpresa)
  clasificacion?: ClasificacionEmpresa;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(120)
  sectorEconomico?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(10)
  codigoCiiu?: string;
}

/** Qué campos de una propuesta deja entrar el asesor. */
export class AplicarPropuestaDto {
  /// Vacío significa descartarla entera.
  @IsArray()
  @IsString({ each: true })
  campos!: string[];
}
