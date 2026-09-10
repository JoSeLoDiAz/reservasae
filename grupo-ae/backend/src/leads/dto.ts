/** Lo que el orquestador nos manda por cada lead. */

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
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

import { booleanoDeVerdad } from '../comun/booleano-de-verdad';
import { aNumeroONulo } from '../comun/campo-vacio';
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

  /// DONDE VIVE. Por nombre o por codigo DANE, da igual.
  ///
  /// Es lo que faltaba para poder matricular: `Oferta` es accion
  /// x ubicacion, asi que con el curso solo se sabe QUE quiere y
  /// no DONDE lo va a tomar. El formulario publico lo pregunta
  /// antes que nada por eso mismo, y el de la pauta tiene que
  /// preguntar lo mismo o la ficha nace a medias.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  departamento?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  ciudad?: string;

  /// El genero, por su etiqueta o su id del SEP.
  ///
  /// Es columna del reporte y el formulario publico lo pide, asi
  /// que sin el la ficha queda incompleta para el cargue.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  genero?: string;

  /// Que acepto el tratamiento de datos al registrarse.
  ///
  /// Cuando viene en `true` es la constancia de que la persona
  /// marco la casilla en el formulario de la pauta, que es lo
  /// que el formulario publico exige antes que nada. Si no
  /// viene, se deduce de por donde entro -- pero declararlo es
  /// mas fuerte que deducirlo.
  ///
  /// SE LEE EL VALOR CRUDO. `enableImplicitConversion` convierte
  /// un `boolean` con la regla de JavaScript, asi que la cadena
  /// «false» llegaba como TRUE -- una constancia de autorizacion
  /// que la persona no dio. Comprobado en vivo.
  @IsOptional()
  @Transform(({ obj, key }) => booleanoDeVerdad((obj as Record<string, unknown>)[key]))
  @IsBoolean()
  aceptaHabeasData?: boolean;

  /// DONDE quiere tomarlo. NO es lo mismo que donde vive.
  ///
  /// Para una formacion HIBRIDA la sede ES la modalidad: AF7 se
  /// dicta en MEDELLIN (presencial) y en ANTIOQUIA (virtual), y
  /// quien vive en Medellin puede hacer las dos. Sin este campo
  /// no hay forma de decir cual quiere, y el sistema se queda
  /// siempre con la misma.
  ///
  /// Por nombre, como lo eligio en el desplegable. Puede ser una
  /// ciudad o un departamento, con tildes o sin ellas.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  sede?: string;

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

  /// A quien se le asignan. OPCIONAL, y quien manda es el rol.
  ///
  /// Un ASESOR que convierte se las queda: acaba de decidir que
  /// las va a atender el, y obligarle a elegirse a si mismo en un
  /// desplegable es un paso que no decide nada.
  ///
  /// Un LIDER si tiene que elegir, porque el no las atiende:
  /// reparte. Es la misma linea que ya separa quien puede
  /// asignarle fichas a otro (`REPARTEN_FICHAS`), y usarla aqui
  /// evita una segunda regla sobre lo mismo.
  ///
  /// Antes era obligatorio para todos, y estaba mal por eso: le
  /// pedia al asesor que se eligiera a si mismo cien veces.
  ///
  /// `crm.crear` pone al que crea la ficha si no viene nadie
  /// (`dto.asesorId ?? admin.id`), y eso en un lote de cien es
  /// asignarselas todas a quien pulso el boton -- que casi nunca
  /// es quien las va a llamar. Un lote se reparte: veinte para
  /// uno, diez para otro.
  ///
  /// Opcional seria peor que no pedirlo: volveria al mismo por
  /// omision sin que nadie lo note.
  @IsOptional()
  @IsString()
  asesorId?: string;
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

/**
 * Arreglar un lead desde la mesa de entrada.
 *
 * Es la otra mitad de «recibir todos los leads»: si entran todos,
 * alguien tiene que poder componer los que llegaron mal. Sin esta
 * puerta, un lead con la ciudad mal escrita se queda atascado
 * para siempre — el panel diría qué le falta y no habría por
 * dónde arreglarlo, que es el patrón que este proyecto ya se
 * comió una vez con el enlace de completado.
 *
 * Todo opcional: se manda solo lo que se corrige. `null` borra;
 * ausente no toca.
 */
export class ArreglarLeadDto {
  /// El curso, por su id. Se elige de una lista, no se teclea.
  @IsOptional() @IsString() accionFormacionId?: string | null;

  /// El domicilio, por id del SEP. Igual que en la ficha.
  @IsOptional() @Transform(aNumeroONulo) @IsInt() departamentoSepId?: number | null;
  @IsOptional() @Transform(aNumeroONulo) @IsInt() municipioSepId?: number | null;
  @IsOptional() @Transform(aNumeroONulo) @IsInt() generoSepId?: number | null;

  /// El documento, que es lo que le falta al que entró sin él.
  @IsOptional() @Transform(aNumeroONulo) @IsInt() tipoDocumentoSepId?: number | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(40) numeroDocumento?: string | null;

  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) primerNombre?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) primerApellido?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) segundoApellido?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(160) correo?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(40) celular?: string | null;
}

/**
 * Descartar leads de la mesa.
 *
 * El MOTIVO es obligatorio, por lo mismo que en las etapas de
 * salida y en la revocacion: pedirlo opcional es no pedirlo, y
 * sin el la mesa se vacia sin que nadie pueda decir por que se
 * descarto a nadie -- que es justo lo que hay que poder explicar
 * cuando alguien pregunta por que no se le llamo.
 */
export class DescartarLoteDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'No seleccionó ningún lead.' })
  @ArrayMaxSize(TOPE_DEL_LOTE_DE_LEADS)
  @IsString({ each: true })
  ids!: string[];

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Diga por qué se descartan.' })
  @MaxLength(300)
  motivo!: string;
}

/** Repartir leads entre asesores, desde la mesa. */
export class AsignarLeadsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'No seleccionó ningún lead.' })
  @ArrayMaxSize(TOPE_DEL_LOTE_DE_LEADS, {
    message: `Un lote admite hasta ${TOPE_DEL_LOTE_DE_LEADS} leads.`,
  })
  @IsString({ each: true })
  ids!: string[];

  /// A quién. `null` los devuelve al montón sin dueño, que hace
  /// falta: un asesor se va de vacaciones y sus leads tienen que
  /// poder volver a la cola común.
  @IsOptional()
  @IsString()
  asesorId?: string | null;
}
