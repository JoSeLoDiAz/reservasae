/** La constancia de que alguien autorizó el tratamiento. */

/**
 * Vive aquí y no dentro de un servicio porque la necesitan dos
 * caminos: la preinscripción pública —la persona marca la
 * casilla— y la conversión de un lead —el asesor llama y ella lo
 * autoriza por teléfono—. Escrita dos veces serían dos reglas
 * sobre lo mismo, y este proyecto ya sabe cómo acaba eso.
 *
 * Lo que se guarda NO es un booleano. Apunta a la VERSIÓN exacta
 * del texto vigente, con el canal por el que se dio y dónde
 * quedó la prueba: es lo que hay que poder demostrar dentro de
 * seis meses, y un `true` no demuestra nada.
 */

import type { CanalAutorizacion } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';

/** La política que la persona tiene que aceptar, o null. */
export async function politicaVigente(
  prisma: PrismaService,
  convenioId: string,
  destinatario: 'PARTICIPANTE' | 'RESERVA' = 'PARTICIPANTE',
) {
  return prisma.politicaDatos.findFirst({
    where: { convenioId, destinatario, vigenteDesde: { lte: new Date() } },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });
}

export type Constancia = {
  personaId: string;
  convenioId: string;
  canal: CanalAutorizacion;
  /// Dónde quedó la prueba: acta, correo, grabación, la ficha.
  evidencia: string;
  ip?: string | null;
};

/**
 * Deja la constancia. Devuelve qué pasó, sin lanzar.
 *
 * `SIN_POLITICA` no es un fallo del que la registra: es que ese
 * convenio todavía no tiene texto publicado. Quien llama decide
 * —la preinscripción sigue adelante, la conversión de un lead se
 * planta—, porque no es la misma conversación.
 *
 * `YA_TENIA` tampoco: registrar dos veces la misma autorización
 * no la hace más cierta, y crearía dos filas que después habría
 * que revocar por separado.
 *
 * `REVOCADA` sí es un alto, y es el que faltaba. Ver abajo.
 */
export async function dejarConstancia(
  prisma: PrismaService,
  c: Constancia,
): Promise<'REGISTRADA' | 'YA_TENIA' | 'SIN_POLITICA' | 'REVOCADA'> {
  const politica = await politicaVigente(prisma, c.convenioId);
  if (!politica) return 'SIN_POLITICA';

  /**
   * QUIEN YA REVOCÓ NO SE REAUTORIZA SOLO.
   *
   * El `findFirst` de abajo mira únicamente las autorizaciones VIVAS,
   * así que ante una revocada caía derecho al `create` y escribía una
   * nueva: en silencio, se deshacía un derecho que la persona ya
   * ejerció.
   *
   * La conversión de un lead ya lo comprobaba por su cuenta
   * ---`revocoDespuesDe`, en `conversion.service.ts`--- y la
   * preinscripción pública no, que es la peor de las dos para
   * saltárselo: es una ruta ANÓNIMA Y SIN SESIÓN donde basta teclear
   * una cédula, y las cédulas están en cualquier fotocopia. Un tercero
   * podía reactivar el tratamiento de datos de alguien que había
   * pedido expresamente que pararan.
   *
   * Se comprueba AQUÍ y no en cada llamador para que no vuelva a
   * quedar una puerta fuera: es el único sitio del sistema que escribe
   * esta fila.
   *
   * NO CIERRA LA PUERTA PARA SIEMPRE: quien revocó y quiere volver
   * sigue pudiendo, pero por el camino donde alguien del equipo deja
   * constancia de con quién habló ---`registrarAutorizacion` del
   * panel---, que es exactamente lo que hay que poder demostrar
   * después.
   */
  const revocada = await prisma.autorizacionDatos.findFirst({
    where: {
      personaId: c.personaId,
      politica: { convenioId: c.convenioId },
      revocadaEn: { not: null },
    },
    select: { id: true },
  });
  if (revocada) return 'REVOCADA';

  const ya = await prisma.autorizacionDatos.findFirst({
    where: {
      personaId: c.personaId,
      politicaDatosId: politica.id,
      revocadaEn: null,
    },
    select: { id: true },
  });
  if (ya) return 'YA_TENIA';

  await prisma.autorizacionDatos.create({
    data: {
      personaId: c.personaId,
      politicaDatosId: politica.id,
      canal: c.canal,
      evidencia: c.evidencia,
      ip: c.ip ?? null,
    },
  });
  return 'REGISTRADA';
}
