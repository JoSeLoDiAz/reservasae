import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import { ModoPorDefecto, RolAdmin } from '../../generated/prisma';
import { CLAVE_LARGO_MINIMO } from './claves';
import { CLAVES_TOKEN } from './temas';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const correo = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class IniciarSesionDto {
  @IsEmail()
  @Transform(correo)
  correo!: string;

  @IsString()
  @MinLength(1)
  clave!: string;
}

export class CambiarClaveDto {
  @IsString()
  @MinLength(1)
  claveActual!: string;

  @IsString()
  @MinLength(CLAVE_LARGO_MINIMO, {
    message: `La contraseña nueva debe tener al menos ${CLAVE_LARGO_MINIMO} caracteres.`,
  })
  @MaxLength(200)
  claveNueva!: string;
}

export class ActualizarPerfilDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(recortar)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(recortar)
  cargo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(recortar)
  celular?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(recortar)
  organizacion?: string;
}

export class CrearAdminDto {
  @IsEmail()
  @Transform(correo)
  correo!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(recortar)
  nombre!: string;

  @IsEnum(RolAdmin)
  rol!: RolAdmin;
}

export class ActualizarAdminDto {
  @IsOptional()
  @IsEnum(RolAdmin)
  rol?: RolAdmin;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarMarcaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(recortar)
  nombreApp?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(recortar)
  tituloPublico?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  @Transform(recortar)
  subtituloPublico?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  @Transform(recortar)
  piePagina?: string;

  @IsOptional()
  @IsEnum(ModoPorDefecto)
  modoPorDefecto?: ModoPorDefecto;

  @IsOptional()
  @IsBoolean()
  permitirCambioDeModo?: boolean;
}

const HEXADECIMAL = /^#[0-9a-fA-F]{6}$/;

/**
 * Los colores de un esquema, como mapa `clave -> #rrggbb`.
 *
 * La validación es a mano y no con decoradores porque las claves las define el
 * catálogo de `temas.ts`, que crece sin tocar este archivo. Se comprueban las
 * dos cosas: que la clave exista en el catálogo y que el valor sea
 * hexadecimal. Es imprescindible — estos valores acaban dentro de una etiqueta
 * `<style>` en la página pública, así que aceptar texto libre sería dejar que
 * un administrador inyectara CSS arbitrario.
 */
@ValidatorConstraint({ name: 'coloresDeTema' })
export class ColoresDeTema implements ValidatorConstraintInterface {
  private motivo = '';

  validate(valor: unknown): boolean {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
      this.motivo = 'Se esperaba un objeto de colores.';
      return false;
    }

    for (const [clave, color] of Object.entries(valor as Record<string, unknown>)) {
      if (!CLAVES_TOKEN.has(clave)) {
        this.motivo = `"${clave}" no es un color configurable.`;
        return false;
      }
      if (typeof color !== 'string' || !HEXADECIMAL.test(color)) {
        this.motivo = `El color "${clave}" debe ser hexadecimal de 6 dígitos, como #1d4ed8.`;
        return false;
      }
    }
    return true;
  }

  defaultMessage(): string {
    return this.motivo;
  }
}

export class ActualizarTemaDto {
  @Validate(ColoresDeTema)
  colores!: Record<string, string>;
}

export class PublicarAccionDto {
  @IsBoolean()
  visible!: boolean;
}

/** Genera las dos paletas a partir de un color. */
export class DerivarTemaDto {
  @Matches(HEXADECIMAL, { message: 'El color debe ser hexadecimal de 6 dígitos, como #1d4ed8.' })
  principal!: string;

  @IsOptional()
  @IsBoolean()
  encabezadoDeColor?: boolean;
}
