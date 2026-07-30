import { Transform, Type } from 'class-transformer';
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

  /** BRITCHAM / ADEE / Ambos / Otro / Ninguno. Lo define el formulario. */
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

  // El tope real lo pone la oferta; este solo evita que alguien escriba 99999
  // y genere una lista de espera absurda.
  @IsInt()
  @Min(1)
  @Max(500)
  cuposSolicitados!: number;

  // `Equals(true)` y no `IsBoolean`: si no acepta, no hay reserva. Dejarlo
  // pasar como `false` guardaría un registro sin consentimiento, que es
  // justamente lo que la Ley 1581 no permite.
  @IsBoolean()
  @Equals(true, { message: 'Debe aceptar los términos de participación.' })
  aceptaTerminos!: boolean;

  @IsBoolean()
  @Equals(true, { message: 'Debe aceptar la política de tratamiento de datos.' })
  aceptaPoliticaDatos!: boolean;

  /**
   * Formulario del que salió el envío. Solo hace falta si el formulario tiene
   * preguntas propias además de los campos del sistema.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(recortar)
  formularioSlug?: string;

  /** Respuestas a las preguntas que NO son campos del sistema. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RespuestaDto)
  respuestas?: RespuestaDto[];
}
