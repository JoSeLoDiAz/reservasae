import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import type { EtapaParticipante } from '../../../generated/prisma';
import { TODAS_LAS_ETAPAS } from './etapas-de-plantilla';

/// Las etapas en las que se puede escribir a alguien. Las de
/// salida -- PERDIDO, RETIRADO, DESERTO, ABANDONO -- no
/// entran: a quien se fue no se le manda una campana, se le
/// llama.
/// La lista vive en un solo sitio. Estaba copiada aqui y en
/// el DTO de al lado, las dos recortadas a las seis etapas
/// «buenas», y eso impedia escribirle a quien NO quedo
/// inscrito -- que es a quien mas falta le hace un correo.
const ETAPAS = [...TODAS_LAS_ETAPAS] as string[];

export class CrearPlantillaDto {
  @IsString() @Length(2, 80) nombre!: string;
  @IsString() @Length(2, 200) asunto!: string;
  @IsString() @Length(2, 8000) cuerpo!: string;
  /// Null o ausente: sirve para todos los gremios.
  @IsOptional() @IsString() convenioId?: string | null;

  /// Vacio o ausente: sirve en cualquier etapa.
  @IsOptional()
  @IsArray()
  @IsIn(ETAPAS, { each: true })
  etapasPermitidas?: EtapaParticipante[];
}

export class EditarPlantillaDto {
  @IsOptional() @IsString() @Length(2, 80) nombre?: string;
  @IsOptional() @IsString() @Length(2, 200) asunto?: string;
  @IsOptional() @IsString() @MaxLength(8000) cuerpo?: string;
  @IsOptional() @IsString() convenioId?: string | null;
  @IsOptional() @IsBoolean() activa?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(ETAPAS, { each: true })
  etapasPermitidas?: EtapaParticipante[];
}
