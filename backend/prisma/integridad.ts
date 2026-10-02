/**
 * EL SONDEO DE LOS DATOS, justo después de migrar.
 *
 * «Hazte un sondeo en producción de todas estas vulnerabilidades [...]
 * imagínate, ahorita es controlable, pero ¿a futuro?» (cliente, 1 oct
 * 2026), tras encontrar a la misma persona en dos acciones de
 * formación con una asesora distinta en cada una.
 *
 * Su pregunta es la correcta y la respuesta no es un sondeo: es un
 * sondeo QUE SE REPITE SOLO. Un recuento hecho a mano un martes dice
 * cuántos había ese martes; lo que hace falta es que el número salga
 * cada vez que alguien despliega, que es el momento en que hay alguien
 * mirando la consola del servidor.
 *
 * Por eso va enganchado a `prisma:deploy`, al lado de `db:brechas`.
 * `brechas` mira el CÓDIGO ---qué falta por construir---; esto mira
 * los DATOS ---qué se coló antes de que lo cerráramos---.
 *
 * NO ESCRIBE NADA. Solo cuenta y enseña ejemplos. Lo que encuentra se
 * arregla con las herramientas que ya existen, y cada aviso dice con
 * cuál.
 *
 * NO ROMPE EL DESPLIEGUE: sale con código 0 siempre. Un despliegue que
 * falla por un aviso se desactiva el mismo día, y entonces el aviso no
 * sirve para nada. Es la misma regla que `brechas`.
 *
 *   pnpm db:integridad
 */

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

/// Cuántos ejemplos se enseñan de cada hallazgo. Suficiente para
/// reconocer el caso, no tantos como para que nadie lo lea.
const EJEMPLOS = 5;

type Hallazgo = {
  titulo: string;
  cuantos: number;
  ejemplos: string[];
  /// Con qué se arregla. Sin esto, un aviso es solo una queja.
  comoSeArregla: string;
};

/**
 * LA MISMA PERSONA EN DOS ACCIONES DE FORMACIÓN.
 *
 * La regla es «solo se puede tomar una acción», y desde el 1 oct 2026
 * la aplican las tres puertas. Antes el panel no la aplicaba, así que
 * lo que entró por ahí sigue ahí: dos fichas, dos asesoras y la misma
 * persona recibiendo dos llamadas.
 *
 * LOS FOROS NO CUENTAN, igual que en la regla: un foro no consume el
 * cupo de formación. Si se contaran, el aviso saldría lleno de casos
 * que no son problema y nadie volvería a leerlo.
 */
async function enDosAcciones(): Promise<Hallazgo> {
  const filas = await prisma.participante.findMany({
    where: { accionFormacionId: { not: null } },
    select: {
      personaId: true,
      convenioId: true,
      convenio: { select: { sigla: true } },
      persona: { select: { numeroDocumento: true, primerNombre: true, primerApellido: true } },
      accionFormacion: { select: { codigo: true, evento: true } },
      asesor: { select: { nombre: true } },
      etapa: true,
    },
  });

  const esForo = (e: string | null | undefined) =>
    (e ?? '').toUpperCase().includes('FORO');

  /**
   * POR PERSONA **Y GREMIO**, no solo por persona.
   *
   * La misma persona en ADECOPRIA y en BRITCHAM NO es un duplicado:
   * son dos convenios, cada uno con su oferta y su propio reporte al
   * SENA, y es legitimo estar en los dos.
   *
   * Agrupando solo por persona, en la base de pruebas salian CUATRO
   * casos y ninguno lo era: los cuatro eran cruces entre gremios. Un
   * sondeo que grita por cosas que estan bien se deja de leer a la
   * tercera vez.
   */
  const porPersona = new Map<string, typeof filas>();
  for (const f of filas) {
    if (esForo(f.accionFormacion?.evento)) continue;
    const llave = `${f.personaId}|${f.convenioId}`;
    const suyas = porPersona.get(llave) ?? [];
    suyas.push(f);
    porPersona.set(llave, suyas);
  }

  const repetidas = [...porPersona.values()].filter((x) => x.length > 1);

  return {
    titulo: 'La misma persona en más de una acción de formación',
    cuantos: repetidas.length,
    ejemplos: repetidas.slice(0, EJEMPLOS).map((x) => {
      const p = x[0].persona;
      const donde = x
        .map(
          (f) =>
            `${f.accionFormacion?.codigo ?? '—'} (${f.etapa}, ${f.asesor?.nombre ?? 'sin asesor'})`,
        )
        .join('  +  ');
      return `${p.numeroDocumento}  ${p.primerNombre} ${p.primerApellido ?? ''}  [${x[0].convenio?.sigla ?? '?'}]  ->  ${donde}`;
    }),
    comoSeArregla:
      'Con la herramienta de unir fichas: se elige a qué acción va de verdad y de dónde sale cada dato. Las notas de las dos se conservan.',
  };
}

/**
 * ORGANIZACIONES PARTIDAS EN DOS POR EL DÍGITO PEGADO.
 *
 * `8001837677` es `800183767` con su dígito pegado detrás, y hasta el
 * 30 sep 2026 entraba entero como un NIT de diez cifras. Así nacieron
 * siete organizaciones duplicadas en producción, cada una con su gente
 * repartida. La entrada ya está cerrada; las filas de antes no.
 */
async function nitPartidoPorElDigito(): Promise<Hallazgo> {
  const empresas = await prisma.empresa.findMany({
    select: { nit: true, razonSocial: true },
  });
  const nueves = new Set(
    empresas.filter((e) => /^\d{9}$/.test(e.nit)).map((e) => e.nit),
  );

  const partidas = empresas.filter(
    (e) => /^[89]\d{9}$/.test(e.nit) && nueves.has(e.nit.slice(0, 9)),
  );

  return {
    titulo: 'Organizaciones partidas en dos: el NIT con su dígito pegado',
    cuantos: partidas.length,
    ejemplos: partidas
      .slice(0, EJEMPLOS)
      .map((e) => `${e.nit}  ${e.razonSocial}  ->  es ${e.nit.slice(0, 9)}`),
    comoSeArregla:
      'Se mueve su gente a la organización buena desde la ficha del lead y se oculta la partida. La entrada ya está cerrada desde el 30 sep 2026.',
  };
}

/** NIT que no es un número: nada automático puede con ellos. */
async function nitQueNoEsNumero(): Promise<Hallazgo> {
  const empresas = await prisma.empresa.findMany({
    select: { nit: true, razonSocial: true },
  });
  const rotas = empresas.filter((e) => !/^\d+$/.test(e.nit));

  return {
    titulo: 'Organizaciones con el NIT mal escrito',
    cuantos: rotas.length,
    ejemplos: rotas.slice(0, EJEMPLOS).map((e) => `«${e.nit}»  ${e.razonSocial}`),
    comoSeArregla:
      'A mano, desde la ficha de la organización. Ningún repaso automático los toca: adivinar un NIT es inventarse el número que viaja al SENA.',
  };
}

/**
 * INDEPENDIENTES A MEDIAS.
 *
 * Hasta el 1 oct 2026 el formulario público no les calculaba el dígito
 * de verificación ni los apuntaba en el directorio, y no se les
 * rellenaba lo que el F7 pide de la organización.
 */
async function independientesAMedias(): Promise<Hallazgo> {
  const empresas = await prisma.empresa.findMany({
    select: {
      nit: true,
      razonSocial: true,
      digitoVerificacion: true,
      tamanoSepId: true,
      departamentoSepId: true,
      contactoNombre: true,
    },
  });
  const documentos = new Set(
    (await prisma.persona.findMany({ select: { numeroDocumento: true } })).map(
      (p) => p.numeroDocumento,
    ),
  );
  const enDirectorio = new Set(
    (
      await prisma.institucion.findMany({
        where: { nit: { in: empresas.map((e) => e.nit) } },
        select: { nit: true },
      })
    ).map((i) => i.nit),
  );

  const aMedias = empresas.filter(
    (e) =>
      documentos.has(e.nit) &&
      (!e.digitoVerificacion ||
        !enDirectorio.has(e.nit) ||
        !e.departamentoSepId ||
        !e.contactoNombre),
  );

  return {
    titulo: 'Independientes con RUT a los que les falta algo',
    cuantos: aMedias.length,
    ejemplos: aMedias.slice(0, EJEMPLOS).map((e) => {
      const falta = [
        !e.digitoVerificacion && 'dígito',
        !enDirectorio.has(e.nit) && 'no está en el listado',
        !e.departamentoSepId && 'sede',
        !e.contactoNombre && 'contacto',
      ].filter(Boolean);
      return `${e.nit}  ${e.razonSocial}  ->  falta ${falta.join(', ')}`;
    }),
    comoSeArregla: 'pnpm db:independientes --aplicar',
  };
}

/**
 * CIUDADES SIN SU DEPARTAMENTO, QUE ES EL PARCHE DE AF6 SIN EFECTO.
 *
 * Desde el 30 sep 2026 una ubicación de tipo CIUDAD cubre su
 * departamento entero: «los de AF6, que es en Medellín, así la persona
 * sea de Rionegro debe permitir inscribirla» (cliente). La regla vive
 * en `cobertura.ts` y su última línea es:
 *
 *     return igual(donde.departamento, vive.departamento);
 *
 * O SEA QUE EL PARCHE SOLO FUNCIONA SI LA FILA TIENE EL DEPARTAMENTO
 * GUARDADO. Con el campo vacío, la ciudad no abre nada y la regla se
 * comporta como la vieja: solo entra quien viva en esa misma ciudad.
 * El de Rionegro sigue bloqueado, y nada avisa.
 *
 * Y NO FALLA RUIDOSAMENTE, que es lo peor: el panel dice «falta la
 * sede: se sabe qué curso quiere, pero no dónde lo va a tomar», que es
 * el mismo mensaje que sale cuando el departamento de verdad no tiene
 * ese curso. Los dos casos se leen igual y solo uno es un error.
 *
 * SOLO LAS QUE ESTÁN EN USO. Una ciudad sin ofertas no bloquea a
 * nadie, y meterla en el aviso sería llenarlo de ruido ---la regla de
 * esta casa: un aviso que trae casos que no son problema deja de
 * leerse---.
 */
async function ciudadesSinDepartamento(): Promise<Hallazgo> {
  const sueltas = await prisma.ubicacion.findMany({
    where: { tipo: 'CIUDAD', departamento: null },
    select: {
      nombre: true,
      _count: { select: { ofertas: true, coberturas: true } },
    },
    orderBy: { nombre: 'asc' },
  });

  const enUso = sueltas.filter(
    (u) => u._count.ofertas > 0 || u._count.coberturas > 0,
  );

  return {
    titulo: 'Ciudades sin departamento: la cobertura de AF6 no abre',
    cuantos: enUso.length,
    ejemplos: enUso
      .slice(0, EJEMPLOS)
      .map(
        (u) =>
          `${u.nombre.padEnd(24)} ${u._count.ofertas} ofertas, ${u._count.coberturas} grupos -> solo entra quien viva en ${u.nombre}`,
      ),
    comoSeArregla:
      'Poniéndole el departamento a esa ubicación en Configuración. Mientras esté vacío, a esa ciudad solo entra quien viva exactamente en ella, y a los del resto del departamento el panel les dice «falta la sede» como si el curso no existiera allí.',
  };
}

async function main() {
  console.log('\n═══ SONDEO DE LOS DATOS ═══\n');

  const hallazgos = [
    await enDosAcciones(),
    await nitPartidoPorElDigito(),
    await nitQueNoEsNumero(),
    await independientesAMedias(),
    await ciudadesSinDepartamento(),
  ];

  const conCasos = hallazgos.filter((h) => h.cuantos > 0);

  if (conCasos.length === 0) {
    console.log('  Nada que reportar: los cinco controles salen en cero.\n');
    return;
  }

  for (const h of conCasos) {
    console.log(`▸ ${h.titulo}: ${h.cuantos}`);
    for (const e of h.ejemplos) console.log(`    ${e}`);
    if (h.cuantos > h.ejemplos.length) {
      console.log(`    …y ${h.cuantos - h.ejemplos.length} más.`);
    }
    console.log(`    Se arregla con: ${h.comoSeArregla}\n`);
  }

  const limpios = hallazgos.filter((h) => h.cuantos === 0);
  if (limpios.length > 0) {
    console.log(`  En cero: ${limpios.map((h) => h.titulo).join(' · ')}\n`);
  }
}

main()
  .catch((e) => {
    /// Tampoco revienta si el sondeo falla: es un aviso, no una puerta.
    console.error('No se pudo hacer el sondeo:', e?.message ?? e);
  })
  .finally(() => void prisma.$disconnect());
