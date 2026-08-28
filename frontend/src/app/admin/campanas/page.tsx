"use client";

/** Campañas: a quiénes, qué dice, y cómo va. */

/// Una campaña no se manda: se LANZA, y sale despacio. Por eso
/// esta pantalla enseña dos cosas antes de dejar lanzar —a
/// cuántos le va y cómo queda el correo— y una después: cómo
/// va saliendo. En medio no hay botón de «mandar ya», porque
/// no existe: la cola se vacía sola dentro del horario.

import { useCallback, useEffect, useState } from "react";

import {
  Aviso,
  Boton,
  CLASE_CONTROL,
  Tarjeta,
  useAdmin,
} from "@/components/admin/marco-admin";
import { useToast } from "@/components/admin/toast";
import { CargarBase } from "@/components/admin/cargar-base";
import { VistaPreviaCorreo } from "@/components/admin/vista-previa-correo";
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
      <p className="text-texto-suave">Cargando…</p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campañas</h1>
          <p className="mt-1 max-w-3xl text-texto-suave">
            Un correo que sale a muchos, de a uno. Se lanza y va saliendo solo,
            en horario de Colombia.
          </p>
        </div>
        {!creando && convenioId && (
          <Boton onClick={() => setCreando(true)}>Nueva campaña</Boton>
        )}
      </header>

      {!convenioId && (
        <div className="rounded-2xl border border-aviso/40 bg-aviso-suave p-5 text-sm text-aviso">
          Elija un gremio arriba para poder crear una campaña. Una campaña es
          siempre de un gremio: la de uno no le escribe a la gente del otro.
        </div>
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
    <div className="rounded-2xl border border-borde bg-superficie-alterna p-5 text-sm">
      <p className="font-medium">Cómo sale, y por qué así</p>
      <p className="mt-1 text-texto-suave">
        Salen por la cuenta de la oficina, de a uno, con{" "}
        <strong className="text-texto">uno a tres segundos</strong> entre cada
        uno: una campaña de 200 sale en unos siete minutos.
      </p>
      <p className="mt-2 text-texto-suave">
        Dentro del <strong className="text-texto">horario de Colombia</strong>{" "}
        —8 de la mañana a 6 de la tarde, de lunes a viernes—, hasta{" "}
        <strong className="text-texto">300 al día</strong> y{" "}
        <strong className="text-texto">máximo 2 por persona</strong>. Lo que
        hace que Google cierre una cuenta no es el ritmo: es pasarse del cupo
        diario y que la gente marque spam. Por eso el freno está ahí y no en la
        velocidad.
      </p>
    </div>
  );
}

function Pildora({ estado }: { estado: Campana["estado"] }) {
  const tono: Record<Campana["estado"], string> = {
    BORRADOR: "bg-superficie-alterna text-texto-suave",
    ENVIANDO: "bg-marca-suave text-marca",
    PAUSADA: "bg-aviso-suave text-aviso",
    TERMINADA: "bg-exito-suave text-exito",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${tono[estado]}`}>
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
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
            <div className="grid gap-2 sm:grid-cols-2">
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
            <select
              id="c-seg"
              className={CLASE_CONTROL}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            >
              {segmentos.map((s) => (
                <option key={s.clave} value={s.clave}>
                  {s.titulo}
                </option>
              ))}
            </select>
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
              rows={12}
              className={`${CLASE_CONTROL} font-mono text-[13px] leading-relaxed`}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder={"{{saludo}}:\n\nPara terminar su inscripción nos faltan unos datos suyos."}
            />
            <p className="mt-1.5 text-xs text-texto-suave">
              Si escribe un enlace, se cuenta quién le da clic.
            </p>
          </div>

          <div>
            <label htmlFor="c-banner" className="mb-1.5 block text-sm font-medium">
              Banner del encabezado (opcional)
            </label>
            <input
              id="c-banner"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setBanner(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {/* SVG no: Gmail y Outlook no lo dibujan y quedaría
                un hueco blanco justo arriba del correo. */}
            <p className="mt-1.5 text-xs text-texto-suave">
              PNG, JPG o WebP, hasta 2 MB. Ancho recomendado 600 px. El SVG no
              sirve: Gmail y Outlook no lo dibujan.
            </p>
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

        <div className="space-y-5">
          <VistaPreviaCorreo
            asunto={asunto}
            cuerpo={cuerpo}
            variables={variables}
            banner={banner}
          />

        <div className="rounded-xl border border-borde bg-superficie-alterna p-4">
          <p className="text-sm font-medium">Lo que puede poner</p>
          <p className="mt-1 text-xs text-texto-suave">
            Se llena con los datos de cada persona.
          </p>
          <ul className="mt-3 space-y-1.5">
            {variables.map((v) => (
              <li key={v.clave}>
                <button
                  type="button"
                  onClick={() => setCuerpo((c) => `${c}{{${v.clave}}}`)}
                  className="w-full rounded-lg px-2 py-1 text-left transition hover:bg-superficie"
                >
                  <span className="font-mono text-[12px] text-marca">
                    {`{{${v.clave}}}`}
                  </span>
                  <span className="block text-xs text-texto-suave">{v.titulo}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        </div>
      </div>
    </Tarjeta>
  );
}
