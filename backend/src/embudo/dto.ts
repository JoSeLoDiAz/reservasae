/** Lo que manda el navegador al marcar un paso. */

import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { DEL_NAVEGADOR } from './escalera';

/// CHARSET, no lista de valores -- y la diferencia importa.
/// Corta un correo, una comilla y cualquier CSS, pero una
/// cedula, un nombre y un celular PASAN: son letras y digitos.
/// La lista cerrada de verdad esta en `paso`, ahi al lado.
/// Cerrar tambien esta es trabajo aparte: hoy ELIGIO_UBICACION
/// manda el NOMBRE del departamento, asi que una gramatica
/// estrecha tumbaria ese peldano -- y con
/// `forbidNonWhitelisted` lo tumbaria EN SILENCIO, porque
/// `marcar()` no lee la respuesta.
const LIMPIO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ._\-:]*$/;

const recorta = (n: number) =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().slice(0, n) : value,
  );

export class MarcarPasoDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  visita!: string;

  @IsIn(DEL_NAVEGADOR)
  paso!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  version?: number;

  /// Hasta seis horas. Un número absurdo no dice nada.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(21_600_000)
  ms?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(LIMPIO)
  @recorta(60)
  detalle?: string;

  // de aquí abajo, solo viaja con LLEGO

  @IsOptional()
  @IsIn(['SUBDOMINIO', 'RUTA', 'CRUZADA'])
  puerta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(LIMPIO)
  @recorta(60)
  utmFuente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(LIMPIO)
  @recorta(60)
  utmCampana?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(LIMPIO)
  @recorta(60)
  utmContenido?: string;

  /// El bit, nunca el valor: `fbclid` identifica un clic
  /// concreto y se puede volver a unir a una persona.
  @IsOptional()
  @IsBoolean()
  huboFbclid?: boolean;

  /// Solo el host. Una ruta lleva su propia consulta dentro.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9.\-:]*$/)
  @recorta(80)
  referente?: string;

  @IsOptional()
  @IsIn(['MOVIL', 'TABLET', 'ESCRITORIO'])
  ancho?: string;

  /// `APP_META` sigue admitiendose: es lo que mandaron las
  /// visitas de antes del 14 sep 2026 y sus filas ya estan.
  @IsOptional()
  @IsIn(['APP_INSTAGRAM', 'APP_FACEBOOK', 'APP_META', 'OTRO'])
  navegador?: string;
}
