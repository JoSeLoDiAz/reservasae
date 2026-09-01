import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  CanalAutorizacion,
  CanalContacto,
  ResultadoGestion,
  EtapaParticipante,
  OrigenParticipante,
} from '../../generated/prisma';
import { aNumeroONulo as aNumero } from '../comun/campo-vacio';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;


export class CrearParticipanteDto {
  // el id del catalogo del SEP, validado en el servicio
  @Transform(({ value }) => Number(value))
  @IsInt()
  tipoDocumentoSepId!: number;

  @IsString()
  @IsNotEmpty()
  numeroDocumento!: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  primerNombre!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoNombre?: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  primerApellido!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoApellido?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sexo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  correo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  celular?: string;

  // a que convenio pertenece esta participacion
  @IsString()
  @IsNotEmpty()
  convenioId!: string;

  @IsOptional()
  @IsString()
  ofertaId?: string;

  /// La accion SIN la sede, para quien todavia no tiene domicilio.
  ///
  /// Normalmente la accion se deduce de la oferta, y la oferta es
  /// accion x ubicacion. Un lead de una pauta dice que curso quiere
  /// y NO dice donde vive, asi que no hay con que elegir la sede.
  /// Sin esto la ficha nacia sin curso y el dato se perdia.
  ///
  /// Y de paso es lo que hace morder al unique (accionFormacionId,
  /// personaId): con la accion en NULL, Postgres trata cada nulo
  /// como distinto y la misma persona entraba dos veces.
  @IsOptional()
  @IsString()
  accionFormacionId?: string;

  @IsOptional()
  @IsString()
  reservaId?: string;

  @IsOptional()
  @IsEnum(OrigenParticipante)
  origen?: OrigenParticipante;

  @IsOptional()
  @IsString()
  asesorId?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  cargoEnEmpresa?: string;

  // pasarse del cupo exige decir por que
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  sobrecupoMotivo?: string;
  /// El domicilio y el genero, desde el primer momento.
  ///
  /// No los aceptaba, asi que una ficha creada por la API nacia
  /// sin ellos aunque quien la creara los tuviera -- y el
  /// domicilio es de donde sale la SEDE, que es lo que despues
  /// bloquea la matricula. Pedirlos por el enlace de completado
  /// cuando ya venian en el lead es hacer trabajar a la persona
  /// por un dato que ya dio.
  @IsOptional() @Transform(aNumero) @IsInt() generoSepId?: number | null;
  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  departamentoSepId?: number | null;
  @IsOptional() @Transform(aNumero) @IsInt() municipioSepId?: number | null;

}

export class ActualizarParticipanteDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  primerNombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoNombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  primerApellido?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoApellido?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sexo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  correo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  celular?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  cargoEnEmpresa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nivelEducativo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nivelOcupacional?: string;

  // null para quitarle el dueño, "" llega del desplegable
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString()
  @ValidateIf((_o: unknown, valor: unknown) => valor !== null)
  asesorId?: string | null;

  @IsOptional()
  @IsString()
  coberturaId?: string;

  // lo que pide el SEP. Nada obligatorio: el asesor
  // completa la ficha en la llamada, no de una vez
  @IsOptional() @Transform(aNumero) @IsInt() generoSepId?: number | null;

  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  @Min(1)
  @Max(6)
  estrato?: number | null;

  @IsOptional() @Transform(aNumero) @IsInt() departamentoSepId?: number | null;
  @IsOptional() @Transform(aNumero) @IsInt() municipioSepId?: number | null;

  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) barrio?: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(200) direccion?: string;

  @IsOptional() @Transform(aNumero) @IsInt() nivelOcupacionalSepId?: number | null;
  @IsOptional() @IsBoolean() beneficiarioPrevio?: boolean;
}

export class ActualizarEmpresaSepDto {
  @IsOptional() @Transform(aNumero) @IsInt() tamanoSepId?: number | null;
  @IsOptional() @Transform(aNumero) @IsInt() tipoDocumentoSepId?: number | null;
}

export class AsignarAsesorEnLoteDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];

  // vacio o nulo deja las fichas sin asesor
  @IsOptional()
  @IsString()
  asesorId?: string | null;
}

export class CambiarEtapaDto {
  @IsEnum(EtapaParticipante)
  etapa!: EtapaParticipante;

  // obligatorio al perder o retirar, lo valida el servicio
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

/**
 * Revocar la autorización de tratamiento de datos.
 *
 * El motivo y el canal son obligatorios, y por lo mismo que la
 * autorización los lleva: lo que hay que poder demostrar no es
 * que se revocó, es CUÁNDO, POR DÓNDE lo pidió la persona y
 * quién lo registró. Una revocación sin eso no prueba nada,
 * igual que un booleano de autorización no prueba nada.
 */
export class RevocarAutorizacionDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo!: string;

  /// Por donde lo pidio la persona.
  @IsEnum(CanalAutorizacion)
  canal!: CanalAutorizacion;
}

export class CrearNotaDto {
  /// Obligatoria aunque marque varios canales: una sola
  /// observación da contexto a toda la gestión.
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  texto!: string;

  /// Al menos uno. Sin canal la nota no se puede medir, y
  /// medir por dónde se contacta es de lo que se trata.
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(4)
  @IsEnum(CanalContacto, { each: true })
  canales!: CanalContacto[];

  /// Obligatorio, y por la misma razon que el motivo de una
  /// etapa de salida: pedirlo opcional es no pedirlo. Sin esto
  /// no se distingue "lo intente" de "hable con ella", que es
  /// justo la lista de a quien hay que volver a llamar.
  @IsEnum(ResultadoGestion)
  resultado!: ResultadoGestion;
}

export class AgregarNitDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  nit!: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  razonSocial!: string;
}

export class FiltrosParticipantesDto {
  @IsOptional() @IsString() convenioId?: string;
  @IsOptional() @IsEnum(EtapaParticipante) etapa?: EtapaParticipante;

  // «solo el embudo» o «solo el aula». Sin esto, la cifra
  // de Inscripciones contaria tambien a los del aula
  @IsOptional()
  @IsIn(['INSCRIPCION', 'INSCRITOS', 'AULA'])
  tramo?: 'INSCRIPCION' | 'INSCRITOS' | 'AULA';
  @IsOptional() @IsString() accionFormacionId?: string;
  @IsOptional() @IsString() coberturaId?: string;
  @IsOptional() @IsString() grupoId?: string;
  @IsOptional() @IsString() asesorId?: string;
  @IsOptional() @IsString() buscar?: string;

  /// Si la ficha esta completa o a medias. No es una columna:
  /// se traduce a las diez condiciones que exige el reporte.
  @IsOptional() @IsIn(['COMPLETO', 'PARCIAL']) estado?: 'COMPLETO' | 'PARCIAL';

  /// Por donde vive la persona, no por donde se dicta.
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsInt()
  departamentoSepId?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(400)
  pagina?: number;

  // el tablero reparte una sola pagina entre nueve
  // columnas: con 30 filas las columnas salen vacias
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(300)
  limite?: number;
}

export class AsignarFormacionDto {
  @IsString()
  @IsNotEmpty()
  ofertaId!: string;

  @IsOptional()
  @IsString()
  coberturaId?: string;

  // pasarse del cupo exige decir por que
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  sobrecupoMotivo?: string;
}

export class RegistrarAutorizacionDto {
  @IsEnum(CanalAutorizacion)
  canal!: CanalAutorizacion;

  /** Dónde quedó la prueba: acta, correo, archivo. */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(300)
  evidencia?: string;
}

export class CargaDto {
  @IsString()
  @IsNotEmpty()
  convenioId!: string;

  @IsOptional()
  @IsString()
  ofertaId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200_000)
  texto!: string;

  /** Solo al confirmar: las líneas que se van a crear. */
  @IsOptional()
  lineas?: number[];

  /** Para el histórico: por dónde entraron los datos. */
  @IsOptional()
  @IsIn(['ARCHIVO', 'PEGADO'])
  origenDeCarga?: 'ARCHIVO' | 'PEGADO';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombreArchivo?: string;
}

export class ResolverPropuestaDto {
  /// Vacio quiere decir "no acepto nada": es una decision
  /// valida y se archiva igual, con su autor.
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  aceptados!: string[];
}

/**
 * Los tres del jefe directo, y solo esos.
 *
 * La RAZÓN SOCIAL no está aquí a propósito: la valida el
 * código contra el registro, y dejar que se escriba a mano por
 * esta puerta es volver a abrir lo que se cerró en la ruta
 * pública de reservas, donde cualquiera con un NIT le cambiaba
 * el nombre a una empresa.
 */
export class ContactoDeLaEmpresaDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  contactoNombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  contactoCargo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsEmail({}, { message: 'El correo del contacto no tiene un formato válido.' })
  contactoCorreo?: string;
}
