import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/// El resumen de una conversacion de Lucy.
export class NotaDeLucyDto {
  /// Su id de conversacion. Con el origen forma la llave que
  /// impide que un reintento deje la nota dos veces.
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externoId!: string;

  /// Con +57 o sin el: se normaliza al entrar.
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  telefono!: string;

  /// Lo que la persona hablo con Lucy. Es lo que se lee.
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  resumen!: string;

  @IsOptional()
  @Transform(recortar)
  @IsIn(['adecopria', 'britcham-adee'])
  convenio?: string;

  @IsOptional()
  @IsISO8601()
  ocurridoEn?: string;

  /// El cuerpo de ellos, entero. Se guarda para poder demostrar
  /// que llego y para depurar, como `LeadEntrante.carga`.
  @IsOptional()
  @IsObject()
  carga?: Record<string, unknown>;
}
