/** Prueba el validador de empresas por buscador web. */

/// Lo que se comprueba, y es lo único que de verdad importa
/// de esta pieza: que el robot NO escriba la ficha. Consulta,
/// deja una propuesta, y ahí se detiene. La ficha solo cambia
/// cuando una persona acepta -- y solo en los campos que
/// aceptó.
///
/// Corre con un proveedor de mentira que devuelve las dos
/// respuestas reales del buscador, así que no necesita clave
/// ni sale a internet.

import { PrismaClient } from '../generated/prisma';
import { InstitucionesService } from '../src/instituciones/instituciones.service';
import { leerFichaWeb } from '../src/instituciones/web/leer-ficha-web';
import type {
  ProveedorWeb,
  RespuestaWeb,
} from '../src/instituciones/web/proveedor-web';
import { WebService } from '../src/instituciones/web/web.service';
import { AuditoriaService } from '../src/comun/auditoria.service';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
let fallos = 0;

function comprobar(que: string, bien: boolean, detalle = '') {
  if (!bien) fallos += 1;
  console.log(
    `  ${bien ? 'OK  ' : 'FALLA'}  ${que}${detalle ? ` — ${detalle}` : ''}`,
  );
}

/// La respuesta de ABC Laboratorios, tal cual la devolvió el
/// buscador cuando se le preguntó por el NIT 860031945.
const RESPUESTA =
  'Razón social: ABC LABORATORIOS S.A.S.Nombre comercial: ABC Laboratorios' +
  'Dirección: Calle 24 # 27A-56Ciudad: Bogotá D.C.Departamento: Cundinamarca' +
  'Teléfono: (601) 518-6600Correo: ventas@abclaboratorios.comPágina web: ' +
  'abclaboratorios.comSector económico: Otra fabricación diversaCódigo CIIU: ' +
  '3290 (Otras industrias manufactureras n.c.p.)Clasificación: Empresa privada' +
  'Fecha de fundación: 17 de enero de 1972Tamaño: Pequeña empresa' +
  'Número de empleados: Entre 11 y 50 colaboradores';

class ProveedorDeMentira implements ProveedorWeb {
  veces = 0;

  consultar(): Promise<RespuestaWeb> {
    this.veces += 1;
    return Promise.resolve({
      estado: 'ENCONTRADO',
      ficha: leerFichaWeb(RESPUESTA),
      crudo: RESPUESTA,
    });
  }
}

const NIT = '999000111';

async function main() {
  console.log('\n=== VALIDADOR DE EMPRESAS POR BUSCADOR WEB ===\n');

  const base = prisma as unknown as PrismaService;
  const proveedor = new ProveedorDeMentira();
  const web = new WebService(base, proveedor);
  const instituciones = new InstitucionesService(
    base,
    new AuditoriaService(base),
  );

  // se limpia lo de la corrida anterior: una prueba que solo
  // se puede correr una vez no sirve de red
  await prisma.institucion.deleteMany({ where: { nit: NIT } });

  const admin = await prisma.admin.findFirst({ select: { id: true } });
  if (!admin) {
    console.log(
      '  No hay ningún admin en la base. Cree uno con db:crear-admin.',
    );
    process.exit(1);
  }

  /// Se parte de una ficha con un dato MALO a propósito: la
  /// ciudad dice Cali y el buscador va a decir Bogotá. Si el
  /// robot pisara el maestro, se vería aquí.
  const f = await prisma.institucion.create({
    data: {
      nit: NIT,
      razonSocial: 'ABC LABORATORIOS S.A.S',
      ciudadNombre: 'Cali',
      fuente: 'CARGA',
    },
  });

  console.log('1 · La consulta deja propuesta y no toca la ficha\n');

  await web.encolar(f.id, 50);
  comprobar('quedó una consulta encolada', (await pendientes(f.id)) === 1);

  await web.encolar(f.id, 10);
  comprobar(
    'pedirla otra vez no crea una segunda',
    (await pendientes(f.id)) === 1,
  );

  comprobar('procesó una', await web.procesarUna());

  const despues = await prisma.institucion.findUniqueOrThrow({
    where: { id: f.id },
  });
  comprobar(
    'la ficha NO cambió: la ciudad sigue mala',
    despues.ciudadNombre === 'Cali',
    `ciudad = ${despues.ciudadNombre}`,
  );
  comprobar('la ficha sigue sin teléfono', despues.telefono === null);

  const propuesta = await prisma.propuestaInstitucion.findFirstOrThrow({
    where: { institucionId: f.id, estado: 'PENDIENTE' },
  });
  const campos = propuesta.campos as Record<string, unknown>;

  comprobar('la propuesta es de fuente WEB', propuesta.fuente === 'WEB');
  comprobar('propone la ciudad buena', campos.ciudadNombre === 'Bogotá D.C');
  comprobar('propone el teléfono', campos.telefono === '(601) 518-6600');
  comprobar('traduce el tamaño al enum', campos.tamano === 'PEQUENA');
  comprobar('deja el CIIU en código', campos.codigoCiiu === '3290');
  comprobar(
    'NO propone empleados: «Entre 11 y 50» es un rango',
    !('numeroEmpleados' in campos),
    Object.keys(campos).join(', '),
  );
  comprobar(
    'NO propone la razón social: es la misma que ya está',
    !('razonSocial' in campos),
  );

  console.log('\n2 · Consultar otra vez no apila propuestas\n');

  await web.encolar(f.id, 50);
  await web.procesarUna();

  comprobar(
    'sigue habiendo una sola propuesta sin revisar',
    (await prisma.propuestaInstitucion.count({
      where: { institucionId: f.id, estado: 'PENDIENTE' },
    })) === 1,
  );
  comprobar(
    'las dos consultas quedaron guardadas con su respuesta',
    (await prisma.consultaRues.count({
      where: { institucionId: f.id, estado: 'LISTA' },
    })) === 2,
  );

  console.log('\n3 · Solo entra lo que una persona acepta\n');

  const viva = await prisma.propuestaInstitucion.findFirstOrThrow({
    where: { institucionId: f.id, estado: 'PENDIENTE' },
  });

  await instituciones.aplicarPropuesta(
    viva.id,
    { campos: ['ciudadNombre', 'fechaFundacion'] },
    admin.id,
  );

  const final = await prisma.institucion.findUniqueOrThrow({
    where: { id: f.id },
  });

  comprobar('entró la ciudad aceptada', final.ciudadNombre === 'Bogotá D.C');
  comprobar(
    'NO entró el teléfono, que no se aceptó',
    final.telefono === null,
    `teléfono = ${final.telefono}`,
  );

  /// La fecha es el caso que muerde: «1972-01-17» guardado
  /// como medianoche UTC se ve como 16 de enero en Colombia.
  const enColombia = final.fechaFundacion
    ? new Date(final.fechaFundacion.getTime() - 5 * 3_600_000)
        .toISOString()
        .slice(0, 10)
    : null;
  comprobar(
    'la fundación cae el 17 de enero visto desde Colombia',
    enColombia === '1972-01-17',
    `guardado = ${final.fechaFundacion?.toISOString()}`,
  );

  const fuentes = (final.fuentePorCampo ?? {}) as Record<string, string>;
  comprobar('la ciudad queda marcada como WEB', fuentes.ciudadNombre === 'WEB');
  comprobar(
    'la ficha NO queda verificada: le faltan datos',
    final.verificadaEn === null,
  );

  console.log(
    fallos === 0
      ? '\nTodo bien.\n'
      : `\n${fallos} comprobación(es) fallaron.\n`,
  );

  await prisma.institucion.deleteMany({ where: { nit: NIT } });
  await prisma.$disconnect();
  process.exit(fallos === 0 ? 0 : 1);
}

async function pendientes(institucionId: string): Promise<number> {
  return prisma.consultaRues.count({
    where: { institucionId, estado: { in: ['PENDIENTE', 'EN_CURSO'] } },
  });
}

void main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
