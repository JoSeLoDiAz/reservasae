/** Catorce interesados completos, siete por gremio. */

/**
 * LO PIDIÓ EL CLIENTE: «pon unos siete de cada gremio en
 * interesado, pero nuevos, con empresa, con todo; y elimina los
 * registros que hay».
 *
 * Lo que hace este guión y por qué así:
 *
 * · NACEN EN `INTERESADO` Y SIN GRUPO, y eso es lo importante.
 *   La regla del cliente es que «nada de lo inscrito debe estar
 *   asociado al cronograma»: el grupo es lo ÚLTIMO que se asigna,
 *   cuando ya se llamó a la persona. Así que estas catorce quedan
 *   completas en todo lo demás y con la cohorte vacía a propósito
 *   — que es exactamente el estado en el que la pantalla de
 *   asignar grupo por lote tiene algo que hacer.
 *
 * · VAN AGRUPADAS EN CUATRO OFERTAS, no repartidas en catorce.
 *   Con una persona por curso, cada celda de grupo tendría un
 *   solo candidato y el lote no enseñaría nada. Agrupadas, al
 *   llegar a esa pantalla hay tres o cuatro esperando en la misma
 *   celda, que es el caso que hay que poder ver.
 *
 * · LA EMPRESA VA COMPLETA, incluidos los ocho datos que exige
 *   `faltaEnF7`. La siembra general no los llena, así que hoy
 *   ninguna organización de pruebas entra en ese reporte y no se
 *   puede ver el F7 con filas dentro.
 *
 * · LO ESCRITO SE COMPRUEBA CON LAS REGLAS DE VERDAD. Al final
 *   se pasa cada ficha por `revisar`, que es la MISMA función que
 *   pinta la ficha y decide quién entra al reporte. Un guión de
 *   siembra que se cree a sí mismo produce datos que se
 *   contradicen con el sistema que prueban.
 *
 * · ES REPETIBLE. Reconoce lo suyo por el documento y por el NIT
 *   (`MARCA_*`) y lo borra antes de rehacerlo: correrlo dos veces
 *   no duplica a nadie ni toca lo que no es suyo.
 *
 * OJO: `db:sembrar-prueba --rehacer` SÍ se las lleva por delante.
 * Su `borrarLoSembrado()` hace `deleteMany()` sin filtro sobre
 * personas, empresas y participantes. Después de rehacer la
 * siembra general hay que volver a correr este guión.
 */

import {
  CanalAutorizacion,
  EtapaParticipante,
  OrigenParticipante,
  PrismaClient,
} from '../../generated/prisma';
import { borrarParticipaciones } from '../../src/crm/borrar-participaciones';
import {
  DEPARTAMENTO_POR_ID,
  MUNICIPIO_POR_ID,
} from '../../src/crm/catalogos-sep';
import { cubreA } from '../../src/crm/cobertura';
import { PUEDEN_LLEVAR_FICHAS } from '../../src/crm/quien-lleva-fichas';
import { revisar } from '../../src/crm/completitud';
import { exigirBaseSegura } from '../guardia-de-base';
import { soloEnPruebas } from './solo-pruebas';

const prisma = new PrismaClient();

/// El cliente dentro de la transacción. Todo lo que borra y
/// escribe recibe ESTE, no el global: si algo falla a mitad, los
/// interesados que se borraron tienen que volver.
type Cliente = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/// Por dónde reconoce lo suyo al volver a correr.
const MARCA_DOCUMENTO = '10059';
const MARCA_NIT = '9012';

/// Fecha fija: dos ejecuciones tienen que dar lo mismo.
const HOY = new Date('2026-09-03T15:00:00Z');
const hace = (dias: number) => new Date(HOY.getTime() - dias * 86_400_000);

type Empresa = {
  nit: string;
  dv: string;
  razonSocial: string;
  sector: 'COMERCIO' | 'SERVICIOS' | 'MANUFACTURA';
  tamanoSepId: number;
  trabajadores: number;
  departamentoSepId: number;
  municipioSepId: number;
  direccion: string;
  telefono: string;
  clasificacion: string;
  papel: string;
  red: string;
  contacto: [nombre: string, cargo: string, correo: string];
};

/// Seis organizaciones, cada una con lo que el F7 exige.
const EMPRESAS: Empresa[] = [
  {
    nit: '901200101', dv: '4', razonSocial: 'Textiles del Oriente S.A.S.',
    sector: 'MANUFACTURA', tamanoSepId: 46, trabajadores: 64,
    departamentoSepId: 68, municipioSepId: 68001,
    direccion: 'Calle 36 # 22-14', telefono: '6076341122',
    clasificacion: 'Privada', papel: 'Beneficiaria', red: 'Otro',
    contacto: ['Gloria Helena Ardila', 'Jefe de talento humano', 'ghardila@textilesoriente.test'],
  },
  {
    nit: '901200208', dv: '1', razonSocial: 'Agroinsumos Santandereanos Ltda.',
    sector: 'COMERCIO', tamanoSepId: 45, trabajadores: 11,
    departamentoSepId: 68, municipioSepId: 68001,
    direccion: 'Carrera 15 # 104-58', telefono: '6076551907',
    clasificacion: 'Privada', papel: 'De la cadena productiva', red: 'Ninguno',
    contacto: ['Wilson Fabián Rueda', 'Gerente', 'wrueda@agroinsumos.test'],
  },
  {
    nit: '901200315', dv: '8', razonSocial: 'Confecciones La Aguja de Oro S.A.S.',
    sector: 'MANUFACTURA', tamanoSepId: 43, trabajadores: 9,
    departamentoSepId: 5, municipioSepId: 5001,
    direccion: 'Calle 44 # 70-32', telefono: '6042551814',
    clasificacion: 'Privada', papel: 'Beneficiaria', red: 'Otro',
    contacto: ['Beatriz Elena Zapata', 'Coordinadora administrativa', 'bzapata@agujadeoro.test'],
  },
  {
    nit: '901200422', dv: '5', razonSocial: 'Soluciones Logísticas Andinas S.A.S.',
    sector: 'SERVICIOS', tamanoSepId: 47, trabajadores: 38,
    departamentoSepId: 11, municipioSepId: 11001,
    direccion: 'Avenida Carrera 68 # 24-39', telefono: '6014772130',
    clasificacion: 'Privada', papel: 'Conviniente', red: 'BRITCHAM',
    contacto: ['Diego Armando Beltrán', 'Director de operaciones', 'dbeltran@logisticandina.test'],
  },
  {
    nit: '901200539', dv: '2', razonSocial: 'Consultores Empresariales BC S.A.S.',
    sector: 'SERVICIOS', tamanoSepId: 42, trabajadores: 120,
    departamentoSepId: 11, municipioSepId: 11001,
    direccion: 'Calle 93B # 17-25 oficina 402', telefono: '6017432088',
    clasificacion: 'Privada', papel: 'Beneficiaria', red: 'Ambos',
    contacto: ['Paula Andrea Nieto', 'Gerente de gestión humana', 'pnieto@consultoresbc.test'],
  },
  {
    nit: '901200646', dv: '9', razonSocial: 'Astilleros y Servicios del Caribe S.A.',
    sector: 'SERVICIOS', tamanoSepId: 2, trabajadores: 640,
    departamentoSepId: 13, municipioSepId: 13001,
    direccion: 'El Bosque, Diagonal 21 # 48-120', telefono: '6056530411',
    clasificacion: 'Mixta', papel: 'Beneficiaria', red: 'ADEE',
    contacto: ['Rafael Enrique Movilla', 'Jefe de formación', 'rmovilla@astillerocaribe.test'],
  },
];

type Ficha = {
  gremio: 'adecopria' | 'britcham-adee';
  /// El curso y la sede: juntos son la oferta.
  codigo: string;
  sede: string;
  documento: string;
  tipoDocumentoSepId: number;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  correo: string;
  celular: string;
  generoSepId: number;
  nacimiento: string;
  estrato: number;
  departamentoSepId: number;
  municipioSepId: number;
  barrio: string;
  direccion: string;
  nivelOcupacionalSepId: number;
  beneficiarioPrevio: boolean;
  origen: OrigenParticipante;
  cargo: string;
  empresa: number;
  /// Si ya tiene asesor asignado o sigue en el montón común.
  conAsesor: boolean;
  /// Hace cuántos días entró: da variedad a la lista y al ritmo.
  dias: number;
};

/**
 * Los catorce. Cuatro cursos, cuatro sedes, y dentro variedad de
 * todo lo que el reporte distingue: género —los tres del
 * catálogo—, estrato del 1 al 6, edades de 25 a 63, los tres
 * niveles ocupacionales, cinco orígenes distintos, y cédula,
 * cédula de extranjería y permiso por protección temporal.
 */
const FICHAS: Ficha[] = [
  // ── ADECOPRIA · AF1 · SANTANDER (virtual) ──
  {
    gremio: 'adecopria', codigo: 'AF1', sede: 'SANTANDER',
    documento: '1005991001', tipoDocumentoSepId: 1,
    primerNombre: 'Marta', segundoNombre: 'Lucía', primerApellido: 'Vargas', segundoApellido: 'Osorio',
    correo: 'marta.vargas@ejemplo.test', celular: '3104550101',
    generoSepId: 2, nacimiento: '1989-04-17', estrato: 3,
    departamentoSepId: 68, municipioSepId: 68001,
    barrio: 'Cabecera del Llano', direccion: 'Calle 48 # 31-22 apto 501',
    nivelOcupacionalSepId: 2, beneficiarioPrevio: false,
    origen: OrigenParticipante.EMPRESA, cargo: 'Coordinadora de producción',
    empresa: 0, conAsesor: true, dias: 12,
  },
  {
    gremio: 'adecopria', codigo: 'AF1', sede: 'SANTANDER',
    documento: '1005991002', tipoDocumentoSepId: 1,
    primerNombre: 'Hernán', segundoNombre: null, primerApellido: 'Quiceno', segundoApellido: 'Ariza',
    correo: 'hernan.quiceno@ejemplo.test', celular: '3204550102',
    generoSepId: 1, nacimiento: '1978-11-02', estrato: 4,
    departamentoSepId: 68, municipioSepId: 68001,
    barrio: 'Álvarez', direccion: 'Carrera 27 # 51-08',
    nivelOcupacionalSepId: 1, beneficiarioPrevio: true,
    origen: OrigenParticipante.EMPRESA, cargo: 'Jefe de planta',
    empresa: 0, conAsesor: false, dias: 12,
  },
  {
    gremio: 'adecopria', codigo: 'AF1', sede: 'SANTANDER',
    documento: '1005991003', tipoDocumentoSepId: 1,
    primerNombre: 'Yeimy', segundoNombre: 'Paola', primerApellido: 'Paternina', segundoApellido: null,
    correo: 'yeimy.paternina@ejemplo.test', celular: '3014550103',
    generoSepId: 2, nacimiento: '1996-08-30', estrato: 2,
    departamentoSepId: 68, municipioSepId: 68276,
    barrio: 'Cañaveral', direccion: 'Calle 6 # 9-41',
    nivelOcupacionalSepId: 3, beneficiarioPrevio: false,
    origen: OrigenParticipante.REDES, cargo: 'Auxiliar de bodega',
    empresa: 1, conAsesor: true, dias: 6,
  },
  {
    gremio: 'adecopria', codigo: 'AF1', sede: 'SANTANDER',
    documento: '1005991004', tipoDocumentoSepId: 3,
    primerNombre: 'Alexis', segundoNombre: null, primerApellido: 'Bracho', segundoApellido: 'Medina',
    correo: 'alexis.bracho@ejemplo.test', celular: '3154550104',
    generoSepId: 1, nacimiento: '1993-01-25', estrato: 1,
    departamentoSepId: 68, municipioSepId: 68001,
    barrio: 'La Joya', direccion: 'Transversal 93 # 34-17',
    nivelOcupacionalSepId: 3, beneficiarioPrevio: false,
    origen: OrigenParticipante.AUTOGESTION, cargo: 'Operario',
    empresa: 1, conAsesor: false, dias: 3,
  },
  // ── ADECOPRIA · AF3 · MEDELLÍN (presencial) ──
  {
    gremio: 'adecopria', codigo: 'AF3', sede: 'MEDELLÍN',
    documento: '1005991005', tipoDocumentoSepId: 1,
    primerNombre: 'Sandra', segundoNombre: 'Milena', primerApellido: 'Betancur', segundoApellido: 'Ospina',
    correo: 'sandra.betancur@ejemplo.test', celular: '3124550105',
    generoSepId: 2, nacimiento: '1984-06-11', estrato: 5,
    departamentoSepId: 5, municipioSepId: 5001,
    barrio: 'Laureles', direccion: 'Circular 4 # 71-30',
    nivelOcupacionalSepId: 1, beneficiarioPrevio: false,
    origen: OrigenParticipante.EMPRESA, cargo: 'Gerente comercial',
    empresa: 2, conAsesor: true, dias: 9,
  },
  {
    gremio: 'adecopria', codigo: 'AF3', sede: 'MEDELLÍN',
    documento: '1005991006', tipoDocumentoSepId: 1,
    primerNombre: 'Camilo', segundoNombre: 'Andrés', primerApellido: 'Restrepo', segundoApellido: 'Gil',
    correo: 'camilo.restrepo@ejemplo.test', celular: '3004550106',
    generoSepId: 1, nacimiento: '2001-03-08', estrato: 2,
    departamentoSepId: 5, municipioSepId: 5001,
    barrio: 'Manrique', direccion: 'Calle 77 # 45-19',
    nivelOcupacionalSepId: 3, beneficiarioPrevio: false,
    origen: OrigenParticipante.REFERIDO, cargo: 'Auxiliar de confección',
    empresa: 2, conAsesor: false, dias: 4,
  },
  {
    gremio: 'adecopria', codigo: 'AF3', sede: 'MEDELLÍN',
    documento: '1005991007', tipoDocumentoSepId: 1,
    primerNombre: 'Ana', segundoNombre: 'Sofía', primerApellido: 'Cardona', segundoApellido: 'Ruiz',
    correo: 'ana.cardona@ejemplo.test', celular: '3184550107',
    generoSepId: 3, nacimiento: '1968-12-19', estrato: 6,
    departamentoSepId: 5, municipioSepId: 5001,
    barrio: 'El Poblado', direccion: 'Carrera 43A # 5-33 torre 2',
    nivelOcupacionalSepId: 2, beneficiarioPrevio: true,
    origen: OrigenParticipante.EVENTO, cargo: 'Analista de calidad',
    empresa: 2, conAsesor: true, dias: 20,
  },
  // ── BRITCHAM ADEE · AF1 · BOGOTÁ D.C (virtual) ──
  {
    gremio: 'britcham-adee', codigo: 'AF1', sede: 'BOGOTÁ D.C',
    documento: '1005992001', tipoDocumentoSepId: 1,
    primerNombre: 'Óscar', segundoNombre: 'Iván', primerApellido: 'Cadena', segundoApellido: 'Prieto',
    correo: 'oscar.cadena@ejemplo.test', celular: '3134550201',
    generoSepId: 1, nacimiento: '1991-07-23', estrato: 3,
    departamentoSepId: 11, municipioSepId: 11001,
    barrio: 'Kennedy', direccion: 'Calle 38 sur # 78G-12',
    nivelOcupacionalSepId: 3, beneficiarioPrevio: false,
    origen: OrigenParticipante.EMPRESA, cargo: 'Auxiliar logístico',
    empresa: 3, conAsesor: false, dias: 11,
  },
  {
    gremio: 'britcham-adee', codigo: 'AF1', sede: 'BOGOTÁ D.C',
    documento: '1005992002', tipoDocumentoSepId: 1,
    primerNombre: 'Liliana', segundoNombre: null, primerApellido: 'Peñaranda', segundoApellido: 'Coy',
    correo: 'liliana.penaranda@ejemplo.test', celular: '3114550202',
    generoSepId: 2, nacimiento: '1986-02-14', estrato: 4,
    departamentoSepId: 11, municipioSepId: 11001,
    barrio: 'Cedritos', direccion: 'Carrera 19 # 140-44 apto 302',
    nivelOcupacionalSepId: 2, beneficiarioPrevio: false,
    origen: OrigenParticipante.EMPRESA, cargo: 'Coordinadora de transporte',
    empresa: 3, conAsesor: true, dias: 11,
  },
  {
    gremio: 'britcham-adee', codigo: 'AF1', sede: 'BOGOTÁ D.C',
    documento: '1005992003', tipoDocumentoSepId: 1,
    primerNombre: 'Julián', segundoNombre: 'David', primerApellido: 'Mahecha', segundoApellido: 'Rincón',
    correo: 'julian.mahecha@ejemplo.test', celular: '3024550203',
    generoSepId: 1, nacimiento: '1999-10-05', estrato: 2,
    departamentoSepId: 11, municipioSepId: 11001,
    barrio: 'Suba Rincón', direccion: 'Calle 129B # 91-27',
    nivelOcupacionalSepId: 3, beneficiarioPrevio: true,
    origen: OrigenParticipante.REDES, cargo: 'Practicante',
    empresa: 4, conAsesor: false, dias: 2,
  },
  {
    gremio: 'britcham-adee', codigo: 'AF1', sede: 'BOGOTÁ D.C',
    documento: '1005992004', tipoDocumentoSepId: 61,
    primerNombre: 'Yorbelis', segundoNombre: null, primerApellido: 'Colmenares', segundoApellido: null,
    correo: 'yorbelis.colmenares@ejemplo.test', celular: '3174550204',
    generoSepId: 2, nacimiento: '1994-05-28', estrato: 1,
    departamentoSepId: 11, municipioSepId: 11001,
    barrio: 'Bosa Centro', direccion: 'Diagonal 72 sur # 80-15',
    nivelOcupacionalSepId: 3, beneficiarioPrevio: false,
    origen: OrigenParticipante.AUTOGESTION, cargo: 'Asistente administrativa',
    empresa: 4, conAsesor: true, dias: 5,
  },
  // ── BRITCHAM ADEE · AF4 · CARTAGENA (presencial) ──
  {
    gremio: 'britcham-adee', codigo: 'AF4', sede: 'CARTAGENA',
    documento: '1005992005', tipoDocumentoSepId: 1,
    primerNombre: 'Rafael', segundoNombre: 'Antonio', primerApellido: 'Movilla', segundoApellido: 'Cera',
    correo: 'rafael.movilla@ejemplo.test', celular: '3054550205',
    generoSepId: 1, nacimiento: '1975-09-12', estrato: 4,
    departamentoSepId: 13, municipioSepId: 13001,
    barrio: 'Manga', direccion: 'Calle Real # 20-91',
    nivelOcupacionalSepId: 1, beneficiarioPrevio: true,
    origen: OrigenParticipante.EMPRESA, cargo: 'Superintendente',
    empresa: 5, conAsesor: false, dias: 15,
  },
  {
    gremio: 'britcham-adee', codigo: 'AF4', sede: 'CARTAGENA',
    documento: '1005992006', tipoDocumentoSepId: 1,
    primerNombre: 'Dayana', segundoNombre: 'Isabel', primerApellido: 'Villalba', segundoApellido: 'Torres',
    correo: 'dayana.villalba@ejemplo.test', celular: '3164550206',
    generoSepId: 2, nacimiento: '1997-01-19', estrato: 2,
    departamentoSepId: 13, municipioSepId: 13001,
    barrio: 'El Bosque', direccion: 'Transversal 54 # 21-30',
    nivelOcupacionalSepId: 3, beneficiarioPrevio: false,
    origen: OrigenParticipante.EMPRESA, cargo: 'Auxiliar de mantenimiento',
    empresa: 5, conAsesor: true, dias: 15,
  },
  {
    gremio: 'britcham-adee', codigo: 'AF4', sede: 'CARTAGENA',
    documento: '1005992007', tipoDocumentoSepId: 1,
    primerNombre: 'Nelson', segundoNombre: null, primerApellido: 'Berrío', segundoApellido: 'Pájaro',
    correo: 'nelson.berrio@ejemplo.test', celular: '3144550207',
    generoSepId: 1, nacimiento: '1963-03-04', estrato: 3,
    departamentoSepId: 13, municipioSepId: 13001,
    barrio: 'Olaya Herrera', direccion: 'Sector Rafael Núñez, Calle 31 # 51-12',
    nivelOcupacionalSepId: 2, beneficiarioPrevio: false,
    origen: OrigenParticipante.REFERIDO, cargo: 'Supervisor de seguridad',
    empresa: 5, conAsesor: false, dias: 8,
  },
];

/** Se lleva lo que dejó la vez pasada, y nada más. */
async function borrarLoSuyo(db: Cliente): Promise<number> {
  const mias = await db.persona.findMany({
    where: { numeroDocumento: { startsWith: MARCA_DOCUMENTO } },
    select: { id: true },
  });
  const ids = mias.map((p) => p.id);

  // el orden lo pone `borrarParticipaciones`: las notas NO
  // cuelgan en cascada, y borrarlas mal rompe un CHECK
  const fichas = await borrarParticipaciones(db, { personaId: { in: ids } });
  await db.autorizacionDatos.deleteMany({ where: { personaId: { in: ids } } });
  await db.persona.deleteMany({ where: { id: { in: ids } } });

  // sin reservas detras no arrastran nada
  await db.empresa.deleteMany({
    where: { nit: { startsWith: MARCA_NIT }, reservas: { none: {} }, participantes: { none: {} } },
  });

  return fichas;
}

/**
 * Y los INTERESADO que había, que es la otra mitad del encargo.
 *
 * SOLO esa etapa y SOLO los de prueba. Lo demás de la siembra
 * —los que están en el aula, los certificados, lo que sostiene
 * los tableros que se enseñan— no se toca: un `deleteMany` sin
 * condición aquí sería el guión que se lleva por delante lo que
 * nadie le pidió. La persona se queda si tiene otra participación
 * viva, porque la misma cédula puede estar en el otro convenio.
 */
async function borrarInteresadosViejos(db: Cliente): Promise<number> {
  const count = await borrarParticipaciones(db, {
    etapa: EtapaParticipante.INTERESADO,
    persona: { esDePrueba: true, numeroDocumento: { not: { startsWith: MARCA_DOCUMENTO } } },
  });

  // las personas que se quedaron sin ninguna participacion
  await db.persona.deleteMany({
    where: { esDePrueba: true, participaciones: { none: {} } },
  });

  return count;
}

async function main() {
  exigirBaseSegura('La siembra de interesados');
  soloEnPruebas('db:sembrar-interesados');

  const convenios = await prisma.convenio.findMany({ select: { id: true, slug: true } });
  const idDe = new Map(convenios.map((c) => [c.slug, c.id]));

  const ofertas = await prisma.oferta.findMany({
    select: {
      id: true,
      accionFormacionId: true,
      accionFormacion: { select: { codigo: true, convenioId: true } },
      ubicacion: { select: { nombre: true, tipo: true, departamento: true } },
    },
  });

  await prisma.$transaction(
    async (db) => {
    const mias = await borrarLoSuyo(db);
    const viejos = await borrarInteresadosViejos(db);
    console.log(
      `  · se quitaron ${viejos} interesados de la siembra general` +
        (mias ? ` y ${mias} de una corrida previa de este guión` : ''),
    );

    // ── las organizaciones ──
    const empresaId = new Map<number, string>();
    for (const [i, e] of EMPRESAS.entries()) {
      const fila = await db.empresa.create({
        data: {
          nit: e.nit,
          digitoVerificacion: e.dv,
          razonSocial: e.razonSocial,
          // 6 = Nit en el catalogo del SEP
          tipoDocumentoSepId: 6,
          tamanoSepId: e.tamanoSepId,
          numeroColaboradores: e.trabajadores,
          numeroTrabajadores: e.trabajadores,
          sectorEconomico: e.sector,
          clasificacion: e.clasificacion,
          papelEnConvenio: e.papel,
          redAsociada: e.red,
          redAsociadaOtra: e.red === 'Otro' ? 'Cámara de Comercio local' : null,
          departamentoSepId: e.departamentoSepId,
          municipioSepId: e.municipioSepId,
          direccion: e.direccion,
          telefono: e.telefono,
          contactoNombre: e.contacto[0],
          contactoCargo: e.contacto[1],
          contactoCorreo: e.contacto[2],
        },
        select: { id: true },
      });
      empresaId.set(i, fila.id);
    }
    console.log(`  · ${EMPRESAS.length} organizaciones, completas para el F7`);

      // ── los asesores de cada gremio ──
    //
    // La mitad con dueño y la mitad sin él, a propósito: sin
    // asesor es el estado normal de lo recién llegado y es lo que
    // alimenta el reparto por lote; con asesor es lo que ya se
    // repartió. Con todas iguales no se puede probar ninguna.
    //
    // La lista de roles sale de `PUEDEN_LLEVAR_FICHAS`, la misma
    // que llena el desplegable del panel. Escribirla aquí a mano
    // fue el primer intento y dejó las catorce sin asesor: en
    // BRITCHAM ADEE no hay ningún gestor de inscripciones —solo
    // académico, sistemas y consulta—, así que una lista propia
    // sin `LIDER_SISTEMAS` no encontraba a nadie y no fallaba.
    const asesores = await db.adminConvenio.findMany({
      where: { rol: { in: PUEDEN_LLEVAR_FICHAS }, admin: { activo: true } },
      select: { adminId: true, convenioId: true },
      orderBy: { rol: 'asc' },
    });
    const asesorDe = new Map<string, string>();
    for (const a of asesores) if (!asesorDe.has(a.convenioId)) asesorDe.set(a.convenioId, a.adminId);

    // ── la politica vigente de cada gremio ──
    const politicas = await db.politicaDatos.findMany({
      where: { destinatario: 'PARTICIPANTE' },
      select: { id: true, convenioId: true },
      orderBy: { version: 'desc' },
    });
    const politicaDe = new Map<string, string>();
    for (const p of politicas) if (!politicaDe.has(p.convenioId)) politicaDe.set(p.convenioId, p.id);

    // ── las fichas ──
    let hechas = 0;
    for (const f of FICHAS) {
      const convenioId = idDe.get(f.gremio);
      if (!convenioId) throw new Error(`No existe el convenio ${f.gremio}`);

      const oferta = ofertas.find(
        (o) =>
          o.accionFormacion.convenioId === convenioId &&
          o.accionFormacion.codigo === f.codigo &&
          o.ubicacion.nombre === f.sede,
      );
      if (!oferta) throw new Error(`No hay oferta de ${f.codigo} en ${f.sede} para ${f.gremio}`);

    /// Que la sede de verdad la cubra, con LA REGLA DE VERDAD.
    ///
    /// Escribir el `ofertaId` a mano sin comprobarlo deja fichas
    /// que el propio servidor rechaza en cuanto alguien pulse
    /// «asignar»: la pantalla diría «se dicta en X, que no cubre
    /// Y». Serían datos de prueba que contradicen al sistema que
    /// prueban, y quien lo viera buscaría el defecto en el código.
    ///
    /// Se traduce el domicilio igual que `dondeVive()`: `cubreA`
    /// compara NOMBRES contra `Ubicacion`, no ids del SEP.
    const vive = {
      departamento: DEPARTAMENTO_POR_ID.get(f.departamentoSepId)?.etiqueta ?? null,
      ciudad: MUNICIPIO_POR_ID.get(f.municipioSepId)?.[2] ?? null,
    };
    if (!cubreA({ ...oferta.ubicacion }, vive)) {
      throw new Error(
        `${f.primerNombre} ${f.primerApellido} vive en ${vive.ciudad}, ${vive.departamento} ` +
          `y ${f.codigo} se dicta en ${oferta.ubicacion.nombre} (${oferta.ubicacion.tipo}): no la cubre.`,
      );
    }

      const politicaId = politicaDe.get(convenioId);
      if (!politicaId) throw new Error(`${f.gremio} no tiene politica publicada`);
    /// Sin esto el fallo es MUDO: `?? null` deja la ficha sin
    /// dueño y parece que se pidió así. Ya pasó en la primera
    /// corrida y las catorce salieron sin asesor.
    if (f.conAsesor && !asesorDe.get(convenioId)) {
      throw new Error(`${f.gremio} no tiene a nadie que pueda llevar fichas`);
    }

      const persona = await db.persona.create({
        data: {
          tipoDocumentoSepId: f.tipoDocumentoSepId,
          numeroDocumento: f.documento,
          // cae en rango real de cedulas: marcada, el RUI
          // no la consulta nunca
          esDePrueba: true,
          primerNombre: f.primerNombre,
          segundoNombre: f.segundoNombre,
          primerApellido: f.primerApellido,
          segundoApellido: f.segundoApellido,
          correo: f.correo,
          celular: f.celular,
          fechaNacimiento: new Date(`${f.nacimiento}T00:00:00Z`),
          generoSepId: f.generoSepId,
          estrato: f.estrato,
          departamentoSepId: f.departamentoSepId,
          municipioSepId: f.municipioSepId,
          barrio: f.barrio,
          direccion: f.direccion,
        },
        select: { id: true },
      });

      const ficha = await db.participante.create({
        data: {
          convenioId,
          personaId: persona.id,
          empresaId: empresaId.get(f.empresa) ?? null,
          ofertaId: oferta.id,
          accionFormacionId: oferta.accionFormacionId,
          // el grupo es lo ULTIMO: ver el docblock de arriba
          coberturaId: null,
          etapa: EtapaParticipante.INTERESADO,
          origen: f.origen,
          cargoEnEmpresa: f.cargo,
          nivelOcupacionalSepId: f.nivelOcupacionalSepId,
          beneficiarioPrevio: f.beneficiarioPrevio,
          asesorId: f.conAsesor ? (asesorDe.get(convenioId) as string) : null,
          creadoEn: hace(f.dias),
        },
        select: { id: true },
      });

      // la constancia, contra la version vigente del texto
      await db.autorizacionDatos.create({
        data: {
          personaId: persona.id,
          politicaDatosId: politicaId,
          canal: CanalAutorizacion.FORMULARIO_WEB,
          otorgadaEn: hace(f.dias),
          evidencia: 'Casilla marcada en el formulario de preinscripción (dato de prueba)',
        },
      });

      await db.movimientoParticipante.create({
        data: {
          participanteId: ficha.id,
          etapaDespues: EtapaParticipante.INTERESADO,
          nota: 'Preinscripción registrada',
          creadoEn: hace(f.dias),
        },
      });

      hechas += 1;
    }

    console.log(`  · ${hechas} fichas en INTERESADO, con oferta y sin grupo`);
    },
    // sesenta escrituras contra la base de al lado; el minuto
    // es margen, no expectativa
    { timeout: 60_000 },
  );

  await comprobar();
}

/**
 * Que quedaron como se dijo, medido con las reglas de verdad.
 *
 * `revisar` es la MISMA función que pinta la ficha y la que
 * decide quién entra al reporte al SENA. Si estas catorce no la
 * pasan, los datos de prueba se contradicen con el sistema que
 * prueban — y quien mire la pantalla creerá que el defecto está
 * en el código.
 */
async function comprobar() {
  const fichas = await prisma.participante.findMany({
    where: { persona: { numeroDocumento: { startsWith: MARCA_DOCUMENTO } } },
    select: {
      ofertaId: true,
      coberturaId: true,
      accionFormacionId: true,
      nivelOcupacionalSepId: true,
      beneficiarioPrevio: true,
      empresaId: true,
      asesorId: true,
      persona: {
        select: {
          numeroDocumento: true,
          correo: true,
          celular: true,
          fechaNacimiento: true,
          generoSepId: true,
          estrato: true,
          departamentoSepId: true,
          municipioSepId: true,
          barrio: true,
          direccion: true,
          autorizaciones: { where: { revocadaEn: null }, select: { id: true } },
        },
      },
    },
  });

  const problemas: string[] = [];
  for (const f of fichas) {
    const doc = f.persona.numeroDocumento;
    const r = revisar({
      ofertaId: f.ofertaId,
      coberturaId: f.coberturaId,
      accionFormacionId: f.accionFormacionId,
      nivelOcupacionalSepId: f.nivelOcupacionalSepId,
      beneficiarioPrevio: f.beneficiarioPrevio,
      tieneAutorizacion: f.persona.autorizaciones.length > 0,
      grupoConFechas: false,
      grupoSepId: null,
      accionSepId: null,
      persona: f.persona,
    });

    if (r.matricula.length > 0) {
      problemas.push(`${doc}: no podría matricularse — ${r.matricula.join('; ')}`);
    }
    /// Lo ÚNICO que puede faltarle es el grupo, y falta a propósito.
    const salvoGrupo = r.reporte.filter((m) => !m.includes('grupo'));
    if (salvoGrupo.length > 0) {
      problemas.push(`${doc}: fuera del reporte — ${salvoGrupo.join('; ')}`);
    }
    if (!f.empresaId) problemas.push(`${doc}: se quedó sin organización`);
    if (f.coberturaId) problemas.push(`${doc}: nació con grupo, y el grupo es lo último`);
  }

  /// El reparto de asesor se comprueba APARTE, y por algo.
  ///
  /// `revisar` no lo mira —no es un dato de la persona ni del
  /// reporte—, así que la primera corrida salió «✓ las 14
  /// completas» con las catorce sin dueño: el guión se creyó a sí
  /// mismo porque nadie le preguntó por esto. Lo que sujeta el
  /// reparto es contar, no confiar.
  const conDueno = fichas.filter((f) => f.asesorId).length;
  const esperados = FICHAS.filter((f) => f.conAsesor).length;
  if (conDueno !== esperados) {
    problemas.push(`se esperaban ${esperados} fichas con asesor y hay ${conDueno}`);
  }

  if (fichas.length !== FICHAS.length) {
    problemas.push(`se esperaban ${FICHAS.length} fichas y hay ${fichas.length}`);
  }

  if (problemas.length > 0) {
    console.error('\n✗ La siembra quedó incompleta:');
    for (const p of problemas) console.error(`  · ${p}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n✓ Las ${fichas.length} pasan la compuerta de matrícula y entrarán al ` +
      'reporte en cuanto se les asigne grupo, que es lo único que les falta.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
