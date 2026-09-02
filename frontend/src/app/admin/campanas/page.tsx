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
import { Cargando } from "@/components/admin/piezas";
import { Desplegable } from "@/components/admin/desplegable";
import { IconoDerecha } from "@/components/admin/iconos";

import {
  AccionesDePagina,
  Aviso,
  Boton,
  CLASE_CONTROL,
  EscogerArchivo,
  Tarjeta,
  useAdmin,
} from "@/components/admin/marco-admin";
import { useToast } from "@/components/admin/toast";
import { CargarBase } from "@/components/admin/cargar-base";
import { CuandoVaASalir } from "@/components/admin/cuando-sale";
import { VistaPreviaCorreo } from "@/components/admin/vista-previa-correo";
import {
  AvisoDeSeccion,
  TextoDeSeccion,
} from "@/components/admin/secciones";
import { ErrorApi } from "@/lib/api";
import {
  campanasApi,
  ETIQUETA_ESTADO_CAMPANA,
  type Campana,
  type Resultados,
  type Segmento,
  type SegmentoListo,
} from "@/lib/campanas-api";
import type { VariableCorreo } from "@/lib/plantillas-correo-api";

const fecha = (s: string) =>
  new Date(s).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

export default function PaginaCampanas() {
  const toast = useToast();
  const { gremio, gremios } = useAdmin();
  const [campanas, setCampanas] = useState<Campana[] | null>(null);
  const [segmentos, setSegmentos] = useState<SegmentoListo[]>([]);
  const [variables, setVariables] = useState<VariableCorreo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [viendo, setViendo] = useState<string | null>(null);

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
  }, [cargar]);

  /// El gremio de la campaña: el elegido arriba, o el único
  /// que tenga la cuenta. Una campaña SIEMPRE es de un gremio:
  /// una de BRITCHAM no le escribe a gente de ADECOPRIA.
  const convenioId = gremio ?? (gremios.length === 1 ? gremios[0].convenioId : null);

  if (!campanas) {
    return error ? (
      <Aviso tipo="error">{error}</Aviso>
    ) : (
      <Cargando />
    );
  }

  return (
    /// Sin cabecera propia, como Calendario y Gestión de
    /// Inscripciones. La miga de arriba ya dice «Campaña
    /// Mailing / Campañas»; repetirlo debajo en grande era
    /// decirlo dos veces y dejaba este módulo con otra cara que
    /// el resto del panel. El botón sube a la barra, que es
    /// donde el resto de pantallas pone el suyo.
    ///
    /// Lo que decía la bajada --de a uno, en horario de
    /// Colombia-- no se pierde: está entero y mejor contado en
    /// «Cómo sale, y por qué así», que va justo debajo.
    <div className="flex min-h-0 grow flex-col gap-4 px-4 pt-4">
      {!creando && convenioId && (
        <AccionesDePagina>
          <Boton onClick={() => setCreando(true)}>Nueva campaña</Boton>
        </AccionesDePagina>
      )}

      {!convenioId && (
        <AvisoDeSeccion color="var(--aviso)">
          Elija un gremio arriba para poder crear una campaña. Una campaña es
          siempre de un gremio: la de uno no le escribe a la gente del otro.
        </AvisoDeSeccion>
      )}

      <ComoSale />

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
        <Tarjeta titulo="Todavía no hay campañas">
          <p className="text-sm text-texto-suave">
            Con «Nueva campaña» se escoge a quiénes, se escribe el mensaje y se
            mira cómo queda antes de lanzarlo.
          </p>
        </Tarjeta>
      )}

      {campanas.map((c) => (
        <Tarjeta
          key={c.id}
          titulo={c.nombre}
          descripcion={`${c.convenio.sigla ?? c.convenio.nombre} · ${c._count.destinatarios} destinatarios`}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Pildora estado={c.estado} />
              <span className="text-texto-suave">{c.asunto}</span>
            </div>
            <p className="text-xs text-texto-suave">
              Creada el {fecha(c.creadoEn)}
              {c.creadoPor && ` por ${c.creadoPor.nombre}`}
              {c.lanzadaEn && ` · lanzada el ${fecha(c.lanzadaEn)}`}
            </p>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              {c.estado === "BORRADOR" && (
                <Boton
                  onClick={() =>
                    void campanasApi
                      .lanzar(c.id)
                      .then((r) => {
                        toast.exito(
                          `Lanzada a ${r.destinatarios} personas. Va a salir de a poco.`,
                        );
                        return cargar();
                      })
                      .catch((e) => toast.error((e as ErrorApi).message))
                  }
                >
                  Lanzar
                </Boton>
              )}
              {c.estado === "ENVIANDO" && (
                <button
                  type="button"
                  onClick={() =>
                    void campanasApi
                      .pausar(c.id)
                      .then(cargar)
                      .then(() => toast.exito("Pausada. No sale ninguno más."))
                      .catch((e) => toast.error((e as ErrorApi).message))
                  }
                  className="text-error underline"
                >
                  Pausar
                </button>
              )}
              {c.estado === "PAUSADA" && (
                <button
                  type="button"
                  onClick={() =>
                    void campanasApi
                      .reanudar(c.id)
                      .then(cargar)
                      .then(() => toast.exito("Sigue saliendo."))
                      .catch((e) => toast.error((e as ErrorApi).message))
                  }
                  className="text-marca underline"
                >
                  Reanudar
                </button>
              )}
              {c.estado !== "BORRADOR" && (
                <button
                  type="button"
                  onClick={() => setViendo(viendo === c.id ? null : c.id)}
                  className="text-marca underline"
                >
                  {viendo === c.id ? "Ocultar resultados" : "Ver resultados"}
                </button>
              )}
            </div>

            {viendo === c.id && <ResultadosDe id={c.id} />}
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}

/// Se explica UNA vez, arriba, y no en cada campaña: es la
/// regla de la casa, no un detalle de una campaña.
function ComoSale() {
  return (
    /// Banda normal, no un bloque de color.
    ///
    /// Iba sobre `--superficie-alterna`, y con eso la pantalla
    /// tenia tres fondos: el de la pagina, el de las bandas y
    /// este. El maximo del redisenio son dos.
    <TextoDeSeccion titulo="Cómo sale, y por qué así">
      <p className="mt-1.5 text-[0.78125rem] leading-relaxed text-texto-suave">
        Salen por la cuenta de la oficina, de a uno, con{" "}
        <strong className="text-texto">uno a tres segundos</strong> entre cada
        uno: una campaña de 200 sale en unos siete minutos.
      </p>
      <p className="mt-2 text-[0.78125rem] leading-relaxed text-texto-suave">
        Dentro del <strong className="text-texto">horario de Colombia</strong>{" "}
        —8 de la mañana a 6 de la tarde, de lunes a viernes—, hasta{" "}
        <strong className="text-texto">300 al día</strong> y{" "}
        <strong className="text-texto">máximo 2 por persona</strong>. Lo que
        hace que Google cierre una cuenta no es el ritmo: es pasarse del cupo
        diario y que la gente marque spam. Por eso el freno está ahí y no en la
        velocidad.
      </p>
    </TextoDeSeccion>
  );
}

function Pildora({ estado }: { estado: Campana["estado"] }) {
  /// El color en la letra, como en el resto del panel.
  const tono: Record<Campana["estado"], string> = {
    BORRADOR: "text-texto-suave",
    ENVIANDO: "text-marca",
    PAUSADA: "text-aviso",
    TERMINADA: "text-exito",
  };
  return (
    <span
      className={`font-semibold whitespace-nowrap ${tono[estado]}`}
      style={{ fontSize: "0.75rem" }}
    >
      {ETIQUETA_ESTADO_CAMPANA[estado]}
    </span>
  );
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

  if (!r) return <p className="text-sm text-texto-suave">Cargando…</p>;

  return (
    <div className="space-y-3 rounded-xl border border-borde p-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Enviados" valor={r.enviados} de={r.total} />
        <Cifra titulo="Por salir" valor={r.pendientes} />
        <Cifra titulo="Hicieron clic" valor={r.conClic} de={r.enviados} firme />
        <Cifra titulo="Aperturas (aprox.)" valor={r.aperturasEstimadas} />
      </div>

      {(r.fallidos > 0 || r.omitidos > 0) && (
        <p className="text-sm text-texto-suave">
          {r.fallidos > 0 && `${r.fallidos} fallaron. `}
          {r.omitidos > 0 && `${r.omitidos} se omitieron (sin correo o sin datos).`}
        </p>
      )}

      {/* El aviso va PEGADO al número, no en una nota al pie:
          quien lea «112 aperturas» sin esto va a tomar una
          decisión con un dato inflado. */}
      <p className="rounded-lg bg-aviso-suave p-3 text-xs text-aviso">
        <strong>Las aperturas son una estimación, y tiran para arriba.</strong>{" "}
        Gmail descarga la imagen que las mide antes de que nadie lea nada, y
        Apple Mail la pide por todos sus usuarios. El número que sí es firme es
        el de clics: ese pasa por nuestro servidor, con una persona pulsando.
      </p>
    </div>
  );
}

function Cifra({
  titulo,
  valor,
  de,
  firme,
}: {
  titulo: string;
  valor: number;
  de?: number;
  firme?: boolean;
}) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-3">
      <p className="text-xs text-texto-suave">{titulo}</p>
      <p className={`mt-1 text-2xl tabular-nums ${firme ? "text-marca" : ""}`}>
        {valor.toLocaleString("es-CO")}
        {de !== undefined && de > 0 && (
          <span className="ml-1 text-sm text-texto-suave">
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
    <Tarjeta titulo="Nueva campaña">
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
      <div className="space-y-5">
          <div>
            <label htmlFor="c-nombre" className="mb-1.5 block text-sm font-medium">
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
            <p className="mb-1.5 text-sm font-medium">De dónde sale la lista</p>
            {/* Con aire entre las dos. Pegadas se leían como un
                solo control partido por una raya, y no lo son:
                son dos caminos distintos y excluyentes. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["SEGMENTO", "De su base", "Con reglas sobre los inscritos"],
                  ["CARGUE", "De un archivo", "Correo y primer nombre, en .xlsx"],
                ] as Array<["SEGMENTO" | "CARGUE", string, string]>
              ).map(([valor, titulo, pie]) => (
                <button
                  key={valor}
                  type="button"
                  disabled={Boolean(reciencreada)}
                  onClick={() => setOrigen(valor)}
                  className={`rounded-xl border p-3 text-left transition disabled:opacity-50 ${
                    origen === valor
                      ? "border-2 border-marca bg-marca-suave"
                      : "border-campo-borde hover:bg-superficie-alterna"
                  }`}
                >
                  <span className="block text-sm font-medium">{titulo}</span>
                  <span className="block text-xs text-texto-suave">{pie}</span>
                </button>
              ))}
            </div>
          </div>

          {origen === "CARGUE" && (
            <div className="rounded-xl border border-borde bg-superficie-alterna p-4 text-xs text-texto-suave">
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
            <label htmlFor="c-seg" className="mb-1.5 block text-sm font-medium">
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
              <p className="mt-1.5 text-sm text-texto-suave">
                {elegido.para}{" "}
                {cuantos === null ? (
                  "Contando…"
                ) : (
                  <strong className="text-texto">
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
            <label htmlFor="c-asunto" className="mb-1.5 block text-sm font-medium">
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
            <label htmlFor="c-cuerpo" className="mb-1.5 block text-sm font-medium">
              El mensaje
            </label>
            <textarea
              id="c-cuerpo"
              ref={cajaCuerpo}
              rows={12}
              className={`${CLASE_CONTROL} font-mono text-[13px] leading-relaxed`}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder={"{{saludo}}:\n\nPara terminar su inscripción nos faltan unos datos suyos."}
            />
            <p className="mt-1.5 text-xs text-texto-suave">
              Si escribe un enlace, se cuenta quién le da clic.
            </p>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setCatalogoAbierto(!catalogoAbierto)}
                className="inline-flex items-center gap-2 rounded-sm border border-campo-borde bg-superficie px-3 py-2 text-[13px] font-semibold text-marca transition hover:border-marca"
              >
                <span className="text-[15px] leading-none">+</span> Insertar dato
                <IconoDerecha
                  tamano={12}
                  className={`transition-transform ${catalogoAbierto ? "rotate-90" : ""}`}
                />
              </button>
              <span className="ml-2.5 text-[11.5px] text-texto-suave opacity-80">
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
            <p className="mb-1.5 block text-sm font-medium">
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
            <p className="mt-1.5 text-xs text-texto-suave">
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
              className="flex w-full items-center gap-2.5 rounded-md border border-borde bg-superficie px-4 py-3 text-left transition hover:border-campo-borde"
            >
              <span className="text-[12px] font-bold tracking-[0.03em] uppercase text-texto-suave opacity-80">
                Así va a salir
              </span>
              <span className="rounded-xs bg-marca-suave px-2 py-0.5 text-[11px] font-semibold text-marca">
                Con datos de ejemplo
              </span>
              <span className="ml-auto text-[12px] font-semibold text-texto-suave">
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
            <button type="button" onClick={alCerrar} className="text-sm underline">
              Cancelar
            </button>
            <span className="text-xs text-texto-suave">
              Crear no manda nada. Se lanza después, cuando la haya revisado.
            </span>
          </div>
      </div>
    </Tarjeta>
  );
}
