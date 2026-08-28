/** Prueba de concurrencia contra la API real. */

import { PrismaClient } from '../generated/prisma';
import { exigirBaseSegura } from './guardia-de-base';

// el 5433 es produccion, aunque diga localhost
exigirBaseSegura('La prueba de carga');

const prisma = new PrismaClient();
// 127.0.0.1: el fetch de Node prueba ::1 primero
const API = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4100}`;

/** Prefijo para limpiar solo lo de prueba. */
const NIT_PRUEBA = '999';

let fallos = 0;

function comprobar(condicion: boolean, descripcion: string, detalle = '') {
  if (condicion) {
    console.log(`OK      ${descripcion}`);
  } else {
    fallos += 1;
    console.log(`FALLO   ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
  }
}

type Respuesta = { estado: number; cuerpo: any };

async function pedir(
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
  ip = '10.0.0.1',
): Promise<Respuesta> {
  const respuesta = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      // cada peticion con su IP, como detras del tunel
      'cf-connecting-ip': ip,
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: respuesta.status, cuerpo: await respuesta.json().catch(() => null) };
}

function reserva(ofertaId: string, indice: number, cupos: number) {
  return {
    ofertaId,
    nit: `${NIT_PRUEBA}${String(indice).padStart(6, '0')}`,
    razonSocial: `EMPRESA DE PRUEBA ${indice}`,
    numeroColaboradores: 10 + indice,
    contactoNombre: `Contacto ${indice}`,
    contactoCorreo: `contacto${indice}@ejemplo.test`,
    contactoTelefono: '3000000000',
    contactoCargo: 'Analista',
    cuposSolicitados: cupos,
    aceptaTerminos: true,
    aceptaPoliticaDatos: true,
  };
}

async function limpiar() {
  const empresas = await prisma.empresa.findMany({
    where: { nit: { startsWith: NIT_PRUEBA } },
    select: { id: true },
  });
  if (empresas.length) {
    const ids = empresas.map((e) => e.id);
    await prisma.reserva.deleteMany({ where: { empresaId: { in: ids } } });
    await prisma.empresa.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  console.log(`API: ${API}\n`);
  await limpiar();

  // la mas pequena: mas facil provocar la colision
  const oferta = await prisma.oferta.findFirstOrThrow({
    orderBy: { cuposMaximos: 'asc' },
    include: { accionFormacion: true, ubicacion: true },
  });
  const visibleAntes = oferta.accionFormacion.visible;
  const ocupadosAntes = oferta.cuposOcupados;

  console.log(
    `Oferta: ${oferta.accionFormacion.codigo} / ${oferta.ubicacion.nombre} · ` +
      `${oferta.cuposMaximos} cupos\n`,
  );

  await prisma.accionFormacion.update({
    where: { id: oferta.accionFormacionId },
    data: { visible: true },
  });

  try {
    // 1. avalancha simultánea
    const intentos = oferta.cuposMaximos + 7;
    const respuestas = await Promise.all(
      Array.from({ length: intentos }, (_, i) =>
        pedir('POST', '/reservas', reserva(oferta.id, i, 1), `10.0.0.${i + 1}`),
      ),
    );

    const creadas = respuestas.filter((r) => r.estado === 201);
    const confirmadas = creadas.filter((r) => r.cuerpo?.estado === 'CONFIRMADA');
    const enEspera = creadas.filter((r) => r.cuerpo?.estado === 'LISTA_ESPERA');
    const otras = respuestas.filter((r) => r.estado !== 201);

    console.log(
      `${intentos} peticiones simultáneas → ${confirmadas.length} confirmadas, ` +
        `${enEspera.length} en espera, ${otras.length} con error`,
    );
    if (otras.length) {
      console.log(`        códigos: ${otras.map((o) => o.estado).join(', ')}`);
    }

    const tras = await prisma.oferta.findUniqueOrThrow({ where: { id: oferta.id } });
    comprobar(
      tras.cuposOcupados <= tras.cuposMaximos,
      'no se sobrevendió',
      `ocupados=${tras.cuposOcupados} máximos=${tras.cuposMaximos}`,
    );
    comprobar(
      confirmadas.length === oferta.cuposMaximos,
      `se confirmaron exactamente los ${oferta.cuposMaximos} cupos`,
      `confirmadas=${confirmadas.length}`,
    );
    comprobar(
      enEspera.length === intentos - oferta.cuposMaximos,
      'el resto quedó en lista de espera',
      `espera=${enEspera.length}`,
    );

    const suma = await prisma.reserva.aggregate({
      where: { ofertaId: oferta.id },
      _sum: { cuposConfirmados: true },
    });
    comprobar(
      (suma._sum.cuposConfirmados ?? 0) === tras.cuposOcupados,
      'el contador coincide con la suma de las reservas',
      `suma=${suma._sum.cuposConfirmados} contador=${tras.cuposOcupados}`,
    );

    // 2. reenvío idéntico (doble clic)
    const reenvio = await pedir('POST', '/reservas', reserva(oferta.id, 0, 1), '10.0.0.1');
    comprobar(
      reenvio.estado === 201 && reenvio.cuerpo?.id === creadas[0]?.cuerpo?.id,
      'el reenvío idéntico devuelve la misma reserva y no crea otra',
      `estado=${reenvio.estado}`,
    );

    // 3. reenvío con otra cantidad
    const distinto = await pedir('POST', '/reservas', reserva(oferta.id, 0, 3), '10.0.0.1');
    comprobar(
      distinto.estado === 409,
      'una cantidad distinta pide usar la edición en vez de duplicar',
      `estado=${distinto.estado}`,
    );

    // 4. cancelar libera y promueve
    const primera = creadas[0].cuerpo;
    const antesDeCancelar = await prisma.reserva.findFirstOrThrow({
      where: { ofertaId: oferta.id, cuposEnEspera: { gt: 0 } },
      orderBy: { creadoEn: 'asc' },
    });

    const cancelada = await pedir(
      'POST',
      `/reservas/${primera.id}/cancelar`,
      { nit: primera.empresa.nit },
      '10.0.0.1',
    );
    comprobar(cancelada.estado === 200, 'la cancelación responde 200', `estado=${cancelada.estado}`);

    const promovida = await prisma.reserva.findUniqueOrThrow({
      where: { id: antesDeCancelar.id },
    });
    comprobar(
      promovida.cuposConfirmados > antesDeCancelar.cuposConfirmados,
      'el primero de la lista de espera fue promovido automáticamente',
      `antes=${antesDeCancelar.cuposConfirmados} después=${promovida.cuposConfirmados}`,
    );

    const trasCancelar = await prisma.oferta.findUniqueOrThrow({ where: { id: oferta.id } });
    comprobar(
      trasCancelar.cuposOcupados === tras.cuposOcupados,
      'el cupo liberado se reocupó: no quedó una silla muerta',
      `ocupados=${trasCancelar.cuposOcupados}`,
    );

    // 5. editar con un NIT ajeno
    const ajena = await pedir(
      'PATCH',
      `/reservas/${antesDeCancelar.id}`,
      { nit: '900123456', cuposSolicitados: 2 },
      '10.0.0.9',
    );
    comprobar(
      ajena.estado === 404,
      'no se puede editar la reserva de otra empresa',
      `estado=${ajena.estado}`,
    );

    // 6. consultar por NIT
    const consulta = await pedir('GET', `/reservas?nit=${NIT_PRUEBA}000001`, undefined, '10.0.0.9');
    comprobar(
      consulta.estado === 200 && Array.isArray(consulta.cuerpo?.reservas),
      'la consulta por NIT devuelve las reservas de la empresa',
      `estado=${consulta.estado}`,
    );

    // 7. pedir más cupos de los que hay
    const excesiva = await pedir(
      'POST',
      '/reservas',
      reserva(oferta.id, 900, oferta.cuposMaximos + 50),
      '10.0.0.90',
    );
    comprobar(
      excesiva.estado === 400,
      'se rechaza pedir más cupos de los que existen',
      `estado=${excesiva.estado}`,
    );
  } finally {
    await limpiar();
    await prisma.oferta.update({
      where: { id: oferta.id },
      data: { cuposOcupados: ocupadosAntes },
    });
    await prisma.accionFormacion.update({
      where: { id: oferta.accionFormacionId },
      data: { visible: visibleAntes },
    });

    const final = await prisma.oferta.findUniqueOrThrow({ where: { id: oferta.id } });
    const empresas = await prisma.empresa.count({ where: { nit: { startsWith: NIT_PRUEBA } } });
    console.log(
      `\nLimpieza: ocupados=${final.cuposOcupados}, ` +
        `empresas de prueba restantes=${empresas} (debe ser ${ocupadosAntes} y 0)`,
    );
  }

  console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} comprobaciones fallaron.`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
