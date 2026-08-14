import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { DestinatarioPolitica } from '../../generated/prisma';

export class CrearPoliticaDto {
  @IsString()
  @IsNotEmpty()
  convenioId!: string;

  @IsEnum(DestinatarioPolitica)
  destinatario!: DestinatarioPolitica;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo!: string;

  // un texto legal de una linea no es un texto legal
  @IsString()
  @MinLength(50)
  @MaxLength(50_000)
  contenido!: string;
}

export class ActualizarPoliticaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MinLength(50)
  @MaxLength(50_000)
  contenido?: string;
}
