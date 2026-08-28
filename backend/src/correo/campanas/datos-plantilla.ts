/** Los datos de un lead, listos para una plantilla. */

/// Vive aparte porque lo usan los dos caminos: el envío
/// individual desde la ficha y la campaña. Si cada uno armara
/// los suyos, un día el correo individual diría «Estimada Sra.
/// Caro» y el de campaña «Hola, CAMILA», y nadie sabría cuál
/// de los dos está mal.

import type { PrismaService } from '../../prisma/prisma.service';
import type { DatosDelParticipante } from '../plantillas/variables';

/// PRESENCIAL -> Presencial. En un correo no se le grita a
/// nadie.
function enBonito(m: string | null | undefined): string | null {
  if (!m) return null;
  return m[0] + m.slice(1).toLocaleLowerCase('es-CO');
}

export async function datosParaPlantilla(
  prisma: PrismaService,
  participanteId: string,
): Promise<DatosDelParticipante | null> {
  const p = await prisma.participante.findUnique({
    where: { id: participanteId },
    select: {
      persona: {
        select: {
          primerNombre: true,
          segundoNombre: true,
          primerApellido: true,
          segundoApellido: true,
          generoSepId: true,
          numeroDocumento: true,
          correo: true,
          celular: true,
        },
      },
      empresa: { select: { razonSocial: true } },
      reserva: { select: { empresa: { select: { razonSocial: true } } } },
      accionFormacion: {
        select: { codigo: true, nombre: true, modalidad: true },
      },
      cobertura: {
        select: {
          modalidad: true,
          ubicacion: { select: { nombre: true } },
          grupo: { select: { numero: true, fechaInicio: true } },
        },
      },
      asesor: { select: { nombre: true } },
      convenio: { select: { sigla: true, nombre: true } },
    },
  });

  if (!p) return null;

  const per = p.persona;

  /// La empresa propia y si no la de la reserva: `empresaId`
  /// se llena en el formulario largo, pero quien llegó por una
  /// reserva la tiene colgando de ahí.
  const empresa =
    p.empresa?.razonSocial ?? p.reserva?.empresa?.razonSocial ?? null;

  return {
    primerNombre: per.primerNombre,
    segundoNombre: per.segundoNombre,
    primerApellido: per.primerApellido,
    segundoApellido: per.segundoApellido,
    generoSepId: per.generoSepId,
    numeroDocumento: per.numeroDocumento,
    correo: per.correo,
    celular: per.celular,
    empresa,
    accionFormacion: p.accionFormacion
      ? `${p.accionFormacion.codigo} · ${p.accionFormacion.nombre}`
      : null,
    grupo: p.cobertura?.grupo.numero ?? null,
    fechaInicio: p.cobertura?.grupo.fechaInicio ?? null,
    ubicacion: p.cobertura?.ubicacion.nombre ?? null,
    modalidad: enBonito(p.cobertura?.modalidad ?? p.accionFormacion?.modalidad),
    asesor: p.asesor?.nombre ?? null,
    gremio: p.convenio?.sigla ?? p.convenio?.nombre ?? null,
  };
}
