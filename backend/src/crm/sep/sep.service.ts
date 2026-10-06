/** Los dos reportes al SEP, y quién no entra en ellos. */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { EtapaParticipante } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { construirLibro, type Hoja } from '../../tableros/exportar';
import { DEPARTAMENTO_POR_ID, MUNICIPIO_POR_ID } from '../catalogos-sep';
import { revisar } from '../completitud';
import { GENERO_EN_EL_REPORTE, type FilaSep } from './datos';
import * as cargue from './formato-cargue-sep';
import {
  COLUMNAS as COLUMNAS_F7,
  faltaEnF7,
  fila as filaF7,
  type FilaF7,
} from './formato-f7';
import * as usoDirecto from './formato-uso-directo';
import { ETAPAS_DEL_REPORTE } from '../etapas';

export type Formato = 'uso-directo' | 'cargue-sep' | 'f7';

/// Solo quien ya tiene silla. Se dice cuáles entran, no
/// cuáles se excluyen: por descarte entraría INTERESADO, que es
/// un nombre que alguien tecleó y saldría como ACTIVO.

type Excluido = {
  /// El id de la PARTICIPACIÓN, no el de la persona.
  ///
  /// Una misma persona inscrita en dos acciones de formación
  /// son dos filas legítimas, cada una con lo suyo por
  /// arreglar. Sin este id, la pantalla las trataba como la
  /// misma y React se quejaba de llaves repetidas.
  id: string;
  nombre: string;
  documento: string;
  etapa: string;
  /// De cuál de sus formaciones habla esta fila. Sin esto, dos
  /// filas idénticas en pantalla y nadie sabe por qué.
  accion: string | null;
  motivo: string;
};

/**
 * Un libro cuya hoja principal esta vacia no se entrega.
 *
 * El precio de entregarlo es un archivo indistinguible del
 * reporte de verdad; el de negarse, un mensaje. Y dice cuantas
 * hay pendientes, porque "no hay nada listo" y "hay 40 y les
 * falta un dato" se arreglan de formas distintas.
 */
function exigirQueHayaFilas(listos: number, fuera: number, que: string) {
  if (listos > 0) return;
  const cola =
    fuera > 0
      ? `Hay ${fuera} que no ${fuera === 1 ? 'entra' : 'entran'} todavia: mire ` +
        'el alistamiento para saber que les falta.'
      : 'Todavia no hay a quien reportar.';
  throw new BadRequestException(
    `Ninguna ${que} esta lista, asi que el archivo saldria vacio. ${cola}`,
  );
}

@Injectable()
export class SepService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cuántos entran, cuántos no y por qué. */
  async alistamiento(convenioId: string, ambito: string[]) {
    const { listos, excluidos, convenio } = await this.preparar(
      convenioId,
      ambito,
    );

    // agrupado por motivo: la lista accionable no es de
    // personas, es de "187 sin fecha de nacimiento"
    const porMotivo = new Map<string, number>();
    for (const e of excluidos) {
      porMotivo.set(e.motivo, (porMotivo.get(e.motivo) ?? 0) + 1);
    }

    return {
      convenio: { nombre: convenio.nombre, sigla: convenio.sigla },
      listos: listos.length,
      noListos: excluidos.length,
      motivos: [...porMotivo.entries()]
        .map(([motivo, total]) => ({ motivo, total }))
        .sort((a, b) => b.total - a.total),
      personas: excluidos.slice(0, 300),
    };
  }

  async exportar(
    convenioId: string,
    formato: Formato,
    ano: number,
    ambito: string[],
  ) {
    const { listos, excluidos } = await this.preparar(convenioId, ambito);

    /// Lo mismo que el F7: un archivo con cero personas no se
    /// baja. La pantalla ya lo impedia, pero el que manda es
    /// el servidor -- la descarga va por navegacion y basta
    /// pegar la URL.
    exigirQueHayaFilas(listos.length, excluidos.length, 'persona');

    const definicion = formato === 'cargue-sep' ? cargue : usoDirecto;
    const filas =
      formato === 'cargue-sep'
        ? listos.map((p, i) => cargue.fila(p, i, ano))
        : listos.map((p) => usoDirecto.fila(p));

    const hojas: Hoja[] = [
      {
        nombre: formato === 'cargue-sep' ? 'SEP MASIVO' : 'SEP',
        columnas: definicion.COLUMNAS,
        filas,
        // se pega dentro de la plantilla del cliente
        crudo: true,
      },
    ];

    // los que no entraron van en el mismo libro: una lista
    // aparte que nadie abre es una lista que nadie mira
    if (excluidos.length > 0) {
      hojas.push({
        nombre: 'No exportados',
        columnas: [
          { titulo: 'Documento', clave: 'documento' },
          { titulo: 'Nombre', clave: 'nombre', ancho: 34 },
          /// Sin esta columna, quien está inscrito en dos
          /// formaciones sale dos veces en la hoja y parece un
          /// duplicado. No lo es: son dos participaciones con
          /// dos cosas distintas por arreglar.
          { titulo: 'Formación', clave: 'accion', ancho: 34 },
          { titulo: 'Etapa', clave: 'etapa' },
          { titulo: 'Por qué no entró', clave: 'motivo', ancho: 60 },
        ],
        filas: excluidos,
      });
    }

    return {
      libro: await construirLibro(hojas),
      listos: listos.length,
      excluidos: excluidos.length,
    };
  }

  /**
   * El F7 va por ORGANIZACIÓN, no por persona: una fila
   * es una empresa dentro de una acción, con cuántos de
   * los suyos se están formando.
   */
  private async prepararF7(convenioId: string, ambito: string[]) {
    /**
     * EL F7 CUENTA A LOS QUE ENTRAN EN EL CARGUE. A esos y a nadie más.
     *
     * Tenía su propia consulta, y el filtro NO era el mismo. Aquí se
     * descartaba solo por autorización revocada; en `preparar` se
     * descarta además por completitud ---sin celular, sin barrio, sin
     * grupo, menor de edad, el grupo de otra acción---. Los dos
     * archivos se le entregan JUNTOS al SENA, así que se
     * contradecían: el cargue mandaba 2 personas de una empresa y el
     * F7 decía que tenía 3 beneficiarios. Quien lo revise no sabe
     * cuál de los dos miente, y el que rebota es el cargue.
     *
     * Por eso ya no hay dos consultas: se cuenta sobre `listos`, que
     * es LITERALMENTE la lista de filas del cargue. No es que los dos
     * filtros coincidan hoy —es que no pueden dejar de coincidir—.
     *
     * Efecto buscado: una empresa cuya gente entera se quedó fuera no
     * sale en el F7 ni en la hoja de las incompletas. Correcto: en el
     * cargue tiene cero beneficiarios, y reportarla como beneficiaria
     * del PFCE sin una sola fila que lo respalde es lo mismo que
     * reportar la cifra inflada.
     *
     * El filtro de autorización no se pierde: `revisar` saca a quien
     * no la tiene viva ---es de los de matrícula, y el reporte los
     * hereda---. Da igual que aquí la persona solo salga como un
     * número: seguir reportándola al SENA como beneficiaria es seguir
     * tratando su participación después de que pidió que no.
     *
     * Y el permiso lo sigue mirando `preparar`, que empieza por ahí:
     * el archivo lleva cédulas.
     */
    const { listos, excluidos } = await this.preparar(convenioId, ambito);

    // agrupadas por empresa Y accion: la misma empresa
    // puede tener gente en dos cursos distintos
    const grupos = new Map<string, FilaF7>();
    for (const p of listos) {
      /// Cuál es su empresa ya lo resolvió `preparar` ---la propia
      /// manda sobre la de la reserva--- y sin empresa la fila ni
      /// llega aquí: `preparar` la excluye. El guarda es para el
      /// tipo, no para el dato.
      const e = p.empresa;
      if (!e) continue;
      const clave = `${e.id}|${p.accion.nombre}`;
      const ya = grupos.get(clave);
      if (ya) {
        ya.beneficiarios += 1;
        continue;
      }
      grupos.set(clave, {
        accion: p.accion.nombre,
        beneficiarios: 1,
        empresa: {
          razonSocial: e.razonSocial,
          nit: e.nit,
          digitoVerificacion: e.digitoVerificacion,
          departamento: e.departamentoSepId
            ? (DEPARTAMENTO_POR_ID.get(e.departamentoSepId)?.etiqueta ?? null)
            : null,
          // el municipio es una tupla [id, depto, nombre, ...]
          municipio: e.municipioSepId
            ? (MUNICIPIO_POR_ID.get(e.municipioSepId)?.[2] ?? null)
            : null,
          direccion: e.direccion,
          telefono: e.telefono,
          contactoNombre: e.contactoNombre,
          contactoCargo: e.contactoCargo,
          contactoCorreo: e.contactoCorreo,
          tamanoSepId: e.tamanoSepId,
          numeroTrabajadores: e.numeroTrabajadores,
          papelEnConvenio: e.papelEnConvenio,
          sectorEconomico: e.sectorEconomico,
          clasificacion: e.clasificacion,
        },
      });
    }

    /**
     * CON DESEMPATE, PORQUE EL NÚMERO DE FILA SALE DEL ORDEN.
     *
     * Ordenaba solo por razón social, y eso EMPATA: la misma empresa
     * con gente en dos acciones son dos filas con idéntica razón
     * social. Un empate deja el orden en manos del motor —la consulta
     * tampoco llevaba `orderBy`—, así que dos exportaciones del mismo
     * día con los mismos datos podían numerar distinto. Y la columna
     * «#» de `formato-f7.ts` es el índice: el cliente arma sus INSERT
     * concatenando celdas y cruza los dos archivos por ese número.
     *
     * Los tres criterios juntos SÍ son un orden total: el NIT es
     * único en el maestro (`@@unique([nit])`), así que no hay dos
     * filas que queden iguales. La clave del grupo va de último por
     * si algún día deja de serlo.
     */
    const todas = [...grupos.entries()]
      .sort(
        ([claveA, a], [claveB, b]) =>
          a.empresa.razonSocial.localeCompare(b.empresa.razonSocial, 'es') ||
          a.accion.localeCompare(b.accion, 'es') ||
          a.empresa.nit.localeCompare(b.empresa.nit) ||
          claveA.localeCompare(claveB),
      )
      .map(([, f]) => f);

    const listas: FilaF7[] = [];
    const incompletas: Array<{
      empresa: string;
      nit: string;
      accion: string;
      motivo: string;
    }> = [];
    for (const f of todas) {
      const falta = faltaEnF7(f.empresa);
      if (falta.length) {
        incompletas.push({
          empresa: f.empresa.razonSocial,
          nit: f.empresa.nit,
          accion: f.accion,
          /// Todos, por lo mismo que arriba: decir uno de tres
          /// manda a arreglar y a volver.
          motivo: falta.join('; '),
        });
      } else {
        listas.push(f);
      }
    }

    /// `personasFuera` viaja para que el aviso no mienta.
    ///
    /// Desde que el F7 cuenta a los del cargue, una empresa cuya
    /// gente entera se quedó fuera no sale en ninguna de las dos
    /// hojas. Sin este número, el mensaje de «no se puede generar»
    /// decía «todavía no hay a quien reportar» habiendo 40 personas
    /// a medio completar, y eso manda a buscar el problema donde no
    /// está.
    return { listas, incompletas, personasFuera: excluidos.length };
  }

  async exportarF7(convenioId: string, ambito: string[]) {
    const { listas, incompletas, personasFuera } = await this.prepararF7(
      convenioId,
      ambito,
    );

    /// Un F7 sin una sola organizacion NO se baja.
    ///
    /// Se bajaba: un .xlsx con la cabecera, cero filas y la
    /// hoja de las incompletas al lado. Eso es un archivo que
    /// PARECE el reporte, y el cliente arma sus INSERT
    /// concatenando celdas -- de ahi no sale un error, sale un
    /// cargue de cero registros que nadie nota. La pantalla
    /// tenia el candado en los dos reportes de personas y no
    /// en este, asi que el boton estaba siempre activo.
    /// Si no hay ni una organización incompleta pero sí personas
    /// fuera, se cuentan ellas: es donde está el trabajo.
    exigirQueHayaFilas(
      listas.length,
      incompletas.length || personasFuera,
      'organización',
    );

    const hojas: Hoja[] = [
      {
        nombre: 'F7',
        columnas: COLUMNAS_F7,
        filas: listas.map((f, i) => filaF7(f, i)),
        crudo: true,
      },
    ];

    if (incompletas.length) {
      hojas.push({
        nombre: 'No exportadas',
        columnas: [
          { titulo: 'Organización', clave: 'empresa', ancho: 40 },
          { titulo: 'NIT', clave: 'nit' },
          { titulo: 'Acción de formación', clave: 'accion', ancho: 50 },
          { titulo: 'Qué le falta', clave: 'motivo', ancho: 40 },
        ],
        filas: incompletas,
      });
    }

    return {
      libro: await construirLibro(hojas),
      listos: listas.length,
      excluidos: incompletas.length,
    };
  }

  /**
   * Cuántas organizaciones entran en el F7 y cuántas no.
   *
   * Contaba construyendo el libro entero y quedandose con dos
   * numeros, y ademas no tenia ruta: la pantalla no podia
   * pedirlo, asi que el F7 era el unico de los tres sin su
   * cifra a la vista.
   */
  async alistamientoF7(convenioId: string, ambito: string[]) {
    const { listas, incompletas } = await this.prepararF7(convenioId, ambito);

    // agrupado por motivo, igual que el de personas: la lista
    // accionable no es de empresas, es de "12 sin telefono"
    const porMotivo = new Map<string, number>();
    for (const i of incompletas) {
      porMotivo.set(i.motivo, (porMotivo.get(i.motivo) ?? 0) + 1);
    }

    return {
      listos: listas.length,
      noListos: incompletas.length,
      motivos: [...porMotivo.entries()]
        .map(([motivo, total]) => ({ motivo, total }))
        .sort((a, b) => b.total - a.total),
      empresas: incompletas.slice(0, 300),
    };
  }

  /** Arma las filas y separa las que no están listas. */
  private async preparar(convenioId: string, ambito: string[]) {
    // el archivo lleva cedulas: sin concesion, ni el
    // alistamiento se puede ver
    if (!ambito.includes(convenioId)) {
      throw new ForbiddenException('No tiene acceso a ese convenio.');
    }

    const convenio = await this.prisma.convenio.findUnique({
      where: { id: convenioId },
      select: {
        id: true,
        nombre: true,
        sigla: true,
        sepProyectoId: true,
        sepNombreConviniente: true,
      },
    });
    if (!convenio) throw new NotFoundException('Ese convenio no existe.');

    /// SIN id de proyecto se exporta IGUAL, con la celda vacía.
    ///
    /// Antes se abortaba, y el razonamiento tenía sentido: sin ese
    /// id el archivo no carga, y entregar 800 filas que van a
    /// rebotar es peor que no entregar nada.
    ///
    /// Pero el id no lo tenemos todavía: lo asigna el SENA y aún
    /// no lo ha dado. Con el aborto, el reporte NO SE PUEDE
    /// GENERAR — ni para revisarlo, ni para contar cuántos entran,
    /// ni para mandárselo a nadie. O sea que un control puesto
    /// para proteger un cargue está impidiendo el trabajo de
    /// antes del cargue.
    ///
    /// Es el mismo caso que `PERSONA ID` y `EMPRESA ID`, que ya
    /// van vacíos por decisión del cliente: columnas que él
    /// completa cuando las tiene. Decisión suya, 2 sep 2026.
    ///
    /// Lo que NO se hace es inventarse un número. Vacío se ve y se
    /// llena; un id equivocado carga contra el proyecto de otro.

    const participantes = await this.prisma.participante.findMany({
      where: { convenioId, etapa: { in: ETAPAS_DEL_REPORTE } },
      /**
       * Y EL TERCER CRITERIO NO ES ADORNO: `creadoEn` EMPATA.
       *
       * Es la misma lección que las caracterizaciones de más abajo.
       * Las participaciones de una nómina entera se escriben de golpe
       * ---un cargue de plantilla, una reserva con sus nominados--- y
       * `creadoEn` es `now()`, que en Postgres es la hora de la
       * TRANSACCIÓN, idéntica para todas las filas. Ordenar por un
       * valor igual no ordena nada.
       *
       * Y la columna «NO.» del cargue es el índice de esta lista, así
       * que dos exportaciones del mismo día con los mismos datos
       * numeraban distinto. El `id` es arbitrario pero ESTABLE, que es
       * lo único que hace falta.
       */
      orderBy: [
        { accionFormacionId: 'asc' },
        { creadoEn: 'asc' },
        { id: 'asc' },
      ],
      include: {
        /// Con sus caracterizaciones: el reporte las mandaba
        /// SIEMPRE vacías porque aquí no se pedían y abajo se
        /// escribía un null a mano. El SENA lleva ese campo y
        /// nunca le llegó nada.
        persona: {
          include: {
            /// SOLO las amparadas por una autorización VIVA.
            ///
            /// Traía todas. Una persona que revocó en un gremio
            /// seguía exportando su marca sensible en el reporte
            /// del otro, porque allí su autorización sigue viva y
            /// la marca no se filtraba por la suya. Eso es
            /// mandarle al Estado un dato sensible amparado por
            /// un consentimiento retirado.
            ///
            /**
             * Y CON ORDEN QUE DESEMPATA DE VERDAD.
             *
             * Abajo se manda `[0]` y el comentario decía «la primera
             * que marcó». Se añadió `orderBy: creadoEn` para que no lo
             * decidiera Postgres, y NO BASTABA: las marcas de un envío
             * se escriben TODAS en un único `createMany` dentro de una
             * transacción, y `creadoEn` es `now()`, que en Postgres es
             * la hora de la TRANSACCIÓN ---idéntica para todas las
             * filas---. Ordenar por un valor igual no ordena nada: el
             * desempate seguía siendo del motor.
             *
             * O sea que quien marcó «víctima del conflicto armado» y
             * «discapacidad auditiva» en el mismo formulario podía
             * salir el lunes con una y el martes con la otra. Es un
             * dato sensible y es el que ve el SENA.
             *
             * El segundo criterio es el id del catálogo: arbitrario
             * pero ESTABLE, que es lo único que hace falta. Elegir «la
             * primera que marcó» de verdad pediría guardar el orden en
             * que las marcó, y eso no se guarda.
             *
             * Lo encontró una auditoría del 2 oct 2026, que ademas vio
             * que la prueba daba esto por bueno sin comprobar el
             * empate.
             */
            caracterizaciones: {
              /**
               * Y LAS DE ESTE GREMIO, no las de cualquiera.
               *
               * Filtraba solo por «autorización viva». Como la marca
               * colgaba de UNA autorización ---la del gremio donde se
               * capturó primero--- revocar allí la borraba también de
               * ESTE reporte, donde la persona sigue autorizando. Y al
               * revés: una marca consentida solo en el otro gremio
               * viajaba aquí.
               *
               * Desde el 5 oct 2026 cada marca lleva su `convenioId`,
               * así que se pide el de este reporte y la autorización
               * que la ampara es necesariamente la de aquí.
               */
              where: {
                convenioId,
                autorizacion: { revocadaEn: null },
              },
              orderBy: [{ creadoEn: 'asc' }, { caracterizacionSepId: 'asc' }],
            },
          },
        },
        // la empresa propia del lead: `include` no la trae
        // sola por ser una relacion, y sin nombrarla aqui la
        // linea de abajo mira siempre null
        empresa: true,
        accionFormacion: {
          select: { codigo: true, nombre: true, sepAfId: true, horas: true },
        },
        cobertura: {
          select: {
            grupo: {
              select: {
                numero: true,
                sepGrupoId: true,
                fechaInicio: true,
                accionFormacionId: true,
              },
            },
          },
        },
        /// La empresa de la reserva, ENTERA y no los cinco campos
        /// del cargue: de estas mismas filas sale ahora el F7, que
        /// reporta dirección, teléfono, contacto, sector y tamaño.
        /// Con el `select` corto, a quien llegó nominado por una
        /// reserva el F7 le veía la empresa «sin dirección».
        reserva: { select: { empresa: true } },
      },
    });

    // una sola consulta para todas las autorizaciones.
    // El filtro va por la relacion y NO con la lista de
    // personaId: Postgres admite 32.767 parametros en una
    // sentencia preparada, asi que un `in` con un id por
    // participante revienta el reporte entero pasada esa
    // cifra. Por la relacion no viaja ningun parametro que
    // crezca con las filas
    const autorizados = new Set(
      (
        await this.prisma.autorizacionDatos.findMany({
          where: {
            revocadaEn: null,
            politica: { destinatario: 'PARTICIPANTE', convenioId },
            persona: {
              participaciones: {
                some: { convenioId, etapa: { in: ETAPAS_DEL_REPORTE } },
              },
            },
          },
          select: { personaId: true },
        })
      ).map((a) => a.personaId),
    );

    const listos: FilaSep[] = [];
    const excluidos: Excluido[] = [];

    for (const p of participantes) {
      const nombre = [p.persona.primerNombre, p.persona.primerApellido].join(
        ' ',
      );
      const documento = p.persona.numeroDocumento;

      const { reporte } = revisar({
        ofertaId: p.ofertaId,
        coberturaId: p.coberturaId,
        accionFormacionId: p.accionFormacionId,
        nivelOcupacionalSepId: p.nivelOcupacionalSepId,
        beneficiarioPrevio: p.beneficiarioPrevio,
        tieneAutorizacion: autorizados.has(p.personaId),
        grupoConFechas: Boolean(p.cobertura?.grupo.fechaInicio),
        grupoSepId: p.cobertura?.grupo.sepGrupoId ?? null,
        /// LA MISMA FECHA CON LA QUE EL ARCHIVO CONGELA LA EDAD.
        /// Sin esto la puerta juzgaba a hoy y el archivo al arranque
        /// del grupo, y entre las dos se colaba un menor. Ver
        /// `ParaRevisar.fechaDeCorte`.
        fechaDeCorte: p.fechaMatricula ?? null,
        accionSepId: p.accionFormacion?.sepAfId ?? null,
        persona: p.persona,
      });

      // igual que en el F7: la suya primero, la de la
      // reserva despues. Mirando solo la de la reserva, TODO
      // el mundo salia «sin empresa», incluidos los que si
      // tenian una propia
      const empresa = p.empresa ?? p.reserva?.empresa ?? null;
      if (!empresa) reporte.push('no tiene empresa donde labora');

      // el grupo tiene que ser de su misma acción, o el
      // archivo manda un AF y un grupo que se contradicen
      if (
        p.cobertura &&
        p.cobertura.grupo.accionFormacionId !== p.accionFormacionId
      ) {
        reporte.push('su grupo es de otra acción de formación');
      }

      /**
       * SIN HORAS NO SE REPORTA, Y SOBRE TODO: SE AVISA.
       *
       * `AccionFormacion.horas` es opcional y «TOTAL DE HORAS EVENTO»
       * lo exporta tal cual, así que una acción a la que nadie le
       * puso las horas mandaba la celda VACÍA en sus 800 filas y
       * nada lo decía: ni el alistamiento, ni la hoja de los no
       * exportados, ni la ficha. El cliente arma sus INSERT
       * concatenando celdas, así que de ahí no sale un error — sale
       * un cargue con el total de horas en blanco.
       *
       * Y es el dato del que cuelga todo lo demás: el porcentaje de
       * cumplimiento del cierre se mide contra él.
       *
       * El motivo nombra la ACCIÓN, no la persona, porque el arreglo
       * es uno solo para las 800: se le ponen las horas a la acción.
       * Va por participación igual que los demás porque esta lista
       * es de participaciones, y el alistamiento agrupa por motivo —
       * el asesor lee «800 sin horas» una vez, no 800 veces.
       */
      if (p.accionFormacion && p.accionFormacion.horas === null) {
        reporte.push(
          `su acción de formación no tiene el total de horas del evento ` +
            `(${p.accionFormacion.codigo})`,
        );
      }

      if (reporte.length > 0) {
        excluidos.push({
          id: p.id,
          nombre,
          documento,
          etapa: p.etapa,
          accion: p.accionFormacion?.nombre ?? null,
          /// TODOS los motivos, no solo el primero.
          ///
          /// Con `reporte[0]` el asesor arreglaba lo que decía
          /// la hoja, volvía a exportar y la persona SEGUÍA
          /// fuera —porque le faltaban tres cosas y solo se le
          /// dijo una—. Dos o tres viajes por lo mismo.
          motivo: reporte.join('; '),
        });
        continue;
      }

      listos.push({
        participante: {
          id: p.id,
          etapa: p.etapa,
          cargoEnEmpresa: p.cargoEnEmpresa,
          nivelOcupacionalSepId: p.nivelOcupacionalSepId,
          beneficiarioPrevio: p.beneficiarioPrevio,
          fechaMatricula: p.fechaMatricula,
        },
        persona: p.persona,
        convenio,
        accion: p.accionFormacion!,
        grupo: {
          numero: p.cobertura!.grupo.numero,
          sepGrupoId: p.cobertura!.grupo.sepGrupoId,
        },
        empresa,
        genero: GENERO_EN_EL_REPORTE[p.persona.generoSepId ?? -1] ?? '',
        /// La primera que marco. El formato del SEP admite
        /// UNA, aunque una persona pueda ser varias cosas: se
        /// manda la primera y las demas quedan guardadas, que
        /// es mejor que perderlas por no caber.
        caracterizacionSepId:
          p.persona.caracterizaciones[0]?.caracterizacionSepId ?? null,
      });
    }

    return { listos, excluidos, convenio };
  }
}
