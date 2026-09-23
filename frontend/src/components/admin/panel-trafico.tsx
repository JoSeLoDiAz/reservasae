"use client";

/**
 * Qué pasa entre el anuncio y la preinscripción.
 *
 * Existe porque la pauta gastaba dinero, la gente llegaba al
 * formulario y no se preinscribía nadie — y no había forma de
 * saber dónde se iba.
 *
 * MANDA LA SERIE, no el embudo. El cliente lo pidió así: «un
 * comparativo entre fechas desde que inició y de ahí en
 * adelante». Comparar contra el periodo anterior daría un −100 %
 * que solo diría que antes no había contador; la curva desde el
 * día uno sí dice algo.
 *
 * Las cifras son un SUELO, no un total, y eso se dice en
 * pantalla: no ven a quien se va antes de que la página termine
 * de pintar ni a quien usa bloqueador.
 *
 * GRÁFICAS ARRIBA, TABLA ABAJO (cliente, 21 sep 2026: «las
 * gráficas arriba, tablas abajo … realmente no entiendo nada», y
 * de Reservas: «lo mismo para tráfico de formulario»). Antes de la
 * primera gráfica había trece párrafos; ahora van los mandos, una
 * revelación cerrada y cuatro cifras. Lo que se quitó de la vista
 * no se borró: se fundió con otra pieza o está dentro de «Cómo
 * leer estas cifras».
 *
 * Y CUATRO PIEZAS VUELVEN A COMO ESTABAN (cliente, 21 sep 2026:
 * «me gusta más como estaba originalmente»): las cuatro tarjetas de
 * arriba, el Día a día, los tres cortes en tarjetas y «Antes del
 * contador» abierto. Lo demás de la versión nueva --sin banda
 * propia, el Paso a paso primero, la dona con su periodo-- se
 * queda, porque eso sí lo aprobó.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EmbudoProceso, type Hito } from "@/components/admin/embudo-proceso";
import {
  Delta,
  LineaDePeldanos,
  Donut,
  DosSeriesPorDia,
  ListaBarras,
  n,
  type PorcionDonut,
} from "@/components/admin/graficos";
import { Aviso } from "@/components/admin/marco-admin";
import { Bloque, Cargando, Vacio } from "@/components/admin/piezas";
import { ErrorApi } from "@/lib/api";
import {
  crmApi,
  type CorteDeVisitas,
  type EmbudoPublico,
  type HistoricoDeTrafico,
} from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";

/// Cómo se lee cada peldaño, y de qué color. El color sale de
/// las etapas del CRM para no inventar una segunda paleta.
///
/// El último se llama «Se preinscribieron», igual que su cifra de
/// arriba: se llamaba «Quedaron preinscritos», y dos nombres para
/// el mismo número se leen como dos números.
const PELDANOS: Array<{ paso: string; etiqueta: string; etapa: Hito["etapa"] }> = [
  { paso: "LLEGO", etiqueta: "Abrieron el enlace", etapa: "INTERESADO" },
  { paso: "CATALOGO_LISTO", etiqueta: "Vieron el formulario", etapa: "INTERESADO" },
  { paso: "ELIGIO_UBICACION", etiqueta: "Eligieron su ciudad", etapa: "CONTACTADO" },
  { paso: "VIO_ACCIONES", etiqueta: "Vieron los cursos", etapa: "CONTACTADO" },
  { paso: "ELIGIO_ACCION", etiqueta: "Eligieron un curso", etapa: "DATOS_COMPLETOS" },
  { paso: "AUTORIZO", etiqueta: "Autorizaron sus datos", etapa: "DATOS_COMPLETOS" },
  { paso: "DATOS_COMPLETOS", etiqueta: "Llenaron todo", etapa: "INSCRITO" },
  { paso: "ENVIO", etiqueta: "Pulsaron confirmar", etapa: "INSCRITO" },
  { paso: "REGISTRADO", etiqueta: "Se preinscribieron", etapa: "CERTIFICADO" },
];

const COMO_SE_LEE: Record<string, string> = Object.fromEntries(
  PELDANOS.map((p) => [p.paso, p.etiqueta]),
);

/// Qué hizo quien se fue, según el peldaño del que se fue.
///
/// Eran tres notas bajo el embudo («44 Se fueron cargando», «1
/// Miraron y no eligieron», «5 Se preinscribieron») que repetían
/// cifras que ya dicen las barras. Lo que sí añadían era el PORQUÉ,
/// y eso vive aquí: la frase de la caída lo dice una sola vez, en
/// el peldaño donde de verdad se cae la gente.
const QUE_HICIERON: Record<string, string> = {
  LLEGO: "cerraron antes de que el formulario apareciera",
  CATALOGO_LISTO: "vieron el formulario y no eligieron su ciudad",
  ELIGIO_UBICACION: "eligieron su ciudad y no llegaron a ver los cursos",
  VIO_ACCIONES: "vieron la oferta y no tocaron ninguna tarjeta",
  ELIGIO_ACCION: "eligieron un curso y no autorizaron sus datos",
  AUTORIZO: "autorizaron y no terminaron de llenar el formulario",
  DATOS_COMPLETOS: "llenaron todo y no pulsaron confirmar",
  /// «Lead» y no «ficha»: en el CRM todo es lead (cliente, 21 sep
  /// 2026: «nada de nada es ficha, todo es lead»).
  ENVIO: "pulsaron confirmar y no se creó el lead",
};

const RANGOS = [
  { valor: "HOY", etiqueta: "Hoy" },
  { valor: "SEMANA", etiqueta: "7 días" },
  { valor: "MES", etiqueta: "30 días" },
  { valor: "TODO", etiqueta: "Desde el inicio" },
];

/// De dónde venían. «No dejó rastro» y no «Directa»: lo cierto
/// es la ausencia de referencia, no que tecleara la dirección.
///
/// Este diccionario vive AQUÍ y en ningún otro sitio. Hubo una
/// copia en el servidor que nadie importaba: dos diccionarios sin
/// nada que los ate es el defecto que este cambio vino a evitar.
const NOMBRE_PROCEDENCIA: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  /// Sabemos que fue Meta y no cuál de las dos: no se inventa.
  META: "Meta (sin precisar cuál)",
  CORREO: "Correo",
  WHATSAPP: "WhatsApp",
  BUSQUEDA: "Buscador",
  QR: "Código QR",
  RESERVA: "Reserva de empresa",
  INTERNO: "Otra página nuestra",
  OTRA_WEB: "Otra página web",
  OTRO_DECLARADO: "Otro canal etiquetado",
  SIN_REFERENCIA: "No dejó rastro",
};

const NOMBRE_ANCHO: Record<string, string> = {
  MOVIL: "Celular",
  TABLET: "Tableta",
  ESCRITORIO: "Computador",
};

/// EN CASTELLANO Y SIN JERGA DE SERVIDOR. Decía «por el subdominio del
/// gremio», «por la dirección general» y «cruzada: el gremio no
/// coincide»: tres frases que solo entiende quien montó los dominios.
/// «Suena demasiado feo [...] no debe ser por el formulario o algo así»
/// (cliente, 23 sep 2026). Lo que de verdad distingue es POR CUÁL
/// FORMULARIO entró la persona.
const NOMBRE_ENTRADA: Record<string, string> = {
  SUBDOMINIO: "Por el formulario del gremio",
  RUTA: "Por el formulario general",
  /// Entró por el formulario de un gremio y acabó en el de otro: pasa
  /// con un enlace viejo o mal copiado, y conviene que se vea.
  CRUZADA: "Por un enlace que no corresponde",
};

/// Por debajo de esto no se imprime porcentaje: una tasa con dos
/// visitas se lee igual que una con tres mil.
const MINIMO_PARA_TASA = 30;

/// LA BASE DEL EMBUDO, DICHA. En esta pantalla hay tres bases de
/// porcentaje --aperturas en el Paso a paso, personas en los
/// cortes, leads en «Después»-- y hoy coinciden porque aperturas y
/// personas son 50. Con un escáner de correo dejan de coincidir
/// (el 16 sep 2026: 565 de 599 aperturas eran máquinas) y el
/// embudo diría 1 % donde el corte dice 15 %. Sin decir la base,
/// eso se lee como dos cifras que se contradicen.
const BASE_DEL_EMBUDO = "Cada porcentaje es sobre las aperturas, el primer paso.";

/// El mismo redondeo que el embudo: un porcentaje que sale en dos
/// sitios con dos redondeos distintos se lee como dos cifras.
function porcentaje(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((parte / total) * 100)} %`;
}

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

function diaCorto(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

type Parametros = Parameters<typeof crmApi.embudoPublico>[0];

/**
 * UNA PANTALLA DE CONTROL DE INSCRITOS, no una entrada del menú.
 *
 * Era `/admin/trafico`, la primera entrada de «Inscripciones».
 * El cliente la fundió con Control el 21 sep 2026: «Tráfico del
 * formulario fusionado con Control de inscritos en (Qué
 * pantalla)». Y tiene sentido: las dos cuentan lo MISMO por dos
 * tramos del camino --aquí, del anuncio a la preinscripción;
 * allí, de la preinscripción a la inscripción-- y entrar y salir
 * del menú para seguir una sola persona era el trabajo que hacía
 * quien mira esto.
 *
 * Por eso no trae `Encabezado`: el título y el desplegable de
 * pantalla los pone Control, y dos `h1` en la misma página no se
 * leen como una pantalla con partes, se leen como dos pantallas
 * pegadas —que es justo lo que el cliente vio: «no veo la línea
 * de respeto, se fusiona con la barra».
 *
 * La ruta vieja sigue viva y redirige: estuvo en el menú y hay
 * quien la tiene guardada.
 */
export function PanelTrafico() {
  const [rango, setRango] = useState("TODO");
  /// Los dos periodos del calendario. Vacios = no se compara.
  const [a, setA] = useState({ desde: "", hasta: "" });
  const [b, setB] = useState({ desde: "", hasta: "" });
  const [datos, setDatos] = useState<EmbudoPublico | null>(null);
  /// La serie del Día a día, SIEMPRE desde que arrancó el contador.
  ///
  /// El servidor calcula `porDia` dentro del periodo pedido: con
  /// «7 días» la curva empezaba en la primera visita de la semana
  /// y el título aprobado decía «desde que arrancó el contador».
  /// Se pide aparte con «Desde el inicio» y el título vuelve a ser
  /// verdad sin tocar el servidor.
  const [serie, setSerie] = useState<EmbudoPublico["porDia"]>([]);
  const [error, setError] = useState<string | null>(null);

  const comparando = Boolean(a.desde && a.hasta && b.desde && b.hasta);

  const parametros = useMemo<Parametros>(
    () =>
      comparando
        ? {
            rango: "PERSONALIZADO",
            desde: a.desde,
            hasta: a.hasta,
            contraDesde: b.desde,
            contraHasta: b.hasta,
          }
        : { rango },
    [rango, comparando, a.desde, a.hasta, b.desde, b.hasta],
  );
  const clave = JSON.stringify(parametros);

  /// LA PETICIÓN VIGENTE, fuera del render.
  ///
  /// Sin `clave`, pulsar «Hoy» no pedía nada: la carga vive en una
  /// ref dentro de useDatosVivos y esperaba al siguiente latido,
  /// hasta 30 s. El cliente lo veía como «el título no cambia».
  /// Y con `clave` sola no basta: si la respuesta de «Desde el
  /// inicio» llega DESPUÉS de pulsar «Hoy», pisaría a «Hoy». Por
  /// eso cada respuesta se compara con lo vigente al llegar.
  const vigente = useRef({ clave, parametros });
  useEffect(() => {
    vigente.current = { clave, parametros };
  }, [clave, parametros]);

  const cargar = useCallback(async () => {
    /// Hasta tres vueltas: useDatosVivos no lanza una segunda
    /// petición mientras hay una en vuelo, así que si la que
    /// vuelve ya no es la vigente, se pide la vigente aquí mismo.
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const pedida = vigente.current;
      /// Con «Desde el inicio» la respuesta ya trae la serie entera:
      /// no se pide dos veces lo mismo.
      const esTodo = pedida.parametros.rango === "TODO";
      try {
        const [respuesta, todo] = await Promise.all([
          crmApi.embudoPublico(pedida.parametros),
          esTodo ? null : crmApi.embudoPublico({ rango: "TODO" }),
        ]);
        if (pedida.clave !== vigente.current.clave) continue;
        setDatos(respuesta);
        setSerie((todo ?? respuesta).porDia);
        setError(null);
      } catch (e) {
        if (pedida.clave !== vigente.current.clave) continue;
        setError((e as ErrorApi).message);
      }
      return;
    }
  }, []);

  useDatosVivos(cargar, { intervaloMs: 30_000, clave });

  const porPaso = useMemo(
    () => new Map((datos?.hitos ?? []).map((h) => [h.paso, h.visitas])),
    [datos],
  );
  const llegaron = porPaso.get("LLEGO") ?? 0;
  const eligieron = porPaso.get("ELIGIO_ACCION") ?? 0;
  const quedaron = porPaso.get("REGISTRADO") ?? 0;
  /// Las que hizo alguien. NO sale de `hitos`: no es un peldaño
  /// de la escalera, así que no entra en el embudo.
  const personas = datos?.personas ?? 0;

  /// `dias` es del PERIODO y dibuja las chispas de las tarjetas;
  /// `serie` es desde el arranque y dibuja el Día a día.
  const dias = datos?.porDia ?? [];
  const antes = useMemo(
    () => new Map((datos?.comparado?.hitos ?? []).map((h) => [h.paso, h.visitas])),
    [datos],
  );

  /// EL PERIODO B ENTERO ANTES DEL CONTADOR NO VALE CERO.
  ///
  /// «Últimos 7 días contra los 7 anteriores», pulsado el 21 sep,
  /// compara contra el 8 al 14 de sept, y el contador arrancó el
  /// 18. Las tarjetas decían «0 en 8 al 14 de sept» y los nueve
  /// peldaños «antes: 0»: un cero sin medir se lee igual que un
  /// cero medido, y el cliente entendía que esa semana no llegó
  /// nadie. Se compara el final del día B en Bogotá contra la
  /// primera visita contada.
  const bSinContador = Boolean(
    comparando &&
      datos?.contandoDesde &&
      new Date(`${b.hasta}T23:59:59.999-05:00`).getTime() <
        new Date(datos.contandoDesde).getTime(),
  );
  const contra = (paso: string) =>
    datos?.comparado && !bSinContador ? (antes.get(paso) ?? 0) : null;

  /// El rótulo lo escribe la pantalla y no el servidor: allí sale
  /// «entre dos fechas», que comparado contra «entre dos fechas»
  /// no dice cuál es cuál.
  const rotuloA = comparando ? rotulo(a) : (datos?.etiqueta ?? "");
  const rotuloB = comparando ? rotulo(b) : (datos?.etiquetaAnterior ?? null);

  const hitos: Hito[] = PELDANOS.map((p) => ({
    etapa: p.etapa,
    etiqueta: p.etiqueta,
    total: porPaso.get(p.paso) ?? 0,
  }));
  /// El comparador ya llega al Paso a paso: EmbudoProceso admitía
  /// el periodo B y esta pantalla no se lo pasaba, así que al
  /// comparar cambiaban las cifras de arriba y el embudo no.
  /// Sin contador en B no se le pasa: nueve «antes: 0» con barras
  /// grises en cero dirían que no llegó nadie.
  const hitosAntes =
    datos?.comparado && !bSinContador ? PELDANOS.map((p) => antes.get(p.paso) ?? 0) : null;

  const porcionesProcedencia: PorcionDonut[] = (datos?.procedencia ?? []).map((f) => ({
    etiqueta: NOMBRE_PROCEDENCIA[f.valor ?? ""] ?? "Sin dato",
    valor: f.visitas,
  }));

  /// LA SEGUNDA DONA DE LA FILA: con qué entraron.
  ///
  /// La fila es de dos gráficos --«en esta fila son dos gráficos»
  /// (cliente, 23 sep 2026)--. Dispositivo era uno de los tres cortes
  /// en tabla de más abajo, y es el que mejor se lee en dona: son tres
  /// porciones y lo que se pregunta es cuánto pesa el celular. Abajo se
  /// quita, para no decir lo mismo dos veces en la misma pantalla.
  const porcionesDispositivo: PorcionDonut[] = (datos?.dispositivo ?? []).map((f) => ({
    etiqueta: NOMBRE_ANCHO[f.valor ?? ""] ?? "Sin dato",
    valor: f.visitas,
  }));

  const hayDatos = llegaron > 0;
  /// Si hoy no llegó nadie pero se compara contra un B que sí
  /// tiene visitas, lo de B se enseña: «Hoy contra ayer» a las 7
  /// de la mañana tapaba lo de ayer con un aviso a toda pantalla.
  const hayB = !bSinContador && (antes.get("LLEGO") ?? 0) > 0;
  const mostrarPeriodo = hayDatos || (comparando && hayB);

  /// Lo que dice una tarjeta en el renglón de B cuando se compara y
  /// no hay cifra que poner: B entero antes del contador. Callarlo
  /// dejaría un «0 en …» que se lee como que no llegó nadie.
  const sinB = bSinContador ? `Sin contador ${enPeriodo(rotuloB)}` : null;

  /// EN BARRAS O EN LÍNEA, en los dos gráficos. El cliente lo pidió
  /// para los dos --«fui enfático que Paso a paso también», 23 sep
  /// 2026--. Arrancan en barras, que es como estaban.
  const [vistaDias, setVistaDias] = useState<"barras" | "tendencia">("barras");
  const [vistaPasos, setVistaPasos] = useState<"barras" | "tendencia">("barras");

  return (
    <div className="flex flex-col gap-4">
      {/* SIN BANDA Y SIN «h1»: el título y la descripción de la
          pantalla los pone Control. Esa banda propia era lo que se
          «fusionaba con la barra» de arriba.

          El aviso de enlaces sin marcar va PRIMERO: pide hacer algo
          hoy, y solo sale desde el umbral. */}
      {datos?.sinMarcarHoy && <AvisoSinMarcar {...datos.sinMarcarHoy} />}

      {/* TODOS LOS CONTROLES DEL PERIODO EN UNA FILA.
          Los cuatro rangos vivían arriba, en el encabezado, y la
          comparación en su propia caja debajo: «tengo filtros
          regados» (cliente, 20 sep 2026). Son la misma decisión
          --qué periodo se mira-- y ahora se leen juntos. */}
      <ComparadorDeFechas
        a={a}
        b={b}
        alCambiarA={setA}
        alCambiarB={setB}
        comparando={comparando}
        rango={rango}
        alCambiarRango={setRango}
        /// DENTRO de la caja de los filtros y bajo su raya: es lo que
        /// matiza el periodo que se acaba de elegir, y suelto debajo de
        /// la tarjeta se leía como un texto de la página. Solo cuando
        /// hay una fecha que decir.
        ///
        /// Sin punto tras la hora: `cuando()` acaba en «a. m.» o «p. m.»
        /// y el punto de la abreviatura hace de punto final.
        nota={
          datos?.contandoDesde ? (
            <>
              El contador inició el {cuando(datos.contandoDesde)} Los leads recibidos
              antes de esta hora no hacen parte del conteo.
            </>
          ) : null
        }
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <ComoLeer hayHistorico={!!datos?.historico} />

      {/* Mientras no hay respuesta, se espera con la pieza de
          siempre y no con el armazón en ceros: cuatro ceros se leen
          como «no llegó nadie», que es otra cosa. */}
      {!datos ? (
        !error && <Cargando que="Cargando el tráfico…" />
      ) : (
        <>
          {/* EL AVISO VACÍO TAPA SOLO EL PERIODO A.
              Antes cambiaba la pantalla entera por un aviso: con
              «Hoy» a primera hora se perdía también el Día a día
              --que no sigue el periodo-- y, al comparar, lo de B. */}
          {!hayDatos && (
            <Vacio titulo="Todavía no hay visitas contadas">
              {datos.contandoDesde ? (
                <>
                  El contador funciona desde el{" "}
                  {new Date(datos.contandoDesde).toLocaleDateString("es-CO")}, pero en «
                  {rotuloA}» no llegó nadie. Si la pauta está activa, revise que el
                  enlace del anuncio apunte a esta dirección.
                </>
              ) : (
                <>
                  No se ha registrado ni una visita desde que existe esta pantalla. Si
                  la página sí está recibiendo gente, lo que falla es la medición y no
                  la pauta.
                </>
              )}
            </Vacio>
          )}

          {mostrarPeriodo && (
            <>
              {/* LAS CUATRO CIFRAS, CADA UNA EN SU TARJETA Y DE SU
                  COLOR, como estaban (ver `Resumen`). Estuvieron un día
                  en un solo marco con la cifra en negro, y el cliente
                  volvió a pedir estas.

                  «Abrieron» y «Personas» van juntas y no se sustituyen:
                  «Abrieron» incluye máquinas --el escáner de enlaces de
                  un proveedor de correo abre cada enlace del envío: el
                  16 sep 2026 eso fueron 565 de 599--, así que dividir
                  por ella da una tasa que parece exacta y no lo es. Pero
                  NO se esconde: la diferencia entre las dos es cuánta
                  gente llegó y se fue. */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Resumen
                  etiqueta="Aperturas"
                  valor={llegaron}
                  antes={contra("LLEGO")}
                  etiquetaAntes={rotuloB}
                  nota={sinB}
                  serie={dias.map((d) => d.llegaron)}
                  color="var(--serie-1)"
                  pie="Se registraron clics en el enlace."
                />
                <Resumen
                  etiqueta="Personas"
                  valor={personas}
                  /// El otro periodo no trae personas: se dice, para
                  /// que la tarjeta sin cifra de B no parezca un fallo.
                  nota={datos.comparado ? (sinB ?? "No se compara entre periodos") : null}
                  serie={dias.map((d) => d.personas)}
                  color="var(--serie-3)"
                  pie="Se detectó interacción humana"
                />
                <Resumen
                  etiqueta="Eligieron un curso"
                  valor={eligieron}
                  antes={contra("ELIGIO_ACCION")}
                  etiquetaAntes={rotuloB}
                  nota={sinB}
                  serie={dias.map((d) => d.eligieron)}
                  color="var(--serie-2)"
                  pie={
                    personas >= MINIMO_PARA_TASA
                      ? `${porcentaje(eligieron, personas)} de las personas`
                      : "Aún son pocas para un porcentaje"
                  }
                />
                <Resumen
                  etiqueta="Se preinscribieron"
                  valor={quedaron}
                  antes={contra("REGISTRADO")}
                  etiquetaAntes={rotuloB}
                  nota={sinB}
                  serie={dias.map((d) => d.preinscritos)}
                  color="var(--exito)"
                  /// LA CIFRA CUENTA PREINSCRIPCIONES, NO LEADS NUEVOS: el hito
                  /// REGISTRADO incluye a quien ya estaba (el servidor contesta
                  /// lo mismo en los dos casos, y lo marca REPETIDA). La serie
                  /// por día y los cortes cuentan solo los nuevos. «N leads
                  /// creados» sobre la cifra entera afirmaba leads que no se
                  /// crearon; aquí se dice cuántos fueron nuevos y cuántos ya
                  /// estaban, y la chispa es la de los nuevos.
                  pie={(() => {
                    if (quedaron === 0) return "Ningún lead todavía en este periodo";
                    const nuevos = Math.min(dias.reduce((t, d) => t + d.preinscritos, 0), quedaron);
                    const creados = `${n(nuevos)} ${nuevos === 1 ? "lead nuevo" : "leads nuevos"}`;
                    const ya = quedaron - nuevos;
                    return ya > 0 ? `${creados} · ${n(ya)} ya ${ya === 1 ? "estaba" : "estaban"}` : creados;
                  })()}
                />
              </div>

              {/* EL PASO A PASO, PRIMERO.
                  «Debería ser primero: Paso a paso · Desde el
                  principio» (cliente, 21 sep 2026). Y de lado a lado:
                  son nueve peldaños con su cifra, su rótulo y su
                  porcentaje.

                  La franja ámbar «Donde más se cae» vivía DEBAJO, suelta;
                  ahora es la frase de encima del embudo, con el mismo
                  arranque en ámbar. En un celular los nueve rótulos se
                  pisaban de a pares en columnas de 49 px: allí va la
                  misma escalera en barras horizontales, en su orden. */}
              <Bloque
                titulo={`Paso a paso · ${rotuloA}`}
                acciones={<Interruptor valor={vistaPasos} alCambiar={setVistaPasos} />}
              >
                <div className="hidden sm:block">
                  {vistaPasos === "tendencia" ? (
                    <>
                      {/* La línea NO es una serie de tiempo: el eje son
                          los nueve peldaños en su orden, así que lo que
                          dice es la PENDIENTE de la caída. Una línea por
                          peldaño a lo largo de los días pide que el
                          servidor mande los nueve pasos por día --hoy
                          manda cuatro-- y queda anotado. */}
                      <LineaDePeldanos hitos={hitos} />
                    </>
                  ) : (
                  <EmbudoProceso
                    hitos={hitos}
                    antes={hitosAntes}
                    etiquetaAhora={rotuloA}
                    etiquetaAntes={rotuloB}
                  />
                  )}

                  {/* LA FRASE, ABAJO. Iba encima del gráfico --era lo
                      primero que se leía del bloque-- y el cliente la
                      mandó al pie, donde «Día a día» pone la suya
                      («señale una columna…»): primero se ve la forma de
                      la caída y después se lee qué pasó (23 sep 2026). */}
                  <p className="mt-3 text-[0.8125rem] leading-relaxed text-texto-suave">
                    <FraseDeLaCaida datos={datos} porPaso={porPaso} /> {BASE_DEL_EMBUDO}
                  </p>
                </div>
                <div className="sm:hidden">
                  <p className="mb-3 text-[0.8125rem] leading-relaxed text-texto">
                    <FraseDeLaCaida datos={datos} porPaso={porPaso} /> {BASE_DEL_EMBUDO}
                  </p>
                  <ListaBarras
                    datos={hitos.map((h, i) => {
                      const perdidos = i === 0 ? 0 : Math.max(hitos[i - 1].total - h.total, 0);
                      return {
                        clave: PELDANOS[i].paso,
                        etiqueta: h.etiqueta,
                        valor: h.total,
                        /// EL PORCENTAJE PRIMERO Y CON SU SENTIDO. Iba
                        /// «44 no pasaron · 12 %», y juntos se leían como
                        /// «el 12 % no pasó», cuando es el 12 % que LLEGÓ
                        /// a ese paso. Y los que no pasaron, solo si hay:
                        /// siete de nueve filas decían «0 no pasaron», que
                        /// en escritorio tampoco sale. Corto a propósito:
                        /// rótulo, cifra y detalle van en un renglón, y con
                        /// «12 % del inicio» el rótulo se truncaba a 390 px.
                        /// En el peldaño de la caída mayor la cifra de los
                        /// que se fueron no se repite: la frase de encima
                        /// la dice con el porqué, y con ella «Vieron el
                        /// formulario» se cortaba 10 px.
                        detalle:
                          i === 0
                            ? "100 %"
                            : `quedan ${porcentaje(h.total, llegaron)}${perdidos > 0 && PELDANOS[i].paso !== datos.caidaMayor?.a ? ` · ${n(perdidos)} ${perdidos === 1 ? "no pasó" : "no pasaron"}` : ""}`,
                      };
                    })}
                  />
                </div>
                {bSinContador && datos.contandoDesde && (
                  <p className="mt-3 text-xs leading-relaxed text-texto-suave">
                    El periodo B ({rotuloB}) es anterior al contador, que empezó el{" "}
                    {cuando(datos.contandoDesde)}: no hay con qué comparar, y por eso no se
                    dibuja.
                  </p>
                )}
              </Bloque>
            </>
          )}

          {/* LA SERIE, DESPUÉS DEL PASO A PASO.
              Iba primero y el cliente la mandó abajo (21 sep 2026).
              Es el orden de la pregunta: primero dónde se cae la
              gente dentro del formulario, y después cómo va eso día
              tras día. Es el único bloque que no sigue el periodo, y
              su título ya lo dice; la frase que lo explicaba vive
              ahora en «Cómo leer estas cifras». Va FUERA de la rama
              del periodo: que hoy no haya llegado nadie no borra los
              días de antes. */}
          {/* Y sin el rango de fechas al lado del título: lo dicen las
              fechas de cada columna, y arriba era un dato más que leer
              (cliente, 23 sep 2026). */}
          {serie.length > 0 && (
            <Bloque
              titulo="Día a día, desde que arrancó el contador"
              acciones={<Interruptor valor={vistaDias} alCambiar={setVistaDias} />}
            >
              <DosSeriesPorDia
                modo={vistaDias}
                a={{
                  nombre: "Abrieron el enlace",
                  datos: serie.map((d) => ({ dia: d.dia, total: d.llegaron })),
                  color: "var(--serie-1)",
                }}
                b={{
                  nombre: "Se preinscribieron",
                  datos: serie.map((d) => ({ dia: d.dia, total: d.preinscritos })),
                  color: "var(--exito)",
                }}
                vacio="Todavía no hay ningún día con datos."
              />
            </Bloque>
          )}

          {mostrarPeriodo && (
            <>
              {/* Y los dos que responden «por dónde llegó y qué hizo
                  después», EN UNA FILA y del mismo alto.

                  LOS TRES DE AQUÍ ABAJO DICEN SU PERIODO. Entre ellos y
                  el «Paso a paso · …» queda el Día a día «desde que
                  arrancó el contador», y con «7 días» quien bajaba
                  tomaba la dona por el total de siempre: el mismo fallo
                  que el 149 contra 539 de Reservas, una cifra que no
                  dice de qué habla. */}
              {/* LA CADENA DE LOS DATOS, Y TODA DEL MISMO SITIO.
                  «Lo que tengo en Tráfico debe ser coherente a Control de
                  inscritos y no es así [...] necesito datos iguales»
                  (cliente, 23 sep 2026). Tenía razón, y medido en su
                  base el 23 de septiembre se ve por qué: el embudo decía
                  5 registros y el CRM tenía 9 personas con enlace del
                  registro en el mismo periodo. La cadena mezclaba las
                  dos fuentes y el segundo número salía MAYOR que el
                  primero, que es imposible de leer.

                  Son cosas distintas y las dos ciertas:

                  · El «Paso a paso» y el «Día a día» cuentan VISITAS, y
                    las cuenta el navegador. Si alguien lleva bloqueador,
                    si el paso no llega a escribirse o si la persona
                    vuelve otro día, ese número se queda corto.
                  · Esta cadena cuenta PERSONAS del CRM: las que se
                    crearon en el periodo y recibieron su enlace para
                    completar datos. Es la misma tabla que alimenta
                    Gestión de leads y Control de inscritos.

                  Así que la cadena se queda ENTERA en el CRM --tres
                  números que salen uno del otro-- y la diferencia con el
                  embudo se explica en el pie en vez de esconderse. */}
              <Bloque
                titulo={`Sus datos completos · ${rotuloA}`}
                descripcion="Personas que entraron por el formulario en este periodo, contadas en el CRM: las mismas que ve en Gestión de leads."
              >
                <div className="flex flex-wrap items-stretch gap-2">
                  <Resumen
                    etiqueta="Entraron por el formulario"
                    valor={datos.despues.recibieron}
                    color="var(--titulo)"
                    pie="con enlace de completado enviado"
                  />
                  <Resumen
                    etiqueta="Pasaron a datos completos"
                    valor={datos.despues.terminaron}
                    color="var(--exito)"
                    pie={
                      datos.despues.recibieron >= MINIMO_PARA_TASA
                        ? `${porcentaje(datos.despues.terminaron, datos.despues.recibieron)} de las que entraron`
                        : "diligenciaron el formulario de completado"
                    }
                  />
                  <Resumen
                    /// En el idioma del panel, no en el de la calle:
                    /// «siguen a medias / hay que perseguirlas» era una
                    /// nota interna --«recuerda un lenguaje profesional»,
                    /// cliente, 23 sep 2026--.
                    etiqueta="Datos incompletos"
                    valor={Math.max(datos.despues.recibieron - datos.despues.terminaron, 0)}
                    color={
                      datos.despues.recibieron - datos.despues.terminaron > 0
                        ? "var(--aviso)"
                        : "var(--exito)"
                    }
                    pie="pendientes de seguimiento"
                  />
                </div>

                <p className="mt-3 text-xs leading-relaxed text-texto-suave">
                  Estas son personas del CRM. El «Paso a paso» y el «Día a día» de arriba
                  cuentan visitas medidas en el navegador, así que sus cifras salen más
                  bajas: en este periodo, {n(quedaron)}{" "}
                  {quedaron === 1 ? "registro medido" : "registros medidos"} contra{" "}
                  {n(datos.despues.recibieron)}{" "}
                  {datos.despues.recibieron === 1 ? "persona creada" : "personas creadas"}.
                </p>
              </Bloque>

              {/* DOS GRÁFICOS EN LA FILA. Compartía sitio con el bloque
                  de datos completos; al irse aquel quedó media pantalla
                  en blanco, y el hueco lo llena la dona de dispositivo
                  --que antes era una tabla más abajo--. */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Bloque
                  titulo={`De dónde venían · ${rotuloA}`}
                  /// El aviso del «no dejó rastro» vivía en «Cómo leer
                  /// estas cifras», a seis bloques de distancia de la
                  /// fila que explica. Aquí se lee donde hace falta.
                  descripcion="«No dejó rastro» casi siempre es correo o WhatsApp: esos enlaces no dejan señal si no van marcados, y se marcan en Formularios públicos."
                  estirado
                >
                  <Donut
                    datos={porcionesProcedencia}
                    centro={n(llegaron)}
                    detalleCentro="aperturas"
                    vacio="Sin visitas en este periodo."
                  />
                </Bloque>

                <Bloque
                  titulo={`Con qué entraron · ${rotuloA}`}
                  descripcion="El formulario se llena casi todo desde el celular: si algo se ve mal ahí, se nota en la cifra de arriba."
                  estirado
                >
                  <Donut
                    datos={porcionesDispositivo}
                    centro={n(llegaron)}
                    detalleCentro="aperturas"
                    vacio="Sin visitas en este periodo."
                  />
                </Bloque>
                {/* SIN EL BLOQUE DE «DATOS COMPLETOS». Estuvo aquí en
                    tres formas --dos cifras grandes, tres tarjetas y una
                    frase-- y las tres confundían por el mismo motivo:
                    decían «completos y parciales» de un subconjunto
                    --solo quien entró por el formulario en el periodo--
                    mientras que la dona «Estado de los datos», en Control
                    de inscritos, lo dice de TODOS los leads. Dos cifras
                    parecidas para la misma pregunta, y una de ellas
                    siempre más chica sin explicar por qué.

                    «¿Por qué, si es así, no se utiliza este para que no
                    confunda?» (cliente, 23 sep 2026). Queda la dona, que
                    cuenta a todo el mundo, y esta pantalla se queda en lo
                    suyo: el recorrido dentro del formulario, que acaba en
                    «Se preinscribieron». Quién tiene los datos a medias se
                    ve en Gestión de leads, con su columna y su filtro. */}
              </div>

              {/* LOS CORTES, AL FINAL: tres tarjetas en fila, como
                  estaban. Fueron un día una tabla y el cliente la
                  devolvió: «me gusta más como estaba originalmente».
                  Por debajo de 1.024 px se apilan, cada una a lo ancho. */}
              <div className="grid gap-4 lg:grid-cols-2">
                {CORTES.map((c) => (
                  <Corte
                    key={c.titulo}
                    titulo={c.titulo}
                    periodo={rotuloA}
                    filas={c.filas(datos)}
                    nombre={c.nombre}
                    total={llegaron}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── ANTES DEL CONTADOR ──

          Va FUERA de la rama de arriba a proposito: esa solo
          se pinta cuando hay visitas medidas en el periodo, y
          este bloque es justo lo que hay que poder mirar
          cuando no las hay.

          Y va aparte, con su propio titulo y su propio
          rotulo, porque son cifras RECONSTRUIDAS del registro
          del servidor: sumarlas a las de arriba convertiria
          un agujero de medicion en una conclusion. */}
      {datos?.historico && <Historico h={datos.historico} />}
    </div>
  );
}

/**
 * «Donde más se cae: 44 de 50 aperturas se fueron entre «Abrieron
 * el enlace» y «Vieron el formulario»: cerraron antes de que el
 * formulario apareciera.»
 *
 * UNA frase, encima de la escalera. Era una franja ámbar debajo
 * del embudo MÁS tres notas con cifras que ya decían las barras;
 * lo único que aportaban de nuevo era el porqué, y va aquí.
 */
function FraseDeLaCaida({
  datos,
  porPaso,
}: {
  datos: EmbudoPublico;
  porPaso: Map<string, number>;
}) {
  const caida = datos.caidaMayor;
  if (!caida) return null;
  const de = porPaso.get(caida.de) ?? 0;
  const que = QUE_HICIERON[caida.de];
  return (
    <>
      <strong className="font-semibold text-aviso">Donde más se cae: </strong>
      {n(caida.sePerdieron)} de {n(de)} aperturas{" "}
      {caida.sePerdieron === 1 ? "se fue" : "se fueron"} entre «
      {COMO_SE_LEE[caida.de] ?? caida.de}» y «{COMO_SE_LEE[caida.a] ?? caida.a}»
      {que ? `: ${que}.` : "."}
    </>
  );
}

/**
 * «Hoy entraron 35 personas por un enlace sin marcar.»
 *
 * Lo pidió Mauricio el 18 sep 2026 para blindar la atribución
 * SIN tocar el formulario: quien entra por la dirección pelada no
 * deja señal, y sin este aviso se descubría en el informe del
 * mes, con cientos de fichas ya en «Sin etiqueta». Va ARRIBA de
 * todo porque pide hacer algo hoy, y sale solo desde el umbral:
 * un aviso que está siempre encendido deja de leerse.
 */
function AvisoSinMarcar({
  personas,
  umbral,
  desde,
}: {
  personas: number;
  umbral: number;
  desde: Array<{ sitio: string; personas: number }>;
}) {
  if (personas < umbral) return null;
  return (
    <section
      role="status"
      className="rounded-2xl border border-aviso/40 bg-aviso-suave px-6 py-4 text-sm"
    >
      <p className="text-texto">
        <strong className="font-semibold text-aviso">
          Hoy entraron {n(personas)} personas por un enlace sin marcar.
        </strong>{" "}
        Alguien repartió la dirección del formulario sin sacarla del panel, y
        esas personas quedan como «Sin etiqueta» en Gestión de leads.
      </p>
      {desde.length > 0 && (
        <p className="mt-1.5 text-texto-suave">
          Llegaron sobre todo desde{" "}
          {desde.map((d, i) => (
            <span key={d.sitio}>
              {i > 0 && (i === desde.length - 1 ? " y " : ", ")}
              <strong className="font-mono text-texto">{d.sitio}</strong> ({n(d.personas)})
            </span>
          ))}
          .
        </p>
      )}
      <p className="mt-1.5 text-texto-suave">
        Saque el enlace desde{" "}
        <Link href="/admin/formularios-publicos" className="font-medium text-marca underline">
          Formularios públicos
        </Link>
        , eligiendo por dónde se reparte, y cámbielo donde se haya publicado.
      </p>
    </section>
  );
}


/**
 * Cómo leer estas cifras: ARRIBA, pero CERRADO.
 *
 * Estaba al final, como lista de seis párrafos, y el cliente lo
 * dijo: «esto debería ser visible arriba, y más fácil de
 * interpretar» (18 sep 2026). Quien mira la pantalla compara con
 * Meta ANTES de bajar, y ahí es donde hace falta saber que la
 * cifra de aquí sale menor a propósito. Por eso sigue arriba,
 * encima de las cifras con las que se compara.
 *
 * Pero abierta eran 127 palabras antes de la primera gráfica
 * --544 px en un celular-- y el cliente, el 21 sep: «realmente no
 * entiendo nada». Queda la frase que hace falta para comparar con
 * Meta a la vista, y los seis titulares a un clic. Dentro recogen
 * además lo que se quitó de otros sitios: las máquinas de
 * «Abrieron» y la frase del Día a día.
 */
function ComoLeer({ hayHistorico }: { hayHistorico: boolean }) {
  /// REESCRITO CON LO QUE LA PANTALLA DICE HOY (23 sep 2026).
  ///
  /// Hablaba de «Abrieron» y del bloque «Después», que ya no existen,
  /// y explicaba el Día a día con una frase que sobra desde que cada
  /// columna lleva su fecha y su cifra. Quedan seis ideas, en el orden
  /// en que se leen las cosas en la pantalla: primero qué es cada
  /// cifra de arriba, después cómo se leen los dos gráficos, y al final
  /// los dos avisos que evitan malentendidos con Meta y con el «no
  /// dejó rastro».
  const ideas: Array<[string, string]> = [
    [
      "«Aperturas» cuenta clics, no personas",
      "Quien abre el enlace dos días cuenta dos veces. Y no todo clic es de alguien: el correo abre los enlaces solo, para revisarlos.",
    ],
    [
      "«Personas» es la cifra que se usa",
      "De esas aperturas, las que se quedaron tres segundos o tocaron algo. Es un suelo: quien mira y se va no se cuenta.",
    ],
    [
      "Saldrá menos que en Meta, y está bien",
      "Meta cuenta clics. Aquí solo cuentan las visitas que sí cargaron la página, y nunca las que se fueron antes de eso.",
    ],
    [
      "Paso a paso es dónde se cae la gente",
      "Cada barra es un paso del formulario, en orden. La vista «Tendencia» dibuja lo mismo en línea: el tramo más inclinado es la fuga.",
    ],
    [
      "Día a día es el calendario",
      "Cada columna, un día con su fecha y su cifra. También tiene «Tendencia» para ver los picos, y no cuenta nada anterior al arranque del contador" +
        (hayHistorico ? ": lo de antes va en su bloque aparte, y no se suma." : "."),
    ],
    [
      `Porcentajes desde ${MINIMO_PARA_TASA} visitas`,
      "Con menos, un porcentaje no dice nada. El del Paso a paso va sobre las aperturas; el de los cortes de abajo, sobre las personas.",
    ],
  ];

  return (
    <Bloque
      titulo="Cómo leer estas cifras"
      descripcion="Es un mínimo, no el total: saldrá menos que en Meta."
      plegable
    >
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {ideas.map(([titular, frase]) => (
          <div key={titular}>
            <dt className="text-sm font-semibold text-texto">{titular}</dt>
            <dd className="mt-0.5 text-sm leading-snug text-texto-suave">{frase}</dd>
          </div>
        ))}
      </dl>
    </Bloque>
  );
}

/**
 * BARRAS O TENDENCIA. Dos botones, y uno solo para los dos gráficos:
 * con una copia por bloque, el día que cambie el estilo cambiaría en
 * uno y no en el otro.
 */
function Interruptor({
  valor,
  alCambiar,
}: {
  valor: "barras" | "tendencia";
  alCambiar: (v: "barras" | "tendencia") => void;
}) {
  return (
    <div className="flex gap-1">
      {(["barras", "tendencia"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => alCambiar(v)}
          aria-pressed={valor === v}
          className={`rounded-full px-2.5 py-1 text-[0.6875rem] transition ${
            valor === v
              ? "bg-marca font-semibold text-marca-texto"
              : "border border-borde text-texto-suave hover:border-marca/40"
          }`}
        >
          {v === "barras" ? "Barras" : "Tendencia"}
        </button>
      ))}
    </div>
  );
}

/**
 * Un peldaño del embudo,
 *
 * VUELVE LA TARJETA DE ANTES (cliente, 21 sep 2026: «no sé qué tan
 * sano tarjeta y gráfica, se ve algo raro»). Se había fundido en un
 * marco de cuatro celdas con la cifra en negro y la chispa metida a
 * la derecha solo en dos, y con pocos días esa chispa pequeña era
 * una raya en escalón pegada al número. Son otra vez cuatro
 * tarjetas, la cifra del color de su serie y la chispa a lo ancho
 * debajo, en las cuatro.
 *
 * Con un arreglo de verdad: dos de las cuatro chispas dibujaban la
 * serie de OTRA cifra --«Personas» las aperturas, «Eligieron» las
 * preinscripciones-- porque el servidor no las mandaba por día.
 * Ahora cada una trae la suya y la suma de sus días da la cifra de
 * arriba (`embudo.service.ts`, `porDia`).
 *
 * La chispa solo sale con dos días o más: con uno sería un punto
 * suelto, que se lee como un fallo de dibujo y no como «todavía no
 * hay historia».
 */
function Resumen({
  etiqueta,
  valor,
  color,
  pie,
  antes = null,
  etiquetaAntes = null,
  nota = null,
}: {
  etiqueta: string;
  valor: number;
  serie?: number[];
  color: string;
  pie?: string;
  /// Null cuando no se compara: 0 es «hubo cero».
  antes?: number | null;
  etiquetaAntes?: string | null;
  /// Lo que se dice en el renglón de la cifra de B cuando no la hay.
  nota?: string | null;
}) {
  return (
    <div
      className={
        "min-w-[150px] flex-1 rounded-lg border border-borde bg-superficie px-3.5 py-1.5 transition " +
        "hover:border-marca/40 hover:shadow-[0_2px_14px_-6px_rgba(15,23,42,0.28)]"
      }
    >
      <div
        className="truncate leading-none text-texto-suave"
        style={{ fontSize: "0.6875rem" }}
        title={etiqueta}
      >
        {etiqueta}
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        {/* EL COLOR DE LA SERIE, UN PUNTO HACIA EL TÍTULO. El verde de
            «Personas» puro sobre blanco daba 2,8:1 y el naranja 3,2:1,
            por debajo o al filo del 3:1 de una cifra grande. Mezclado
            con `--titulo` se oscurece en claro y se aclara en oscuro:
            sigue leyéndose como su color y se lee en los dos temas.
            La chispa lleva el color puro, que no es texto. */}
        <span
          className="font-bold leading-none tabular-nums"
          style={{
            fontSize: "1.0625rem",
            color: `color-mix(in oklab, ${color} 80%, var(--titulo))`,
          }}
        >
          {n(valor)}
        </span>
        {/* Sin «vs …»: el periodo B ya lo dice el renglón de abajo, y
            dicho dos veces en tres centímetros es ruido. */}
        {antes !== null && <Delta valor={variacion(valor, antes)} />}
      </div>
      {/* UN SOLO PIE: el de la comparación cuando se compara, y el
          explicativo cuando no. Y sin chispa: la serie por día vive en
          «Día a día», que las pinta juntas y con eje. Dos renglones más
          una chispa devolvían la tarjeta a los 150 px de alto que el
          cliente quitó. */}
      <div
        className="mt-0.5 truncate leading-none text-texto-suave"
        style={{ fontSize: "0.6875rem" }}
        title={pie ?? undefined}
      >
        {antes !== null ? `${n(antes)} ${enPeriodo(etiquetaAntes)}` : (nota ?? pie ?? "")}
      </div>
    </div>
  );
}

/// Seis, como estaba: dispositivo y dirección caben enteros, y la
/// campaña, que llega a doce, abre el resto con su botón.
const FILAS_EN_TARJETA = 6;

/// SIN NOTA DE UTM. Explicaba qué parámetro tiene que llevar el enlace
/// --«utm_campaign», y «utm_source=correo» en un mailing-- y el cliente
/// la quitó (23 sep 2026): los enlaces los arma el sistema, no quien lee
/// el tablero, y las filas sin etiqueta ya salen como «sin etiqueta».

/// Lo que se lee en gris a la derecha de cada fila.
///
/// El porcentaje va sobre las PERSONAS y NUNCA sobre las aperturas:
/// un escáner de enlaces infla aquellas, así que dividir por ellas
/// da una tasa que parece exacta y no lo es. Con pocas no se
/// imprime: una tasa hecha de dos se lee igual que una de tres mil.
function detalleDeFila(f: CorteDeVisitas): string | undefined {
  if (f.visitas === 0) return undefined;
  const gente = `${n(f.personas)} ${f.personas === 1 ? "persona" : "personas"}`;
  if (f.personas < MINIMO_PARA_TASA) return gente;
  return `${gente} · ${porcentaje(f.envios, f.personas)} se preinscribió`;
}

/**
 * Un corte con barras: por dispositivo, por dirección o por campaña.
 *
 * VUELVEN LAS TRES TARJETAS (cliente, 21 sep 2026: «me gusta más
 * como estaba originalmente»). Se habían fundido en una sola tabla
 * de cinco columnas, que sigue en este archivo (`TablaDeCortes`).
 * La barra es la APERTURA --el volumen que de verdad llegó-- y el
 * gris de al lado lleva las personas, que son la base del
 * porcentaje: un canal que abre mil veces y no toca ninguna tiene
 * que verse.
 *
 * La fila la pinta aquí y no `ListaBarras`, con el mismo dibujo y
 * una diferencia: si el nombre y las cifras no caben en un renglón,
 * las cifras bajan al siguiente. En `ListaBarras` las cifras no
 * ceden y el nombre se recorta, y en un celular «Por el subdominio
 * del gremio» quedaba en «Por el su…».
 */
function Corte({
  titulo,
  periodo,
  filas,
  nombre,
  total,
  pie,
}: {
  titulo: string;
  periodo: string;
  filas: CorteDeVisitas[];
  nombre: (valor: string | null) => string;
  total: number;
  /// Lo que hay que hacer para que este corte diga algo. Va donde
  /// se lee la cifra, no en un manual que nadie abre.
  pie?: string;
}) {
  const [todas, setTodas] = useState(false);
  const resto = filas.length - FILAS_EN_TARJETA;
  const visibles = resto > 0 && !todas ? filas.slice(0, FILAS_EN_TARJETA) : filas;
  /// El tope sale de TODAS las filas: al abrir el resto, las barras
  /// de arriba no se reescalan.
  const tope = Math.max(1, ...filas.map((f) => f.visitas));

  return (
    /// El periodo va en la descripción y no en el título: con «· 7
    /// días» detrás, «Por qué dirección entraron» partía en dos
    /// renglones a 1.024 px y las tres listas empezaban a alturas
    /// distintas.
    <Bloque titulo={titulo} descripcion={periodo} estirado>
      {filas.length === 0 ? (
        <p className="py-6 text-center text-[0.84375rem] text-texto-suave">
          Sin visitas en este periodo.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visibles.map((f) => {
            const detalle = detalleDeFila(f);
            const rotulo = nombre(f.valor);
            return (
              <li key={f.valor ?? "sin"}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[0.84375rem]">
                  <span className="min-w-0 truncate text-texto" title={rotulo}>
                    {rotulo}
                  </span>
                  <span className="ml-auto shrink-0 text-texto tabular-nums">
                    {n(f.visitas)}
                    {detalle && (
                      <span className="ml-2 text-xs text-texto-suave">{detalle}</span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-superficie-alterna">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-marca to-marca/40"
                    style={{ width: `${(f.visitas / tope) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
          {resto > 0 && (
            <li className="pt-1">
              <button
                type="button"
                onClick={() => setTodas((v) => !v)}
                className="text-xs font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
              >
                {todas
                  ? `Ver solo las ${n(FILAS_EN_TARJETA)} primeras`
                  : `Ver ${resto === 1 ? "la otra" : `las otras ${n(resto)}`}`}
              </button>
            </li>
          )}
        </ul>
      )}
      {total > 0 && filas.length > 0 && (
        <p className="mt-3 text-xs text-texto-suave">
          Sobre {n(total)} {total === 1 ? "apertura" : "aperturas"} del periodo. El
          porcentaje va sobre las personas.
        </p>
      )}
      {pie && <p className="mt-2 text-xs text-texto-suave">{pie}</p>}
    </Bloque>
  );
}

/// Los tres cortes, con el nombre de cada fila.
const CORTES: Array<{
  titulo: string;
  filas: (d: EmbudoPublico) => CorteDeVisitas[];
  nombre: (valor: string | null) => string;
}> = [
  /// SIN «POR DISPOSITIVO»: subió a la fila de donas, que es donde se
  /// lee mejor --tres porciones-- y donde hacía falta un segundo
  /// gráfico. Aquí abajo quedan los dos cortes que sí son listas
  /// largas: direcciones y campañas.
  {
    titulo: "Por cuál formulario entraron",
    filas: (d) => d.entrada,
    nombre: (v) => NOMBRE_ENTRADA[v ?? ""] ?? "Sin dato",
  },
  /// «Entrada directa» era FALSO y se veia: el 16 sep 2026,
  /// 10.450 de estas venian de un envio de correo y el rotulo
  /// decia que habian entrado solas. Lo cierto es que el enlace
  /// no traia etiqueta.
  {
    titulo: "Por campaña",
    filas: (d) => d.campana,
    nombre: (v) => v ?? "El enlace no traía etiqueta",
  },
];

/// El porcentaje de una fila: sobre las PERSONAS y NUNCA sobre las
/// aperturas --un escáner de enlaces infla aquellas, así que
/// dividir por ellas da una tasa que parece exacta y no lo es--.
/// Con pocas no se imprime: una tasa hecha de dos se lee igual que
/// una de tres mil.
function tasaDeFila(f: CorteDeVisitas): string {
  return f.personas < MINIMO_PARA_TASA ? "—" : porcentaje(f.envios, f.personas);
}

/// Cuatro, como pedía el diseño: con seis eran trece filas
/// abiertas y el bloque volvía a ser la muralla de abajo.
const FILAS_POR_CORTE = 4;

const TH =
  "px-3.5 py-2.5 align-bottom text-[0.625rem] font-semibold tracking-[0.1em] text-texto-suave uppercase";
const TD = "px-3.5 py-2 align-top text-[0.8125rem]";
const TD_CIFRA = `${TD} text-right tabular-nums`;

/**
 * Dispositivo, dirección y campaña: UNA TABLA, abajo.
 *
 * Eran tres tarjetas de barras lado a lado, cada una con su «Sobre
 * 50 aperturas del periodo» repetido, y el cliente lo pidió en
 * Reservas y dijo «lo mismo para tráfico»: «¿si solo dejamos
 * tabla, agregamos la de porcentaje o columnas que se necesiten?».
 * Tres listas de barras con la cifra que importa (el porcentaje)
 * escondida en letra pequeña son justo lo que no se entendía; en
 * una tabla las cuatro cifras de cada fila se leen de corrido y
 * los tres cortes se comparan en la misma columna.
 *
 * Una sola tabla con una fila de título por corte, y no tres:
 * las columnas quedan alineadas de un corte al siguiente.
 *
 * FUERA DE LA PANTALLA desde el 21 sep 2026: el cliente la vio y
 * pidió volver a las tres tarjetas («me gusta más como estaba
 * originalmente»), que son `Corte`. Se queda aquí, exportada para
 * que no la marque nadie como sobrante, porque funciona y no se
 * borra lo que sirve.
 */
export function TablaDeCortes({ datos, periodo }: { datos: EmbudoPublico; periodo: string }) {
  /// Cada corte se abre por su cuenta, como hacía ListaBarras.
  const [todas, setTodas] = useState<Record<string, boolean>>({});
  /// El servidor manda hasta DOCE filas por corte: treinta y seis
  /// filas abiertas serían la muralla de 1.300 px que el cliente no
  /// quiere. Se ven las cuatro primeras y el resto tiene su puerta.
  const grupos = CORTES.map((c) => {
    const lista = c.filas(datos);
    const abierto = Boolean(todas[c.titulo]);
    return {
      ...c,
      lista,
      visibles: abierto ? lista : lista.slice(0, FILAS_POR_CORTE),
      resto: lista.length - FILAS_POR_CORTE,
      abierto,
    };
  });
  const alternar = (titulo: string) =>
    setTodas((t) => ({ ...t, [titulo]: !t[titulo] }));

  return (
    <Bloque
      titulo={`Dispositivo, dirección y campaña · ${periodo}`}
      descripcion={`El porcentaje es cuántas personas se preinscribieron, sobre las personas de cada fila. Con menos de ${MINIMO_PARA_TASA} personas no se calcula.`}
      sinRelleno
    >
      {/* CON TOPE DE ANCHO. A lo ancho de 1.600 px, «Celular»
          terminaba en x=88 y su primera cifra empezaba en x=1.191:
          1.100 px en blanco que el ojo tenía que cruzar para unir
          el nombre con su número. A 760 px el rótulo más largo cabe
          y las cifras quedan a su lado. */}
      <table className="hidden w-full max-w-[760px] border-collapse sm:table print:table">
        <caption className="sr-only">Dispositivo, dirección y campaña</caption>
        <thead>
          <tr className="border-b border-borde">
            <th scope="col" className={`${TH} pl-7 text-left`}>
              Corte
            </th>
            <th scope="col" className={`${TH} w-[108px] text-right`}>
              Aperturas
            </th>
            <th scope="col" className={`${TH} w-[108px] text-right`}>
              Personas
            </th>
            <th scope="col" className={`${TH} w-[160px] text-right whitespace-nowrap`}>
              Se preinscribieron
            </th>
            <th scope="col" className={`${TH} w-[96px] pr-7 text-right`}>
              %
            </th>
          </tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.titulo}>
            <tr className="border-b border-hairline bg-superficie-alterna">
              <th
                scope="colgroup"
                colSpan={5}
                className="px-7 py-2 text-left text-[0.625rem] font-semibold tracking-[0.1em] text-marca uppercase"
              >
                {g.titulo}
              </th>
            </tr>
            {g.lista.length === 0 ? (
              <tr className="border-b border-hairline">
                <td colSpan={5} className={`${TD} pl-7 text-texto-suave`}>
                  Sin visitas en este periodo.
                </td>
              </tr>
            ) : (
              g.visibles.map((f) => (
                <tr key={f.valor ?? "sin"} className="border-b border-hairline">
                  <th scope="row" className={`${TD} pl-7 text-left font-normal text-titulo`}>
                    {g.nombre(f.valor)}
                  </th>
                  <td className={TD_CIFRA}>{n(f.visitas)}</td>
                  <td className={TD_CIFRA}>{n(f.personas)}</td>
                  <td className={TD_CIFRA}>{n(f.envios)}</td>
                  <td
                    className={`${TD_CIFRA} pr-7 ${f.personas < MINIMO_PARA_TASA ? "text-texto-suave" : "font-semibold text-titulo"}`}
                    title={
                      f.personas < MINIMO_PARA_TASA
                        ? `Menos de ${MINIMO_PARA_TASA} personas: aún son pocas para un porcentaje`
                        : undefined
                    }
                  >
                    {tasaDeFila(f)}
                  </td>
                </tr>
              ))
            )}
            {g.resto > 0 && (
              <tr className="border-b border-hairline">
                <td colSpan={5} className="px-7 py-2">
                  <BotonDelResto g={g} alternar={alternar} />
                </td>
              </tr>
            )}
          </tbody>
        ))}
      </table>

      {/* En un celular cinco columnas no caben en 300 px útiles sin
          desplazar de lado: la tabla se vuelve lista, dos renglones
          por fila y las mismas cifras. En papel sale la tabla. */}
      <div className="sm:hidden print:hidden">
        {grupos.map((g) => (
          <section key={g.titulo}>
            <h3 className="border-b border-hairline bg-superficie-alterna px-7 py-2 text-[0.625rem] font-semibold tracking-[0.1em] text-marca uppercase">
              {g.titulo}
            </h3>
            {g.lista.length === 0 ? (
              <p className="px-7 py-3 text-[0.8125rem] text-texto-suave">
                Sin visitas en este periodo.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {g.visibles.map((f) => (
                  <li key={f.valor ?? "sin"} className="px-7 py-2.5">
                    <p className="text-[0.8125rem] leading-snug text-titulo">
                      {g.nombre(f.valor)}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-texto-suave tabular-nums">
                      {n(f.visitas)} {f.visitas === 1 ? "apertura" : "aperturas"} ·{" "}
                      {n(f.personas)} {f.personas === 1 ? "persona" : "personas"} ·{" "}
                      {n(f.envios)} se {f.envios === 1 ? "preinscribió" : "preinscribieron"}
                      {f.personas >= MINIMO_PARA_TASA && ` · ${tasaDeFila(f)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {g.resto > 0 && (
              <p className="border-t border-hairline px-7 py-2">
                <BotonDelResto g={g} alternar={alternar} />
              </p>
            )}
          </section>
        ))}
      </div>
    </Bloque>
  );
}

/// «Ver las otras 6»: dice cuántas y qué pasa al pulsarlo.
function BotonDelResto({
  g,
  alternar,
}: {
  g: { titulo: string; resto: number; abierto: boolean };
  alternar: (titulo: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => alternar(g.titulo)}
      className="text-xs font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
    >
      {g.abierto
        ? `Ver solo las ${n(FILAS_POR_CORTE)} primeras`
        : `Ver ${g.resto === 1 ? "la otra" : `las otras ${n(g.resto)}`}`}
    </button>
  );
}

/// Cuánto cambió, de -1 a +∞. Null si antes no había nada.
function variacion(actual: number, antes: number): number | null {
  if (antes === 0) return actual === 0 ? 0 : null;
  return (actual - antes) / antes;
}

/// «12 de sept» o «8 al 14 de sept», que es lo que hay que leer
/// arriba de una cifra para saber de qué día habla.
function rotulo({ desde, hasta }: { desde: string; hasta: string }): string {
  if (!desde || !hasta) return "";
  if (desde === hasta) return diaCorto(desde);
  /// En el mismo mes, el mes una sola vez: «8 al 14 de sept» y no
  /// «8 de sept al 14 de sept».
  const inicio = desde.slice(0, 7) === hasta.slice(0, 7) ? String(Number(desde.slice(8, 10))) : diaCorto(desde);
  return `${inicio} al ${diaCorto(hasta)}`;
}

/// El periodo dicho DENTRO de una frase. Un rótulo de fechas no se
/// puede pegar detrás de «en»: salía «12 en 8 de sept al 14 de sept».
/// Con fechas va «del 8 al 14 de sept» o «el 8 de sept»; los nombres
/// del servidor («La semana pasada») siguen con su «en».
function enPeriodo(r: string | null | undefined): string {
  if (!r) return "en el otro periodo";
  if (!/^\d/.test(r)) return `en ${r}`;
  return r.includes(" al ") ? `del ${r}` : `el ${r}`;
}

/// El día de hoy en Bogotá, en `YYYY-MM-DD`.
function hoyISO(dias = 0): string {
  const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000 - dias * 86_400_000);
  return ahora.toISOString().slice(0, 10);
}

/**
 * Dos periodos del calendario, uno contra otro.
 *
 * Lo pidió el cliente así: «de tal fecha a tal fecha, hoy contra
 * ayer, un día contra otro en específico». No es un periodo
 * contra su previo — eso ya lo da la serie por día.
 *
 * No se exige que duren igual: «¿esta semana llevamos ya lo de
 * todo el mes pasado?» es una pregunta legítima, y por eso la
 * pantalla enseña los DOS rótulos y nunca «el periodo anterior».
 */
function ComparadorDeFechas({
  a,
  b,
  alCambiarA,
  alCambiarB,
  comparando,
  rango,
  alCambiarRango,
  nota,
}: {
  a: { desde: string; hasta: string };
  b: { desde: string; hasta: string };
  alCambiarA: (v: { desde: string; hasta: string }) => void;
  alCambiarB: (v: { desde: string; hasta: string }) => void;
  comparando: boolean;
  /// Los cuatro rangos viven aquí desde el 20 sep 2026: estaban
  /// arriba, en el encabezado, y la comparación abajo.
  rango: string;
  /// Una línea DENTRO de la caja, bajo una raya: es donde va la nota
  /// del contador, que matiza estos filtros.
  nota?: React.ReactNode;
  alCambiarRango: (r: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  function limpiar() {
    alCambiarA({ desde: "", hasta: "" });
    alCambiarB({ desde: "", hasta: "" });
  }

  function hoyContraAyer() {
    alCambiarA({ desde: hoyISO(0), hasta: hoyISO(0) });
    alCambiarB({ desde: hoyISO(1), hasta: hoyISO(1) });
    setAbierto(true);
  }

  function semanaContraSemana() {
    alCambiarA({ desde: hoyISO(6), hasta: hoyISO(0) });
    alCambiarB({ desde: hoyISO(13), hasta: hoyISO(7) });
    setAbierto(true);
  }

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex flex-wrap gap-1">
          {RANGOS.map((r) => (
            <button
              key={r.valor}
              type="button"
              onClick={() => {
                /// Elegir un rango QUITA la comparación de dos
                /// fechas: si no, se pulsa «30 días» y la pantalla
                /// sigue enseñando las dos fechas de antes sin
                /// decir por qué.
                if (comparando) limpiar();
                alCambiarRango(r.valor);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                rango === r.valor && !comparando
                  ? "bg-marca font-medium text-marca-texto"
                  : "border border-borde bg-superficie text-texto-suave hover:bg-superficie-alterna"
              }`}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-borde sm:block" aria-hidden />
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="rounded-lg border border-campo-borde px-3 py-1.5 text-sm text-texto transition hover:bg-superficie-alterna"
        >
          {abierto ? "Ocultar la comparación" : "Comparar dos fechas"}
        </button>
        <button
          type="button"
          onClick={hoyContraAyer}
          className="rounded-lg px-3 py-1.5 text-sm text-marca underline underline-offset-2"
        >
          Hoy contra ayer
        </button>
        <button
          type="button"
          onClick={semanaContraSemana}
          className="rounded-lg px-3 py-1.5 text-sm text-marca underline underline-offset-2"
        >
          Últimos 7 días contra los 7 anteriores
        </button>
        {comparando && (
          <button
            type="button"
            onClick={limpiar}
            className="ml-auto rounded-lg px-3 py-1.5 text-sm text-texto-suave underline underline-offset-2"
          >
            Quitar la comparación
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Periodo titulo="Periodo A" valor={a} alCambiar={alCambiarA} />
          <Periodo titulo="Contra el periodo B" valor={b} alCambiar={alCambiarB} />
        </div>
      )}

      {abierto && !comparando && (
        <p className="mt-3 text-xs text-texto-suave">
          Hacen falta las cuatro fechas para comparar. Mientras tanto se muestra el
          rango de arriba.
        </p>
      )}

      {/* La nota, a sangre dentro de la caja y bajo una raya: los
          márgenes negativos compensan el relleno de la caja para que la
          raya cruce de canto a canto. */}
      {nota && (
        <div className="-mx-4 -mb-4 mt-4 border-t border-hairline px-4 py-3 text-[0.8125rem] leading-relaxed text-texto-suave">
          {nota}
        </div>
      )}
    </div>
  );
}

function Periodo({
  titulo,
  valor,
  alCambiar,
}: {
  titulo: string;
  valor: { desde: string; hasta: string };
  alCambiar: (v: { desde: string; hasta: string }) => void;
}) {
  const clase =
    "rounded-lg border border-campo-borde bg-campo-fondo px-3 py-1.5 text-sm " +
    "outline-none focus:ring-2 focus:ring-campo-foco";
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium tracking-wide text-texto-suave uppercase">
        {titulo}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={valor.desde}
          max={valor.hasta || undefined}
          onChange={(e) => alCambiar({ ...valor, desde: e.target.value })}
          className={clase}
          aria-label={`${titulo}, desde`}
        />
        <span className="text-sm text-texto-suave">a</span>
        <input
          type="date"
          value={valor.hasta}
          min={valor.desde || undefined}
          onChange={(e) => alCambiar({ ...valor, hasta: e.target.value })}
          className={clase}
          aria-label={`${titulo}, hasta`}
        />
      </div>
    </div>
  );
}

/**
 * Lo de antes del contador, reconstruido del registro del
 * servidor.
 *
 * ABIERTO, como estaba. Se cerró un día para aligerar la pantalla
 * y el cliente lo dio por perdido: «se perdió el Antes del
 * contador». Va al final, así que abierto no le quita sitio a nada
 * de arriba. Las dos cifras van a la derecha del título, como
 * antes, y la gráfica es la misma del Día a día.
 *
 * En local no sale: la tabla `visitas_reconstruidas` está vacía, y
 * sin filas el servidor manda `historico: null`. En producción sí.
 *
 * Tres cosas que el bloque dice en voz alta porque no se
 * pueden saber del registro, y callarlas seria dar por medido
 * lo que no lo esta:
 *
 *   1. NO hay peldanos intermedios. Se sabe quien pidio el
 *      formulario y quien mando el envio; nada de en medio.
 *   2. Un envio pudo ser de alguien que YA estaba: el
 *      servidor contesta 201 en los dos casos.
 *   3. La unidad es una IP en un dia, no una persona.
 */
function Historico({ h }: { h: HistoricoDeTrafico }) {
  /// Con su propio interruptor, como el Día a día: es el mismo tipo de
  /// gráfico --días en el eje-- y el cliente lo revisa en producción,
  /// donde este bloque sí tiene datos («no veo el Antes del contador»,
  /// 23 sep 2026: en local no hay nada reconstruido).
  const [vista, setVista] = useState<"barras" | "tendencia">("barras");
  const dias = h.porDia.map((d) => ({ dia: d.dia, total: d.llegaron }));
  const envios = h.porDia.map((d) => ({ dia: d.dia, total: d.preinscritos }));

  return (
    <Bloque
      titulo="Antes del contador"
      descripcion={
        <>
          Reconstruido del <strong className="font-semibold">registro del servidor</strong>,
          no del contador. Del {fechaCorta(h.desde)} al {fechaCorta(h.hasta)}. No se suma
          a lo de arriba.
        </>
      }
      acciones={
        <div className="flex items-center gap-3">
          <Interruptor valor={vista} alCambiar={setVista} />
          <p className="text-[0.8125rem] whitespace-nowrap text-texto tabular-nums">
            <strong className="font-semibold text-titulo">{n(h.visitas)}</strong> visitas ·{" "}
            <strong className="font-semibold text-titulo">{n(h.envios)}</strong> envíos
          </p>
        </div>
      }
    >
      <DosSeriesPorDia
        modo={vista}
        /// «Aperturas», como en las tarjetas de arriba: el mismo dato no
        /// puede llamarse de dos maneras en la misma pantalla.
        a={{ nombre: "Aperturas", datos: dias }}
        b={{
          nombre: "Enviaron el formulario",
          datos: envios,
          color: "var(--exito)",
        }}
        vacio="No hay nada reconstruido todavía."
      />

      {h.procedencia.length > 0 && (
        <div className="mt-5 border-t border-borde pt-4">
          <p className="text-[0.75rem] font-semibold tracking-[0.04em] text-texto-suave uppercase">
            De dónde venían
          </p>
          <div className="mt-2.5">
            <ListaBarras
              datos={h.procedencia.map((c) => ({
                etiqueta: NOMBRE_PROCEDENCIA[c.valor ?? ""] ?? c.valor ?? "Sin dato",
                valor: c.visitas,
                detalle: c.envios > 0 ? `${n(c.envios)} envíos` : undefined,
              }))}
              maximoFilas={6}
            />
          </div>
        </div>
      )}

      <p className="mt-4 text-[0.75rem] leading-relaxed text-texto-suave">
        El registro sabe quién pidió el formulario y quién lo envió, y{" "}
        <strong>nada de lo que pasa en medio</strong>: los peldaños del embudo
        empiezan con el contador. Un envío de aquí pudo ser de alguien que ya
        estaba registrado —el servidor contesta lo mismo en los dos casos— y la
        unidad es una dirección de internet en un día, no una persona.
      </p>
    </Bloque>
  );
}

/// «2026-09-13» -> «13 de sept». Sin el año: el bloque ya dice
/// el rango entero arriba.
function fechaCorta(dia: string): string {
  return new Date(`${dia}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}
