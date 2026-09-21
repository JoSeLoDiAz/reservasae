/** Los parámetros con los que el tablero se arma solo. */

/**
 * LO QUE ANTES ERA CÓDIGO Y AHORA ES CONFIGURACIÓN.
 *
 * El compromiso de respuesta, el umbral de bananeo, los días para
 * considerar fría una oportunidad y la probabilidad de cada etapa
 * estaban escritos en `ans.ts`, `senales.ts` y `embudos.ts`. Cada
 * ajuste pedía un despliegue, y la dirección pidió lo contrario:
 * que las reglas se ajusten desde el panel y el Resumen se rearme
 * solo.
 *
 * LOS VALORES DEL CÓDIGO SIGUEN SIENDO LOS PREDETERMINADOS, y eso
 * no es un detalle: una base sin la fila de parámetros —o con la
 * fila a medias— se comporta EXACTAMENTE como antes. Aquí no se
 * inventa ningún número; lo único que hace este módulo es dejar
 * que se cambien.
 *
 * SE LEE EN CADA PETICIÓN Y NO SE CACHEA. Son dos consultas
 * diminutas contra una fila y catorce, y una caché convertiría
 * «cambié el umbral y el tablero no cambió» en el primer reporte
 * de fallo. Si algún día pesa, se cachea aquí y en un solo sitio.
 */

import { BadRequestException, Injectable } from '@nestjs/common';

import { EtapaOportunidad, TipoEmbudo } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { COMPROMISO_EN_MINUTOS } from '../oportunidades/ans';
import { ETAPAS_ABIERTAS, PROBABILIDAD } from '../oportunidades/embudos';
import { GESTIONES_PARA_BANANEO } from '../oportunidades/senales';
import { rotulo } from '../oportunidades/escalera';
import { ActualizarParametrosDto, ActualizarProbabilidadDto } from './dto';

/// Lo que el resto del backend necesita saber. Mismas formas que
/// las tablas que sustituye, para que las funciones puras las
/// reciban tal cual y se puedan seguir probando sin base.
export type ParametrosDelTablero = {
  ans: Record<TipoEmbudo, number>;
  bananeo: Record<TipoEmbudo, number>;
  diasParaFria: number;
  probabilidad: Record<TipoEmbudo, Record<EtapaOportunidad, number>>;
};

/// La fila es única y su id es fijo: no hay «parámetros de» nada,
/// hay LOS parámetros.
const UNICO = 'unico';

/// Los días para fría también estaban a mano, en el resumen, con
/// su propio comentario reconociendo que el número salía de la
/// nada. Sigue saliendo de la nada, pero ahora se puede corregir.
const DIAS_PARA_FRIA = 7;

/**
 * Las etapas de cada embudo, cerradas incluidas.
 *
 * PERSONA no tiene «cotización enviada» ni «en negociación»: la
 * tabla del código las declara en cero solo para que ningún
 * `probabilidadDe` devuelva `undefined`. Enseñarlas en la pantalla
 * sería ofrecer que se ajuste un número que después no se usa en
 * ningún cálculo.
 */
const ETAPAS_DEL_EMBUDO: Record<TipoEmbudo, EtapaOportunidad[]> = {
  [TipoEmbudo.EMPRESA]: [
    ...ETAPAS_ABIERTAS[TipoEmbudo.EMPRESA],
    EtapaOportunidad.GANADO,
    EtapaOportunidad.PERDIDO,
  ],
  [TipoEmbudo.PERSONA]: [
    ...ETAPAS_ABIERTAS[TipoEmbudo.PERSONA],
    EtapaOportunidad.GANADO,
    EtapaOportunidad.PERDIDO,
  ],
};

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Los parámetros vigentes, con los del código como respaldo. */
  async vigentes(): Promise<ParametrosDelTablero> {
    const [fila, probabilidades] = await Promise.all([
      this.prisma.parametrosDelTablero.findUnique({ where: { id: UNICO } }),
      this.prisma.probabilidadDeEtapa.findMany(),
    ]);

    /// Copia profunda de la tabla del código: si se devolviera la
    /// constante y alguien la escribiera, el fallo aparecería en
    /// otra petición y sería imposible de rastrear.
    const probabilidad = {
      [TipoEmbudo.EMPRESA]: { ...PROBABILIDAD[TipoEmbudo.EMPRESA] },
      [TipoEmbudo.PERSONA]: { ...PROBABILIDAD[TipoEmbudo.PERSONA] },
    };
    for (const p of probabilidades) {
      probabilidad[p.embudo][p.etapa] = p.porcentaje;
    }

    return {
      ans: {
        [TipoEmbudo.PERSONA]:
          fila?.ansPersonaMinutos ?? COMPROMISO_EN_MINUTOS[TipoEmbudo.PERSONA],
        [TipoEmbudo.EMPRESA]:
          fila?.ansEmpresaMinutos ?? COMPROMISO_EN_MINUTOS[TipoEmbudo.EMPRESA],
      },
      bananeo: {
        [TipoEmbudo.PERSONA]:
          fila?.bananeoPersona ?? GESTIONES_PARA_BANANEO[TipoEmbudo.PERSONA],
        [TipoEmbudo.EMPRESA]:
          fila?.bananeoEmpresa ?? GESTIONES_PARA_BANANEO[TipoEmbudo.EMPRESA],
      },
      diasParaFria: fila?.diasParaFria ?? DIAS_PARA_FRIA,
      probabilidad,
    };
  }

  /**
   * Lo mismo, pero contado para la pantalla de Configuración.
   *
   * Las probabilidades salen SIEMPRE completas —las etapas que
   * ese embudo tiene, ni una más— y cada una dice si la está
   * poniendo la base o el código. Sin ese dato, la pantalla no
   * puede explicar por qué cambia un número que nadie tocó.
   */
  async paraElPanel() {
    const [fila, guardadas, vigentes] = await Promise.all([
      this.prisma.parametrosDelTablero.findUnique({ where: { id: UNICO } }),
      this.prisma.probabilidadDeEtapa.findMany(),
      this.vigentes(),
    ]);

    const guardada = new Set(guardadas.map((p) => `${p.embudo}/${p.etapa}`));

    return {
      ans: vigentes.ans,
      bananeo: vigentes.bananeo,
      diasParaFria: vigentes.diasParaFria,
      /// Null mientras nadie los haya tocado: la pantalla dice
      /// «los de fábrica» en vez de una fecha inventada.
      actualizadoEn: fila?.actualizadoEn ?? null,
      probabilidades: Object.values(TipoEmbudo).flatMap((embudo) =>
        ETAPAS_DEL_EMBUDO[embudo].map((etapa) => ({
          embudo,
          etapa,
          rotulo: rotulo(etapa),
          porcentaje: vigentes.probabilidad[embudo][etapa],
          deFabrica: !guardada.has(`${embudo}/${etapa}`),
        })),
      ),
    };
  }

  /** Cambia los umbrales. Solo lo que venga; lo demás se queda. */
  async actualizar(dto: ActualizarParametrosDto, adminId: string) {
    const datos = {
      ...(dto.ansPersonaMinutos !== undefined && {
        ansPersonaMinutos: dto.ansPersonaMinutos,
      }),
      ...(dto.ansEmpresaMinutos !== undefined && {
        ansEmpresaMinutos: dto.ansEmpresaMinutos,
      }),
      ...(dto.bananeoPersona !== undefined && { bananeoPersona: dto.bananeoPersona }),
      ...(dto.bananeoEmpresa !== undefined && { bananeoEmpresa: dto.bananeoEmpresa }),
      ...(dto.diasParaFria !== undefined && { diasParaFria: dto.diasParaFria }),
      actualizadoPorId: adminId,
    };

    await this.prisma.parametrosDelTablero.upsert({
      where: { id: UNICO },
      create: { id: UNICO, ...datos },
      update: datos,
    });

    return this.paraElPanel();
  }

  /**
   * La probabilidad de una etapa.
   *
   * Las etapas que no son de ese embudo se rechazan: `PERSONA` no
   * tiene «cotización enviada», y dejar guardar un 40 % ahí llenaría
   * la pantalla de números que no se usan en ningún cálculo.
   */
  async fijarProbabilidad(dto: ActualizarProbabilidadDto) {
    if (!ETAPAS_DEL_EMBUDO[dto.embudo].includes(dto.etapa)) {
      throw new BadRequestException(
        'Esa etapa no es de ese embudo, así que su probabilidad no se usaría.',
      );
    }

    await this.prisma.probabilidadDeEtapa.upsert({
      where: { embudo_etapa: { embudo: dto.embudo, etapa: dto.etapa } },
      create: { embudo: dto.embudo, etapa: dto.etapa, porcentaje: dto.porcentaje },
      update: { porcentaje: dto.porcentaje },
    });

    return this.paraElPanel();
  }

  /**
   * Devolver una etapa a su valor de fábrica.
   *
   * Se BORRA la fila en vez de escribir el número del código: así
   * la etapa vuelve a seguir al código el día que ese número se
   * recalcule con el histórico, en lugar de quedarse congelada en
   * una copia.
   */
  async volverDeFabrica(embudo: TipoEmbudo, etapa: EtapaOportunidad) {
    await this.prisma.probabilidadDeEtapa.deleteMany({ where: { embudo, etapa } });
    return this.paraElPanel();
  }
}
