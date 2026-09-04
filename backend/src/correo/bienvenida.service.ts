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
import { armarBienvenida, puertasDe } from './bienvenida';
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

@Injectable()
export class BienvenidaService {
  private readonly log = new Logger('Bienvenida');

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  /** Lo que se le manda, sin mandarlo. Para poder probarlo. */
  async armar(admin: CuentaNueva, claveTemporal: string) {
    const [tema, marca, logos, concesiones] = await Promise.all([
      this.prisma.tema.findUnique({ where: { esquema: 'CLARO' } }),
      this.prisma.marca.findFirst(),
      this.prisma.logo.findMany({
        where: { formularioId: null },
        orderBy: { orden: 'asc' },
        select: { id: true, version: true },
      }),
      this.prisma.adminConvenio.findMany({
        where: { adminId: admin.id },
        select: {
          rol: true,
          convenio: { select: { slug: true, sigla: true, nombre: true } },
        },
      }),
    ]);

    /// Sin `URL_PUBLICA` no hay logos, y es deliberado: una
    /// imagen rota arriba del todo es peor que ninguna.
    const api = urlPublicaDeLaApi();
    const sitio = urlPublica();

    const host = sitio ? new URL(sitio).host : 'reservasae.com';

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
      colores: (tema?.colores ?? {}) as Record<string, string | undefined>,
      logos: api
        ? logos.map((l) => `${api}/marca/logos/${l.id}?v=${l.version}`)
        : [],
      nombreApp: marca?.nombreApp ?? 'Convoca CRM',
      eslogan: 'Relaciones que generan resultados',
    });
  }

  /** Se lo manda a la persona. Nunca lanza. */
  async enviar(admin: CuentaNueva, claveTemporal: string): Promise<void> {
    try {
      const carta = await this.armar(admin, claveTemporal);
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
