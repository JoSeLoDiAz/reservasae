/**
 * Datos de aula para poder VER la pestaña «Proceso».
 *
 * Solo para desarrollo. Reparte a la gente que ya está en el
 * aula entre los seis estados académicos, para que los
 * gráficos tengan de qué hablar: si todos van al día, el
 * embudo es una línea recta y el termómetro una sola barra, y
 * así no se puede juzgar un diseño.
 *
 * Está CALIBRADO contra los umbrales de `crm.service.ts`, no
 * inventado a ojo:
 *
 *   - `TOLERANCIA = 2`      -> atrasado es ir 2 o más por debajo
 *   - `MINIMO_PARA_CERTIFICAR = 0.8`
 *   - `DIAS_PARADO = 14`
 *
 * Los grupos se colocan a mitad de camino --45 días de haber
 * empezado y 45 por delante-- para que «lo esperado a estas
 * alturas» sea justo la mitad del curso. Con eso, los perfiles
 * de abajo caen donde tienen que caer.
 *
 * NO toca a nadie fuera del aula: quien va por el embudo de
 * inscripción se queda como está.
 */

import { PrismaClient, type EtapaParticipante } from '../../generated/prisma';

const prisma = new PrismaClient();

const DIA = 86_400_000;

/// Las mismas seis de `ETAPAS_EN_AULA`.
const EN_AULA: EtapaParticipante[] = [
  'EN_FORMACION',
  'CERTIFICADO',
  'NO_APROBO',
  'RETIRADO',
  'DESERTO',
  'ABANDONO',
];

/// Qué se quiere ver en la pantalla, y con qué se consigue.
///
/// `parte` es la fracción de lo obligatorio que tendrá hecho, y
/// `diasSinEntrar` cuánto hace que no abre el aula. Con el
/// grupo a mitad de camino, lo esperado es 0.5: por debajo de
/// 0.33 ya son dos actividades de desfase en un curso de doce.
const PERFILES: Array<{
  estado: string;
  peso: number;
  parte: number;
  diasSinEntrar: number | null;
}> = [
  // nunca pisó el aula: el que hay que llamar hoy
  { estado: 'SIN_INGRESO', peso: 4, parte: 0, diasSinEntrar: null },
  // entró, se quedó corto y encima lleva tiempo sin volver
  { estado: 'ATRASADO · parado', peso: 4, parte: 0.15, diasSinEntrar: 21 },
  { estado: 'ATRASADO', peso: 3, parte: 0.25, diasSinEntrar: 9 },
  // donde debería estar
  { estado: 'AL_DIA', peso: 7, parte: 0.5, diasSinEntrar: 1 },
  { estado: 'AL_DIA · adelantado', peso: 3, parte: 0.65, diasSinEntrar: 0 },
  // ya se ganó el certificado, falta emitirlo
  { estado: 'COMPLETADO', peso: 4, parte: 0.9, diasSinEntrar: 2 },
];

const TOTAL_PESOS = PERFILES.reduce((a, p) => a + p.peso, 0);

/// Reparto estable: la misma persona cae siempre en el mismo
/// perfil. Sin esto, cada corrida movería los gráficos y no se
/// podría comparar un antes con un después.
function perfilDe(i: number) {
  let n = i % TOTAL_PESOS;
  for (const p of PERFILES) {
    if (n < p.peso) return p;
    n -= p.peso;
  }
  return PERFILES[PERFILES.length - 1];
}

async function main() {
  const ahora = Date.now();

  const gente = await prisma.participante.findMany({
    where: { etapa: { in: EN_AULA }, accionFormacionId: { not: null } },
    select: {
      id: true,
      etapa: true,
      accionFormacionId: true,
      cobertura: { select: { grupoId: true } },
    },
    orderBy: { creadoEn: 'asc' },
  });

  if (gente.length === 0) {
    console.log('No hay nadie en el aula. Corra antes `db:sembrar-prueba`.');
    return;
  }

  /// Las obligatorias y publicadas de cada acción, en orden:
  /// son las que cuentan para el porcentaje, y el servicio
  /// exige las tres condiciones a la vez.
  const actividades = await prisma.actividad.findMany({
    where: { publicada: true, obligatoria: true },
    select: { id: true, accionFormacionId: true, orden: true },
    orderBy: { orden: 'asc' },
  });

  const porAccion = new Map<string, string[]>();
  for (const a of actividades) {
    const lista = porAccion.get(a.accionFormacionId) ?? [];
    lista.push(a.id);
    porAccion.set(a.accionFormacionId, lista);
  }

  /// Los grupos, a mitad de camino. Menos UNO, que se deja sin
  /// fechas a propósito: es el que hace salir «Sin empezar», y
  /// sin él ese estado no se ve nunca en la pantalla.
  const grupos = [...new Set(gente.map((p) => p.cobertura?.grupoId).filter(Boolean))];

  /// El que se queda sin fechas tiene que tener gente EN
  /// FORMACIÓN, no vale cualquiera. A quien ya está
  /// certificado el servicio lo llama CERTIFICADO pase lo que
  /// pase, así que un grupo entero de certificados sin fechas
  /// no hace aparecer «Sin empezar» por ninguna parte -- que
  /// es justo lo que pasó la primera vez.
  const sinFechas = grupos.find((g) =>
    gente.some((p) => p.cobertura?.grupoId === g && p.etapa === 'EN_FORMACION'),
  ) as string | undefined;

  for (const g of grupos) {
    if (!g) continue;
    await prisma.grupo.update({
      where: { id: g },
      data:
        g === sinFechas
          ? { fechaInicio: null, fechaFin: null }
          : {
              fechaInicio: new Date(ahora - 45 * DIA),
              fechaFin: new Date(ahora + 45 * DIA),
            },
    });
  }

  let tocados = 0;
  let avancesPuestos = 0;

  for (const [i, p] of gente.entries()) {
    const suyas = porAccion.get(p.accionFormacionId!) ?? [];
    if (suyas.length === 0) continue;

    /// La etapa manda sobre el perfil, no al revés.
    ///
    /// A quien ya está certificado el servicio lo llama
    /// CERTIFICADO pase lo que pase, y a quien se fue no lo
    /// juzga por su ritmo. Darles un perfil del reparto sería
    /// pintar un avance que contradice su propia etapa.
    let parte: number;
    let dias: number | null;

    if (p.etapa === 'CERTIFICADO') {
      parte = 1;
      dias = 3;
    } else if (p.etapa === 'NO_APROBO') {
      // llegó al final y no alcanzó el mínimo
      parte = 0.6;
      dias = 5;
    } else if (p.etapa === 'DESERTO' || p.etapa === 'RETIRADO') {
      // avisó y se fue: su avance quedó congelado donde iba
      parte = 0.3;
      dias = 40;
    } else if (p.etapa === 'ABANDONO') {
      // dejó de entrar sin avisar: poco hecho y hace mucho
      parte = 0.1;
      dias = 60;
    } else {
      const perfil = perfilDe(i);
      parte = perfil.parte;
      dias = perfil.diasSinEntrar;
    }

    const cuantas = Math.round(suyas.length * parte);

    await prisma.avanceActividad.deleteMany({ where: { participanteId: p.id } });

    if (cuantas > 0) {
      await prisma.avanceActividad.createMany({
        data: suyas.slice(0, cuantas).map((actividadId) => ({
          participanteId: p.id,
          actividadId,
          estado: 'APROBADA' as const,
          completadaEn: new Date(ahora - (dias ?? 0) * DIA),
        })),
        skipDuplicates: true,
      });
      avancesPuestos += cuantas;
    }

    await prisma.participante.update({
      where: { id: p.id },
      data: {
        ultimoAcceso: dias === null ? null : new Date(ahora - dias * DIA),
      },
    });
    tocados += 1;
  }

  console.log(
    `Listo: ${tocados} personas del aula repartidas, ${avancesPuestos} avances puestos, ` +
      `${grupos.length} grupos con calendario (uno a propósito sin fechas).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
