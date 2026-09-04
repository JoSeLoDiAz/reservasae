/** Carga de volumen para ADECOPRIA, en pruebas. */

/**
 * Para ver si el panel aguanta. No pretende ser realista: son 24
 * veces la oferta del proyecto, asi que los tableros van a decir
 * porcentajes imposibles. Lo que se prueba son las listas, los
 * filtros, la paginacion, los agregados y los reportes.
 *
 * Se borra por el rango de documento. Ver `MARCA`.
 */

import {
  EtapaParticipante,
  OrigenParticipante,
  PrismaClient,
} from '../../generated/prisma';
import { exigirBaseSegura } from '../guardia-de-base';
import { soloEnPruebas } from './solo-pruebas';

const prisma = new PrismaClient();

/// Documentos 20.000.001 en adelante: fuera de todo lo demas.
const DESDE = 20_000_001;
const CUANTOS = Number(process.env.CUANTOS ?? 50_000);
const LOTE = 5_000;

const HOY = new Date('2026-09-04T12:00:00Z');
const hace = (d: number) => new Date(HOY.getTime() - d * 86_400_000);

// generador con semilla: dos corridas dan lo mismo
let semilla = 20260904;
function azar(): number {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return semilla / 0x7fffffff;
}
const entre = (a: number, b: number) => a + Math.floor(azar() * (b - a + 1));
const unoDe = <T>(xs: T[]): T => xs[Math.floor(azar() * xs.length)];

const NOMBRES_F = ['María', 'Luz', 'Ana', 'Sandra', 'Claudia', 'Diana', 'Paula', 'Yeimy', 'Marta', 'Liliana'];
const NOMBRES_M = ['Carlos', 'Andrés', 'Julián', 'Óscar', 'Hernán', 'Camilo', 'Jorge', 'Wilson', 'Rafael', 'Nelson'];
const APELLIDOS = ['Vargas', 'Quiceno', 'Paternina', 'Betancur', 'Restrepo', 'Cardona', 'Cadena', 'Peñaranda', 'Mahecha', 'Movilla', 'Villalba', 'Berrío', 'Serrano', 'Ocampo', 'Támara', 'Lozano', 'Zapata', 'Rueda', 'Ardila', 'Nieto'];
const BARRIOS = ['Cabecera', 'Laureles', 'El Poblado', 'Kennedy', 'Manrique', 'Cedritos', 'La Joya', 'El Bosque', 'Suba', 'Bosa'];
const CARGOS = ['Docente', 'Coordinador', 'Rector', 'Auxiliar', 'Analista', 'Jefe de área', 'Secretaria', 'Psicoorientador'];

/// Como se reparten por etapa. Suma 100.
const ETAPAS: Array<[EtapaParticipante, number]> = [
  [EtapaParticipante.INTERESADO, 30],
  [EtapaParticipante.CONTACTADO, 18],
  [EtapaParticipante.DATOS_COMPLETOS, 14],
  [EtapaParticipante.INSCRITO, 16],
  [EtapaParticipante.EN_FORMACION, 12],
  [EtapaParticipante.CERTIFICADO, 5],
  [EtapaParticipante.PERDIDO, 3],
  [EtapaParticipante.RETIRADO, 2],
];

function etapaAlAzar(): EtapaParticipante {
  let n = entre(1, 100);
  for (const [etapa, peso] of ETAPAS) {
    n -= peso;
    if (n <= 0) return etapa;
  }
  return EtapaParticipante.INTERESADO;
}

const CON_AUTORIZACION: EtapaParticipante[] = [
  EtapaParticipante.DATOS_COMPLETOS,
  EtapaParticipante.INSCRITO,
  EtapaParticipante.EN_FORMACION,
  EtapaParticipante.CERTIFICADO,
];

async function main() {
  exigirBaseSegura('La carga de volumen');
  soloEnPruebas('db:sembrar-volumen');

  const convenio = await prisma.convenio.findUnique({
    where: { slug: 'adecopria' },
    select: { id: true },
  });
  if (!convenio) throw new Error('No existe el convenio adecopria');

  const ofertas = await prisma.oferta.findMany({
    where: { accionFormacion: { convenioId: convenio.id } },
    select: {
      id: true,
      accionFormacionId: true,
      ubicacion: { select: { nombre: true, departamento: true } },
    },
  });
  if (ofertas.length === 0) throw new Error('adecopria no tiene ofertas');

  const politica = await prisma.politicaDatos.findFirst({
    where: { convenioId: convenio.id, destinatario: 'PARTICIPANTE' },
    orderBy: { version: 'desc' },
    select: { id: true },
  });

  const asesores = await prisma.adminConvenio.findMany({
    where: { convenioId: convenio.id },
    select: { adminId: true },
  });
  const idsAsesor = asesores.map((a) => a.adminId);

  console.log(`  · ${ofertas.length} ofertas, ${idsAsesor.length} asesores`);

  // ── organizaciones ──
  const cuantasEmpresas = Math.max(1, Math.round(CUANTOS / 34));
  const empresas: Array<{ id: string }> = [];
  for (let i = 0; i < cuantasEmpresas; i += LOTE) {
    const bloque = Array.from(
      { length: Math.min(LOTE, cuantasEmpresas - i) },
      (_, j) => {
        const n = i + j;
        return {
          nit: String(920_000_000 + n),
          digitoVerificacion: String(n % 10),
          razonSocial: `Colegio de Volumen ${n + 1} S.A.S.`,
          tipoDocumentoSepId: 6,
          tamanoSepId: unoDe([43, 44, 45, 46, 47, 48]),
          numeroColaboradores: entre(5, 400),
          numeroTrabajadores: entre(5, 400),
          sectorEconomico: unoDe(['COMERCIO', 'SERVICIOS', 'MANUFACTURA']),
          clasificacion: unoDe(['Privada', 'Pública', 'Mixta']),
          direccion: `Calle ${entre(1, 180)} # ${entre(1, 90)}-${entre(1, 99)}`,
          telefono: `60${entre(1, 8)}${entre(1000000, 9999999)}`,
          contactoNombre: `${unoDe(NOMBRES_F)} ${unoDe(APELLIDOS)}`,
          contactoCargo: unoDe(CARGOS),
          contactoCorreo: `contacto${n}@volumen.test`,
        };
      },
    );
    await prisma.empresa.createMany({ data: bloque, skipDuplicates: true });
  }
  const creadasEmpresas = await prisma.empresa.findMany({
    where: { nit: { startsWith: '92' } },
    select: { id: true },
  });
  empresas.push(...creadasEmpresas);
  console.log(`  · ${empresas.length} organizaciones`);

  // ── personas y fichas ──
  let personas = 0;
  let fichas = 0;
  let notas = 0;

  for (let i = 0; i < CUANTOS; i += LOTE) {
    const cuantas = Math.min(LOTE, CUANTOS - i);

    const bloquePersonas = Array.from({ length: cuantas }, (_, j) => {
      const n = i + j;
      const mujer = azar() < 0.62;
      const nombre = mujer ? unoDe(NOMBRES_F) : unoDe(NOMBRES_M);
      const apellido = unoDe(APELLIDOS);
      return {
        tipoDocumentoSepId: 1,
        numeroDocumento: String(DESDE + n),
        // marcadas: el RUI no las consulta nunca
        esDePrueba: true,
        primerNombre: nombre,
        primerApellido: apellido,
        segundoApellido: azar() < 0.6 ? unoDe(APELLIDOS) : null,
        correo: `v${n}.${apellido.toLowerCase()}@volumen.test`,
        celular: `3${entre(0, 2)}${entre(0, 9)}${entre(1000000, 9999999)}`,
        fechaNacimiento: hace(entre(6_600, 20_000)),
        generoSepId: mujer ? 2 : 1,
        estrato: entre(1, 6),
        departamentoSepId: 68,
        municipioSepId: 68001,
        barrio: unoDe(BARRIOS),
        direccion: `Carrera ${entre(1, 120)} # ${entre(1, 90)}-${entre(1, 99)}`,
      };
    });
    await prisma.persona.createMany({ data: bloquePersonas, skipDuplicates: true });
    personas += cuantas;

    const nuevas = await prisma.persona.findMany({
      where: {
        numeroDocumento: {
          in: bloquePersonas.map((p) => p.numeroDocumento),
        },
      },
      select: { id: true },
    });

    const bloqueFichas = nuevas.map((p) => {
      const oferta = unoDe(ofertas);
      const etapa = etapaAlAzar();
      const dias = entre(1, 120);
      return {
        convenioId: convenio.id,
        personaId: p.id,
        empresaId: azar() < 0.8 ? unoDe(empresas).id : null,
        ofertaId: oferta.id,
        accionFormacionId: oferta.accionFormacionId,
        coberturaId: null,
        etapa,
        origen: unoDe([
          OrigenParticipante.EMPRESA,
          OrigenParticipante.REDES,
          OrigenParticipante.FACEBOOK,
          OrigenParticipante.INSTAGRAM,
          OrigenParticipante.AUTOGESTION,
          OrigenParticipante.REFERIDO,
        ]),
        asesorId: idsAsesor.length && azar() < 0.7 ? unoDe(idsAsesor) : null,
        cargoEnEmpresa: unoDe(CARGOS),
        nivelOcupacionalSepId: entre(1, 3),
        beneficiarioPrevio: azar() < 0.2,
        motivoSalida:
          etapa === EtapaParticipante.PERDIDO ||
          etapa === EtapaParticipante.RETIRADO
            ? unoDe(['No contesta', 'Cambió de trabajo', 'Sin interés'])
            : null,
        fechaRetiro:
          etapa === EtapaParticipante.RETIRADO ? hace(entre(1, 30)) : null,
        creadoEn: hace(dias),
      };
    });
    await prisma.participante.createMany({
      data: bloqueFichas,
      skipDuplicates: true,
    });

    const creadas = await prisma.participante.findMany({
      where: { personaId: { in: nuevas.map((p) => p.id) } },
      select: { id: true, personaId: true, etapa: true, creadoEn: true },
    });
    fichas += creadas.length;

    // el movimiento de alta, para que tengan historia
    await prisma.movimientoParticipante.createMany({
      data: creadas.map((f) => ({
        participanteId: f.id,
        etapaAntes: null,
        etapaDespues: EtapaParticipante.INTERESADO,
        nota: 'Carga de volumen',
        creadoEn: f.creadoEn,
      })),
    });

    // la constancia, para quien ya paso de datos completos
    if (politica) {
      const conAuth = creadas.filter((f) => CON_AUTORIZACION.includes(f.etapa));
      await prisma.autorizacionDatos.createMany({
        data: conAuth.map((f) => ({
          personaId: f.personaId,
          politicaDatosId: politica.id,
          canal: 'FORMULARIO_WEB' as const,
          otorgadaEn: f.creadoEn,
          evidencia: 'Carga de volumen',
        })),
      });
    }

    // notas de gestion: una o dos por ficha
    const bloqueNotas = creadas.flatMap((f) =>
      Array.from({ length: entre(0, 2) }, () => ({
        participanteId: f.id,
        autorNombre: 'Carga de volumen',
        texto: unoDe([
          'Se la llama y no contesta.',
          'Contesta, pide que la llamen la próxima semana.',
          'Confirma interés y queda de mandar los datos.',
          'El número está equivocado.',
        ]),
        canales: [unoDe(['LLAMADA', 'WHATSAPP', 'CORREO'])] as never,
        resultado: unoDe(['CONTACTO', 'SIN_RESPUESTA', 'DATO_MALO']) as never,
        creadoEn: f.creadoEn,
      })),
    );
    if (bloqueNotas.length) {
      await prisma.notaDeGestion.createMany({ data: bloqueNotas });
      notas += bloqueNotas.length;
    }

    console.log(
      `  · ${Math.min(i + LOTE, CUANTOS).toLocaleString('es-CO')} de ${CUANTOS.toLocaleString('es-CO')}`,
    );
  }

  console.log(
    `\n✓ ${personas.toLocaleString('es-CO')} personas, ` +
      `${fichas.toLocaleString('es-CO')} fichas, ` +
      `${notas.toLocaleString('es-CO')} notas de gestión.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
