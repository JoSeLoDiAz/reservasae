/**
 * El cronograma del cliente, llevado a las fechas de los grupos.
 *
 *   pnpm db:cronograma                     # solo mira, no escribe
 *   pnpm db:cronograma --aplicar           # las escribe
 *   pnpm db:cronograma --hoja "CRONOGRAMA 2026_V4_2"
 *   pnpm db:cronograma --gremio britcham-adee
 *
 * El archivo se toma de `CRONOGRAMA_ARCHIVO`, o se baja de Drive con la
 * cuenta de servicio si hay `GOOGLE_CUENTA_DE_SERVICIO` y
 * `CRONOGRAMA_DRIVE_ID`.
 *
 * POR QUÉ EXISTE.
 *
 * El cronograma se negocia con el SENA en una hoja de cálculo y el CRM
 * nunca la había leído: derivaba el cierre de inscripciones de la fecha
 * de inicio del grupo ---14 días antes si es virtual, 5 hábiles si es
 * presencial--- y enseñaba UNA sola fecha por acción, la del grupo que
 * cierra primero. De ahí salen «días para el cierre» y la meta diaria
 * de los asesores.
 *
 * Las dos cosas estaban mal. «Las AF no cierran como tal una completa
 * sino por partes» (cliente, 2 oct 2026): seis de las siete acciones
 * cierran en dos o más fechas, y AF3 tiene una por cada uno de sus
 * cinco grupos. Y la regla fija no reproduce la hoja, donde las
 * distancias reales van de 5 a 11 días porque se marcan a mano.
 *
 * QUÉ NO HACE, que es tan importante como lo que hace:
 *
 *   - NO CREA GRUPOS. El cronograma dice cuándo, no qué existe. Una
 *     fila que no corresponde a ningún grupo se reporta.
 *   - NO BORRA. Lo que el cronograma no trae deja como está lo que ya
 *     hay: una fila sin sesiones marcadas no significa «sin fechas».
 *   - NO CRUZA GREMIOS. Los códigos AF se repiten entre convenios y no
 *     significan lo mismo; además de código y número se comprueba que
 *     la ciudad del rótulo esté entre las coberturas del grupo.
 *   - NO ESCRIBE SIN QUE SE LO PIDAN. Sin `--aplicar` solo enseña.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';

import { PrismaClient } from '../generated/prisma';
import { exigirBaseSegura } from './guardia-de-base';
import { leerCronograma } from '../src/cronograma/lector-del-cronograma';
import {
  compararConElCronograma,
  medianocheEnBogota,
  type GrupoEnLaBase,
} from '../src/cronograma/emparejar-con-la-base';

const APLICAR = process.argv.includes('--aplicar');
const argumento = (nombre: string, porDefecto: string): string => {
  const i = process.argv.indexOf('--' + nombre);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
};

const HOJA = argumento('hoja', 'CRONOGRAMA 2026_V4_3');
const GREMIO = argumento('gremio', 'adecopria');
const ANIO = Number(argumento('anio', '2026'));

/**
 * Baja el cronograma de Drive con la cuenta de servicio.
 *
 * SIN DEPENDENCIAS NUEVAS: el JWT se firma aquí con `crypto`. Añadir
 * `googleapis` al backend por una sola descarga traería medio SDK de
 * Google a un servicio que no lo usa para nada más.
 *
 * Y con `alt=media`, no con `export`: el cronograma es un .xlsx subido
 * a Drive, no una hoja nativa de Google, y `export` solo vale para las
 * nativas.
 */
async function bajarDeDrive(credencial: string, id: string): Promise<Buffer> {
  const c = JSON.parse(fs.readFileSync(credencial, 'utf8')) as {
    client_email: string;
    private_key: string;
    token_uri: string;
  };
  const base64 = (o: unknown) =>
    Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const ahora = Math.floor(Date.now() / 1000);
  const cabeza = base64({ alg: 'RS256', typ: 'JWT' });
  const cuerpo = base64({
    iss: c.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: c.token_uri,
    exp: ahora + 3600,
    iat: ahora,
  });
  const firma = crypto
    .createSign('RSA-SHA256')
    .update(`${cabeza}.${cuerpo}`)
    .sign(c.private_key)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const respuesta = await fetch(c.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabeza}.${cuerpo}.${firma}`,
    }),
  });
  const token = (await respuesta.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new Error('Google no dio un token para la cuenta de servicio.');
  }

  const archivo = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: 'Bearer ' + token.access_token } },
  );
  if (!archivo.ok) {
    throw new Error(
      `Drive respondió ${archivo.status} al bajar el cronograma. ` +
        '¿Está el archivo compartido con la cuenta de servicio?',
    );
  }
  return Buffer.from(await archivo.arrayBuffer());
}

async function abrirElLibro(): Promise<ExcelJS.Workbook> {
  const libro = new ExcelJS.Workbook();
  const local = process.env.CRONOGRAMA_ARCHIVO;
  if (local) {
    if (!fs.existsSync(local)) {
      throw new Error(`No existe el archivo ${local}.`);
    }
    await libro.xlsx.readFile(local);
    console.log(`cronograma leído de ${local}`);
    return libro;
  }

  const credencial = process.env.GOOGLE_CUENTA_DE_SERVICIO;
  const id = process.env.CRONOGRAMA_DRIVE_ID;
  if (!credencial || !id) {
    throw new Error(
      'No sé de dónde sacar el cronograma. Ponga CRONOGRAMA_ARCHIVO con la ' +
        'ruta del .xlsx, o GOOGLE_CUENTA_DE_SERVICIO y CRONOGRAMA_DRIVE_ID ' +
        'para bajarlo de Drive.',
    );
  }
  /// `as never` porque ExcelJS declara un `Buffer` propio, más viejo
  /// que el de @types/node 24: el de ahora es `Buffer<ArrayBufferLike>`
  /// y no encaja en su firma. Son el mismo objeto en ejecución.
  await libro.xlsx.load((await bajarDeDrive(credencial, id)) as never);
  console.log('cronograma bajado de Drive');
  return libro;
}

async function main() {
  const libro = await abrirElLibro();
  const lectura = leerCronograma(libro, HOJA, ANIO);
  console.log(
    `\nhoja «${lectura.hoja}»: ${lectura.grupos.length} grupos` +
      (lectura.avisos.length ? `, ${lectura.avisos.length} avisos` : ''),
  );
  for (const a of lectura.avisos) console.log(`  aviso: ${a}`);

  const prisma = new PrismaClient();
  const convenio = await prisma.convenio.findFirst({
    where: { slug: GREMIO },
    select: { id: true, nombre: true },
  });
  if (!convenio) {
    throw new Error(`No hay ningún gremio con el slug «${GREMIO}».`);
  }

  const crudos = await prisma.grupo.findMany({
    where: { accionFormacion: { convenioId: convenio.id } },
    select: {
      id: true,
      numero: true,
      fechaInicio: true,
      fechaFin: true,
      cierreInscripciones: true,
      accionFormacion: { select: { codigo: true } },
      coberturas: { select: { ubicacion: { select: { nombre: true } } } },
    },
  });
  const enLaBase: GrupoEnLaBase[] = crudos.map((g) => ({
    id: g.id,
    numero: g.numero,
    accionCodigo: g.accionFormacion.codigo,
    fechaInicio: g.fechaInicio,
    fechaFin: g.fechaFin,
    cierreInscripciones: g.cierreInscripciones,
    ubicaciones: g.coberturas.map((c) => c.ubicacion.nombre),
  }));
  console.log(`${convenio.nombre}: ${enLaBase.length} grupos en el sistema\n`);

  const r = compararConElCronograma(lectura.grupos, enLaBase);

  if (r.porAplicar.length) {
    console.log(`POR ESCRIBIR (${r.porAplicar.length}):`);
    for (const e of r.porAplicar) {
      const detalle = e.cambios
        .map((c) => `${c.campo} ${c.de ?? '—'} → ${c.a}`)
        .join('  ·  ');
      console.log(`  ${e.rotulo.slice(0, 34).padEnd(34)} ${detalle}`);
    }
  }
  if (r.sinCambios.length) {
    console.log(`\nYA ESTABAN AL DÍA: ${r.sinCambios.length}`);
  }
  if (r.conReparos.length) {
    console.log(`\nNO SE TOCAN (${r.conReparos.length}):`);
    for (const e of r.conReparos) {
      console.log(
        `  ${e.rotulo.slice(0, 34).padEnd(34)} ${e.reparos.join(' ')}`,
      );
    }
  }

  if (!APLICAR) {
    console.log(
      '\nNo se escribió nada. Con --aplicar se escriben ' +
        `${r.porAplicar.length} grupos.`,
    );
    await prisma.$disconnect();
    return;
  }

  /// La guardia SOLO al escribir: mirar nunca ha roto nada, y pedirla
  /// para una vista previa haría que se saltara por costumbre.
  exigirBaseSegura('Escribir el cronograma en los grupos');

  let escritos = 0;
  await prisma.$transaction(async (tx) => {
    for (const e of r.porAplicar) {
      if (!e.grupoId) continue;
      const datos: Record<string, Date> = {};
      for (const c of e.cambios) datos[c.campo] = medianocheEnBogota(c.a);
      await tx.grupo.update({ where: { id: e.grupoId }, data: datos });
      escritos++;
    }
  });
  console.log(`\nEscritos ${escritos} grupos.`);
  await prisma.$disconnect();
}

main().catch((e: Error) => {
  console.error('\n' + e.message);
  process.exit(1);
});
