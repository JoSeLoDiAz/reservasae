/** De dónde saca la carta sus logos y sus colores. */

/// Se resuelve con `obtenerMarcaDeGremio`, LA MISMA que pinta
/// el panel por Host y la que usa el correo de acceso. Una
/// tercera forma de elegir la marca acabaría enseñando el logo
/// de un gremio con los colores del otro — ya pasó una vez, y
/// está escrito en CLAUDE.md.

import { Injectable, Logger } from '@nestjs/common';

import { AdminService } from '../../admin/admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { esClaro, type MarcaDeLaCarta } from './carta';
import { urlPublica, urlPublicaDeLaApi } from '../url-publica';

/// Por qué le llega el correo. Va en el pie, y es lo que
/// separa un correo esperado de uno que parece spam.
/// El de siempre, del handoff de diseno.
const ESLOGAN = 'Relaciones que generan resultados';

const PORQUE = 'Recibe este correo porque se registró en una de nuestras acciones de formación.';

@Injectable()
export class MarcaDeCarta {
  private readonly log = new Logger('MarcaDeCarta');

  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
  ) {}

  /**
   * La marca del gremio de esa ficha.
   *
   * Sin `convenioId` --o si algo falla-- devuelve una carta sin
   * logos y con los colores neutros: un correo sin logo se lee;
   * uno que no sale, no.
   */
  async delConvenio(convenioId: string | null): Promise<MarcaDeLaCarta> {
    const gremio = convenioId
      ? await this.prisma.convenio.findUnique({
          where: { id: convenioId },
          select: { slug: true, sigla: true, nombre: true, correo: true },
        })
      : null;

    const sitio = urlPublica();

    const base: MarcaDeLaCarta = {
      colores: {},
      logos: [],
      signo: null,
      nombreApp: 'Convoca CRM',
      eslogan: ESLOGAN,
      gremio: gremio?.sigla ?? gremio?.nombre ?? 'Convoca CRM',
      /// El buzón que MANDA, no el de la entidad: responder a
      /// este correo tiene que llegar a alguien que lo lea, y
      /// quien lo lee es quien atiende `SMTP_USUARIO`.
      correoDeContacto: process.env.SMTP_DESDE ?? process.env.SMTP_USUARIO ?? null,
      porQueLoRecibe: PORQUE,
    };

    if (!gremio) return base;

    try {
      const marca = await this.admin.obtenerMarcaDeGremio(gremio.slug);
      const api = urlPublicaDeLaApi();

      const colores = (marca.temas.CLARO ?? {}) as Record<
        string,
        string | undefined
      >;

      return {
        ...base,
        colores,
        nombreApp: marca.nombreApp,
        /**
         * El signo, elegido por la BANDA y no por el tema.
         *
         * El blanco sobre una banda oscura y el oscuro sobre
         * una clara. Es la misma pregunta que en el panel
         * resuelve `currentColor` sin preguntar, y la que la
         * previsualizacion de los logos contesto mal una vez.
         */
        signo: sitio
          ? `${sitio}/signo-convoca${esClaro(colores.encabezadoFondo) ? '-oscuro' : ''}.png`
          : null,
        /**
         * SOLO LOS QUE SE VEN SOBRE LA PLACA BLANCA.
         *
         * No es la regla de luminancia del panel --esa mira el
         * color de la franja, y aquí la franja es siempre
         * blanca por la decisión de la placa--. Es la respuesta
         * fija a ese caso: sobre blanco va la versión clara.
         * Sin esto, los dos logos de ADECOPRIA, que son arte
         * blanco, salen como dos huecos.
         *
         * Y sin `URL_PUBLICA` no va ninguno: una imagen rota
         * arriba del todo es peor que ninguna.
         */
        logos: api
          ? marca.logos
              .filter((l) => l.esquema === 'AMBOS' || l.esquema === 'CLARO')
              .map((l) => ({
                url: `${api}/marca/logos/${l.id}?v=${l.version}`,
                alt: l.etiqueta,
              }))
          : [],
      };
    } catch (e) {
      this.log.warn(
        'No se pudo resolver la marca del gremio: ' +
          (e instanceof Error ? e.message : String(e)),
      );
      return base;
    }
  }
}
