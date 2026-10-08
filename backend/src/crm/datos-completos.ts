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
import { faltaDeLaFicha, faltaDeLaPersona } from './completitud';

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

type Prisma = Pick<
  PrismaClient,
  'participante' | 'movimientoParticipante' | '$transaction'
>;

/**
 * La mueve si ya no le falta nada. Devuelve la etapa en que queda,
 * o null si la ficha no existe.
 *
 * `motivo` va al movimiento: dice POR QUÉ camino se completó, que
 * es lo que alguien va a querer saber mirando la historia.
 */
/// Lo que mira `faltaDeLaPersona`, y nada más. En una constante para
/// que las dos consultas de aquí abajo pidan exactamente lo mismo: si
/// una pidiera menos, diría que falta algo que sí está.
const CAMPOS_DE_LA_PERSONA = {
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
} as const;

/**
 * QUÉ LE FALTA A ESA FICHA PARA QUEDAR EN DATOS COMPLETOS.
 *
 * «Las personas están completando pero es como si no migrara la
 * información» (cliente, 7 oct 2026), con un aviso delante que decía
 * «Completó los datos de su organización» sobre una ficha que seguía
 * en Interesado.
 *
 * Las dos cosas eran ciertas, y por eso confundía: la persona SÍ
 * completó lo que el formulario le pidió, y la ficha NO avanzó porque
 * le faltaba otra cosa ---casi siempre el sector económico o el jefe
 * directo---. El sistema lo sabía y no lo decía, así que desde fuera
 * parecía que el dato no llegaba.
 *
 * LA MISMA REGLA, no una copia: llama a `faltaDeLaFicha` igual que la
 * función de abajo. Una segunda lista escrita aparte acabaría diciendo
 * que no falta nada mientras la otra no deja pasar.
 */
export async function loQueLeFaltaALaFicha(
  prisma: Prisma,
  participanteId: string,
): Promise<string[]> {
  const p = await prisma.participante.findUnique({
    where: { id: participanteId },
    select: {
      nivelOcupacionalSepId: true,
      persona: { select: CAMPOS_DE_LA_PERSONA },
      empresa: { select: CAMPOS },
      reserva: { select: { empresa: { select: CAMPOS } } },
    },
  });
  if (!p) return [];
  return faltaDeLaFicha({
    persona: p.persona,
    nivelOcupacionalSepId: p.nivelOcupacionalSepId,
    empresa: p.empresa ?? p.reserva?.empresa ?? null,
    documentoDeLaPersona: p.persona.numeroDocumento,
  });
}

/**
 * LO QUE LE FALTA SOLO A LA PERSONA, sin mirar su organizacion.
 *
 * Existe para un caso y conviene que se note: quien acaba de declarar
 * que NO TIENE organizacion. Pedirle «los datos de su organizacion»
 * justo despues es contarle lo contrario de lo que acaba de pasar, y
 * es el mismo defecto que ya costo 44 avisos diciendo lo que no era.
 *
 * Reusa `faltaDeLaPersona`, que es la misma mitad que usa
 * `faltaDeLaFicha`: una segunda lista escrita aparte acabaria
 * diciendo que no falta nada mientras la otra no deja pasar.
 */
export async function loQueLeFaltaALaPersona(
  prisma: Prisma,
  participanteId: string,
): Promise<string[]> {
  const p = await prisma.participante.findUnique({
    where: { id: participanteId },
    select: {
      nivelOcupacionalSepId: true,
      persona: { select: CAMPOS_DE_LA_PERSONA },
    },
  });
  if (!p) return [];
  return faltaDeLaPersona({
    persona: p.persona,
    nivelOcupacionalSepId: p.nivelOcupacionalSepId,
  });
}

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
      persona: { select: CAMPOS_DE_LA_PERSONA },
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
