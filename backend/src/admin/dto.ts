import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import { ModoPorDefecto, RolAdmin, RolConvenio } from '../../generated/prisma';
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

/** A qué convenio entra y con qué rol. */
export class ConcesionDto {
  @IsString()
  @IsNotEmpty()
  convenioId!: string;

  @IsEnum(RolConvenio)
  rol!: RolConvenio;
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

  // sin una sola concesion la cuenta no ve nada: se
  // exige al crearla, no despues
  @IsArray()
  @ArrayMinSize(1, { message: 'Indique al menos un convenio y su rol.' })
  @ValidateNested({ each: true })
  @Type(() => ConcesionDto)
  concesiones!: ConcesionDto[];
}

export class ActualizarAdminDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConcesionDto)
  concesiones?: ConcesionDto[];

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
  mensajeEncabezado?: string;

  @IsOptional() @IsString() @MaxLength(400)
  piePagina?: string;

  @IsOptional()
  @IsEnum(ModoPorDefecto)
  modoPorDefecto?: ModoPorDefecto;

  @IsOptional()
  @IsBoolean()
  permitirCambioDeModo?: boolean;
}

const HEXADECIMAL = /^#[0-9a-fA-F]{6}$/;

/** Los colores de un esquema: `clave -> #rrggbb`. */
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

/** Renombrar un logo o moverlo dentro del banner. */
export class ActualizarLogoDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(recortar)
  etiqueta?: string;

  @IsOptional()
  @IsEnum(['IZQUIERDA', 'DERECHA'])
  direccion?: 'IZQUIERDA' | 'DERECHA';
}

/** Genera las dos paletas a partir de un color. */
export class DerivarTemaDto {
  @Matches(HEXADECIMAL, { message: 'El color debe ser hexadecimal de 6 dígitos, como #1d4ed8.' })
  principal!: string;

  @IsOptional()
  @IsBoolean()
  encabezadoDeColor?: boolean;
}

/** De qué formulario sale la marca de un gremio. */
export class MarcaDeGremioDto {
  // null lo devuelve a la marca general
  @IsOptional()
  @IsString()
  formularioId?: string | null;
}
