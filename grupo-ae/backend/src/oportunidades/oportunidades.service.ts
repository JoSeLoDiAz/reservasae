/** El negocio que se persigue: crearlo, moverlo y sumarlo. */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  EtapaOportunidad,
  Prisma,
  TipoEmbudo,
  type Admin,
  type MotivoCierre,
  type OrigenParticipante,
} from '../../generated/prisma';
import type { Ambito } from '../admin/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  ETAPAS_ABIERTAS,
  ETAPAS_CERRADAS,
  estaAbierta,
  probabilidadDe,
  valorPonderado,
} from './embudos';
import { puedeIr, rotulo, type Hechos } from './escalera';

/// Lo que llega del panel al crear.
export type NuevaOportunidad = {
  embudo: TipoEmbudo;
  titulo: string;
  convenioId: string;
  valor?: number;
  cierreEsperado?: string | null;
  asesorId?: string | null;
  personaId?: string | null;
  empresaId?: string | null;
  origen?: OrigenParticipante;
  campana?: string | null;
  leadId?: string | null;
  etapa?: EtapaOportunidad;
};

export type CambioDeEtapa = {
  a: EtapaOportunidad;
  motivo?: MotivoCierre | null;
  nota?: string | null;
};

@Injectable()
export class OportunidadesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * El código legible.
   *
   * `OP-2026-0007`. Se dice por teléfono y se busca, que es todo lo
   * que tiene que hacer. No lo pone la base porque la secuencia
   * lleva el año dentro y eso no cabe en un `autoincrement`.
   *
   * Se cuenta lo del año y se suma uno DENTRO de la transacción que
   * crea la fila: contar fuera abre la ventana para que dos altas
   * simultáneas saquen el mismo número, y el índice único lo
   * rechazaría con un error que no dice nada.
   */
  private async siguienteCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anio = new Date().getFullYear();
    const desde = new Date(anio, 0, 1);
    const cuantas = await tx.oportunidad.count({
      where: { creadoEn: { gte: desde } },
    });
    return `OP-${anio}-${String(cuantas + 1).padStart(4, '0')}`;
  }

  /** Los hechos que la escalera necesita para juzgar. */
  private hechosDe(
    o: {
      embudo: TipoEmbudo;
      valor: Prisma.Decimal;
      empresaId: string | null;
      personaId: string | null;
      asesorId: string | null;
    },
    cambio?: CambioDeEtapa,
    valorNuevo?: number,
  ): Hechos {
    return {
      embudo: o.embudo,
      valor: valorNuevo ?? Number(o.valor),
      tieneEmpresa: o.empresaId !== null,
      tienePersona: o.personaId !== null,
      tieneAsesor: o.asesorId !== null,
      motivo: cambio?.motivo ?? null,
      nota: cambio?.nota ?? null,
    };
  }

  async crear(datos: NuevaOportunidad, admin: Admin) {
    const etapa = datos.etapa ?? EtapaOportunidad.CAPTADO;
    const valor = datos.valor ?? 0;

    const veredicto = puedeIr(null, etapa, {
      embudo: datos.embudo,
      valor,
      tieneEmpresa: !!datos.empresaId,
      tienePersona: !!datos.personaId,
      tieneAsesor: !!datos.asesorId,
    });
    if (!veredicto.puede) throw new BadRequestException(veredicto.porque);

    return this.prisma.$transaction(async (tx) => {
      const codigo = await this.siguienteCodigo(tx);
      const creada = await tx.oportunidad.create({
        data: {
          codigo,
          convenioId: datos.convenioId,
          embudo: datos.embudo,
          etapa,
          titulo: datos.titulo.trim(),
          valor: new Prisma.Decimal(valor),
          probabilidad: probabilidadDe(datos.embudo, etapa),
          cierreEsperado: datos.cierreEsperado
            ? new Date(datos.cierreEsperado)
            : null,
          asesorId: datos.asesorId ?? null,
          personaId: datos.personaId ?? null,
          empresaId: datos.empresaId ?? null,
          campana: datos.campana ?? null,
          leadId: datos.leadId ?? null,
        },
      });

      await tx.movimientoOportunidad.create({
        data: {
          oportunidadId: creada.id,
          de: null,
          a: etapa,
          nota: 'Creada',
          adminId: admin.id,
          actorNombre: admin.nombre,
        },
      });

      return creada;
    });
  }

  /**
   * Mover de etapa.
   *
   * Todo lo que decide vive en `escalera.ts` y es puro; aquí solo
   * se lee el estado, se pregunta y se escribe. Esa separación es
   * la que permite probar las compuertas sin base de datos.
   */
  async cambiarEtapa(
    id: string,
    cambio: CambioDeEtapa,
    admin: Admin,
    ambito: Ambito,
  ) {
    const o = await this.prisma.oportunidad.findFirst({
      where: { id, convenioId: { in: ambito.convenios } },
    });
    if (!o) throw new NotFoundException('No encontramos esa oportunidad.');

    const veredicto = puedeIr(o.etapa, cambio.a, this.hechosDe(o, cambio));
    if (!veredicto.puede) throw new BadRequestException(veredicto.porque);

    const cierra = !estaAbierta(cambio.a);
    const reabre = !estaAbierta(o.etapa) && estaAbierta(cambio.a);
    const ahora = new Date();

    /**
     * El reloj se para aquí, y una sola vez.
     *
     * `primeraRespuestaEn` se escribe solo si estaba vacío. Es la
     * medición contra la que se juzga al equipo, y una medición que
     * se puede reescribir no mide: sin este `??`, volver a pasar
     * por CONTACTADO tras reabrir borraría el retraso original.
     */
    const marcaRespuesta =
      cambio.a === EtapaOportunidad.CONTACTADO && o.primeraRespuestaEn === null;
    const minutos = marcaRespuesta
      ? Math.max(0, Math.round((ahora.getTime() - o.creadoEn.getTime()) / 60_000))
      : null;

    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.oportunidad.update({
        where: { id },
        data: {
          etapa: cambio.a,
          /// La probabilidad la manda la etapa, salvo que alguien la
          /// haya pisado a mano: en ese caso se respeta, que para eso
          /// se pisó.
          ...(o.probabilidadPropia
            ? {}
            : { probabilidad: probabilidadDe(o.embudo, cambio.a) }),
          ultimoToqueEn: ahora,
          ...(marcaRespuesta
            ? { primeraRespuestaEn: ahora, minutosPrimeraRespuesta: minutos }
            : {}),
          ...(cierra
            ? {
                cerradaEn: ahora,
                motivoCierre: cambio.motivo ?? null,
                notaCierre: cambio.nota ?? null,
              }
            : {}),
          /// Al reabrir se limpia el cierre pero NO el motivo: el
          /// motivo de por qué se había perdido es historia y el
          /// informe del año lo necesita. El movimiento nuevo cuenta
          /// el resto.
          ...(reabre ? { cerradaEn: null } : {}),
        },
      });

      await tx.movimientoOportunidad.create({
        data: {
          oportunidadId: id,
          de: o.etapa,
          a: cambio.a,
          nota: cambio.nota?.trim() || null,
          adminId: admin.id,
          actorNombre: admin.nombre,
        },
      });

      return actualizada;
    });
  }

  /**
   * El tablero: una columna por etapa, con su suma.
   *
   * Devuelve las dos cifras a propósito. `total` es lo que hay
   * sobre la mesa y `ponderado` es lo que un adulto espera cobrar;
   * enseñar solo la primera es como cuentan los CRMs las historias
   * bonitas, y enseñar solo la segunda esconde el tamaño del
   * embudo.
   */
  async tablero(embudo: TipoEmbudo, ambito: Ambito, asesorId?: string) {
    const donde: Prisma.OportunidadWhereInput = {
      convenioId: { in: ambito.convenios },
      embudo,
      ...(asesorId ? { asesorId } : {}),
    };

    const filas = await this.prisma.oportunidad.findMany({
      where: donde,
      orderBy: [{ cierreEsperado: 'asc' }, { creadoEn: 'desc' }],
      select: {
        id: true,
        codigo: true,
        titulo: true,
        etapa: true,
        valor: true,
        probabilidad: true,
        cierreEsperado: true,
        creadoEn: true,
        ultimoToqueEn: true,
        primeraRespuestaEn: true,
        minutosPrimeraRespuesta: true,
        campana: true,
        asesor: { select: { id: true, nombre: true } },
        empresa: { select: { id: true, razonSocial: true } },
        persona: {
          select: { id: true, primerNombre: true, primerApellido: true },
        },
      },
    });

    const columnas = [...ETAPAS_ABIERTAS[embudo], ...ETAPAS_CERRADAS].map(
      (etapa) => {
        const suyas = filas.filter((f) => f.etapa === etapa);
        const total = suyas.reduce((s, f) => s + Number(f.valor), 0);
        const ponderado = suyas.reduce(
          (s, f) => s + valorPonderado(Number(f.valor), f.probabilidad),
          0,
        );
        return {
          etapa,
          rotulo: rotulo(etapa),
          probabilidad: probabilidadDe(embudo, etapa),
          cuantas: suyas.length,
          total,
          ponderado,
          oportunidades: suyas.map((f) => ({
            ...f,
            valor: Number(f.valor),
            deQuien:
              f.empresa?.razonSocial ??
              (f.persona
                ? `${f.persona.primerNombre} ${f.persona.primerApellido}`
                : null),
          })),
        };
      },
    );

    const abiertas = filas.filter((f) => estaAbierta(f.etapa));

    return {
      embudo,
      columnas,
      /// El pronóstico solo cuenta lo vivo. Sumar lo ganado aquí
      /// dentro convierte el pronóstico en un informe de resultados
      /// y deja de servir para decidir a qué dedicar la semana.
      pronostico: {
        cuantas: abiertas.length,
        total: abiertas.reduce((s, f) => s + Number(f.valor), 0),
        ponderado: abiertas.reduce(
          (s, f) => s + valorPonderado(Number(f.valor), f.probabilidad),
          0,
        ),
        /// Marcado para que el panel pueda decirlo: estas
        /// probabilidades son un supuesto hasta que haya histórico
        /// propio con el que recalcularlas.
        probabilidadesEstimadas: true,
      },
    };
  }

  /**
   * Las que llevan demasiado sin que nadie las toque.
   *
   * Es el germen del reloj de la fase 2 y ya se puede responder con
   * lo que hay: `ultimoToqueEn` se mueve con cada cambio, así que
   * «lleva N días quieta» es una resta.
   */
  async frias(ambito: Ambito, dias = 7) {
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    return this.prisma.oportunidad.findMany({
      where: {
        convenioId: { in: ambito.convenios },
        etapa: { in: [...ETAPAS_ABIERTAS.EMPRESA, ...ETAPAS_ABIERTAS.PERSONA] },
        ultimoToqueEn: { lt: limite },
      },
      orderBy: { ultimoToqueEn: 'asc' },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        etapa: true,
        embudo: true,
        ultimoToqueEn: true,
        asesor: { select: { nombre: true } },
      },
    });
  }

  /** Sin contestar todavía: lo que mide la promesa de respuesta. */
  async sinRespuesta(ambito: Ambito) {
    const filas = await this.prisma.oportunidad.findMany({
      where: {
        convenioId: { in: ambito.convenios },
        primeraRespuestaEn: null,
        etapa: { in: [EtapaOportunidad.CAPTADO] },
      },
      orderBy: { creadoEn: 'asc' },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        embudo: true,
        creadoEn: true,
        campana: true,
        asesor: { select: { nombre: true } },
      },
    });
    const ahora = Date.now();
    return filas.map((f) => ({
      ...f,
      minutosEsperando: Math.round((ahora - f.creadoEn.getTime()) / 60_000),
    }));
  }

  /**
   * La portada: lo que hay que saber al entrar por la mañana.
   *
   * Una sola consulta y todo se calcula encima. La alternativa
   * —seis consultas agregadas, una por bloque— devuelve cifras que
   * pueden discrepar entre sí si algo cambia entre una y otra, y un
   * tablero cuyas partes no suman al total es un tablero al que
   * nadie vuelve.
   *
   * El volumen lo permite: son las oportunidades de una empresa, no
   * un histórico de años. El día que no quepan, esto se parte en
   * agregados de SQL y se nota aquí, no en las pantallas.
   */
  async resumen(ambito: Ambito) {
    const todas = await this.prisma.oportunidad.findMany({
      where: { convenioId: { in: ambito.convenios } },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        embudo: true,
        etapa: true,
        valor: true,
        probabilidad: true,
        campana: true,
        creadoEn: true,
        cerradaEn: true,
        ultimoToqueEn: true,
        primeraRespuestaEn: true,
        minutosPrimeraRespuesta: true,
        asesor: { select: { id: true, nombre: true } },
      },
    });

    const ahora = Date.now();
    const abiertas = todas.filter((o) => estaAbierta(o.etapa));

    /// El mes corriente, para lo ganado y lo perdido. Se compara
    /// contra `cerradaEn` y no contra `creadoEn`: lo que cuenta en
    /// el mes es lo que se cerró en el mes, aunque entrara en
    /// febrero.
    const inicioDeMes = new Date();
    inicioDeMes.setDate(1);
    inicioDeMes.setHours(0, 0, 0, 0);
    const delMes = todas.filter(
      (o) => o.cerradaEn !== null && o.cerradaEn >= inicioDeMes,
    );

    const sumar = (filas: typeof todas) =>
      filas.reduce((s, o) => s + Number(o.valor), 0);
    const ponderar = (filas: typeof todas) =>
      filas.reduce(
        (s, o) => s + valorPonderado(Number(o.valor), o.probabilidad),
        0,
      );

    /// Sin contestar: la unica cifra de la portada que exige una
    /// accion hoy y no un analisis el mes que viene.
    const esperando = todas
      .filter(
        (o) => o.primeraRespuestaEn === null && o.etapa === EtapaOportunidad.CAPTADO,
      )
      .map((o) => ({
        id: o.id,
        codigo: o.codigo,
        titulo: o.titulo,
        embudo: o.embudo,
        campana: o.campana,
        asesor: o.asesor,
        minutosEsperando: Math.round((ahora - o.creadoEn.getTime()) / 60_000),
      }))
      .sort((a, b) => b.minutosEsperando - a.minutosEsperando);

    /// Cuanto se tarda de verdad en contestar. La MEDIANA y no el
    /// promedio: un lead olvidado tres dias dispara la media y
    /// esconde que el resto se contesta en minutos.
    const tiempos = todas
      .filter((o) => o.minutosPrimeraRespuesta !== null)
      .map((o) => o.minutosPrimeraRespuesta as number)
      .sort((a, b) => a - b);
    const medianaRespuesta =
      tiempos.length === 0
        ? null
        : tiempos.length % 2 === 1
          ? tiempos[(tiempos.length - 1) / 2]
          : Math.round(
              (tiempos[tiempos.length / 2 - 1] + tiempos[tiempos.length / 2]) / 2,
            );

    /// De donde vienen los negocios, y cuales traen dinero. Es la
    /// pregunta que justifica el gasto en pauta, y la que ningun
    /// CRM contesta bien porque casi ninguno sabe de que campaña
    /// vino cada ficha.
    const porCampana = new Map<
      string,
      { campana: string; cuantas: number; abierto: number; ganado: number }
    >();
    for (const o of todas) {
      const clave = o.campana ?? 'Sin campaña';
      const fila = porCampana.get(clave) ?? {
        campana: clave,
        cuantas: 0,
        abierto: 0,
        ganado: 0,
      };
      fila.cuantas += 1;
      if (estaAbierta(o.etapa)) fila.abierto += Number(o.valor);
      if (o.etapa === EtapaOportunidad.GANADO) fila.ganado += Number(o.valor);
      porCampana.set(clave, fila);
    }

    /// Las que se estan enfriando. Siete dias es el umbral de
    /// arranque y sale de la nada; se ajusta cuando se sepa cuanto
    /// dura de verdad una venta aqui.
    const frias = abiertas
      .filter((o) => ahora - o.ultimoToqueEn.getTime() > 7 * 86_400_000)
      .map((o) => ({
        id: o.id,
        codigo: o.codigo,
        titulo: o.titulo,
        etapa: o.etapa,
        valor: Number(o.valor),
        asesor: o.asesor,
        dias: Math.floor((ahora - o.ultimoToqueEn.getTime()) / 86_400_000),
      }))
      .sort((a, b) => b.dias - a.dias);

    const porEtapa = [
      ...ETAPAS_ABIERTAS[TipoEmbudo.EMPRESA],
      ...ETAPAS_ABIERTAS[TipoEmbudo.PERSONA],
    ]
      .filter((e, i, todos) => todos.indexOf(e) === i)
      .map((etapa) => {
        const suyas = abiertas.filter((o) => o.etapa === etapa);
        return {
          etapa,
          rotulo: rotulo(etapa),
          cuantas: suyas.length,
          total: sumar(suyas),
        };
      });

    const ganadas = delMes.filter((o) => o.etapa === EtapaOportunidad.GANADO);
    const perdidas = delMes.filter((o) => o.etapa === EtapaOportunidad.PERDIDO);

    return {
      pronostico: {
        cuantas: abiertas.length,
        total: sumar(abiertas),
        ponderado: ponderar(abiertas),
        probabilidadesEstimadas: true,
      },
      mes: {
        ganadas: ganadas.length,
        ganado: sumar(ganadas),
        perdidas: perdidas.length,
        perdido: sumar(perdidas),
        /// De cada cien cerrados este mes, cuantos se ganaron.
        /// Null cuando no hay ninguno: un 0 % con cero cierres
        /// dice algo que no es verdad.
        tasa:
          ganadas.length + perdidas.length === 0
            ? null
            : Math.round((ganadas.length / (ganadas.length + perdidas.length)) * 100),
      },
      reloj: {
        esperando: esperando.length,
        pasadosDeCinco: esperando.filter((e) => e.minutosEsperando >= 5).length,
        medianaRespuesta,
        lista: esperando.slice(0, 6),
      },
      porEtapa,
      porCampana: [...porCampana.values()].sort((a, b) => b.abierto - a.abierto),
      frias: frias.slice(0, 6),
      cuantasFrias: frias.length,
    };
  }

  async unaSola(id: string, ambito: Ambito) {
    const o = await this.prisma.oportunidad.findFirst({
      where: { id, convenioId: { in: ambito.convenios } },
      include: {
        asesor: { select: { id: true, nombre: true } },
        empresa: { select: { id: true, razonSocial: true, nit: true } },
        persona: {
          select: {
            id: true,
            primerNombre: true,
            primerApellido: true,
            correo: true,
            celular: true,
          },
        },
        movimientos: { orderBy: { creadoEn: 'desc' } },
      },
    });
    if (!o) throw new NotFoundException('No encontramos esa oportunidad.');
    return { ...o, valor: Number(o.valor) };
  }
}
