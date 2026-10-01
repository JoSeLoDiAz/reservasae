/**
 * Las organizaciones que quedaron a medias: sin dígito y fuera del
 * directorio.
 *
 *   pnpm db:independientes             # solo mira, no escribe
 *   pnpm db:independientes --aplicar   # las arregla
 *
 * QUÉ PASÓ, que es lo que no se ve mirando una ficha.
 *
 * `empresas` e `instituciones` son dos tablas distintas a propósito:
 * la primera son las organizaciones del CRM y la segunda el maestro
 * de NIT que comparten los gremios, que es lo que se lista en
 * «Sistemas · Empresas registradas» y lo que recorre el buscador.
 *
 * El formulario público escribía en la primera. En la rama de empresa
 * también apuntaba en la segunda; en la rama del RUT propio NO, y era
 * una decisión escrita: meter la cédula de alguien en una tabla que
 * ven los dos gremios es esparcir un dato personal. El 1 oct 2026 el
 * cliente la revisó y decidió al revés ---«más allá de que no sea un
 * NIT es una empresa común y corriente»---, porque ante el SENA esa
 * persona ES su unidad económica.
 *
 * Y el dígito de verificación: la rama del RUT propio nunca lo
 * calculaba. El alta manual desde la ficha sí, así que el mismo
 * independiente salía con dígito o sin él según por dónde entrara.
 *
 * Las dos cosas ya están corregidas en el código. Esto es para las
 * filas que se guardaron ANTES, que no se arreglan solas.
 *
 * NO BORRA NI PISA NADA: pone el dígito donde falta y crea la ficha
 * del directorio donde no existe. Si el NIT ya está en el directorio
 * no le toca el nombre ---puede venir del RUES, que manda sobre lo
 * que tecleó una persona---.
 */

import { PrismaClient } from '../generated/prisma';
import { calcularDigitoVerificacion } from '../src/comun/nit';
import { tamanoDeIndependiente } from '../src/crm/tamano-del-independiente';
import { exigirBaseSegura } from './guardia-de-base';

const aplicar = process.argv.includes('--aplicar');

/**
 * EL GUARDIA, ANTES DE ABRIR LA CONEXIÓN.
 *
 * Este guión ESCRIBE ---pone el dígito, crea fichas en el directorio y
 * rellena lo que el SEP pide de la organización--- y era el ÚNICO de
 * los once que no lo llamaba. Lo vio José al revisar la entrega del 1
 * oct 2026, y tiene razón de más: el `.env` de su portátil apunta a
 * producción por el túnel, así que un `--aplicar` descuidado escribía
 * allí sin que nada lo parase.
 *
 * Solo con `--aplicar`: mirar sin escribir no necesita permiso, y
 * pedirlo para una consulta de solo lectura enseña a saltárselo.
 *
 * El guardia mira el PUERTO, no el nombre de la base: una base
 * «reservasae» alcanzada por el túnel no lleva «prueba» en la URL. Esa
 * es justo la lección por la que existe.
 */
if (aplicar) exigirBaseSegura('Poner al día los independientes');

const prisma = new PrismaClient();

async function main() {
  const empresas = await prisma.empresa.findMany({
    select: {
      id: true,
      nit: true,
      razonSocial: true,
      digitoVerificacion: true,
      tamanoSepId: true,
      numeroTrabajadores: true,
      sectorEconomico: true,
      direccion: true,
      telefono: true,
      departamentoSepId: true,
      municipioSepId: true,
      contactoNombre: true,
      contactoCorreo: true,
    },
    orderBy: { nit: 'asc' },
  });

  /// Quién es independiente: su NIT es el documento de alguien. No hay
  /// bandera guardada, se deduce ---es como lo hace el CRM---.
  const personas = await prisma.persona.findMany({
    select: {
      numeroDocumento: true,
      primerNombre: true,
      segundoNombre: true,
      primerApellido: true,
      segundoApellido: true,
      correo: true,
      celular: true,
      direccion: true,
      departamentoSepId: true,
      municipioSepId: true,
    },
  });
  const documentos = new Set(personas.map((p) => p.numeroDocumento));
  /// Por documento: para un independiente, su documento ES el NIT de
  /// su empresa. Es la misma deducción que hace el CRM.
  const porDocumento = new Map(personas.map((p) => [p.numeroDocumento, p]));

  const enDirectorio = new Set(
    (
      await prisma.institucion.findMany({
        where: { nit: { in: empresas.map((e) => e.nit) } },
        select: { nit: true },
      })
    ).map((i) => i.nit),
  );

  /// SOLO LAS DE NÚMERO LIMPIO, y esto no sobra: en la base hay una
  /// con el NIT «1-8» ---«Sec Edu (NIT mal digitado)»--- y
  /// `calcularDigitoVerificacion` sobre eso devuelve NaN. Sin este
  /// filtro, el repaso le habría escrito la cadena «NaN» como dígito
  /// de verificación y habría metido la fila rota en el directorio
  /// compartido. Lo encontró el ensayo en seco.
  const conNumero = (e: { nit: string }) => /^\d+$/.test(e.nit);
  const rotas = empresas.filter((e) => !conNumero(e));

  const sinDigito = empresas.filter((e) => conNumero(e) && !e.digitoVerificacion);
  const fuera = empresas.filter((e) => conNumero(e) && !enDirectorio.has(e.nit));

  const comoSeLlama = (e: { nit: string; razonSocial: string }) =>
    `${documentos.has(e.nit) ? 'independiente' : 'empresa    '}  ${e.nit.padEnd(12)} ${e.razonSocial}`;

  console.log(`organizaciones: ${empresas.length}`);
  if (rotas.length > 0) {
    console.log(`\nse saltan por tener el NIT mal escrito: ${rotas.length}`);
    for (const e of rotas) console.log(`  ${e.nit.padEnd(12)} ${e.razonSocial}`);
    console.log("  (se corrigen a mano desde la ficha; aquí no se adivina)");
  }
  console.log(`\nsin dígito de verificación: ${sinDigito.length}`);
  for (const e of sinDigito) {
    console.log(`  ${comoSeLlama(e)}  ->  dv ${calcularDigitoVerificacion(e.nit)}`);
  }
  console.log(`\nfuera del directorio: ${fuera.length}`);
  for (const e of fuera) console.log(`  ${comoSeLlama(e)}`);

  /**
   * LO QUE EL SEP PIDE DE LA ORGANIZACIÓN Y YA SE SABE.
   *
   * Solo para los INDEPENDIENTES: en ellos la empresa es la persona,
   * así que su domicilio, su celular y su correo son los de la
   * organización. En una empresa de verdad esto sería inventarse la
   * sede con la casa de un empleado.
   *
   * Nada pisa lo que ya estuviera escrito: se rellena el hueco.
   */
  const aCompletar = empresas
    .filter((e) => conNumero(e) && porDocumento.has(e.nit))
    .map((e) => {
      const yo = porDocumento.get(e.nit)!;
      const nombre = [yo.primerNombre, yo.segundoNombre, yo.primerApellido, yo.segundoApellido]
        .filter(Boolean)
        .join(' ');
      const puesto: Record<string, unknown> = {};
      if (!e.direccion && yo.direccion) puesto.direccion = yo.direccion;
      if (!e.telefono && yo.celular) puesto.telefono = yo.celular;
      if (!e.departamentoSepId && yo.departamentoSepId)
        puesto.departamentoSepId = yo.departamentoSepId;
      if (!e.municipioSepId && yo.municipioSepId)
        puesto.municipioSepId = yo.municipioSepId;
      if (!e.contactoNombre && nombre) puesto.contactoNombre = nombre;
      if (!e.contactoCorreo && yo.correo) puesto.contactoCorreo = yo.correo;
      if (!e.numeroTrabajadores) puesto.numeroTrabajadores = 1;
      if (!e.tamanoSepId) {
        const t = tamanoDeIndependiente(e.sectorEconomico);
        if (t) puesto.tamanoSepId = t;
      }
      return { e, puesto };
    })
    .filter((x) => Object.keys(x.puesto).length > 0);

  console.log(`\nindependientes a los que se les puede rellenar: ${aCompletar.length}`);
  for (const { e, puesto } of aCompletar) {
    console.log(`  ${e.nit.padEnd(12)} ${e.razonSocial.padEnd(32)} -> ${Object.keys(puesto).join(', ')}`);
    if (!e.sectorEconomico) {
      console.log(`      (sin sector economico: el tamano se queda vacio, no se adivina)`);
    }
  }

  if (!aplicar) {
    console.log('\nSolo mirando. Con --aplicar se escriben los cambios.');
    return;
  }

  for (const e of sinDigito) {
    await prisma.empresa.update({
      where: { id: e.id },
      data: { digitoVerificacion: calcularDigitoVerificacion(e.nit) },
    });
  }

  let creadas = 0;
  for (const e of fuera) {
    /// Sin nombre no entra: el directorio existe para responder «¿de
    /// quién es este NIT?», y una fila sin nombre no responde nada.
    /// Es la misma condición que aplica el formulario.
    const nombre = e.razonSocial.trim();
    if (!nombre) continue;

    await prisma.institucion.upsert({
      where: { nit: e.nit },
      /// Si ya existe no se le toca el nombre: puede venir del RUES.
      update: {},
      create: {
        nit: e.nit,
        razonSocial: nombre,
        digitoDeclarado: calcularDigitoVerificacion(e.nit),
        /// La escribió una persona en el formulario, no una fuente
        /// oficial. Esa marca es la que permite que el RUES la
        /// corrija después.
        fuente: 'HUMANO',
        fuentePorCampo: { razonSocial: 'HUMANO' },
      },
    });
    creadas += 1;
  }

  for (const { e, puesto } of aCompletar) {
    await prisma.empresa.update({ where: { id: e.id }, data: puesto });
  }

  console.log(
    `\nAplicado: ${sinDigito.length} con dígito nuevo, ${creadas} añadidas al ` +
      `directorio, ${aCompletar.length} independientes completados.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
