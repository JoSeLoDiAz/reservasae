/** Manda el correo de acceso a quien estrena cuenta. */

/// Nunca tumba la creación de la cuenta. Si el correo está
/// apagado o el servidor lo rechaza, la cuenta ya existe y su
/// clave temporal se ve en pantalla: perder la cuenta por no
/// poder avisar sería peor que no avisar.

import { Injectable, Logger } from '@nestjs/common';

import type { RolAdmin, RolConvenio } from '../../generated/prisma';
import { hostDelGremio } from '../comun/host-del-gremio';
import { papelDe } from '../admin/roles-en-palabras';
import { PrismaService } from '../prisma/prisma.service';
import { armarBienvenida, esClaro, puertasDe } from './bienvenida';
import { CorreoService } from './correo.service';
import { quienFirma } from './quien-firma';
import { urlPublica, urlPublicaDeLaApi } from './url-publica';

/// Lo justo para escribirle. No pide el `Admin` entero: eso
/// arrastra el hash de la clave a un sitio que no lo necesita.
export type CuentaNueva = {
  id: string;
  nombre: string;
  correo: string;
  rol: RolAdmin;
};

/**
 * De dónde salen el logo y los colores.
 *
 * La resuelve quien llama, con `obtenerMarcaDeGremio` o con
 * `obtenerMarca` — las MISMAS que pintan el panel por Host.
 * Aquí solo se consume: una segunda forma de resolver la
 * marca acabaría discrepando de la del panel, que es el
 * defecto que este proyecto lleva rondas documentando.
 */
export type MarcaDelCorreo = {
  nombreApp: string;
  logos: Array<{ id: string; etiqueta: string; version: number }>;
  temas: Record<string, Record<string, string> | undefined>;
};

@Injectable()
export class BienvenidaService {
  private readonly log = new Logger('Bienvenida');

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  /** Lo que se le manda, sin mandarlo. Para poder probarlo. */
  async armar(admin: CuentaNueva, claveTemporal: string, marca: MarcaDelCorreo) {
    const concesiones = await this.prisma.adminConvenio.findMany({
      where: { adminId: admin.id },
      select: {
        rol: true,
        convenio: { select: { slug: true, sigla: true, nombre: true } },
      },
    });

    /// Sin `URL_PUBLICA` no hay logos, y es deliberado: una
    /// imagen rota arriba del todo es peor que ninguna.
    const api = urlPublicaDeLaApi();
    const sitio = urlPublica();
    const host = sitio ? new URL(sitio).host : 'reservasae.com';

    const claro = (marca.temas.CLARO ?? {}) as Record<string, string | undefined>;

    const gremios = concesiones.map((c) => ({
      slug: c.convenio.slug,
      sigla: c.convenio.sigla ?? c.convenio.nombre,
    }));

    return armarBienvenida({
      nombre: admin.nombre,
      correo: admin.correo,
      claveTemporal,
      papel: papelDe(concesiones.map((c) => c.rol as RolConvenio)),
      gremios: gremios.map((g) => g.sigla),
      puertas: puertasDe({
        hostDelSitio: host,
        esSuperadmin: admin.rol === 'SUPERADMIN',
        puertaGeneralSoloSuperadmin:
          process.env.PANEL_GENERAL_SOLO_SUPERADMIN === 'si',
        gremios,
        hostDeGremio: (slug) => hostDelGremio(host, slug),
      }),
      colores: claro,
      /// El blanco sobre una banda oscura y el oscuro sobre
      /// una clara, mirando el color del TEXTO del encabezado
      /// — que es de donde el panel lo saca.
      signo: sitio
        ? `${sitio}/signo-convoca${esClaro(claro.encabezadoTexto) ? '' : '-oscuro'}.png`
        : null,
      logos: api
        ? marca.logos.map((l) => ({
            url: `${api}/marca/logos/${l.id}?v=${l.version}`,
            alt: l.etiqueta,
          }))
        : [],
      nombreApp: marca.nombreApp,
      eslogan: 'Relaciones que generan resultados',
    });
  }

  /** Se lo manda a la persona. Nunca lanza. */
  async enviar(
    admin: CuentaNueva,
    claveTemporal: string,
    marca: MarcaDelCorreo,
  ): Promise<void> {
    try {
      const carta = await this.armar(admin, claveTemporal, marca);
      const r = await this.correo.enviar({
        /// Firma el nombre general y no un gremio: la cuenta
        /// es del SISTEMA, y puede alcanzar a los dos.
        deParte: quienFirma(null),
        para: admin.correo,
        ...carta,
      });
      if (r.estado === 'FALLO') {
        this.log.warn(`No salió el acceso de ${admin.correo}: ${r.error}`);
      }
    } catch (e) {
      this.log.error(
        `No se pudo armar el acceso de ${admin.correo}: ${(e as Error).message}`,
      );
    }
  }
}
