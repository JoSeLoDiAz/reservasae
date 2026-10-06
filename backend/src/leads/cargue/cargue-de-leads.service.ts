/** El cargue masivo de la BBDD de leads: enseñar y después aplicar. */

/**
 * LO QUE PIDIÓ EL CLIENTE, Y LO QUE SE HIZO CON CADA FRASE.
 *
 * «Una visual como mesa de entrada que diga BBDD Leads Adecopria,
 * donde debe ajustarse el cargue masivo, de como se tiene pero en
 * donde en esa visual tenga la opción y donde no sea restrictiva
 * porque no tengo todos los datos, necesito montarla donde si
 * tiene, correo y celular, necesito que apenas se gestione si la
 * persona ya ingresa y completa datos caiga a Gestión de leads»
 * (5 oct 2026).
 *
 *   - «no sea restrictiva»: no hay columna obligatoria. Entra la
 *     fila que traiga UNO de documento, correo, celular o nombre, y
 *     eso no lo decide este fichero: lo decide `llaveDelLead`, la
 *     misma regla que ya aplica el webhook de Meta.
 *   - «donde sí tiene, correo y celular»: lo que no venga no se
 *     inventa y no borra nada.
 *   - «apenas se gestione... caiga a Gestión de leads»: los leads
 *     entran PENDIENTE en la mesa, que es de donde los coge la
 *     gestión. Este cargue NO convierte a ficha: eso ya lo hacen
 *     `conversion.service` y la conversión automática cuando el
 *     lead queda completo, y escribir aquí una segunda vía para
 *     crear fichas sería tener dos.
 *
 * Y sobre los repetidos: «Complete lo que no tiene datos y los que
 * estén diferentes como la alerta cuando lo volvieron a llenar».
 * Eso es `reparto-de-la-fila.ts`.
 *
 * DOS PASOS, Y EL PRIMERO NO ESCRIBE NADA.
 *
 * Es la misma forma del cargue de empresas y del volcado del
 * cronograma ---«NO ESCRIBE SIN QUE SE LO PIDAN. Sin `--aplicar`
 * solo enseña»--- y por la misma razón: nadie debería descubrir que
 * un cargue le tocó dos mil filas después de que se las tocó. Con
 * una base de leads hay un motivo más: la vista previa es lo único
 * que delata que el archivo está mal rotulado. «3.000 filas, 0
 * reconocidas» se ve de un golpe; después de aplicar, «3.000
 * nuevas» cuando ya estaban todas no se ve nunca.
 *
 * UNA FILA MALA NO TUMBA EL CARGUE. Es la lección que este
 * repositorio lleva escrita en `lote-fila-a-fila.spec.ts` y en la
 * carga masiva del panel: en 500 filas, que la 17 traiga basura no
 * puede llevarse las otras 499. Y se contesta FILA POR FILA, con
 * el número de fila DEL EXCEL, porque «el 17 falló» obliga a
 * contar a mano en un archivo de miles.
 *
 * Esto es justo lo contrario del cargue de empresas, que si hay un
 * solo reparo no escribe nada. Allí está bien: aquello CORRIGE
 * filas que existen y una corrección a medias deja la base peor.
 * Aquí se RECIBE gente nueva, y una fila que no sirve es una
 * persona menos a la que llamar, no una base corrupta.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Prisma, type OrigenParticipante } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

import { loQueLeFaltaAlLead } from '../listo-para-ficha';

import {
  aQuienYaTeniamos,
  COMO_SE_RECONOCIO,
  type PorQueEsLaMisma,
} from './a-quien-ya-tenemos';
import {
  interpretarLaFila,
  type DatosDeLaFila,
  type FilaInterpretada,
} from './datos-de-la-fila';
import type { Llave } from '../llave-del-lead';
import { llaveDeLaFila, ORIGEN_DEL_CARGUE } from './llave-de-la-fila';
import { leerElCargue, type ReparoDelCargue } from './lector-del-cargue';
import { AuditoriaService, ENTIDADES } from '../../comun/auditoria.service';
import { construirPlantillaDelCargue } from './plantilla-del-cargue';
import {
  comoSeCuentanLosChoquesDelCargue,
  repartirLaFila,
  type ChoqueDelCargue,
} from './reparto-de-la-fila';

/**
 * De dónde se dice que salieron estos leads.
 *
 * `ASESOR` y no `OTRO`, aunque las dos caigan en el mismo cubo:
 * `origenDeLead()` manda todo lo que no es red social ni
 * autogestión a `IMPORTACION` ---«lo cargó el equipo»--- así que
 * para el tablero por acción son idénticas. La diferencia es para
 * quien lee la mesa: `ASESOR` dice que esto lo trajo el equipo, y
 * `OTRO` no dice nada. Quien suba el archivo puede cambiarlo si la
 * base es de una feria o de una empresa.
 */
const ORIGEN_POR_OMISION: OrigenParticipante = 'ASESOR';

export type QueLePasoALaFila =
  | 'NUEVA'
  | 'YA_ESTABA'
  /// Ya tiene ficha en Gestion de leads: no se crea lead ni se le
  /// toca nada. Llego el 6 oct 2026, cuando el cliente pregunto
  /// «¿pero con Gestion de leads?».
  | 'YA_TIENE_FICHA'
  | 'REPETIDA_EN_EL_ARCHIVO'
  | 'NO_SE_RECONOCE'
  | 'FALLO';

export type FilaDelInforme = {
  /// El número de fila EN EL EXCEL.
  fila: number;
  que: QueLePasoALaFila;
  /// Con qué se reconoce a esta persona en el archivo: el
  /// documento, el correo, el celular o el nombre. Es lo que
  /// permite encontrarla sin volver a abrir el archivo.
  quien: string;
  /// El lead al que fue a parar, si fue a parar a alguno.
  leadId: string | null;
  /// Por dónde se vio que ya estaba.
  porque: PorQueEsLaMisma | null;
  comoSeReconocio: string | null;
  /// Los campos que estaban vacíos y se rellenan (o se
  /// rellenaron), en castellano.
  rellena: string[];
  /// Lo que viene distinto y NO se pisa.
  choques: ChoqueDelCargue[];
  /// Lo que se mandó y no servía, y por qué la fila no entró.
  avisos: string[];
};

export type ResultadoDelCargue = {
  /// Se escribió de verdad, o solo se revisó.
  aplicado: boolean;
  convenio: { id: string; slug: string };
  archivo: string;
  /// En qué fila del Excel estaban los títulos.
  filaDeLaCabecera: number;
  columnasTraidas: string[];
  /// Rótulos que venían y no se reconocen. No son un error: se
  /// dicen para que nadie descubra meses después que esa columna
  /// no se cargó.
  columnasQueNoSeReconocen: string[];
  leidas: number;
  nuevas: number;
  yaEstaban: number;
  /// Cuantas ya tienen FICHA en Gestion de leads. No se crea lead
  /// ni se les toca nada: se dicen. Llego el 6 oct 2026.
  yaTienenFicha: number;
  /// De las que ya estaban, cuántas tenían algún hueco que tapar.
  seRellenan: number;
  /// Cuántos campos en total. «12 filas» y «48 campos» responden
  /// a preguntas distintas y las dos se preguntan.
  camposQueSeRellenan: number;
  conChoques: number;
  repetidasEnElArchivo: number;
  sinReconocer: number;
  fallaron: number;
  reparos: ReparoDelCargue[];
  filas: FilaDelInforme[];
};

type Quien = { id: string; nombre: string };

/// Lo que se trae de cada lead candidato: los campos del cruce y
/// los que se comparan para repartir huecos y choques. Se declara
/// una vez porque la vista previa y la aplicación tienen que
/// comparar LO MISMO: si una mirase un campo menos, diría que no
/// hay choques y la otra los escribiría.
const DE_CADA_CANDIDATO = {
  id: true,
  externoId: true,
  estado: true,
  participanteId: true,
  nombreCompleto: true,
  primerNombre: true,
  segundoNombre: true,
  primerApellido: true,
  segundoApellido: true,
  correo: true,
  celular: true,
  tipoDocumentoSepId: true,
  numeroDocumento: true,
  interes: true,
  accionFormacionId: true,
  departamentoSepId: true,
  municipioSepId: true,
  origen: true,
} as const;

type Candidato = Prisma.LeadEntranteGetPayload<{
  select: typeof DE_CADA_CANDIDATO;
}>;

@Injectable()
export class CargueDeLeads {
  private readonly log = new Logger('CargueDeLeads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** La plantilla en blanco, con una fila de ejemplo. */
  plantilla(): Promise<Buffer> {
    return construirPlantillaDelCargue();
  }

  /**
   * Qué pasaría. No escribe nada.
   *
   * Es el mismo recorrido que `aplicar`, con el interruptor en
   * `false`: un revisor que recorriera el archivo por su cuenta
   * acabaría diciendo una cosa y el que escribe otra, y el error
   * solo se vería después de escribir.
   */
  revisar(
    archivo: Buffer,
    nombre: string,
    convenioPedido: string,
    ambito: string[],
    origen?: OrigenParticipante,
  ): Promise<ResultadoDelCargue> {
    return this.procesar(archivo, nombre, convenioPedido, ambito, null, {
      escribir: false,
      origen,
    });
  }

  /** Lo aplica. */
  async aplicar(
    archivo: Buffer,
    nombre: string,
    convenioPedido: string,
    ambito: string[],
    quien: Quien,
    origen?: OrigenParticipante,
  ): Promise<ResultadoDelCargue> {
    const r = await this.procesar(
      archivo,
      nombre,
      convenioPedido,
      ambito,
      quien,
      { escribir: true, origen },
    );

    /**
     * Y EL ACTO QUEDA EN LA BITÁCORA.
     *
     * Cada lead guarda en su `carga` de qué archivo y qué fila salió,
     * que sirve para explicar UNO. Esta fila explica el OTRO lado: que
     * alguien, un día, metió de golpe miles de personas en el gremio.
     * Es la escritura más grande que admite el sistema y era la única
     * de ese tamaño sin rastro propio.
     *
     * Va DESPUÉS de escribir y con las cifras de verdad ---las que
     * entraron, no las que traía el archivo---, porque lo que se va a
     * preguntar dentro de un mes es cuánta gente apareció, no cuántas
     * filas tenía la hoja.
     *
     * `entidadId` es el convenio y no un lead: el acto es sobre el
     * gremio entero. Si fallara el apunte no se deshace el cargue
     * ---`registrar` ya se traga lo suyo---: perder la fila es malo,
     * perder tres mil leads ya escritos es peor.
     */
    await this.auditoria.registrar({
      actor: { id: quien.id, nombre: quien.nombre },
      accion: 'LEADS_CARGADOS',
      entidad: ENTIDADES.LEAD,
      entidadId: r.convenio.id,
      convenioId: r.convenio.id,
      resumen:
        `«${nombre}»: ${r.leidas} filas leídas, ${r.nuevas} nuevas, ` +
        `${r.yaEstaban} ya estaban (${r.seRellenan} con huecos rellenados, ` +
        `${r.conChoques} con datos distintos), ${r.sinReconocer} sin ` +
        `reconocer, ${r.fallaron} fallaron`,
      camposTocados: r.columnasTraidas,
    });

    return r;
  }

  private async procesar(
    archivo: Buffer,
    nombre: string,
    convenioPedido: string,
    ambito: string[],
    quien: Quien | null,
    opciones: { escribir: boolean; origen?: OrigenParticipante },
  ): Promise<ResultadoDelCargue> {
    /**
     * EL GREMIO, PRIMERO Y ACOTADO AL ÁMBITO.
     *
     * Fuera del ámbito el convenio NO EXISTE: 404 y no 403. Un 403
     * confirmaría que el otro gremio está ahí, y eso es un
     * oráculo. Mismo criterio que `mesa.arreglar` y que
     * `gestion.agregarNota`.
     *
     * Se admite el id o el slug porque la pantalla tiene el id y
     * quien prueba la ruta a mano tiene el slug, y obligar a
     * traducirlo no protege de nada.
     */
    const convenio = await this.prisma.convenio.findFirst({
      where: {
        AND: [
          { id: { in: ambito } },
          { OR: [{ id: convenioPedido }, { slug: convenioPedido }] },
        ],
      },
      select: {
        id: true,
        slug: true,
        /// Las acciones DE ESTE convenio y de ningún otro: `AF1`
        /// existe en los dos gremios y no es el mismo curso.
        acciones: { select: { id: true, codigo: true, visible: true } },
      },
    });
    if (!convenio) {
      throw new NotFoundException(
        `No hay ninguna convocatoria suya que sea «${convenioPedido}».`,
      );
    }

    const lectura = await leerElCargue(archivo, nombre);

    const base: ResultadoDelCargue = {
      aplicado: false,
      convenio: { id: convenio.id, slug: convenio.slug },
      archivo: nombre,
      filaDeLaCabecera: lectura.filaDeLaCabecera,
      columnasTraidas: lectura.columnasTraidas,
      columnasQueNoSeReconocen: lectura.columnasQueNoSeReconocen,
      leidas: lectura.filas.length,
      nuevas: 0,
      yaEstaban: 0,
      yaTienenFicha: 0,
      seRellenan: 0,
      camposQueSeRellenan: 0,
      conChoques: 0,
      repetidasEnElArchivo: 0,
      sinReconocer: 0,
      fallaron: 0,
      reparos: lectura.reparos,
      filas: [],
    };

    if (lectura.filas.length === 0) return base;

    /// Cada fila, interpretada: normalizada y con el curso y la
    /// ubicación ya resueltos contra los catálogos.
    const interpretadas = lectura.filas.map((f) =>
      interpretarLaFila(f, convenio.acciones),
    );

    /// La llave de cada fila, con el GREMIO dentro. Ver
    /// `llave-de-la-fila.ts`: sin el gremio, un cargue de BRITCHAM
    /// se tragaría en silencio los leads que coincidan con
    /// ADECOPRIA.
    const conLlave = interpretadas.map((f) => ({
      f,
      llave: llaveDeLaFila(f.datos, f.codigoDeLaAccion, convenio.id),
    }));

    /// LOS CANDIDATOS, EN UNA SOLA CONSULTA.
    ///
    /// Y no una por fila: con 5.000 filas serían 5.000 viajes a la
    /// base y el cargue tardaría minutos con la pantalla en
    /// blanco. Se piden de golpe los leads de ESTE convenio que
    /// comparten documento, correo, celular o llave con alguna
    /// fila, y el cruce lo decide después `aQuienYaTeniamos` en
    /// memoria.
    const candidatos = await this.candidatos(convenio.id, conLlave);

    /// Y las FICHAS de este gremio que comparten documento, correo o
    /// celular con alguna fila. Son otra población: quien llegó por
    /// el formulario público nace ficha y no deja fila en la mesa.
    const fichas = await this.fichasQueYaEstan(convenio.id, conLlave);

    /// Los que se van creando entran AQUÍ, en la misma lista.
    ///
    /// Es lo que resuelve los repetidos DENTRO del archivo sin un
    /// segundo mecanismo: la base del cliente lleva meses a mano y
    /// tiene a la misma persona dos veces: con el correo del
    /// trabajo y con el personal. Sin esto, las dos filas no
    /// encontrarían nada en la base y se crearían dos leads --el
    /// cargue habría metido el duplicado que viene a evitar--.
    const vistos: Candidato[] = [...candidatos];

    for (const { f, llave } of conLlave) {
      /// SIN NADA CON QUE RECONOCERLA, la fila se reporta y las
      /// demás siguen. No es un fallo del cargue: es una fila de
      /// la que no se sabe nada, y guardarla crearía una persona
      /// nueva por cada vez que se suba el archivo.
      if ('falta' in llave) {
        base.sinReconocer += 1;
        base.filas.push({
          fila: f.fila,
          que: 'NO_SE_RECONOCE',
          quien: comoSeLlamaLaFila(f),
          leadId: null,
          porque: null,
          comoSeReconocio: null,
          rellena: [],
          choques: [],
          avisos: [llave.falta, ...f.avisos],
        });
        continue;
      }

      const llaves = [llave.llave, ...(llave.anterior ? [llave.anterior] : [])];
      const ya = aQuienYaTeniamos(f.datos, llaves, vistos);

      try {
        if (ya) {
          const informe = await this.completarElQueYaEstaba(
            f,
            ya.lead,
            ya.porque,
            quien,
            opciones.escribir,
          );
          /// Si el lead con el que casó se creó en ESTE mismo
          /// archivo, no «ya estaba»: estaba repetida en el
          /// archivo. Son dos números distintos y mezclarlos
          /// esconde que la base del cliente tiene duplicados,
          /// que es algo que él quiere saber.
          const delArchivo = !candidatos.some((c) => c.id === ya.lead.id);
          informe.que = delArchivo ? 'REPETIDA_EN_EL_ARCHIVO' : 'YA_ESTABA';
          if (delArchivo) base.repetidasEnElArchivo += 1;
          else base.yaEstaban += 1;

          if (informe.rellena.length > 0) {
            base.seRellenan += 1;
            base.camposQueSeRellenan += informe.rellena.length;
          }
          if (informe.choques.length > 0) base.conChoques += 1;

          base.filas.push(informe);
          /// El candidato se actualiza en memoria con lo que se
          /// acaba de rellenar: si el archivo trae a la misma
          /// persona tres veces, la tercera no puede volver a
          /// proponer el hueco que tapó la segunda.
          this.ponerAlDiaElVisto(vistos, ya.lead.id, informe.rellena, f);
          continue;
        }

        /**
         * ¿Y SI NO ESTÁ EN LA MESA PERO SÍ EN GESTIÓN DE LEADS?
         *
         * «¿Pero con Gestión de leads?» (cliente, 6 oct 2026), al
         * preguntar cómo sabe qué le proponen al cargar una base.
         *
         * El cruce de arriba mira la MESA ---`leads_entrantes`--- y no
         * las fichas. Y las dos poblaciones casi no se solapan: quien
         * llega por el formulario público nace FICHA y no deja fila en
         * la mesa. En la base de pruebas, de 1.480 fichas NINGUNA
         * tiene lead en la mesa.
         *
         * Así que sin esto, subir una base con gente que ya está en
         * Gestión de leads ---incluso ya inscrita--- las daba por
         * NUEVAS y creaba un lead de cada una. Dos registros de la
         * misma persona y dos asesoras llamándola: exactamente el
         * duplicado que la mesa existe para no tener.
         *
         * NO SE LE TOCA NADA A LA FICHA, y es la misma frontera que
         * ya pone el lead convertido: rellenar campos de una ficha
         * desde un archivo cambia lo que se le reportó al SENA sin
         * pasar por la ficha. Se dice quién es y se deja, que es lo
         * que el cliente pidió para los choques: avisar, no decidir.
         */
        const ficha = buscarLaFicha(fichas, f.datos);
        if (ficha) {
          base.yaTienenFicha += 1;
          base.filas.push({
            fila: f.fila,
            que: 'YA_TIENE_FICHA',
            quien: comoSeLlamaLaFila(f),
            leadId: null,
            porque: ficha.porque,
            comoSeReconocio: null,
            rellena: [],
            choques: [],
            avisos: [
              `ya está en Gestión de leads (${ficha.etapa.toLowerCase()}), ` +
                'así que no se creó ningún lead ni se le tocó la ficha',
              ...f.avisos,
            ],
          });
          continue;
        }

        const informe = await this.crearElNuevo(
          f,
          llave.llave,
          convenio.id,
          opciones.origen ?? ORIGEN_POR_OMISION,
          nombre,
          quien,
          opciones.escribir,
          vistos,
        );
        /**
         * SE CUENTA LO QUE PASÓ, NO LO QUE SE IBA A HACER.
         *
         * `crearElNuevo` puede volver diciendo `YA_ESTABA`: si otro
         * cargue o el webhook metió a esa persona mientras se
         * aplicaba este archivo, el único de la base lo para y el
         * que pierde completa el que ganó en vez de duplicar.
         *
         * Sumar `nuevas` aquí sin mirar ---que es lo que hacía---
         * decía «5 nuevas» habiendo creado 4, y esa es la clase de
         * número que nadie comprueba: cuadra con las filas del
         * archivo, que es justo lo que uno espera.
         */
        if (informe.que === 'NUEVA') {
          base.nuevas += 1;
        } else {
          base.yaEstaban += 1;
          if (informe.rellena.length > 0) {
            base.seRellenan += 1;
            base.camposQueSeRellenan += informe.rellena.length;
          }
          if (informe.choques.length > 0) base.conChoques += 1;
        }
        base.filas.push(informe);
      } catch (e) {
        /// Y AQUÍ SE QUEDA EL FALLO DE ESTA FILA.
        ///
        /// Sin este `catch` dentro del bucle, la fila 17 con un
        /// dato que la base rechaza se lleva las otras 4.983 y el
        /// cliente recibe un 500 sin saber cuántas entraron. Con
        /// él, se apunta cuál falló y por qué, y el resto sigue.
        base.fallaron += 1;
        base.filas.push({
          fila: f.fila,
          que: 'FALLO',
          quien: comoSeLlamaLaFila(f),
          leadId: null,
          porque: null,
          comoSeReconocio: null,
          rellena: [],
          choques: [],
          avisos: [...f.avisos, porQueFallo(e)],
        });
      }
    }

    base.aplicado = opciones.escribir;

    this.log.log(
      `Cargue de leads en ${convenio.slug} (${nombre}): ` +
        `${base.leidas} leídas, ${base.nuevas} nuevas, ${base.yaEstaban} ya estaban, ` +
        `${base.yaTienenFicha} ya tenían ficha, ` +
        `${base.seRellenan} con huecos tapados, ${base.conChoques} con choques, ` +
        `${base.repetidasEnElArchivo} repetidas en el archivo, ` +
        `${base.sinReconocer} sin reconocer, ${base.fallaron} fallaron. ` +
        (opciones.escribir
          ? 'APLICADO.'
          : 'Solo revisión: no se escribió nada.'),
    );

    return base;
  }

  /**
   * Los leads de este gremio que pueden ser alguna de estas filas.
   *
   * Cuatro `IN` y no un `OR` por fila: con 5.000 filas, un `OR` de
   * 5.000 ramas es una consulta que Postgres planifica mal y que
   * además no cabe en el límite de parámetros. Los `IN` van sobre
   * columnas ya normalizadas en la base, así que la igualdad basta.
   *
   * Acotado al convenio SIEMPRE. Sin eso, un cargue de ADECOPRIA
   * leería y rellenaría leads de BRITCHAM, que es el mismo defecto
   * que la llave sin gremio pero por la puerta del cruce.
   */
  /**
   * Las FICHAS de este gremio que pueden ser alguna de estas filas.
   *
   * Devuelve un índice por documento, correo y celular ---las tres
   * entradas apuntan a la misma ficha--- para poder preguntar por
   * cada fila sin recorrer la lista entera.
   *
   * POR LA PERSONA Y ACOTADO AL CONVENIO. Lo segundo no es una
   * formalidad: sin eso, un cargue de ADECOPRIA frenaría por una
   * ficha de BRITCHAM, y son dos tratamientos de datos distintos.
   *
   * SE COMPARA CONTRA LO NORMALIZADO, igual que en la mesa: el
   * documento sin puntos, el correo en minúsculas y el celular en
   * diez dígitos. Comparando el texto crudo del Excel, «+57 300 111
   * 2222» no encontraría a «3001112222» y el informe diría «todas
   * nuevas» ---que es lo que uno espera ver en un cargue, así que
   * nadie lo buscaría---.
   */
  private async fichasQueYaEstan(
    convenioId: string,
    conLlave: Array<{ f: FilaInterpretada; llave: Llave }>,
  ): Promise<Map<string, { etapa: string; porque: PorQueEsLaMisma }>> {
    const documentos = noVacios(
      conLlave.map(({ f }) => f.datos.numeroDocumento),
    );
    const correos = noVacios(conLlave.map(({ f }) => f.datos.correo));
    const celulares = noVacios(conLlave.map(({ f }) => f.datos.celular));

    const porAlgo: Prisma.PersonaWhereInput[] = [];
    if (documentos.length)
      porAlgo.push({ numeroDocumento: { in: documentos } });
    if (correos.length) porAlgo.push({ correo: { in: correos } });
    if (celulares.length) porAlgo.push({ celular: { in: celulares } });

    const indice = new Map<string, { etapa: string; porque: PorQueEsLaMisma }>();
    if (porAlgo.length === 0) return indice;

    const fichas = await this.prisma.participante.findMany({
      where: { convenioId, persona: { OR: porAlgo } },
      select: {
        etapa: true,
        persona: {
          select: { numeroDocumento: true, correo: true, celular: true },
        },
      },
    });

    /// El documento primero: es el que de verdad identifica. Si la
    /// misma ficha entra por dos de los tres, la primera gana y las
    /// otras no la pisan ---así «por el documento» no se degrada a
    /// «por el correo» según el orden de la consulta---.
    for (const ficha of fichas) {
      const p = ficha.persona;
      const entradas: Array<[string | null, PorQueEsLaMisma]> = [
        [p.numeroDocumento, 'DOCUMENTO'],
        [p.correo, 'CORREO'],
        [p.celular, 'CELULAR'],
      ];
      for (const [valor, porque] of entradas) {
        if (!valor) continue;
        const llave = `${porque}:${valor}`;
        if (!indice.has(llave)) indice.set(llave, { etapa: ficha.etapa, porque });
      }
    }
    return indice;
  }

  private async candidatos(
    convenioId: string,
    conLlave: Array<{ f: FilaInterpretada; llave: Llave }>,
  ): Promise<Candidato[]> {
    const documentos = noVacios(
      conLlave.map(({ f }) => f.datos.numeroDocumento),
    );
    const correos = noVacios(conLlave.map(({ f }) => f.datos.correo));
    const celulares = noVacios(conLlave.map(({ f }) => f.datos.celular));
    /// Las filas sin llave no aportan ninguna: no se las puede
    /// reconocer, así que tampoco hay nada que buscar por ahí.
    const llaves = noVacios(
      conLlave.flatMap(({ llave }) =>
        'falta' in llave ? [] : [llave.llave, llave.anterior],
      ),
    );

    const porAlgo: Prisma.LeadEntranteWhereInput[] = [];
    if (documentos.length)
      porAlgo.push({ numeroDocumento: { in: documentos } });
    if (correos.length) porAlgo.push({ correo: { in: correos } });
    if (celulares.length) porAlgo.push({ celular: { in: celulares } });
    if (llaves.length) porAlgo.push({ externoId: { in: llaves } });

    /// Ninguna fila trae nada con que cruzar: no hay a quién
    /// buscar. Un `OR: []` en Prisma no devuelve nada, pero
    /// depender de eso es depender de un detalle suyo.
    if (porAlgo.length === 0) return [];

    return this.prisma.leadEntrante.findMany({
      where: { AND: [{ convenioId }, { OR: porAlgo }] },
      select: DE_CADA_CANDIDATO,
      /// Los más nuevos primero: si la misma persona tiene dos
      /// leads viejos, se completa el que se está trabajando.
      orderBy: { recibidoEn: 'desc' },
    });
  }

  /**
   * La persona ya estaba: se tapan los huecos y se avisa lo demás.
   *
   * Lo DISTINTO no se escribe nunca, ni aquí ni con `force`: la
   * constancia va a una nota de gestión del propio lead y decide un
   * asesor. Ver `reparto-de-la-fila.ts`.
   */
  private async completarElQueYaEstaba(
    f: FilaInterpretada,
    lead: Candidato,
    porque: PorQueEsLaMisma,
    quien: Quien | null,
    escribir: boolean,
  ): Promise<FilaDelInforme> {
    const reparto = repartirLaFila(f.datos, lead);

    const informe: FilaDelInforme = {
      fila: f.fila,
      que: 'YA_ESTABA',
      quien: comoSeLlamaLaFila(f),
      leadId: lead.id,
      porque,
      comoSeReconocio: COMO_SE_RECONOCIO[porque],
      rellena: reparto.rellena,
      choques: reparto.choques,
      avisos: [...f.avisos],
    };

    /// YA ATENDIDO NO SE TOCA.
    ///
    /// Un lead convertido o descartado no está en la mesa, y
    /// rellenarle campos cambiaría los datos de los que ya salió
    /// una ficha sin pasar por la ficha. Se dice y se deja: es la
    /// misma frontera que pone `loQueLeFaltaAlLead` ---«ya se
    /// atendió», y no sigue mirando---.
    if (lead.estado !== 'PENDIENTE' || lead.participanteId) {
      informe.rellena = [];
      informe.avisos.push(
        'este lead ya se atendió (' +
          (lead.participanteId ? 'tiene ficha' : lead.estado.toLowerCase()) +
          '), así que no se le tocó nada; lo del archivo se anotó como aviso',
      );
    }

    if (!escribir) return informe;

    const huecos = informe.rellena.length > 0 ? reparto.huecos : {};
    const hayQueEscribir =
      Object.keys(huecos).length > 0 || reparto.choques.length > 0;
    if (!hayQueEscribir) return informe;

    /// EN UNA TRANSACCIÓN, los dos.
    ///
    /// El dato que se rellena y la constancia de lo que choca
    /// cuentan la misma cosa: lo que dijo este archivo sobre esta
    /// persona. Si se escribieran aparte y algo fallara en medio,
    /// quedaría el correo nuevo sin la nota que explica de dónde
    /// salió, y dentro de un mes nadie sabría por qué cambió.
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(huecos).length > 0) {
        await tx.leadEntrante.update({
          where: { id: lead.id },
          data: {
            ...(huecos as Prisma.LeadEntranteUpdateInput),
            /// El `motivo` se recalcula con lo que el lead tiene
            /// YA RELLENADO: es lo que la mesa enseña como «qué le
            /// falta», y dejarlo como estaba diría que le falta el
            /// documento que este cargue le acaba de poner.
            motivo: motivoDelLead({ ...lead, ...huecos }),
          },
        });
      }

      if (reparto.choques.length > 0) {
        await tx.notaDeGestion.create({
          data: {
            leadId: lead.id,
            /// Quién subió el archivo. La nota la escribe el
            /// sistema, pero la trajo una persona y el historial
            /// tiene que poder decir quién.
            autorId: quien?.id ?? null,
            autorNombre: quien?.nombre ?? 'Cargue masivo',
            texto:
              'Cargue de la BBDD de leads: llegaron datos distintos de los ' +
              'que ya tenía este lead y NO se pisaron. ' +
              comoSeCuentanLosChoquesDelCargue(reparto.choques) +
              '. Confirme con la persona cuál vale y corríjalo desde la mesa.',
            /// Sin canal: no se contactó a nadie. La columna admite
            /// vacío y es lo honesto -- marcar «teléfono» diría que
            /// hubo una llamada que no hubo.
            canales: [],
            /// Sin clasificar, como las demás notas que escribe el
            /// sistema: la clasificación la pone quien gestiona.
          },
        });
        /// A PROPÓSITO NO SE TOCA `ultimaGestionEn`.
        ///
        /// Esa fecha ordena la cola del asesor por «al que hace más
        /// que no se llama». Un cargue no es una gestión: si lo
        /// moviera, subir un archivo mandaría al final de la cola a
        /// mil personas a las que nadie ha llamado, y la cola es el
        /// producto.
      }
    });

    return informe;
  }

  /** La persona no estaba: entra PENDIENTE en la mesa. */
  private async crearElNuevo(
    f: FilaInterpretada,
    externoId: string,
    convenioId: string,
    origen: OrigenParticipante,
    archivo: string,
    quien: Quien | null,
    escribir: boolean,
    vistos: Candidato[],
  ): Promise<FilaDelInforme> {
    const informe: FilaDelInforme = {
      fila: f.fila,
      que: 'NUEVA',
      quien: comoSeLlamaLaFila(f),
      leadId: null,
      porque: null,
      comoSeReconocio: null,
      /// En una nueva «se rellena» todo lo que trae, y decirlo
      /// sería ruido: el informe de una fila nueva ya dice que
      /// entra entera.
      rellena: [],
      choques: [],
      avisos: [...f.avisos],
    };

    if (!escribir) {
      /// En la revisión el lead no existe, pero la fila SÍ tiene
      /// que entrar en los vistos: es lo que hace que la segunda
      /// aparición de la misma persona en el archivo se cuente
      /// como repetida en la vista previa igual que al aplicar. Sin
      /// esto, la revisión diría «dos nuevas» y la aplicación
      /// crearía una: dos verdades sobre el mismo archivo.
      vistos.push(comoCandidato(f, externoId, `fila-${f.fila}`));
      return informe;
    }

    try {
      const creado = await this.prisma.$transaction(async (tx) => {
        const lead = await tx.leadEntrante.create({
          data: {
            convenioId,
            /// Lo que los separa de la pauta en la pantalla.
            origenSistema: ORIGEN_DEL_CARGUE,
            externoId,
            origen,
            nombreCompleto: f.datos.nombreCompleto,
            primerNombre: f.datos.primerNombre,
            segundoNombre: f.datos.segundoNombre,
            primerApellido: f.datos.primerApellido,
            segundoApellido: f.datos.segundoApellido,
            correo: f.datos.correo,
            celular: f.datos.celular,
            tipoDocumentoSepId: f.datos.tipoDocumentoSepId,
            numeroDocumento: f.datos.numeroDocumento,
            interes: f.datos.interes,
            accionFormacionId: f.datos.accionFormacionId,
            departamentoSepId: f.datos.departamentoSepId,
            municipioSepId: f.datos.municipioSepId,
            /// Nadie firmó nada en una hoja de cálculo.
            ///
            /// `null` es «no lo dijo» y es la verdad: la base del
            /// cliente no tiene columna de habeas data. Marcar
            /// `true` sería inventar un consentimiento, y de ahí
            /// sale el texto que se le enseña a la persona.
            aceptaHabeasData: null,
            /// EL ARCHIVO ENTERO DE ESA FILA, tal cual.
            ///
            /// Es lo mismo que guarda el webhook en `carga` y para
            /// lo mismo: poder depurar, reprocesar y demostrar de
            /// dónde salió este dato. Con el nombre del archivo y
            /// el número de fila dentro, «¿de dónde salió este
            /// celular?» se contesta sin abrir nada.
            carga: {
              de: ORIGEN_DEL_CARGUE,
              archivo,
              fila: f.fila,
              crudo: f.crudo,
              cargadoPor: quien ? { id: quien.id, nombre: quien.nombre } : null,
              cargadoEn: new Date().toISOString(),
            },
            motivo: motivoDelLead({
              estado: 'PENDIENTE',
              participanteId: null,
              ...f.datos,
              origen,
            }),
          },
          select: DE_CADA_CANDIDATO,
        });

        /// LA OBSERVACIÓN DEL ARCHIVO NO SE PIERDE.
        ///
        /// Es lo que el cliente anotó a mano durante meses ---«llamó
        /// por la feria», «pidió que la llamaran en la tarde»--- y
        /// es lo único de su base que ninguna columna del lead
        /// puede guardar. Entra como primera nota de gestión, que
        /// es donde el asesor la va a leer antes de llamar.
        if (f.observacion) {
          await tx.notaDeGestion.create({
            data: {
              leadId: lead.id,
              autorId: quien?.id ?? null,
              autorNombre: quien?.nombre ?? 'Cargue masivo',
              texto: `Observación que traía la BBDD: ${f.observacion}`,
              canales: [],
            },
          });
        }

        return lead;
      });

      informe.leadId = creado.id;
      vistos.push(creado);
      return informe;
    } catch (e) {
      /**
       * P2002 ES «YA HAY UNA FILA CON ESA LLAVE», Y AQUÍ PASA.
       *
       * El único de la base es `(origenSistema, externoId)` y el
       * cruce de arriba no lo garantiza: se mira contra los
       * candidatos que se leyeron al empezar, y entre esa lectura y
       * este INSERT cabe otro cargue ---dos personas subiendo la
       * misma base, que con un archivo que se tarda en revisar es
       * el caso normal--- o un lead que acabe de entrar por el
       * webhook con la misma llave.
       *
       * Sin esto, ese choque sale como un 500 y el cliente ve
       * «falló» en una fila que de hecho ya está. Es el mismo
       * remate que la carrera de los reintentos de Meta en
       * `leads.service`: el que pierde no inventa nada, relee lo
       * que escribió el que ganó y lo cuenta como lo que es.
       *
       * Cualquier otro error sube tal cual: tragárselos todos
       * convertiría un fallo de base en un lead perdido en
       * silencio.
       */
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== 'P2002'
      ) {
        throw e;
      }

      const gano = await this.prisma.leadEntrante.findUnique({
        where: {
          origenSistema_externoId: {
            origenSistema: ORIGEN_DEL_CARGUE,
            externoId,
          },
        },
        select: DE_CADA_CANDIDATO,
      });
      /// Si no está, el P2002 era de OTRO único: no se puede
      /// contar como «ya estaba» un lead que no entró.
      if (!gano) throw e;

      const alcanzado = await this.completarElQueYaEstaba(
        f,
        gano,
        'LLAVE',
        quien,
        escribir,
      );
      alcanzado.avisos.push(
        'otro cargue o el webhook metió a esta persona mientras se aplicaba ' +
          'este archivo; se completó la que ya estaba en vez de duplicarla',
      );
      vistos.push(gano);
      return alcanzado;
    }
  }

  /**
   * Pone al día el candidato en memoria con lo que se rellenó.
   *
   * Si no se hiciera, la tercera aparición de la misma persona en
   * el archivo volvería a ver vacío el campo que tapó la segunda y
   * lo propondría otra vez ---o, peor, en la vista previa contaría
   * dos veces el mismo hueco y el resumen diría que se van a
   * rellenar más campos de los que se van a rellenar---.
   */
  private ponerAlDiaElVisto(
    vistos: Candidato[],
    leadId: string,
    rellena: string[],
    f: FilaInterpretada,
  ): void {
    if (rellena.length === 0) return;
    const i = vistos.findIndex((c) => c.id === leadId);
    if (i < 0) return;

    const reparto = repartirLaFila(f.datos, vistos[i]);
    vistos[i] = { ...vistos[i], ...reparto.huecos };
  }
}

/// Con qué se reconoce esta fila en el archivo del cliente.
///
/// El documento primero porque es con lo que él la busca; si no
/// hay, el correo; si no, el celular; si no, el nombre. Que
/// aparezca ALGO es lo que hace útil el informe: una lista de
/// números de fila obliga a abrir el Excel al lado.
function comoSeLlamaLaFila(f: FilaInterpretada): string {
  const d = f.datos;
  return (
    d.numeroDocumento ||
    d.correo ||
    d.celular ||
    d.nombreCompleto ||
    '(la fila no trae nada con que nombrarla)'
  );
}

/**
 * El `motivo` del lead: qué le falta para poder ser ficha.
 *
 * Con `loQueLeFaltaAlLead` y no con una lista propia. Es la
 * pregunta que ya responde la mesa de entrada y que decide qué
 * casillas puede encender la pantalla: si el cargue escribiera un
 * `motivo` con otro criterio, un lead entraría diciendo que le
 * falta el curso y la mesa lo enseñaría como listo, o al revés.
 */
function motivoDelLead(lead: {
  estado: string;
  participanteId: string | null;
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  nombreCompleto: string | null;
  primerNombre: string | null;
  primerApellido: string | null;
  accionFormacionId: string | null;
  origen: OrigenParticipante;
}): string | null {
  const falta = loQueLeFaltaAlLead(lead);
  return falta.length ? `Falta: ${falta.join(', ')}.` : null;
}

/// Un candidato de mentira para la vista previa: lo que se habría
/// creado. Solo se usa en memoria y nunca se escribe.
function comoCandidato(
  f: FilaInterpretada,
  externoId: string,
  idDeMentira: string,
): Candidato {
  return {
    id: idDeMentira,
    externoId,
    estado: 'PENDIENTE',
    participanteId: null,
    origen: ORIGEN_POR_OMISION,
    ...f.datos,
  };
}

function noVacios(xs: Array<string | null | undefined>): string[] {
  return [...new Set(xs.filter((x): x is string => Boolean(x)))];
}

/**
 * Si esa fila es alguien que ya tiene FICHA en este gremio.
 *
 * Los tres en el mismo orden que el cruce de la mesa: documento,
 * correo, celular. El documento primero porque es el que de verdad
 * identifica ---dos personas comparten el correo de la empresa, y el
 * celular de casa--- y porque es lo que se enseña como motivo: decir
 * «por el correo» cuando se la reconoció por la cédula haría dudar de
 * un cruce que es el bueno.
 */
function buscarLaFicha(
  indice: Map<string, { etapa: string; porque: PorQueEsLaMisma }>,
  datos: DatosDeLaFila,
): { etapa: string; porque: PorQueEsLaMisma } | null {
  const intentos: Array<[string | null | undefined, PorQueEsLaMisma]> = [
    [datos.numeroDocumento, 'DOCUMENTO'],
    [datos.correo, 'CORREO'],
    [datos.celular, 'CELULAR'],
  ];
  for (const [valor, porque] of intentos) {
    if (!valor) continue;
    const ficha = indice.get(`${porque}:${valor}`);
    if (ficha) return { etapa: ficha.etapa, porque };
  }
  return null;
}

/// Por qué falló una fila, en una línea y sin filtrar de más.
///
/// El mensaje de Prisma se enseña tal cual: es largo, pero decir
/// «no se pudo guardar» obliga a mirar los registros del servidor
/// para arreglar una fila de un Excel, y quien sube el archivo no
/// tiene acceso a eso.
function porQueFallo(e: unknown): string {
  if (e instanceof Error) return `No se pudo guardar: ${e.message}`;
  return 'No se pudo guardar, y el error no dice por qué.';
}
