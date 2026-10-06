import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { OCUPAN_SILLA } from '../crm/etapas';

export type Semaforo = 'DISPONIBLE' | 'ULTIMOS_CUPOS' | 'COMPLETO';

/**
 * LAS PLAZAS QUE DE VERDAD ESTÁN OCUPADAS.
 *
 * Son DOS cosas y hasta el 2 oct 2026 el sitio público solo contaba
 * una:
 *
 * · `apartadas` es `Oferta.cuposOcupados`, que lo mueve SOLO
 *   `reservas.service.ts`: las plazas que una empresa reserva. En
 *   `admin.service.ts` hasta se llama `cuposReservados`.
 *
 * · `porSuCuenta` es la gente que se inscribió sin pasar por una
 *   reserva de empresa. Esas plazas no estaban en ningún contador,
 *   así que el público las veía libres.
 *
 * Lo vio el cliente comparando las dos pantallas: AF1 decía 422
 * libres de 520 con 120 personas ya dentro. Ciento veinte plazas
 * prometidas que no existen.
 *
 * NO SE SUMAN TODOS LOS INSCRITOS, y esa es la parte delicada: quien
 * entró POR una reserva ya está contado en `apartadas` ---la empresa
 * apartó su plaza--- y contarlo otra vez cerraría ofertas con sitio.
 * Por eso `porSuCuenta` solo cuenta los de `reservaId` nulo.
 */
export function plazasOcupadas(
  apartadas: number,
  porSuCuenta: number,
): number {
  return apartadas + porSuCuenta;
}

/** El semáforo del cupo. */
export function semaforo(cuposMaximos: number, cuposOcupados: number): Semaforo {
  const disponibles = cuposMaximos - cuposOcupados;
  if (disponibles <= 0) return 'COMPLETO';
  // 10 % del cupo y nunca menos de 3
  if (disponibles <= Math.max(3, Math.floor(cuposMaximos * 0.1))) return 'ULTIMOS_CUPOS';
  return 'DISPONIBLE';
}

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async convenios() {
    const convenios = await this.prisma.convenio.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { slug: true, nombre: true, sigla: true },
    });
    return convenios;
  }

  /** Acciones publicadas con sus ofertas abiertas. */
  async porConvenio(slug: string) {
    const convenio = await this.prisma.convenio.findUnique({
      where: { slug },
      include: {
        acciones: {
          where: { visible: true },
          orderBy: { orden: 'asc' },
          include: {
            ofertas: {
              where: { abierta: true },
              include: { ubicacion: true },
            },
          },
        },
      },
    });

    if (!convenio || !convenio.activo) {
      throw new NotFoundException('No existe ese convenio.');
    }

    /**
     * QUIEN SE INSCRIBIÓ DIRECTO TAMBIÉN OCUPA SILLA.
     *
     * `cuposOcupados` lo mueve SOLO `reservas.service.ts`: son las
     * plazas que una empresa aparta. En `admin.service.ts` hasta se
     * llama `cuposReservados`, que es lo que es.
     *
     * Así que el sitio público venía enseñando
     * `cuposMaximos - cuposOcupados` e IGNORANDO a todo el que se
     * inscribe por su cuenta. Lo vio el cliente el 2 oct 2026
     * comparando las dos pantallas: AF1 decía 422 libres de 520
     * ---520 menos las 98 apartadas--- con 120 personas ya dentro.
     * Ciento veinte plazas prometidas que no existen, y la cuenta
     * cuadra exactamente en las cuatro acciones.
     *
     * NO SE RESTAN LOS DOS A SECAS, que es lo que parecía. Quien
     * entra POR una reserva de empresa ya está contado dentro de
     * `cuposOcupados` ---la empresa apartó su plaza--- y restarlo
     * otra vez cerraría ofertas que tienen sitio. Por eso solo
     * cuentan los que NO vienen de una reserva: `reservaId` nulo es
     * justo esa diferencia, y por eso existe ese campo.
     *
     * `OCUPAN_SILLA` y no «todos los participantes»: un lead
     * interesado no ocupa nada, y contarlo cerraría la oferta a la
     * gente que todavía puede entrar.
     */
    const porSuCuenta = await this.prisma.participante.groupBy({
      by: ['ofertaId'],
      where: {
        ofertaId: {
          in: convenio.acciones.flatMap((a) => a.ofertas.map((o) => o.id)),
        },
        reservaId: null,
        etapa: { in: OCUPAN_SILLA },
      },
      _count: { _all: true },
    });

    const sueltos = new Map(
      porSuCuenta.map((f) => [f.ofertaId, f._count._all]),
    );

    /// Lo que de verdad queda: el tope menos lo apartado por
    /// empresas menos quien entró por su cuenta.
    const ocupadasDeVerdad = (o: { id: string; cuposOcupados: number }) =>
      plazasOcupadas(o.cuposOcupados, sueltos.get(o.id) ?? 0);

    return {
      slug: convenio.slug,
      nombre: convenio.nombre,
      sigla: convenio.sigla,
      acciones: convenio.acciones.map((accion) => ({
        id: accion.id,
        codigo: accion.codigo,
        nombre: accion.nombre,
        modalidad: accion.modalidad,
        evento: accion.evento,
        horas: accion.horas,
        objetivo: accion.objetivo,
        ofertas: accion.ofertas
          .map((oferta) => ({
            id: oferta.id,
            modalidad: oferta.modalidad,
            ubicacion: oferta.ubicacion.nombre,
            tipoUbicacion: oferta.ubicacion.tipo,
            departamento: oferta.ubicacion.departamento,
            cuposMaximos: oferta.cuposMaximos,
            // solo se expone lo que queda
            cuposDisponibles: Math.max(
              oferta.cuposMaximos - ocupadasDeVerdad(oferta),
              0,
            ),
            estado: semaforo(oferta.cuposMaximos, ocupadasDeVerdad(oferta)),
          }))
          .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion, 'es')),
      })),
    };
  }
}
