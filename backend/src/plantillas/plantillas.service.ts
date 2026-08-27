/** Descargar el formato, y aplicar lo que suban. */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { AuditoriaService, type Actor } from '../comun/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { CATALOGO, type Entidad } from './catalogo';
import { construirFormato, leerPlantilla, type Reparo } from './plantillas';

/// Lo que se le contesta a quien sube un archivo.
export type Resultado = {
  /// Se aplicó de verdad, o solo se revisó.
  aplicado: boolean;
  leidas: number;
  actualizadas: number;
  creadas: number;
  /// Filas que no se encontraron y no se pueden crear.
  sinPareja: Array<{ fila: number; llave: string }>;
  reparos: Reparo[];
  /// Celdas que venían vacías. No borraron nada, se saltaron.
  vacias: number;
};

/// Las razones sociales van en mayúscula: en el NIT, en el
/// RUES y en el F7 así viven, y son documentos legales.
const EN_MAYUSCULAS = new Set([
  'razonSocial',
  'nombreComercial',
  'sectorEconomico',
]);

@Injectable()
export class PlantillasService {
  private readonly log = new Logger('Plantillas');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * El formato en blanco, con lo que ya hay dentro.
   *
   * Se baja con los datos actuales y no vacío: corregir sobre
   * lo que existe es el caso normal, y obligar a teclear el
   * NIT de doscientas empresas para cambiarles un teléfono
   * garantiza que alguien se equivoque en uno.
   */
  async formato(entidad: Entidad, convenios: string[]): Promise<Buffer> {
    const def = CATALOGO[entidad];
    const filas = await this.leerLoQueHay(entidad, convenios);
    return construirFormato(def.plantilla, filas);
  }

  /**
   * Aplica un archivo.
   *
   * Con `ensayo` no escribe nada: devuelve lo que haría. Es
   * lo que uno quiere ver antes de dejar que algo pise dos
   * mil filas.
   *
   * Y no hay aplicación a medias: si hay un solo reparo, no
   * se escribe nada. Un cargue que arregla la mitad y deja la
   * otra rota es peor que uno que no corre.
   */
  async aplicar(
    entidad: Entidad,
    archivo: Buffer,
    actor: Actor,
    convenios: string[],
    ensayo: boolean,
  ): Promise<Resultado> {
    const def = CATALOGO[entidad];
    const lectura = await leerPlantilla(archivo, def.plantilla);

    const vacio: Resultado = {
      aplicado: false,
      leidas: lectura.filas.length,
      actualizadas: 0,
      creadas: 0,
      sinPareja: [],
      reparos: lectura.reparos,
      vacias: lectura.vacias,
    };

    if (lectura.reparos.length > 0) return vacio;
    if (lectura.filas.length === 0) {
      return {
        ...vacio,
        reparos: [
          { fila: 0, columna: '', problema: 'El archivo no trae ninguna fila.' },
        ],
      };
    }

    // solo se tocan las columnas que el archivo trajo: las
    // que no vinieron se quedan como estaban
    const campos = lectura.columnasTraidas.filter(
      (c) => !def.plantilla.columnas.find((x) => x.clave === c)?.llave,
    );

    if (campos.length === 0) {
      return {
        ...vacio,
        reparos: [
          {
            fila: 1,
            columna: '',
            problema:
              'El archivo solo trae la columna que identifica la fila. ' +
              'No hay nada que corregir.',
          },
        ],
      };
    }

    return entidad === 'reservas'
      ? this.aplicarReservas(lectura, campos, actor, convenios, ensayo)
      : this.aplicarEmpresas(entidad, lectura, campos, actor, convenios, ensayo);
  }

  // ── lo que ya hay, para bajarlo en el formato ───────────

  private async leerLoQueHay(entidad: Entidad, convenios: string[]) {
    if (entidad === 'instituciones') {
      const filas = await this.prisma.institucion.findMany({
        where: { activo: true },
        orderBy: { razonSocial: 'asc' },
      });
      return filas.map((f) => ({
        nit: f.nit,
        razonSocial: f.razonSocial,
        direccion: f.direccion ?? '',
        telefono: f.telefono ?? '',
        correo: f.correo ?? '',
        ciudadNombre: f.ciudadNombre ?? '',
        departamentoNombre: f.departamentoNombre ?? '',
        sectorEconomico: f.sectorEconomico ?? '',
        codigoCiiu: f.codigoCiiu ?? '',
        numeroEmpleados: f.numeroEmpleados ?? '',
      }));
    }

    if (entidad === 'empresas') {
      const filas = await this.prisma.empresa.findMany({
        /// Las mismas que ensena el panel, ni una mas.
        ///
        /// La organizacion se comparte entre convenios por
        /// decision del cliente, pero el panel solo lista las
        /// que tienen alguna reserva dentro del ambito. Sin
        /// este filtro la descarga traia TODAS, que es una
        /// lista de contactos mas larga que la pantalla de la
        /// que se descarga.
        where: {
          reservas: {
            some: { oferta: { accionFormacion: { convenioId: { in: convenios } } } },
          },
        },
        orderBy: { razonSocial: 'asc' },
      });
      return filas.map((f) => ({
        nit: f.nit,
        razonSocial: f.razonSocial,
        digitoVerificacion: f.digitoVerificacion ?? '',
        direccion: f.direccion ?? '',
        telefono: f.telefono ?? '',
        sectorEconomico: f.sectorEconomico ?? '',
        numeroTrabajadores: f.numeroTrabajadores ?? '',
        contactoNombre: f.contactoNombre ?? '',
        contactoCargo: f.contactoCargo ?? '',
        contactoCorreo: f.contactoCorreo ?? '',
      }));
    }

    const filas = await this.prisma.reserva.findMany({
      where: {
        canceladaEn: null,
        oferta: { accionFormacion: { convenioId: { in: convenios } } },
      },
      orderBy: { creadoEn: 'desc' },
      select: {
        id: true,
        cuposSolicitados: true,
        contactoNombre: true,
        contactoCargo: true,
        contactoCorreo: true,
        contactoCelular: true,
        empresa: { select: { nit: true, razonSocial: true } },
        oferta: {
          select: {
            accionFormacion: { select: { codigo: true, nombre: true } },
            ubicacion: { select: { nombre: true } },
          },
        },
      },
    });

    return filas.map((f) => ({
      id: f.id,
      nit: f.empresa.nit,
      organizacion: f.empresa.razonSocial,
      formacion:
        `${f.oferta.accionFormacion.codigo} · ${f.oferta.accionFormacion.nombre}` +
        ` · ${f.oferta.ubicacion.nombre}`,
      cuposSolicitados: f.cuposSolicitados,
      contactoNombre: f.contactoNombre,
      contactoCargo: f.contactoCargo ?? '',
      contactoCorreo: f.contactoCorreo,
      contactoCelular: f.contactoCelular ?? '',
    }));
  }

  // ── empresas e instituciones ───────────────────────────

  private async aplicarEmpresas(
    entidad: 'instituciones' | 'empresas',
    lectura: Awaited<ReturnType<typeof leerPlantilla>>,
    campos: string[],
    actor: Actor,
    convenios: string[],
    ensayo: boolean,
  ): Promise<Resultado> {
    const def = CATALOGO[entidad];
    const nits = lectura.filas.map((f) => this.soloDigitos(f.valores.nit));

    const existen =
      entidad === 'instituciones'
        ? await this.prisma.institucion.findMany({
            where: { nit: { in: nits } },
            select: { id: true, nit: true },
          })
        : await this.prisma.empresa.findMany({
            /// Las mismas que baja la plantilla, ni una mas.
            ///
            /// La organizacion se comparte entre convenios por
            /// decision del cliente, pero un cargue que pise
            /// una que no tiene ni una reserva dentro del
            /// ambito escribe en datos que esa cuenta no
            /// deberia estar tocando. Las que no cuadren caen
            /// en `sinPareja` y se reportan.
            where: {
              nit: { in: nits },
              reservas: {
                some: { oferta: { accionFormacion: { convenioId: { in: convenios } } } },
              },
            },
            select: { id: true, nit: true },
          });

    const porNit = new Map(existen.map((e) => [e.nit, e.id]));

    const sinPareja = lectura.filas
      .filter((f) => !porNit.has(this.soloDigitos(f.valores.nit)))
      .map((f) => ({ fila: f.fila, llave: f.valores.nit }));

    if (!def.admiteNuevas && sinPareja.length > 0) {
      return {
        aplicado: false,
        leidas: lectura.filas.length,
        actualizadas: 0,
        creadas: 0,
        sinPareja,
        vacias: lectura.vacias,
        reparos: sinPareja.map((s) => ({
          fila: s.fila,
          columna: 'NIT',
          problema:
            `El NIT ${s.llave} no existe, y aquí no se crean organizaciones ` +
            'a mano. Quite esa fila o consúltelo primero.',
        })),
      };
    }

    if (ensayo) {
      return {
        aplicado: false,
        leidas: lectura.filas.length,
        actualizadas: lectura.filas.length - sinPareja.length,
        creadas: def.admiteNuevas ? sinPareja.length : 0,
        sinPareja: def.admiteNuevas ? [] : sinPareja,
        reparos: [],
        vacias: lectura.vacias,
      };
    }

    let actualizadas = 0;
    let creadas = 0;

    for (const f of lectura.filas) {
      const nit = this.soloDigitos(f.valores.nit);
      const datos = this.aDatos(f.valores, campos, entidad);
      const id = porNit.get(nit);

      if (id) {
        if (entidad === 'instituciones') {
          await this.prisma.institucion.update({ where: { id }, data: datos });
        } else {
          await this.prisma.empresa.update({ where: { id }, data: datos });
        }
        actualizadas += 1;
      } else if (def.admiteNuevas) {
        await this.prisma.empresa.create({
          data: {
            nit,
            razonSocial: String(datos.razonSocial ?? `Organización ${nit}`),
            ...datos,
          },
        });
        creadas += 1;
      }
    }

    /// La huella. Sin esto, «sobrescribe» sería «pisa y nadie
    /// sabe». Van los NOMBRES de los campos, no los valores:
    /// es la misma regla del resto de la auditoría.
    await this.auditoria.registrar({
      actor,
      accion: 'PARTICIPANTE_EDITADO',
      entidad: entidad === 'instituciones' ? 'Institucion' : 'Empresa',
      entidadId: 'cargue-masivo',
      resumen:
        `Cargue por plantilla: ${actualizadas} actualizadas` +
        (creadas > 0 ? `, ${creadas} creadas` : ''),
      camposTocados: campos,
    });

    this.log.log(
      `Cargue de ${entidad} por ${actor.nombre}: ${actualizadas} actualizadas, ${creadas} creadas.`,
    );

    return {
      aplicado: true,
      leidas: lectura.filas.length,
      actualizadas,
      creadas,
      sinPareja: [],
      reparos: [],
      vacias: lectura.vacias,
    };
  }

  // ── reservas ───────────────────────────────────────────

  private async aplicarReservas(
    lectura: Awaited<ReturnType<typeof leerPlantilla>>,
    campos: string[],
    actor: Actor,
    convenios: string[],
    ensayo: boolean,
  ): Promise<Resultado> {
    const ids = lectura.filas.map((f) => f.valores.id);

    // el ámbito también aquí: un id de otro gremio no se toca
    const existen = await this.prisma.reserva.findMany({
      where: {
        id: { in: ids },
        oferta: { accionFormacion: { convenioId: { in: convenios } } },
      },
      select: { id: true },
    });
    const vivas = new Set(existen.map((e) => e.id));

    const sinPareja = lectura.filas
      .filter((f) => !vivas.has(f.valores.id))
      .map((f) => ({ fila: f.fila, llave: f.valores.id }));

    if (sinPareja.length > 0) {
      return {
        aplicado: false,
        leidas: lectura.filas.length,
        actualizadas: 0,
        creadas: 0,
        sinPareja,
        vacias: lectura.vacias,
        reparos: sinPareja.map((s) => ({
          fila: s.fila,
          columna: 'Id de la reserva',
          problema:
            'Ese id no corresponde a ninguna reserva suya. No cambie esa ' +
            'columna: es la que identifica la fila.',
        })),
      };
    }

    if (ensayo) {
      return {
        aplicado: false,
        leidas: lectura.filas.length,
        actualizadas: lectura.filas.length,
        creadas: 0,
        sinPareja: [],
        reparos: [],
        vacias: lectura.vacias,
      };
    }

    for (const f of lectura.filas) {
      await this.prisma.reserva.update({
        where: { id: f.valores.id },
        data: this.aDatos(f.valores, campos, 'reservas'),
      });
    }

    await this.auditoria.registrar({
      actor,
      accion: 'PARTICIPANTE_EDITADO',
      entidad: 'Reserva',
      entidadId: 'cargue-masivo',
      resumen: `Cargue por plantilla: ${lectura.filas.length} reservas`,
      camposTocados: campos,
    });

    return {
      aplicado: true,
      leidas: lectura.filas.length,
      actualizadas: lectura.filas.length,
      creadas: 0,
      sinPareja: [],
      reparos: [],
      vacias: lectura.vacias,
    };
  }

  // ── de texto a lo que espera la base ───────────────────

  private aDatos(
    valores: Record<string, string>,
    campos: string[],
    entidad: Entidad,
  ): Record<string, unknown> {
    const NUMEROS = new Set([
      'numeroEmpleados',
      'numeroTrabajadores',
      'cuposSolicitados',
    ]);

    const datos: Record<string, unknown> = {};
    for (const c of campos) {
      const bruto = valores[c];
      if (bruto === undefined) continue;

      if (NUMEROS.has(c)) {
        const n = Number(bruto.replace(/[^\d-]/g, ''));
        if (!Number.isFinite(n)) {
          throw new BadRequestException(
            `«${bruto}» no es un número, y esa columna lo espera.`,
          );
        }
        datos[c] = n;
        continue;
      }

      datos[c] = EN_MAYUSCULAS.has(c) ? bruto.toUpperCase() : bruto;
    }

    // el catálogo decide qué campos existen; esto solo evita
    // que un título raro se cuele como columna de Prisma
    const conocidas = new Set(
      CATALOGO[entidad].plantilla.columnas.map((c) => c.clave),
    );
    for (const k of Object.keys(datos)) {
      if (!conocidas.has(k)) delete datos[k];
    }

    return datos;
  }

  private soloDigitos(v: string): string {
    return (v ?? '').replace(/\D/g, '');
  }
}
