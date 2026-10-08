"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ArreglarLead } from "@/components/admin/arreglar-lead";
import { Desplegable } from "@/components/admin/desplegable";
import { GestionarLead } from "@/components/admin/gestionar-lead";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  EscogerArchivo,
  useAdmin,
} from "@/components/admin/marco-admin";
import { Bloque, Cifra, Encabezado } from "@/components/admin/piezas";
import { columnasDeLead } from "@/components/admin/columnas-de-lead";
import { Tabla } from "@/components/admin/tabla";
import { alcanza } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";
import { crmApi, type CatalogosSep } from "@/lib/crm-api";
import { useDatosVivos } from "@/lib/datos-vivos";
import {
  bbddLeadsApi,
  ETIQUETA_PORQUE,
  ETIQUETA_QUE_PASO,
  MAXIMO_ARCHIVO,
  ORIGEN_DEL_CARGUE,
  ORIGENES_DE_UNA_BASE,
  TONO_QUE_PASO,
  type FilaDelInforme,
  type ResultadoDelCargue,
} from "@/lib/bbdd-leads-api";
import {
  ETIQUETA_ESTADO_LEAD,
  mesaApi,
  TOPE_DEL_LOTE,
  type EstadoLead,
  type LeadDeLaMesa,
  type ListadoDeLaMesa,
} from "@/lib/mesa-api";

/**
 * LA BBDD DE LEADS: la base que se mete a mano, no la que entra sola.
 *
 * Es pantalla aparte de la mesa de entrada por decisión del cliente
 * (5 oct 2026), y la separación tiene fondo: la mesa es el buzón de
 * lo que llegó por los webhooks, y aquí se SUBE un archivo. Los dos
 * listados son el mismo --la misma tabla, los mismos filtros-- pero
 * pedido con `origenSistema=cargue-masivo`, que es la columna donde
 * el servidor marca lo que entró por aquí.
 *
 * Y el cargue NO ES RESTRICTIVO: «no es restrictiva porque no tengo
 * todos los datos, necesito montarla donde sí tiene, correo y
 * celular». Una fila con correo o celular entra; la que no se pueda
 * reconocer lo dice en el informe y no tumba el archivo. Esa regla
 * vive en el servidor: aquí solo se pinta lo que contesta.
 */

/// La misma caja del buscador que la mesa de entrada: mismos
/// tokens de fondo y borde, mismo cuerpo de letra y mismo alto.
/// Dos controles pegados en la misma barra con dos cajas
/// distintas se leen como dos piezas de sitios distintos.
const CLASE_BUSCADOR =
  "rounded-lg border border-campo-borde bg-campo-fondo px-3 text-[0.78125rem] " +
  "outline-none transition hover:border-marca/60 focus:border-marca";

/// La caja de `EscogerArchivo`, para el enlace de la plantilla.
///
/// Es un `<a download>` y no un botón --un archivo que baja es una
/// dirección, no una acción de JavaScript--, así que no puede ser
/// `BotonSuave`. Lleva las clases del `<label>` con el que va
/// emparejado a propósito: bajar el formato y subirlo lleno son dos
/// hermanos del mismo trabajo, y en esa fila nadie manda sobre el
/// otro. Es el mismo criterio escrito en `cargue-plantilla.tsx`.
const CLASE_ENLACE_PLANTILLA =
  "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-borde " +
  "bg-superficie px-4 py-2 text-sm font-medium no-underline transition " +
  "hover:border-marca hover:bg-superficie-alterna";

const ESTADOS: EstadoLead[] = ["PENDIENTE", "CONVERTIDO", "DESCARTADO"];

/// Cuántas filas del informe se pintan de una vez.
///
/// Con un archivo de tres mil, pintarlas todas cuelga la pestaña y
/// además no sirve: el informe se lee para encontrar las que piden
/// algo, y esas van primero. El resto se cuenta, no se lista.
const FILAS_QUE_SE_PINTAN = 200;



/// Las que piden algo, primero.
///
/// Un informe ordenado por número de fila deja las seis que fallaron
/// repartidas entre dos mil que entraron bien, y entonces hay que
/// bajar dos mil renglones para encontrarlas. El número de fila del
/// Excel sigue en su columna, así que no se pierde el sitio.
const PESO_DE_LA_FILA: Record<FilaDelInforme["que"], number> = {
  FALLO: 0,
  NO_SE_RECONOCE: 1,
  REPETIDA_EN_EL_ARCHIVO: 2,
  /// Antes que «ya estaba»: esa persona la esta trabajando alguien
  /// en Gestion de leads, y es lo que hay que ir a mirar.
  YA_TIENE_FICHA: 3,
  YA_ESTABA: 4,
  NUEVA: 5,
};

function loQuePideAlgoPrimero(filas: FilaDelInforme[]): FilaDelInforme[] {
  return [...filas].sort((a, b) => {
    /// Dentro de «ya estaba», las que chocan antes que las limpias:
    /// un choque es una decisión que alguien tiene que tomar.
    const peso = PESO_DE_LA_FILA[a.que] - PESO_DE_LA_FILA[b.que];
    if (peso !== 0) return peso;
    const choque = Number(b.choques.length > 0) - Number(a.choques.length > 0);
    if (choque !== 0) return choque;
    return a.fila - b.fila;
  });
}

/**
 * LAS DOS VISTAS DE BBDD LEADS, en un solo componente.
 *
 * «¿Esto, al ir a la subvista para cargar? O sea, ¿sí es claro lo
 * que pido?» (cliente, 6 oct 2026), señalando el bloque de cargue
 * encima de la lista. Y lo era: cargar y mirar la base son dos
 * tareas distintas, y el formulario de cargue ocupaba media
 * pantalla de quien solo venía a trabajar los leads.
 *
 * `lista` es la base, con la tabla de la casa ---las mismas
 * columnas, filtros, vistas y Excel que Gestión de leads---.
 * `cargue` es la subvista, con su propia dirección
 * ---`/admin/bbdd-leads/cargar`--- para poder llegar y volver.
 *
 * UN SOLO COMPONENTE Y NO DOS PÁGINAS, a propósito: las dos
 * comparten el gremio que se está mirando, las cuatro cifras de
 * arriba y la recarga después de aplicar. Partirlo en dos ficheros
 * duplicaría eso, y el día que una cambie, la otra se queda atrás.
 */
export default function PaginaBbddLeads({
  vista = "lista",
}: {
  vista?: "lista" | "cargue";
}) {
  const { admin, gremio, gremios } = useAdmin();
  const enElCargue = vista === "cargue";

  /// EL GREMIO QUE SE ESTÁ MIRANDO, para el título y para el cargue.
  ///
  /// No se escribe fijo: hay dos convenios y el título tiene que
  /// decir cuál es esta base. Con «todos los gremios» puesto no hay
  /// uno, y entonces el cargue exige elegirlo --abajo-- porque el
  /// mismo código AF es otro curso en cada gremio.
  const suyo =
    gremios.find((g) => g.convenioId === gremio) ??
    (gremios.length === 1 ? gremios[0] : undefined);
  const alcance = suyo
    ? suyo.sigla
    : gremios.length > 1
      ? "todos los gremios"
      : null;

  /// Sin `ESCRIBIR` en inscripciones el servidor niega las tres
  /// rutas del cargue. Sin permisos todavía --cargando-- no se
  /// esconde nada: el menú tiene que prometer lo que el servidor
  /// concede, no menos.
  const puedeCargar =
    !admin?.permisos || alcanza(admin.permisos.inscripciones, "ESCRIBIR");

  const [datos, setDatos] = useState<ListadoDeLaMesa | null>(null);
  /// Quién puede repartir. La MISMA llave que la Mesa: dos nombres
  /// para el mismo permiso acaban dando dos respuestas distintas.
  const reparte = Boolean(admin?.puede?.repartirFichas);
  /// Lo que se acaba de hacer, para que el lote no termine en
  /// silencio. Null: nada que decir.
  const [asignados, setAsignados] = useState<string | null>(null);
  /// Cuántos hay por estado DENTRO de esta base.
  ///
  /// No sale del `resumen` del listado: aquel cuenta todo el ámbito
  /// ---webhooks incluidos--- y aquí eso sería una cifra que parece
  /// exacta y no lo es. Se pide con el mismo filtro de origen, un
  /// recuento por estado.
  const [porEstado, setPorEstado] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  /// TODOS por omisión, y no «sin atender» como la mesa.
  ///
  /// La mesa es una cola de trabajo: lo convertido ya no se atiende
  /// allí. Esto es una BASE, y a una base se entra a ver qué hay
  /// dentro --incluido lo que ya se gestionó--.
  const [estado, setEstado] = useState<string>("");
  const [buscar, setBuscar] = useState("");
  /// Lo que de verdad se manda: consultar en cada tecla sería una
  /// petición por letra.
  const [buscado, setBuscado] = useState("");
  const [pagina, setPagina] = useState(1);

  /// Cuál se está arreglando y cuál gestionando. Null: ninguno.
  const [arreglando, setArreglando] = useState<LeadDeLaMesa | null>(null);
  const [gestionando, setGestionando] = useState<LeadDeLaMesa | null>(null);
  /// Departamentos, municipios, géneros y tipos de documento, para
  /// el cajón que completa los datos. Los mismos que usa la mesa.
  const [catalogos, setCatalogos] = useState<CatalogosSep | null>(null);

  useEffect(() => {
    void crmApi.catalogos().then(setCatalogos).catch(() => setCatalogos(null));
  }, []);

  /// EL CARGUE, en dos pasos: elegir → ver → aplicar.
  const [archivo, setArchivo] = useState<File | null>(null);
  /// EL GREMIO DEL CARGUE SE DERIVA, no se copia con un efecto.
  ///
  /// `null` quiere decir «el que manda el menú», que es el caso
  /// normal. Copiarlo a un estado con un efecto haría que cambiar
  /// de gremio arriba repintara dos veces y, peor, dejaría el valor
  /// viejo puesto un render: lo justo para aplicar un cargue en el
  /// gremio equivocado si alguien pulsa rápido.
  const [convenioElegido, setConvenioElegido] = useState<string | null>(null);
  const convenioDelCargue = convenioElegido ?? suyo?.convenioId ?? "";
  const [origen, setOrigen] = useState("");
  const [previa, setPrevia] = useState<ResultadoDelCargue | null>(null);
  const [aplicado, setAplicado] = useState<ResultadoDelCargue | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorDelCargue, setErrorDelCargue] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscado(buscar), 350);
    return () => clearTimeout(t);
  }, [buscar]);

  /// Volver a la 1 al filtrar. Sin esto, filtrar estando en la
  /// página 4 deja una lista vacía que parece que no hay nada.
  useEffect(() => {
    setPagina(1);
  }, [estado, buscado]);

  const cargar = useCallback(async () => {
    try {
      const [listado, ...recuentos] = await Promise.all([
        mesaApi.listar({
          origenSistema: ORIGEN_DEL_CARGUE,
          estado: estado || undefined,
          buscar: buscado,
          pagina,
        }),
        /// Uno por estado, pidiendo una sola fila: lo que se quiere
        /// de cada llamada es el `total`, que sí honra los filtros.
        ...ESTADOS.map((s) =>
          mesaApi.listar({
            origenSistema: ORIGEN_DEL_CARGUE,
            estado: s,
            limite: 1,
          }),
        ),
      ]);
      setDatos(listado);
      setPorEstado(
        Object.fromEntries(ESTADOS.map((s, i) => [s, recuentos[i].total])),
      );
      setError(null);
    } catch (e) {
      /// Un fallo NO vacía la pantalla: convertir un parpadeo de red
      /// en pantalla en blanco borra la lista cada vez que la
      /// conexión tose.
      setError(
        e instanceof ErrorApi ? e.message : "No se pudo cargar la BBDD de leads.",
      );
    }
  }, [estado, buscado, pagina]);

  /// CADA 60 s, no cada 10 como la mesa.
  ///
  /// La mesa se refresca cada diez porque varios asesores trabajan
  /// a la vez sobre la misma cola y uno le quita fichas al otro.
  /// Aquí nada entra por su cuenta: una fila nueva aparece cuando
  /// alguien aplica un cargue, y esa persona es la que está
  /// mirando. Con cuatro consultas por vuelta ---el listado y los
  /// tres recuentos--- diez segundos serían 24 por minuto para
  /// enseñar lo mismo, y el limitador contesta 429.
  ///
  /// Con `clave`: la función de carga vive en una `ref` y por sí
  /// sola no dispara nada, así que sin esto cambiar un filtro
  /// tardaría hasta un minuto en verse.
  useDatosVivos(cargar, {
    intervaloMs: 60_000,
    clave: `${estado}|${buscado}|${pagina}`,
  });

  function limpiarElCargue() {
    setArchivo(null);
    setPrevia(null);
    setAplicado(null);
    setErrorDelCargue(null);
    setConvenioElegido(null);
  }

  async function revisar() {
    if (!archivo || !convenioDelCargue) return;
    setOcupado(true);
    setErrorDelCargue(null);
    setAplicado(null);
    try {
      setPrevia(
        await bbddLeadsApi.cargar(archivo, convenioDelCargue, origen, false),
      );
    } catch (e) {
      /// Las dos rutas contestan 200 aunque el archivo esté mal, así
      /// que aquí solo caen los fallos de verdad: sin sesión, sin
      /// permiso, sin red o el archivo pasado de peso.
      setErrorDelCargue(
        e instanceof ErrorApi ? e.message : "No se pudo revisar el archivo.",
      );
      setPrevia(null);
    } finally {
      setOcupado(false);
    }
  }

  async function aplicar() {
    if (!archivo || !convenioDelCargue) return;
    setOcupado(true);
    setErrorDelCargue(null);
    try {
      const r = await bbddLeadsApi.cargar(
        archivo,
        convenioDelCargue,
        origen,
        true,
      );
      setAplicado(r);
      setPrevia(null);
      setArchivo(null);
      await cargar();
    } catch (e) {
      setErrorDelCargue(
        e instanceof ErrorApi ? e.message : "No se pudo aplicar el cargue.",
      );
    } finally {
      setOcupado(false);
    }
  }

  const leads = datos?.leads ?? [];
  /// El informe que se está enseñando: el de la revisión mientras no
  /// se haya aplicado, y el de lo aplicado después. Son el mismo
  /// tipo y lo único que cambia es `aplicado`, así que se pintan con
  /// el mismo bloque y no con dos.
  const informe = previa ?? aplicado;
  /// Lo que no sirvió, en una cifra. Son tres casillas distintas del
  /// informe y una sola pregunta: «¿cuántas no entraron?».
  const noSirven = informe
    ? informe.repetidasEnElArchivo + informe.sinReconocer + informe.fallaron
    : 0;
  /// LA REVISIÓN ERA DE OTRA BASE, y no se aplica.
  ///
  /// Pasa si alguien cambia el gremio del menú ---o el de abajo---
  /// con una revisión en pantalla: lo que se enseña se revisó contra
  /// la gente de un convenio y se escribiría en otro. El mismo
  /// código AF es otro curso en cada gremio, así que eso no falla:
  /// entra y le rellena huecos a quien no debía.
  const previaDeOtraBase = Boolean(
    previa && convenioDelCargue && previa.convenio.id !== convenioDelCargue,
  );

  return (
    /// La misma caja que las pantallas vecinas: el título en su
    /// recuadro y los bloques debajo, separados por 16 px.
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6 [&>header]:mx-0 [&>header]:mb-0">
      <Encabezado
        compacto
        titulo={`BBDD Leads${alcance ? ` · ${alcance}` : ""}`}
      >
        {/* A DÓNDE VA LA PERSONA CUANDO SE GESTIONA. Un enlace y no
            un botón: es navegación, y aquí la navegación es enlace.
            «Apenas se gestione, si la persona ya ingresa y completa
            datos, caiga a Gestión de leads» (cliente, 5 oct 2026) —
            y eso lo hace la conversión, en la mesa; esto solo dice
            dónde queda. */}
        <Link
          href="/admin/participantes"
          className="text-[0.78125rem] font-medium text-marca hover:underline"
        >
          Ir a Gestión de leads
        </Link>
        {/* IDA Y VUELTA ENTRE LAS DOS VISTAS.

            Sin el de volver, de la subvista solo se sale con el botón
            del navegador, y eso en una pantalla a la que se entra
            desde el menú no es obvio. */}
        {enElCargue ? (
          <Link
            href="/admin/bbdd-leads"
            className="text-[0.78125rem] font-medium text-marca hover:underline"
          >
            ← Volver a la base
          </Link>
        ) : (
          puedeCargar && (
            <Link
              href="/admin/bbdd-leads/cargar"
              className="text-[0.78125rem] font-medium text-marca hover:underline"
            >
              Cargar una base
            </Link>
          )
        )}
      </Encabezado>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {/* Y LO QUE ACABA DE PASAR CON EL LOTE. Sin esto, repartir 50
          leads no deja rastro en pantalla: el desplegable vuelve a
          quedar en blanco y la tabla se repinta igual, porque el
          asesor solo se ve si esa columna está puesta. */}
      {asignados && <Aviso tipo="exito">{asignados}</Aviso>}

      {/* LA OTRA PUERTA, nombrada. Ver el porqué en
          `participantes/carga/page.tsx`: hay dos cargadores y los
          dos dicen «suba un archivo de personas». */}
      {enElCargue && (
        <p className="text-[12.5px] text-texto-suave">
          Lo que entra por aquí queda como <strong>lead</strong> y se
          queda en esta base hasta que alguien lo trabaje. Si lo que
          tiene son personas que ya van a inscribirse,{" "}
          <Link href="/admin/participantes/carga" className="underline">
            eso se carga en Participantes
          </Link>
          .
        </p>
      )}

      <div className="flex flex-wrap items-stretch gap-2">
        <Cifra
          etiqueta="En la BBDD"
          valor={
            porEstado
              ? ESTADOS.reduce((t, s) => t + (porEstado[s] ?? 0), 0)
              : "—"
          }
          pie="cargadas por archivo"
        />
        <Cifra
          etiqueta="Sin atender"
          valor={porEstado?.PENDIENTE ?? "—"}
          pie="esperan que alguien las revise"
          color="var(--aviso)"
        />
        <Cifra
          etiqueta="Convertidas"
          valor={porEstado?.CONVERTIDO ?? "—"}
          pie="ya están en Gestión de leads"
          color="var(--exito)"
        />
        <Cifra etiqueta="Descartadas" valor={porEstado?.DESCARTADO ?? "—"} />
      </div>

      {/* ───────── EL CARGUE, EN DOS PASOS ───────── */}
      {enElCargue && puedeCargar && (
        <Bloque
          titulo="Cargar una base"
          descripcion="Se revisa primero y se aplica después. Hasta que no se pulse «Aplicar el cargue» no se escribe nada."
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* BAJAR EL FORMATO Y SUBIRLO LLENO, uno al lado del
                  otro: es el orden en que se hace. */}
              <a
                href={bbddLeadsApi.urlPlantilla()}
                className={CLASE_ENLACE_PLANTILLA}
                download
              >
                Descargar la plantilla
              </a>
              <div className="min-w-[280px] flex-1">
                <EscogerArchivo
                  id="archivo-de-la-bbdd"
                  acepta=".xlsx"
                  archivo={archivo}
                  etiqueta="Elegir el archivo"
                  vacio="Ningún archivo elegido"
                  alElegir={(f) => {
                    setArchivo(f);
                    /// El informe era de OTRO archivo: dejarlo a la
                    /// vista invita a aplicar el que ya no está.
                    setPrevia(null);
                    setAplicado(null);
                    setErrorDelCargue(
                      f && f.size > MAXIMO_ARCHIVO
                        ? "El archivo pasa de 5 MB, que es el tope del servidor. Pártalo en dos."
                        : null,
                    );
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              {/* DE QUÉ GREMIO ES LA BASE. Obligatorio y sin valor
                  por omisión cuando la cuenta tiene los dos: los
                  códigos AF se repiten entre gremios y no
                  significan lo mismo, así que una base cargada en
                  el equivocado no falla --entra y le rellena huecos
                  a la gente del otro--. Con un solo gremio no hay
                  nada que elegir y se dice cuál es. */}
              {gremios.length > 1 ? (
                <div className="w-[min(260px,100%)]">
                  <Campo etiqueta="De qué gremio es" comoDiv>
                    <Desplegable
                      id="gremio-del-cargue"
                      alto={38}
                      etiquetaAria="Gremio de la base que se carga"
                      marcador="Elija el gremio…"
                      valor={convenioDelCargue}
                      opciones={gremios.map((g) => ({
                        valor: g.convenioId,
                        etiqueta: g.sigla,
                      }))}
                      alElegir={(v) => {
                        setConvenioElegido(v);
                        setPrevia(null);
                        setAplicado(null);
                      }}
                    />
                  </Campo>
                </div>
              ) : (
                suyo && (
                  <p className="text-sm text-texto-suave">
                    Se carga en <strong className="text-texto">{suyo.sigla}</strong>.
                  </p>
                )
              )}

              <div className="w-[min(260px,100%)]">
                <Campo
                  etiqueta="De dónde salió"
                  ayuda="Opcional. De esto vive la comparación entre lo que cuesta un inscrito por pauta y lo que cuesta por otras vías."
                  comoDiv
                >
                  <Desplegable
                    id="origen-del-cargue"
                    alto={38}
                    etiquetaAria="De dónde salió la base"
                    marcador="Lo cargó el equipo"
                    valor={origen}
                    opciones={ORIGENES_DE_UNA_BASE.map((o) => ({
                      valor: o.valor,
                      etiqueta: o.etiqueta,
                    }))}
                    alElegir={setOrigen}
                  />
                </Campo>
              </div>
            </div>

            {errorDelCargue && <Aviso tipo="error">{errorDelCargue}</Aviso>}

            <div className="flex flex-wrap items-center gap-3">
              <Boton
                onClick={revisar}
                disabled={
                  ocupado ||
                  !archivo ||
                  !convenioDelCargue ||
                  archivo.size > MAXIMO_ARCHIVO
                }
              >
                {ocupado && !previa ? "Revisando…" : "Revisar el archivo"}
              </Boton>
              {(archivo || informe) && (
                <button
                  type="button"
                  className="text-sm font-medium text-texto-suave hover:underline"
                  onClick={limpiarElCargue}
                >
                  Empezar de nuevo
                </button>
              )}
              {!convenioDelCargue && gremios.length > 1 && (
                <span className="text-sm text-texto-suave">
                  Falta elegir el gremio.
                </span>
              )}
            </div>
          </div>
        </Bloque>
      )}

      {/* ───────── EL INFORME ───────── */}
      {enElCargue && informe && (
        <Bloque
          titulo={
            informe.aplicado
              ? "Esto es lo que se cargó"
              : "Esto es lo que va a pasar"
          }
          descripcion={
            <>
              <span className="font-medium text-titulo">{informe.archivo}</span>{" "}
              · {informe.leidas} {informe.leidas === 1 ? "fila" : "filas"} ·
              títulos en la fila {informe.filaDeLaCabecera} ·{" "}
              {informe.convenio.slug}
            </>
          }
        >
          <div className="space-y-3">
            {informe.aplicado && (
              <Aviso tipo="exito">
                Ya está escrito. Las nuevas quedaron en la BBDD sin atender:
                cuando se gestionen y la persona complete sus datos, pasan a
                Gestión de leads.
              </Aviso>
            )}

            {/* DE UN VISTAZO: las cinco preguntas que se hacen antes
                de aplicar. */}
            <div className="flex flex-wrap items-stretch gap-2">
              <Cifra
                etiqueta="Nuevas"
                valor={informe.nuevas}
                pie={informe.aplicado ? "se crearon" : "se van a crear"}
                color="var(--exito)"
              />
              <Cifra
                etiqueta="Ya estaban"
                valor={informe.yaEstaban}
                pie="se reconocieron en la base"
              />
              {/* ENTRE «ya estaban» Y «se rellenan», que es donde se
                  lee: las tres contestan «de lo que subí, qué ya
                  teníamos». Esta es la que el cliente preguntó el 6
                  oct 2026 ---«¿pero con Gestión de leads?»---: el
                  cruce miraba la mesa y no las fichas, así que esta
                  gente entraba otra vez como nueva. */}
              <Cifra
                etiqueta="Ya en Gestión de leads"
                valor={informe.yaTienenFicha ?? 0}
                pie="no se crean ni se les toca la ficha"
                color={
                  (informe.yaTienenFicha ?? 0) > 0 ? "var(--aviso)" : undefined
                }
              />
              <Cifra
                etiqueta="Se rellenan"
                valor={informe.seRellenan}
                pie={`${informe.camposQueSeRellenan} ${
                  informe.camposQueSeRellenan === 1 ? "campo vacío" : "campos vacíos"
                }`}
              />
              <Cifra
                etiqueta="Chocan"
                valor={informe.conChoques}
                pie="traen algo distinto; no se pisa"
                color={informe.conChoques > 0 ? "var(--aviso)" : undefined}
              />
              <Cifra
                etiqueta="No sirven"
                valor={noSirven}
                pie={
                  noSirven > 0
                    ? `${informe.repetidasEnElArchivo} repetidas · ${informe.sinReconocer} sin reconocer · ${informe.fallaron} fallaron`
                    : "ninguna"
                }
                color={noSirven > 0 ? "var(--error)" : undefined}
              />
            </div>

            {/* LAS COLUMNAS QUE NO SE RECONOCEN, ARRIBA Y NO
                ESCONDIDAS. Es lo que más desconcierta: la columna
                venía en el archivo, nadie dijo nada, y meses después
                se descubre que ese dato no se cargó. No es un error
                --el cargue no es restrictivo-- pero sí es lo primero
                que hay que ver. */}
            {informe.columnasQueNoSeReconocen.length > 0 && (
              <div className="rounded-lg border border-aviso/30 bg-aviso-suave p-4 text-sm text-aviso">
                <p className="font-semibold">
                  {informe.columnasQueNoSeReconocen.length === 1
                    ? "Una columna del archivo no se reconoce y no se cargó"
                    : `${informe.columnasQueNoSeReconocen.length} columnas del archivo no se reconocen y no se cargaron`}
                </p>
                <p className="mt-1">
                  {informe.columnasQueNoSeReconocen.join(" · ")}
                </p>
                <p className="mt-1">
                  El resto del archivo sí entra. Si alguna de esas era un dato
                  que hace falta, los títulos que el cargue entiende están en la
                  plantilla.
                </p>
              </div>
            )}

            {/* LOS REPAROS: lo que le pasa al ARCHIVO, no a una
                fila. Una extensión que no es .xlsx, un peso de más,
                una hoja sin títulos. */}
            {informe.reparos.length > 0 && (
              <div className="rounded-lg border border-error/30 bg-error-suave p-4 text-sm text-error">
                <p className="font-semibold">
                  {informe.reparos.length === 1
                    ? "Hay un reparo sobre el archivo"
                    : `Hay ${informe.reparos.length} reparos sobre el archivo`}
                </p>
                <ul className="mt-2 space-y-1">
                  {/* Diez y no más: con doscientos, la lista deja de
                      ayudar y solo asusta. */}
                  {informe.reparos.slice(0, 10).map((p, i) => (
                    <li key={i}>
                      {p.fila > 0 && <strong>Fila {p.fila}: </strong>}
                      {p.problema}
                    </li>
                  ))}
                </ul>
                {informe.reparos.length > 10 && (
                  <p className="mt-2">y {informe.reparos.length - 10} más.</p>
                )}
              </div>
            )}

            {/* EL DETALLE POR FILA, con su número de fila del Excel:
                es lo que permite volver al archivo y corregirlo sin
                contar renglones. */}
            {informe.filas.length > 0 && (
              <div className="caja-scroll overflow-x-auto rounded-xl border border-borde">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-tabla-cabecera text-left text-xs tracking-wide text-texto-suave uppercase">
                    <tr>
                      <th className="w-20 px-4 py-2.5 font-medium">Fila</th>
                      <th className="px-4 py-2.5 font-medium">Quién</th>
                      <th className="px-4 py-2.5 font-medium">Qué le pasa</th>
                      <th className="px-4 py-2.5 font-medium">Se le rellena</th>
                      <th className="px-4 py-2.5 font-medium">Choca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loQuePideAlgoPrimero(informe.filas)
                      .slice(0, FILAS_QUE_SE_PINTAN)
                      .map((f) => (
                        <tr
                          key={f.fila}
                          className="border-t border-borde align-top"
                        >
                          <td className="px-4 py-2.5 font-medium tabular-nums">
                            {f.fila}
                          </td>

                          <td className="px-4 py-2.5">
                            <div className="font-medium">{f.quien}</div>
                            {f.avisos.length > 0 && (
                              <ul className="mt-0.5 space-y-0.5 text-xs text-aviso">
                                {f.avisos.map((a, i) => (
                                  <li key={i}>{a}</li>
                                ))}
                              </ul>
                            )}
                          </td>

                          <td className="px-4 py-2.5">
                            <span className={"font-medium " + TONO_QUE_PASO[f.que]}>
                              {ETIQUETA_QUE_PASO[f.que]}
                            </span>
                            {/* Con QUÉ se reconoció, que es la mitad
                                de la respuesta: «ya estaba» sin decir
                                por qué obliga a creerlo a ciegas. */}
                            {f.porque && (
                              <div className="mt-0.5 text-xs text-texto-suave">
                                {ETIQUETA_PORQUE[f.porque]}
                                {f.comoSeReconocio ? `: ${f.comoSeReconocio}` : ""}
                              </div>
                            )}
                            {/* A la persona, si fue a parar a alguna:
                                deja el buscador de abajo puesto con lo
                                que la identifica. Un enlace con la
                                búsqueda en la dirección no serviría
                                --el listado no lee la dirección-- y
                                sería un control en pie y sin efecto. */}
                            {f.leadId && informe.aplicado && (
                              <button
                                type="button"
                                className="mt-0.5 block text-xs font-medium text-marca hover:underline"
                                onClick={() => {
                                  setEstado("");
                                  setBuscar(f.quien);
                                }}
                              >
                                Buscarla en la BBDD
                              </button>
                            )}
                          </td>

                          <td className="px-4 py-2.5">
                            {f.rellena.length > 0 ? (
                              <span className="text-exito">
                                {f.rellena.join(", ")}
                              </span>
                            ) : (
                              <span className="text-texto-suave">—</span>
                            )}
                          </td>

                          <td className="px-4 py-2.5">
                            {/* LOS DOS VALORES, siempre. Un «choca el
                                correo» sin decir cuál dice el archivo
                                y cuál está guardado no se puede
                                resolver sin abrir las dos cosas. */}
                            {f.choques.length > 0 ? (
                              <ul className="space-y-1">
                                {f.choques.map((c, i) => (
                                  <li key={i}>
                                    <span className="font-medium">
                                      {c.comoSeLlama}
                                    </span>
                                    <div className="text-xs text-texto-suave">
                                      el archivo dice{" "}
                                      <span className="text-aviso">{c.dice}</span>{" "}
                                      · guardado{" "}
                                      <span className="text-texto">
                                        {c.guardado}
                                      </span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-texto-suave">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {informe.filas.length > FILAS_QUE_SE_PINTAN && (
              <p className="text-sm text-texto-suave">
                Se enseñan {FILAS_QUE_SE_PINTAN} de {informe.filas.length} filas,
                las que piden algo primero. El cargue trabaja con todas.
              </p>
            )}

            {/* APLICAR: el segundo paso, y el único que escribe. */}
            {!informe.aplicado &&
              (previaDeOtraBase ? (
                <Aviso tipo="error">
                  Esta revisión se hizo contra otro gremio. Vuelva a revisar el
                  archivo antes de aplicarlo: el mismo código de acción de
                  formación es otro curso en cada gremio.
                </Aviso>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Boton onClick={aplicar} disabled={ocupado || !archivo}>
                    {ocupado ? "Aplicando…" : "Aplicar el cargue"}
                  </Boton>
                  <span className="text-sm text-texto-suave">
                    Lo que choca no se pisa, y las columnas que no se reconocen
                    no se cargan.
                  </span>
                </div>
              ))}
          </div>
        </Bloque>
      )}

      {/* ───────── EL LISTADO ───────── */}
      {/* Solo en la vista principal: quien entra a cargar no viene a
          mirar la base, y la lista entera debajo del formulario es
          lo que el cliente señaló. */}
      {!enElCargue && (
      <>
      {/**
        * UNA SOLA FILA, SIN RÓTULOS NI AYUDAS.
        *
        * «Qué lista ve / Buscar en toda la base: ¿esto qué significa?
        * Ocupa mucho espacio» (cliente, 7 oct 2026). Y tenía razón:
        * eran dos campos con rótulo arriba, una ayuda larga debajo y
        * un recuento que ya dicen las cuatro tarjetas de encima. Tres
        * renglones para dos controles.
        *
        * El PÁRRAFO que escribí para distinguir los dos buscadores era
        * parte del problema: si hace falta un párrafo para explicar un
        * campo, el campo está mal puesto. Lo dice sobre todo el propio
        * hueco ---«Buscar en 1.252…»--- frente al de la tabla, que sigue
        * diciendo «Buscar en la tabla…».
        *
        * PERO UN RENGLÓN SÍ HACE FALTA, y lo cacé Josse al montarlo:
        * «dentro de lo que quitaste no todo es forma: la ayuda que
        * explica que la tabla filtra sobre lo cargado sí hace falta»
        * (7 oct 2026).
        *
        * Y es cierto, porque sin ella hay una trampa que no se ve: el
        * buscador de la tabla solo mira las filas YA TRAÍDAS, así que
        * se puede buscar a alguien que SÍ está en la base y que la
        * tabla diga que no hay nadie. Quitar el párrafo estuvo bien;
        * quitar también el aviso fue pasarme.
        *
        * Un renglón, pequeño y con las dos cifras puestas: eso no es
        * el bloque de tres que el cliente mandó quitar.
        */}
      {/**
        * NI UNA FILA DE CONTROLES PROPIA, NI DOS BUSCADORES.
        *
        * «Ocupa mucho espacio, acomódalo» (cliente, 7 oct 2026), y
        * tenía razón las DOS veces que lo dijo. La primera junté los
        * dos campos en una fila, pero dejé esa fila ENCIMA de la barra
        * de la tabla: seguían siendo dos renglones de controles y dos
        * cajas de buscar, una debajo de otra, preguntando cosas
        * parecidas. Lo di por cerrado sin mirar la pantalla.
        *
        * Ahora el desplegable va DENTRO de la barra de la tabla, por
        * `filtrosDelServidor`, que existe justo para esto y lo pidió él
        * mismo el 24 sep: «fusionado donde está el buscador, no
        * desorden».
        *
        * Y EL BUSCADOR DE ARRIBA SE VA. Era el que preguntaba a toda
        * la base mientras el de la tabla filtraba lo ya traído ---dos
        * cajas que se parecen y no hacen lo mismo es justo lo que no
        * se entiende---. Queda el de la tabla, y la BÚSQUEDA DE
        * SERVIDOR se cuelga de él: lo que se teclee ahí baja de la
        * base entera, así que no se pierde nada de lo que hacía el
        * otro. Por eso tampoco hace falta ya el renglón que explicaba
        * la diferencia: no hay diferencia que explicar.
        */}

      {/**
        * LA TABLA DE LA CASA, LA MISMA QUE GESTION DE LEADS.
        *
        * «¿Pero queda como la visual de Gestion de leads?» (cliente,
        * 6 oct 2026), preguntado tres veces. Y no quedaba: esto era
        * una tabla pintada a mano con seis columnas fijas, sin elegir
        * columnas, sin filtros por columna, sin vistas guardadas, sin
        * ordenar y sin Excel.  trae las seis.
        *
        * Las columnas son PROPIAS del lead y no las de participante:
        * media docena de aquellas pediria datos que un lead no tiene,
        * y una columna que siempre sale en raya enseña a no mirar la
        * tabla.
        */}
      <Tabla
        id="bbdd-leads-v1"
        columnas={columnasDeLead()}
        filas={leads}
        clave={(l) => l.id}
        total={datos?.total}
        /// Pulsar la fila abre su cajon de gestion, que es lo que ya
        /// hacia el nombre: asignar, llamar y anotar sin salir.
        alClic={(l) => setGestionando(l)}
        /// El único filtro de pantalla que queda, metido en la barra
        /// de la tabla en vez de en una fila propia encima.
        filtrosDelServidor={
          <>
            <div className="w-[min(210px,100%)]">
              <Desplegable
                alto={34}
                etiquetaAria="Qué lista ve"
                marcador="Todos, incluidos los ya atendidos"
                valor={estado}
                opciones={[
                  { valor: "", etiqueta: "Todos, incluidos los ya atendidos" },
                  ...ESTADOS.map((s) => ({
                    valor: s,
                    etiqueta: ETIQUETA_ESTADO_LEAD[s],
                  })),
                ]}
                alElegir={setEstado}
              />
            </div>
            {/**
              * Y EL BUSCADOR DE LA BASE, EN LA MISMA FILA.
              *
              * No se puede quitar ---el de la tabla solo mira las filas
              * ya traídas, y con una base de miles eso deja fuera a casi
              * todo el mundo--- pero sí puede dejar de ocupar su propio
              * renglón encima.
              *
              * Y el marcador dice en cuántas busca ---«Buscar en las
              * 1.252…»--- frente al de la tabla, que dice «Buscar en la
              * tabla…». Los dos a la vista y uno al lado del otro: así
              * la diferencia se lee de un vistazo y no hace falta el
              * párrafo que el cliente mandó quitar.
              */}
            <input
              style={{ height: 34 }}
              className={CLASE_BUSCADOR + " min-w-[220px] flex-1"}
              aria-label="Buscar en toda la base"
              placeholder={
                datos
                  ? `Buscar en ${datos.total.toLocaleString("es-CO")}: documento, nombre, correo o celular`
                  : "Buscar en toda la base"
              }
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </>
        }
        /**
         * SE PUEDE MARCAR Y ASIGNAR, que es para lo que se carga una
         * base.
         *
         * «Se debe permitir asignar, es la visual de Gestión de leads
         * y no la veo igual» (cliente, 7 oct 2026), después de que le
         * llamaran la atención por ello.
         *
         * Yo había leído «que se vea como Gestión de leads» como las
         * columnas, los filtros y el Excel, y había dejado fuera lo
         * único que de verdad hace falta: repartir. Una base de 1.252
         * personas sin repartir no es trabajo de nadie, y abrirlas de
         * una en una por el cajón son 1.252 clics.
         */
        seleccion
        accionesLote={(ids, limpiar) => (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {reparte ? (
              <AsignarLoteDeLaBase
                ids={ids}
                asesores={datos?.asesores ?? []}
                alTerminar={async ({ repartidos, sinTocar }) => {
                  setError(null);
                  limpiar();
                  /// Y SE DICE LO QUE NO SE TOCÓ, que es la mitad que
                  /// importa: el servidor salta a quien ya tiene ficha
                  /// o revocó. Callarlo deja a quien reparte creyendo
                  /// que los 50 quedaron repartidos.
                  setAsignados(
                    `${repartidos} ${repartidos === 1 ? 'lead' : 'leads'} con asesor nuevo.` +
                      (sinTocar > 0
                        ? ` ${sinTocar} sin tocar: ya tienen ficha o no se les puede contactar.`
                        : ''),
                  );
                  await cargar();
                }}
                alFallar={setError}
              />
            ) : (
              /* No se esconde a secas: quien lo busca tiene que saber
                 por qué no está y a quién pedírselo. */
              <span className="text-sm text-texto-suave">
                Repartir leads entre asesores lo hace un líder de
                inscripciones.
              </span>
            )}
            {/* DESCARTAR EN LOTE, que en la Mesa ya existía y aquí no:
                una base cargada trae renglones que no son de nadie
                ---duplicados, números de prueba--- y sacarlos de uno en
                uno es el mismo problema que repartirlos de uno en uno.
                Con el permiso del cargue, que es el que pide el
                servidor. */}
            {puedeCargar && (
              <DescartarLoteDeLaBase
                ids={ids}
                alTerminar={async ({ descartados, sinTocar }) => {
                  setError(null);
                  limpiar();
                  setAsignados(
                    `${descartados} ${descartados === 1 ? "lead descartado" : "leads descartados"}.` +
                      (sinTocar > 0
                        ? ` ${sinTocar} sin tocar: ya tienen ficha o no estaban pendientes.`
                        : ""),
                  );
                  await cargar();
                }}
                alFallar={setError}
              />
            )}
          </div>
        )}
        vacio={
          buscado || estado
            ? "Con esos filtros no aparece ninguno."
            : "Esta base se llena cargando un archivo. Baje la plantilla, llenela con lo que tenga —basta el correo o el celular— y subala."
        }
      />

      {/* Pasar de página: con una base de miles, sin esto solo se
          ven las primeras 50 y el resto es invisible salvo buscando. */}
      {datos && datos.paginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            className="rounded-lg border border-borde px-3 py-1 disabled:opacity-40"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1}
          >
            Anterior
          </button>
          <span className="text-texto-suave">
            Página {datos.pagina} de {datos.paginas}
          </span>
          <button
            className="rounded-lg border border-borde px-3 py-1 disabled:opacity-40"
            onClick={() => setPagina((p) => Math.min(datos.paginas, p + 1))}
            disabled={pagina >= datos.paginas}
          >
            Siguiente
          </button>
        </div>
      )}
      </>
      )}

      {arreglando && (
        <ArreglarLead
          lead={arreglando}
          cursos={datos?.cursos ?? []}
          catalogos={catalogos}
          alCerrar={() => setArreglando(null)}
          alGuardado={cargar}
        />
      )}

      {gestionando && (
        <GestionarLead
          lead={gestionando}
          alCerrar={() => setGestionando(null)}
          alGuardado={cargar}
        />
      )}
    </div>
  );
}

/**
 * DE CIEN EN CIEN. El servidor no admite más por petición, y la
 * tabla deja marcar «las N filtradas», que en una base de 1.252 son
 * 1.252: sin partirlo, el lote entero se rechazaba.
 */
function enTramos(ids: string[]): string[][] {
  const tramos: string[][] = [];
  for (let i = 0; i < ids.length; i += TOPE_DEL_LOTE) {
    tramos.push(ids.slice(i, i + TOPE_DEL_LOTE));
  }
  return tramos;
}

/**
 * Descartar los marcados, con motivo obligatorio.
 *
 * No se borran: salen de la base de trabajo con estado «descartado» y
 * el motivo queda escrito con el nombre de quien lo hizo. El servidor
 * solo toca los pendientes sin ficha; los demás se cuentan como «sin
 * tocar» y se dice.
 */
function DescartarLoteDeLaBase({
  ids,
  alTerminar,
  alFallar,
}: {
  ids: string[];
  alTerminar: (r: { descartados: number; sinTocar: number }) => Promise<void>;
  alFallar: (motivo: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  async function descartar() {
    setTrabajando(true);
    try {
      let descartados = 0;
      let sinTocar = 0;
      for (const tramo of enTramos(ids)) {
        const r = await mesaApi.descartarLote(tramo, motivo.trim());
        descartados += r.descartados;
        sinTocar += r.sinTocar;
      }
      setAbierto(false);
      setMotivo("");
      await alTerminar({ descartados, sinTocar });
    } catch (e) {
      alFallar(
        e instanceof ErrorApi ? e.message : "No se pudieron descartar.",
      );
    } finally {
      setTrabajando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm font-medium text-error underline underline-offset-2 hover:no-underline"
      >
        Descartar
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        autoFocus
        aria-label="Por qué se descartan"
        placeholder="¿Por qué? Duplicado, número de prueba…"
        value={motivo}
        maxLength={300}
        onChange={(e) => setMotivo(e.target.value)}
        className={CLASE_CONTROL + " min-w-[16rem]"}
      />
      <Boton
        type="button"
        onClick={() => void descartar()}
        disabled={trabajando || !motivo.trim()}
      >
        {trabajando
          ? "Descartando…"
          : `Descartar ${ids.length} ${ids.length === 1 ? "lead" : "leads"}`}
      </Boton>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        disabled={trabajando}
        className="text-texto-suave hover:underline"
      >
        Cancelar
      </button>
    </div>
  );
}

/**
 * LA BARRA DE REPARTIR, la misma que la de Gestión de leads.
 *
 * Se escribe aquí y no se importa de `participantes/page` porque
 * aquella llama a `crmApi.asignarAsesorEnLote` ---fichas--- y esta a
 * `mesaApi.asignar` ---leads de la mesa---. Son dos poblaciones con
 * dos rutas distintas en el servidor; compartir el componente
 * obligaría a pasarle la función y a leer cuál de las dos es cada
 * vez, que es más sitio donde equivocarse que estas veinte líneas.
 */
function AsignarLoteDeLaBase({
  ids,
  asesores,
  alTerminar,
  alFallar,
}: {
  ids: string[];
  asesores: Array<{ id: string; nombre: string }>;
  alTerminar: (r: { repartidos: number; sinTocar: number }) => Promise<void>;
  alFallar: (motivo: string) => void;
}) {
  const [trabajando, setTrabajando] = useState(false);

  async function asignar(asesorId: string | null) {
    setTrabajando(true);
    try {
      let repartidos = 0;
      let sinTocar = 0;
      for (const tramo of enTramos(ids)) {
        const r = await mesaApi.asignar(tramo, asesorId);
        repartidos += r.repartidos;
        sinTocar += r.sinTocar;
      }
      await alTerminar({ repartidos, sinTocar });
    } catch (e) {
      /// Un fallo aquí NO se traga: se elegía asesor, no pasaba nada
      /// y la pantalla no decía ni bien ni mal. Es el mismo defecto
      /// que ya se arregló en Gestión de leads.
      alFallar(
        e instanceof ErrorApi ? e.message : "No se pudo asignar el asesor.",
      );
    } finally {
      setTrabajando(false);
    }
  }

  return (
    /* Un `<div>` y no un `<label>`: el disparador del `Desplegable`
       es un `<button>`, y una etiqueta no se ata a un botón. */
    <div className="flex items-center gap-3 text-sm">
      <span className="whitespace-nowrap">Asignar a</span>
      <div className="max-w-[13rem] min-w-[11rem]">
        {/* ESTO ES UNA ACCIÓN, no un campo con valor: se elige, se
            asigna el lote y el control vuelve a quedar en blanco. De
            ahí el `valor=""` fijo y el marcador siempre a la vista. */}
        <Desplegable
          valor=""
          desactivado={trabajando}
          etiquetaAria="Asignar los seleccionados a un asesor"
          marcador="Elija un asesor…"
          alElegir={(v) => {
            if (v === "") return;
            void asignar(v === "NADIE" ? null : v);
          }}
          opciones={[
            ...asesores.map((a) => ({ valor: a.id, etiqueta: a.nombre })),
            { valor: "NADIE", etiqueta: "— Quitarles el asesor —" },
          ]}
        />
      </div>
      {/**
       * Y SE DICE POR QUÉ NO ESTÁN TODOS.
       *
       * «Que los asesores que tengo en Gestión de leads también me
       * salgan» (cliente, 7 oct 2026), viendo dos nombres aquí y
       * siete en la columna Asesor.
       *
       * Las dos listas son correctas y son DISTINTAS: la columna
       * enseña a quien YA lleva leads, y esto a quien PUEDE
       * recibirlos, que desde el 2 oct 2026 ---y a petición suya---
       * son solo Gestor y Líder de Inscripciones. Un académico o una
       * cuenta de consulta no atienden captación.
       *
       * Sin esta línea las dos listas se leen como una sola rota, y
       * eso ya costó una discusión entera.
       */}
      <span className="text-xs text-texto-suave">
        Solo Gestor y Líder de Inscripciones
      </span>
    </div>
  );
}
