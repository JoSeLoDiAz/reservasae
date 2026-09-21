"use client";

/** La portada: qué hay que hacer hoy y cómo va el mes. */

/// Aquí vivía el resumen de ocupación de Convoca: cupos
/// comprometidos con el SENA, cobertura territorial en un mapa y
/// reservas de aliados. Nada de eso existe en un CRM de ventas, así
/// que la pantalla se rehizo entera en vez de traducirle los
/// rótulos.
///
/// **Siete bloques y en este orden**, que no es decorativo:
///
///  1. Lo que exige una acción HOY —quién está esperando respuesta—.
///  2. El dinero: lo abierto y lo esperado, y cómo va el mes —lo
///     ganado, lo facturado de eso y la efectividad—.
///  3. El mes contra su meta: cuánto falta y cuánto sale por día.
///  4. Qué aporta cada línea de negocio y qué se está vendiendo.
///  5. Dónde está atascado el embudo.
///  6. Qué campaña trae negocio, y qué se está enfriando.
///  7. La tendencia: ganadas contra perdidas en los últimos doce
///     meses.
///
/// El orden es de urgencia, no de importancia. Lo de arriba se mira
/// ahora; lo de abajo, una vez al día. La tendencia va la última
/// porque es lo que menos cambia de un día para otro: un mes nuevo
/// le mueve una columna de doce.
///
/// LA FORMA es una CABINA, no una página. Seis bandas a sangre que
/// se tocan y a las que separa una regla de 1 px; ni una tarjeta
/// flotando, ni una cabecera teñida, ni una sombra. El aire se gana
/// quitando alto muerto, no metiendo bloques: la primera fila de
/// datos se ve sin desplazar en 1440x900.
///
/// CADA INFORME SE PIDE Y SE CAE POR SEPARADO. El resumen, el
/// avance contra la meta y la serie de doce meses son tres
/// peticiones a tres servicios distintos, y cualquiera puede fallar
/// sola —un permiso, un despliegue a medias, un servicio que tarda—.
/// Si una falla, su banda lo dice en letra pequeña y ofrece
/// reintentar SOLO esa; las otras se pintan igual. Una portada que
/// se queda en blanco porque le falló la gráfica de abajo es una
/// portada que nadie vuelve a abrir.
///
/// Y una sola cifra puede ser la más grande de la pantalla: la
/// plata que hay sobre la mesa. Nunca un conteo, nunca un
/// porcentaje. Si se entrecierran los ojos hasta que la pantalla se
/// desenfoca, lo primero que se ve tiene que ser dinero.

import { useCallback, useEffect, useState } from "react";

import { Aviso } from "@/components/admin/marco-admin";
import { Cargando } from "@/components/admin/piezas";
import { Apoyo, Banda } from "@/components/admin/piezas-de-venta";
import { ParaHoy } from "@/components/admin/para-hoy";
import {
  Codigo,
  Dinero,
  Etapa,
  Porcentaje,
  Puerta,
  Reloj,
  relojEnTexto,
  Rotulo,
} from "@/components/admin/datos-del-negocio";
import { n, SERIE } from "@/components/admin/graficos";
import { ErrorApi } from "@/lib/api";
import {
  informesApi,
  ROTULO_RITMO,
  type Avance,
  type AvanceContraLaMeta,
  type EmbudoEnElTiempo,
  type MesDelEmbudo,
  type Ritmo,
} from "@/lib/informes-api";
import {
  enPesos,
  oportunidadesApi,
  type ResumenDeVentas,
} from "@/lib/oportunidades-api";

/// Una semana quieta es el umbral de «se está enfriando», y el
/// reloj mide minutos: aquí se traduce una sola vez.
const MINUTOS_POR_DIA = 1_440;

/// Lo que se sabe de una petición: lo que trajo, o por qué no.
/// `datos` puede seguir lleno con `error` puesto —un reintento que
/// falla después de haber cargado bien—, y entonces manda el error:
/// enseñar la cifra vieja como si fuera de ahora es peor que decir
/// que no llegó.
type Carga<T> = {
  datos: T | null;
  error: string | null;
  recargar: () => void;
};

/**
 * Una petición con su propio fallo.
 *
 * Es el `cargar` que esta pantalla tenía para el resumen, sacado a
 * un gancho para poder tener tres sin copiarlo tres veces. `traer`
 * tiene que ser estable —una función del módulo, no una flecha
 * escrita en el render—, o el efecto se dispararía en cada pintada.
 */
function useCarga<T>(traer: () => Promise<T>, siFalla: string): Carga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  /// Todo lo que escribe va DESPUÉS del `await`. Limpiar el error
  /// antes —como hacía el `cargar` de antes— era un `setState`
  /// síncrono dentro del efecto; ahora eso lo hace solo `recargar`,
  /// que lo dispara una persona y no un efecto.
  const cargar = useCallback(async () => {
    try {
      const llegado = await traer();
      setDatos(llegado);
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : siFalla);
    }
  }, [traer, siFalla]);

  /// La regla `set-state-in-effect` se apaga en esta línea sola, con
  /// el mismo motivo que en el embudo: aquí nada se escribe de forma
  /// síncrona, pero la regla no sigue el `async` y marca cualquier
  /// setter alcanzable.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const recargar = useCallback(() => {
    setError(null);
    void cargar();
  }, [cargar]);

  return { datos, error, recargar };
}

/// Fuera del componente para que sean la MISMA función en cada
/// pintada: `useCarga` las tiene en sus dependencias.
const traerAvance = () => informesApi.avance();
const traerSerie = () => informesApi.embudoEnElTiempo();

export default function Portada() {
  const resumen = useCarga(
    oportunidadesApi.resumen,
    "No pudimos traer el resumen. Vuelva a intentarlo.",
  );
  /// El «qué» de estos dos lo dice su banda; esto es solo el
  /// porqué cuando no llegó ni un mensaje del servidor.
  const avance = useCarga(
    traerAvance,
    "El servidor no contestó. El resto del resumen no depende de esto.",
  );
  const serie = useCarga(
    traerSerie,
    "El servidor no contestó. El resto del resumen no depende de esto.",
  );

  /// Con error, lo que hubiera llegado antes no se enseña: ver la
  /// nota de `Carga`.
  const datos = resumen.error ? null : resumen.datos;

  /// Mientras el resumen no llega, la pantalla entera espera: es
  /// lo que pinta casi todas las bandas, y sacar la meta y la
  /// gráfica solas arriba, para que luego las empuje hacia abajo
  /// todo lo demás, es un salto que se lee como un fallo.
  if (!resumen.datos && !resumen.error) {
    return (
      <Banda sinRegla crece>
        <Cargando que="Trayendo el resumen…" />
      </Banda>
    );
  }

  return (
    /// `grow` para que la última banda pueda comerse el alto que
    /// sobre. Sin él, aprovechar mejor el ancho deja un palmo de
    /// fondo gris debajo de la última banda, y el marco de esta
    /// pantalla deja de parecerse al de las otras catorce.
    <div className="flex w-full grow flex-col">
      {/* Si el resumen falló, el aviso ocupa su sitio y la meta y
          la tendencia se pintan igual: vienen de otro servicio y no
          tienen por qué caerse con él. Era un `return` temprano que
          dejaba la pantalla entera en un renglón de error. */}
      {!datos ? (
        <Banda>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Aviso tipo="error">{resumen.error}</Aviso>
            <Reintentar alPulsar={resumen.recargar} />
          </div>
        </Banda>
      ) : (
        <>
          <Espera reloj={datos.reloj} parametros={datos.parametros} />
          {/* Qué hacer hoy: la agenda del equipo y lo que nadie tiene
              agendado. Va justo debajo de lo que espera respuesta. */}
          <ParaHoy />
          <FranjaDeDinero datos={datos} />
        </>
      )}

      <MetaDelMes carga={avance} />

      {/*
        LOS TRES BLOQUES DE ABAJO SON UNA SOLA BANDA, Y A 1920 SON
        TRES COLUMNAS.

        «Dónde está el dinero» era una banda para él solo: cinco
        renglones topados en 720 px dentro de una franja de 1636, o
        sea 916 px de blanco al canto derecho. Y la de abajo ya
        repartía bien su ancho entre dos bloques. Cuando la lista
        es corta —cinco etapas, y siempre serán cinco— el sobrante
        no se gasta abriendo columna: se dedica a una segunda
        región útil, que aquí ya existía y estaba debajo.

        El orden se conserva y no es decorativo: dónde está
        atascado, qué campaña lo trae, qué se está enfriando. En
        vertical se leía de arriba abajo; en tres columnas se lee
        de izquierda a derecha, que es el mismo orden.

        380 · lo que sobre · 380: la del medio es la única que
        crece porque es la única con una tabla dentro, y su ancho
        natural son 806 px. Las otras dos son listas de un dato y
        su cifra.

        Y es consulta de CONTENEDOR: la barra lateral se pliega y
        la banda gana 180 px sin que la ventana cambie de tamaño.
        Lo que decide cuántas columnas caben es lo ancha que es la
        banda, que es lo que mide el ojo.
      */}
      {/*
        LA LÍNEA DE NEGOCIO, ANTES QUE LA ETAPA.

        La pregunta con la que la dirección abre el tablero es «¿qué
        aporta Educación y qué aporta Empresas?», y hasta hoy esta
        pantalla no la contestaba: partía por embudo, que es por
        dónde entra el negocio, no qué se vende.
      */}
      {datos && (
        <>
          <Banda sinRegla className="@container">
            <div className="grid gap-6 @[900px]:grid-cols-2">
              <Lineas porLinea={datos.porLinea} />
              <Mix filas={datos.mixDeProductos} />
            </div>
          </Banda>

          {/* Esta era la última y se comía el alto sobrante
              (`crece`, sin regla). Ahora debajo va la tendencia:
              lleva su regla, y el `crece` pasó a la de abajo. */}
          <Banda className="@container">
            <div className="grid gap-6 @[768px]:grid-cols-2 @[1600px]:grid-cols-[380px_minmax(0,1fr)_380px]">
              <Embudo porEtapa={datos.porEtapa} />
              <Campanas filas={datos.porCampana} />
              <Frias
                frias={datos.frias}
                cuantas={datos.cuantasFrias}
                dias={datos.parametros.diasParaFria}
              />
            </div>
          </Banda>
        </>
      )}

      <UltimosDoceMeses carga={serie} />
    </div>
  );
}

/// El botón de reintentar de una banda que falló. Pequeño y sin
/// rojo, el mismo del embudo: el rojo de este panel dice que
/// alguien lleva esperando respuesta, y un servicio caído no es eso.
function Reintentar({ alPulsar }: { alPulsar: () => void }) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      className="secundario rounded-xs border border-borde px-2 py-0.5 text-texto transition-colors hover:bg-superficie-alterna focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-campo-foco"
    >
      Reintentar
    </button>
  );
}

/// Una banda cuyo informe no llegó: dice cuál y deja reintentarlo
/// solo a él. En letra pequeña, como en el embudo, y sin
/// disfrazarse nunca de «no hay datos»: no llegar y estar vacío
/// son dos cosas distintas y se dicen distinto.
function BandaQueFallo({
  titulo,
  que,
  error,
  alReintentar,
  ultima,
}: {
  titulo: string;
  que: string;
  error: string;
  alReintentar: () => void;
  ultima?: boolean;
}) {
  return (
    <Banda sinRegla={ultima} crece={ultima}>
      <Rotulo titulo>{titulo}</Rotulo>
      <div
        role="status"
        className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"
      >
        <p className="secundario">
          <span className="text-texto">{que}</span> {error}
        </p>
        <Reintentar alPulsar={alReintentar} />
      </div>
    </Banda>
  );
}

/**
 * Arriba del dinero, siempre.
 *
 * Contestar dentro de los primeros cinco minutos multiplica por 21 la
 * probabilidad de calificar frente a esperar media hora, y el
 * promedio del mercado son 42 horas. Es la única cifra de esta
 * pantalla que se puede arreglar en el minuto siguiente a leerla.
 *
 * Era una tarjeta teñida entera de rosa con una curva de 14 px para
 * decir una cosa que cabe en un renglón. Ahora es un renglón, y lo
 * único caliente de la pantalla es el reloj de cada fila: el color
 * cálido dejó de ser decoración y pasó a significar «alguien está
 * esperando» y nada más.
 */
function Espera({
  reloj,
  parametros,
}: {
  reloj: ResumenDeVentas["reloj"];
  parametros: ResumenDeVentas["parametros"];
}) {
  /// `incumplidos` y no `pasadosDeCinco`: el nombre viejo
  /// contaba cinco minutos para los DOS embudos, y el compromiso
  /// de empresas es un día. El backend ya manda los dos con el
  /// mismo número —el bueno—; el nombre viejo se va en cuanto
  /// nadie lo lea.
  const hayUrgentes = reloj.incumplidos > 0;

  const mediana = reloj.medianaRespuesta !== null && (
    <span className="shrink-0 text-[0.71875rem] text-texto-suave">
      Mediana de respuesta:{" "}
      <span className="tabular-nums text-texto">
        {relojEnTexto(reloj.medianaRespuesta)}
      </span>
    </span>
  );

  if (reloj.esperando === 0) {
    return (
      <Banda>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[0.8125rem] text-texto">
            Nadie esperando.{" "}
            <span className="text-texto-suave">
              Todo lo que entró tiene una primera respuesta.
            </span>
          </p>
          {mediana}
        </div>
      </Banda>
    );
  }

  return (
    <Banda>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[0.8125rem] text-texto">
          <span className="font-semibold tabular-nums text-error">
            {reloj.esperando}
          </span>{" "}
          sin primera respuesta
          <span className="text-texto-suave">
            {" · "}
            {hayUrgentes
              ? `${reloj.incumplidos} pasan del tiempo comprometido`
              : "todas dentro del tiempo comprometido"}
          </span>
        </p>
        {/* Contra qué se cuenta. Sin esto, «pasan del tiempo
            comprometido» obliga a creer un número que la pantalla no
            dice, y que ahora además se puede cambiar. */}
        <span className="shrink-0 text-[0.71875rem] text-texto-suave">
          Compromiso: {relojEnTexto(parametros.ans.PERSONA)} en personas ·{" "}
          {relojEnTexto(parametros.ans.EMPRESA)} en empresas
        </span>
        {mediana}
      </div>

      <ul className="mt-3 flex flex-col">
        {reloj.lista.map((e) => (
          <li
            key={e.id}
            className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 first:border-0 first:pt-0"
          >
            {/* En el teléfono no caben código, título y puerta en un renglón:
                se truncaba a «Googl…». Ahí la fila se parte, y la puerta va
                en un solo bloque para que el «·» no quede suelto. */}
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 sm:flex-nowrap">
              <Codigo>{e.codigo}</Codigo>
              <span className="min-w-0 max-w-full truncate text-[0.8125rem] text-texto">
                {e.titulo}
              </span>
              {e.campana && (
                <span className="min-w-0 max-w-full truncate">
                  <Puerta campana={e.campana} />
                </span>
              )}
            </span>
            {/* Sin primera respuesta: pasado el umbral no es «tarde»,
                es una alarma. Es el único rojo de la pantalla. */}
            <Reloj minutos={e.minutosEsperando} embudo={e.embudo} vencido />
          </li>
        ))}
      </ul>
    </Banda>
  );
}

/// Las dos cifras del embudo y las tres del mes, en una franja.
/// Cinco números sin cinco marcos: la separación la hacen los
/// espacios, no los bordes.
///
/// «Sobre la mesa» es la cifra de portada de esta pantalla —34 px,
/// y ninguna otra la iguala—. Las otras cuatro van a 20: entre la
/// primera y el pie de la última hay tres veces de diferencia, que
/// es lo que separa una pantalla con jerarquía de una plana.
///
/// LAS COLUMNAS LAS DECIDE LA BANDA, no la ventana. Eran cuatro a
/// partir de `lg`; con la quinta, a 1024 px cada una se quedaba en
/// 170 y la cifra de portada se montaba sobre la de al lado. Ahora
/// son dos —y «Ganado» y «Facturado» caen en el mismo renglón, que
/// es donde se comparan— hasta que la banda mide 1180, y entonces
/// las cinco en fila, con la primera más ancha porque lleva los 34
/// px.
function FranjaDeDinero({ datos }: { datos: ResumenDeVentas }) {
  const { pronostico, mes } = datos;

  /// Mientras el backend no mande las dos cifras de lo facturado
  /// —un despliegue a medias, el panel nuevo contra el servidor
  /// viejo—, se escribe la raya. Sin esta guarda la nota diría
  /// «undefined de 3», que es peor que no decir nada.
  const hayFacturado =
    typeof mes.facturado === "number" && typeof mes.facturadas === "number";

  return (
    <Banda className="@container">
      <div className="grid gap-x-8 gap-y-4 @[520px]:grid-cols-2 @[1180px]:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
        <div>
          <Rotulo>Valor cotizado en curso</Rotulo>
          <p className="mt-1">
            <Dinero valor={pronostico.total} portada />
          </p>
          <Pie>{pronostico.cuantas} negocios abiertos</Pie>
        </div>

        <div>
          <Rotulo>Pronóstico</Rotulo>
          <p className="mt-1">
            {/* Apagado mientras las probabilidades sean del modelo y
                no de nuestros cierres: el gris dice «esto es un
                supuesto» sin obligar a leer la nota al pie. */}
            <Dinero
              valor={pronostico.ponderado}
              tamano="columna"
              supuesto={pronostico.probabilidadesEstimadas}
            />
          </p>
          <Pie>con probabilidades estimadas</Pie>
        </div>

        <div>
          <Rotulo>Ganado este mes</Rotulo>
          <p className="mt-1">
            <Dinero valor={mes.ganado} tamano="columna" ganado />
          </p>
          {/* «a valor cotizado» porque ahora tiene al lado lo
              facturado, y sin decirlo parecen la misma plata contada
              dos veces con resultados distintos. */}
          <Pie>
            {mes.ganadas === 1 ? "1 negocio" : `${mes.ganadas} negocios`}, a
            valor cotizado
          </Pie>
        </div>

        {/*
          LO FACTURADO DE LO GANADO.

          Se gana al cerrar y se factura después, y la diferencia es
          plata que todavía no ha entrado. Va al lado de «Ganado» y
          no lejos porque es la pregunta que se hace al verlo: de
          eso, ¿cuánto ya se facturó?

          Sin el verde de «Ganado», a propósito: el verde de este
          panel es lo ganado, y facturar no es cobrar. La nota dice
          cuántos de los ganados tienen factura; con cero ganados no
          hay de qué hablar y se escribe la raya.
        */}
        <div>
          <Rotulo>Facturado este mes</Rotulo>
          <p className="mt-1">
            <Dinero
              valor={hayFacturado ? mes.facturado : null}
              tamano="columna"
            />
          </p>
          <Pie>
            {!hayFacturado || mes.ganadas === 0
              ? "—"
              : `${mes.facturadas} de ${mes.ganadas} ${
                  mes.ganadas === 1 ? "ganado ya facturado" : "ganados ya facturados"
                }`}
          </Pie>
        </div>

        <div>
          <Rotulo>Efectividad del mes</Rotulo>
          <p className="mt-1">
            {/* Esta sí está medida sobre cierres reales: va en el
                color del dato, no en el del supuesto. */}
            <Porcentaje valor={mes.tasa} tamano="columna" />
          </p>
          <Pie>
            {mes.tasa === null
              ? "todavía no se cierra nada este mes"
              : `${mes.ganadas} ${mes.ganadas === 1 ? "ganado" : "ganados"} de ${mes.ganadas + mes.perdidas} ${mes.ganadas + mes.perdidas === 1 ? "cerrado" : "cerrados"}`}
          </Pie>
        </div>
      </div>
    </Banda>
  );
}

function Pie({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[0.71875rem] leading-[1.45] text-texto-suave">
      {children}
    </p>
  );
}

/**
 * DE DÓNDE SALE LA META, dicho en un solo sitio.
 *
 * Hoy el panel NO tiene pantalla para fijarla: el servicio existe
 * (`POST /admin/metas`, con `reportes` en escritura, que tienen el
 * líder comercial y el de configuración) y la pantalla no. Se dice
 * tal cual en vez de mandar a buscar un menú que no está. El día que
 * exista la pantalla, se cambia esta frase y se apunta ahí.
 */
const DONDE_SE_FIJA_LA_META =
  "La fija un líder comercial o de configuración, que son los roles con «Informes de gestión» en escritura. " +
  "El panel todavía no tiene pantalla para cargarla: mientras llega, se carga directamente en el servicio de metas del CRM.";

/**
 * EL COLOR DEL RITMO, y por qué casi no hay.
 *
 * En esta pantalla el rojo es del reloj sin contestar y el ámbar es
 * del negocio que se enfría, y los dos ya dicen «no hay un tercer
 * sitio donde salga». Pintar «Atrasado» de ámbar le quitaría el
 * significado al de las frías. Así que el único color es el verde de
 * CUMPLIDA —que es lo ganado, lo mismo que significa en el resto del
 * panel—, y el atraso lo dicen la palabra, en el peso del estado, y
 * la raya de lo esperado por delante de la barra.
 */
const TINTA_DEL_RITMO: Record<Ritmo, string> = {
  SIN_META: "text-texto-suave",
  CUMPLIDA: "text-exito",
  EN_RITMO: "text-texto",
  ATRASADO: "text-titulo",
  INCUMPLIDA: "text-titulo",
};

/// Cuántos asesores caben en la lista de la derecha. Es para
/// decidir a quién acompañar esta semana, no un escalafón.
const ASESORES_A_LA_VISTA = 5;

/**
 * La meta del mes: la cifra que DIRIGE.
 *
 * La franja de arriba informa —«llevamos 40 millones»—; esta dice
 * qué hacer con eso: «llevamos 40 de 60, quedan seis días hábiles y
 * salen a 3,4 millones por día». La primera se mira; la segunda se
 * obedece.
 *
 * Sale del informe de avance (`/admin/informes/avance`), que cuenta
 * lo ganado por fecha de cierre y a valor cotizado: la misma regla
 * que el «Ganado este mes» de la franja, así que las dos cifras
 * cuadran. Si alguna vez no cuadran, una de las dos está mal.
 *
 * Sin meta cargada NO se inventa nada: ni un 0 %, que acusaría a
 * quien no tenía nada que cumplir, ni un 100 %. Se dice que no hay y
 * de dónde sale.
 */
function MetaDelMes({ carga }: { carga: Carga<AvanceContraLaMeta> }) {
  if (carga.error) {
    return (
      <BandaQueFallo
        titulo="Meta del mes"
        que="No pudimos traer el avance contra la meta."
        error={carga.error}
        alReintentar={carga.recargar}
      />
    );
  }

  if (!carga.datos) {
    return (
      <Banda>
        <Rotulo titulo>Meta del mes</Rotulo>
        <p role="status" className="secundario mt-2">
          Midiendo el avance contra la meta…
        </p>
      </Banda>
    );
  }

  const { periodo, equipo, asesores } = carga.datos;
  /// Solo quien tiene meta. El informe trae también a quien ganó
  /// sin tenerla —y la fila «Sin asesor»—, y en una lista de «a
  /// quién le falta» esas filas no tienen nada que decir.
  const conMeta = asesores.filter((a) => a.meta > 0);

  return (
    <Banda className="@container">
      <div className="grid gap-x-10 gap-y-5 @[1100px]:grid-cols-2">
        <section className="min-w-0">
          <Rotulo titulo>Meta del mes</Rotulo>
          <Apoyo>
            {periodo.rotulo}. Lo ganado, a valor cotizado, contra la meta del
            equipo.
          </Apoyo>

          {equipo.ritmo === "SIN_META" ? (
            <SinMeta sumaDeLasIndividuales={equipo.sumaDeLasIndividuales} />
          ) : (
            <AvanceDelEquipo equipo={equipo} />
          )}
        </section>

        {conMeta.length > 0 && <PorAsesor asesores={conMeta} />}
      </div>
    </Banda>
  );
}

function SinMeta({ sumaDeLasIndividuales }: { sumaDeLasIndividuales: number }) {
  return (
    <div className="mt-3 max-w-[720px]">
      <p className="text-[0.8125rem] text-texto">
        {sumaDeLasIndividuales > 0 ? (
          /// Las de cada quien están y la del equipo no: se dice
          /// lo que suman, que es un dato, y NO se usa como meta
          /// del equipo, que sería inventarla.
          <>
            Aún no hay meta del equipo para este mes.{" "}
            <span className="text-texto-suave">
              Las metas individuales suman{" "}
              <Dinero valor={sumaDeLasIndividuales} />.
            </span>
          </>
        ) : (
          "Aún no hay meta para este mes."
        )}
      </p>
      <p className="secundario mt-1">{DONDE_SE_FIJA_LA_META}</p>
    </div>
  );
}

function AvanceDelEquipo({
  equipo,
}: {
  equipo: AvanceContraLaMeta["equipo"];
}) {
  const quedan = equipo.diasHabilesRestantes;

  return (
    <div className="mt-3 max-w-[720px]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-baseline gap-2">
          <Dinero valor={equipo.ganado} tamano="columna" ganado />
          <span className="secundario">de</span>
          <Dinero valor={equipo.meta} tamano="columna" />
        </span>
        <span className="text-[0.8125rem] text-texto-suave">
          <Porcentaje valor={equipo.porcentaje} />
        </span>
        <span className={`estado ${TINTA_DEL_RITMO[equipo.ritmo]}`}>
          {ROTULO_RITMO[equipo.ritmo]}
        </span>
      </div>

      <BarraDeMeta avance={equipo} />

      <p className="secundario mt-2">
        {equipo.ritmo === "CUMPLIDA" ? (
          equipo.excedente > 0 ? (
            <>
              Va <Dinero valor={equipo.excedente} /> por encima de la meta.
            </>
          ) : (
            "Justo en la meta."
          )
        ) : equipo.ritmo === "INCUMPLIDA" ? (
          <>
            El mes cerró <Dinero valor={equipo.falta} /> por debajo.
          </>
        ) : equipo.faltaPorDiaHabil === null ? (
          <>
            Faltan <Dinero valor={equipo.falta} /> y ya no quedan días
            hábiles.
          </>
        ) : (
          <>
            Faltan <Dinero valor={equipo.falta} />: {quedan === 1
              ? "queda 1 día hábil, hoy,"
              : `quedan ${quedan} días hábiles contando hoy,`}{" "}
            a <Dinero valor={equipo.faltaPorDiaHabil} /> por día.
          </>
        )}
        {!equipo.mesCerrado && equipo.esperado > 0 && (
          <>
            {" "}
            La raya marca lo que tocaría llevar a estas alturas:{" "}
            <Dinero valor={equipo.esperado} />.
          </>
        )}
      </p>

      <p className="micro mt-1">
        {equipo.sinDescontarFestivos &&
          "Días hábiles de lunes a viernes, sin descontar festivos."}
        {/* Al lado de la del equipo y no en su lugar: no tienen
            por qué coincidir, pero si la suma se queda corta es que
            a alguien le falta la suya. */}
        {equipo.sumaDeLasIndividuales > 0 && (
          <>
            {" "}
            Las metas individuales suman{" "}
            <Dinero valor={equipo.sumaDeLasIndividuales} />.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * La barra de la meta, con la raya de lo esperado encima.
 *
 * La barra sola dice «llevamos el 40 %» y eso no dice si es poco: el
 * día 5 es mucho y el 25 es nada. La raya es lo que tocaría llevar
 * HOY repartiendo la meta parejo entre los días hábiles, y lo que se
 * lee es si la barra la alcanzó. Con el mes cerrado la raya sobra
 * —tocaba llegar al final— y no se pinta.
 *
 * El relleno va en la marca y solo se vuelve verde con la meta
 * cumplida; la pista, en `--hairline`, igual que las barras de las
 * líneas de negocio de más abajo.
 */
function BarraDeMeta({ avance }: { avance: Avance }) {
  const lleno = Math.max(0, Math.min(avance.porcentaje ?? 0, 100));
  const vara =
    avance.meta > 0 && !avance.mesCerrado
      ? Math.min((avance.esperado / avance.meta) * 100, 100)
      : null;
  const texto = `${enPesos(avance.ganado)} de ${enPesos(avance.meta)}`;

  return (
    <div className="relative mt-3">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={avance.meta}
        aria-valuenow={Math.min(avance.ganado, avance.meta)}
        aria-valuetext={texto}
        aria-label={`Meta del mes: ${texto}`}
        title={texto}
        className="h-2 overflow-hidden rounded-full bg-hairline"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${lleno}%`,
            background:
              avance.ritmo === "CUMPLIDA" ? "var(--exito)" : "var(--marca)",
          }}
        />
      </div>
      {vara !== null && (
        <span
          aria-hidden
          title={`A estas alturas tocaría llevar ${enPesos(avance.esperado)}`}
          className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-titulo"
          style={{ left: `${vara}%` }}
        />
      )}
    </div>
  );
}

function PorAsesor({
  asesores,
}: {
  asesores: AvanceContraLaMeta["asesores"];
}) {
  const visibles = asesores.slice(0, ASESORES_A_LA_VISTA);

  return (
    <section className="min-w-0">
      <Rotulo titulo>Por asesor</Rotulo>
      <Apoyo>
        Arriba quien va más lejos de su meta: la lista es para decidir a quién
        acompañar esta semana.
      </Apoyo>

      <ul className="mt-3 flex max-w-[720px] flex-col">
        {visibles.map((a) => (
          <li
            key={a.asesorId ?? "SIN_ASESOR"}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-hairline py-2 first:border-0 first:pt-0"
          >
            <span className="min-w-0 truncate text-[0.8125rem] text-texto">
              {a.nombre}
            </span>
            <span className="flex shrink-0 items-baseline gap-3">
              <span className="text-[0.71875rem] text-texto-suave">
                <Dinero valor={a.ganado} ganado /> de <Dinero valor={a.meta} />
              </span>
              <span className="w-11 text-right text-[0.8125rem]">
                <Porcentaje valor={a.porcentaje} />
              </span>
              <span className={`estado w-24 ${TINTA_DEL_RITMO[a.ritmo]}`}>
                {ROTULO_RITMO[a.ritmo]}
              </span>
            </span>
          </li>
        ))}
        {asesores.length > visibles.length && (
          <li className="micro pt-2">
            y {asesores.length - visibles.length} más.
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * Dónde está atascado el embudo.
 *
 * Llevaba una barra azul redondeada por etapa. Se fueron, y no por
 * gusto: decían exactamente lo mismo que la cifra de la derecha y le
 * quitaban el sitio, que en un tablero de trabajo es el recurso
 * escaso. Lo que ordena la lista ahora es la rampa de color de las
 * etapas —de gris a azul profundo, cuanto más oscuro más cerca del
 * dinero— y una columna de cifras tabulares alineadas a la derecha,
 * que se compara de un vistazo por el número de dígitos.
 */
function Embudo({ porEtapa }: { porEtapa: ResumenDeVentas["porEtapa"] }) {
  return (
    /// Con la banda ancha es la primera de tres columnas; con la
    /// banda estrecha se lleva el renglón entero y las otras dos
    /// van debajo.
    <section className="@[768px]:col-span-2 @[1600px]:col-span-1">
      <Rotulo titulo>Dónde está el dinero</Rotulo>
      <Apoyo>Lo abierto, por etapa. Los dos embudos sumados.</Apoyo>

      {/*
        Topa en 720 px, la misma medida que declara el sistema para
        un formulario, y solo hace falta cuando se lleva el renglón
        entero. No es una tabla de trabajo —no se ordena, no se
        pulsa, no se exporta—: son cinco renglones para contestar
        una pregunta. A sangre, la etapa quedaba a la izquierda del
        todo y su plata a 1.100 px de distancia, y para comparar dos
        cifras había que cruzar la pantalla dos veces.
      */}
      <ul className="mt-3 flex max-w-[720px] flex-col">
        {porEtapa.map((e) => (
          <li
            key={e.etapa}
            className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 first:border-0"
          >
            <span className="flex items-baseline gap-2">
              <Etapa etapa={e.etapa} rotulo={e.rotulo} />
              <span className="text-[0.71875rem] tabular-nums text-texto-suave">
                {e.cuantas}
              </span>
            </span>
            <Dinero valor={e.total} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * QUÉ APORTA CADA LÍNEA DE NEGOCIO.
 *
 * Educación y Empresas, que es como se oferta al público y como está
 * partido el portafolio. NO es el embudo: por «empresas» entra tanto
 * un colegio que compra licencias de Education Plus como una fábrica
 * que compra Workspace, y sumarlos escondía justo la cifra que la
 * dirección abre a mirar.
 *
 * «Sin servicio elegido» se enseña igual, y no es un descuido: son
 * los negocios a los que les falta el dato. Esconderlos haría que
 * las dos líneas no sumaran el total de arriba, y entonces alguien
 * pasaría una tarde cuadrando dos cifras que nunca iban a cuadrar.
 */
function Lineas({ porLinea }: { porLinea: ResumenDeVentas["porLinea"] }) {
  const total = porLinea.reduce((s, l) => s + l.total, 0);

  return (
    <section>
      <Rotulo titulo>Por línea de negocio</Rotulo>
      <Apoyo>Lo abierto, según el servicio del portafolio.</Apoyo>

      {porLinea.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-texto-suave">
          Todavía no hay negocios abiertos.
        </p>
      ) : (
        <ul className="mt-3 flex max-w-[720px] flex-col">
          {porLinea.map((l) => (
            <li
              key={l.linea}
              className="flex flex-col gap-1 border-t border-hairline py-2.5 first:border-0 first:pt-0"
            >
              <span className="flex items-baseline justify-between gap-4">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-[0.8125rem] text-texto">
                    {l.rotulo}
                  </span>
                  <span className="text-[0.71875rem] tabular-nums text-texto-suave">
                    {l.cuantas}
                  </span>
                </span>
                <Dinero valor={l.total} />
              </span>
              {/* La barra dice la proporción de un vistazo; el número
                  la dice exacta. Las dos, porque comparar dos cifras
                  largas de pesos cuesta más que mirar dos barras. */}
              <span
                className="h-1.5 overflow-hidden rounded-full bg-hairline"
                aria-hidden
              >
                <span
                  className="block h-full rounded-full bg-marca"
                  style={{ width: `${total === 0 ? 0 : Math.round((l.total / total) * 100)}%` }}
                />
              </span>
              {l.ganadoDelMes > 0 && (
                <span className="text-[0.71875rem] text-texto-suave">
                  Ganado este mes: <Dinero valor={l.ganadoDelMes} ganado />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * QUÉ SE ESTÁ VENDIENDO.
 *
 * El portafolio ya dice qué se oferta; esto dice qué se está
 * moviendo de verdad, que no es lo mismo. Ocho como mucho: es para
 * mirar y decidir, no para exportar.
 */
function Mix({ filas }: { filas: ResumenDeVentas["mixDeProductos"] }) {
  return (
    <section>
      <Rotulo titulo>Mix de productos</Rotulo>
      <Apoyo>Lo abierto por servicio, de mayor a menor.</Apoyo>

      {filas.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-texto-suave">
          Ningún negocio abierto tiene servicio elegido todavía.
        </p>
      ) : (
        <ul className="mt-3 flex max-w-[720px] flex-col">
          {filas.map((f) => (
            <li
              key={f.id}
              className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 first:border-0 first:pt-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[0.8125rem] text-texto">{f.nombre}</span>
                <span className="text-[0.71875rem] text-texto-suave">
                  {f.linea} · {f.cuantas} {f.cuantas === 1 ? "negocio" : "negocios"}
                </span>
              </span>
              <Dinero valor={f.total} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Qué campaña trae negocio.
 *
 * Es la pregunta que justifica el gasto en pauta, y la que casi
 * ningún CRM contesta bien: para contestarla hay que saber de qué
 * anuncio vino cada ficha, y eso solo se sabe si el lead entra solo,
 * con su origen puesto. Aquí entra así.
 */
function Campanas({ filas }: { filas: ResumenDeVentas["porCampana"] }) {
  return (
    <section>
      <Rotulo titulo>De dónde vienen</Rotulo>
      <Apoyo>Por campaña: cuántos trae y cuánto dinero mueve.</Apoyo>

      {filas.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-texto-suave">
          Todavía no hay leads con campaña.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            {/* La cabecera es un rótulo en versalita sobre blanco con
                una regla debajo. Sin fondo teñido: era la única
                tabla del panel con la cabecera pintada y eso la
                hacía pesar más que sus propios datos. */}
            <thead>
              <tr className="border-b border-borde text-left">
                <Cabecera>Campaña</Cabecera>
                <Cabecera derecha>Leads</Cabecera>
                <Cabecera derecha>Abierto</Cabecera>
                <Cabecera derecha>Ganado</Cabecera>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.campana} className="border-b border-hairline last:border-0">
                  <td className="py-2 pr-4">
                    <Puerta campana={f.campana} />
                  </td>
                  <td className="py-2 pr-4 text-right text-[0.8125rem] tabular-nums text-texto">
                    {f.cuantas}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <Dinero valor={f.abierto} />
                  </td>
                  <td className="py-2 text-right">
                    <Dinero valor={f.ganado} ganado />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Cabecera({
  children,
  derecha,
}: {
  children: React.ReactNode;
  derecha?: boolean;
}) {
  return (
    <th
      className={
        "pb-1 text-[0.625rem] leading-[1.2] font-bold tracking-[0.11em] text-texto-suave uppercase " +
        (derecha ? "pr-4 text-right last:pr-0" : "")
      }
    >
      {children}
    </th>
  );
}

/// Una oportunidad sin próximo paso es una oportunidad abandonada, y
/// el sistema tiene que poder decirlo antes de que se muera sola.
///
/// El ámbar de la derecha es un reloj: dice cuánto lleva quieta, no
/// que la etapa sea mala. Es el mismo ámbar y el mismo significado
/// que en el tablero, y no hay un tercer sitio donde salga.
function Frias({
  frias,
  cuantas,
  dias,
}: {
  frias: ResumenDeVentas["frias"];
  cuantas: number;
  /// De Configuración. Decía «más de una semana» a mano, y con el
  /// umbral ya configurable esa frase se volvía mentira en cuanto
  /// alguien lo moviera.
  dias: number;
}) {
  return (
    <section>
      <Rotulo titulo>Se están enfriando</Rotulo>
      <Apoyo>
        Abiertas que llevan más de {dias === 1 ? "un día" : `${dias} días`} sin que
        nadie las toque.
      </Apoyo>

      {frias.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-texto-suave">
          Ninguna. Todo lo abierto se ha movido a tiempo.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {frias.map((f) => (
            <li
              key={f.id}
              className="flex items-baseline justify-between gap-4 border-t border-hairline py-2 first:border-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-[0.8125rem] text-texto">
                  {f.titulo}
                </span>
                <span className="block truncate text-[0.71875rem] text-texto-suave">
                  {f.asesor?.nombre ?? "—"}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <Dinero valor={f.valor} />
                <Reloj
                  minutos={f.dias * MINUTOS_POR_DIA}
                  umbral={7 * MINUTOS_POR_DIA}
                />
              </span>
            </li>
          ))}
          {cuantas > frias.length && (
            <li className="pt-2 text-[0.65625rem] tracking-[0.02em] text-texto-suave">
              y {cuantas - frias.length} más.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/**
 * LOS COLORES DE LA SERIE, y por qué estos dos.
 *
 * Ganadas en el verde del panel, que aquí significa lo ganado y nada
 * más —es el mismo verde de «Ganado este mes»—. Perdidas en el
 * segundo escalón de serie (`--serie-2`), naranja, y NO en rojo: el
 * rojo de esta pantalla es el reloj sin contestar, y una venta
 * perdida el mes pasado no es una alarma de ahora.
 *
 * Se probó con el validador de paletas antes de elegir, porque a ojo
 * se elige mal: verde contra un gris neutro —que era la primera
 * idea, «perdidas apagadas»— se quedaba en ΔE 12 con visión normal y
 * 7 con deuteranopía: por debajo de lo que se distingue de un
 * vistazo. Verde contra naranja da 30 con visión normal y 8 en el
 * peor daltonismo (16 en el tema oscuro), y pasa contraste contra
 * la superficie en los dos temas. Y la leyenda va siempre: el color
 * acompaña, no distingue él solo.
 */
const COLOR_GANADAS = "var(--exito)";
const COLOR_PERDIDAS = SERIE.dos;

/// De cada cien cerradas, cuántas se ganaron. La misma regla que
/// `tasaDeCierre` en el backend —null sin cierres, porque un 0 %
/// con cero cierres afirma algo que no pasó—; se repite aquí solo
/// para el total de los doce meses, que el informe no manda.
function tasaDeCierre(ganadas: number, perdidas: number): number | null {
  const cerradas = ganadas + perdidas;
  return cerradas === 0 ? null : Math.round((ganadas / cerradas) * 100);
}

/// «Sep», de «Septiembre». Tres letras bastan para no confundir
/// ninguno, y caben debajo de una columna a 1024 px.
function mesCorto(rotulo: string): string {
  return rotulo.slice(0, 3);
}

/**
 * La tendencia: ganadas contra perdidas, mes a mes, los últimos doce.
 *
 * Doce meses móviles y no «lo que va del año»: en enero, el año en
 * curso es una columna sola y no enseña ninguna tendencia. Los doce
 * los decide el servidor, no esta pantalla; ver
 * `embudo-en-el-tiempo` en el controlador de informes.
 *
 * EL MES EN CURSO VA MARCADO. Todavía no termina, y sin decirlo su
 * columna siempre parece una caída: el día 5 lleva la sexta parte
 * de lo que llevará. Va con la columna sombreada, las barras
 * apagadas y su renglón en la leyenda.
 *
 * Y va la última de la pantalla, la que se come el alto que sobre:
 * es lo que menos cambia de un día para otro.
 */
function UltimosDoceMeses({ carga }: { carga: Carga<EmbudoEnElTiempo> }) {
  if (carga.error) {
    return (
      <BandaQueFallo
        titulo="Últimos 12 meses"
        que="No pudimos traer la serie de los últimos doce meses."
        error={carga.error}
        alReintentar={carga.recargar}
        ultima
      />
    );
  }

  if (!carga.datos) {
    return (
      <Banda sinRegla crece>
        <Rotulo titulo>Últimos 12 meses</Rotulo>
        <p role="status" className="secundario mt-2">
          Trayendo los últimos doce meses…
        </p>
      </Banda>
    );
  }

  const { meses, ultimoMesIncompleto } = carga.datos;
  const ganadas = meses.reduce((s, m) => s + m.ganadas, 0);
  const perdidas = meses.reduce((s, m) => s + m.perdidas, 0);
  const ganado = meses.reduce((s, m) => s + m.ganado, 0);
  const perdido = meses.reduce((s, m) => s + m.perdido, 0);
  const tasa = tasaDeCierre(ganadas, perdidas);

  return (
    <Banda sinRegla crece className="@container">
      <div className="grid gap-x-10 gap-y-5 @[1100px]:grid-cols-[minmax(0,1fr)_300px]">
        <section className="@container min-w-0">
          <Rotulo titulo>Últimos 12 meses</Rotulo>
          <Apoyo>
            Ganadas contra perdidas, por el mes en que se cerraron, y de cada
            cien cerradas cuántas se ganaron.
          </Apoyo>

          {ganadas + perdidas === 0 ? (
            <p className="mt-3 text-[0.8125rem] text-texto-suave">
              En los últimos doce meses no se ha cerrado ningún negocio.
            </p>
          ) : (
            <CierresPorMes meses={meses} ultimoIncompleto={ultimoMesIncompleto} />
          )}
        </section>

        {/* Los doce meses sumados. Al lado de la gráfica y no
            encima: la gráfica dice la forma, esto dice el total, y
            a 1920 la banda tiene ancho de sobra para las dos. */}
        <dl className="grid grid-cols-3 content-start gap-x-6 gap-y-4 @[1100px]:grid-cols-1">
          <div>
            <dt>
              <Rotulo>Ganadas en 12 meses</Rotulo>
            </dt>
            <dd className="mt-1">
              <span className="cifra-columna">{n(ganadas)}</span>
              <Pie>
                <Dinero valor={ganado} ganado /> a valor cotizado
              </Pie>
            </dd>
          </div>
          <div>
            <dt>
              <Rotulo>Perdidas en 12 meses</Rotulo>
            </dt>
            <dd className="mt-1">
              <span className="cifra-columna">{n(perdidas)}</span>
              <Pie>
                <Dinero valor={perdido} /> que se fueron
              </Pie>
            </dd>
          </div>
          <div>
            <dt>
              <Rotulo>Tasa de cierre</Rotulo>
            </dt>
            <dd className="mt-1">
              <Porcentaje valor={tasa} tamano="columna" />
              <Pie>
                {tasa === null
                  ? "sin cierres en doce meses"
                  : `${n(ganadas)} de ${n(ganadas + perdidas)} cerradas`}
              </Pie>
            </dd>
          </div>
        </dl>
      </div>
    </Banda>
  );
}

/**
 * Las columnas de la serie: dos barras por mes y la tasa debajo.
 *
 * NO es `BarrasAgrupadas` de `graficos.tsx`, aunque se le parece y
 * fue lo primero que se miró. Le faltan tres cosas que aquí son la
 * mitad del dato: marcar el mes en curso como incompleto —solo
 * admite una etiqueta, y «Sep · en curso» se trunca a «Sep…»—, una
 * escala contra la que leer la altura, y la tasa de cada mes alineada
 * bajo su columna. Se toma de allá lo que sí sirve: `n`, los escalones
 * de serie, el radio de 5 px y la leyenda.
 *
 * UN SOLO EJE, y es de conteos. La tasa es un porcentaje y va en su
 * propio renglón debajo, no como una línea encima con un segundo eje
 * a la derecha: dos escalas en el mismo dibujo inventan un cruce que
 * no está en los datos.
 *
 * El dibujo es `aria-hidden` y lo que lee un lector de pantalla es la
 * tabla oculta de debajo, con los mismos números. Pasar el cursor —o
 * tocar, en el teléfono— por un mes escribe sus cifras en el renglón
 * de abajo; ese renglón tiene alto fijo para que la gráfica no salte.
 */
function CierresPorMes({
  meses,
  ultimoIncompleto,
}: {
  meses: MesDelEmbudo[];
  ultimoIncompleto: boolean;
}) {
  const [encima, setEncima] = useState<number | null>(null);

  const maximo = Math.max(...meses.flatMap((m) => [m.ganadas, m.perdidas]), 1);
  /// Par, para que la raya del medio caiga en un número entero: con
  /// un tope de 3, la del medio diría «2» a la altura de 1,5.
  const tope = maximo > 1 && maximo % 2 === 1 ? maximo + 1 : maximo;
  const rayas = tope > 1 ? [0, 0.5, 1] : [0, 1];
  const alto = (v: number) => `${Math.max((v / tope) * 100, v > 0 ? 2 : 0)}%`;

  const ultimo = meses.length - 1;
  const enCurso = (i: number) => ultimoIncompleto && i === ultimo;
  const punto = encima !== null ? meses[encima] : null;

  return (
    <div className="mt-4">
      <div aria-hidden>
        {/* El canal de la derecha (`pr-8`) es para los números de
            la escala: sin él, el rótulo de arriba se montaba sobre
            la columna del mes en curso, que es justo la que más se
            mira. Los tres renglones lo llevan para que las columnas
            caigan una debajo de otra. */}
        <div className="relative pr-8">
          <div className="pointer-events-none absolute inset-0">
            {rayas.map((f) => (
              <div
                key={f}
                className="absolute inset-x-0 border-t border-hairline"
                style={{ top: `${f * 100}%` }}
              >
                <span className="absolute -top-2 right-0 bg-superficie pl-1 text-[0.65625rem] leading-none tabular-nums text-texto-suave">
                  {n(Math.round(tope * (1 - f)))}
                </span>
              </div>
            ))}
          </div>

          <div className="relative flex h-32 items-end gap-1">
            {meses.map((m, i) => (
              <div
                key={m.clave}
                onMouseEnter={() => setEncima(i)}
                onMouseLeave={() => setEncima(null)}
                className={
                  "flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-t-[5px] transition-opacity " +
                  (enCurso(i) ? "bg-superficie-alterna" : "")
                }
                style={{ opacity: encima === null || encima === i ? 1 : 0.45 }}
              >
                <span
                  className="block w-[34%] max-w-6 rounded-t-[5px]"
                  style={{
                    height: alto(m.ganadas),
                    background: COLOR_GANADAS,
                    opacity: enCurso(i) ? 0.55 : 1,
                  }}
                />
                <span
                  className="block w-[34%] max-w-6 rounded-t-[5px]"
                  style={{
                    height: alto(m.perdidas),
                    background: COLOR_PERDIDAS,
                    opacity: enCurso(i) ? 0.55 : 1,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Los meses. Con la banda estrecha —el teléfono— doce
            columnas no dan para tres letras, y queda la inicial; el
            año solo sale donde cambia y donde hay sitio. */}
        <div className="mt-1.5 flex gap-1 pr-8">
          {meses.map((m, i) => (
            <span
              key={m.clave}
              className={
                "min-w-0 flex-1 text-center text-[0.65625rem] leading-tight " +
                (enCurso(i) ? "text-texto-suave italic" : "text-texto-suave")
              }
            >
              <span className="block truncate @[520px]:hidden">
                {m.rotulo.slice(0, 1)}
              </span>
              <span className="hidden truncate @[520px]:block">
                {mesCorto(m.rotulo)}
              </span>
              <span className="hidden truncate @[520px]:block">
                {/* Espacio duro donde no va el año: con uno normal
                    el renglón se queda en cero de alto. */}
                {i === 0 || m.mes === 1 ? m.anio : " "}
              </span>
            </span>
          ))}
        </div>

        {/* La tasa de cada mes, bajo su columna. Solo con sitio: a
            doce columnas en un teléfono «100 %» no cabe, y ahí la
            dice el renglón de abajo al tocar el mes. */}
        <div className="mt-2 hidden border-t border-hairline pt-1.5 @[520px]:block">
          <p className="rotulo-bloque">Tasa de cierre</p>
          <div className="mt-1 flex gap-1 pr-8">
            {meses.map((m, i) => (
              <span
                key={m.clave}
                className={
                  "min-w-0 flex-1 truncate text-center text-[0.71875rem] tabular-nums " +
                  (m.tasa === null || enCurso(i) ? "text-texto-suave" : "text-texto")
                }
              >
                {m.tasa === null ? "—" : `${m.tasa} %`}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.71875rem] text-texto-suave">
        <span className="inline-flex items-center gap-1.5">
          <i
            aria-hidden
            className="block size-2.5 rounded-sm"
            style={{ background: COLOR_GANADAS }}
          />
          Ganadas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i
            aria-hidden
            className="block size-2.5 rounded-sm"
            style={{ background: COLOR_PERDIDAS }}
          />
          Perdidas
        </span>
        {ultimoIncompleto && meses[ultimo] && (
          <span className="inline-flex items-center gap-1.5">
            <i
              aria-hidden
              className="block size-2.5 rounded-sm bg-superficie-alterna ring-1 ring-borde"
            />
            {meses[ultimo].rotulo} va en curso: todavía no termina
          </span>
        )}
      </div>

      <p className="secundario mt-2 min-h-[2.9em]">
        {punto ? (
          <>
            <span className="text-texto">
              {punto.rotulo} de {punto.anio}
              {encima !== null && enCurso(encima) && ", en curso"}:
            </span>{" "}
            {n(punto.ganadas)} {punto.ganadas === 1 ? "ganada" : "ganadas"}
            {punto.ganado > 0 && (
              <>
                {" "}
                por <Dinero valor={punto.ganado} />
              </>
            )}{" "}
            · {n(punto.perdidas)} {punto.perdidas === 1 ? "perdida" : "perdidas"}{" "}
            · tasa de cierre{" "}
            {punto.tasa === null ? "—" : `${punto.tasa} %`} · entraron{" "}
            {n(punto.entraron)}
          </>
        ) : (
          "Pase el cursor por un mes, o tóquelo, para ver sus cifras."
        )}
      </p>

      {/* La misma serie para quien no ve el dibujo.

          El `sr-only` va en una caja y NO en la tabla: una tabla
          no respeta el ancho de 1 px —se estira a su contenido— y
          a 390 px empujaba la página 140 px a la derecha. */}
      <div className="sr-only">
        <table>
          <caption>
            Negocios ganados y perdidos por mes de cierre, últimos doce meses
          </caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Ganadas</th>
              <th scope="col">Perdidas</th>
              <th scope="col">Tasa de cierre</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m, i) => (
              <tr key={m.clave}>
                <th scope="row">
                  {m.rotulo} de {m.anio}
                  {enCurso(i) && " (en curso, todavía no termina)"}
                </th>
                <td>{m.ganadas}</td>
                <td>{m.perdidas}</td>
                <td>{m.tasa === null ? "sin cierres" : `${m.tasa} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
