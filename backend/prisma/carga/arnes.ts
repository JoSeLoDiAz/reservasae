/** El arnés de las pruebas de concurrencia: montar, disparar a la vez, limpiar. */

/**
 * POR QUÉ ESTO NO ES UN `.spec.ts`
 *
 * En `backend/src` hay 82 ficheros de spec y 853 bloques `it`, y todos
 * son dobles en memoria: ni uno solo abre un `PrismaClient`. Dos de
 * ellos —`src/crm/cambiar-etapa.spec.ts:109` y
 * `src/cronograma/cupos-editables.spec.ts:57`— sustituyen `$queryRaw`
 * por `() => Promise.resolve([])`, así que el `SELECT ... FOR UPDATE`
 * que dicen probar NO SE EJECUTA NUNCA. Una prueba de concurrencia
 * contra un doble no prueba la concurrencia: prueba el doble.
 *
 * Un candado de Postgres solo se puede comprobar contra Postgres, y
 * «dos peticiones a la vez» solo se comprueba mandando dos peticiones a
 * la vez. Por eso esto es un guión de `ts-node` contra la API y la base
 * de verdad, igual que `prisma/prueba-carga.ts`, del que sale.
 *
 * Y hay una razón práctica: `jest` está configurado con `rootDir: src`
 * y `testRegex: .*\.spec\.ts$` (backend/package.json). Meter aquí un
 * spec que necesita base haría que `pnpm test` dejara de correr sin
 * Postgres delante. Lo que falta no es mover estas pruebas a jest: es
 * que ALGO las corra solo. Hoy no hay integración continua, y esa es la
 * causa raíz de que el enum se rompiera sin que nadie se enterara.
 */

import { randomBytes, randomUUID } from 'node:crypto';

import {
  EstadoReserva,
  EtapaParticipante,
  Modalidad,
  PrismaClient,
  RolAdmin,
  RolConvenio,
  TipoUbicacion,
} from '../../generated/prisma';
import { hashearClave } from '../../src/admin/claves';

// ---------------------------------------------------------------------------
// A dónde se apunta
// ---------------------------------------------------------------------------

/// 127.0.0.1 y no «localhost»: el fetch de Node prueba ::1 primero y
/// Nest escucha en 0.0.0.0, que es solo IPv4. Con «localhost» la
/// conexión se corta sin explicación. Está avisado en CLAUDE.md y
/// aun así se pierde media tarde cada vez.
export const API = process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4100}`;

/// El nombre de la galleta de sesión. Copiado de
/// `src/admin/admin.guard.ts:18` a propósito: importarlo de ahí
/// arrastraría medio Nest a un guión de ts-node.
const COOKIE_SESION = 'convoca_sesion';

// ---------------------------------------------------------------------------
// Los dos guardias
// ---------------------------------------------------------------------------

/**
 * Estas pruebas ESCRIBEN: crean un convenio entero, cientos de
 * personas y reservas, y luego lo borran. `exigirBaseSegura` (el del
 * puerto 5433) no basta para eso.
 *
 * Se pide lo mismo que pide `prisma/seed/prueba.ts:37-60`, y por lo
 * mismo: dos condiciones independientes, para que ninguna se cumpla
 * por descuido. La lección de `guardia-de-base.ts` es que un aviso
 * escrito no es un candado; la de las cuatro migraciones es que un
 * candado con una sola condición se salta sin querer.
 */
export function exigirBaseDePruebas(que = 'Esta prueba'): void {
  const url = process.env.DATABASE_URL ?? '';
  const nombreBase = url.split('/').pop()?.split('?')[0] ?? '';

  const problemas: string[] = [];
  if (process.env.ENTORNO !== 'prueba') problemas.push('ENTORNO no vale "prueba"');
  if (!nombreBase.includes('prueba')) {
    problemas.push(`la base se llama "${nombreBase}" y no lleva "prueba"`);
  }

  if (problemas.length === 0) return;

  console.error(`\n✋ ${que} inventa datos y los borra. No debe tocar producción.`);
  for (const p of problemas) console.error(`  · ${p}`);
  console.error('\n  Se corre contra la base de PRUEBAS, que el túnel trae al 5434:');
  console.error('    powershell -ExecutionPolicy Bypass -File scripts\\tunel-pruebas.ps1');
  console.error('    $env:ENTORNO="prueba"');
  console.error('    $env:DATABASE_URL="postgresql://...@127.0.0.1:5434/reservasae_prueba"\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Peticiones
// ---------------------------------------------------------------------------

export type Respuesta = {
  estado: number;
  cuerpo: any;
  /// Cuándo salió y cuándo volvió. Sin esto no se puede DECIR si de
  /// verdad fueron en paralelo, solo suponerlo.
  desde: number;
  hasta: number;
  /// Solo cuando ni siquiera hubo respuesta HTTP.
  error?: string;
};

type OpcionesDePeticion = {
  cuerpo?: unknown;
  ip?: string;
  cookie?: string;
  cabeceras?: Record<string, string>;
};

/**
 * Una IP distinta por petición.
 *
 * `ThrottlerIpGuard` (src/comun/throttler-ip.guard.ts) cuenta por
 * `CF-Connecting-IP`, y `POST /reservas` admite 10 por minuto. Con 200
 * peticiones desde la misma IP, 190 se van en 429 y la prueba mediría
 * el limitador en vez del candado.
 *
 * `prueba-carga.ts:107` usa `10.0.0.${i+1}`, que a partir de la 255
 * deja de ser una IP. Aquí se reparten en dos octetos para que 200 —y
 * 60.000— sigan siendo direcciones de verdad.
 */
export function ipDePrueba(indice: number): string {
  const tercero = 1 + (Math.floor(indice / 250) % 250);
  const cuarto = 1 + (indice % 250);
  return `10.77.${tercero}.${cuarto}`;
}

/** Una petición que NUNCA lanza: un fallo de red es un dato, no un final. */
export async function pedir(
  metodo: string,
  ruta: string,
  opciones: OpcionesDePeticion = {},
): Promise<Respuesta> {
  const cabeceras: Record<string, string> = {
    'content-type': 'application/json',
    'cf-connecting-ip': opciones.ip ?? '10.77.0.1',
    ...(opciones.cabeceras ?? {}),
  };
  if (opciones.cookie) cabeceras.cookie = opciones.cookie;

  const desde = Date.now();
  try {
    const respuesta = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    });
    const texto = await respuesta.text();
    let cuerpo: any = null;
    try {
      cuerpo = texto ? JSON.parse(texto) : null;
    } catch {
      // el 500 de Nest a veces no es JSON: se guarda tal cual
      cuerpo = texto;
    }
    return { estado: respuesta.status, cuerpo, desde, hasta: Date.now() };
  } catch (error) {
    /// Estado 0 = ni siquiera hubo respuesta. Se distingue del 500
    /// porque un ECONNRESET con 200 peticiones dice otra cosa: que el
    /// servidor no aguanta la avalancha, que también hay que saberlo.
    return { estado: 0, cuerpo: null, desde, hasta: Date.now(), error: String(error) };
  }
}

/**
 * Dispara N tareas EN LA MISMA VUELTA del bucle de eventos.
 *
 * `Promise.all(array.map(...))` parece hacerlo, pero cada vuelta del
 * `map` construye el cuerpo, calcula la IP y serializa el JSON antes de
 * soltar la petición. Con N=200 eso reparte los disparos por varios
 * milisegundos, y esos milisegundos son justo la ventana que la prueba
 * quiere abrir. Aquí se prepara TODO primero y la puerta se abre
 * después: cuando se resuelve `puerta`, las N llamadas salen como
 * microtareas seguidas, sin nada en medio.
 */
export async function aLaVez<T>(
  cuantas: number,
  preparar: (indice: number) => () => Promise<T>,
): Promise<{ salidas: T[]; ms: number }> {
  const listas: Array<() => Promise<T>> = [];
  for (let i = 0; i < cuantas; i += 1) listas.push(preparar(i));

  let abrir: () => void = () => undefined;
  const puerta = new Promise<void>((resolver) => {
    abrir = resolver;
  });
  const corriendo = listas.map((tarea) => puerta.then(tarea));

  const t0 = Date.now();
  abrir();
  const salidas = await Promise.all(corriendo);
  return { salidas, ms: Date.now() - t0 };
}

/**
 * Cuántas peticiones llegaron a estar en vuelo A LA VEZ.
 *
 * Es la única prueba honesta de que la avalancha fue avalancha. Si
 * sale 1, no hubo carrera y el resultado no dice nada: la prueba
 * habría «pasado» por no haberse ejecutado, que es el modo de fallo
 * más caro que hay.
 */
export function solapeMaximo(respuestas: Respuesta[]): number {
  const eventos: Array<[number, number]> = [];
  for (const r of respuestas) {
    eventos.push([r.desde, 1]);
    eventos.push([r.hasta, -1]);
  }
  // a igualdad de milisegundo, primero los cierres: cuenta a la baja
  eventos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let vivas = 0;
  let maximo = 0;
  for (const [, delta] of eventos) {
    vivas += delta;
    if (vivas > maximo) maximo = vivas;
  }
  return maximo;
}

/** El reparto de códigos, para no esconder nada en un promedio. */
export function porEstado(respuestas: Respuesta[]): string {
  const cuenta = new Map<number, number>();
  for (const r of respuestas) cuenta.set(r.estado, (cuenta.get(r.estado) ?? 0) + 1);
  return [...cuenta.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([estado, n]) => `${estado === 0 ? 'sin respuesta' : estado}×${n}`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// El marcador
// ---------------------------------------------------------------------------

let fallos = 0;
let comprobaciones = 0;

/**
 * El nombre dice lo que se GARANTIZA, no lo que se hace.
 *
 * «no deja entrar a dos por la última silla», nunca «testea reservas».
 * Quien lea la salida en rojo tiene que entender qué se rompió sin
 * abrir el fichero.
 */
export function garantiza(loQue: string, seCumple: boolean, detalle = ''): void {
  comprobaciones += 1;
  const cola = detalle ? `  (${detalle})` : '';
  console.log(`  ${seCumple ? 'OK    ' : 'FALLA '} ${loQue}${cola}`);
  if (!seCumple) fallos += 1;
}

export function bloque(titulo: string): void {
  console.log(`\n${titulo}`);
}

export function apunte(texto: string): void {
  console.log(`  ·      ${texto}`);
}

export function cerrar(): void {
  console.log(
    fallos === 0
      ? `\n${comprobaciones} garantías, todas se cumplen.`
      : `\n${fallos} de ${comprobaciones} garantías NO se cumplen.`,
  );
  process.exitCode = fallos === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// La isla: datos propios, para no tocar ni un dato real
// ---------------------------------------------------------------------------

/**
 * `prueba-carga.ts` coge la oferta real más pequeña, le cambia
 * `visible` y le mueve el contador. Funciona, pero deja la prueba
 * atada a que haya datos cargados y a restaurarlos bien en el
 * `finally` —y si el proceso muere en medio, la oferta se queda
 * publicada—.
 *
 * Aquí cada corrida se construye SU convenio, SU acción, SU oferta y
 * SU administrador, con un sello único. Nada de lo que se toca existía
 * antes, así que la limpieza es un borrado y no una restauración: si
 * el proceso muere, lo que queda es basura identificable y no un dato
 * real a medio arreglar.
 */
export type Isla = {
  /// Identifica esta corrida en todo lo que crea.
  sello: string;
  convenioId: string;
  ubicacionId: string;
  politicaId: string;
  adminId: string;
  /// Ya lista para mandar en la cabecera `cookie`.
  cookie: string;
  /// Prefijo de los NIT de esta corrida. La limpieza va por aquí.
  nitPrefijo: string;
  /// Prefijo de los documentos inventados.
  documentoPrefijo: string;
};

export function nitDePrueba(isla: Isla, indice: number): string {
  // 13 dígitos: cabe de sobra en el 5..15 que exige normalizarNit
  return `${isla.nitPrefijo}${String(indice).padStart(5, '0')}`;
}

/** Espera a que la API conteste. Sin esto el primer fallo es un ECONNREFUSED. */
export async function esperarALaApi(segundos = 20): Promise<void> {
  const limite = Date.now() + segundos * 1000;
  for (;;) {
    const r = await pedir('GET', '/estado');
    if (r.estado === 200) return;
    if (Date.now() > limite) {
      throw new Error(
        `La API no contesta en ${API} (último estado ${r.estado}). ` +
          'Levante el backend: pnpm --filter backend start:dev',
      );
    }
    await new Promise((r2) => setTimeout(r2, 500));
  }
}

export async function montarIsla(prisma: PrismaClient): Promise<Isla> {
  const sello = randomBytes(4).toString('hex');
  /// Seis dígitos del reloj + el índice. Sirve de prefijo para
  /// borrar EXACTAMENTE lo de esta corrida y nada más.
  const marca = String(Date.now() % 1_000_000).padStart(6, '0');

  const convenio = await prisma.convenio.create({
    data: {
      slug: `zz-carga-${sello}`,
      nombre: `CONVENIO DE PRUEBA DE CARGA ${sello}`,
      nit: '900000000',
      activo: true,
    },
  });

  const ubicacion = await prisma.ubicacion.create({
    data: {
      nombre: `CARGA ${sello}`,
      tipo: TipoUbicacion.CIUDAD,
      departamento: `CARGA ${sello}`,
    },
  });

  /// Sin política vigente, `ReservasService.politicaVigente`
  /// (reservas.service.ts:531-545) contesta 409 a todo y la prueba
  /// mediría eso.
  const politica = await prisma.politicaDatos.create({
    data: {
      convenioId: convenio.id,
      destinatario: 'RESERVA',
      version: 1,
      titulo: 'Política de prueba de carga',
      contenido: 'Texto inventado para una prueba. No es una política real.',
    },
  });

  const clave = `Carga-${randomBytes(6).toString('hex')}`;
  const admin = await prisma.admin.create({
    data: {
      correo: `carga-${sello}@pruebas.invalid`,
      nombre: `Prueba de carga ${sello}`,
      hashClave: await hashearClave(clave),
      rol: RolAdmin.SUPERADMIN,
      // si no, el guard contesta 403 a todo
      debeCambiarClave: false,
      convenios: {
        create: [
          // el que alcanza en las cuatro áreas que se tocan aquí
          { convenioId: convenio.id, rol: RolConvenio.LIDER_SISTEMAS },
        ],
      },
    },
  });

  const sesion = await fetch(`${API}/admin/sesion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.77.0.1' },
    body: JSON.stringify({ correo: admin.correo, clave }),
  });
  if (sesion.status !== 200) {
    throw new Error(
      `No se pudo abrir sesión de administrador (${sesion.status}): ${await sesion.text()}`,
    );
  }
  const galletas =
    typeof sesion.headers.getSetCookie === 'function'
      ? sesion.headers.getSetCookie()
      : [sesion.headers.get('set-cookie') ?? ''];
  const cookie = galletas
    .map((g) => g.split(';')[0])
    .find((g) => g.startsWith(`${COOKIE_SESION}=`));
  if (!cookie) throw new Error('El login no devolvió la galleta de sesión.');

  return {
    sello,
    convenioId: convenio.id,
    ubicacionId: ubicacion.id,
    politicaId: politica.id,
    adminId: admin.id,
    cookie,
    nitPrefijo: `99${marca}`,
    documentoPrefijo: `CARGA${marca}`,
  };
}

/** Una acción visible con su oferta abierta. Es lo que hace falta para reservar. */
export async function crearOferta(
  prisma: PrismaClient,
  isla: Isla,
  codigo: string,
  cuposMaximos: number,
): Promise<{ id: string; accionFormacionId: string; cuposMaximos: number }> {
  const accion = await prisma.accionFormacion.create({
    data: {
      convenioId: isla.convenioId,
      codigo,
      nombre: `Acción ${codigo} de la prueba de carga`,
      modalidad: Modalidad.VIRTUAL,
      // sin esto, `crear` contesta 409: la oferta no está abierta
      visible: true,
    },
  });

  const oferta = await prisma.oferta.create({
    data: {
      accionFormacionId: accion.id,
      ubicacionId: isla.ubicacionId,
      modalidad: Modalidad.VIRTUAL,
      cuposMaximos,
      cuposOcupados: 0,
      abierta: true,
    },
  });

  return { id: oferta.id, accionFormacionId: accion.id, cuposMaximos };
}

/**
 * Ocupa cupos con una reserva puesta a mano.
 *
 * A mano y no por la API a propósito: el montaje tiene que ser
 * DETERMINISTA. Si las sillas previas se ocuparan con peticiones, un
 * fallo del montaje se leería como un fallo de la prueba.
 */
export async function ocuparConReserva(
  prisma: PrismaClient,
  isla: Isla,
  ofertaId: string,
  cupos: number,
  indice: number,
): Promise<{ reservaId: string; empresaId: string; nit: string }> {
  const nit = nitDePrueba(isla, indice);
  const empresa = await prisma.empresa.create({
    data: { nit, razonSocial: `CARGA ${isla.sello} RELLENO ${indice}` },
  });

  const reserva = await prisma.reserva.create({
    data: {
      empresaId: empresa.id,
      ofertaId,
      cuposSolicitados: cupos,
      cuposConfirmados: cupos,
      cuposEnEspera: 0,
      estado: EstadoReserva.CONFIRMADA,
      contactoNombre: `Relleno ${indice}`,
      contactoCorreo: `relleno${indice}.${isla.sello}@pruebas.invalid`,
      aceptaTerminos: true,
      aceptaPoliticaDatos: true,
      politicaDatosId: isla.politicaId,
    },
  });

  await prisma.oferta.update({
    where: { id: ofertaId },
    data: { cuposOcupados: { increment: cupos } },
  });

  return { reservaId: reserva.id, empresaId: empresa.id, nit };
}

/**
 * Una persona con su ficha, lista para que la muevan.
 *
 * `esDePrueba: true` no es decorativo: sin esa marca el RUI —un portal
 * del Estado— acabaría consultando documentos inventados, y el
 * comentario de `schema.prisma:838-847` lo explica mejor que nadie.
 * Además el documento NO es numérico, así que no puede coincidir con
 * la cédula de ninguna persona real.
 */
export async function crearParticipante(
  prisma: PrismaClient,
  isla: Isla,
  indice: number,
  donde: {
    ofertaId?: string;
    accionFormacionId?: string;
    coberturaId?: string;
    etapa?: EtapaParticipante;
  },
): Promise<string> {
  const persona = await prisma.persona.create({
    data: {
      tipoDocumentoSepId: 5,
      numeroDocumento: `${isla.documentoPrefijo}${String(indice).padStart(5, '0')}`,
      primerNombre: 'Carga',
      primerApellido: `Prueba${indice}`,
      esDePrueba: true,
      /// Sin departamento ni municipio a propósito: `cubreA`
      /// (src/crm/cobertura.ts:62) deja pasar a quien no dice dónde
      /// vive, y así la prueba mide el aforo y no la cobertura
      /// geográfica, que es otra cosa y tiene su propio spec.
    },
  });

  const participante = await prisma.participante.create({
    data: {
      personaId: persona.id,
      convenioId: isla.convenioId,
      ofertaId: donde.ofertaId ?? null,
      accionFormacionId: donde.accionFormacionId ?? null,
      coberturaId: donde.coberturaId ?? null,
      etapa: donde.etapa ?? EtapaParticipante.INSCRITO,
    },
  });

  return participante.id;
}

/**
 * Las mismas fichas, pero de dos viajes en vez de 2N.
 *
 * Con N=200, crearlas de una en una son 400 idas y vueltas a la base.
 * Por el túnel eso son quince segundos de montaje para una prueba que
 * dura uno, y una prueba lenta es una prueba que nadie corre. Los `id`
 * se generan aquí porque `createMany` no los devuelve.
 */
export async function crearParticipantes(
  prisma: PrismaClient,
  isla: Isla,
  desde: number,
  cuantos: number,
  donde: {
    ofertaId?: string;
    accionFormacionId?: string;
    coberturaId?: string;
    etapa?: EtapaParticipante;
  },
): Promise<string[]> {
  const personas = Array.from({ length: cuantos }, (_, i) => ({
    id: randomUUID(),
    tipoDocumentoSepId: 5,
    numeroDocumento: `${isla.documentoPrefijo}${String(desde + i).padStart(5, '0')}`,
    primerNombre: 'Carga',
    primerApellido: `Prueba${desde + i}`,
    esDePrueba: true,
  }));
  await prisma.persona.createMany({ data: personas });

  const fichas = personas.map((p) => ({
    id: randomUUID(),
    personaId: p.id,
    convenioId: isla.convenioId,
    ofertaId: donde.ofertaId ?? null,
    accionFormacionId: donde.accionFormacionId ?? null,
    coberturaId: donde.coberturaId ?? null,
    etapa: donde.etapa ?? EtapaParticipante.INSCRITO,
  }));
  await prisma.participante.createMany({ data: fichas });

  return fichas.map((f) => f.id);
}

// ---------------------------------------------------------------------------
// La limpieza
// ---------------------------------------------------------------------------

/**
 * Borra la isla entera y DICE qué quedó.
 *
 * El orden no es negociable: `Participante.reserva` y
 * `Participante.persona` son `Restrict` (schema.prisma:938-940), así
 * que las fichas se van antes que las reservas y que las personas. Y
 * `Convenio.leads` también es `Restrict`, por eso el webhook usa un
 * convenio real y limpia lo suyo aparte.
 */
export async function limpiarIsla(prisma: PrismaClient, isla: Isla): Promise<void> {
  await prisma.participante.deleteMany({ where: { convenioId: isla.convenioId } });
  await prisma.persona.deleteMany({
    where: { numeroDocumento: { startsWith: isla.documentoPrefijo } },
  });
  await prisma.registroAuditoria.deleteMany({ where: { adminId: isla.adminId } });
  await prisma.reserva.deleteMany({
    where: { oferta: { accionFormacion: { convenioId: isla.convenioId } } },
  });
  await prisma.empresa.deleteMany({ where: { nit: { startsWith: isla.nitPrefijo } } });
  await prisma.politicaDatos.deleteMany({ where: { convenioId: isla.convenioId } });
  // grupos y coberturas se van en cascada con la acción
  await prisma.accionFormacion.deleteMany({ where: { convenioId: isla.convenioId } });
  await prisma.convenio.deleteMany({ where: { id: isla.convenioId } });
  await prisma.adminConvenio.deleteMany({ where: { adminId: isla.adminId } });
  await prisma.admin.deleteMany({ where: { id: isla.adminId } });
  await prisma.ubicacion.deleteMany({ where: { id: isla.ubicacionId } });

  /// Se cuenta lo que queda y se dice. Una limpieza que no se
  /// comprueba es una limpieza que un día no limpia, y en pruebas eso
  /// se descubre cuando la corrida siguiente falla por datos ajenos.
  const restos =
    (await prisma.convenio.count({ where: { id: isla.convenioId } })) +
    (await prisma.empresa.count({ where: { nit: { startsWith: isla.nitPrefijo } } })) +
    (await prisma.persona.count({
      where: { numeroDocumento: { startsWith: isla.documentoPrefijo } },
    })) +
    (await prisma.admin.count({ where: { id: isla.adminId } }));

  console.log(
    restos === 0
      ? `\nLimpieza: no queda nada de la corrida ${isla.sello}.`
      : `\nLimpieza INCOMPLETA: quedan ${restos} filas de la corrida ${isla.sello}.`,
  );
  if (restos > 0) process.exitCode = 1;
}

/** El envoltorio que garantiza que la limpieza corre pase lo que pase. */
export async function conIsla(
  prisma: PrismaClient,
  cuerpo: (isla: Isla) => Promise<void>,
): Promise<void> {
  await esperarALaApi();
  const isla = await montarIsla(prisma);
  console.log(`Corrida ${isla.sello} · API ${API}`);
  try {
    await cuerpo(isla);
  } finally {
    await limpiarIsla(prisma, isla);
  }
}
