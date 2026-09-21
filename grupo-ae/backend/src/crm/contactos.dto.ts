/** Lo que el panel puede mandar al crear un contacto a mano. */

/**
 * Archivo aparte de `dto.ts` a propósito: ese es el de las fichas de
 * formación —`Participante`— y este contacto NO crea una. Mezclarlos
 * invitaría a que alguien los una «porque se parecen», y la diferencia
 * es justo lo que importa. Ver `contacto-nuevo.ts`.
 *
 * Lo que NO está aquí es tan deliberado como lo que sí:
 *
 *  - **No hay `asesorId`.** El negocio se lo queda quien lo crea si
 *    tiene rol comercial en esa línea, y si no nace sin dueño para
 *    que lo reparta un líder. Elegir a otro al crear se saltaría la
 *    comprobación de rol que hace «Asignar asesor».
 *  - **No hay `etapa` ni `valor`.** Se nace en «Solicitud de negocio»
 *    y en cero: calificarlo es otro paso, con sus compuertas.
 *  - **No hay nada del SEP** —género, domicilio, caracterización—.
 *    Aquí no se reporta a nadie, y pedir lo que no se usa es guardar
 *    datos personales sin para qué.
 */

import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  CanalAutorizacion,
  OrigenParticipante,
  TipoEmbudo,
} from '../../generated/prisma';
import { booleanoDeVerdad } from '../comun/booleano-de-verdad';
import { CANALES_A_MANO } from './contacto-nuevo';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearContactoDto {
  /// La línea de negocio. Se comprueba contra el ámbito en el
  /// servicio: mandar la de otro sería abrir un negocio ajeno.
  @IsString()
  @IsNotEmpty({ message: 'Elija la línea de negocio.' })
  convenioId!: string;

  // quién es

  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'Elija el tipo de documento.' })
  tipoDocumentoSepId!: number;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escriba el número de documento.' })
  @MaxLength(30)
  numeroDocumento!: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escriba el primer nombre.' })
  @MaxLength(60)
  primerNombre!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoNombre?: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Escriba el primer apellido.' })
  @MaxLength(60)
  primerApellido!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  segundoApellido?: string;

  // cómo se le contacta. Uno de los dos, y se valida en
  // `revisarContacto` con la misma regla que la captación

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(160)
  correo?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  celular?: string;

  // dónde trabaja

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  organizacion?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(20)
  nit?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(120)
  cargo?: string;

  // el negocio

  /// A quién se le vende. PERSONA si no se dice: la pantalla vive
  /// bajo «Leads de personas».
  @IsOptional()
  @IsEnum(TipoEmbudo)
  embudo?: TipoEmbudo;

  /// Qué le interesa, en una línea. Opcional: ver `tituloDelNegocio`.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(160)
  interes?: string;

  @IsOptional()
  @IsEnum(OrigenParticipante)
  origen?: OrigenParticipante;

  // la Ley 1581

  /// Que la persona autorizó el tratamiento de sus datos.
  ///
  /// `booleanoDeVerdad` y no el `Boolean()` de siempre: «false»
  /// escrito como texto es verdadero para JavaScript, y aquí eso
  /// sería afirmar una autorización que nadie dio.
  @IsOptional()
  @Transform(({ obj, key }) =>
    booleanoDeVerdad((obj as Record<string, unknown>)[key]),
  )
  @IsBoolean()
  autorizo?: boolean;

  @IsOptional()
  @IsIn(CANALES_A_MANO, {
    message: 'Ese canal no se puede registrar a mano desde el panel.',
  })
  canalAutorizacion?: CanalAutorizacion;

  /// Lo que no tiene casilla: dónde se conocieron, qué preguntó.
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(1000)
  nota?: string;
}
