/* Banco de pruebas de INTEGRACIÓN en tiempo de ejecución.
 * Corre el web.service.ts REAL con un Prisma falso en memoria y un
 * proveedor que simula la volatilidad de Google. No es tu base de datos,
 * pero ejecuta el flujo completo: encolar -> dedup por NIT -> tomar ->
 * consenso de N corridas -> guardar propuesta. Y el disparador NIT/RUT.
 */
import 'reflect-metadata';
import { WebService } from './web.service';
import { DisparadorInscripcion, esPersonaNatural } from './disparador';
import type { FichaWeb } from './leer-ficha-web';

process.env.WEB_CONSENSO = '3';

let P = 0, F = 0;
const ok = (n: string, c: boolean) => { if (c) { P++; console.log('  ✓', n); } else { F++; console.log('  ✗ FALLO:', n); } };

// ---- Prisma falso en memoria -------------------------------
type Row = Record<string, any>;
const store = {
  instituciones: new Map<string, Row>(),
  empresas: new Map<string, Row>(),
  participantes: new Map<string, Row>(),
  consultas: [] as Row[],
  propuestas: [] as Row[],
  seq: 0,
};
function match(c: Row, where: Row): boolean {
  if (where.institucionId && c.institucionId !== where.institucionId) return false;
  if (where.nit && c.nit !== where.nit) return false;
  if (where.estado) {
    if (typeof where.estado === 'object' && where.estado.in) {
      if (!where.estado.in.includes(c.estado)) return false;
    } else if (c.estado !== where.estado) return false;
  }
  if (where.fuente && c.fuente !== where.fuente) return false;
  if (where.resueltaEn?.gte && (!c.resueltaEn || c.resueltaEn < where.resueltaEn.gte)) return false;
  return true;
}
const prisma: any = {
  institucion: {
    findUnique: async ({ where }: any) => store.instituciones.get(where.id) ?? null,
    upsert: async ({ where, create }: any) => {
      const { nit, razonSocial } = where.nit_razonSocial;
      for (const i of store.instituciones.values()) {
        if (i.nit === nit && i.razonSocial === razonSocial) return i;
      }
      const row = { id: 'i' + ++store.seq, ...create };
      store.instituciones.set(row.id, row);
      return row;
    },
  },
  empresa: {
    update: async ({ where, data }: any) => {
      const e = store.empresas.get(where.id);
      if (e) Object.assign(e, data);
      return e;
    },
  },
  participante: {
    findUnique: async ({ where }: any) => {
      const p = store.participantes.get(where.id);
      if (!p) return null;
      return { ...p, empresa: p.empresaId ? (store.empresas.get(p.empresaId) ?? null) : null };
    },
    count: async ({ where }: any) =>
      [...store.participantes.values()].filter((p) => p.empresaId === where.empresaId).length,
  },
  consultaRues: {
    findFirst: async ({ where }: any) => store.consultas.find((c) => match(c, where)) ?? null,
    create: async ({ data }: any) => {
      const row = { id: 'c' + ++store.seq, estado: 'PENDIENTE', prioridad: 0, intentos: 0, creadoEn: new Date(Date.now() + store.seq), ...data };
      store.consultas.push(row); return row;
    },
    update: async ({ where, data }: any) => {
      const c = store.consultas.find((x) => x.id === where.id); if (c) Object.assign(c, data); return c;
    },
    findUnique: async ({ where }: any) => store.consultas.find((x) => x.id === where.id) ?? null,
  },
  propuestaInstitucion: {
    deleteMany: async ({ where }: any) => {
      store.propuestas = store.propuestas.filter((p) => !(p.institucionId === where.institucionId && p.fuente === where.fuente && p.estado === where.estado));
      return {};
    },
    create: async ({ data }: any) => { store.propuestas.push({ estado: 'PENDIENTE', ...data }); return {}; },
  },
  $queryRaw: async () => {
    const pend = store.consultas
      .filter((c) => c.estado === 'PENDIENTE')
      .sort((a, b) => b.prioridad - a.prioridad || a.creadoEn - b.creadoEn);
    const c = pend[0];
    if (!c) return [];
    c.estado = 'EN_CURSO'; c.tomadaEn = new Date(); c.intentos = (c.intentos || 0) + 1;
    return [{ id: c.id, institucionId: c.institucionId, nit: c.nit }];
  },
  $transaction: async (fn: any) => fn(prisma),
};

// ---- Proveedor que simula la volatilidad de Google ---------
const vacia = (): FichaWeb => ({
  razonSocial: null, nombreComercial: null, fechaFundacion: null, direccion: null,
  telefono: null, correo: null, paginaWeb: null, ciudadNombre: null,
  departamentoNombre: null, sectorEconomico: null, codigoCiiu: null,
  clasificacion: null, tamano: null, numeroEmpleados: null,
});
const F1: FichaWeb = { ...vacia(), razonSocial: 'VISE LTDA', ciudadNombre: 'Bogotá D.C', departamentoNombre: 'Bogotá', codigoCiiu: '8010', tamano: 'Grande', numeroEmpleados: '6.265', correo: '', paginaWeb: 'https://www.vise.com.co/' };
const F2: FichaWeb = { ...F1, departamentoNombre: 'Bogotá D.C', correo: 'egomez@vise.com.co', paginaWeb: 'vise.com.co', numeroEmpleados: '6.265 (a año 2026)' };
const F3: FichaWeb = { ...F1, departamentoNombre: 'Bogotá / Cundinamarca', correo: 'gquiroga@vise.com.co' };
const CORRIDAS = [F1, F2, F3];
let n = 0;
const proveedor: any = { consultar: async () => ({ estado: 'ENCONTRADO', ficha: CORRIDAS[n++ % 3], crudo: 'crudo' }) };

// ---- Altas de apoyo para el disparador ---------------------
/// Siembra una Empresa y un participante suyo. Los 3 datos de contacto
/// van en la Empresa, que es donde los pide el F7.
function sembrar(
  id: string,
  empresa: Row,
  contacto: { nombre?: string; cargo?: string; correo?: string } = {},
): string {
  store.empresas.set(id, {
    id,
    digitoVerificacion: null,
    institucionId: null,
    tipoDocumentoSepId: null,
    direccion: null,
    telefono: null,
    sectorEconomico: null,
    departamentoSepId: null,
    municipioSepId: null,
    contactoNombre: contacto.nombre ?? null,
    contactoCargo: contacto.cargo ?? null,
    contactoCorreo: contacto.correo ?? null,
    ...empresa,
  });
  const pid = 'p-' + id;
  store.participantes.set(pid, { id: pid, empresaId: id });
  return pid;
}

/// Lo que devuelve el disparador, o el nombre del error si lo rechazó.
async function inscribir(d: DisparadorInscripcion, participanteId: string): Promise<string> {
  try {
    return await d.alInscribir(participanteId);
  } catch (e: any) {
    return e?.constructor?.name === 'BadRequestException' ? 'RECHAZADO' : `ERROR:${e?.message}`;
  }
}

// ---- Las pruebas -------------------------------------------
async function main() {
  const web = new WebService(prisma, proveedor);

  // Dos fichas de la MISMA empresa (mismo NIT) -> el banco es único.
  store.instituciones.set('i1', { id: 'i1', nit: '860507033', razonSocial: 'A' });
  store.instituciones.set('i2', { id: 'i2', nit: '860507033', razonSocial: 'B' });

  console.log('[1] Dedup por NIT en encolar()');
  await web.encolar('i1', 0);
  await web.encolar('i2', 100); // mismo NIT -> NO crea otra, sube prioridad
  ok('solo hay 1 consulta para el NIT (banco único)', store.consultas.length === 1);
  ok('la prioridad subió a 100', store.consultas[0].prioridad === 100);

  console.log('\n[2] procesarUna(): consenso de 3 corridas + propuesta');
  const hubo = await web.procesarUna();
  ok('procesó una tarea', hubo === true);
  ok('consultó 3 veces (consenso)', n === 3);
  ok('creó exactamente 1 propuesta', store.propuestas.length === 1);
  const campos = store.propuestas[0].campos;
  ok('razón social consolidada', campos.razonSocial === 'VISE LTDA');
  ok('empleados normalizado a 6265 (descartó el año)', campos.numeroEmpleados === 6265);
  ok('departamento DERIVADO de la ciudad = Bogotá D.C.', campos.departamentoNombre === 'Bogotá D.C.');
  ok('tamaño a enum', campos.tamano === 'GRANDE');
  const consulta = store.consultas[0];
  ok('consulta quedó LISTA', consulta.estado === 'LISTA');
  ok('guardó el consenso con niveles de confianza', !!consulta.respuesta?.consenso);
  ok('el correo (3 valores distintos) quedó REVISAR', consulta.respuesta.consenso.correo.nivel === 'REVISAR');

  console.log('\n[3] Banco único: encolar el mismo NIT ya resuelto NO re-consulta');
  store.instituciones.set('i3', { id: 'i3', nit: '860507033', razonSocial: 'C' });
  await web.encolar('i3', 50);
  const pendientes = store.consultas.filter((c) => c.estado === 'PENDIENTE').length;
  ok('no encoló otra (ya está en el banco, LISTA reciente)', pendientes === 0);

  console.log('\n[4] Disparador REAL: los 3 datos + bifurcación NIT/persona natural');
  const disparador = new DisparadorInscripcion(prisma, web);

  // -- los 3 datos de contacto, que viven en la Empresa --
  const sinDatos = sembrar('e0', { nit: '900111111', razonSocial: 'Sin Datos' }, { nombre: 'Ana', correo: 'a@x.com' });
  ok('sin los 3 datos -> RECHAZADO', (await inscribir(disparador, sinDatos)) === 'RECHAZADO');

  store.participantes.set('p-huerfano', { id: 'p-huerfano', empresaId: null });
  ok('participante sin empresa -> RECHAZADO', (await inscribir(disparador, 'p-huerfano')) === 'RECHAZADO');
  ok('participante inexistente -> no encola nada', (await inscribir(disparador, 'no-existe')).startsWith('ERROR:'));

  // -- empresa (NIT): a la cola --
  const TRES = { nombre: 'Ana', cargo: 'Gte', correo: 'a@x.com' };
  store.instituciones.set('i4', { id: 'i4', nit: '900456789', razonSocial: 'Otra' });
  const conNit = sembrar('e1', { nit: '900456789', razonSocial: 'Otra', tipoDocumentoSepId: 6, institucionId: 'i4' }, TRES);
  ok('empresa (NIT) con 3 datos -> ENCOLADO', (await inscribir(disparador, conNit)) === 'ENCOLADO');

  // -- la ficha maestra se crea y se amarra cuando falta --
  const huerfana = sembrar('e9', { nit: '901222333', razonSocial: '  Nueva   SAS  ', tipoDocumentoSepId: 6 }, TRES);
  ok('NIT sin ficha maestra -> ENCOLADO', (await inscribir(disparador, huerfana)) === 'ENCOLADO');
  const creada = [...store.instituciones.values()].find((i) => i.nit === '901222333');
  ok('creó la ficha maestra que faltaba', !!creada);
  ok('le limpió los espacios a la razón social', creada?.razonSocial === 'Nueva SAS');
  ok('dejó la Empresa amarrada a la ficha', store.empresas.get('e9')?.institucionId === creada?.id);

  // -- persona natural: cédula, sin búsqueda web --
  const antes = store.propuestas.length;
  const natural = sembrar('e2', {
    nit: '79812345', razonSocial: 'Juan Pérez', tipoDocumentoSepId: 1,
    sectorEconomico: 'Comercio', municipioSepId: 76001, departamentoSepId: 76,
  }, { nombre: 'Juan', cargo: 'Titular', correo: 'j@x.com' });
  store.participantes.set('p-e2-bis', { id: 'p-e2-bis', empresaId: 'e2' }); // 2 registros
  ok('persona natural (cédula) -> RUT_PROPUESTO', (await inscribir(disparador, natural)) === 'RUT_PROPUESTO');
  ok('no la mandó a la web', store.consultas.every((c) => c.nit !== '79812345'));
  ok('generó una propuesta', store.propuestas.length === antes + 1);

  const rut = store.propuestas[store.propuestas.length - 1].campos;
  ok('RUT: razón social = el nombre', rut.razonSocial === 'JUAN PÉREZ');
  ok('RUT: tamaño MICROEMPRESA', rut.tamano === 'MICROEMPRESA');
  ok('RUT: clasificación EMPRESA_PRIVADA', rut.clasificacion === 'EMPRESA_PRIVADA');
  ok('RUT: CIIU calculado del sector (4719)', rut.codigoCiiu === '4719');
  ok('RUT: empleados = # registros (2)', rut.numeroEmpleados === 2);
  ok('RUT: ciudad del catálogo SEP', rut.ciudadNombre === 'Cali');
  ok('RUT: departamento del SEP (Valle del Cauca)', rut.departamentoNombre === 'Valle del Cauca');

  // -- la bandera del catálogo manda, no el nombre del tipo --
  ok('«RUT» del SEP (21) está marcado como documento de empresa', esPersonaNatural(21) === false);
  ok('cédula (1) es persona natural', esPersonaNatural(1) === true);
  ok('sin tipo, cae al número: 900456789 parece empresa', esPersonaNatural(null, '900456789') === false);
  ok('sin tipo, cae al número: 79812345 parece persona', esPersonaNatural(null, '79812345') === true);

  console.log(`\n${'='.repeat(52)}\n INTEGRACIÓN (runtime, con fakes): ${P} passed, ${F} failed\n${'='.repeat(52)}`);
  if (F > 0) process.exit(1);
}
main().catch((e) => { console.error('Falló el harness:', e); process.exit(1); });
