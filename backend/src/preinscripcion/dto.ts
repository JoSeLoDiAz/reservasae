import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/// "" del formulario vale como "no lo puso".
const aNumero = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined
    ? undefined
    : Number(value);

const aTexto = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : recortar({ value });

/** Lo mínimo para quedar registrado. */
export class CrearPreinscripcionDto {
  @IsString()
  @IsNotEmpty()
  ofertaId!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  tipoDocumentoSepId!: number;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  numeroDocumento!: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  primerNombre!: string;

  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(60)
  segundoNombre?: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  primerApellido!: string;

  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(60)
  segundoApellido?: string;

  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  generoSepId?: number;

  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(30)
  celular?: string;

  @IsOptional()
  @Transform(aTexto)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  correo?: string;

  /// Lo que escribio si eligio "Otro". No viaja al SEP:
  /// su catalogo de genero solo admite tres valores.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  generoOtroTexto?: string;

  /// El domicilio que eligio para ver la cobertura. Es el
  /// mismo dato que el SEP pide, asi que se guarda aqui y
  /// deja de pedirse en el formulario largo.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  departamentoNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudadNombre?: string;

  /// Aceptar la politica de datos. Sin esto no hay con que
  /// responder si manana preguntan de donde salieron sus
  /// datos, asi que la pantalla no deja pasar sin marcarlo.
  @IsOptional() @IsBoolean() aceptaPolitica?: boolean;
}

/** El resto de sus datos, todos opcionales. */
export class DatosPersonaDto {
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(60)
  primerNombre?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(60)
  segundoNombre?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(60)
  primerApellido?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(60)
  segundoApellido?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(30) celular?: string;

  @IsOptional()
  @Transform(aTexto)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  correo?: string;

  @IsOptional() @Transform(aNumero) @IsInt() generoSepId?: number;
  @IsOptional() @Transform(aTexto) @IsISO8601() fechaNacimiento?: string;

  @IsOptional() @Transform(aNumero) @IsInt() @Min(1) @Max(6) estrato?: number;

  @IsOptional() @Transform(aNumero) @IsInt() departamentoSepId?: number;
  @IsOptional() @Transform(aNumero) @IsInt() municipioSepId?: number;

  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(120) barrio?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(200)
  direccion?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(120)
  nivelEducativo?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(120)
  cargoEnEmpresa?: string;
  @IsOptional() @Transform(aNumero) @IsInt() nivelOcupacionalSepId?: number;

  /** Sin esto la fila no entra en el reporte. */
  @IsOptional() @IsBoolean() beneficiarioPrevio?: boolean;

  /** Aceptar la politica: es lo que hay que demostrar. */
  @IsOptional() @IsBoolean() aceptaPolitica?: boolean;

  /**
   * Poblacion vulnerable, del catalogo del SEP.
   *
   * Es una lista: una misma persona puede ser mujer cabeza de
   * familia Y desplazada. El F7 lleva una sola, pero guardar
   * solo una obligaria a elegir por ella.
   *
   * Vacio no es lo mismo que no contestado: para eso esta
   * caracterizacionRechazada. Un dato sensible que nadie
   * pregunto y uno que la persona prefirio no dar son cosas
   * distintas, y solo el segundo se puede defender.
   */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  caracterizaciones?: number[];

  /** La persona prefiere no decirlo. */
  @IsOptional() @IsBoolean() caracterizacionRechazada?: boolean;
}

/** Lo que el F7 pide de la organización. */
export class DatosEmpresaDto {
  /// El independiente que usa su cedula como RUT.
  ///
  /// Sin esto, lo que mande -- su sector, por ejemplo -- no
  /// tiene donde caer: no hay NIT que buscar y la rama se
  /// quedaba sin `else`, asi que el dato se descartaba en
  /// silencio. Con esto, la persona es su propia unidad
  /// economica, que es como el F7 la reporta.
  @IsOptional() @IsBoolean() rutPropio?: boolean;

  // solo de quien no vino por una reserva: la suya ya la
  // fijo la empresa que lo nomino y no la cambia el
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(20) nit?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(1)
  digitoVerificacion?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(200)
  razonSocial?: string;

  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(200)
  direccion?: string;
  @IsOptional() @Transform(aTexto) @IsString() @MaxLength(40) telefono?: string;

  @IsOptional() @Transform(aNumero) @IsInt() departamentoSepId?: number;
  @IsOptional() @Transform(aNumero) @IsInt() municipioSepId?: number;

  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(120)
  sectorEconomico?: string;

  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  @Min(1)
  numeroTrabajadores?: number;

  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(120)
  contactoNombre?: string;
  @IsOptional()
  @Transform(aTexto)
  @IsString()
  @MaxLength(120)
  contactoCargo?: string;

  @IsOptional()
  @Transform(aTexto)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  contactoCorreo?: string;
}
