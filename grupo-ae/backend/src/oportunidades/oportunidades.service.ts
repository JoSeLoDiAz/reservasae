/** El negocio que se persigue: crearlo, moverlo y sumarlo. */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  EtapaOportunidad,
  Prisma,
  RolAdmin,
  TipoEmbudo,
  type Admin,
  type MotivoCierre,
  type OrigenParticipante,
} from '../../generated/prisma';
import type { Ambito } from '../admin/admin.guard';
import { llevanFichasEn, PUEDEN_LLEVAR_FICHAS } from '../crm/quien-lleva-fichas';
import { PrismaService } from '../prisma/prisma.service';
import {
  ETAPAS_ABIERTAS,
  ETAPAS_CERRADAS,
  estaAbierta,
  probabilidadDe,
  valorPonderado,
} from './embudos';
import {
  narrarAsesor,
  narrarCliente,
  narrarEdicion,
  narrarProbabilidad,
  puedeAtarse,
  puedeBorrarse,
  puedeFacturarse,
  puedePisarProbabilidad,
  resolverProbabilidad,
  revisarMoneda,
  sigueEnPie,
  type Campos,
} from './edicion';
import { limitesDeAgenda } from '../gestiones/agenda';
import { incumple } from './ans';
import { frialdadDe, semaforoDe } from './semaforo';
import { ParametrosService } from '../parametros/parametros.service';
import { senalesDe } from './senales';
import { puedeIr, rotulo, type Hechos } from './escalera';

/// Lo que llega del panel al crear.
export type NuevaOportunidad = {
  embudo: TipoEmbudo;
  titulo: string;
  convenioId: string;
  valor?: number;
  cierreEsperado?: string | null;
  asesorId?: string | null;
  personaId?: string | null;
  empresaId?: string | null;
  origen?: OrigenParticipante;
  campana?: string | null;
  leadId?: string | null;
  etapa?: EtapaOportunidad;
};

export type CambioDeEtapa = {
  a: EtapaOportunidad;
  motivo?: MotivoCierre | null;
  nota?: string | null;
};

/**
 * Lo que se corrige de la ficha sin mover el negocio de etapa.
 *
 * `undefined` es «no lo mandó» y `null` es «bórrelo». Los dos se
 * distinguen en todo el método, y por eso los opcionales llevan el
 * null explícito en el tipo: sin él, quitar la fecha de cierre no
 * se podría pedir.
 */
export type EdicionDeFicha = {
  titulo?: string;
  valor?: number;
  moneda?: string;
  cierreEsperado?: string | null;
  campana?: string | null;
  /// Del portafolio. Null lo quita.
  servicioId?: string | null;
  /// Null la borra; nunca cero, que diría «ninguna».
  cantidad?: number | null;
  /// Lo facturado. Null lo devuelve a «sin facturar»; el cero sí
  /// vale, y dice que se facturó en cero.
  valorFacturado?: number | null;
};

/**
 * Las dos cifras de plata en números, para el panel.
 *
 * Prisma devuelve las columnas Decimal como objetos, y al pasar a
 * JSON salen como texto: «11900000». El panel las suma, y un texto
 * sumado con `+` se concatena en vez de sumarse, sin error y con una
 * cifra absurda en pantalla.
 *
 * Una sola función para todas las respuestas, y no el
 * `valor: Number(o.valor)` que cada método escribía a mano: al llegar
 * `valorFacturado`, cada una de esas copias lo habría dejado salir
 * como texto, y bastaba olvidar una para que la ficha recibiera un
 * número al abrirla y una cadena al guardarla. Null se queda en null:
 * es «sin facturar», no cero.
 */
function enNumeros<
  T extends { valor: Prisma.Decimal; valorFacturado: Prisma.Decimal | null },
>(
  o: T,
): Omit<T, 'valor' | 'valorFacturado'> & {
  valor: number;
  valorFacturado: number | null;
} {
  return {
    ...o,
    valor: Number(o.valor),
    valorFacturado:
      o.valorFacturado === null ? null : Number(o.valorFacturado),
  };
}

export type TraspasoDeAsesor = {
  /// Null la suelta. Se pide escrito, nunca omitido.
  asesorId: string | null;
  nota?: string;
};

export type AjusteDeProbabilidad = {
  /// Null la devuelve a la de su etapa.
  probabilidad: number | null;
  nota?: string;
};

export type AtaduraDeCliente = {
  empresaId?: string;
  personaId?: string;
};

@Injectable()
export class OportunidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
  ) {}

  /**
   * El código legible.
   *
   * `OP-2026-0007`. Se dice por teléfono y se busca, que es todo lo
   * que tiene que hacer. No lo pone la base porque la secuencia
   * lleva el año dentro y eso no cabe en un `autoincrement`.
   *
   * Se cuenta lo del año y se suma uno DENTRO de la transacción que
   * crea la fila: contar fuera abre la ventana para que dos altas
   * simultáneas saquen el mismo número, y el índice único lo
   * rechazaría con un error que no dice nada.
   */
  private async siguienteCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anio = new Date().getFullYear();
    const desde = new Date(anio, 0, 1);
    /**
     * DEL CÓDIGO MÁS ALTO, NO DEL CONTEO.
     *
     * Contaba las creadas en el año y sumaba uno. En cuanto se
     * borraba una que no fuera la última, el conteo bajaba y el
     * siguiente código ya existía: la creación chocaba con el índice
     * único y daba un 500 para siempre, porque el conteo nunca volvía
     * a subir por encima del hueco (auditoría del 18 sep 2026).
     *
     * Se toma el más alto del año por el propio texto: el prefijo es
     * fijo y el número va con ceros a la izquierda, así que el orden
     * alfabético es el numérico mientras no pase de 9.999 en un año.
     * `desde` se conserva para no contar códigos de otro año.
     */
    void desde;
    const prefijo = `OP-${anio}-`;
    const ultima = await tx.oportunidad.findFirst({
      where: { codigo: { startsWith: prefijo } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });
    const n = ultima ? Number(ultima.codigo.slice(prefijo.length)) || 0 : 0;
    return `${prefijo}${String(n + 1).padStart(4, '0')}`;
  }

  /** Los hechos que la escalera necesita para juzgar. */
  private hechosDe(
    o: {
      embudo: TipoEmbudo;
      valor: Prisma.Decimal;
      empresaId: string | null;
      personaId: string | null;
      asesorId: string | null;
    },
    cambio?: CambioDeEtapa,
    valorNuevo?: number,
  ): Hechos {
    return {
      embudo: o.embudo,
      valor: valorNuevo ?? Number(o.valor),
      tieneEmpresa: o.empresaId !== null,
      tienePersona: o.personaId !== null,
      tieneAsesor: o.asesorId !== null,
      motivo: cambio?.motivo ?? null,
      nota: cambio?.nota ?? null,
    };
  }

  /**
   * La oportunidad, o un 404 — y el ámbito dentro del `where`.
   *
   * Dentro y no en un `if` posterior a propósito: buscar por id y
   * después comparar el convenio deja la fila cargada en memoria y
   * responde «no tiene permiso», que ya confirma que existe. Con el
   * filtro dentro, una oportunidad de otra cuenta sencillamente no
   * existe, que es lo que tiene que parecer.
   *
   * Trae los nombres del asesor y del cliente porque casi todo lo
   * que se hace aquí acaba escribiéndolos en la bitácora: «pasó de
   * Ana a Luis» necesita a Ana, y a Ana ya no se la puede preguntar
   * después de haberla reemplazado.
   */
  private async exigirOportunidad(id: string, ambito: Ambito) {
    const o = await this.prisma.oportunidad.findFirst({
      where: { id, convenioId: { in: ambito.convenios } },
      include: {
        asesor: { select: { id: true, nombre: true } },
        empresa: { select: { id: true, razonSocial: true } },
        persona: {
          select: { id: true, primerNombre: true, primerApellido: true },
        },
      },
    });

    if (!o) throw new NotFoundException('No encontramos esa oportunidad.');
    return o;
  }

  /**
   * Los hechos de la oportunidad DESPUÉS del cambio que se pide.
   *
   * Sirve para preguntarle a la escalera si su etapa se sostiene con
   * los datos nuevos. El motivo y la nota salen de lo guardado y no
   * de la petición: si la oportunidad está cerrada, la escalera pide
   * el motivo para dar por buena esa etapa, y el que vale es el que
   * ya tiene escrito.
   */
  private hechosTrasElCambio(
    o: {
      embudo: TipoEmbudo;
      valor: Prisma.Decimal;
      empresaId: string | null;
      personaId: string | null;
      asesorId: string | null;
      motivoCierre: MotivoCierre | null;
      notaCierre: string | null;
    },
    cambios: Partial<Hechos>,
  ): Hechos {
    return {
      embudo: o.embudo,
      valor: Number(o.valor),
      tieneEmpresa: o.empresaId !== null,
      tienePersona: o.personaId !== null,
      tieneAsesor: o.asesorId !== null,
      motivo: o.motivoCierre,
      nota: o.notaCierre,
      ...cambios,
    };
  }

  /**
   * Deja escrito en la bitácora algo que NO fue un cambio de etapa.
   *
   * `de` y `a` van iguales, y eso es lo que significa: la
   * oportunidad no se movió de sitio, le pasó otra cosa. La tabla
   * exige `a`, así que no hay forma de dejarlo vacío, y meterle un
   * enum «SIN_CAMBIO» sería ensuciar el catálogo de etapas —que es
   * el que ordena el tablero— para describir algo que no es una
   * etapa.
   *
   * Toda edición de valor pasa por aquí. Un valor que cambia sin
   * rastro es un pronóstico que nadie puede auditar: al mes
   * siguiente la cifra no cuadra y no hay a quién preguntarle.
   */
  private anotar(
    tx: Prisma.TransactionClient,
    o: { id: string; etapa: EtapaOportunidad },
    nota: string,
    admin: Admin,
  ) {
    return tx.movimientoOportunidad.create({
      data: {
        oportunidadId: o.id,
        de: o.etapa,
        a: o.etapa,
        nota,
        adminId: admin.id,
        actorNombre: admin.nombre,
      },
    });
  }

  /**
   * Que ese asesor pueda de verdad trabajar esta oportunidad.
   *
   * No basta con que exista. Un asesor sin concesión en el convenio
   * no la VE: quedaría con dueño y sin nadie que la mire, y el
   * tablero la contaría como atendida. Y no basta con la concesión:
   * hace falta el rol que lleva captación, porque quien lleva el
   * aula tiene acceso al convenio y no puede escribir aquí.
   *
   * La lista de roles se lee de `quien-lleva-fichas.ts` y no se
   * escribe otra vez: dos listas de quién puede llevar negocios
   * acaban discrepando, y el síntoma es un desplegable que ofrece a
   * alguien que después recibe un 403.
   */
  private async exigirAsesorDelConvenio(asesorId: string, convenioId: string) {
    const asesor = await this.prisma.admin.findFirst({
      where: { id: asesorId, activo: true },
      select: { id: true, nombre: true, rol: true },
    });
    if (!asesor) {
      throw new BadRequestException('Ese asesor no existe o está desactivado.');
    }

    /// El superadmin entra a todo, igual que en el guard.
    if (asesor.rol === RolAdmin.SUPERADMIN) return asesor;

    const concesion = await this.prisma.adminConvenio.findFirst({
      where: {
        adminId: asesorId,
        convenioId,
        rol: { in: PUEDEN_LLEVAR_FICHAS },
      },
      select: { id: true },
    });
    if (!concesion) {
      throw new BadRequestException(
        `${asesor.nombre} no tiene rol comercial en esta línea de negocio. ` +
          'Asígnele el rol en Usuarios o elija otro asesor.',
      );
    }
    return asesor;
  }

  /// Cómo se nombra a una persona en la bitácora.
  private nombreDePersona(p: { primerNombre: string; primerApellido: string }) {
    return `${p.primerNombre} ${p.primerApellido}`;
  }

  async crear(datos: NuevaOportunidad, admin: Admin) {
    /// La probabilidad de arranque sale de Configuración, no del
    /// código: es el mismo número que enseña el tablero.
    const { probabilidad: tabla } = await this.parametros.vigentes();
    const etapa = datos.etapa ?? EtapaOportunidad.CAPTADO;
    const valor = datos.valor ?? 0;

    const veredicto = puedeIr(null, etapa, {
      embudo: datos.embudo,
      valor,
      tieneEmpresa: !!datos.empresaId,
      tienePersona: !!datos.personaId,
      tieneAsesor: !!datos.asesorId,
    });
    if (!veredicto.puede) throw new BadRequestException(veredicto.porque);

    /// La MISMA regla que `asignarAsesor`: rol comercial en esta
    /// línea, o superadmin, y cuenta activa. Crear no la aplicaba, así
    /// que una petición armada a mano podía dejar un negocio a nombre
    /// de cualquiera (auditoría del 18 sep 2026).
    if (datos.asesorId) {
      await this.exigirAsesorDelConvenio(datos.asesorId, datos.convenioId);
    }

    return this.prisma.$transaction(async (tx) => {
      const codigo = await this.siguienteCodigo(tx);
      const creada = await tx.oportunidad.create({
        data: {
          codigo,
          convenioId: datos.convenioId,
          embudo: datos.embudo,
          etapa,
          titulo: datos.titulo.trim(),
          valor: new Prisma.Decimal(valor),
          probabilidad: probabilidadDe(datos.embudo, etapa, tabla),
          cierreEsperado: datos.cierreEsperado
            ? new Date(datos.cierreEsperado)
            : null,
          asesorId: datos.asesorId ?? null,
          personaId: datos.personaId ?? null,
          empresaId: datos.empresaId ?? null,
          /// El canal por el que entró. `NuevaOportunidad` ya lo
          /// declaraba y este `create` no lo escribía, así que se
          /// perdía en silencio y toda oportunidad quedaba con el
          /// valor por omisión de la columna —ASESOR—. Con eso, lo
          /// que capta el formulario público se le atribuía a un
          /// asesor y la pauta pagada no aparecía como origen de
          /// nada, que es justo la pregunta que el resumen por
          /// campaña existe para contestar.
          ///
          /// `undefined` y no `null`: la columna no admite nulos y
          /// dejarlo fuera del `data` es lo que hace que mande el
          /// valor por omisión cuando quien llama no lo sabe.
          origen: datos.origen ?? undefined,
          campana: datos.campana ?? null,
          leadId: datos.leadId ?? null,
        },
      });

      await tx.movimientoOportunidad.create({
        data: {
          oportunidadId: creada.id,
          de: null,
          a: etapa,
          nota: 'Creada',
          adminId: admin.id,
          actorNombre: admin.nombre,
        },
      });

      return creada;
    });
  }

  /**
   * Mover de etapa.
   *
   * Todo lo que decide vive en `escalera.ts` y es puro; aquí solo
   * se lee el estado, se pregunta y se escribe. Esa separación es
   * la que permite probar las compuertas sin base de datos.
   */
  async cambiarEtapa(
    id: string,
    cambio: CambioDeEtapa,
    admin: Admin,
    ambito: Ambito,
  ) {
    const o = await this.exigirOportunidad(id, ambito);
    const { probabilidad: tabla } = await this.parametros.vigentes();

    const veredicto = puedeIr(o.etapa, cambio.a, this.hechosDe(o, cambio));
    if (!veredicto.puede) throw new BadRequestException(veredicto.porque);

    const cierra = !estaAbierta(cambio.a);
    const reabre = !estaAbierta(o.etapa) && estaAbierta(cambio.a);
    const ahora = new Date();

    /**
     * El reloj se para aquí, y una sola vez.
     *
     * `primeraRespuestaEn` se escribe solo si estaba vacío. Es la
     * medición contra la que se juzga al equipo, y una medición que
     * se puede reescribir no mide: sin este `??`, volver a pasar
     * por CONTACTADO tras reabrir borraría el retraso original.
     */
    ///
    /// Y se para en la PRIMERA SALIDA de «Solicitud de negocio», sea a
    /// la etapa que sea. Solo se paraba al pasar a CONTACTADO, y la
    /// escalera deja saltar etapas: un negocio que iba de Solicitud a
    /// Calificado o a Perdido salía de la lista de espera sin dejar
    /// medición, y el incumplimiento del ANS se borraba (auditoría del
    /// 18 sep 2026).
    const marcaRespuesta =
      o.etapa === EtapaOportunidad.CAPTADO &&
      cambio.a !== EtapaOportunidad.CAPTADO &&
      o.primeraRespuestaEn === null;
    const minutos = marcaRespuesta
      ? Math.max(0, Math.round((ahora.getTime() - o.creadoEn.getTime()) / 60_000))
      : null;

    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.oportunidad.update({
        where: { id },
        data: {
          etapa: cambio.a,
          /// La probabilidad la manda la etapa, salvo que alguien la
          /// haya pisado a mano: en ese caso se respeta, que para eso
          /// se pisó.
          ...(o.probabilidadPropia
            ? {}
            : { probabilidad: probabilidadDe(o.embudo, cambio.a, tabla) }),
          ultimoToqueEn: ahora,
          ...(marcaRespuesta
            ? { primeraRespuestaEn: ahora, minutosPrimeraRespuesta: minutos }
            : {}),
          ...(cierra
            ? {
                cerradaEn: ahora,
                motivoCierre: cambio.motivo ?? null,
                notaCierre: cambio.nota ?? null,
              }
            : {}),
          /// Al reabrir se limpia el cierre pero NO el motivo: el
          /// motivo de por qué se había perdido es historia y el
          /// informe del año lo necesita. El movimiento nuevo cuenta
          /// el resto.
          ...(reabre ? { cerradaEn: null } : {}),
        },
      });

      await tx.movimientoOportunidad.create({
        data: {
          oportunidadId: id,
          de: o.etapa,
          a: cambio.a,
          nota: cambio.nota?.trim() || null,
          adminId: admin.id,
          actorNombre: admin.nombre,
        },
      });

      return actualizada;
    });
  }

  /**
   * El tablero: una columna por etapa, con su suma.
   *
   * Devuelve las dos cifras a propósito. `total` es lo que hay
   * sobre la mesa y `ponderado` es lo que un adulto espera cobrar;
   * enseñar solo la primera es como cuentan los CRMs las historias
   * bonitas, y enseñar solo la segunda esconde el tamaño del
   * embudo.
   */
  async tablero(embudo: TipoEmbudo, ambito: Ambito, asesorId?: string) {
    const parametros = await this.parametros.vigentes();
    const donde: Prisma.OportunidadWhereInput = {
      convenioId: { in: ambito.convenios },
      embudo,
      ...(asesorId ? { asesorId } : {}),
    };

    const filas = await this.prisma.oportunidad.findMany({
      where: donde,
      orderBy: [{ cierreEsperado: 'asc' }, { creadoEn: 'desc' }],
      select: {
        id: true,
        codigo: true,
        titulo: true,
        etapa: true,
        valor: true,
        probabilidad: true,
        probabilidadPropia: true,
        cierreEsperado: true,
        creadoEn: true,
        ultimoToqueEn: true,
        primeraRespuestaEn: true,
        minutosPrimeraRespuesta: true,
        campana: true,
        cantidad: true,
        /// Qué se vende, del portafolio. Solo el nombre: es lo que
        /// se lee en la lista, y la ficha entera trae el resto.
        servicio: { select: { nombre: true, unidad: true } },
        /// Lo facturado, para la columna de la lista y los cerrados.
        valorFacturado: true,
        asesor: { select: { id: true, nombre: true } },
        empresa: { select: { id: true, razonSocial: true } },
        persona: {
          select: { id: true, primerNombre: true, primerApellido: true },
        },
        /**
         * Las gestiones de cada tarjeta: el semáforo y el bananeo.
         *
         * Vienen DENTRO de esta consulta y no en una segunda: el
         * tablero se abre ochenta veces al día, y preguntar por cada
         * tarjeta sería una tormenta de N+1 sobre la pantalla más
         * usada del producto.
         *
         * Solo `venceEn` y `hechaEn`. Traerse la nota entera de cada
         * gestión para no leerla engorda la respuesta sin que nadie
         * lo note.
         *
         * SE QUITÓ EL `where: { hechaEn: null }`, y conviene decir
         * por qué: el semáforo solo mira las pendientes, pero el
         * bananeo cuenta justo las CONTRARIAS —las hechas—, así que
         * con el filtro puesto la señal habría contado siempre cero
         * y no se habría encendido nunca. Prisma no deja pedir la
         * misma relación dos veces con dos filtros, y dos consultas
         * sobre esta pantalla es exactamente lo que el párrafo de
         * arriba vino a evitar. El semáforo sigue viendo lo mismo:
         * ahora filtra en memoria.
         */
        gestiones: {
          select: { venceEn: true, hechaEn: true },
        },
        /**
         * Cuándo entró a la etapa en la que está.
         *
         * El último movimiento, y uno solo: es lo que fija desde
         * cuándo se cuentan las gestiones del bananeo. Sin esto, un
         * negocio que lleva ocho meses y cuatro etapas sumaría las
         * gestiones de todas y saldría bananeado por haber avanzado
         * mucho, que es lo contrario de lo que la señal dice.
         */
        movimientos: {
          orderBy: { creadoEn: 'desc' },
          take: 1,
          select: { creadoEn: true },
        },
      },
    });

    /**
     * LA PROBABILIDAD VIGENTE, NO LA QUE QUEDÓ ESCRITA.
     *
     * Cada negocio guarda la probabilidad del día en que entró a su
     * etapa. Si después se cambia en Parámetros, la cabecera de la
     * columna ya decía el número nuevo pero el ponderado seguía
     * sumando el viejo: la pantalla de Parámetros prometía «el
     * Resumen cambia en la siguiente carga» y no era cierto
     * (auditoría del 18 sep 2026). Las pisadas a mano se respetan.
     */
    for (const f of filas) {
      if (!f.probabilidadPropia) f.probabilidad = parametros.probabilidad[embudo][f.etapa];
    }

    /**
     * El instante y los límites del día se fijan UNA vez.
     *
     * Calcularlos por tarjeta, además de gastar, abre la ventana a
     * que dos tarjetas de la misma pantalla caigan a distintos lados
     * de la medianoche: una diría «vence hoy» y la otra «vencida»
     * para el mismo día, en el mismo tablero.
     */
    const ahora = new Date();
    const limites = limitesDeAgenda(ahora);

    const columnas = [...ETAPAS_ABIERTAS[embudo], ...ETAPAS_CERRADAS].map(
      (etapa) => {
        const suyas = filas.filter((f) => f.etapa === etapa);
        const total = suyas.reduce((s, f) => s + Number(f.valor), 0);
        const ponderado = suyas.reduce(
          (s, f) => s + valorPonderado(Number(f.valor), f.probabilidad),
          0,
        );
        return {
          etapa,
          rotulo: rotulo(etapa),
          probabilidad: probabilidadDe(embudo, etapa, parametros.probabilidad),
          cuantas: suyas.length,
          total,
          ponderado,
          oportunidades: suyas.map(({ gestiones, movimientos, ...f }) => ({
            ...f,
            valor: Number(f.valor),
            /// El punto de color: si alguien va a hacer algo con
            /// este negocio. Es lo que hace legible el tablero de un
            /// vistazo, sin leer una tarjeta.
            ///
            /// El filtro de pendientes lo hacía antes la consulta;
            /// ahora se hace aquí porque la relación trae también
            /// las hechas, que son las que cuenta el bananeo.
            semaforo: semaforoDe(
              gestiones.filter((g) => g.hechaEn === null),
              limites,
            ),
            /// Muerto viviente y bananeo. Se calculan, no se
            /// declaran: ver el encabezado de `senales.ts`.
            senales: senalesDe(
              {
                embudo,
                etapa: f.etapa,
                cierreEsperado: f.cierreEsperado,
                /// Sin movimientos, la etapa es la de siempre y se
                /// cuenta desde que nació.
                enLaEtapaDesde: movimientos[0]?.creadoEn ?? f.creadoEn,
                gestionesHechasEnLaEtapa: gestiones.filter(
                  (g) =>
                    g.hechaEn !== null &&
                    g.hechaEn.getTime() >=
                      (movimientos[0]?.creadoEn ?? f.creadoEn).getTime(),
                ).length,
              },
              ahora,
              parametros.bananeo,
            ),
            /// De 0 a 1. El panel decide como se apaga; aqui solo se
            /// dice cuanto frio tiene.
            frialdad: frialdadDe(f.ultimoToqueEn, ahora),
            deQuien:
              f.empresa?.razonSocial ??
              (f.persona
                ? `${f.persona.primerNombre} ${f.persona.primerApellido}`
                : null),
          })),
        };
      },
    );

    const abiertas = filas.filter((f) => estaAbierta(f.etapa));

    return {
      embudo,
      columnas,
      /// El pronóstico solo cuenta lo vivo. Sumar lo ganado aquí
      /// dentro convierte el pronóstico en un informe de resultados
      /// y deja de servir para decidir a qué dedicar la semana.
      pronostico: {
        cuantas: abiertas.length,
        total: abiertas.reduce((s, f) => s + Number(f.valor), 0),
        ponderado: abiertas.reduce(
          (s, f) => s + valorPonderado(Number(f.valor), f.probabilidad),
          0,
        ),
        /// Marcado para que el panel pueda decirlo: estas
        /// probabilidades son un supuesto hasta que haya histórico
        /// propio con el que recalcularlas.
        probabilidadesEstimadas: true,
      },
    };
  }

  /**
   * Las que llevan demasiado sin que nadie las toque.
   *
   * Es el germen del reloj de la fase 2 y ya se puede responder con
   * lo que hay: `ultimoToqueEn` se mueve con cada cambio, así que
   * «lleva N días quieta» es una resta.
   */
  async frias(ambito: Ambito, dias = 7) {
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    return this.prisma.oportunidad.findMany({
      where: {
        convenioId: { in: ambito.convenios },
        etapa: { in: [...ETAPAS_ABIERTAS.EMPRESA, ...ETAPAS_ABIERTAS.PERSONA] },
        ultimoToqueEn: { lt: limite },
      },
      orderBy: { ultimoToqueEn: 'asc' },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        etapa: true,
        embudo: true,
        ultimoToqueEn: true,
        asesor: { select: { nombre: true } },
      },
    });
  }

  /** Sin contestar todavía: lo que mide la promesa de respuesta. */
  async sinRespuesta(ambito: Ambito) {
    const filas = await this.prisma.oportunidad.findMany({
      where: {
        convenioId: { in: ambito.convenios },
        primeraRespuestaEn: null,
        etapa: { in: [EtapaOportunidad.CAPTADO] },
      },
      orderBy: { creadoEn: 'asc' },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        embudo: true,
        creadoEn: true,
        campana: true,
        asesor: { select: { nombre: true } },
      },
    });
    const ahora = Date.now();
    return filas.map((f) => ({
      ...f,
      minutosEsperando: Math.round((ahora - f.creadoEn.getTime()) / 60_000),
    }));
  }

  /**
   * La portada: lo que hay que saber al entrar por la mañana.
   *
   * Una sola consulta y todo se calcula encima. La alternativa
   * —seis consultas agregadas, una por bloque— devuelve cifras que
   * pueden discrepar entre sí si algo cambia entre una y otra, y un
   * tablero cuyas partes no suman al total es un tablero al que
   * nadie vuelve.
   *
   * El volumen lo permite: son las oportunidades de una empresa, no
   * un histórico de años. El día que no quepan, esto se parte en
   * agregados de SQL y se nota aquí, no en las pantallas.
   */
  async resumen(ambito: Ambito) {
    const parametros = await this.parametros.vigentes();
    const todas = await this.prisma.oportunidad.findMany({
      where: { convenioId: { in: ambito.convenios } },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        embudo: true,
        etapa: true,
        valor: true,
        /// Para lo facturado del mes. Solo se lee en las ganadas; el
        /// pronóstico sigue saliendo de `valor`, que es lo cotizado.
        valorFacturado: true,
        probabilidad: true,
        probabilidadPropia: true,
        campana: true,
        creadoEn: true,
        cerradaEn: true,
        ultimoToqueEn: true,
        primeraRespuestaEn: true,
        minutosPrimeraRespuesta: true,
        asesor: { select: { id: true, nombre: true } },
        /// La línea de negocio sale del servicio que se vendió:
        /// EDUCACION o EMPRESAS. No del embudo, que es otra cosa
        /// —empresa o persona— y se venía confundiendo con esta.
        servicio: { select: { id: true, nombre: true, familia: true } },
      },
    });

    /// La probabilidad vigente de Parámetros, salvo las pisadas a
    /// mano: la misma regla que el tablero, para que el pronóstico
    /// de la portada y el del embudo digan lo mismo.
    for (const o of todas) {
      if (!o.probabilidadPropia) o.probabilidad = parametros.probabilidad[o.embudo][o.etapa];
    }

    const ahora = Date.now();
    const abiertas = todas.filter((o) => estaAbierta(o.etapa));

    /// El mes corriente, para lo ganado y lo perdido. Se compara
    /// contra `cerradaEn` y no contra `creadoEn`: lo que cuenta en
    /// el mes es lo que se cerró en el mes, aunque entrara en
    /// febrero.
    const inicioDeMes = new Date();
    inicioDeMes.setDate(1);
    inicioDeMes.setHours(0, 0, 0, 0);
    const delMes = todas.filter(
      (o) => o.cerradaEn !== null && o.cerradaEn >= inicioDeMes,
    );

    const sumar = (filas: typeof todas) =>
      filas.reduce((s, o) => s + Number(o.valor), 0);
    const ponderar = (filas: typeof todas) =>
      filas.reduce(
        (s, o) => s + valorPonderado(Number(o.valor), o.probabilidad),
        0,
      );

    /// Sin contestar: la unica cifra de la portada que exige una
    /// accion hoy y no un analisis el mes que viene.
    const esperando = todas
      .filter(
        (o) => o.primeraRespuestaEn === null && o.etapa === EtapaOportunidad.CAPTADO,
      )
      .map((o) => ({
        id: o.id,
        codigo: o.codigo,
        titulo: o.titulo,
        embudo: o.embudo,
        campana: o.campana,
        asesor: o.asesor,
        minutosEsperando: Math.round((ahora - o.creadoEn.getTime()) / 60_000),
      }))
      .sort((a, b) => b.minutosEsperando - a.minutosEsperando);

    /// Cuanto se tarda de verdad en contestar. La MEDIANA y no el
    /// promedio: un lead olvidado tres dias dispara la media y
    /// esconde que el resto se contesta en minutos.
    const tiempos = todas
      .filter((o) => o.minutosPrimeraRespuesta !== null)
      .map((o) => o.minutosPrimeraRespuesta as number)
      .sort((a, b) => a - b);
    const medianaRespuesta =
      tiempos.length === 0
        ? null
        : tiempos.length % 2 === 1
          ? tiempos[(tiempos.length - 1) / 2]
          : Math.round(
              (tiempos[tiempos.length / 2 - 1] + tiempos[tiempos.length / 2]) / 2,
            );

    /// De donde vienen los negocios, y cuales traen dinero. Es la
    /// pregunta que justifica el gasto en pauta, y la que ningun
    /// CRM contesta bien porque casi ninguno sabe de que campaña
    /// vino cada ficha.
    const porCampana = new Map<
      string,
      { campana: string; cuantas: number; abierto: number; ganado: number }
    >();
    for (const o of todas) {
      const clave = o.campana ?? 'Sin campaña';
      const fila = porCampana.get(clave) ?? {
        campana: clave,
        cuantas: 0,
        abierto: 0,
        ganado: 0,
      };
      fila.cuantas += 1;
      if (estaAbierta(o.etapa)) fila.abierto += Number(o.valor);
      if (o.etapa === EtapaOportunidad.GANADO) fila.ganado += Number(o.valor);
      porCampana.set(clave, fila);
    }

    /// Las que se estan enfriando. Siete dias era el umbral de
    /// arranque y salia de la nada; ahora se ajusta en Configuracion
    /// sin desplegar, que es lo que hacia falta para poder afinarlo
    /// cuando se sepa cuanto dura de verdad una venta aqui.
    const frias = abiertas
      .filter(
        (o) =>
          ahora - o.ultimoToqueEn.getTime() >
          parametros.diasParaFria * 86_400_000,
      )
      .map((o) => ({
        id: o.id,
        codigo: o.codigo,
        titulo: o.titulo,
        etapa: o.etapa,
        valor: Number(o.valor),
        asesor: o.asesor,
        dias: Math.floor((ahora - o.ultimoToqueEn.getTime()) / 86_400_000),
      }))
      .sort((a, b) => b.dias - a.dias);

    const porEtapa = [
      ...ETAPAS_ABIERTAS[TipoEmbudo.EMPRESA],
      ...ETAPAS_ABIERTAS[TipoEmbudo.PERSONA],
    ]
      .filter((e, i, todos) => todos.indexOf(e) === i)
      .map((etapa) => {
        const suyas = abiertas.filter((o) => o.etapa === etapa);
        return {
          etapa,
          rotulo: rotulo(etapa),
          cuantas: suyas.length,
          total: sumar(suyas),
        };
      });

    /**
     * EL DINERO POR LÍNEA DE NEGOCIO: Educación y Empresas.
     *
     * Es la pregunta con la que se abre el tablero —«¿qué aporta
     * cada línea?»— y hasta hoy no se podía contestar: la portada
     * partía por EMBUDO (empresa o persona), que es por dónde entra
     * el negocio y no qué se vende. Un colegio que compra licencias
     * y una empresa que compra Workspace entraban los dos por
     * «empresas» y se sumaban en la misma cifra.
     *
     * La línea sale del servicio del portafolio. Los negocios sin
     * servicio elegido NO se reparten a ojo: se cuentan aparte y con
     * su nombre, porque son justo los que hay que completar para que
     * esta cifra valga.
     */
    const LINEAS = [
      { clave: 'EDUCACION' as const, rotulo: 'Educación' },
      { clave: 'EMPRESAS' as const, rotulo: 'Empresas' },
      { clave: 'SIN_LINEA' as const, rotulo: 'Sin servicio elegido' },
    ];
    const lineaDe = (o: (typeof todas)[number]) =>
      o.servicio?.familia ?? 'SIN_LINEA';
    const porLinea = LINEAS.map(({ clave, rotulo: nombre }) => {
      const suyas = abiertas.filter((o) => lineaDe(o) === clave);
      const ganadasDeLaLinea = delMes.filter(
        (o) => lineaDe(o) === clave && o.etapa === EtapaOportunidad.GANADO,
      );
      return {
        linea: clave,
        rotulo: nombre,
        cuantas: suyas.length,
        total: sumar(suyas),
        ponderado: ponderar(suyas),
        ganadoDelMes: sumar(ganadasDeLaLinea),
      };
    }).filter((l) => l.cuantas > 0 || l.ganadoDelMes > 0);

    /**
     * QUÉ SE ESTÁ VENDIENDO: el mix de productos.
     *
     * Lo abierto por servicio del portafolio, de mayor a menor. Sin
     * los que no llevan servicio: ahí la respuesta no es un producto
     * sino un dato que falta, y eso ya lo dice `porLinea`.
     */
    const porServicio = new Map<
      string,
      { id: string; nombre: string; linea: string; cuantas: number; total: number }
    >();
    for (const o of abiertas) {
      if (!o.servicio) continue;
      const fila = porServicio.get(o.servicio.id) ?? {
        id: o.servicio.id,
        nombre: o.servicio.nombre,
        linea: o.servicio.familia === 'EDUCACION' ? 'Educación' : 'Empresas',
        cuantas: 0,
        total: 0,
      };
      fila.cuantas += 1;
      fila.total += Number(o.valor);
      porServicio.set(o.servicio.id, fila);
    }
    const mixDeProductos = [...porServicio.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const ganadas = delMes.filter((o) => o.etapa === EtapaOportunidad.GANADO);
    const perdidas = delMes.filter((o) => o.etapa === EtapaOportunidad.PERDIDO);

    /**
     * Lo FACTURADO de las ganadas del mes, y cuántas ya tienen factura.
     *
     * Las mismas ganadas que `ganado`, a propósito: las dos cifras se
     * leen una al lado de la otra y la diferencia —lo ganado que
     * todavía no se ha cobrado— solo significa algo si salen del
     * mismo grupo. Contar aquí por fecha de factura sacaría del mes
     * negocios que sí se ganaron en él, y la resta dejaría de cuadrar.
     *
     * Las que no tienen factura NO suman cero: se quedan fuera y se
     * dice cuántas SÍ entraron. «Facturado 8 millones» con 2 de 5
     * facturadas y con 5 de 5 son dos meses muy distintos, y sin el
     * conteo el panel no podría decir cuál de los dos es.
     */
    const conFactura = ganadas.filter((o) => o.valorFacturado !== null);
    const facturado = conFactura.reduce(
      (s, o) => s + Number(o.valorFacturado),
      0,
    );

    return {
      pronostico: {
        cuantas: abiertas.length,
        total: sumar(abiertas),
        ponderado: ponderar(abiertas),
        probabilidadesEstimadas: true,
      },
      mes: {
        ganadas: ganadas.length,
        /// Lo COTIZADO de las ganadas del mes.
        ganado: sumar(ganadas),
        /// Lo FACTURADO de esas mismas ganadas, y cuántas lo tienen.
        facturado,
        facturadas: conFactura.length,
        perdidas: perdidas.length,
        perdido: sumar(perdidas),
        /// De cada cien cerrados este mes, cuantos se ganaron.
        /// Null cuando no hay ninguno: un 0 % con cero cierres
        /// dice algo que no es verdad.
        tasa:
          ganadas.length + perdidas.length === 0
            ? null
            : Math.round((ganadas.length / (ganadas.length + perdidas.length)) * 100),
      },
      reloj: {
        esperando: esperando.length,
        /**
         * Las que YA INCUMPLIERON el compromiso, cada una contra
         * el suyo.
         *
         * Esto decía `minutosEsperando >= 5` para los dos embudos,
         * y ahí había un fallo de bulto: el compromiso de empresas
         * son veinticuatro horas, así que un negocio de empresa
         * salía como incumplido a los seis minutos. La cifra con
         * la que se juzga al equipo venía inflada por un factor de
         * casi trescientos en todo lo que fuera de empresas.
         *
         * El umbral existía —en el panel, para pintar el reloj de
         * color— pero el backend no lo conocía, así que aquí se
         * había escrito un 5 a mano. Ahora sale de `ans.ts`, que
         * es de donde sale también el color.
         */
        incumplidos: esperando.filter((e) =>
          incumple(e.minutosEsperando, e.embudo, parametros.ans),
        ).length,
        /// El nombre viejo, mientras el panel se actualiza. Es el
        /// MISMO número que `incumplidos`, no el de antes: dejar
        /// vivo el cálculo equivocado para no tocar una clave
        /// sería conservar el fallo por comodidad.
        pasadosDeCinco: esperando.filter((e) =>
          incumple(e.minutosEsperando, e.embudo, parametros.ans),
        ).length,
        medianaRespuesta,
        lista: esperando.slice(0, 6),
      },
      porEtapa,
      porLinea,
      mixDeProductos,
      /// Los umbrales con los que se calculó esto. El panel los
      /// enseña al pie: una alerta que no dice contra qué
      /// compromiso salta es una alerta que nadie defiende en una
      /// reunión.
      parametros: {
        ans: parametros.ans,
        diasParaFria: parametros.diasParaFria,
      },
      porCampana: [...porCampana.values()].sort((a, b) => b.abierto - a.abierto),
      frias: frias.slice(0, 6),
      cuantasFrias: frias.length,
    };
  }

  /**
   * A quién se le puede pasar este negocio.
   *
   * La MISMA regla que `exigirAsesorDelConvenio` aplica al guardar
   * —rol que lleva fichas en su línea de negocio, o superadmin, y
   * cuenta activa—, así que el desplegable no ofrece a nadie que
   * luego el servidor rechace. Estaba la regla y faltaba la lista:
   * el mensaje de error pedía «asígnele un asesor» y en todo el panel
   * no había dónde hacerlo.
   */
  async asesoresPosibles(id: string, ambito: Ambito) {
    const o = await this.exigirOportunidad(id, ambito);
    return this.prisma.admin.findMany({
      where: {
        OR: [llevanFichasEn(o.convenioId), { rol: RolAdmin.SUPERADMIN, activo: true }],
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async unaSola(id: string, ambito: Ambito) {
    const o = await this.prisma.oportunidad.findFirst({
      where: { id, convenioId: { in: ambito.convenios } },
      include: {
        asesor: { select: { id: true, nombre: true } },
        empresa: { select: { id: true, razonSocial: true, nit: true } },
        persona: {
          select: {
            id: true,
            primerNombre: true,
            primerApellido: true,
            correo: true,
            celular: true,
          },
        },
        movimientos: { orderBy: { creadoEn: 'desc' } },
        servicio: { select: { id: true, nombre: true, familia: true, unidad: true } },
      },
    });
    if (!o) throw new NotFoundException('No encontramos esa oportunidad.');
    /// Lo cotizado y lo facturado en números; lo facturado sigue en
    /// null si no se ha facturado. Ver `enNumeros`.
    return enNumeros(o);
  }

  // ───────────────────────────────────────────────────────────
  // TRABAJARLAS
  //
  // Hasta aquí el panel solo sabía leer el embudo y mover de
  // etapa. Lo que sigue es lo que hace falta para que una
  // oportunidad se pueda llevar: corregirla, pasarla a otro,
  // ajustar lo que se espera de ella y anotar lo que pasó.
  //
  // Todo lo de aquí abajo termina en la bitácora. No es una
  // formalidad: el pronóstico es una cifra que se defiende en una
  // reunión, y una cifra que cambió sin que nadie sepa cuándo ni
  // por qué no se puede defender.
  // ───────────────────────────────────────────────────────────

  /**
   * Corregir la ficha: título, valor cotizado, lo facturado, moneda,
   * cierre, campaña, servicio y cantidad.
   *
   * La etapa NO se toca aquí —para eso está `cambiarEtapa`—, pero
   * el valor sí, y ahí está lo delicado: la escalera vigila la
   * entrada de cada etapa y el valor se puede editar después. Por
   * eso, antes de guardar, se le vuelve a preguntar si la etapa en
   * la que está se sostiene con los datos nuevos.
   *
   * Lo facturado tiene su propia pregunta, `puedeFacturarse`: solo
   * una ganada lo lleva. No pasa por la escalera porque no mueve
   * ninguna de sus compuertas —el pronóstico y la etapa salen de lo
   * cotizado—, y mezclarlo ahí sería pedirle a la escalera que opine
   * de algo que no mira.
   */
  async actualizar(
    id: string,
    cambios: EdicionDeFicha,
    admin: Admin,
    ambito: Ambito,
  ) {
    const o = await this.exigirOportunidad(id, ambito);

    /// Lo facturado de antes, ya en número o null. Se saca una vez:
    /// lo usan la moneda, la bitácora y la regla de facturar, y
    /// convertirlo en cada sitio es como una de las tres acaba
    /// comparando un Decimal con un número.
    const facturadoAntes =
      o.valorFacturado === null ? null : Number(o.valorFacturado);

    /// La moneda va primero porque su regla mira el valor de antes:
    /// cambiarla sin mandar el valor convertido multiplicaría el
    /// pronóstico, que suma sin convertir. Y lo mismo lo facturado,
    /// que va en la misma moneda.
    const moneda = revisarMoneda(
      {
        moneda: o.moneda,
        valor: Number(o.valor),
        valorFacturado: facturadoAntes,
      },
      {
        moneda: cambios.moneda,
        valor: cambios.valor,
        valorFacturado: cambios.valorFacturado,
      },
    );
    if (!moneda.puede) throw new BadRequestException(moneda.porque);

    /// El servicio se resuelve a su nombre para la bitácora: dentro
    /// de un año «cmu1…» no le dice nada a nadie.
    const nombreDeServicio = (s: { nombre: string; familia: string } | null) =>
      s ? `${s.nombre} (${s.familia === 'EDUCACION' ? 'Educación' : 'Empresas'})` : null;
    const buscarServicio = (idServicio: string) =>
      this.prisma.servicio.findUnique({
        where: { id: idServicio },
        select: { id: true, nombre: true, familia: true },
      });
    const servicioAntes = o.servicioId ? await buscarServicio(o.servicioId) : null;
    let servicioDespues = servicioAntes;
    if (cambios.servicioId !== undefined) {
      servicioDespues =
        cambios.servicioId === null ? null : await buscarServicio(cambios.servicioId);
      if (cambios.servicioId !== null && !servicioDespues) {
        throw new BadRequestException('Ese servicio no está en el portafolio.');
      }
    }

    const antes: Campos = {
      titulo: o.titulo,
      valor: Number(o.valor),
      moneda: o.moneda,
      cierreEsperado: o.cierreEsperado,
      campana: o.campana,
      servicio: nombreDeServicio(servicioAntes),
      cantidad: o.cantidad,
      valorFacturado: facturadoAntes,
    };
    const despues: Campos = {
      titulo:
        cambios.titulo === undefined ? antes.titulo : cambios.titulo.trim(),
      valor: cambios.valor ?? antes.valor,
      moneda: moneda.moneda,
      /// Las tres ramas son las tres cosas distintas que puede
      /// querer decir el panel: no lo mandó, lo borró, lo cambió.
      cierreEsperado:
        cambios.cierreEsperado === undefined
          ? antes.cierreEsperado
          : cambios.cierreEsperado === null
            ? null
            : new Date(cambios.cierreEsperado),
      /// Una campaña en blanco es no tener campaña. Guardar la
      /// cadena vacía partiría el informe de origen en dos filas
      /// que dicen lo mismo: «Sin campaña» y «».
      campana:
        cambios.campana === undefined
          ? antes.campana
          : cambios.campana?.trim() || null,
      servicio: nombreDeServicio(servicioDespues),
      cantidad: cambios.cantidad === undefined ? o.cantidad : cambios.cantidad,
      /// Las mismas tres ramas que el cierre: no lo mandó, lo quitó
      /// —vuelve a «sin facturar»— o lo cambió.
      valorFacturado:
        cambios.valorFacturado === undefined
          ? facturadoAntes
          : cambios.valorFacturado,
    };

    /// El DTO mide el título antes de recortarlo, así que «   ab   »
    /// pasa su longitud mínima y llega aquí valiendo dos letras.
    if (despues.titulo.length < 3) {
      throw new BadRequestException(
        'Escriba qué se le está vendiendo: el título no puede quedar en blanco.',
      );
    }

    /// Solo se le vuelve a preguntar a la escalera cuando cambia el
    /// valor, que es lo único de esta edición que sus compuertas
    /// pesan. Preguntárselo también al corregir una tilde del título
    /// haría que una oportunidad cerrada a la que le falte algo por
    /// una carga vieja no se pudiera ni renombrar, y con un mensaje
    /// que habla de otra cosa.
    if (despues.valor !== antes.valor) {
      const enPie = sigueEnPie(
        o.etapa,
        this.hechosTrasElCambio(o, { valor: despues.valor }),
      );
      if (!enPie.puede) throw new BadRequestException(enPie.porque);
    }

    /// Lo facturado solo se pregunta cuando CAMBIA, por lo mismo que
    /// el valor: el panel manda la ficha entera, y una ganada que se
    /// reabrió conserva lo que se le facturó. Preguntar siempre la
    /// dejaría sin poder corregirle ni el título.
    const facturadoDespues = despues.valorFacturado ?? null;
    if (facturadoDespues !== facturadoAntes) {
      const factura = puedeFacturarse(o.etapa, facturadoDespues);
      if (!factura.puede) throw new BadRequestException(factura.porque);
    }

    const lineas = narrarEdicion(antes, despues);
    /// Un guardado que no cambia nada no escribe nada. El panel
    /// manda la ficha entera cada vez, así que sin esto abrir y
    /// cerrar el formulario dejaría un movimiento, y cien de esos
    /// esconden el que dice que el valor se dobló.
    if (lineas.length === 0) return enNumeros(o);

    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.oportunidad.update({
        where: { id },
        data: {
          titulo: despues.titulo,
          /// El entero que llegó se vuelve Decimal aquí, y en ningún
          /// paso intermedio pasa por un Float: es lo que evita que
          /// un peso de redondeo se multiplique por cada suma del
          /// pronóstico.
          valor: new Prisma.Decimal(despues.valor),
          moneda: despues.moneda,
          cierreEsperado: despues.cierreEsperado,
          campana: despues.campana,
          servicioId: servicioDespues?.id ?? null,
          cantidad: despues.cantidad ?? null,
          /// Del entero al Decimal sin pasar por un Float, como el
          /// valor. Null se escribe null: «sin facturar» es un estado
          /// que hay que poder volver a poner.
          valorFacturado:
            facturadoDespues === null
              ? null
              : new Prisma.Decimal(facturadoDespues),
          /// Editarla cuenta como tocarla, así que sale de la lista
          /// de frías. Corregir una tilde no es trabajarla, pero
          /// distinguir qué edición cuenta y cuál no daría una regla
          /// que nadie podría explicar en voz alta.
          ultimoToqueEn: ahora,
        },
      });

      await this.anotar(tx, o, lineas.join('. '), admin);
      return enNumeros(actualizada);
    });
  }

  /**
   * Pasarle el negocio a otra persona, o soltarlo.
   *
   * El traspaso es la operación que más se hace y la que peor suele
   * quedar registrada: en la mayoría de los CRMs la oportunidad
   * aparece un lunes en la lista de otro y nadie sabe quién la
   * movió. Aquí queda el nombre de quien la tenía, el de quien la
   * recibe y el de quien hizo el cambio, que pueden ser tres
   * personas distintas.
   */
  async asignarAsesor(
    id: string,
    traspaso: TraspasoDeAsesor,
    admin: Admin,
    ambito: Ambito,
  ) {
    const o = await this.exigirOportunidad(id, ambito);
    const nuevo = traspaso.asesorId;

    /// Asignársela a quien ya la tiene no es un traspaso.
    if (nuevo === o.asesorId) return enNumeros(o);

    const entrante =
      nuevo === null
        ? null
        : await this.exigirAsesorDelConvenio(nuevo, o.convenioId);

    /// Soltarla puede dejarla sin cumplir su etapa: de CONTACTADO en
    /// adelante la escalera exige dueño. Se bloquea, por lo mismo
    /// que con el valor: una oportunidad avanzada y sin nadie que
    /// responda por ella es justo lo que el embudo tiene que evitar.
    const enPie = sigueEnPie(
      o.etapa,
      this.hechosTrasElCambio(o, { tieneAsesor: nuevo !== null }),
    );
    if (!enPie.puede) throw new BadRequestException(enPie.porque);

    const cambio = narrarAsesor(
      o.asesor?.nombre ?? null,
      entrante?.nombre ?? null,
    );
    const porque = traspaso.nota?.trim();

    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.oportunidad.update({
        where: { id },
        data: { asesorId: nuevo, ultimoToqueEn: ahora },
      });

      await this.anotar(tx, o, porque ? `${cambio}. ${porque}` : cambio, admin);
      return enNumeros(actualizada);
    });
  }

  /**
   * Pisar la probabilidad a mano, o devolverla a la de su etapa.
   *
   * Existe porque la tabla de `embudos.ts` es un supuesto, y el
   * asesor que habló ayer con el cliente sabe más que la tabla. Sin
   * esto, la única forma de decir «esto no va a pasar» sería mover
   * la oportunidad de etapa, que es mentir sobre dónde está.
   *
   * `probabilidadPropia` queda levantada para que `cambiarEtapa` no
   * le borre en silencio lo que alguien escribió a propósito; con
   * `null` se baja y la cifra vuelve a mandarla la etapa.
   */
  async pisarProbabilidad(
    id: string,
    ajuste: AjusteDeProbabilidad,
    admin: Admin,
    ambito: Ambito,
  ) {
    const o = await this.exigirOportunidad(id, ambito);

    const permiso = puedePisarProbabilidad(o.etapa, ajuste.probabilidad);
    if (!permiso.puede) throw new BadRequestException(permiso.porque);

    const queda = resolverProbabilidad(o.embudo, o.etapa, ajuste.probabilidad);
    /// Ni la cifra ni la bandera cambian: no hay nada que anotar.
    if (
      queda.probabilidad === o.probabilidad &&
      queda.probabilidadPropia === o.probabilidadPropia
    ) {
      return enNumeros(o);
    }

    const cambio = narrarProbabilidad(
      o.probabilidad,
      queda.probabilidad,
      queda.probabilidadPropia,
    );
    const porque = ajuste.nota?.trim();

    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.oportunidad.update({
        where: { id },
        data: { ...queda, ultimoToqueEn: ahora },
      });

      await this.anotar(tx, o, porque ? `${cambio}. ${porque}` : cambio, admin);
      return enNumeros(actualizada);
    });
  }

  /**
   * Atarle a quién se le vende.
   *
   * Muchas nacen sin cliente: un lead entra con un celular y poco
   * más, y la ficha de la empresa o de la persona se crea después.
   * Esta es la costura entre las dos cosas, y la que destraba la
   * compuerta de calificar.
   */
  async atarCliente(
    id: string,
    atadura: AtaduraDeCliente,
    admin: Admin,
    ambito: Ambito,
  ) {
    const o = await this.exigirOportunidad(id, ambito);

    const empresaId = atadura.empresaId?.trim() || null;
    const personaId = atadura.personaId?.trim() || null;
    if (empresaId !== null && personaId !== null) {
      throw new BadRequestException(
        'Una oportunidad se le vende a una empresa o a una persona, no a las dos. Mande solo la que corresponde a su embudo.',
      );
    }

    /// Las dos posibilidades en una sola forma, para no arrastrar
    /// dos variables que pueden ser null y acabar afirmando con un
    /// `as` que esta no lo es.
    const cliente =
      empresaId !== null
        ? { que: 'empresa' as const, id: empresaId }
        : personaId !== null
          ? { que: 'persona' as const, id: personaId }
          : null;
    if (cliente === null) {
      throw new BadRequestException(
        'Diga a quién se le vende: mande la empresa o la persona.',
      );
    }

    const permiso = puedeAtarse(o.embudo, cliente.que);
    if (!permiso.puede) throw new BadRequestException(permiso.porque);

    /// Se comprueba que exista antes de guardar. Dejárselo a la
    /// clave foránea también lo impide, pero el error que devuelve
    /// la base habla de restricciones y de columnas, y quien lo lee
    /// es un asesor.
    let nombre: string;
    let antes: string | null;
    if (cliente.que === 'empresa') {
      const empresa = await this.prisma.empresa.findUnique({
        where: { id: cliente.id },
        select: { razonSocial: true },
      });
      if (!empresa) {
        throw new BadRequestException(
          'Esa empresa no está en el sistema. Créela primero y vuelva a atarla.',
        );
      }
      nombre = empresa.razonSocial;
      antes = o.empresa?.razonSocial ?? null;
    } else {
      const persona = await this.prisma.persona.findUnique({
        where: { id: cliente.id },
        select: { primerNombre: true, primerApellido: true },
      });
      if (!persona) {
        throw new BadRequestException(
          'Esa persona no está en el sistema. Créela primero y vuelva a atarla.',
        );
      }
      nombre = this.nombreDePersona(persona);
      antes = o.persona ? this.nombreDePersona(o.persona) : null;
    }

    /// Atar solo llena un hueco, así que no se le vuelve a preguntar
    /// a la escalera: ninguna compuerta empeora porque un dato que
    /// estaba vacío deje de estarlo.
    const yaEra = cliente.que === 'empresa' ? o.empresaId : o.personaId;
    if (yaEra === cliente.id) return enNumeros(o);

    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.oportunidad.update({
        where: { id },
        data:
          cliente.que === 'empresa'
            ? { empresaId: cliente.id, ultimoToqueEn: ahora }
            : { personaId: cliente.id, ultimoToqueEn: ahora },
      });

      await this.anotar(
        tx,
        o,
        narrarCliente(cliente.que, antes, nombre),
        admin,
      );
      return enNumeros(actualizada);
    });
  }

  /**
   * Dejar una nota suelta, sin agendar nada.
   *
   * Una gestión de tipo TAREA cubre lo que hay que hacer y tiene
   * fecha y dueño. Esto cubre lo otro: lo que se supo. «Me dijo que
   * el presupuesto sale en marzo» no es un compromiso de nadie y no
   * cabe en una agenda, pero es exactamente lo que hay que releer
   * antes de volver a llamar.
   *
   * Va a `movimientos_oportunidad` y no a `gestiones` a propósito:
   * la bitácora es la línea de tiempo que se lee de arriba abajo
   * para entender un negocio, y una nota que viviera en otra tabla
   * saldría fuera de esa línea o obligaría a mezclar dos consultas
   * en cada ficha.
   */
  async dejarNota(id: string, texto: string, admin: Admin, ambito: Ambito) {
    const o = await this.exigirOportunidad(id, ambito);

    const nota = texto.trim();
    if (nota.length < 2) {
      throw new BadRequestException('Escriba la nota antes de guardarla.');
    }

    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.oportunidad.update({
        where: { id },
        /// Anotar sí es trabajarla: alguien habló con el cliente. Por
        /// eso sale de la lista de frías, que es justo lo que esa
        /// lista quiere decir.
        data: { ultimoToqueEn: ahora },
      });

      return this.anotar(tx, o, nota, admin);
    });
  }

  /**
   * Borrar de verdad, que aquí es la excepción.
   *
   * La regla de la casa es que nada se borra: se oculta, se cancela
   * o se cierra, y la fila se queda. Un negocio que se cayó se
   * cierra como PERDIDO con su motivo, porque ese motivo es todo el
   * aprendizaje que va a quedar del año.
   *
   * La excepción es la fila que nunca fue un negocio: el formulario
   * mandado dos veces, el título escrito mal, la prueba de alguien.
   * Cerrar eso como perdido no guarda ningún aprendizaje —ensucia el
   * informe de pérdidas y hunde la tasa de cierre, que son dos de
   * las cifras que se miran para decidir—. Quién puede y quién no lo
   * decide `puedeBorrarse`, y su comentario explica las tres
   * condiciones.
   *
   * El borrado se lleva por cascada los movimientos, y eso está bien
   * precisamente aquí: la única fila que se cumple las condiciones
   * es la que solo tiene el movimiento de su propia alta. No hay
   * historia que perder porque no llegó a haberla.
   */
  async borrar(id: string, ambito: Ambito) {
    const o = await this.exigirOportunidad(id, ambito);

    const [gestiones, movimientos] = await Promise.all([
      this.prisma.gestion.count({ where: { oportunidadId: id } }),
      this.prisma.movimientoOportunidad.count({ where: { oportunidadId: id } }),
    ]);

    const permiso = puedeBorrarse({ etapa: o.etapa, gestiones, movimientos });
    if (!permiso.puede) throw new BadRequestException(permiso.porque);

    await this.prisma.oportunidad.delete({ where: { id } });
    /// Se devuelve el código y no un 204 vacío: el panel enseña
    /// «se borró OP-2026-0007», y quien lo lee puede comprobar que
    /// era la que quería borrar y no la de al lado.
    return { borrada: true, codigo: o.codigo };
  }
}
