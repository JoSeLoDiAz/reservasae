/** La cédula que llega por teléfono se cruza antes de usarla. */

/**
 * EL CASO, que lo previó el propio cliente: «puede ser que lo
 * pongan mal».
 *
 * Javier dicta su cédula por teléfono. El asesor oye mal un dígito
 * y teclea `1020304051` en vez de `...050`. Ese número es de otra
 * persona que ya está en el sistema.
 *
 * Sin esto no lo paraba nadie: `loQueLeFaltaAlLead` devolvía
 * vacío, la casilla se encendía y convertir quedaba disponible.
 * Todo verde. Y al convertir, `crm.crear` hace `upsert` por
 * `(tipo, número)`, así que:
 *
 *   - encuentra la Persona de LA OTRA persona y la reutiliza;
 *   - su nombre NO se pisa, eso se salva;
 *   - pero su `correo`, `celular`, género, domicilio y fecha de
 *     nacimiento SÍ, y quedan los de Javier;
 *   - y se crea una ficha bajo SU identidad con el lead de Javier
 *     atado.
 *
 * O sea que no es solo atarse a la ficha equivocada: le contamina
 * los datos de contacto a alguien que no tiene nada que ver, y ese
 * celular viaja al SENA como suyo. Nadie se entera nunca.
 *
 * TRES SALIDAS Y NO DOS. «No existe» y «existe y es ella» son las
 * dos que dejan pasar, y son distintas: la segunda merece decirse
 * —es alguien que ya estaba— aunque no bloquee.
 *
 * La comparación NO se escribe aquí: se reutiliza
 * `compararNombres` del RUI, que ya resuelve las tildes, la ñ, el
 * orden invertido y las partículas «de la». Escribir una segunda
 * garantizaría que un día discrepen sobre si dos nombres son el
 * mismo.
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { compararNombres } from '../crm/rui/comparar-nombres';
import { normalizarDocumento } from '../comun/documento';

export type DeQuienEs =
  /// Nadie tiene ese documento: es nuevo.
  | { que: 'LIBRE' }
  /// Ya existe y el nombre cuadra: es ella.
  | { que: 'ES_ELLA'; personaId: string }
  /// Ya existe y el nombre NO cuadra: casi seguro un dígito mal.
  | { que: 'ES_DE_OTRO'; pista: string };

@Injectable()
export class DeQuienEsEseDocumento {
  constructor(private readonly prisma: PrismaService) {}

  async mirar(
    tipoDocumentoSepId: number | null | undefined,
    numeroDocumento: string | null | undefined,
    nombre: string,
  ): Promise<DeQuienEs> {
    /// Sin documento no hay nada que cruzar. Que FALTE lo dice
    /// `loQueLeFaltaAlLead`, que es otra pregunta.
    if (tipoDocumentoSepId === null || tipoDocumentoSepId === undefined) {
      return { que: 'LIBRE' };
    }
    const numero = numeroDocumento ? normalizarDocumento(numeroDocumento) : null;
    if (!numero) return { que: 'LIBRE' };

    const persona = await this.prisma.persona.findUnique({
      where: {
        tipoDocumentoSepId_numeroDocumento: {
          tipoDocumentoSepId,
          numeroDocumento: numero,
        },
      },
      select: {
        id: true,
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
      },
    });
    if (!persona) return { que: 'LIBRE' };

    const suyo = [
      persona.primerNombre,
      persona.segundoNombre,
      persona.primerApellido,
      persona.segundoApellido,
    ]
      .filter(Boolean)
      .join(' ');

    /// Sin nombre con que comparar NO se deja pasar.
    ///
    /// Es la decisión conservadora, y es la correcta: si no se
    /// puede confirmar que es ella, dejar seguir es exactamente
    /// el fallo que esto existe para evitar. Y no bloquea a nadie
    /// de verdad, porque convertir ya exige nombre y apellido.
    if (!nombre.trim()) {
      return { que: 'ES_DE_OTRO', pista: pistaDe(suyo) };
    }

    const c = compararNombres(nombre, suyo);
    if (c.veredicto === 'DISTINTO') {
      return { que: 'ES_DE_OTRO', pista: pistaDe(suyo) };
    }
    return { que: 'ES_ELLA', personaId: persona.id };
  }
}

/// Lo justo para que el asesor sepa que se equivocó, sin
/// enseñarle quién es esa persona.
///
/// El asesor no necesita saber de quién es la cédula: necesita
/// saber que NO es de la suya. Enseñarle el nombre entero de un
/// tercero convertiría la mesa en un buscador de personas por
/// documento, que es justo lo que no puede ser.
export function pistaDe(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ');
}

/// La frase que ve el asesor. Se escribe una vez y la usan la
/// pantalla y el servidor.
export function porQueNoEsSuya(pista: string): string {
  return (
    `Ese documento ya está registrado a nombre de otra persona (${pista}). ` +
    'Compruebe el número: lo más probable es que se haya oído mal un dígito. ' +
    'Si de verdad es esa persona, corrija primero el nombre del lead.'
  );
}
