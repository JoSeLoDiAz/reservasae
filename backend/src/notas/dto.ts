/** Lo que llega del panel al configurar el catálogo de notas. */

import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ResultadoGestion } from '../../generated/prisma';

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
  @MinLength(3, { message: 'El nombre debe tener al menos 3 letras.' })
  @MaxLength(80)
  nombre!: string;

  /// Opcional: sin él va al final. Quien configura no debería tener
  /// que calcular un número para añadir una categoría.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  orden?: number;

  /// QUE SIGNIFICA esta categoria: CONTACTO / SIN_RESPUESTA /
  /// DATO_MALO, o nada.
  ///
  /// Puesto el 30 sep 2026 porque al anotar se preguntaba lo mismo
  /// dos veces --«Como salio» y «Clasificacion» eran la misma
  /// pregunta-- y se quito «Como salio». El resultado de la nota
  /// lo deriva ahora el servidor de la categoria elegida, asi que es
  /// AQUI, al configurar el catalogo, donde se decide una sola vez
  /// que significa cada opcion.
  ///
  /// El nulo es un valor valido y distinto de «no vino»: es «esta
  /// categoria no significa ningun resultado», y sus notas quedan
  /// sin resultado --lo mismo que ya les pasa a las notas de antes
  /// del catalogo--. @IsOptional() deja pasar el nulo, que es
  /// justo lo que hace falta.
  @IsOptional()
  @IsEnum(ResultadoGestion)
  resultado?: ResultadoGestion | null;
}

export class ActualizarCategoriaDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 letras.' })
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

  /// QUE SIGNIFICA esta categoria: CONTACTO / SIN_RESPUESTA /
  /// DATO_MALO, o nada.
  ///
  /// Puesto el 30 sep 2026 porque al anotar se preguntaba lo mismo
  /// dos veces --«Como salio» y «Clasificacion» eran la misma
  /// pregunta-- y se quito «Como salio». El resultado de la nota
  /// lo deriva ahora el servidor de la categoria elegida, asi que es
  /// AQUI, al configurar el catalogo, donde se decide una sola vez
  /// que significa cada opcion.
  ///
  /// El nulo es un valor valido y distinto de «no vino»: es «esta
  /// categoria no significa ningun resultado», y sus notas quedan
  /// sin resultado --lo mismo que ya les pasa a las notas de antes
  /// del catalogo--. @IsOptional() deja pasar el nulo, que es
  /// justo lo que hace falta.
  @IsOptional()
  @IsEnum(ResultadoGestion)
  resultado?: ResultadoGestion | null;
}

export class CrearSubcategoriaDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 letras.' })
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
  @MinLength(2, { message: 'El nombre debe tener al menos 2 letras.' })
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
