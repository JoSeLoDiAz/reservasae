/** El recorrido por el formulario de los leads que ya existen. */

/**
 * POR QUÉ EXISTE ESTE GUION.
 *
 * Las siembras crean personas directamente en el CRM --es lo que hay
 * que hacer: hace falta gente para probar Gestión de leads, los grupos
 * y los reportes--, pero el formulario público no se abrió nunca, así
 * que `pasos_de_visita` se queda vacía. Resultado: Gestión de leads
 * enseña 115 leads y Tráfico del formulario dice 50 aperturas y 5
 * registros.
 *
 * El cliente lo leyó como un error del panel, y con razón:
 * «tenemos datos de prueba cierto, si tengo 115 estos mismos valores
 * deben tenerse en Tráfico de formulario [...] no tengo concordancia,
 * por eso me genera ruido» (23 sep 2026). No es un error de la
 * pantalla: es que a los datos de prueba les faltaba la mitad.
 *
 * Esto la siembra: por cada persona que entró por el formulario
 * --`origen` AUTOGESTION, REDES, WHATSAPP, CORREO, EVENTO-- escribe su
 * visita completa, con la fecha de su propia ficha y la procedencia que
 * corresponde a su campaña de entrada. Y además siembra visitas que NO
 * acabaron en nadie, que es lo que hace que un embudo se parezca a la
 * realidad: en producción, de 12.243 aperturas se preinscribieron 972.
 *
 * ES IDEMPOTENTE: la tabla tiene `@@unique([visitaId, paso])` y el
 * `visitaId` se deriva del id de la persona, así que correrlo dos veces
 * no duplica nada.
 */

import { PrismaClient, type Prisma } from '../../generated/prisma';

import { soloEnPruebas } from './solo-pruebas';

const prisma = new PrismaClient();

/// Los diez peldaños, en orden. Copiados a propósito y no importados
/// de `src/embudo/escalera.ts`: este guion vive en `prisma/` y no
/// arrastra el módulo de Nest. Si la escalera cambia, esta lista se
/// queda corta y el embudo lo enseña --que es mejor que un import que
/// arrastre medio backend a una siembra--.
const ESCALERA = [
  'LLEGO',
  'CATALOGO_LISTO',
  'ELIGIO_UBICACION',
  'VIO_ACCIONES',
  'ELIGIO_ACCION',
  'AUTORIZO',
  'DATOS_COMPLETOS',
  'LLEGO_A_REVISION',
  'ENVIO',
  'REGISTRADO',
] as const;

/// Los que de verdad entran por el formulario público. `EMPRESA` y
/// `ASESOR` no: esos los carga el equipo, y darles una visita sería
/// inventar tráfico que nunca hubo.
const ENTRAN_POR_EL_FORMULARIO = new Set([
  'AUTOGESTION',
  'REDES',
  'INSTAGRAM',
  'FACEBOOK',
  'WHATSAPP',
  'CORREO',
  'EVENTO',
  'REFERIDO',
  'OTRO',
]);

/// Cómo llegó, según la campaña con la que entró. Devuelve lo que
/// `procedenciaSql()` lee: el referente, la fuente y la campaña.
function comoLlego(campana: string | null): {
  utmFuente: string | null;
  utmCampana: string | null;
  referente: string | null;
  huboFbclid: boolean;
  puerta: string;
} {
  const c = campana ?? '';
  if (c.startsWith('mailing')) {
    return {
      utmFuente: 'correo',
      utmCampana: c,
      referente: 'mail.google.com',
      huboFbclid: false,
      puerta: 'RUTA',
    };
  }
  if (c.startsWith('pauta')) {
    /// La mitad con `fbclid`: es lo que prueba que fue pagada. Sin él
    /// cuenta como META --sabemos que es Meta, no cuál-- y así el
    /// tablero enseña las dos situaciones.
    const pagada = c.length % 2 === 0;
    return {
      utmFuente: pagada ? 'facebook' : 'redes',
      utmCampana: c,
      referente: pagada ? 'facebook.com' : null,
      huboFbclid: pagada,
      puerta: 'RUTA',
    };
  }
  if (c.startsWith('reserva')) {
    return {
      utmFuente: 'reserva',
      utmCampana: c,
      referente: null,
      huboFbclid: false,
      puerta: 'RUTA',
    };
  }
  /// Sin campaña: lo que en el tablero sale como «no dejó rastro», que
  /// es lo más común cuando el enlace se manda por WhatsApp.
  return {
    utmFuente: null,
    utmCampana: null,
    referente: null,
    huboFbclid: false,
    puerta: 'RUTA',
  };
}

/// Ancho de pantalla: casi todo celular, como en producción.
function anchoDe(i: number): string {
  if (i % 10 === 0) return 'ESCRITORIO';
  if (i % 17 === 0) return 'TABLET';
  return 'MOVIL';
}

function menos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() - minutos * 60_000);
}

async function main() {
  soloEnPruebas('db:sembrar-trafico');

  const gente = await prisma.participante.findMany({
    select: {
      id: true,
      creadoEn: true,
      origen: true,
      etapa: true,
      campanaDeEntrada: true,
      convenioId: true,
      convenio: { select: { slug: true } },
      enlaces: { select: { id: true }, take: 1 },
    },
    orderBy: { creadoEn: 'asc' },
  });

  const delFormulario = gente.filter((p) => ENTRAN_POR_EL_FORMULARIO.has(p.origen));
  console.log(
    `${gente.length} personas en el CRM, ${delFormulario.length} entraron por el formulario.`,
  );

  const filas: Prisma.PasoDeVisitaCreateManyInput[] = [];

  /// 1 · LA VISITA DE CADA PERSONA, completa hasta REGISTRADO.
  delFormulario.forEach((p, i) => {
    const via = comoLlego(p.campanaDeEntrada);
    const ancho = anchoDe(i);
    /// Derivado de su id: correrlo otra vez escribe las mismas filas y
    /// el índice único las descarta.
    const visitaId = `demo-${p.id}`;
    ESCALERA.forEach((paso, k) => {
      /// El recorrido ocupa unos nueve minutos antes de su ficha: así
      /// el «Día a día» reparte la visita en el mismo día de la
      /// persona y no en el anterior.
      filas.push({
        visitaId,
        paso,
        ms: 1500 + k * 4000,
        slug: p.convenio.slug,
        convenioId: p.convenioId,
        creadoEn: menos(p.creadoEn, ESCALERA.length - k),
        ...(paso === 'LLEGO'
          ? {
              puerta: via.puerta,
              utmFuente: via.utmFuente,
              utmCampana: via.utmCampana,
              huboFbclid: via.huboFbclid,
              referente: via.referente,
              ancho,
              navegador: ancho === 'MOVIL' ? 'Chrome Mobile' : 'Chrome',
            }
          : {}),
      });
    });
  });

  /// 2 · LAS QUE NO ACABARON EN NADIE.
  ///
  /// Sin esto el embudo sale recto --todos los que entran se
  /// preinscriben-- y el «Donde más se cae» no tendría nada que decir.
  /// Nueve visitas caídas por cada una que llegó al final, que es la
  /// proporción de producción (12.243 aperturas, 972 registros), y cada
  /// una se para en un peldaño distinto.
  const CAIDAS_POR_REGISTRO = 9;
  delFormulario.forEach((p, i) => {
    const via = comoLlego(p.campanaDeEntrada);
    for (let j = 0; j < CAIDAS_POR_REGISTRO; j++) {
      const ancho = anchoDe(i + j);
      /// La mayoría se va en los dos primeros peldaños, que es lo que
      /// pasa de verdad: el escáner de correo y quien cierra antes de
      /// que cargue el catálogo.
      const hasta = j < 6 ? 2 : j < 8 ? 4 : 6;
      const visitaId = `demo-caida-${p.id}-${j}`;
      for (let k = 0; k < hasta; k++) {
        filas.push({
          visitaId,
          paso: ESCALERA[k],
          ms: 900 + k * 2500,
          slug: p.convenio.slug,
          convenioId: p.convenioId,
          creadoEn: menos(p.creadoEn, 30 + j * 7 - k),
          ...(k === 0
            ? {
                puerta: via.puerta,
                utmFuente: via.utmFuente,
                utmCampana: via.utmCampana,
                huboFbclid: via.huboFbclid,
                referente: via.referente,
                ancho,
                navegador: ancho === 'MOVIL' ? 'Chrome Mobile' : 'Chrome',
              }
            : {}),
        });
      }
    }
  });

  /// 3 · EL ENLACE PARA COMPLETAR DATOS.
  ///
  /// El formulario público manda un correo con ese enlace a cada
  /// preinscrito, y de esa tabla sale la cadena «entraron por el
  /// formulario → pasaron a datos completos → siguen a medias». Las
  /// siembras nunca lo crearon, así que la cadena decía 9 cuando el CRM
  /// tenía 105 personas del formulario: la misma incoherencia que el
  /// embudo, por el mismo motivo.
  ///
  /// `usadoEn` solo en quien ya pasó de CONTACTADO: es quien de verdad
  /// entregó sus datos, y así «pasaron a datos completos» coincide con
  /// lo que enseña Gestión de leads.
  const YA_ENTREGO = new Set(['DATOS_COMPLETOS', 'INSCRITO', 'EN_FORMACION', 'CERTIFICADO']);
  const enlaces = delFormulario
    .filter((p) => p.enlaces.length === 0)
    .map((p, i) => {
      const entrego = YA_ENTREGO.has(p.etapa);
      const abierto = new Date(p.creadoEn.getTime() + 3_600_000 + i * 1_000);
      return {
        token: `demo-${p.id}`,
        participanteId: p.id,
        creadoEn: p.creadoEn,
        expiraEn: new Date(p.creadoEn.getTime() + 15 * 24 * 60 * 60 * 1000),
        delRegistro: true,
        abiertoEn: entrego ? abierto : null,
        usadoEn: entrego ? abierto : null,
      };
    });

  console.log(
    `Escribiendo ${filas.length} pasos de visita y ${enlaces.length} enlaces de completado…`,
  );
  if (enlaces.length > 0) {
    await prisma.enlaceCompletado.createMany({ data: enlaces, skipDuplicates: true });
  }

  /// `skipDuplicates`: es lo que vuelve el guion repetible. El índice
  /// único es `(visitaId, paso)`.
  const { count } = await prisma.pasoDeVisita.createMany({
    data: filas,
    skipDuplicates: true,
  });

  const [cuenta] = await prisma.$queryRaw<
    Array<{ visitas: bigint; registros: bigint }>
  >`
    SELECT COUNT(DISTINCT CASE WHEN "paso" = 'LLEGO' THEN "visitaId" END) AS visitas,
           COUNT(DISTINCT CASE WHEN "paso" = 'REGISTRADO' THEN "visitaId" END) AS registros
      FROM "pasos_de_visita"
  `;
  console.log(`\n✓ ${count} filas nuevas.`);
  console.log(
    `  El formulario queda con ${Number(cuenta.visitas)} aperturas y ${Number(
      cuenta.registros,
    )} preinscripciones.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
