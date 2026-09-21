import { Transform, Type } from 'class-transformer';
import { aCelularGuardable } from '../../comun/celular';
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
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { RespuestaDto } from '../../formularios/dto';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/// Vacío es «no lo mandé»: el celular es opcional y una
/// cadena vacía no puede morir contra el patrón.
const aCelular = ({ value }: { value: unknown }) => {
  const limpio = aCelularGuardable(value);
  return limpio === '' ? undefined : limpio;
};

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

  /// Diez dígitos y nada más. Sin esto entraban de once y de
  /// doce --pasó en producción-- y ese número no sirve ni para
  /// llamar ni para el reporte. Se normaliza como en las
  /// fichas: el +57 se quita y quedan los diez.
  @IsOptional()
  @Transform(aCelular)
  @IsString()
  @Matches(/^3\d{9}$/, {
    message: 'El celular debe tener diez dígitos y empezar por 3.',
  })
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
