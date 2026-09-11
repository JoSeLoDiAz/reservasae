/** Cuánto tiene que vender cada quien, y en qué mes. */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, type TipoEmbudo } from '../../generated/prisma';
import type { Ambito } from '../admin/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { aPesos, revisarValor } from './dinero';
import { revisarPeriodo, rotuloDeMes } from './periodo';
import { sumarMetas } from './sumar-metas';

/// Lo que llega del panel al fijar una meta.
export type NuevaMeta = {
  convenioId: string;
  /// Null es la meta del EQUIPO. No es «sin asesor»: es la de
  /// todos, que es una fila distinta con su propio dueño.
  asesorId?: string | null;
  anio: number;
  mes: number;
  valor: number;
  embudo?: TipoEmbudo | null;
};

export type FiltrosDeMetas = {
  anio: number;
  mes?: number | null;
  convenioId?: string | null;
  asesorId?: string | null;
};

@Injectable()
export class MetasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fijar la meta de un mes: la crea o la reemplaza.
   *
   * Una sola operación para las dos cosas porque el panel manda una
   * cifra y no sabe —ni tiene por qué— si ya había una. Un POST que
   * falla con «ya existe» obliga a la pantalla a consultar antes de
   * escribir, y esa consulta se olvida.
   */
  async fijar(datos: NuevaMeta, ambito: Ambito) {
    const reparoDePeriodo = revisarPeriodo(datos.anio, datos.mes);
    if (reparoDePeriodo) throw new BadRequestException(reparoDePeriodo);

    const reparoDeValor = revisarValor(datos.valor);
    if (reparoDeValor) throw new BadRequestException(reparoDeValor);

    /// El convenio se comprueba contra el ámbito y no se cree lo
    /// que mande el cliente: fijarle la meta a otra cuenta es
    /// escribir en los informes de otro gremio.
    if (!ambito.convenios.includes(datos.convenioId)) {
      throw new BadRequestException('No trabaja en esa cuenta.');
    }

    const asesorId = datos.asesorId ?? null;
    const embudo = datos.embudo ?? null;

    /**
     * Que el asesor trabaje de verdad en esa cuenta.
     *
     * Sin esto se le puede poner meta a cualquier id de
     * administrador: la fila se crearía, no aparecería en ningún
     * tablero —porque el informe solo mira a quien tiene acceso— y
     * la meta del equipo saldría descuadrada contra la suma de las
     * individuales sin que nadie encontrara la de más.
     */
    if (asesorId) {
      const trabajaAqui = await this.prisma.adminConvenio.findFirst({
        where: { adminId: asesorId, convenioId: datos.convenioId },
        select: { id: true },
      });
      if (!trabajaAqui) {
        throw new BadRequestException(
          'Esa persona no tiene acceso a esta cuenta. Concédaselo en ' +
            'Administradores y vuelva a ponerle la meta.',
        );
      }
    }

    const meta = await this.prisma.$transaction(async (tx) => {
      /**
       * El índice único de la tabla NO ata la meta del equipo.
       *
       * `@@unique([convenioId, asesorId, anio, mes, embudo])` se
       * traduce a un índice único de Postgres, y en Postgres NULL
       * nunca es igual a NULL: dos filas con `asesorId` nulo —que
       * es justo como se guarda la meta del equipo— no chocan entre
       * sí. Lo mismo con `embudo`. Así que la unicidad que promete
       * el esquema la sostiene este servicio, no la base.
       *
       * Por eso se busca a mano en vez de usar `upsert`: `upsert`
       * necesita la clave compuesta y con nulos dentro no acierta.
       * Y por eso, si alguna vez entraron dos, aquí se reconcilian
       * en lugar de dejarlas sumándose dos veces en el avance.
       */
      const yaHay = await tx.metaComercial.findMany({
        where: {
          convenioId: datos.convenioId,
          asesorId,
          anio: datos.anio,
          mes: datos.mes,
          embudo,
        },
        orderBy: { creadoEn: 'asc' },
        select: { id: true },
      });

      if (yaHay.length === 0) {
        return tx.metaComercial.create({
          data: {
            convenioId: datos.convenioId,
            asesorId,
            anio: datos.anio,
            mes: datos.mes,
            embudo,
            valor: new Prisma.Decimal(datos.valor),
          },
        });
      }

      const [primera, ...sobrantes] = yaHay;
      if (sobrantes.length > 0) {
        /// Se queda la más vieja: es la que tiene el id que ya
        /// anda por ahí en las pantallas abiertas.
        await tx.metaComercial.deleteMany({
          where: { id: { in: sobrantes.map((m) => m.id) } },
        });
      }

      return tx.metaComercial.update({
        where: { id: primera.id },
        data: { valor: new Prisma.Decimal(datos.valor) },
      });
    });

    return this.paraElPanel(meta);
  }

  /**
   * Las metas de un año, o de un mes suelto.
   *
   * Ordenadas por mes y, dentro del mes, la del equipo primero:
   * es el número contra el que se leen todas las demás.
   */
  async listar(ambito: Ambito, filtros: FiltrosDeMetas) {
    /// El mes puede no venir —«todo el año»—, pero el año sí se
    /// revisa. Se pasa un mes válido de relleno para no escribir
    /// dos veces la misma comprobación del año.
    const reparo = revisarPeriodo(filtros.anio, filtros.mes ?? 1);
    if (reparo) throw new BadRequestException(reparo);

    const filas = await this.prisma.metaComercial.findMany({
      where: {
        convenioId: { in: this.conveniosDe(ambito, filtros.convenioId) },
        anio: filtros.anio,
        ...(filtros.mes ? { mes: filtros.mes } : {}),
        ...(filtros.asesorId ? { asesorId: filtros.asesorId } : {}),
      },
      /// Por mes y ya: el resto del orden —la del equipo arriba y
      /// las demás por nombre— se decide abajo, porque en SQL
      /// exigiría un ORDER BY con los nulos primero y un join
      /// hecho solo para ordenar.
      orderBy: { mes: 'asc' },
      select: {
        id: true,
        convenioId: true,
        anio: true,
        mes: true,
        valor: true,
        embudo: true,
        asesorId: true,
        actualizadoEn: true,
        asesor: { select: { id: true, nombre: true } },
      },
    });

    const metas = filas
      .map((f) => this.paraElPanel(f))
      .sort((a, b) => {
        if (a.mes !== b.mes) return a.mes - b.mes;
        /// La del equipo arriba de las suyas, no mezclada entre
        /// ellas: es el número contra el que se leen las demás.
        if (a.esDelEquipo !== b.esDelEquipo) return a.esDelEquipo ? -1 : 1;
        return (a.asesor?.nombre ?? '').localeCompare(b.asesor?.nombre ?? '');
      });

    /**
     * Lo que suman, para ver de un vistazo si al año le falta un
     * mes por fijar.
     *
     * Con la MISMA regla que usa el avance: dentro de un mes y de
     * un dueño, la meta general manda sobre las de embudo. Sumar
     * las filas a secas contaría un total junto con sus partes, y
     * este número dejaría de cuadrar contra el que enseña el
     * informe —que es exactamente para lo que se mira—.
     */
    const porDuenoYMes = new Map<string, typeof metas>();
    for (const m of metas) {
      const clave = `${m.asesorId ?? 'EQUIPO'}|${m.mes}`;
      const grupo = porDuenoYMes.get(clave) ?? [];
      grupo.push(m);
      porDuenoYMes.set(clave, grupo);
    }

    return {
      anio: filtros.anio,
      mes: filtros.mes ?? null,
      cuantas: metas.length,
      total: [...porDuenoYMes.values()].reduce(
        (s, grupo) => s + sumarMetas(grupo),
        0,
      ),
      metas,
    };
  }

  async una(id: string, ambito: Ambito) {
    const meta = await this.prisma.metaComercial.findFirst({
      where: { id, convenioId: { in: ambito.convenios } },
      include: { asesor: { select: { id: true, nombre: true } } },
    });
    if (!meta) throw new NotFoundException('No encontramos esa meta.');
    return this.paraElPanel(meta);
  }

  /**
   * Borrar una meta. Esta sí se borra de verdad.
   *
   * En esta casa nada se elimina: se oculta, se cancela o se
   * cierra, pero la fila se queda. Una meta es la excepción y vale
   * la pena decir por qué: no es el registro de algo que pasó
   * —como una reserva o una oportunidad—, es una cifra que alguien
   * escribió para el futuro. Borrarla no borra ninguna venta ni
   * ningún historial; lo único que cambia es que ese mes vuelve a
   * quedar SIN_META, que es distinto de tener meta cero.
   *
   * Y no hay dónde ocultarla: la tabla no tiene columna para
   * marcarla, y añadirla sería una migración para conservar una
   * cifra que se corrige escribiéndola otra vez.
   */
  async borrar(id: string, ambito: Ambito) {
    const meta = await this.prisma.metaComercial.findFirst({
      where: { id, convenioId: { in: ambito.convenios } },
      select: { id: true, anio: true, mes: true },
    });
    if (!meta) throw new NotFoundException('No encontramos esa meta.');

    await this.prisma.metaComercial.delete({ where: { id: meta.id } });

    return {
      borrada: true,
      mensaje: `${rotuloDeMes(meta.mes)} de ${meta.anio} queda sin meta.`,
    };
  }

  /// Los convenios sobre los que se consulta: el que se pidió, si
  /// el ámbito lo alcanza, o todos los suyos.
  private conveniosDe(ambito: Ambito, pedido?: string | null): string[] {
    if (!pedido) return ambito.convenios;
    if (!ambito.convenios.includes(pedido)) {
      throw new BadRequestException('No trabaja en esa cuenta.');
    }
    return [pedido];
  }

  /// El Decimal se queda en la base; al panel va un entero. Es el
  /// único sitio por el que salen las metas.
  private paraElPanel<
    T extends {
      valor: Prisma.Decimal;
      asesorId: string | null;
      mes: number;
    },
  >(meta: T) {
    return {
      ...meta,
      valor: aPesos(meta.valor),
      esDelEquipo: meta.asesorId === null,
      rotuloDelMes: rotuloDeMes(meta.mes),
    };
  }
}
