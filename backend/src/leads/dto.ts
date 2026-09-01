/** Lo que el orquestador nos manda por cada lead. */

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CanalAutorizacion, OrigenParticipante } from '../../generated/prisma';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/// Los dos gremios, y nada mas.
const CONVENIOS = ['adecopria', 'britcham-adee'];

export class EntraLeadDto {
  /**
   * De que gremio es. No hace falta si se llama al subdominio.
   *
   * Opcional porque `adecopria.reservasae.com` ya lo dice, y
   * repetirlo ahi seria pedir dos veces lo mismo. Si viene y NO
   * coincide con la direccion, el servicio lo rechaza: no se
   * elige uno de los dos en silencio.
   */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsIn(CONVENIOS, {
    message: `El convenio tiene que ser uno de: ${CONVENIOS.join(', ')}.`,
  })
  convenio?: string;

  /**
   * El id del emisor, si lo tiene. OPCIONAL.
   *
   * Era obligatorio, y dejo de serlo porque el DOCUMENTO sirve
   * de llave: es la identidad en todo el sistema -- `Persona` es
   * unica por `(tipoDocumentoSepId, numeroDocumento)` -- asi que
   * usarlo aqui es la misma regla y no una segunda que mantener.
   *
   * Con las dos manda esta, que es mas firme: un documento puede
   * llegar mal tecleado y un id propio no.
   *
   * Lo que NO se puede es no mandar ninguna. Ver `llaveDelLead`.
   */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  externoId?: string;

  /**
   * El nombre, en piezas.
   *
   * Se admiten las cuatro por separado ademas de
   * `nombreCompleto`, y es mejor mandarlas asi: partir un nombre
   * es adivinar. «Ana Maria Ruiz Gomez» puede ser dos nombres y
   * dos apellidos, o un nombre y tres apellidos, y quien llenó
   * el formulario lo sabe y nosotros no.
   *
   * Si vienen las piezas, mandan sobre `nombreCompleto`.
   */
  /// Los nombres, juntos: «Ana Maria». Los apellidos NO.
  ///
  /// Separar los apellidos si hace falta --son dos columnas del
  /// reporte al SENA y partirlos es adivinar-- pero los nombres
  /// van juntos, que es como los escribe la gente.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  nombres?: string;

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
  @IsEnum(OrigenParticipante)
  origen?: OrigenParticipante;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  nombreCompleto?: string;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  correo?: string;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  celular?: string;

  /**
   * El tipo de documento, dicho como lo dice la gente.
   *
   * `CC`, `PPT`, `CE`, `PASAPORTE`, o el nombre entero. El
   * catalogo del SEP los numera --1 es cedula, 61 es permiso por
   * proteccion temporal-- y esos numeros no los sabe nadie fuera
   * de aqui: pedirlos es pedirle a un tercero que copie una
   * tabla nuestra y la mantenga al dia.
   */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  tipoDocumento?: string;

  /// El id del SEP, para quien ya lo tenga. Se prefiere la sigla.
  @IsOptional() @IsInt() tipoDocumentoSepId?: number;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  numeroDocumento?: string;

  /// Que dijo que le interesa, en sus palabras.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(500)
  interes?: string;

  /**
   * El cuerpo original, si el emisor lo trae aparte.
   *
   * Sirve para que el orquestador nos pase lo que Meta le dio
   * sin tener que traducirlo entero. Si no viene, se guarda lo
   * que llegó.
   */
  @IsOptional()
  @IsObject()
  carga?: Record<string, unknown>;
}

/**
 * Convertir un lead en ficha. Lo hace un ASESOR, no el webhook.
 *
 * Un lead de un anuncio llenó un formulario de Facebook, no el
 * nuestro: no hay constancia de que autorizara el tratamiento de
 * sus datos. Convertirlo solo, y de paso consultarlo en el RUI
 * —un portal del Estado—, seria tratar sus datos sin nada que
 * demostrar. Por eso convertir es una acción de quien llamó, y
 * el canal de la autorización es OBLIGATORIO: pedirlo opcional
 * es no pedirlo.
 */
/// Cuantos leads caben en una peticion.
///
/// No es un numero redondo por gusto: 500 leads son unas 2.500
/// consultas, y Cloudflare corta a los ~100 s. Con mas, la
/// peticion moriria en el aire y quien la mando no sabria cuales
/// entraron -- que es peor que mandarlos de a uno.
export const TOPE_DEL_LOTE = 500;

/**
 * Varios leads de una vez.
 *
 * Para cargar un historico, no para el goteo del dia: un lead de
 * una pauta llega solo y de a uno.
 *
 * Se responde FILA POR FILA. Un lote que contesta «ok» y se traga
 * trece errores es peor que mil peticiones: quien lo mando cree
 * que entraron todos y los trece se pierden sin que nadie lo
 * sepa nunca.
 */
export class EntraLoteDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'El lote viene vacio.' })
  @ArrayMaxSize(TOPE_DEL_LOTE, {
    message:
      `Un lote admite hasta ${TOPE_DEL_LOTE} leads. ` +
      'Partalo: mas no cabe en el tiempo que aguanta la conexion.',
  })
  @ValidateNested({ each: true })
  @Type(() => EntraLeadDto)
  leads!: EntraLeadDto[];
}

/// Cuantos leads caben en una conversion por lote.
///
/// Cada uno escribe una persona, una ficha, un movimiento, una
/// constancia y una auditoria, y encola el RUI: unas diez
/// escrituras. Cloudflare corta a los ~100 s, asi que el tope no
/// sale de lo que aguante la base sino de lo que aguanta la
/// conexion. Con 100 y ~150 ms por fila van 15 s, que deja
/// margen; con 392 la peticion moriria en el aire y quien la
/// mando no sabria cuales entraron -- lo peor que le puede pasar
/// a una accion por lote.
export const TOPE_DEL_LOTE_DE_LEADS = 100;

/**
 * Convertir varios de golpe.
 *
 * NO lleva canal ni evidencia, y esa ausencia es la decision: la
 * autorizacion sale de por donde entro cada lead, no de lo que
 * teclee quien pulsa el boton. Una sola frase repetida cien veces
 * seria fabricar cien pruebas.
 */
export class ConvertirLoteDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'No seleccionó ningún lead.' })
  @ArrayMaxSize(TOPE_DEL_LOTE_DE_LEADS, {
    message:
      `Un lote admite hasta ${TOPE_DEL_LOTE_DE_LEADS} leads. ` +
      'Con más, la petición tardaría más de lo que aguanta la conexión.',
  })
  @IsString({ each: true })
  ids!: string[];
}

export class ConvertirLeadDto {
  /// Por donde lo autorizo. Casi siempre VERBAL_ASESOR.
  @IsEnum(CanalAutorizacion)
  canal!: CanalAutorizacion;

  /// Donde quedo la prueba: la llamada, el acta, el correo.
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  evidencia!: string;

  /// El tipo de documento, si el lead no lo trajo.
  @IsOptional() @IsInt() tipoDocumentoSepId?: number;

  /// El documento, si el lead no lo trajo o venia mal.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(40)
  numeroDocumento?: string;
}
