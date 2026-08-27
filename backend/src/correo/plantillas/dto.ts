import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CrearPlantillaDto {
  @IsString() @Length(2, 80) nombre!: string;
  @IsString() @Length(2, 200) asunto!: string;
  @IsString() @Length(2, 8000) cuerpo!: string;
  /// Null o ausente: sirve para todos los gremios.
  @IsOptional() @IsString() convenioId?: string | null;
}

export class EditarPlantillaDto {
  @IsOptional() @IsString() @Length(2, 80) nombre?: string;
  @IsOptional() @IsString() @Length(2, 200) asunto?: string;
  @IsOptional() @IsString() @MaxLength(8000) cuerpo?: string;
  @IsOptional() @IsString() convenioId?: string | null;
  @IsOptional() @IsBoolean() activa?: boolean;
}
