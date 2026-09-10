import { Transform, Type } from 'class-transformer';
import { booleanoDeVerdad } from '../../comun/booleano-de-verdad';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { RespuestaDto } from '../../formularios/dto';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearReservaDto {
  @IsString()
  @MinLength(1)
  ofertaId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  @Transform(recortar)
  nit!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(recortar)
  razonSocial!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  numeroColaboradores?: number;

  /** Gremio; lo define el formulario. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(recortar)
  redAsociada?: string;

  /** Cuál gremio, cuando `redAsociada` es "Otro". */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(recortar)
  redAsociadaOtra?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(recortar)
  contactoNombre!: string;

  @IsEmail()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  contactoCorreo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(recortar)
  contactoCelular?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(recortar)
  contactoCargo?: string;

  // el tope real lo pone la oferta
  @IsInt()
  @Min(1)
  @Max(500)
  cuposSolicitados!: number;

  // sin consentimiento no hay registro
  /// El valor CRUDO, igual que en `leads/dto.ts`.
  ///
  /// `enableImplicitConversion` convierte un `boolean` con la
  /// regla de JavaScript: cualquier cadena no vacia es `true`, y
  /// «false» llegaba como TRUE. Aqui es una constancia de que la
  /// persona acepto la politica, y guardarla al reves le estampa
  /// una autorizacion que NO dio.
  ///
  /// Este endpoint es PUBLICO: quien lo llama no es una pantalla
  /// nuestra, asi que el tipo del JSON no se puede dar por bueno.
  @Transform(({ obj, key }) => booleanoDeVerdad((obj as Record<string, unknown>)[key]))
  @IsBoolean()
  @Equals(true, { message: 'Debe aceptar los términos de participación.' })
  aceptaTerminos!: boolean;

  /// El valor CRUDO, igual que en `leads/dto.ts`.
  ///
  /// `enableImplicitConversion` convierte un `boolean` con la
  /// regla de JavaScript: cualquier cadena no vacia es `true`, y
  /// «false» llegaba como TRUE. Aqui es una constancia de que la
  /// persona acepto la politica, y guardarla al reves le estampa
  /// una autorizacion que NO dio.
  ///
  /// Este endpoint es PUBLICO: quien lo llama no es una pantalla
  /// nuestra, asi que el tipo del JSON no se puede dar por bueno.
  @Transform(({ obj, key }) => booleanoDeVerdad((obj as Record<string, unknown>)[key]))
  @IsBoolean()
  @Equals(true, { message: 'Debe aceptar la política de tratamiento de datos.' })
  aceptaPoliticaDatos!: boolean;

  /** Formulario del que salió el envío. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(recortar)
  formularioSlug?: string;

  /** Respuestas a las preguntas propias. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RespuestaDto)
  respuestas?: RespuestaDto[];
}
