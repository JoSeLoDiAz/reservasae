"use client";

/** Las plantillas de correo: escribirlas una vez. */

/// Lo que cambia de una persona a otra va entre llaves. Esta
/// pantalla tiene que hacer dos cosas bien: enseñar CUÁLES
/// existen —a mano, para poder pegarlas— y no dejar guardar
/// una variable que no existe. Lo segundo es lo que evita que
/// salga «Estimado {{nombreDePila}}» a cuarenta personas.
///
/// Son DOS vistas y no una, y ese fue el arreglo principal.
/// Antes el editor salía encima de la lista y la lista seguía
/// debajo, entera: se editaba una plantilla con las otras
/// cinco a la vista y sin ninguna señal de cuál se estaba
/// tocando. Ahora la lista es una tabla de una fila por
/// plantilla —el cuerpo se ve al desplegarla, no siempre— y
/// editar se lleva la pantalla completa.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CatalogoDeVariables,
  pegarEnElCursor,
} from "@/components/admin/catalogo-de-variables";
import { ANCHO_FORMULARIO, BloqueDeBanda, Rotulo } from "@/components/admin/bloques";
import { Cargando } from "@/components/admin/piezas";
import { Desplegable } from "@/components/admin/desplegable";
import { IconoDerecha, IconoIzquierda } from "@/components/admin/iconos";
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
  Boton,
  CLASE_CONTROL,
  useAdmin,
} from "@/components/admin/marco-admin";
import { useToast } from "@/components/admin/toast";
import {
  ejemplosDe,
  resolver,
  VistaPreviaCorreo,
} from "@/components/admin/vista-previa-correo";
import { ErrorApi } from "@/lib/api";
import { Estado, Fecha } from "@/components/admin/datos-del-negocio";
import {
  plantillasCorreoApi,
  urlDelCabezote,
  type PlantillaCorreo,
  type VariableCorreo,
} from "@/lib/plantillas-correo-api";

/// TODAS las etapas, agrupadas por momento.
///
/// El primer intento dejó fuera las de salida —perdido,
/// retirado, no aprobó— con el argumento de que a quien se
/// fue no se le escribe. Es al revés: a esa persona es a la
/// que hay que escribirle. «No quedó seleccionado esta vez»,
/// «lo esperamos en la próxima convocatoria», «cuéntenos por
/// qué lo dejó». Sin ellas el sistema solo sabe felicitar.
///
/// Van agrupadas y no en una lista corrida de once porque
/// once casillas seguidas no se leen: se marca la primera que
/// suene y se sigue.
///
/// El tercer elemento es la aclaración, y va DEBAJO del
/// nombre y no pegada a él: «Desertó» y «Abandonó» suenan
/// igual y no lo son, pero con la aclaración en la misma
/// línea la casilla mide tres renglones y el grupo se
/// desarma.
const GRUPOS: Array<{
  titulo: string;
  /// valor · lo que dice la casilla · la aclaración, si la
  /// necesita.
  etapas: Array<[string, string, string?]>;
}> = [
  {
    titulo: "Mientras avanza",
    etapas: [
      ["INTERESADO", "Interesado"],
      ["CONTACTADO", "Contactado"],
      ["DATOS_COMPLETOS", "Con datos completos"],
      ["INSCRITO", "Propuesta enviada"],
      ["EN_FORMACION", "En negociación"],
    ],
  },
  {
    /// Una sola casilla, y es correcto: es el único final
    /// bueno que hay. Repartirla en otro grupo para que las
    /// tres columnas midan igual sería mentir sobre el
    /// proceso.
    titulo: "Cerró bien",
    etapas: [["CERTIFICADO", "Ganado"]],
  },
  {
    titulo: "No siguió",
    etapas: [
      ["NO_APROBO", "No calificó"],
      ["DESERTO", "Desistió", "avisó que se retiraba"],
      ["ABANDONO", "Dejó de responder", "sin avisar"],
      ["RETIRADO", "Retirado"],
      ["PERDIDO", "Perdido", "no se logró contactar"],
    ],
  },
];

/// Cómo se nombra cada etapa cuando se cuenta en una frase:
/// «solo para quien esté inscrito, en formación». Sale del
/// mismo sitio que las casillas para que no se separen.
const EN_PALABRAS: Record<string, string> = Object.fromEntries(
  GRUPOS.flatMap((g) =>
    g.etapas.map(([valor, texto]) => [valor, texto.toLocaleLowerCase("es-CO")]),
  ),
);


type Filtro = "todas" | "activas" | "apagadas";

const FILTROS: Array<[Filtro, string]> = [
  ["todas", "Todas"],
  ["activas", "Activas"],
  ["apagadas", "Apagadas"],
];

export default function PaginaPlantillasCorreo() {
  const [plantillas, setPlantillas] = useState<PlantillaCorreo[] | null>(null);
  const [variables, setVariables] = useState<VariableCorreo[]>([]);
  const [error, setError] = useState<string | null>(null);

  /// Null: se está en la lista. Si no, la plantilla que se
  /// edita —o `"nueva"` para una en blanco—.
  const [editando, setEditando] = useState<PlantillaCorreo | "nueva" | null>(
    null,
  );

  const cargar = useCallback(async () => {
    const [lista, vars] = await Promise.all([
      plantillasCorreoApi.listar(),
      plantillasCorreoApi.variables(),
    ]);
    setPlantillas(lista);
    setVariables(vars);
  }, []);

  useEffect(() => {
    void cargar().catch((e) => setError((e as ErrorApi).message));
  }, [cargar]);

  if (!plantillas) {
    return error ? (
      <AvisoDeSeccion color="var(--texto-suave)">{error}</AvisoDeSeccion>
    ) : (
      <Cargando />
    );
  }

  if (editando) {
    return (
      <Editor
        /// La llave remonta el editor al cambiar de plantilla:
        /// sin ella, pasar de una a otra dejaría el borrador
        /// de la anterior escrito encima de la siguiente.
        key={editando === "nueva" ? "nueva" : editando.id}
        origen={editando === "nueva" ? null : editando}
        variables={variables}
        alSalir={() => setEditando(null)}
        alGuardar={async () => {
          await cargar();
          setEditando(null);
        }}
      />
    );
  }

  return (
    <Lista plantillas={plantillas} alEditar={setEditando} alRecargar={cargar} />
  );
}

// ─────────────────────────────── la lista ───────────────────

function Lista({
  plantillas,
  alEditar,
  alRecargar,
}: {
  plantillas: PlantillaCorreo[];
  alEditar: (p: PlantillaCorreo | "nueva") => void;
  alRecargar: () => Promise<void>;
}) {
  const toast = useToast();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierta, setAbierta] = useState<string | null>(null);

  const activas = plantillas.filter((p) => p.activa).length;
  const visibles = plantillas.filter((p) =>
    filtro === "activas" ? p.activa : filtro === "apagadas" ? !p.activa : true,
  );

  async function conmutar(p: PlantillaCorreo) {
    try {
      if (p.activa) {
        await plantillasCorreoApi.apagar(p.id);
        toast.exito("Se apagó la plantilla.");
      } else {
        await plantillasCorreoApi.editar(p.id, { activa: true });
        toast.exito("Se encendió la plantilla.");
      }
      await alRecargar();
    } catch (e) {
      toast.error((e as ErrorApi).message);
    }
  }

  return (
    /// CON cabecera de pantalla, como las otras catorce. La miga
    /// de arriba mide 13 px y va en otra banda: no es un título,
    /// y sin título esta pantalla arrancaba con una tabla de
    /// cabecera teñida —la única del panel— y con dieciséis
    /// botones-caja compitiendo contra ocho nombres.
    <div className="flex min-h-0 grow flex-col">
      {/* El botón solo cuando YA hay plantillas: con la lista
          vacía lo pone la invitación de abajo, que además dice
          para qué sirve. */}
      <CabeceraDePantalla
        titulo="Plantillas"
        acciones={
          plantillas.length > 0 && (
            <Boton onClick={() => alEditar("nueva")}>Nueva plantilla</Boton>
          )
        }
      />

      {plantillas.length === 0 ? (
        <Seccion>
          <div className="px-6 pt-5 pb-6">
            <BloqueDeBanda
              rotulo="Todavía no hay ninguna"
              nota="Se escriben una vez y se mandan muchas. Cree la primera para empezar a escribir correos desde una oportunidad o una campaña."
            >
              <Boton onClick={() => alEditar("nueva")}>Nueva plantilla</Boton>
            </BloqueDeBanda>
          </div>
        </Seccion>
      ) : (
        <>
          {/* Las pestañas: el azul de marca señala lo que está
              elegido AHORA, que es uno de sus cuatro usos. Sin
              bandeja teñida debajo: era un cuarto fondo. */}
          <Seccion>
            <div className="flex flex-wrap items-center gap-4 px-6 py-2.5">
              <div className="flex gap-1">
                {FILTROS.map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setFiltro(valor)}
                    className={`rounded-[6px] px-3 py-[6px] transition ${
                      filtro === valor
                        ? "bg-marca text-marca-texto"
                        : "text-texto-suave hover:text-texto"
                    }`}
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: filtro === valor ? 600 : 400,
                    }}
                  >
                    {texto}
                  </button>
                ))}
              </div>
              <span
                className="text-texto-suave tabular-nums"
                style={{ fontSize: "0.71875rem" }}
              >
                {plantillas.length}{" "}
                {plantillas.length === 1 ? "plantilla" : "plantillas"} · {activas}{" "}
                {activas === 1 ? "activa" : "activas"}
              </span>
            </div>
          </Seccion>

          {/* LA LISTA, EN COLUMNAS.

              Las cinco eran todas elásticas
              —`1.7fr 2.2fr 1.5fr 1.3fr 0.8fr`— y a 1440 eso se
              ve correcto. A 1920 las cinco crecen A LA VEZ:
              «Editar / Apagar» se iba a 1820 px, entre «ayer
              21:55» y su fila quedaban 350 px de blanco y la
              fila se abría en canal. Repartir el sobrante entre
              TODAS las columnas es el defecto del ancho con otro
              disfraz.

              Ahora cinco fijas, dos elásticas y UNA sola
              absorbe. La maqueta es la misma pieza compartida
              que usa Campañas: dos copias divergen. */}
          <ListaEnColumnas
            rejilla={REJILLA}
            anchoMinimo={ANCHO_MINIMO}
            columnas={CABECERAS}
          >
            {visibles.length === 0 && (
              <p className="dato px-6 py-8 text-center text-texto-suave">
                Ninguna plantilla está {filtro === "activas" ? "activa" : "apagada"}.
              </p>
            )}

            {visibles.map((p) => (
              <Fila
                key={p.id}
                plantilla={p}
                abierta={abierta === p.id}
                alAbrir={() => setAbierta(abierta === p.id ? null : p.id)}
                alEditar={() => alEditar(p)}
                alConmutar={() => void conmutar(p)}
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
 * SIETE COLUMNAS A 1440, OCHO A 1920, Y LA FILA LLEGA AL CANTO.
 *
 * Las cinco de antes eran todas `fr`, así que el sobrante de
 * 1920 se repartía entre las cinco: el asunto crecía a 700 px
 * para un asunto de 280 y las acciones se iban solas al canto.
 * Ahora cinco anchos fijos, dos elásticos y uno solo absorbe.
 *
 * Por qué cada ancho es el que es. Una columna mide lo que mide
 * su DATO, no lo que mide su rótulo:
 *
 * - Plantilla `minmax(150px, 340px)`: es un mango interno —«Su
 *   asesor se presenta»— y la gente los escribe cortos. Topa en
 *   340 porque de ahí en adelante solo le quita ancho al asunto.
 * - Estado 104: cabe «Apagada» con su punto. Fija a propósito,
 *   como en Campañas: si el rótulo no arranca siempre en la
 *   misma x, la columna deja de leerse en vertical, que es justo
 *   lo que se viene a hacer aquí —el filtro de arriba pregunta
 *   «¿cuáles están apagadas?»—.
 * - Línea 184: cabe `GRUPO AE · Personas` ENTERO, sin puntos
 *   suspensivos. Es la misma garantía que en Campañas y por la
 *   misma razón: mandarle a una persona el correo escrito para
 *   una empresa de 46 millones es escribirle a quien no era.
 * - Puede ir a 208: las etapas en las que la plantilla tiene
 *   sentido. Se recorta, y va entera en el `title` y en la fila
 *   abierta.
 * - Asunto `minmax(240px, 1fr)`: ABSORBE. Es el único dato de la
 *   fila que va a leer alguien de fuera de la empresa, y es lo
 *   que se revisa antes de mandar. A 1920 le tocan 528 px.
 * - Editada 100: `9 sep 2026` son 78 px con `tabular-nums`.
 * - Cabezote 104, solo con la banda ancha. No es relleno: una
 *   plantilla sin cabezote sale sin membrete, y un correo sin
 *   membrete detrás de una propuesta de 46 millones se lee como
 *   escrito por otra empresa. Era un dato que la lista no
 *   enseñaba en ninguna parte: había que abrir el editor de cada
 *   una para saberlo.
 * - Acciones 116: lo que cambia el estado, y la flecha.
 */
const COLUMNAS_BASE =
  "grid-cols-[minmax(150px,340px)_104px_184px_208px_minmax(240px,1fr)_100px_116px]";

const COLUMNAS_ANCHAS =
  "@[1600px]:grid-cols-[minmax(150px,340px)_104px_184px_208px_minmax(240px,1fr)_100px_104px_116px]";

/// La rejilla de la cabecera y la de una fila son la misma, y se
/// escribe una vez: separadas, el rótulo deja de estar encima de
/// su dato el día que alguien toque un ancho.
const REJILLA = `grid ${COLUMNAS_BASE} ${COLUMNAS_ANCHAS}`;

/// La suma de los anchos base. Por debajo se desplaza la banda,
/// nunca la página.
const ANCHO_MINIMO = 1102;

/// El orden no es decorativo: va de identidad (1-3) a alcance
/// (4) a contenido (5) a tiempo (6) a forma (7). Es el mismo
/// recorrido que la lista de Campañas, y a propósito: son las
/// dos listas del mismo módulo, y pasar de una a otra no tiene
/// por qué sentirse como cambiar de producto.
const CABECERAS: ColumnaDeLista[] = [
  { texto: "Plantilla" },
  { texto: "Estado" },
  { texto: "Línea" },
  {
    texto: "Puede ir a",
    ayuda:
      "Las etapas en las que esta plantilla aparece al escribirle a alguien. Sin ninguna marcada, aparece en todas.",
  },
  { texto: "Asunto" },
  { texto: "Editada", alineado: "text-right" },
  {
    texto: "Cabezote",
    soloAncha: true,
    ayuda:
      "La imagen de cabecera con la que sale el correo. Sin ella el mensaje llega sin membrete.",
  },
  { texto: "" },
];

function Fila({
  plantilla: p,
  abierta,
  alAbrir,
  alEditar,
  alConmutar,
}: {
  plantilla: PlantillaCorreo;
  abierta: boolean;
  alAbrir: () => void;
  alEditar: () => void;
  alConmutar: () => void;
}) {
  /// A quién le sirve. Es una columna y no un renglón debajo del
  /// nombre: «¿esta es de empresas o de personas?» se contesta
  /// bajando la vista por una columna, no leyendo trece
  /// renglones de letra pequeña.
  const linea = p.convenio ? (p.convenio.sigla ?? p.convenio.nombre) : "Todas";

  const etapas =
    p.etapasPermitidas.length > 0
      ? p.etapasPermitidas.map((e) => EN_PALABRAS[e] ?? e).join(", ")
      : "Cualquier etapa";

  /// Lo que solo se lee al detenerse en UNA plantilla no gasta
  /// una columna. Quién la escribió no se compara entre filas en
  /// un equipo de tres personas: va al `title` del nombre, como
  /// en Campañas.
  const ficha =
    (p.creadoPor ? `La escribió ${p.creadoPor.nombre}` : "Sin autor") +
    (p.convenio ? ` · solo para ${p.convenio.nombre}` : " · sirve para todas");

  return (
    /// Las filas se separan con `--hairline` —«aquí sigue lo
    /// mismo»—, no con `--borde`, que es lo que delimita la
    /// tabla entera. Con el mismo grosor para las dos cosas,
    /// todo pesaba igual.
    <div className="border-b border-hairline last:border-b-0">
      <div
        onClick={alAbrir}
        className={`dato ${REJILLA} cursor-pointer items-center transition hover:bg-tabla-fila-resaltada ${
          abierta ? "bg-tabla-fila-resaltada" : ""
        }`}
      >
        <Celda
          primera
          className={p.activa ? "text-titulo" : "text-texto-suave"}
          titulo={`${p.nombre} — ${ficha}`}
        >
          {p.nombre}
        </Celda>

        {/* El estado en la LETRA y en su columna. Estaba metido
            dentro de una frase de 10,5 px debajo del nombre
            —«Apagada · no aparece al escribir un correo»—, así
            que para saber cuáles están apagadas había que leer
            trece renglones en vez de bajar la vista una vez. */}
        <Celda>
          <Estado tono={p.activa ? "exito" : "apagado"}>
            {p.activa ? "Activa" : "Apagada"}
          </Estado>
        </Celda>

        <Celda titulo={p.convenio?.nombre ?? "Sirve para todas las líneas"}>
          {p.convenio ? linea : <span className="text-texto-suave">{linea}</span>}
        </Celda>

        <Celda className="text-texto-suave" titulo={etapas}>
          {etapas}
        </Celda>

        <Celda titulo={p.asunto}>{p.asunto}</Celda>

        {/* La pieza, no la función suelta: así «editada» se
            escribe igual aquí que en el cajón, y lo de hoy dice
            la hora, que es lo que se pregunta de un dato recién
            tocado. */}
        <Celda className="text-right text-texto-suave">
          <Fecha iso={p.actualizadoEn} />
        </Celda>

        <Celda className={SOLO_ANCHA}>
          {p.bannerMime ? "Puesto" : <span className="text-texto-suave">—</span>}
        </Celda>

        {/* EL CANTO LLEVA LO QUE CAMBIA EL ESTADO, y nada más.

            «Editar» se fue de aquí. No cabía —«Editar» y
            «Apagar» juntos piden 154 px— y sobre todo no es una
            acción de fila: se lleva la pantalla entera. Vive en
            la fila abierta, al lado del mensaje que uno acaba de
            leer para decidir si lo cambia. Mirar es la fila;
            actuar es el canto.

            No abre la fila: para el clic antes de que suba. Sin
            esto, «Apagar» apaga y de paso despliega el cuerpo. */}
        <Celda ultima className="flex items-center justify-end gap-3 text-right">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              alConmutar();
            }}
            className={p.activa ? "text-texto-suave" : "text-marca"}
          >
            {p.activa ? "Apagar" : "Encender"}
          </button>
          <IconoDerecha
            tamano={12}
            className={`shrink-0 text-texto-suave transition-transform ${
              abierta ? "rotate-90" : ""
            }`}
          />
        </Celda>
      </div>

      {/* EL DETALLE OCUPA LA FILA ENTERA, Y TAMBIÉN REPARTE.

          El mensaje es prosa y topa en 68 caracteres; lo que
          sobra a su derecha no se deja en blanco: lleva lo que no
          cabía en una columna —las etapas enteras, el cabezote,
          quién la escribió— y la única acción que se lleva la
          pantalla. */}
      {abierta && (
        <div className="grid gap-x-8 gap-y-5 border-t border-hairline bg-superficie-alterna px-6 py-5 @[1100px]:grid-cols-[minmax(0,68ch)_minmax(240px,1fr)]">
          <div className="min-w-0">
            <Rotulo className="mb-1.5">Asunto</Rotulo>
            <p className="dato mb-4">{p.asunto}</p>
            <Rotulo className="mb-1.5">El mensaje</Rotulo>
            <p className="dato whitespace-pre-wrap" style={{ lineHeight: 1.55 }}>
              {p.cuerpo}
            </p>
          </div>

          <div className="min-w-0 space-y-4">
            <div>
              <Rotulo className="mb-1.5">Puede ir a</Rotulo>
              <p className="dato">{etapas}</p>
            </div>
            <div>
              <Rotulo className="mb-1.5">Cabezote</Rotulo>
              <p className="dato">
                {p.bannerMime ? (
                  "Puesto: el correo sale con membrete."
                ) : (
                  <span className="text-texto-suave">
                    Sin cabezote: sale sin membrete.
                  </span>
                )}
              </p>
            </div>
            <div>
              <Rotulo className="mb-1.5">La escribió</Rotulo>
              <p className="dato">
                {p.creadoPor ? (
                  p.creadoPor.nombre
                ) : (
                  <span className="text-texto-suave">—</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={alEditar}
              className="dato text-marca underline underline-offset-2"
            >
              Editar esta plantilla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── el editor ──────────────────

type Borrador = {
  nombre: string;
  asunto: string;
  cuerpo: string;
  convenioId: string | null;
  etapasPermitidas: string[];
};

function Editor({
  origen,
  variables,
  alSalir,
  alGuardar,
}: {
  origen: PlantillaCorreo | null;
  variables: VariableCorreo[];
  alSalir: () => void;
  alGuardar: () => Promise<void>;
}) {
  const toast = useToast();
  const { gremios } = useAdmin();
  const caja = useRef<HTMLTextAreaElement>(null);

  const [b, setB] = useState<Borrador>(() => ({
    nombre: origen?.nombre ?? "",
    asunto: origen?.asunto ?? "",
    cuerpo: origen?.cuerpo ?? "",
    convenioId: origen?.convenioId ?? null,
    etapasPermitidas: origen?.etapasPermitidas ?? [],
  }));

  /// El cabezote se sube por su propia ruta y necesita el id
  /// de la plantilla, que una nueva todavía no tiene. Se
  /// guarda aquí el archivo escogido y se manda DESPUÉS de
  /// crearla.
  const [cabezote, setCabezote] = useState<File | null>(null);
  const [quitarCabezote, setQuitarCabezote] = useState(false);

  const [etapasAbiertas, setEtapasAbiertas] = useState(false);
  const [catalogoAbierto, setCatalogoAbierto] = useState(false);
  const [previaAbierta, setPreviaAbierta] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const ejemplos = useMemo(() => ejemplosDe(variables), [variables]);

  const asuntoR = resolver(b.asunto, ejemplos);
  const cuerpoR = resolver(b.cuerpo, ejemplos);
  const asuntoLleno = asuntoR.trozos.map((t) => t.t).join("");
  const rotas = [...new Set([...asuntoR.rotas, ...cuerpoR.rotas])];
  const puestas = [...new Set([...asuntoR.puestas, ...cuerpoR.puestas])];

  const faltanCampos =
    !b.nombre.trim() || !b.asunto.trim() || !b.cuerpo.trim();
  const textoRotas =
    `Estas variables no existen: ${rotas.map((r) => `{{${r}}}`).join(", ")}. ` +
    "Van a salir tal cual en el correo, así que no se puede guardar así.";

  /// Se bloquea AQUÍ y no solo en el servidor. El servidor ya
  /// lo rechaza, pero rechazarlo después de pulsar deja a
  /// quien escribe con un aviso rojo flotante y sin saber
  /// cuál de las llaves estaba mal escrita.
  const noSePuede = rotas.length > 0 || faltanCampos;

  const urlGuardada =
    origen?.bannerMime && !quitarCabezote ? urlDelCabezote(origen) : null;

  async function guardar() {
    setOcupado(true);
    try {
      let id: string;
      if (origen) {
        await plantillasCorreoApi.editar(origen.id, b);
        id = origen.id;
      } else {
        id = (await plantillasCorreoApi.crear(b)).id;
      }

      if (cabezote) await plantillasCorreoApi.subirCabezote(id, cabezote);
      else if (quitarCabezote) await plantillasCorreoApi.quitarCabezote(id);

      toast.exito(origen ? "Se guardó la plantilla." : "Se creó la plantilla.");
      await alGuardar();
    } catch (e) {
      toast.error((e as ErrorApi).message);
    } finally {
      setOcupado(false);
    }
  }

  function pegar(clave: string) {
    setCatalogoAbierto(false);
    setB((v) => ({ ...v, cuerpo: pegarEnElCursor(caja.current, v.cuerpo, clave) }));
  }

  function conmutarEtapa(valor: string) {
    setB((v) => ({
      ...v,
      etapasPermitidas: v.etapasPermitidas.includes(valor)
        ? v.etapasPermitidas.filter((x) => x !== valor)
        : [...v.etapasPermitidas, valor],
    }));
  }

  const resumenEtapas =
    b.etapasPermitidas.length > 0
      ? `Solo: ${b.etapasPermitidas.map((e) => EN_PALABRAS[e] ?? e).join(", ")}`
      : "Cualquier etapa (sin restricción)";

  return (
    <div className="flex min-h-0 grow flex-col">
      {/* El editor SÍ lleva título: es una subvista y la miga de
          arriba no sabe de ella. Y va en la MISMA banda que el
          título de cualquier otra pantalla, para que el marco
          sea el mismo en las quince. */}
      <Seccion>
        <div className="px-6 pt-3.5">
          <button
            type="button"
            onClick={alSalir}
            className="inline-flex items-center gap-1 text-marca"
            style={{ fontSize: "0.8125rem" }}
          >
            <IconoIzquierda tamano={12} /> Plantillas de correo
          </button>
        </div>
        <div className="px-6 pt-2 pb-[22px]">
          <h1
            className="font-bold text-titulo"
            style={{ fontSize: "1.3125rem", letterSpacing: "-0.02em" }}
          >
            {origen ? "Editar la plantilla" : "Nueva plantilla"}
          </h1>
        </div>
      </Seccion>

      <Seccion>
        {/* EL FORMULARIO TOPA EN 720 PX y va a dos columnas por
            encima de 1100. Un campo para el nombre de una
            plantilla no mide el ancho de un monitor de 27". */}
        <div className={`${ANCHO_FORMULARIO} px-6 pt-5 pb-6`}>
        {/* ── Datos de la plantilla ── */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block" style={{ fontSize: "0.8125rem" }}>
                Cómo la va a reconocer
              </span>
              <input
                className={CLASE_CONTROL}
                value={b.nombre}
                onChange={(e) => setB({ ...b, nombre: e.target.value })}
                placeholder="Ej. Confirmación de solicitud"
              />
            </label>

            {/* El alcance existía en la base desde el primer
                día y la pantalla no lo tenía: todo lo que se
                creaba aquí salía global, aunque la lista
                dijera «Solo para ADECOPRIA» en las que sí lo
                llevaban. */}
            <div className="block">
              <span className="mb-1.5 block" style={{ fontSize: "0.8125rem" }}>
                Alcance
              </span>
              {/* El desplegable de la casa, como en Calendario:
                  el nativo se pinta distinto en cada navegador
                  y en tema oscuro abre una lista blanca. */}
              <Desplegable
                valor={b.convenioId ?? ""}
                alElegir={(v) => setB({ ...b, convenioId: v || null })}
                opciones={[
                  {
                    valor: "",
                    etiqueta: "Sirve para todas las unidades de negocio",
                    detalle: "La ven todos, y cualquiera puede usarla",
                  },
                  ...gremios.map((g) => ({
                    valor: g.convenioId,
                    etiqueta: `Solo para ${g.sigla}`,
                    detalle: "No aparece en las otras unidades de negocio",
                  })),
                ]}
              />
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block" style={{ fontSize: "0.8125rem" }}>
              Asunto
            </span>
            <input
              className={CLASE_CONTROL}
              value={b.asunto}
              onChange={(e) => setB({ ...b, asunto: e.target.value })}
              placeholder="Lo que ve la persona en su bandeja"
            />
            {/* Lo que se ve en la lista del celular antes de
                abrirlo. Se mide sobre el asunto YA resuelto:
                «{{primerApellido}}» ocupa quince caracteres
                aquí y cuatro allá. */}
            {asuntoLleno.length > 50 && (
              <span className="mt-1.5 block text-texto-suave" style={{ fontSize: "0.71875rem" }}>
                En el celular se corta cerca del carácter 50. Este tiene{" "}
                {asuntoLleno.length}.
              </span>
            )}
          </label>

          {/* ── Etapas, plegadas ──
              Once casillas son más altas que los tres campos
              de texto juntos, y son lo que menos se toca.
              Cerradas dicen a quién le sirve; abiertas se
              cambia. */}
          <div className="border-t border-borde pt-4">
            <button
              type="button"
              onClick={() => setEtapasAbiertas(!etapasAbiertas)}
              className="flex w-full items-center gap-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block" style={{ fontSize: "0.8125rem" }}>
                  ¿A quién se le puede mandar?
                </span>
                <span className="mt-0.5 block truncate text-texto-suave" style={{ fontSize: "0.71875rem" }}>
                  {resumenEtapas}
                </span>
              </span>
              <span className="shrink-0 text-texto-suave tabular-nums" style={{ fontSize: "0.65625rem" }}>
                {b.etapasPermitidas.length > 0
                  ? `${b.etapasPermitidas.length} de ${Object.keys(EN_PALABRAS).length}`
                  : "Sin límite"}
              </span>
              <IconoDerecha
                tamano={14}
                className={`shrink-0 text-texto-suave transition-transform ${
                  etapasAbiertas ? "rotate-90" : ""
                }`}
              />
            </button>

            {etapasAbiertas && (
              <div className="mt-3 border-t border-borde">
                <p className="max-w-[68ch] pt-3 text-texto-suave" style={{ fontSize: "0.71875rem", lineHeight: 1.55 }}>
                  Si no marca ninguna, sirve para cualquiera. Marque solo si esta
                  plantilla dice algo que no es cierto en otra etapa —una
                  «confirmación» no le sirve a quien no quedó, y un «no quedó
                  seleccionado» no le sirve a quien sí.
                </p>
                <div className="mt-2.5 grid gap-6 sm:grid-cols-3">
                  {GRUPOS.map((g) => (
                    <div key={g.titulo}>
                      <p className="mb-2.5 font-bold uppercase text-texto-suave" style={{ fontSize: "0.625rem", letterSpacing: "0.11em" }}>
                        {g.titulo}
                      </p>
                      <div className="flex flex-col gap-3">
                        {g.etapas.map(([valor, texto, nota]) => (
                          <label
                            key={valor}
                            className="flex cursor-pointer items-start gap-2"
                            style={{ fontSize: "0.8125rem", lineHeight: 1.3 }}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={b.etapasPermitidas.includes(valor)}
                              onChange={() => conmutarEtapa(valor)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block">{texto}</span>
                              {nota && (
                                <span className="mt-px block text-texto-suave" style={{ fontSize: "0.65625rem" }}>
                                  {nota}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Cabezote ── */}
          <div className="border-t border-borde pt-4">
            <div className="mb-1.5 flex items-baseline gap-2.5">
              <span style={{ fontSize: "0.8125rem" }}>
                Cabezote del correo
              </span>
              <span className="ml-auto text-texto-suave" style={{ fontSize: "0.65625rem" }}>
                Va de primeras, arriba del texto
              </span>
            </div>
            <Cabezote
              archivo={cabezote}
              url={urlGuardada}
              alEscoger={(f) => {
                setCabezote(f);
                setQuitarCabezote(false);
              }}
              alQuitar={() => {
                setCabezote(null);
                setQuitarCabezote(true);
              }}
            />
          </div>
        </div>

        {/* ── El mensaje ── */}
        <div className="mb-5">
          <p className="mb-2.5 font-bold uppercase text-texto-suave" style={{ fontSize: "0.625rem", letterSpacing: "0.11em" }}>
            El mensaje
          </p>
          <div>
            {/* La clase va escrita y no compuesta sobre
                `CLASE_CONTROL`: el control de la casa mide
                12.5 px y aquí el texto es 13.5, y dos
                utilidades de tamaño en la misma etiqueta se
                resuelven por el orden de la hoja compilada,
                no por el del atributo. */}
            <textarea
              ref={caja}
              rows={12}
              className="w-full resize-y rounded-[6px] border border-campo-borde bg-campo-fondo px-3 py-3 text-texto outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25"
              style={{ fontSize: "0.8125rem", lineHeight: 1.55 }}
              value={b.cuerpo}
              onChange={(e) => setB({ ...b, cuerpo: e.target.value })}
              placeholder="Escriba el correo. Lo que cambia de una persona a otra se pega desde «Insertar dato», aquí abajo."
            />

            {/* Lo que aquí sale lleno puede llegar vacío a
                alguien: el ejemplo tiene todos los datos y un
                lead real no siempre. */}
            {puestas.length > 0 && (
              <p className="mt-2 max-w-[68ch] text-texto-suave" style={{ fontSize: "0.71875rem", lineHeight: 1.55 }}>
                Usa {puestas.length} {puestas.length === 1 ? "variable" : "variables"}.
                A quien le falte alguna de esas en su lead, no se le manda: sale
                en la lista de omitidos con el motivo.
              </p>
            )}

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setCatalogoAbierto(!catalogoAbierto)}
                className="inline-flex items-center gap-2 rounded-[6px] border border-campo-borde bg-superficie px-3 py-2 text-marca transition hover:border-marca"
                style={{ fontSize: "0.8125rem" }}
              >
                <span className="leading-none">+</span> Insertar dato
                <IconoDerecha
                  tamano={12}
                  className={`transition-transform ${catalogoAbierto ? "rotate-90" : ""}`}
                />
              </button>
              <span className="ml-2.5 text-texto-suave" style={{ fontSize: "0.71875rem" }}>
                Se pega donde esté el cursor.
              </span>

              {catalogoAbierto && (
                <CatalogoDeVariables variables={variables} alPegar={pegar} />
              )}
            </div>
          </div>
        </div>

        {/* ── Vista previa ── */}
        <div className="mb-5">
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
                asunto={b.asunto}
                cuerpo={b.cuerpo}
                variables={variables}
                banner={cabezote}
                bannerUrl={urlGuardada}
              />
            </div>
          )}

          {rotas.length > 0 && (
            <p className="mt-3 max-w-[68ch] text-texto" style={{ fontSize: "0.71875rem", lineHeight: 1.55 }}>
              {textoRotas}
            </p>
          )}
        </div>

        {/* ── Guardar ── */}
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={() => void guardar()} disabled={ocupado || noSePuede}>
            {ocupado ? "Guardando…" : "Guardar"}
          </Boton>
          <button
            type="button"
            onClick={alSalir}
            className="text-texto-suave transition hover:text-texto"
            style={{ fontSize: "0.71875rem" }}
          >
            Cancelar
          </button>
          {/* El motivo, al lado del botón. Un botón apagado
              sin decir por qué se lee como que la pantalla se
              rompió. */}
          {rotas.length > 0 ? (
            <span className="max-w-[68ch] text-texto" style={{ fontSize: "0.71875rem" }}>{textoRotas}</span>
          ) : faltanCampos ? (
            <span className="text-texto-suave" style={{ fontSize: "0.71875rem" }}>
              Faltan campos: cómo la va a reconocer, asunto y el mensaje.
            </span>
          ) : (
            <span className="text-exito" style={{ fontSize: "0.71875rem", fontWeight: 600 }}>
              Todo listo para guardar.
            </span>
          )}
        </div>
        </div>
      </Seccion>
    </div>
  );
}

// ─────────────────────────── piezas del editor ──────────────

/// La franja de arriba del correo. Se sube después de guardar
/// —necesita el id de la plantilla—, así que aquí solo se
/// escoge y se enseña.
function Cabezote({
  archivo,
  url,
  alEscoger,
  alQuitar,
}: {
  archivo: File | null;
  url: string | null;
  alEscoger: (f: File) => void;
  alQuitar: () => void;
}) {
  const vistaPrevia = useMemo(
    () => (archivo ? URL.createObjectURL(archivo) : null),
    [archivo],
  );
  const imagen = vistaPrevia ?? url;

  if (imagen) {
    return (
      <div className="relative overflow-hidden rounded-[6px] border border-borde">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagen} alt="Cabezote del correo" className="block w-full" />
        <div className="absolute top-2 right-2 flex gap-1.5">
          <label className="cursor-pointer rounded-[6px] border border-campo-borde bg-superficie px-2.5 py-[5px]" style={{ fontSize: "0.71875rem" }}>
            Cambiar
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) alEscoger(f);
              }}
            />
          </label>
          <button
            type="button"
            onClick={alQuitar}
            className="rounded-[6px] border border-campo-borde bg-superficie px-2.5 py-[5px] text-texto-suave"
            style={{ fontSize: "0.71875rem" }}
          >
            Quitar
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="flex max-w-[360px] cursor-pointer items-center gap-3 rounded-[6px] border border-dashed border-campo-borde bg-superficie px-3 py-2.5">
      <span className="flex shrink-0 items-center justify-center leading-none text-texto-suave" style={{ fontSize: "1.1875rem" }}>
        +
      </span>
      <span className="min-w-0">
        <span className="block" style={{ fontSize: "0.8125rem" }}>Suba el cabezote</span>
        <span className="block text-texto-suave" style={{ fontSize: "0.65625rem" }}>
          PNG, JPG o WebP, hasta 2 MB (logo o franja de la marca).
        </span>
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) alEscoger(f);
        }}
      />
    </label>
  );
}
