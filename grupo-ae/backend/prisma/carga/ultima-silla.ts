/** La última silla, con 1, 50 y 200 peticiones a la vez. Es el criterio de INV-4. */

/**
 * QUÉ SE PRUEBA
 *
 * Un aforo con exactamente UNA silla libre, y N peticiones simultáneas
 * pidiéndola. Tiene que entrar una. Ni dos, ni ninguna.
 *
 * Se corre en las tres escalas porque cada una responde a algo
 * distinto:
 *
 *   N=1    que el montaje es correcto. Si con una sola no entra
 *          exactamente una, lo roto es la prueba, no el sistema, y
 *          conviene saberlo antes de mirar los otros resultados.
 *   N=50   que hay carrera de verdad.
 *   N=200  que la defensa no se cansa. Un candado que aguanta 50 y
 *          cede a 200 no es un candado, es una probabilidad.
 *
 * Y se prueba en las DOS capas que reparten sillas sobre la misma
 * gente, porque el sistema tiene dos aforos:
 *
 *   RESERVAS      cupos apartados por una empresa. Tiene las tres
 *                 defensas —`FOR UPDATE`, `UPDATE` condicional con
 *                 `rowCount`, y `CHECK` en la base—, así que AQUÍ
 *                 DEBE PASAR. Es el grupo de control: si esto falla,
 *                 es una regresión, no un hallazgo.
 *
 *   INSCRIPCIÓN   personas sentadas en el aula. `CrmService.asignar`
 *                 cuenta las sillas FUERA de toda transacción
 *                 (crm.service.ts:3459-3465), decide con ese número
 *                 (:3467-3475) y escribe con un
 *                 `$transaction([array])` (:3532) que no bloquea
 *                 nada. AQUÍ DEBE FALLAR: es el hallazgo G-03, y una
 *                 prueba que lo dejara pasar estaría tapándolo.
 *
 * Y la última parte no tiene concurrencia ninguna: el tope del GRUPO
 * no se mira NUNCA. Basta una petición para pasarse. Eso es la otra
 * mitad de G-03, la que el auditor describe como «fallo determinista,
 * no carrera», y es la más barata de demostrar.
 *
 * MONTAJE
 *   Cada corrida crea su propio convenio, su acción, sus ofertas, su
 *   administrador y sus personas, con un sello único. No toca ni un
 *   dato real.
 *
 * LIMPIEZA
 *   `conIsla` borra la isla entera en un `finally` y cuenta lo que
 *   quedó. Si queda algo, la corrida sale con código 1 aunque todas
 *   las garantías se cumplan: una prueba que ensucia la base es una
 *   prueba que rompe la siguiente.
 *
 * CUÁNTO TARDA
 *   Contra la base de pruebas por el túnel: ~35 s en total (montaje
 *   ~20 s, las seis avalanchas ~10 s, limpieza ~5 s). Contra una base
 *   en la misma máquina, ~10 s. Cada bloque imprime sus milisegundos
 *   reales y cuántas peticiones llegaron a estar en vuelo a la vez.
 */

import { EtapaParticipante, Modalidad, PrismaClient } from '../../generated/prisma';
import { OCUPAN_SILLA } from '../../src/crm/etapas';
import { exigirBaseSegura } from '../guardia-de-base';
import {
  aLaVez,
  apunte,
  bloque,
  cerrar,
  conIsla,
  crearOferta,
  crearParticipantes,
  exigirBaseDePruebas,
  garantiza,
  ipDePrueba,
  Isla,
  nitDePrueba,
  ocuparConReserva,
  pedir,
  porEstado,
  Respuesta,
  solapeMaximo,
} from './arnes';

// el 5433 es producción, aunque diga localhost
exigirBaseSegura('La prueba de la última silla');
exigirBaseDePruebas('La prueba de la última silla');

const prisma = new PrismaClient();

/// Las tres del encargo. Sin trampa: las mismas comprobaciones en las
/// tres, para que la diferencia entre ellas sea solo el número.
const ESCALAS = [1, 50, 200];

/// El aforo de cada oferta de prueba. Cinco y no uno: con `cuposMaximos
/// = 1` la última silla es también la primera, y eso NO es el caso que
/// se quiere probar. El fallo vive en el borde, con el contador ya
/// cargado.
const AFORO = 5;

/// Un contador global de índices, para que los NIT y los documentos de
/// las seis escalas no se pisen entre sí.
let siguiente = 0;
function reservar(cuantos: number): number {
  const desde = siguiente;
  siguiente += cuantos;
  return desde;
}

function cuerpoDeReserva(isla: Isla, ofertaId: string, indice: number) {
  return {
    ofertaId,
    nit: nitDePrueba(isla, indice),
    razonSocial: `CARGA ${isla.sello} ${indice}`,
    numeroColaboradores: 10,
    contactoNombre: `Contacto ${indice}`,
    contactoCorreo: `contacto${indice}.${isla.sello}@pruebas.invalid`,
    /// `contactoCelular`, NO `contactoTelefono`.
    ///
    /// `prisma/prueba-carga.ts:55` manda `contactoTelefono`, que no
    /// existe en `CrearReservaDto` ni en ningún otro sitio del
    /// repositorio. Con `forbidNonWhitelisted: true` (main.ts:102) eso
    /// es un 400 en TODAS las peticiones, así que hoy la única prueba
    /// de concurrencia que hay no llega a crear ni una reserva.
    contactoCelular: '3000000000',
    contactoCargo: 'Analista',
    cuposSolicitados: 1,
    aceptaTerminos: true,
    aceptaPoliticaDatos: true,
  };
}

/** Que la avalancha fue avalancha. Sin esto, «pasó» no significa nada. */
function comprobarQueHuboCarrera(n: number, respuestas: Respuesta[], ms: number): void {
  const solape = solapeMaximo(respuestas);
  apunte(`${n} peticiones en ${ms} ms · hasta ${solape} en vuelo a la vez · ${porEstado(respuestas)}`);
  if (n > 1) {
    garantiza(
      'las peticiones se solapan de verdad, no van en fila',
      solape >= 2,
      `solape máximo ${solape}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Capa de RESERVAS — hoy pasa, y tiene que seguir pasando
// ---------------------------------------------------------------------------

async function reservasAEscala(isla: Isla, n: number): Promise<void> {
  bloque(`RESERVAS · ${n} empresas por la última silla`);

  const oferta = await crearOferta(prisma, isla, `RES${n}-${isla.sello}`, AFORO);
  const relleno = reservar(1);
  await ocuparConReserva(prisma, isla, oferta.id, AFORO - 1, relleno);

  const desde = reservar(n);
  const { salidas, ms } = await aLaVez(n, (i) => () =>
    pedir('POST', '/reservas', {
      cuerpo: cuerpoDeReserva(isla, oferta.id, desde + i),
      ip: ipDePrueba(desde + i),
    }),
  );

  comprobarQueHuboCarrera(n, salidas, ms);

  const creadas = salidas.filter((r) => r.estado === 201);
  const confirmadas = creadas.filter((r) => r.cuerpo?.estado === 'CONFIRMADA');
  const enEspera = creadas.filter((r) => r.cuerpo?.estado === 'LISTA_ESPERA');
  const rotas = salidas.filter((r) => r.estado === 0 || r.estado >= 500);

  garantiza(
    'no deja entrar a dos por la última silla',
    confirmadas.length === 1,
    `confirmadas ${confirmadas.length}`,
  );
  garantiza(
    'a quien no cupo se le pone en lista de espera, no se le da un error',
    enEspera.length === n - 1 && rotas.length === 0,
    `en espera ${enEspera.length} de ${n - 1}, rotas ${rotas.length}`,
  );

  const tras = await prisma.oferta.findUniqueOrThrow({ where: { id: oferta.id } });
  garantiza(
    'el contador no se pasa del tope',
    tras.cuposOcupados <= tras.cuposMaximos,
    `${tras.cuposOcupados} de ${tras.cuposMaximos}`,
  );

  const suma = await prisma.reserva.aggregate({
    where: { ofertaId: oferta.id, estado: { not: 'CANCELADA' } },
    _sum: { cuposConfirmados: true },
  });
  garantiza(
    'el contador dice lo mismo que la suma de las reservas vivas',
    (suma._sum.cuposConfirmados ?? 0) === tras.cuposOcupados,
    `suma ${suma._sum.cuposConfirmados} · contador ${tras.cuposOcupados}`,
  );
}

// ---------------------------------------------------------------------------
// Capa de INSCRIPCIÓN — hoy FALLA. Es el hallazgo G-03
// ---------------------------------------------------------------------------

async function inscripcionAEscala(isla: Isla, n: number): Promise<void> {
  bloque(`INSCRIPCIÓN · ${n} asesores sentando gente en la última silla`);

  const destino = await crearOferta(prisma, isla, `INS${n}-${isla.sello}`, AFORO);
  /// La de origen tiene aforo de sobra: de ahí solo salen fichas, y no
  /// se quiere que su propio tope estorbe.
  const origen = await crearOferta(prisma, isla, `ORI${n}-${isla.sello}`, 1000);

  const yaDentro = reservar(AFORO - 1);
  await crearParticipantes(prisma, isla, yaDentro, AFORO - 1, {
    ofertaId: destino.id,
    accionFormacionId: destino.accionFormacionId,
    etapa: EtapaParticipante.INSCRITO,
  });

  const desde = reservar(n);
  const candidatos = await crearParticipantes(prisma, isla, desde, n, {
    ofertaId: origen.id,
    accionFormacionId: origen.accionFormacionId,
    etapa: EtapaParticipante.INSCRITO,
  });

  const { salidas, ms } = await aLaVez(n, (i) => () =>
    pedir('PATCH', `/admin/participantes/${candidatos[i]}/formacion`, {
      cuerpo: { ofertaId: destino.id },
      cookie: isla.cookie,
      ip: ipDePrueba(desde + i),
    }),
  );

  comprobarQueHuboCarrera(n, salidas, ms);

  const aceptadas = salidas.filter((r) => r.estado === 200);
  const rechazadas = salidas.filter((r) => r.estado === 409);

  garantiza(
    'no sienta a dos personas en la última silla del aula',
    aceptadas.length === 1,
    `aceptadas ${aceptadas.length}`,
  );
  garantiza(
    'a los demás se les dice que el cupo está lleno',
    rechazadas.length === n - 1,
    `409 ${rechazadas.length} de ${n - 1}`,
  );

  const vivos = await prisma.participante.count({
    where: { ofertaId: destino.id, etapa: { in: OCUPAN_SILLA } },
  });
  garantiza(
    'nunca hay más gente inscrita que sillas en la oferta',
    vivos <= destino.cuposMaximos,
    `${vivos} personas para ${destino.cuposMaximos} sillas`,
  );

  /// El sobrecupo SÍ existe y es deliberado (`Participante.sobrecupoPorId`
  /// / `sobrecupoMotivo`), pero exige que alguien lo autorice y diga por
  /// qué. Lo que no puede haber es gente por encima del tope SIN esa
  /// firma: eso no es sobrecupo, es sobrecupo colado.
  const colados = await prisma.participante.count({
    where: {
      ofertaId: destino.id,
      etapa: { in: OCUPAN_SILLA },
      sobrecupoMotivo: null,
    },
  });
  garantiza(
    'todo lo que pasa del tope queda autorizado y con motivo escrito',
    colados <= destino.cuposMaximos,
    `${colados} sin autorización para ${destino.cuposMaximos} sillas`,
  );
}

// ---------------------------------------------------------------------------
// El tope del GRUPO — falla con UNA sola petición
// ---------------------------------------------------------------------------

/**
 * Aquí no hay carrera y aun así se rebasa el aforo.
 *
 * `asignar` compara contra `oferta.cuposMaximos` y NUNCA mira
 * `cobertura.cuposMaximos` (crm.service.ts:3478-3484 solo comprueba que
 * el grupo sea de esa oferta). El grupo es el aula física: el número
 * que importa el primer día de clase es este, no el de la oferta.
 *
 * Se deja aquí y no en otro fichero porque es el mismo hallazgo, y
 * porque enseña algo que las tres escalas no pueden enseñar: que N=1
 * también rompe. Un lector que solo vea la avalancha se lleva la idea
 * de que esto se arregla con un candado, y no: falta además la
 * comprobación.
 */
async function grupoLlenoConUnaSolaPeticion(isla: Isla): Promise<void> {
  bloque('INSCRIPCIÓN · el tope del GRUPO, con una sola petición');

  const oferta = await crearOferta(prisma, isla, `COB-${isla.sello}`, 1000);
  const origen = await crearOferta(prisma, isla, `COBORI-${isla.sello}`, 1000);

  const grupo = await prisma.grupo.create({
    data: {
      accionFormacionId: oferta.accionFormacionId,
      numero: 1,
      modalidad: Modalidad.VIRTUAL,
    },
  });
  const cobertura = await prisma.grupoCobertura.create({
    data: {
      grupoId: grupo.id,
      ubicacionId: isla.ubicacionId,
      modalidad: Modalidad.VIRTUAL,
      cuposBase: 1,
      cuposMaximos: 1,
    },
  });

  // el aula de uno, ya llena
  const dentro = reservar(1);
  await crearParticipantes(prisma, isla, dentro, 1, {
    ofertaId: oferta.id,
    accionFormacionId: oferta.accionFormacionId,
    coberturaId: cobertura.id,
    etapa: EtapaParticipante.INSCRITO,
  });

  const fuera = reservar(1);
  const [candidato] = await crearParticipantes(prisma, isla, fuera, 1, {
    ofertaId: origen.id,
    accionFormacionId: origen.accionFormacionId,
    etapa: EtapaParticipante.INSCRITO,
  });

  const respuesta = await pedir('PATCH', `/admin/participantes/${candidato}/formacion`, {
    cuerpo: { ofertaId: oferta.id, coberturaId: cobertura.id },
    cookie: isla.cookie,
    ip: ipDePrueba(fuera),
  });

  apunte(`una sola petición · estado ${respuesta.estado}`);
  garantiza(
    'no mete a nadie en un grupo lleno, ni siquiera de uno en uno',
    respuesta.estado === 409,
    `estado ${respuesta.estado}`,
  );

  const enElAula = await prisma.participante.count({
    where: { coberturaId: cobertura.id, etapa: { in: OCUPAN_SILLA } },
  });
  garantiza(
    'en el grupo nunca hay más gente que sillas',
    enElAula <= cobertura.cuposMaximos,
    `${enElAula} personas para ${cobertura.cuposMaximos} silla`,
  );
}

// ---------------------------------------------------------------------------

async function main() {
  await conIsla(prisma, async (isla) => {
    for (const n of ESCALAS) await reservasAEscala(isla, n);
    for (const n of ESCALAS) await inscripcionAEscala(isla, n);
    await grupoLlenoConUnaSolaPeticion(isla);
  });
  cerrar();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
