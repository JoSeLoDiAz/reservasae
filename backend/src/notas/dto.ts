/** Lo que llega del panel al configurar el catálogo de notas. */

import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/// Se recorta antes de validar, no después.
///
/// Un nombre con un espacio al final pasa el `@IsNotEmpty` y rompe
/// el `@unique`: «No contactado » y «No contactado» serían dos
/// categorías distintas en el desplegable y el informe contaría la
/// mitad en cada una. Es el mismo recorte que hace el DTO de la
/// nota, con la misma forma.
const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CrearCategoriaDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(80)
  nombre!: string;

  /// Opcional: sin él va al final. Quien configura no debería tener
  /// que calcular un número para añadir una categoría.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  orden?: number;
}

export class ActualizarCategoriaDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  orden?: number;

  /// `true` la oculta, `false` la vuelve a ofrecer. NO HAY BORRAR:
  /// en este CRM nada se borra, y aquí menos, porque hay notas
  /// viejas que nombran esta fila.
  @IsOptional()
  @IsBoolean()
  oculta?: boolean;
}

export class CrearSubcategoriaDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  orden?: number;
}

export class ActualizarSubcategoriaDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  oculta?: boolean;
}
