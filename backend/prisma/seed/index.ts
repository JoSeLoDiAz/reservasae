/**
 * Carga el catálogo de los dos proyectos en la base.
 *
 * Es idempotente a propósito: se puede correr en cada despliegue. Lo único que
 * NUNCA toca es `cuposOcupados`; ese contador lo mueven las reservas y
 * reescribirlo desde el seed borraría reservas reales del conteo.
 *
 * El JSON lo genera `scripts/extraer-catalogo.py` desde `docs/proyectos/`.
 * Aquí no se lee Excel: en producción no hay Python.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient, Modalidad, TipoUbicacion } from '../../generated/prisma';

const prisma = new PrismaClient();

type CoberturaJson = {
  ubicacion: string;
  tipo: 'CIUDAD' | 'DEPARTAMENTO';
  departamento: string | null;
  modalidad: 'PRESENCIAL' | 'VIRTUAL';
  cuposBase: number;
  cuposMaximos: number;
};

type CatalogoJson = {
  sobrecupo: number;
  convenios: Array<{
    slug: string;
    entidad: {
      nombre: string;
      sigla: string | null;
      nit: string | null;
      digitoVerificacion: string | null;
      correo: string | null;
      telefono: string | null;
      departamento: string | null;
      ciudad: string | null;
      direccion: string | null;
      paginaWeb: string | null;
    };
    acciones: Array<{
      codigo: string;
      orden: number;
      nombre: string;
      modalidad: string | null;
      evento: string | null;
      enfoque: string | null;
      metodologia: string | null;
      horas: number | null;
      objetivo: string | null;
      ambiente: string | null;
      grupos: Array<{
        numero: number;
        sedeCiudad: string | null;
        sedeDepartamento: string | null;
        coberturas: CoberturaJson[];
      }>;
      ofertas: Array<{
        ubicacion: string;
        tipo: 'CIUDAD' | 'DEPARTAMENTO';
        departamento: string | null;
        modalidad: 'PRESENCIAL' | 'VIRTUAL';
        cuposBase: number;
        cuposMaximos: number;
        grupos: number[];
      }>;
    }>;
  }>;
};

/** Cachea las ubicaciones ya creadas para no consultar la base 114 veces. */
const cacheUbicaciones = new Map<string, string>();

async function idUbicacion(
  nombre: string,
  tipo: TipoUbicacion,
  departamento: string | null,
): Promise<string> {
  const clave = `${tipo}::${nombre}`;
  const enCache = cacheUbicaciones.get(clave);
  if (enCache) return enCache;

  const ubicacion = await prisma.ubicacion.upsert({
    where: { nombre_tipo: { nombre, tipo } },
    create: { nombre, tipo, departamento },
    update: { departamento },
  });
  cacheUbicaciones.set(clave, ubicacion.id);
  return ubicacion.id;
}

/**
 * Los proyectos escriben "PRESENCIAL", "VIRTUAL" y "PRESENCIAL HÍBRIDA". La
 * tercera hay que reconocerla explícitamente: si se cuela por el `else`,
 * los dos foros híbridos quedan marcados como virtuales.
 */
function comoModalidad(valor: string | null): Modalidad {
  const texto = (valor ?? '').toUpperCase();
  if (texto.includes('HÍBRID') || texto.includes('HIBRID')) return Modalidad.HIBRIDA;
  if (texto.includes('PRESENCIAL')) return Modalidad.PRESENCIAL;
  return Modalidad.VIRTUAL;
}

/**
 * La modalidad de un grupo sale de sus coberturas, no de la acción: los grupos
 * de la AF8 juntan 60 asistentes en sede y 190 conectados desde seis
 * departamentos, así que son híbridos aunque el proyecto los liste bajo una
 * sola etiqueta.
 */
function modalidadDelGrupo(coberturas: CoberturaJson[]): Modalidad {
  const presencial = coberturas.some((c) => c.modalidad === 'PRESENCIAL');
  const virtual = coberturas.some((c) => c.modalidad === 'VIRTUAL');
  if (presencial && virtual) return Modalidad.HIBRIDA;
  return presencial ? Modalidad.PRESENCIAL : Modalidad.VIRTUAL;
}

async function main() {
  const ruta = join(__dirname, 'catalogo.json');
  const catalogo: CatalogoJson = JSON.parse(readFileSync(ruta, 'utf8'));

  const avisos: string[] = [];

  for (const [ordenConvenio, entrada] of catalogo.convenios.entries()) {
    const { entidad } = entrada;

    const convenio = await prisma.convenio.upsert({
      where: { slug: entrada.slug },
      create: {
        slug: entrada.slug,
        nombre: entidad.nombre,
        sigla: entidad.sigla,
        nit: entidad.nit ?? '',
        digitoVerificacion: entidad.digitoVerificacion,
        correo: entidad.correo,
        telefono: entidad.telefono,
        direccion: entidad.direccion,
        ciudad: entidad.ciudad,
        departamento: entidad.departamento,
        paginaWeb: entidad.paginaWeb,
        orden: ordenConvenio,
      },
      update: {
        nombre: entidad.nombre,
        sigla: entidad.sigla,
        nit: entidad.nit ?? '',
        digitoVerificacion: entidad.digitoVerificacion,
        correo: entidad.correo,
        telefono: entidad.telefono,
        direccion: entidad.direccion,
        ciudad: entidad.ciudad,
        departamento: entidad.departamento,
        paginaWeb: entidad.paginaWeb,
      },
    });

    for (const accionJson of entrada.acciones) {
      const accion = await prisma.accionFormacion.upsert({
        where: {
          convenioId_codigo: { convenioId: convenio.id, codigo: accionJson.codigo },
        },
        create: {
          convenioId: convenio.id,
          codigo: accionJson.codigo,
          nombre: accionJson.nombre,
          modalidad: comoModalidad(accionJson.modalidad),
          evento: accionJson.evento,
          enfoque: accionJson.enfoque,
          metodologia: accionJson.metodologia,
          horas: accionJson.horas,
          objetivo: accionJson.objetivo,
          ambiente: accionJson.ambiente,
          orden: accionJson.orden,
        },
        // `visible` no se toca: si un admin ocultó una acción, un despliegue
        // no debe volver a publicarla a sus espaldas.
        update: {
          nombre: accionJson.nombre,
          modalidad: comoModalidad(accionJson.modalidad),
          evento: accionJson.evento,
          enfoque: accionJson.enfoque,
          metodologia: accionJson.metodologia,
          horas: accionJson.horas,
          objetivo: accionJson.objetivo,
          ambiente: accionJson.ambiente,
          orden: accionJson.orden,
        },
      });

      for (const grupoJson of accionJson.grupos) {
        const sedeId = grupoJson.sedeCiudad
          ? await idUbicacion(
              grupoJson.sedeCiudad,
              TipoUbicacion.CIUDAD,
              grupoJson.sedeDepartamento,
            )
          : null;

        const grupo = await prisma.grupo.upsert({
          where: {
            accionFormacionId_numero: {
              accionFormacionId: accion.id,
              numero: grupoJson.numero,
            },
          },
          create: {
            accionFormacionId: accion.id,
            numero: grupoJson.numero,
            modalidad: modalidadDelGrupo(grupoJson.coberturas),
            sedeUbicacionId: sedeId,
          },
          // Las fechas y el horario los cargan los admins; el seed no las pisa.
          update: {
            modalidad: modalidadDelGrupo(grupoJson.coberturas),
            sedeUbicacionId: sedeId,
          },
        });

        for (const cobertura of grupoJson.coberturas) {
          const ubicacionId = await idUbicacion(
            cobertura.ubicacion,
            cobertura.tipo as TipoUbicacion,
            cobertura.departamento,
          );

          await prisma.grupoCobertura.upsert({
            where: {
              grupoId_ubicacionId_modalidad: {
                grupoId: grupo.id,
                ubicacionId,
                modalidad: cobertura.modalidad as Modalidad,
              },
            },
            create: {
              grupoId: grupo.id,
              ubicacionId,
              modalidad: cobertura.modalidad as Modalidad,
              cuposBase: cobertura.cuposBase,
              cuposMaximos: cobertura.cuposMaximos,
            },
            update: {
              cuposBase: cobertura.cuposBase,
              cuposMaximos: cobertura.cuposMaximos,
            },
          });
        }
      }

      for (const ofertaJson of accionJson.ofertas) {
        const ubicacionId = await idUbicacion(
          ofertaJson.ubicacion,
          ofertaJson.tipo as TipoUbicacion,
          ofertaJson.departamento,
        );

        const existente = await prisma.oferta.findUnique({
          where: {
            accionFormacionId_ubicacionId: {
              accionFormacionId: accion.id,
              ubicacionId,
            },
          },
        });

        // Bajar el tope por debajo de lo ya reservado dejaría la oferta en un
        // estado imposible (ocupados > máximos). Se avisa y no se toca: es una
        // decisión que tiene que tomar una persona, no un script.
        if (existente && existente.cuposOcupados > ofertaJson.cuposMaximos) {
          avisos.push(
            `${entrada.slug} ${accionJson.codigo} ${ofertaJson.ubicacion}: ` +
              `el catálogo baja el tope a ${ofertaJson.cuposMaximos} pero ya hay ` +
              `${existente.cuposOcupados} cupos ocupados. No se modificó.`,
          );
          continue;
        }

        await prisma.oferta.upsert({
          where: {
            accionFormacionId_ubicacionId: {
              accionFormacionId: accion.id,
              ubicacionId,
            },
          },
          create: {
            accionFormacionId: accion.id,
            ubicacionId,
            modalidad: ofertaJson.modalidad as Modalidad,
            cuposMaximos: ofertaJson.cuposMaximos,
          },
          // `cuposOcupados` y `abierta` quedan fuera a propósito.
          update: {
            modalidad: ofertaJson.modalidad as Modalidad,
            cuposMaximos: ofertaJson.cuposMaximos,
          },
        });
      }
    }

    const totales = await prisma.oferta.aggregate({
      where: { accionFormacion: { convenioId: convenio.id } },
      _sum: { cuposMaximos: true, cuposOcupados: true },
      _count: true,
    });

    console.log(
      `${entrada.slug}: ${entrada.acciones.length} acciones, ` +
        `${totales._count} ofertas, ${totales._sum.cuposMaximos ?? 0} cupos ` +
        `(${totales._sum.cuposOcupados ?? 0} ocupados)`,
    );
  }

  for (const aviso of avisos) {
    console.warn(`AVISO  ${aviso}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
