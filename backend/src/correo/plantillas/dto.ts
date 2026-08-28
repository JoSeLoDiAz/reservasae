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

/// Las etapas en las que se puede escribir a alguien. Las de
/// salida -- PERDIDO, RETIRADO, DESERTO, ABANDONO -- no
/// entran: a quien se fue no se le manda una campana, se le
/// llama.
const ETAPAS = [
  'INTERESADO',
  'CONTACTADO',
  'DATOS_COMPLETOS',
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
];

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
