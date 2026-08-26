/** Pasar a los inscritos al aula cuando arranca su grupo. */

/// Antes esto no pasaba nunca. Ninguna linea del backend
/// escribia EN_FORMACION y el selector de la ficha tampoco la
/// ofrecia, asi que INSCRITO era un callejon sin salida: el
/// lead salia de Inscripciones y no aparecia en Seguimiento
/// academico jamas. La pantalla del aula salia vacia por un
/// descuido, no por falta de gente.
///
/// Se hace por fecha y no a mano porque la fecha ya esta en
/// el cronograma y nadie tiene que acordarse. Quien necesite
/// adelantarlo o corregirlo lo hace desde la ficha: el rol
/// academico tiene EN_FORMACION entre las etapas que puede
/// elegir.

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/// Cada cuanto se mira el reloj. Una hora sobra: lo que se
/// espera es el cambio de dia, no el minuto exacto.
const CADA = 60 * 60 * 1000;

/// Al arrancar se espera un poco, para no pelear con las
/// migraciones ni con el resto del encendido.
const AL_ARRANCAR = 20_000;

@Injectable()
export class Matricula implements OnModuleInit {
  private readonly log = new Logger('Matricula');
  private reloj: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    setTimeout(() => void this.pasarLosQueEmpiezan(), AL_ARRANCAR).unref();
    this.reloj = setInterval(() => void this.pasarLosQueEmpiezan(), CADA);
    this.reloj.unref();
  }

  onModuleDestroy() {
    if (this.reloj) clearInterval(this.reloj);
  }

  /**
   * Los INSCRITO cuyo grupo ya empezo pasan a EN_FORMACION.
   *
   * Deja movimiento por cada uno. Sin la traza, manana nadie
   * sabe si alguien lo movio o si lo movio el sistema, y esa
   * es justo la pregunta que se hace cuando una fecha no
   * cuadra con el SENA.
   */
  async pasarLosQueEmpiezan(): Promise<number> {
    const hoy = new Date();

    const listos = await this.prisma.participante.findMany({
      where: {
        etapa: 'INSCRITO',
        cobertura: { grupo: { fechaInicio: { not: null, lte: hoy } } },
      },
      select: {
        id: true,
        cobertura: { select: { grupo: { select: { fechaInicio: true } } } },
      },
    });

    if (listos.length === 0) return 0;

    for (const p of listos) {
      const inicio = p.cobertura?.grupo.fechaInicio;
      await this.prisma.$transaction([
        this.prisma.participante.update({
          where: { id: p.id },
          data: {
            etapa: 'EN_FORMACION',
            // la fecha de matricula es la del grupo, no la de
            // hoy: si el proceso estuvo caido tres dias, la
            // que le importa al SENA sigue siendo la de
            // arranque del grupo
            fechaMatricula: inicio ?? hoy,
          },
        }),
        this.prisma.movimientoParticipante.create({
          data: {
            participanteId: p.id,
            etapaAntes: 'INSCRITO',
            etapaDespues: 'EN_FORMACION',
            nota: 'Automático: su grupo ya empezó',
          },
        }),
      ]);
    }

    this.log.log(`${listos.length} al aula: su grupo ya empezó.`);
    return listos.length;
  }

  /** Los que no pueden pasar porque nadie les puso grupo. */
  async inscritosSinGrupo(): Promise<number> {
    return this.prisma.participante.count({
      where: { etapa: 'INSCRITO', OR: [{ coberturaId: null }, { cobertura: { grupo: { fechaInicio: null } } }] },
    });
  }
}
