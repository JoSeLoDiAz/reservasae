/** Quien ya no debe ningún dato pasa a DATOS COMPLETOS, venga por donde venga. */

/**
 * `DATOS_COMPLETOS` es un estado CALCULADO: no se marca a mano
 * --`cambiarEtapa` lo rechaza-- y lo pone el sistema cuando a la
 * persona ya no le falta nada de lo que pide el reporte.
 *
 * EL DEFECTO (18 sep 2026, lo vio Mauricio en producción): solo lo
 * calculaba el enlace de completar ficha. Quien quedaba completo
 * por otro camino --un asesor le llenó los datos en la ficha, se
 * inscribió desde el panel con todos los campos, vino de un cargue
 * o de un lead con todo-- se quedaba en «Interesado» con la columna
 * de al lado diciendo «Sin pendientes». Dos verdades sobre la misma
 * fila, y el asesor sin saber a cuál creer.
 *
 * Ahora la regla vive aquí, UNA vez, y la llaman todos los caminos
 * que escriben datos de la persona. Usa `faltaDeLaPersona`, que es
 * lo mismo que pinta la columna «Datos pendientes»: si una dice
 * «Sin pendientes», la otra no puede decir «Interesado».
 */

import type { EtapaParticipante, PrismaClient } from '../../generated/prisma';
import { faltaDeLaFicha } from './completitud';

/// Solo desde el embudo del asesor. Quien ya está inscrito o en
/// el aula no retrocede por completar unos datos.
const DESDE: EtapaParticipante[] = ['INTERESADO', 'CONTACTADO'];

/// Lo que `faltaDeLaEmpresa` mira, y nada más.
const CAMPOS = {
  nit: true,
  sectorEconomico: true,
  contactoNombre: true,
  contactoCargo: true,
  contactoCorreo: true,
} as const;

type Prisma = Pick<PrismaClient, 'participante' | 'movimientoParticipante' | '$transaction'>;

/**
 * La mueve si ya no le falta nada. Devuelve la etapa en que queda,
 * o null si la ficha no existe.
 *
 * `motivo` va al movimiento: dice POR QUÉ camino se completó, que
 * es lo que alguien va a querer saber mirando la historia.
 */
export async function pasarSiNoLeFaltaNada(
  prisma: Prisma,
  participanteId: string,
  motivo: string,
  /// Quien lo completó, cuando fue una persona del equipo.
  adminId?: string | null,
): Promise<EtapaParticipante | null> {
  const p = await prisma.participante.findUnique({
    where: { id: participanteId },
    select: {
      etapa: true,
      nivelOcupacionalSepId: true,
      persona: {
        select: {
          numeroDocumento: true,
          correo: true,
          celular: true,
          fechaNacimiento: true,
          generoSepId: true,
          estrato: true,
          departamentoSepId: true,
          municipioSepId: true,
          barrio: true,
          direccion: true,
        },
      },
      /// LA SUYA PROPIA Y, SI NO, LA DE LA RESERVA QUE LO NOMINÓ.
      ///
      /// Es la misma cadena que ya usan el F7 y la compuerta, y
      /// tiene que serlo: con una regla más estrecha aquí, a quien
      /// llegó por la reserva de una empresa --el camino principal
      /// del sistema-- se le diría que no tiene organización.
      empresa: { select: CAMPOS },
      reserva: { select: { empresa: { select: CAMPOS } } },
    },
  });
  if (!p) return null;
  if (!DESDE.includes(p.etapa)) return p.etapa;

  const falta = faltaDeLaFicha({
    persona: p.persona,
    nivelOcupacionalSepId: p.nivelOcupacionalSepId,
    empresa: p.empresa ?? p.reserva?.empresa ?? null,
    documentoDeLaPersona: p.persona.numeroDocumento,
  });
  if (falta.length > 0) return p.etapa;

  await prisma.$transaction([
    prisma.participante.update({
      where: { id: participanteId },
      // sin fechaMatricula: no se ha matriculado en nada
      data: { etapa: 'DATOS_COMPLETOS' },
    }),
    prisma.movimientoParticipante.create({
      data: {
        participanteId,
        etapaAntes: p.etapa,
        etapaDespues: 'DATOS_COMPLETOS',
        motivo,
        adminId: adminId ?? null,
      },
    }),
  ]);

  return 'DATOS_COMPLETOS';
}
