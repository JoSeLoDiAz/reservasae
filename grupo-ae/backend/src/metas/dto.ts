/** Lo que el panel puede mandar a metas e informes, y nada más. */

import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

import { TipoEmbudo } from '../../generated/prisma';

/// Lo que llega por la URL llega como texto. Vacío es «no lo mandé»
/// y no un cero: sin esta distinción, un filtro que el panel deja
/// en blanco se convertiría en el año 0.
const aNumero = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : Number(value);

/**
 * Fijar la meta de un mes.
 *
 * Aquí solo se comprueba la FORMA —que sea un entero, que sea una
 * cadena—. Que el mes vaya de 1 a 12 y que el valor no sea negativo
 * se decide en `periodo.ts` y `dinero.ts`, que son puros y tienen
 * pruebas: una regla escrita en un decorador protege la puerta HTTP
 * y ninguna otra, y a este servicio también lo llama la siembra.
 */
export class FijarMetaDto {
  @IsString()
  convenioId!: string;

  /// Ausente o nulo: la meta es del EQUIPO, no de nadie en
  /// concreto. Es la misma distinción que hace la tabla.
  @IsOptional()
  @IsString()
  asesorId?: string | null;

  @IsInt({ message: 'El año va en número: 2026, por ejemplo.' })
  anio!: number;

  @IsInt({ message: 'El mes va en número: 1 para enero, 12 para diciembre.' })
  mes!: number;

  @IsInt({ message: 'La meta va en pesos enteros, sin puntos ni centavos.' })
  valor!: number;

  /// Null: la meta cubre los dos embudos sumados.
  @IsOptional()
  @IsEnum(TipoEmbudo, {
    message: 'Ese embudo no existe: use EMPRESA o PERSONA.',
  })
  embudo?: TipoEmbudo | null;
}

/** El filtro con el que se listan las metas de un año. */
export class ConsultarMetasDto {
  @Transform(aNumero)
  @IsInt({ message: 'Diga de qué año quiere las metas.' })
  anio!: number;

  @IsOptional()
  @Transform(aNumero)
  @IsInt()
  mes?: number;

  @IsOptional()
  @IsString()
  convenioId?: string;

  @IsOptional()
  @IsString()
  asesorId?: string;
}

/**
 * El periodo de un informe.
 *
 * Los dos son opcionales y el servicio los rellena con el mes
 * corriente de Bogotá: el panel entra a la pantalla sin haber
 * elegido nada y tiene que ver algo.
 */
export class PeriodoDto {
  @IsOptional()
  @Transform(aNumero)
  @IsInt({ message: 'El año va en número: 2026, por ejemplo.' })
  anio?: number;

  /// Sin mes, el informe cubre el año entero. La excepción es el
  /// avance contra la meta, que es de un mes por definición.
  @IsOptional()
  @Transform(aNumero)
  @IsInt({ message: 'El mes va en número: 1 para enero, 12 para diciembre.' })
  mes?: number;
}
