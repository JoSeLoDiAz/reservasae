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
import { cubreA } from '../src/crm/cobertura';
import {
  DEPARTAMENTO_POR_ID,
  MUNICIPIO_POR_ID,
} from '../src/crm/catalogos-sep';

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
      persona: {
        select: {
          numeroDocumento: true,
          primerNombre: true,
          primerApellido: true,
        },
      },
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
    select: {
      nit: true,
      razonSocial: true,
      _count: { select: { participantes: true, reservas: true } },
    },
  });
  const nueves = new Set(
    empresas.filter((e) => /^\d{9}$/.test(e.nit)).map((e) => e.nit),
  );

  /// CON GENTE TODAVÍA EN LA PEGADA, y no solo emparejadas.
  ///
  /// El guión que las une NO borra la pegada ---aquí nada se
  /// borra---, así que después de unirlas el par sigue estando y
  /// este aviso salía igual, para siempre. Un aviso que no se apaga
  /// cuando el trabajo ya se hizo deja de leerse, y entonces no
  /// avisa de nada el día que importe.
  ///
  /// Lo que queda pendiente es la gente repartida, que es lo que
  /// parte la organización ante el SENA. Una pegada ya vacía es una
  /// fila muerta, no un problema.
  const partidas = empresas.filter(
    (e) =>
      /^[89]\d{9}$/.test(e.nit) &&
      nueves.has(e.nit.slice(0, 9)) &&
      (e._count.participantes > 0 || e._count.reservas > 0),
  );

  return {
    titulo:
      'Organizaciones partidas en dos por el dígito pegado, con gente todavía repartida',
    cuantos: partidas.length,
    ejemplos: partidas
      .slice(0, EJEMPLOS)
      .map((e) => `${e.nit}  ${e.razonSocial}  ->  es ${e.nit.slice(0, 9)}`),
    comoSeArregla:
      'Con pnpm db:nit-pegado: mira primero, y con --aplicar mueve la gente y las reservas a la organización buena, rellena solo los huecos y NO borra la fila partida. La entrada ya está cerrada desde el 30 sep 2026.',
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
    ejemplos: rotas
      .slice(0, EJEMPLOS)
      .map((e) => `«${e.nit}»  ${e.razonSocial}`),
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

/**
 * GENTE QUE NO SE PUEDE MATRICULAR PORQUE SU DEPARTAMENTO NO TIENE
 * ESA ACCIÓN.
 *
 * `cobertura.ts` NO MIRA LA MODALIDAD: aplica la misma frontera de
 * departamento a un curso virtual que a un taller presencial. En un
 * presencial eso es la regla y está bien ---a alguien de Bogotá no se
 * le mete en el grupo de Medellín---. En un VIRTUAL no hay nada
 * físico que lo justifique: el curso se toma por internet.
 *
 * ESTO NO DICE QUE SEA UN FALLO, Y POR ESO CUENTA EN VEZ DE AVISAR.
 * Las ubicaciones de una acción virtual existen porque el F7 del SENA
 * pide un lugar, y puede que la lista de departamentos sea un
 * compromiso adquirido. Si lo es, estos bloqueos son correctos. Si no
 * lo es, es gente que se pierde todos los días.
 *
 * La decisión es del cliente y necesita un número para tomarse, que es
 * lo que esto trae. Las virtuales salen primero por eso.
 */
async function sinSedeEnSuDepartamento(): Promise<Hallazgo> {
  const ofertas = await prisma.oferta.findMany({
    select: {
      accionFormacionId: true,
      ubicacion: { select: { nombre: true, tipo: true, departamento: true } },
    },
  });

  const porAccion = new Map<string, (typeof ofertas)[number][]>();
  for (const o of ofertas) {
    const suyas = porAccion.get(o.accionFormacionId) ?? [];
    suyas.push(o);
    porAccion.set(o.accionFormacionId, suyas);
  }

  const gente = await prisma.participante.findMany({
    where: {
      accionFormacionId: { not: null },
      /// Sin oferta puesta: con ella ya pasó, no es una matrícula
      /// que se esté escapando.
      ofertaId: null,
      /// LOS QUE TODAVÍA SE PUEDEN SALVAR, y por eso no es
      /// `OCUPAN_SILLA`: ese es el conjunto de los que YA entraron.
      /// Fuera quedan también los callejones sin salida ---un lead
      /// perdido hace tres meses no se está escapando---.
      etapa: { in: ['INTERESADO', 'CONTACTADO', 'DATOS_COMPLETOS'] },
    },
    select: {
      accionFormacion: { select: { codigo: true, modalidad: true } },
      accionFormacionId: true,
      persona: { select: { departamentoSepId: true, municipioSepId: true } },
    },
  });

  /// Por acción: cuántos quedan fuera y de qué departamentos.
  const fuera = new Map<
    string,
    { modalidad: string; cuantos: number; dptos: Set<string> }
  >();

  for (const p of gente) {
    const suyas = porAccion.get(p.accionFormacionId ?? '') ?? [];
    if (suyas.length === 0) continue;

    const dep = p.persona.departamentoSepId;
    const mun = p.persona.municipioSepId;
    /// Sin domicilio no se juzga: `cubreA` dice que sí a propósito
    /// cuando no se sabe dónde vive, y que falte el domicilio se
    /// avisa por otro lado.
    if (!dep) continue;

    const vive = {
      departamento: DEPARTAMENTO_POR_ID.get(dep)?.etiqueta ?? null,
      ciudad: mun ? (MUNICIPIO_POR_ID.get(mun)?.[2] ?? null) : null,
    };

    if (suyas.some((o) => cubreA(o.ubicacion, vive))) continue;

    const codigo = p.accionFormacion?.codigo ?? '—';
    const modalidad = String(p.accionFormacion?.modalidad ?? '—');
    const y = fuera.get(codigo) ?? {
      modalidad,
      cuantos: 0,
      dptos: new Set<string>(),
    };
    y.cuantos += 1;
    if (vive.departamento) y.dptos.add(vive.departamento);
    fuera.set(codigo, y);
  }

  /// Las virtuales primero: son las discutibles.
  const lista = [...fuera.entries()].sort((a, b) => {
    const orden = (m: string) =>
      m === 'VIRTUAL' ? 0 : m === 'HIBRIDA' ? 1 : 2;
    return (
      orden(a[1].modalidad) - orden(b[1].modalidad) ||
      b[1].cuantos - a[1].cuantos
    );
  });

  return {
    titulo: 'Gente sin matricular porque su departamento no tiene esa acción',
    cuantos: lista.reduce((n, [, y]) => n + y.cuantos, 0),
    ejemplos: lista
      .slice(0, EJEMPLOS)
      .map(
        ([codigo, y]) =>
          `${codigo.padEnd(5)} ${y.modalidad.padEnd(11)} ${String(y.cuantos).padStart(4)} personas · ${[...y.dptos].sort().join(', ')}`,
      ),
    comoSeArregla:
      'En las PRESENCIALES es la regla y está bien. En las VIRTUALES hay que decidir: si la lista de departamentos es un compromiso con el SENA, estos bloqueos son correctos; si no lo es, la regla debería dejar de mirar el departamento cuando la modalidad es VIRTUAL, y se recupera esta gente. Es una decisión del cliente, no un arreglo.',
  };
}

/**
 * DOS GREMIOS ENCENDIDOS A LA VEZ: DOS DEUDAS QUE DESPIERTAN.
 *
 * Hay dos defectos conocidos que HOY NO HACEN DAÑO porque solo hay
 * un convenio con gente, y que pasan a hacerlo el día que se
 * encienda el segundo:
 *
 *   - LA CARACTERIZACIÓN se filtra solo por «autorización viva», sin
 *     atarla al convenio que se exporta, y cada marca cuelga de UNA
 *     autorización ---la del gremio donde se capturó primero---. Así
 *     que quien revoque en un gremio pierde su caracterización en el
 *     reporte del OTRO, donde sigue autorizando. Y al revés: una
 *     marca consentida solo en uno viaja en el reporte del otro.
 *
 *   - `papelEnConvenio`, `clasificacion` y `sectorEconomico` son de
 *     la ORGANIZACIÓN y el F7 es POR CONVENIO. La misma empresa puede
 *     ser conviniente en un gremio y beneficiaria en el otro, y solo
 *     cabe un valor: quien lo arregle en un panel lo estropea en el
 *     F7 del otro.
 *
 * LOS DOS PIDEN MIGRACIÓN, así que no se arreglan «por si acaso». Lo
 * que no puede pasar es que el día que se encienda el segundo gremio
 * nadie se acuerde: un apunte en un documento se pierde, y este aviso
 * salta solo en cuanto los datos lo justifican.
 *
 * SE MIDE POR LOS DATOS Y NO POR EL INTERRUPTOR `activo`: un convenio
 * activo y vacío no reporta nada ni tiene a quién perderle una
 * caracterización. Lo que despierta la deuda es que haya gente en los
 * dos.
 */
async function dosGremiosConGente(): Promise<Hallazgo> {
  const convenios = await prisma.convenio.findMany({
    where: { activo: true },
    select: {
      slug: true,
      nombre: true,
      _count: { select: { participantes: true } },
    },
  });
  const conGente = convenios.filter((c) => c._count.participantes > 0);

  return {
    titulo:
      'Dos gremios con gente a la vez: despiertan dos defectos conocidos del F7',
    /// Con uno solo no hay nada que avisar: el cero apaga el aviso.
    cuantos: conGente.length > 1 ? conGente.length : 0,
    ejemplos: conGente.map(
      (c) => `${c.slug}  ${c._count.participantes} fichas  ${c.nombre}`,
    ),
    comoSeArregla:
      'Atar la caracterización al convenio donde se capturó, y sacar papelEnConvenio, clasificacion y sectorEconomico de la organización a una fila por convenio. Las dos piden migración: es decisión de Josse cuándo entran.',
  };
}
/**
 * INSCRITOS SIN EL MOVIMIENTO QUE LOS FECHA.
 *
 * Desde el 6 oct 2026 la tabla del comité cuenta las inscripciones por
 * el ANCLA ---la primera vez que la ficha llegó a INSCRITO, que es un
 * movimiento y no se reescribe nunca--- y no por cuándo se creó la
 * ficha. Es lo que arregla «no tengo certeza de inscripciones
 * realizadas en control de inscritos» (cliente, 5 oct 2026).
 *
 * El precio es este: una ficha que esté inscrita SIN ese movimiento no
 * tiene fecha de inscripción, así que no cae en ninguna ventana y no
 * se cuenta en ningún periodo. En el total sin ventana tampoco.
 *
 * En la base de pruebas son 12 de 1.304, y son de la siembra: nacen
 * CERTIFICADO de un salto. En producción no se sabe cuántas hay ---no
 * se mira producción--- y de ahí este control: lo dice el despliegue,
 * con nombre y apellido, en vez de que la cifra salga baja y nadie
 * sepa por qué.
 *
 * NO SE INVENTA EL MOVIMIENTO QUE FALTA. Escribir uno con una fecha
 * supuesta es meter en el registro de auditoría un hecho que no
 * consta, y el día que alguien lo audite no habrá forma de saber
 * cuáles eran de verdad. Lo que se hace es moverlas a mano desde el
 * panel ---eso sí deja movimiento--- o dejarlas como están sabiendo
 * que no entran en los conteos por periodo.
 */
async function inscritosSinAncla(): Promise<Hallazgo> {
  const YA_PASARON = [
    'INSCRITO',
    'EN_FORMACION',
    'CERTIFICADO',
    'NO_APROBO',
    'DESERTO',
    'ABANDONO',
    'RETIRADO',
  ];

  const filas: Array<{
    id: string;
    etapa: string;
    creadoEn: Date;
    codigo: string | null;
    nombre: string | null;
  }> = await prisma.$queryRawUnsafe(
    `SELECT pa."id", pa."etapa"::text AS etapa, pa."creadoEn",
            af."codigo", concat_ws(' ', p."primerNombre", p."primerApellido") AS nombre
       FROM "participantes" pa
       LEFT JOIN "acciones_formacion" af ON af."id" = pa."accionFormacionId"
       LEFT JOIN "personas" p ON p."id" = pa."personaId"
      WHERE pa."etapa"::text = ANY($1)
        AND NOT EXISTS (
          SELECT 1 FROM "movimientos_participante" m
           WHERE m."participanteId" = pa."id"
             AND m."etapaDespues" = 'INSCRITO'::"EtapaParticipante"
             AND m."etapaAntes" IS DISTINCT FROM m."etapaDespues")
      ORDER BY pa."creadoEn" DESC`,
    YA_PASARON,
  );

  const dia = (d: Date) => d.toISOString().slice(0, 10);

  return {
    titulo:
      'Fichas inscritas sin el movimiento que las fecha: no entran en ningún periodo',
    cuantos: filas.length,
    ejemplos: filas
      .slice(0, EJEMPLOS)
      .map(
        (f) =>
          `${f.codigo ?? 'sin AF'}  ${f.etapa}  creada ${dia(f.creadoEn)}  ${f.nombre ?? f.id}`,
      ),
    comoSeArregla:
      'Moverlas de etapa a mano desde el panel, que es lo unico que deja movimiento con fecha cierta. Inventarle la fecha a un movimiento de auditoria no: el dia que alguien lo audite no habra forma de saber cuales eran de verdad.',
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
    await sinSedeEnSuDepartamento(),
    await dosGremiosConGente(),
    await inscritosSinAncla(),
  ];

  const conCasos = hallazgos.filter((h) => h.cuantos > 0);

  if (conCasos.length === 0) {
    console.log('  Nada que reportar: los ocho controles salen en cero.\n');
    return;
  }

  for (const h of conCasos) {
    console.log(`▸ ${h.titulo}: ${h.cuantos}`);
    for (const e of h.ejemplos) console.log(`    ${e}`);
    /// SOLO SI LA LISTA SE CORTÓ DE VERDAD.
    ///
    /// Antes bastaba con que `cuantos` fuera mayor que los ejemplos, y
    /// eso da por supuesto que un ejemplo es una fila. Deja de ser
    /// cierto en cuanto un hallazgo cuenta una cosa y enseña otra: el
    /// de la gente sin sede cuenta PERSONAS y agrupa sus ejemplos POR
    /// ACCIÓN, así que con 5 personas en 3 acciones decía «…y 2 más»
    /// y no había ninguna más. Un informe que inventa dos casos es
    /// peor que uno que no los enseña.
    ///
    /// La lista se cortó solo si llegó al tope.
    if (h.ejemplos.length === EJEMPLOS && h.cuantos > h.ejemplos.length) {
      console.log(`    …y más, hasta ${h.cuantos}.`);
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
