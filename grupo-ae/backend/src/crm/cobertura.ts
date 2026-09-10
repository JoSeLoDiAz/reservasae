/** A quién cubre un grupo, por dónde vive. */

/// Un grupo se dicta en una ciudad o cubre un departamento
/// entero. Ofrecerle a alguien de Bogotá un grupo de Medellín
/// no es una opción: es un error esperando a que alguien lo
/// cometa con prisa un viernes a las cinco.
///
/// Y cuando se comete no se nota: la ficha queda con grupo, el
/// tablero la cuenta como lista, y el error aparece el día que
/// la persona no llega al curso.
///
/// La regla es la misma que usa el formulario público para
/// decidir qué ofertas enseñar, y por eso vive aparte de los
/// dos: si mañana cambia, tiene que cambiar en un solo sitio.

import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';

export type DondeSeDicta = {
  /// Como se llama la ubicación del grupo.
  nombre: string;
  /// CIUDAD cubre solo esa ciudad; DEPARTAMENTO, todo el suyo.
  tipo: string;
  /// Para las ciudades: a qué departamento pertenecen.
  departamento: string | null;
};

export type DondeVive = {
  departamento: string | null;
  ciudad: string | null;
};

/// Sin tildes, sin mayúsculas y sin espacios de más:
/// «BOGOTÁ D.C.» y «Bogota D.C» son el mismo sitio, y quien
/// escribió cada uno no se puso de acuerdo con el otro.
export function igual(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  /// Los puntos se BORRAN, no se vuelven espacio: «D.C.» y
  /// «DC» son la misma sigla, y cambiándolos por espacio
  /// quedaba «d c», que ya no coincide con nada.
  const limpiar = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return limpiar(a) === limpiar(b);
}

/**
 * ¿Este grupo le sirve a esta persona?
 *
 * Cuando NO se sabe dónde vive, se dice que sí: no se puede
 * esconder media oferta por un dato que falta. El aviso de que
 * falta el domicilio va por otro lado; aquí, esconder sería
 * peor que ofrecer.
 */
export function cubreA(donde: DondeSeDicta, vive: DondeVive): boolean {
  if (!vive.departamento && !vive.ciudad) return true;

  if (donde.tipo === 'DEPARTAMENTO') {
    return igual(donde.nombre, vive.departamento);
  }

  /// Una ciudad cubre a quien vive EN ella.
  ///
  /// No basta con que coincida el departamento: un grupo
  /// presencial en Medellín no le sirve a alguien de Apartadó
  /// aunque los dos sean de Antioquia. Ese es justo el error
  /// que esto viene a impedir.
  if (igual(donde.nombre, vive.ciudad)) return true;

  /// Salvo que no sepamos su ciudad. Entonces se cae al
  /// departamento: es lo único que se puede afirmar, y dejar
  /// fuera un grupo bueno por un dato incompleto también es
  /// un error.
  if (!vive.ciudad) return igual(donde.departamento, vive.departamento);

  return false;
}

/// Los que le sirven, y cuántos quedaron fuera. El número
/// importa: una lista que se acorta sola sin decir por qué
/// parece un sistema roto.
export function repartirPorCobertura<T extends { ubicacion: DondeSeDicta }>(
  grupos: T[],
  vive: DondeVive,
): { cubren: T[]; fuera: number } {
  const cubren = grupos.filter((g) => cubreA(g.ubicacion, vive));
  return { cubren, fuera: grupos.length - cubren.length };
}

/** Que el grupo elegido sea de verdad un grupo de esa oferta. */

/**
 * Un `GrupoCobertura` es un grupo EN UNA SEDE. La oferta es un curso EN
 * UNA SEDE. Para que uno sirva al otro tienen que coincidir las dos
 * cosas: la acción de formación y la ubicación.
 *
 * Se comprobaba solo la acción, en los dos sitios que escriben el grupo
 * --`asignar` y `actualizar`--, y la pantalla que ofrece los grupos
 * tampoco filtraba por sede. Resultado: se podía meter a alguien de
 * Bogotá en el grupo de Atlántico, y ese grupo viajaba al SENA en el
 * cargue.
 *
 * Va aparte porque la regla es una y los sitios que la necesitan son
 * varios: el que la olvide, la olvida entera.
 */

/** Lo mínimo que hay que saber del destino para poder juzgar. */
export type DestinoDelGrupo = {
  accionFormacionId: string;
  /// Null cuando la persona todavía no tiene oferta: entonces solo se
  /// puede juzgar la acción, que es lo que se hacía siempre.
  ubicacionId: string | null;
};

export type CoberturaValida = {
  id: string;
  numero: number;
  ubicacionId: string;
};

/**
 * Devuelve la cobertura si sirve para ese destino, y si no, explica por
 * qué no. El mensaje distingue los dos motivos a propósito: «otra
 * acción» y «otra sede» se arreglan de formas distintas.
 */
export async function exigirCoberturaDeLaOferta(
  prisma: PrismaService,
  coberturaId: string,
  destino: DestinoDelGrupo,
): Promise<CoberturaValida> {
  const cobertura = await prisma.grupoCobertura.findUnique({
    where: { id: coberturaId },
    select: {
      id: true,
      ubicacionId: true,
      ubicacion: { select: { nombre: true } },
      grupo: { select: { accionFormacionId: true, numero: true } },
    },
  });

  if (!cobertura) throw new NotFoundException('Ese grupo no existe.');

  if (cobertura.grupo.accionFormacionId !== destino.accionFormacionId) {
    throw new BadRequestException('Ese grupo es de otra acción de formación.');
  }

  if (destino.ubicacionId && cobertura.ubicacionId !== destino.ubicacionId) {
    throw new BadRequestException(
      `Ese grupo es de ${cobertura.ubicacion.nombre}, y esta persona está en otra sede.`,
    );
  }

  return {
    id: cobertura.id,
    numero: cobertura.grupo.numero,
    ubicacionId: cobertura.ubicacionId,
  };
}
