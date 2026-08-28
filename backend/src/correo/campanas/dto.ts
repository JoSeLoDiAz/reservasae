import { Type } from 'class-transformer';

import type { EtapaParticipante } from '../../../generated/prisma';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

const ETAPAS = [
  'INTERESADO',
  'CONTACTADO',
  'DATOS_COMPLETOS',
  'INSCRITO',
  'EN_FORMACION',
  'CERTIFICADO',
];

export class SegmentoDto {
  /// Tipada con el enum de la base y validada contra la
  /// misma lista: si manana se agrega una etapa, el tipo lo
  /// exige y la validacion se cae hasta que se agregue aqui.
  @IsOptional()
  @IsArray()
  @IsIn(ETAPAS, { each: true })
  etapas?: EtapaParticipante[];
  @IsOptional() @IsString() accionFormacionId?: string | null;
  @IsOptional() @IsString() coberturaId?: string | null;
  @IsOptional() @IsBoolean() soloDatosIncompletos?: boolean;
  @IsOptional() @IsBoolean() soloConGrupo?: boolean;
  @IsOptional() @IsBoolean() soloSinAsesor?: boolean;
}

export class CrearCampanaDto {
  @IsString() convenioId!: string;
  @IsString() @Length(2, 80) nombre!: string;
  @IsString() @Length(2, 200) asunto!: string;
  @IsString() @Length(2, 8000) cuerpo!: string;

  /// De donde salen los destinatarios. Por defecto, de la
  /// base: es lo que habia antes de que existiera el cargue y
  /// lo que se hace casi siempre.
  @IsOptional() @IsIn(['SEGMENTO', 'CARGUE']) origen?: 'SEGMENTO' | 'CARGUE';

  /// Con origen CARGUE no se usa, pero se sigue exigiendo:
  /// el segmento no estorba y quitarlo obligaria a que la
  /// columna aceptara nulos por una razon que no es suya.
  @ValidateNested()
  @Type(() => SegmentoDto)
  segmento!: SegmentoDto;
}

export class EditarCampanaDto {
  @IsOptional() @IsString() @Length(2, 80) nombre?: string;
  @IsOptional() @IsString() @Length(2, 200) asunto?: string;
  @IsOptional() @IsString() @Length(2, 8000) cuerpo?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentoDto)
  segmento?: SegmentoDto;
}
