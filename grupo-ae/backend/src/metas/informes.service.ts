/** Las cinco preguntas que se le hacen al embudo cuando acaba el mes. */

import { BadRequestException, Injectable } from '@nestjs/common';

import {
  EtapaOportunidad,
  type MotivoCierre,
  type Prisma,
} from '../../generated/prisma';
import type { Ambito } from '../admin/admin.guard';
import {
  ETAPAS_CERRADAS,
  estaAbierta,
  valorPonderado,
} from '../oportunidades/embudos';
import { rotuloMotivo } from '../oportunidades/escalera';
import { PrismaService } from '../prisma/prisma.service';
import { calcularAvance } from './avance';
import { aPesos } from './dinero';
import { sumarMetas, type MetaQueSuma } from './sumar-metas';
import {
  claveDe,
  periodoDe,
  revisarPeriodo,
  rotuloDeMes,
  rotuloDePeriodo,
  ultimosDoceMeses,
  ventanaDe,
  ventanaDelMes,
} from './periodo';

/// Trae la fila del grupo, o la estrena. Se repite en los cinco
/// informes y escrito a mano cada vez se olvida el `set`.
function tomar<T>(mapa: Map<string, T>, clave: string, estrenar: () => T): T {
  const fila = mapa.get(clave) ?? estrenar();
  mapa.set(clave, fila);
  return fila;
}

/// De cada cien cerrados, cuántos se ganaron. NULL sin cierres: un
/// 0 % con cero cierres dice algo que no es verdad.
function tasaDeCierre(ganadas: number, perdidas: number): number | null {
  const cerradas = ganadas + perdidas;
  return cerradas === 0 ? null : Math.round((ganadas / cerradas) * 100);
}

/// El valor medio. NULL sin filas, por la misma razón.
function valorMedio(valor: number, cuantas: number): number | null {
  return cuantas === 0 ? null : Math.round(valor / cuantas);
}

@Injectable()
export class InformesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * El avance contra la meta: la cifra que dirige.
   *
   * Lo GANADO del mes contra lo que había que ganar, del equipo y
   * de cada quien, con los días que quedan y cuánto sale por día.
   *
   * Lo ganado se cuenta por `cerradaEn` y no por `creadoEn`: lo que
   * cierra el mes es lo que se cerró en el mes, aunque el negocio
   * entrara en febrero. Es la misma regla que usa la portada del
   * embudo, y tienen que decir lo mismo o una de las dos sobra.
   */
  async avanceContraLaMeta(ambito: Ambito, anio: number, mes: number) {
    const reparo = revisarPeriodo(anio, mes);
    if (reparo) throw new BadRequestException(reparo);

    const { desde, hasta } = ventanaDelMes(anio, mes);
    const ahora = new Date();

    const [ganadas, metas] = await Promise.all([
      this.prisma.oportunidad.findMany({
        where: {
          convenioId: { in: ambito.convenios },
          etapa: EtapaOportunidad.GANADO,
          cerradaEn: { gte: desde, lt: hasta },
        },
        select: {
          valor: true,
          asesorId: true,
          asesor: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.metaComercial.findMany({
        where: { convenioId: { in: ambito.convenios }, anio, mes },
        select: {
          convenioId: true,
          asesorId: true,
          embudo: true,
          valor: true,
          asesor: { select: { id: true, nombre: true } },
        },
      }),
    ]);

    type Persona = {
      asesorId: string | null;
      nombre: string;
      ganado: number;
      cuantas: number;
      metas: MetaQueSuma[];
    };
    const gente = new Map<string, Persona>();
    /// Las ventas sin dueño necesitan una clave que no choque con
    /// ningún id: van juntas en su propia fila.
    const claveDeAsesor = (id: string | null) => id ?? 'SIN_ASESOR';

    for (const g of ganadas) {
      const fila = tomar(gente, claveDeAsesor(g.asesorId), () => ({
        asesorId: g.asesorId,
        nombre: g.asesor?.nombre ?? 'Sin asesor',
        ganado: 0,
        cuantas: 0,
        metas: [],
      }));
      fila.ganado += aPesos(g.valor);
      fila.cuantas += 1;
    }

    for (const m of metas) {
      /// La del equipo no es de nadie: se suma aparte.
      if (m.asesorId === null) continue;
      const fila = tomar(gente, claveDeAsesor(m.asesorId), () => ({
        asesorId: m.asesorId,
        nombre: m.asesor?.nombre ?? 'Sin nombre',
        ganado: 0,
        cuantas: 0,
        metas: [],
      }));
      fila.metas.push(m);
    }

    const asesores = [...gente.values()]
      .map((p) => ({
        asesorId: p.asesorId,
        nombre: p.nombre,
        cuantasGanadas: p.cuantas,
        ...calcularAvance({
          meta: sumarMetas(p.metas),
          ganado: p.ganado,
          anio,
          mes,
          ahora,
        }),
      }))
      /// Arriba el que está más lejos de su meta, no el que más
      /// vendió: esta lista es para decidir a quién acompañar esta
      /// semana, no para premiar a nadie.
      .sort((a, b) => b.falta - a.falta || b.ganado - a.ganado);

    const ganadoDelEquipo = ganadas.reduce((s, g) => s + aPesos(g.valor), 0);

    return {
      periodo: { anio, mes, rotulo: rotuloDePeriodo(anio, mes) },
      equipo: {
        ...calcularAvance({
          meta: sumarMetas(metas.filter((m) => m.asesorId === null)),
          ganado: ganadoDelEquipo,
          anio,
          mes,
          ahora,
        }),
        cuantasGanadas: ganadas.length,
        /**
         * Lo que suman las metas individuales, al lado de la del
         * equipo.
         *
         * No tienen por qué coincidir —al objetivo del equipo se le
         * suele poner colchón— pero verlas juntas es la única forma
         * de notar que a alguien se le olvidó fijar la suya: la
         * suma se queda corta y ahí está la pista.
         *
         * Se suma sobre las filas ya calculadas y NO con
         * `sumarMetas` sobre todas las individuales juntas:
         * `sumarMetas` agrupa por convenio, así que con las metas de
         * varias personas mezcladas, la general de una taparía las
         * de embudo de otra. Además, así esta cifra es por
         * construcción la suma de la tabla que se enseña debajo.
         */
        sumaDeLasIndividuales: asesores.reduce((s, a) => s + a.meta, 0),
      },
      asesores,
    };
  }

  /**
   * Ganadas contra perdidas, y por qué.
   *
   * El desglose por motivo es la mitad del informe. Sin él, el
   * balance del año es «ganamos 40, perdimos 60» y no se aprende
   * nada; con él se ve que veinte se cayeron por precio y quince
   * porque nunca respondimos, que son dos problemas distintos y de
   * dos áreas distintas.
   */
  async ganadasContraPerdidas(
    ambito: Ambito,
    anio: number,
    mes?: number | null,
  ) {
    const reparo = revisarPeriodo(anio, mes ?? 1);
    if (reparo) throw new BadRequestException(reparo);

    const { desde, hasta } = ventanaDe(anio, mes);

    const cerradas = await this.prisma.oportunidad.findMany({
      where: {
        convenioId: { in: ambito.convenios },
        /// Las dos condiciones y no solo la fecha: al reabrir una
        /// oportunidad se le borra `cerradaEn`, pero si algún día
        /// se deja de borrar, esto sigue contando solo lo cerrado.
        etapa: { in: ETAPAS_CERRADAS },
        cerradaEn: { gte: desde, lt: hasta },
      },
      select: {
        etapa: true,
        valor: true,
        motivoCierre: true,
      },
    });

    const ganadas = cerradas.filter((c) => c.etapa === EtapaOportunidad.GANADO);
    const perdidas = cerradas.filter(
      (c) => c.etapa === EtapaOportunidad.PERDIDO,
    );

    const sumar = (filas: typeof cerradas) =>
      filas.reduce((s, f) => s + aPesos(f.valor), 0);

    const valorGanado = sumar(ganadas);
    const valorPerdido = sumar(perdidas);

    return {
      periodo: { anio, mes: mes ?? null, rotulo: rotuloDePeriodo(anio, mes) },
      ganadas: {
        cuantas: ganadas.length,
        valor: valorGanado,
        valorMedio: valorMedio(valorGanado, ganadas.length),
      },
      perdidas: {
        cuantas: perdidas.length,
        valor: valorPerdido,
        valorMedio: valorMedio(valorPerdido, perdidas.length),
      },
      tasa: tasaDeCierre(ganadas.length, perdidas.length),
      porQueSeGano: this.desglosePorMotivo(ganadas),
      porQueSePerdio: this.desglosePorMotivo(perdidas),
    };
  }

  /**
   * Por asesor: qué lleva vivo, qué ganó y qué perdió.
   *
   * Lo ABIERTO no se acota al periodo y lo CERRADO sí, a propósito.
   * Lo abierto es un retrato de hoy —lo que esta persona tiene
   * entre manos ahora mismo— y acotarlo a enero daría «las que
   * seguían abiertas en enero», que ya no significa nada en marzo.
   * Lo cerrado, en cambio, es un hecho con fecha.
   */
  async porAsesor(ambito: Ambito, anio: number, mes?: number | null) {
    const reparo = revisarPeriodo(anio, mes ?? 1);
    if (reparo) throw new BadRequestException(reparo);

    const { desde, hasta } = ventanaDe(anio, mes);

    const filas = await this.prisma.oportunidad.findMany({
      where: {
        convenioId: { in: ambito.convenios },
        OR: [
          { etapa: { notIn: ETAPAS_CERRADAS } },
          { cerradaEn: { gte: desde, lt: hasta } },
        ],
      },
      select: {
        etapa: true,
        valor: true,
        probabilidad: true,
        asesorId: true,
        asesor: { select: { id: true, nombre: true } },
      },
    });

    type Fila = {
      asesorId: string | null;
      nombre: string;
      abiertas: { cuantas: number; valor: number; ponderado: number };
      ganadas: { cuantas: number; valor: number };
      perdidas: { cuantas: number; valor: number };
    };
    const gente = new Map<string, Fila>();

    for (const f of filas) {
      const fila = tomar(gente, f.asesorId ?? 'SIN_ASESOR', () => ({
        asesorId: f.asesorId,
        nombre: f.asesor?.nombre ?? 'Sin asesor',
        abiertas: { cuantas: 0, valor: 0, ponderado: 0 },
        ganadas: { cuantas: 0, valor: 0 },
        perdidas: { cuantas: 0, valor: 0 },
      }));

      const valor = aPesos(f.valor);
      if (estaAbierta(f.etapa)) {
        fila.abiertas.cuantas += 1;
        fila.abiertas.valor += valor;
        /// Lo que un adulto espera cobrar de lo que tiene vivo,
        /// no lo que suma la lista.
        fila.abiertas.ponderado += valorPonderado(valor, f.probabilidad);
      } else if (f.etapa === EtapaOportunidad.GANADO) {
        fila.ganadas.cuantas += 1;
        fila.ganadas.valor += valor;
      } else {
        fila.perdidas.cuantas += 1;
        fila.perdidas.valor += valor;
      }
    }

    return {
      periodo: { anio, mes: mes ?? null, rotulo: rotuloDePeriodo(anio, mes) },
      /// Lo abierto es de hoy y lo cerrado es del periodo: se dice
      /// aquí para que el panel lo pueda escribir en la cabecera de
      /// la tabla y nadie sume peras con manzanas.
      abiertasAlDiaDeHoy: true,
      asesores: [...gente.values()]
        .map((f) => ({
          ...f,
          tasa: tasaDeCierre(f.ganadas.cuantas, f.perdidas.cuantas),
        }))
        .sort((a, b) => b.ganadas.valor - a.ganadas.valor),
    };
  }

  /**
   * Por campaña: la cifra que justifica el gasto en pauta.
   *
   * La ventana se aplica a lo que ENTRÓ, y lo ganado se cuenta de
   * esas mismas oportunidades aunque cerraran después. Es la única
   * atribución que responde a la pregunta que se hace: «la pauta de
   * marzo, ¿qué trajo?». Contar lo ganado en marzo mezclaría el
   * dinero de la pauta de enero con el gasto de marzo, y entonces
   * el informe premia a la campaña equivocada.
   *
   * El precio de esa decisión hay que decirlo: las campañas del mes
   * corriente siempre se ven mal, porque lo que trajeron todavía no
   * ha tenido tiempo de cerrar. Por eso el informe viaja marcado
   * con `atribucionPorEntrada`: el panel tiene que poder escribir
   * al lado que estas cifras miden la cosecha, no el mes.
   */
  async porCampana(ambito: Ambito, anio: number, mes?: number | null) {
    const reparo = revisarPeriodo(anio, mes ?? 1);
    if (reparo) throw new BadRequestException(reparo);

    const { desde, hasta } = ventanaDe(anio, mes);

    const filas = await this.prisma.oportunidad.findMany({
      where: {
        convenioId: { in: ambito.convenios },
        creadoEn: { gte: desde, lt: hasta },
      },
      select: {
        campana: true,
        leadId: true,
        etapa: true,
        valor: true,
      },
    });

    type Fila = {
      campana: string;
      cuantas: number;
      /// Cuántas de esas entraron solas por la mesa de entrada. Es
      /// el número de leads que trajo el anuncio; el resto lo
      /// escribió un asesor a mano.
      leads: number;
      abiertas: number;
      abierto: number;
      ganadas: number;
      ganado: number;
      perdidas: number;
      perdido: number;
    };
    const campanas = new Map<string, Fila>();

    for (const f of filas) {
      /// Sin campaña también es una fila: normalmente es la más
      /// grande, y esconderla haría que los porcentajes de las
      /// demás mintieran.
      const clave = f.campana?.trim() || 'Sin campaña';
      const fila = tomar(campanas, clave, () => ({
        campana: clave,
        cuantas: 0,
        leads: 0,
        abiertas: 0,
        abierto: 0,
        ganadas: 0,
        ganado: 0,
        perdidas: 0,
        perdido: 0,
      }));

      const valor = aPesos(f.valor);
      fila.cuantas += 1;
      if (f.leadId !== null) fila.leads += 1;
      if (estaAbierta(f.etapa)) {
        fila.abiertas += 1;
        fila.abierto += valor;
      } else if (f.etapa === EtapaOportunidad.GANADO) {
        fila.ganadas += 1;
        fila.ganado += valor;
      } else {
        fila.perdidas += 1;
        fila.perdido += valor;
      }
    }

    return {
      periodo: { anio, mes: mes ?? null, rotulo: rotuloDePeriodo(anio, mes) },
      /// Las oportunidades se cuentan por cuándo entraron, y lo
      /// ganado se les atribuye a ellas cierren cuando cierren.
      atribucionPorEntrada: true,
      campanas: [...campanas.values()]
        .map((f) => ({
          ...f,
          tasa: tasaDeCierre(f.ganadas, f.perdidas),
          /// De todo lo que trajo, cuánto acabó en venta. El
          /// denominador nunca es cero: la fila existe porque hay
          /// al menos una.
          conversion: Math.round((f.ganadas / f.cuantas) * 100),
        }))
        .sort((a, b) => b.ganado - a.ganado || b.abierto - a.abierto),
    };
  }

  /**
   * El embudo en el tiempo: cuántas entraron y cuántas se cerraron,
   * mes a mes, los últimos doce.
   *
   * Las dos series en la misma tabla y no en dos informes: lo que
   * se busca aquí es la tijera —el mes en que empezaron a entrar
   * más de las que se cierran— y esa figura solo se ve con las dos
   * curvas encima.
   */
  async embudoEnElTiempo(ambito: Ambito) {
    const meses = ultimosDoceMeses(new Date());
    const { desde } = ventanaDelMes(meses[0].anio, meses[0].mes);

    const filas = await this.prisma.oportunidad.findMany({
      where: {
        convenioId: { in: ambito.convenios },
        /// Una oportunidad entra en el informe si ENTRÓ o si CERRÓ
        /// dentro de la ventana. Las dos cosas por separado: una de
        /// hace dos años que se cerró el mes pasado cuenta en la
        /// curva de cierres, y filtrar solo por `creadoEn` la
        /// dejaría fuera.
        OR: [{ creadoEn: { gte: desde } }, { cerradaEn: { gte: desde } }],
      },
      select: {
        creadoEn: true,
        cerradaEn: true,
        etapa: true,
        valor: true,
      },
    });

    type Fila = {
      anio: number;
      mes: number;
      clave: string;
      rotulo: string;
      entraron: number;
      valorEntrado: number;
      cerradas: number;
      ganadas: number;
      ganado: number;
      perdidas: number;
      perdido: number;
    };

    const porMes = new Map<string, Fila>();
    for (const m of meses) {
      porMes.set(claveDe(m), {
        anio: m.anio,
        mes: m.mes,
        clave: claveDe(m),
        rotulo: rotuloDeMes(m.mes),
        entraron: 0,
        valorEntrado: 0,
        cerradas: 0,
        ganadas: 0,
        ganado: 0,
        perdidas: 0,
        perdido: 0,
      });
    }

    for (const f of filas) {
      const valor = aPesos(f.valor);

      /// El mes al que pertenece cada fecha se resuelve en hora de
      /// Bogotá, no comparando contra doce ventanas: una fecha, un
      /// mes, y se acabó.
      const entrada = porMes.get(claveDe(periodoDe(f.creadoEn)));
      if (entrada) {
        entrada.entraron += 1;
        entrada.valorEntrado += valor;
      }

      if (f.cerradaEn && !estaAbierta(f.etapa)) {
        const cierre = porMes.get(claveDe(periodoDe(f.cerradaEn)));
        if (cierre) {
          cierre.cerradas += 1;
          if (f.etapa === EtapaOportunidad.GANADO) {
            cierre.ganadas += 1;
            cierre.ganado += valor;
          } else {
            cierre.perdidas += 1;
            cierre.perdido += valor;
          }
        }
      }
    }

    return {
      /// Del más viejo al corriente: es el orden en el que se
      /// dibuja una serie de tiempo.
      meses: [...porMes.values()].map((f) => ({
        ...f,
        tasa: tasaDeCierre(f.ganadas, f.perdidas),
      })),
      /// El último de la lista es el mes en curso y todavía no ha
      /// terminado. Sin este aviso, la última columna siempre
      /// parece una caída.
      ultimoMesIncompleto: true,
    };
  }

  /// El desglose de un cierre por su motivo, ordenado por el que
  /// más veces pasa.
  private desglosePorMotivo(
    filas: { motivoCierre: MotivoCierre | null; valor: Prisma.Decimal }[],
  ) {
    type Fila = {
      motivo: MotivoCierre | null;
      rotulo: string;
      cuantas: number;
      valor: number;
    };
    const motivos = new Map<string, Fila>();

    for (const f of filas) {
      const fila = tomar(motivos, f.motivoCierre ?? 'SIN_MOTIVO', () => ({
        motivo: f.motivoCierre,
        /// Las cerradas antes de que la compuerta exigiera motivo.
        /// Se enseñan aparte en lugar de repartirlas entre los
        /// demás: inventarles una razón es peor que contarlas.
        rotulo: f.motivoCierre ? rotuloMotivo(f.motivoCierre) : 'Sin motivo',
        cuantas: 0,
        valor: 0,
      }));
      fila.cuantas += 1;
      fila.valor += aPesos(f.valor);
    }

    return [...motivos.values()]
      .map((f) => ({
        ...f,
        /// `filas.length` es cero solo si no hay ninguna fila, y
        /// entonces esta lista está vacía y esto no se ejecuta.
        /// La guarda está igual: un NaN en pantalla no se explica.
        porcentaje: filas.length
          ? Math.round((f.cuantas / filas.length) * 100)
          : 0,
      }))
      .sort((a, b) => b.cuantas - a.cuantas);
  }
}
