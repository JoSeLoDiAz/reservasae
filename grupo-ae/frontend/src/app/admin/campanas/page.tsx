"use client";

/** Campañas: a quiénes, qué dice, y cómo va. */

/// Una campaña no se manda: se LANZA, y sale despacio. Por eso
/// esta pantalla enseña dos cosas antes de dejar lanzar —a
/// cuántos le va y cómo queda el correo— y una después: cómo
/// va saliendo. En medio no hay botón de «mandar ya», porque
/// no existe: la cola se vacía sola dentro del horario.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CatalogoDeVariables,
  pegarEnElCursor,
} from "@/components/admin/catalogo-de-variables";
import { ANCHO_FORMULARIO, BloqueDeBanda, Rotulo } from "@/components/admin/bloques";
import { Cargando } from "@/components/admin/piezas";
import { Desplegable } from "@/components/admin/desplegable";
import { IconoDerecha } from "@/components/admin/iconos";
import {
  CifrasDeLaPuerta,
  loQueTrajoLaCampana,
  Plata,
} from "@/components/admin/leads-de-la-puerta";

import {
  Boton,
  CLASE_CONTROL,
  EscogerArchivo,
  useAdmin,
} from "@/components/admin/marco-admin";
import { useToast } from "@/components/admin/toast";
import { CargarBase } from "@/components/admin/cargar-base";
import { CuandoVaASalir } from "@/components/admin/cuando-sale";
import { VistaPreviaCorreo } from "@/components/admin/vista-previa-correo";
import {
  AvisoDeSeccion,
  CabeceraDePantalla,
  Celda,
  ListaEnColumnas,
  Seccion,
  SOLO_ANCHA,
  type ColumnaDeLista,
} from "@/components/admin/secciones";
import {
  Estado as PiezaDeEstado,
  Puerta,
  type TonoDeEstado,
} from "@/components/admin/datos-del-negocio";
import { ErrorApi } from "@/lib/api";
import { enFecha } from "@/lib/en-fecha";
import {
  campanasApi,
  ETIQUETA_ESTADO_CAMPANA,
  type Campana,
  type Resultados,
  type Segmento,
  type SegmentoListo,
} from "@/lib/campanas-api";
import { oportunidadesApi, type ResumenDeVentas } from "@/lib/oportunidades-api";
import type { VariableCorreo } from "@/lib/plantillas-correo-api";

/// La fecha, con el contrato del panel: `9 sep 2026`.
///
/// Vive en `lib/en-fecha` y no aquí: tres pantallas pintaban
/// tres formatos distintos justo por tener cada una el suyo.
const fecha = enFecha;

export default function PaginaCampanas() {
  const { gremio, gremios } = useAdmin();
  const [campanas, setCampanas] = useState<Campana[] | null>(null);
  const [segmentos, setSegmentos] = useState<SegmentoListo[]>([]);
  const [variables, setVariables] = useState<VariableCorreo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [viendo, setViendo] = useState<string | null>(null);

  /// Lo que ha traído cada campaña, del embudo. Si falla no se
  /// dice nada: se viene aquí a lanzar correo, y un error rojo
  /// por una cifra de apoyo tapa lo que sí importa.
  const [resumen, setResumen] = useState<ResumenDeVentas | null>(null);

  const cargar = useCallback(async () => {
    const [lista, segs, vars] = await Promise.all([
      campanasApi.listar(),
      campanasApi.segmentos(),
      campanasApi.variables(),
    ]);
    setCampanas(lista);
    setSegmentos(segs);
    setVariables(vars);
  }, []);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
    void oportunidadesApi.resumen().then(setResumen).catch(() => undefined);
  }, [cargar]);

  /// El gremio de la campaña: el elegido arriba, o el único
  /// que tenga la cuenta. Una campaña SIEMPRE es de un gremio:
  /// una de una línea de negocio no le escribe a la gente de otra.
  const convenioId = gremio ?? (gremios.length === 1 ? gremios[0].convenioId : null);

  if (!campanas) {
    return error ? (
      <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>
    ) : (
      <Cargando />
    );
  }

  /// LO QUE HAN TRAÍDO TODAS, SUMADO UNA VEZ.
  ///
  /// Esta cifra iba a 20/700 dentro de cada una de las diez
  /// filas, y ahí hacía dos daños: diez cifras medianas no son
  /// una cifra grande —la pantalla se quedaba sin la cifra de
  /// portada que pide la dirección— y una cifra de 20 px con su
  /// pie de negocios obliga a una fila de dos renglones, que es
  /// lo que ponía la fila en 143 px.
  ///
  /// Arriba y una sola vez: la fila baja a 33 px y la pantalla
  /// gana su cifra de plata. Son los MISMOS tres indicadores de
  /// Formularios, y a propósito: es la misma plata leída del
  /// otro lado de la puerta, y si se pintara distinto las dos
  /// pantallas volverían a parecer dos productos.
  const total = campanas.reduce(
    (s, c) => {
      const t = loQueTrajoLaCampana(c.nombre, resumen);
      return {
        cuantas: s.cuantas + t.cuantas,
        abierto: s.abierto + t.abierto,
        ganado: s.ganado + t.ganado,
      };
    },
    { cuantas: 0, abierto: 0, ganado: 0 },
  );

  return (
    /// CON cabecera de pantalla, como las otras catorce.
    ///
    /// Sin ella lo más grande de la captura era el nombre de una
    /// campaña en borrador: 21 px en negrita para un borrador,
    /// y ni un título de pantalla que le pusiera techo. La miga
    /// de arriba no cuenta como título: mide 13 px y va en otra
    /// banda.
    ///
    /// Lo que decía la bajada --de a uno, en horario de
    /// Colombia-- lo dice el SERVIDOR en «CuandoVaASalir», al
    /// crear la campaña, que es donde se toma la decisión que
    /// esas reglas gobiernan.
    <div className="flex min-h-0 grow flex-col">
      {/* El botón solo cuando YA hay campañas: con la lista
          vacía, el botón lo pone la invitación de abajo, que
          además dice para qué sirve. */}
      <CabeceraDePantalla
        titulo="Campañas"
        acciones={
          !creando &&
          convenioId &&
          campanas.length > 0 && (
            <Boton onClick={() => setCreando(true)}>Nueva campaña</Boton>
          )
        }
      />

      {/* El ámbar no. En este panel el ámbar significa una sola
          cosa —alguien lleva esperando respuesta— y un aviso de
          validación no es una espera. */}
      {!convenioId && (
        <AvisoDeSeccion color="var(--texto-suave)">
          Elija una línea de negocio arriba para poder crear una campaña. Una campaña es
          siempre de una línea de negocio: la de una no le escribe a la gente de la otra.
        </AvisoDeSeccion>
      )}

      {creando && convenioId && (
        <NuevaCampana
          convenioId={convenioId}
          segmentos={segmentos}
          variables={variables}
          alCerrar={() => setCreando(false)}
          alCrear={async () => {
            await cargar();
            setCreando(false);
          }}
        />
      )}

      {campanas.length === 0 && !creando && (
        <Seccion>
          <div className="px-6 pt-5 pb-6">
            <BloqueDeBanda
              rotulo="Todavía no hay campañas"
              nota="Se escoge a quiénes, se escribe el mensaje y se mira cómo queda antes de lanzarlo."
            >
              {/* El botón, aquí y no solo en la barra: la invitación
                  decía «con Nueva campaña...» señalando a un botón
                  que estaba en otra parte de la pantalla. */}
              {convenioId && (
                <Boton onClick={() => setCreando(true)}>Nueva campaña</Boton>
              )}
            </BloqueDeBanda>
          </div>
        </Seccion>
      )}

      {/* LA LISTA, EN COLUMNAS.

          Cada campaña ocupaba el ancho entero y apilaba sus
          siete datos en el 25 % izquierdo: nombre, estado,
          línea, destinatarios, asunto, fechas y acciones, uno
          debajo de otro. Así se lee UN RENGLÓN A LA VEZ, y una
          lista de cuarenta campañas no se lee de a un renglón:
          se baja la vista por «a cuántos» y se comparan los
          cuarenta, se baja por «lanzada» y se comparan las
          fechas.

          El sobrante NO se deja a la derecha: se reparte entre
          las ocho columnas, y quien absorbe lo que quede es el
          ASUNTO --ver el asunto entero antes de lanzarle a 300
          personas es la razón de mirar esta pantalla--. El
          nombre topa en 340 px: es un mango interno, no un
          texto que crezca. */}
      {campanas.length > 0 && (
        <>
          {/* La cifra de portada de la pantalla, y es plata.
              Es la MISMA que enseña Formularios, leída del otro
              lado: un formulario publicado es una campaña. Iba
              repetida a 20 px en cada una de las diez filas, y
              diez cifras de 20 px son diez cifras medianas, no
              una grande: sumada una vez arriba, la fila baja de
              143 px a 33 y la pantalla gana la cifra que le
              faltaba. */}
          {total.cuantas > 0 && (
            <Seccion>
              <div className="px-6 py-5">
                <CifrasDeLaPuerta
                  cuantas={total.cuantas}
                  abierto={total.abierto}
                  ganado={total.ganado}
                />
              </div>
            </Seccion>
          )}

          {/* A sangre y sin marco: la banda ya la delimita. La
              caja, la cabecera, el desplazamiento por dentro y
              la consulta de contenedor los pone
              `ListaEnColumnas`: es la misma maqueta que usa
              Plantillas, y escrita dos veces divergiría el día
              que alguien tocara una sola. */}
          <ListaEnColumnas
            rejilla={REJILLA}
            anchoMinimo={ANCHO_MINIMO}
            columnas={CABECERAS}
          >
            {campanas.map((c) => (
              <Fila
                key={c.id}
                campana={c}
                trajo={loQueTrajoLaCampana(c.nombre, resumen)}
                abierta={viendo === c.id}
                alAbrir={() => setViendo(viendo === c.id ? null : c.id)}
                alRecargar={cargar}
              />
            ))}
          </ListaEnColumnas>
        </>
      )}
    </div>
  );
}

/* ── la maqueta de la lista ──────────────────────────────── */

/**
 * DOS JUEGOS DE COLUMNAS, y el ancho decide cuál.
 *
 * Ocho columnas llenan 1204 px —la banda a 1440— y dejan 480 px
 * de sobrante a 1920. Repartir ese sobrante entre las ocho da
 * una columna de asunto de 640 px para un asunto de 280: no es
 * una columna, es el hueco otra vez, con un rótulo encima.
 *
 * Por eso el sobrante se gasta ABRIENDO COLUMNA, no ensanchando
 * la que hay: a partir de 1600 px de banda entran «creada» y
 * «por», que son dos datos que sí se comparan entre filas y que
 * a 1440 no caben. Ocho columnas a 1440, diez a 1920, y en las
 * dos la fila llega al canto derecho.
 *
 * Es consulta de CONTENEDOR y no de ventana a propósito: la
 * barra lateral se pliega, y con ella la banda gana 180 px sin
 * que la ventana cambie de tamaño. Lo que decide es el ancho que
 * tiene la lista, que es lo que el ojo mide.
 */
const COLUMNAS_BASE =
  "grid-cols-[minmax(150px,340px)_104px_184px_104px_minmax(240px,1fr)_100px_128px_116px]";

const COLUMNAS_ANCHAS =
  "@[1600px]:grid-cols-[minmax(150px,340px)_104px_184px_104px_minmax(240px,1fr)_100px_128px_100px_128px_116px]";

/// La rejilla de una fila y la de la cabecera son la misma, y se
/// escriben una vez: si se separaran, el rótulo dejaría de estar
/// encima de su dato el día que alguien tocara un ancho.
const REJILLA = `grid ${COLUMNAS_BASE} ${COLUMNAS_ANCHAS}`;

/// `SOLO_ANCHA` —lo que en estrecho no se encoge sino que
/// DESAPARECE— y `Celda` viven en `secciones.tsx` desde que los
/// usa la segunda lista.

/**
 * Por qué cada ancho es el que es.
 *
 * Ocho fijas, dos elásticas, y una sola absorbe el sobrante que
 * quede después de abrir columna. Una columna elástica de
 * 1400 px no es una columna: es la fila entera otra vez.
 *
 * - Campaña `minmax(150px, 340px)`: es un mango interno y la
 *   gente los escribe cortos. Topa en 340 —unos 50 caracteres—
 *   porque a partir de ahí solo le quita ancho al asunto.
 * - Estado 104: cabe «Terminada» con su punto y ni un píxel más.
 *   Fija a propósito: la rampa de color solo se lee en vertical
 *   si el rótulo arranca siempre en la misma x.
 * - Línea 184: cabe «GRUPO AE · Personas» entero. Es la columna
 *   que NO se recorta: una campaña de empresas y una de personas
 *   se lanzan con reglas distintas y a gente distinta, y
 *   confundirlas es escribirle a quien no era.
 * - A cuántos 104, Creada 100, Lanzada 100, Ha traído 128: el
 *   ancho de su dato con `tabular-nums`, y el rótulo sin partir.
 *   Todas a la derecha, que es donde se comparan las cifras.
 * - De dónde 128: «De su base» o «De un archivo». Solo con la
 *   banda ancha, y no es relleno: de un archivo solo se conocen
 *   el correo y el primer nombre, así que una plantilla con
 *   {{grupo}} o {{asesor}} deja gente fuera. Saber de cuál es
 *   cada campaña antes de abrirla es la diferencia entre mandar
 *   y mandar bien.
 * - Asunto `minmax(240px, 1fr)`: ABSORBE. Es el único dato de la
 *   fila que va a leer alguien de fuera, y recortarlo esconde
 *   justo lo que se viene a revisar antes de lanzarle a 300
 *   personas.
 * - Acciones 116, al final de la fila y con alto constante.
 *   Colgaban debajo del texto, y por eso una fila con «Lanzar»
 *   medía 159 px y una sin él 143: dos alturas en la misma
 *   lista, y una lista con dos alturas no se escanea.
 */
const ANCHO_MINIMO = 1174;

/// Los rótulos, en la voz de la casa: el formulario pregunta «a
/// quiénes» y «a cuántos le va», así que la columna se llama «a
/// cuántos» y no «destinatarios».
///
/// El `title` de «a cuántos» es donde vive lo único que se perdió
/// al quitar los cinco renglones de «Cómo sale, y por qué así»:
/// el POR QUÉ del tope. El cuándo y el cuánto los dice el
/// servidor en `CuandoVaASalir`, dentro del formulario, que es
/// donde se toma la decisión que esas reglas gobiernan.
const CABECERAS: ColumnaDeLista[] = [
  { texto: "Campaña" },
  { texto: "Estado" },
  { texto: "Línea" },
  {
    texto: "A cuántos",
    alineado: "text-right",
    ayuda:
      "El tope diario no es por velocidad: lo que hace que Google cierre una cuenta es pasarse del cupo del día y que la gente marque spam. El cupo y el horario los dice el servidor al crear la campaña.",
  },
  { texto: "Asunto" },
  { texto: "Creada", alineado: "text-right", soloAncha: true },
  { texto: "De dónde", soloAncha: true },
  { texto: "Lanzada", alineado: "text-right" },
  { texto: "Ha traído", alineado: "text-right" },
  { texto: "" },
];

/**
 * Una campaña: una fila de 33 px y ocho columnas.
 *
 * La FILA ENTERA abre y cierra los resultados. La columna de
 * acciones lleva solo lo que CAMBIA el estado —lanzar, pausar,
 * reanudar—, que es la distinción que deja la columna en 128 px:
 * mirar es la fila, actuar es el canto.
 *
 * Y «Lanzar» pregunta antes. Era un botón azul relleno y ahora es
 * un enlace de 13 px —cuarenta botones rellenos en una lista de
 * cuarenta campañas es lo que hacía ruido en Plantillas—, pero
 * lanzar le manda correo a trescientas personas y no se deshace.
 * Lo que se quita en peso visual se devuelve en un paso: el
 * cuántos ya está en su columna, dos a la izquierda.
 */
function Fila({
  campana: c,
  trajo,
  abierta,
  alAbrir,
  alRecargar,
}: {
  campana: Campana;
  trajo: { cuantas: number; abierto: number };
  abierta: boolean;
  alAbrir: () => void;
  alRecargar: () => Promise<void>;
}) {
  const toast = useToast();

  const linea = sigla(c);

  /// Lo que solo se lee al detenerse en UNA campaña no gasta una
  /// columna: quién la creó y cuándo no se compara entre filas.
  /// Va en el `title` del nombre.
  const ficha =
    `Creada el ${fecha(c.creadoEn)}` +
    (c.creadoPor ? ` por ${c.creadoPor.nombre}` : "") +
    (c.origen === "CARGUE" ? " · de un archivo" : " · de su base") +
    (c.lanzadaEn ? ` · lanzada el ${fecha(c.lanzadaEn)}` : "");

  function accion(llamada: Promise<unknown>, dicho: string): void {
    void llamada
      .then(() => alRecargar())
      .then(() => toast.exito(dicho))
      .catch((e) => toast.error((e as ErrorApi).message));
  }

  return (
    <>
      <div
        onClick={alAbrir}
        className={`dato ${REJILLA} cursor-pointer items-center border-b border-hairline transition hover:bg-tabla-fila-resaltada ${
          abierta ? "bg-tabla-fila-resaltada" : ""
        }`}
      >
        <Celda primera className="text-titulo" titulo={`${c.nombre} — ${ficha}`}>
          {c.nombre}
        </Celda>

        <Celda>
          <Estado estado={c.estado} />
        </Celda>

        {/* Lo que se repite en las cuarenta filas se apaga y la
            columna pasa a leerse por lo que la diferencia. Es el
            mismo criterio que el sufijo societario y la puerta. */}
        <Celda titulo={c.convenio.nombre}>
          <Puerta campana={linea} />
        </Celda>

        <Celda className="text-right tabular-nums">
          {c._count.destinatarios > 0 ? (
            c._count.destinatarios
          ) : (
            <span className="text-texto-suave">—</span>
          )}
        </Celda>

        <Celda titulo={c.asunto}>{c.asunto}</Celda>

        {/* CREADA y DE DÓNDE salen a partir de 1600 px de banda,
            que es donde hay ancho para ellas. No son relleno:
            una campaña creada hace tres semanas y todavía sin
            lanzar es justo el silencio que este panel persigue, y
            eso solo se ve comparando la columna de creadas contra
            la de lanzadas. A 1440 no caben y se van al `title`
            del nombre. */}
        <Celda className={`${SOLO_ANCHA} text-right tabular-nums`}>
          {fecha(c.creadoEn)}
        </Celda>

        <Celda className={SOLO_ANCHA}>
          {c.origen === "CARGUE" ? "De un archivo" : "De su base"}
        </Celda>

        {/* Sin lanzar es una raya, y la raya es el dato: en una
            columna de fechas, los huecos son las campañas que
            todavía no han salido. */}
        <Celda className="text-right tabular-nums">
          {c.lanzadaEn ? (
            fecha(c.lanzadaEn)
          ) : (
            <span className="text-texto-suave">—</span>
          )}
        </Celda>

        <Celda className="text-right">
          {trajo.cuantas > 0 ? (
            <Plata valor={trajo.abierto} />
          ) : (
            <span className="text-texto-suave">—</span>
          )}
        </Celda>

        {/* El canto: la acción y la flecha que dice que la fila
            se abre. Pausar y reanudar se pulsan sin abrir la
            fila, de ahí el `stopPropagation`.

            «Lanzar» NO. Lanzar abre la fila y pregunta abajo,
            donde hay ancho para las tres cosas que hay que saber
            antes de mandarle correo a trescientas personas: a
            cuántos les va, cuándo va a salir de verdad —lo dice
            el servidor, no una frase escrita a mano— y un sí que
            hay que pulsar aparte. En 116 px no cabe una pregunta;
            en el ancho de la fila abierta, sí. */}
        <Celda ultima className="flex items-center justify-end gap-3 text-right">
          <span
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-3"
          >
            {c.estado === "BORRADOR" && (
              <button type="button" className="text-marca" onClick={alAbrir}>
                Lanzar
              </button>
            )}
            {c.estado === "ENVIANDO" && (
              <button
                type="button"
                className="text-texto-suave"
                onClick={() =>
                  accion(campanasApi.pausar(c.id), "Pausada. No sale ninguno más.")
                }
              >
                Pausar
              </button>
            )}
            {c.estado === "PAUSADA" && (
              <button
                type="button"
                className="text-marca"
                onClick={() => accion(campanasApi.reanudar(c.id), "Sigue saliendo.")}
              >
                Reanudar
              </button>
            )}
          </span>
          {/* La flecha del final es el único control de la fila
              que estaba bien: dice que hay algo debajo. Lo que
              estaba mal era que viviera a 1400 px de su propia
              fila, sin nada en medio. */}
          <IconoDerecha
            tamano={12}
            className={`shrink-0 text-texto-suave transition-transform ${
              abierta ? "rotate-90" : ""
            }`}
          />
        </Celda>
      </div>

      {/* EL DETALLE OCUPA LA FILA ENTERA. El sobrante de la
          pantalla se reparte entre las columnas; el de una fila
          abierta se dedica a la segunda región útil, que según el
          estado de la campaña es una de dos: cómo va saliendo, o
          la pregunta de si sale. */}
      {abierta && (
        <div className="border-b border-borde bg-superficie-alterna px-6 py-5">
          {c.estado === "BORRADOR" ? (
            <Lanzar
              campana={c}
              alLanzar={() =>
                accion(campanasApi.lanzar(c.id), "Lanzada. Va a salir de a poco.")
              }
              alCerrar={alAbrir}
            />
          ) : (
            <ResultadosDe id={c.id} />
          )}
        </div>
      )}
    </>
  );
}
/// El estado en la LETRA y en peso 600, que es el peso reservado
/// del panel: verlo significa «esto es la etapa o el resultado
/// de algo».
///
/// Es una rampa, no un arcoíris. Borrador está apagado —todavía
/// no es nada—, Enviando está en marcha, Terminada es el único
/// verde. Y Pausada es lo único cálido de la pantalla, porque
/// una campaña pausada es una campaña ESPERANDO A ALGUIEN, que
/// es lo único que este panel pinta en ámbar.
function Estado({ estado }: { estado: Campana["estado"] }) {
  /// La forma la pone la PIEZA COMPARTIDA, no esta pantalla.
  ///
  /// Aquí había un `<span>` con su tamaño y su peso escritos a
  /// mano, y otro igual en Formularios y otro en Habeas Data:
  /// tres copias de una decisión que es una sola. Un estado de
  /// campaña y una etapa de negocio son la misma clase de dato
  /// y por eso se escriben igual —punto de color, 6 px de aire
  /// y el rótulo del mismo color—; si se pintaran distinto, las
  /// quince pantallas volverían a leerse como dos productos.
  const tono: Record<Campana["estado"], TonoDeEstado> = {
    BORRADOR: "apagado",
    ENVIANDO: "activo",
    PAUSADA: "espera",
    TERMINADA: "exito",
  };
  return (
    <PiezaDeEstado tono={tono[estado]}>
      {ETIQUETA_ESTADO_CAMPANA[estado]}
    </PiezaDeEstado>
  );
}

/**
 * La pregunta de lanzar, con lo que hay que saber para contestarla.
 *
 * Aquí vive lo que antes eran cinco renglones de prosa ENCIMA de
 * la lista —«Cómo sale, y por qué así»— y que además estaban
 * escritos a mano: el horario y el cupo los sabe el servidor, y
 * copiarlos en el JSX creaba dos verdades que se separan el día
 * que alguien cambie el horario. `CuandoVaASalir` los pide y los
 * dice, y los dice AQUÍ, que es el único momento en que le
 * cambian algo a alguien.
 *
 * El texto que explica una política del sistema vive donde se
 * toma la decisión que esa política gobierna. Encima de una lista
 * no gobierna nada: solo la empuja 192 px hacia abajo.
 */
function Lanzar({
  campana: c,
  alLanzar,
  alCerrar,
}: {
  campana: Campana;
  alLanzar: () => void;
  alCerrar: () => void;
}) {
  const cuantos = c._count.destinatarios;

  return (
    <div className="flex flex-wrap items-start gap-x-16 gap-y-5">
      <div>
        <Rotulo>Lanzar</Rotulo>
        <p className="dato mt-2">
          Le va a{" "}
          <strong className="font-normal tabular-nums text-titulo">
            {cuantos.toLocaleString("es-CO")}
          </strong>{" "}
          {cuantos === 1 ? "persona" : "personas"} de {sigla(c)}.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <Boton onClick={alLanzar} disabled={cuantos === 0}>
            Sí, lanzar
          </Boton>
          <button
            type="button"
            onClick={alCerrar}
            className="text-texto-suave"
            style={{ fontSize: "0.71875rem" }}
          >
            Ahora no
          </button>
        </div>
      </div>

      {/* CUÁNDO va a salir, del servidor. Sin esto se lanza a las
          siete de la noche, no sale nada y parece roto. */}
      {cuantos > 0 && (
        <div className="max-w-[68ch]">
          <Rotulo>Cuándo sale</Rotulo>
          <div className="mt-2">
            <CuandoVaASalir cuantos={cuantos} />
          </div>
        </div>
      )}
    </div>
  );
}

/// La sigla de la línea, que es como se nombra en las dos
/// pantallas donde aparece.
function sigla(c: Campana): string {
  return c.convenio.sigla ?? c.convenio.nombre;
}

function ResultadosDe({ id }: { id: string }) {
  const [r, setR] = useState<Resultados | null>(null);

  useEffect(() => {
    let vivo = true;
    const traer = () =>
      campanasApi
        .resultados(id)
        .then((x) => vivo && setR(x))
        .catch(() => undefined);
    void traer();
    // mientras está enviando, se mueve solo
    const t = setInterval(traer, 20_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [id]);

  if (!r) return <p className="text-texto-suave" style={{ fontSize: "0.8125rem" }}>Cargando…</p>;

  return (
    /// Sin caja: son cuatro cifras dentro de una banda, y cuatro
    /// marcos dentro de otro marco es lo que hacía que aquí
    /// hubiera tres bordes anidados para leer un número.
    <div className="flex flex-wrap items-start gap-x-16 gap-y-6">
      <div>
        <div className="flex flex-wrap gap-x-12 gap-y-5">
          <Cifra titulo="Enviados" valor={r.enviados} de={r.total} />
          <Cifra titulo="Por salir" valor={r.pendientes} />
          <Cifra titulo="Hicieron clic" valor={r.conClic} de={r.enviados} />
          <Cifra titulo="Aperturas (aprox.)" valor={r.aperturasEstimadas} estimada />
        </div>

        {(r.fallidos > 0 || r.omitidos > 0) && (
          <p className="mt-4 text-texto-suave" style={{ fontSize: "0.71875rem" }}>
            {r.fallidos > 0 && `${r.fallidos} fallaron. `}
            {r.omitidos > 0 && `${r.omitidos} se omitieron (sin correo o sin datos).`}
          </p>
        )}
      </div>

      {/* El aviso va PEGADO al número, no en una nota al pie:
          quien lea «112 aperturas» sin esto va a tomar una
          decisión con un dato inflado.

          Sin fondo amarillo: `--aviso-suave` se usa en un solo
          sitio del panel, la franja de entorno de pruebas. Aquí
          basta con que esté pegado a la cifra. */}
      <p
        className="max-w-[68ch] text-texto-suave"
        style={{ fontSize: "0.71875rem", lineHeight: 1.55 }}
      >
        <strong className="font-normal text-texto">
          Las aperturas son una estimación, y tiran para arriba.
        </strong>{" "}
        Gmail descarga la imagen que las mide antes de que nadie lea nada, y Apple
        Mail la pide por todos sus usuarios. El número que sí es firme es el de
        clics: ese pasa por nuestro servidor, con una persona pulsando.
      </p>
    </div>
  );
}

function Cifra({
  titulo,
  valor,
  de,
  estimada,
}: {
  titulo: string;
  valor: number;
  de?: number;
  /// EL GRIS SIGNIFICA «ESTO ES UN SUPUESTO».
  ///
  /// Es una regla de este producto: una cifra medida —enviados,
  /// clics— va en `--titulo`; una estimada por la forma del
  /// dato se apaga. Así se sabe qué número se puede llevar a
  /// una reunión sin leer la nota al pie.
  estimada?: boolean;
}) {
  return (
    <div>
      <Rotulo>{titulo}</Rotulo>
      <p
        className="mt-2 font-bold leading-none tabular-nums"
        style={{
          fontSize: "1.25rem",
          letterSpacing: "-0.02em",
          color: estimada ? "var(--texto-suave)" : "var(--titulo)",
        }}
      >
        {valor.toLocaleString("es-CO")}
        {de !== undefined && de > 0 && (
          <span
            className="ml-1.5 text-texto-suave"
            style={{ fontSize: "0.71875rem", fontWeight: 400 }}
          >
            de {de.toLocaleString("es-CO")}
          </span>
        )}
      </p>
    </div>
  );
}

function NuevaCampana({
  convenioId,
  segmentos,
  variables,
  alCerrar,
  alCrear,
}: {
  convenioId: string;
  segmentos: SegmentoListo[];
  variables: VariableCorreo[];
  alCerrar: () => void;
  alCrear: () => Promise<void>;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [clave, setClave] = useState(segmentos[0]?.clave ?? "");
  const [cuantos, setCuantos] = useState<number | null>(null);
  const [banner, setBanner] = useState<File | null>(null);

  /// Lo mismo que en Plantillas de correo, y por lo mismo: el
  /// catálogo de variables se abre donde se escribe, y la
  /// vista previa se pliega para poder dejarla abierta sin que
  /// empuje el formulario fuera de pantalla.
  const cajaCuerpo = useRef<HTMLTextAreaElement>(null);
  const [catalogoAbierto, setCatalogoAbierto] = useState(false);
  const [previaAbierta, setPreviaAbierta] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  /// De dónde salen los destinatarios. Por defecto de la
  /// base, que es lo que se hace casi siempre.
  const [origen, setOrigen] = useState<"SEGMENTO" | "CARGUE">("SEGMENTO");
  /// La de cargue se crea primero y se le sube la lista
  /// después: hace falta su id para colgarle el archivo.
  const [reciencreada, setReciencreada] = useState<string | null>(null);

  const elegido = segmentos.find((s) => s.clave === clave);
  const segmento: Segmento = elegido?.segmento ?? {};

  /// A cuántos le va, y se pregunta al cambiar de segmento.
  /// Lanzar sin saber a cuántos es como se le escribe a
  /// cuatrocientas personas por error.
  useEffect(() => {
    if (!elegido) return;
    setCuantos(null);
    campanasApi
      .aCuantos(convenioId, elegido.segmento)
      .then((r) => setCuantos(r.total))
      .catch(() => setCuantos(null));
  }, [clave, convenioId, elegido]);

  async function crear() {
    setOcupado(true);
    try {
      const c = await campanasApi.crear({
        convenioId,
        nombre,
        asunto,
        cuerpo,
        segmento,
        origen,
      });
      if (banner) await campanasApi.subirBanner(c.id, banner);

      /// La de cargue NO cierra el formulario todavía: aquí
      /// mismo se le sube la lista. Cerrar y mandar a buscarla
      /// a la tabla para subir el archivo sería partir en dos
      /// una sola tarea.
      if (origen === "CARGUE") {
        setReciencreada(c.id);
        toast.exito("Campaña creada. Ahora súbale la lista de correos.");
        return;
      }

      toast.exito("Campaña creada. Revísela y láncela cuando quiera.");
      await alCrear();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Seccion>
      <div className="px-6 pt-5 pb-6">
      <Rotulo className="mb-4">Nueva campaña</Rotulo>
      {/* UNA COLUMNA, y la vista previa al final.

          Fue mitad y mitad —el formulario a la izquierda, la
          vista pegada arriba a la derecha—, y eso resolvía lo
          de antes: una barra lateral de 24rem donde el correo
          salía tan angosto que no parecía un correo.

          Pero media pantalla tampoco alcanza. Un correo se
          maqueta a 600 px y la columna daba menos, así que
          seguía enseñándose encogido, que es justo lo que no
          se quería. Con el ancho entero cabe de verdad, y de
          paso cabe verlo en el ancho de cada dispositivo.

          Lo que se pierde —tenerla al lado mientras se
          teclea— se recupera plegándola: se deja abierta y se
          baja a mirarla, o se cierra y no estorba. */}
      {/* EL FORMULARIO TOPA EN 720 PX.
          Un campo de correo no mide 1350 px de ancho nunca: el
          contenido de trabajo —tablas y tablero— va a sangre,
          pero un formulario es prosa con casillas. */}
      <div className={`${ANCHO_FORMULARIO} space-y-5`}>
          <div>
            <label
              htmlFor="c-nombre"
              className="mb-1.5 block"
              style={{ fontSize: "0.8125rem" }}
            >
              Cómo la va a reconocer
            </label>
            <input
              id="c-nombre"
              className={CLASE_CONTROL}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Recordatorio de datos pendientes"
            />
          </div>

          {/* De dónde sale la lista. Va ANTES del segmento
              porque decide si el segmento pinta algo. */}
          <div>
            <p className="mb-1.5" style={{ fontSize: "0.8125rem" }}>
              De dónde sale la lista
            </p>
            {/* Con aire entre las dos. Pegadas se leían como un
                solo control partido por una raya, y no lo son:
                son dos caminos distintos y excluyentes.

                Lo elegido se marca con el azul de marca en el
                BORDE y en la letra, no con un fondo teñido:
                `--marca-suave` tiene dos sitios en el panel y
                este no es ninguno. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["SEGMENTO", "De su base", "Con reglas sobre los leads"],
                  ["CARGUE", "De un archivo", "Correo y primer nombre, en .xlsx"],
                ] as Array<["SEGMENTO" | "CARGUE", string, string]>
              ).map(([valor, titulo, pie]) => (
                <button
                  key={valor}
                  type="button"
                  disabled={Boolean(reciencreada)}
                  onClick={() => setOrigen(valor)}
                  className={`rounded-[6px] border p-3 text-left transition disabled:opacity-50 ${
                    origen === valor
                      ? "border-marca"
                      : "border-campo-borde hover:bg-superficie-alterna"
                  }`}
                >
                  <span
                    className={`block ${origen === valor ? "text-marca" : "text-texto"}`}
                    style={{ fontSize: "0.8125rem" }}
                  >
                    {titulo}
                  </span>
                  <span
                    className="mt-0.5 block text-texto-suave"
                    style={{ fontSize: "0.71875rem" }}
                  >
                    {pie}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {origen === "CARGUE" && (
            <div
              className="border-t border-hairline pt-4 text-texto-suave"
              style={{ fontSize: "0.71875rem", lineHeight: 1.55 }}
            >
              {reciencreada ? (
                <CargarBase
                  campanaId={reciencreada}
                  alCargar={() => void alCrear()}
                />
              ) : (
                <>
                  De un archivo solo se conocen el correo y el primer nombre.
                  Una plantilla que use <code>{"{{grupo}}"}</code> o{" "}
                  <code>{"{{asesor}}"}</code> no tendrá con qué llenarlos, y a
                  esas personas se las omite con su motivo.
                  <br />
                  Primero se crea la campaña y enseguida se le sube la lista.
                </>
              )}
            </div>
          )}

          <div className={origen === "CARGUE" ? "hidden" : undefined}>
            <label htmlFor="c-seg" className="mb-1.5 block" style={{ fontSize: "0.8125rem" }}>
              A quiénes
            </label>
            {/* El desplegable de la casa, no el del sistema
                operativo: el nativo se pinta distinto en cada
                navegador y no obedece al tema --en oscuro salía
                una lista blanca--. Y de paso cabe el `para` de
                cada segmento como segunda línea, que hoy solo
                se leía DESPUÉS de elegir: elegir a ciegas y
                enterarse luego es justo lo que no se quiere
                cuando lo siguiente es mandarle un correo a
                trescientas personas. */}
            <Desplegable
              id="c-seg"
              valor={clave}
              alElegir={setClave}
              opciones={segmentos.map((s) => ({
                valor: s.clave,
                etiqueta: s.titulo,
                detalle: s.para,
              }))}
            />
            {elegido && (
              <p className="mt-1.5 max-w-[68ch] text-texto-suave" style={{ fontSize: "0.71875rem" }}>
                {elegido.para}{" "}
                {cuantos === null ? (
                  "Contando…"
                ) : (
                  <strong className="font-normal tabular-nums text-texto">
                    Hoy son {cuantos.toLocaleString("es-CO")}.
                  </strong>
                )}
              </p>
            )}

            {/* Y CUÁNDO va a salir. Lanzar sin saberlo es
                lanzar a las siete de la noche, no ver nada, y
                creer que está roto. */}
            {cuantos !== null && cuantos > 0 && (
              <div className="mt-3">
                <CuandoVaASalir cuantos={cuantos} />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="c-asunto" className="mb-1.5 block" style={{ fontSize: "0.8125rem" }}>
              Asunto
            </label>
            <input
              id="c-asunto"
              className={CLASE_CONTROL}
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="{{primerNombre}}, le faltan unos datos"
            />
          </div>

          <div>
            <label htmlFor="c-cuerpo" className="mb-1.5 block" style={{ fontSize: "0.8125rem" }}>
              El mensaje
            </label>
            <textarea
              id="c-cuerpo"
              ref={cajaCuerpo}
              rows={12}
              className={`${CLASE_CONTROL} tabular-nums`}
              style={{ fontSize: "0.8125rem", lineHeight: 1.55 }}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder={"{{saludo}}:\n\nPara avanzar con su solicitud nos faltan unos datos suyos."}
            />
            <p className="mt-1.5 max-w-[68ch] text-texto-suave" style={{ fontSize: "0.71875rem" }}>
              Si escribe un enlace, se cuenta quién le da clic.
            </p>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setCatalogoAbierto(!catalogoAbierto)}
                className="inline-flex items-center gap-2 rounded-[6px] border border-campo-borde bg-superficie px-3 py-2 text-marca transition hover:border-marca"
                style={{ fontSize: "0.8125rem" }}
              >
                <span className="text-[15px] leading-none">+</span> Insertar dato
                <IconoDerecha
                  tamano={12}
                  className={`transition-transform ${catalogoAbierto ? "rotate-90" : ""}`}
                />
              </button>
              <span className="ml-2.5 text-texto-suave" style={{ fontSize: "0.71875rem" }}>
                Se pega donde esté el cursor.
              </span>

              {catalogoAbierto && (
                <CatalogoDeVariables
                  variables={variables}
                  alPegar={(clave) => {
                    setCatalogoAbierto(false);
                    setCuerpo((c) =>
                      pegarEnElCursor(cajaCuerpo.current, c, clave),
                    );
                  }}
                />
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 block" style={{ fontSize: "0.8125rem" }}>
              Banner del encabezado (opcional)
            </p>
            <EscogerArchivo
              id="c-banner"
              acepta="image/png,image/jpeg,image/webp"
              archivo={banner}
              alElegir={setBanner}
              etiqueta="Elegir imagen"
              vacio="Sin banner"
            />
            {/* SVG no: Gmail y Outlook no lo dibujan y quedaría
                un hueco blanco justo arriba del correo. */}
            <p className="mt-1.5 max-w-[68ch] text-texto-suave" style={{ fontSize: "0.71875rem" }}>
              PNG, JPG o WebP, hasta 2 MB. Ancho recomendado 600 px. El SVG no
              sirve: Gmail y Outlook no lo dibujan.
            </p>
          </div>

          {/* La vista previa, A LO ANCHO y plegable.
              Estaba en una columna de la mitad, y ahí el correo
              no cabe: un mensaje se maqueta a 600 px y la
              columna daba menos. Con el ancho entero se puede
              enseñar tal como sale --y en el ancho de cada
              dispositivo--, que en una campaña importa más que
              en una plantilla: esto sale a cientos, y casi
              todos lo abren en el celular. */}
          <div>
            <button
              type="button"
              onClick={() => setPreviaAbierta(!previaAbierta)}
              className="flex w-full items-center gap-2.5 border-t border-hairline pt-4 text-left"
            >
              <span className="font-bold uppercase text-texto-suave" style={{ fontSize: "0.625rem", letterSpacing: "0.11em" }}>
                Así va a salir
              </span>
              <span className="text-texto-suave" style={{ fontSize: "0.65625rem" }}>
                Con datos de ejemplo
              </span>
              <span className="ml-auto text-texto-suave" style={{ fontSize: "0.71875rem" }}>
                {previaAbierta ? "Ocultar" : "Ver"}
              </span>
              <IconoDerecha
                tamano={12}
                className={`text-texto-suave transition-transform ${
                  previaAbierta ? "rotate-90" : ""
                }`}
              />
            </button>

            {previaAbierta && (
              <div className="mt-3">
                <VistaPreviaCorreo
                  variante="carta"
                  asunto={asunto}
                  cuerpo={cuerpo}
                  variables={variables}
                  banner={banner}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-4">
            <Boton
              onClick={() => void crear()}
              disabled={ocupado || !nombre || !asunto || !cuerpo}
            >
              {ocupado ? "Creando…" : "Crear como borrador"}
            </Boton>
            <button type="button" onClick={alCerrar} className="text-texto-suave" style={{ fontSize: "0.71875rem" }}>
              Cancelar
            </button>
            <span className="text-texto-suave" style={{ fontSize: "0.71875rem" }}>
              Crear no manda nada. Se lanza después, cuando la haya revisado.
            </span>
          </div>
      </div>
      </div>
    </Seccion>
  );
}
