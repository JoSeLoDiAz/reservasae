"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  api,
  bonito,
  ErrorApi,
  type Accion,
  type Catalogo,
  type Modalidad,
  type Oferta,
  type Reserva,
} from "@/lib/api";
import { CajaDePolitica, usePolitica } from "@/components/caja-de-politica";
import {
  formularioPublico,
  type FormularioPublico,
  type PreguntaPublica,
} from "@/lib/formularios-api";
import type { PoliticaPublica } from "@/lib/politicas-api";

const MODALIDAD: Record<Modalidad, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  HIBRIDA: "Híbrido",
};

const ETIQUETA_SEMAFORO = {
  DISPONIBLE: { texto: "Disponible", clase: "bg-exito-suave text-exito" },
  ULTIMOS_CUPOS: { texto: "Últimos cupos", clase: "bg-aviso-suave text-aviso" },
  COMPLETO: { texto: "Completo", clase: "bg-error-suave text-error" },
} as const;

/** Valor de un campo del formulario. */
type Valor = string | string[] | boolean | number | undefined;

type Estado = "cargando" | "listo" | "enviando" | "hecho" | "no-disponible";

export function FormularioReserva({ slug }: { slug: string }) {
  const [formulario, setFormulario] = useState<FormularioPublico | null>(null);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState<string | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [yaReservado, setYaReservado] = useState(false);
  const [resultado, setResultado] = useState<Reserva | null>(null);

  const [valores, setValores] = useState<Record<string, Valor>>({});

  /// El texto se pide APARTE del formulario, y a proposito.
  ///
  /// Si fuera en la misma cadena de carga, un convenio sin
  /// politica publicada dejaria el formulario entero sin
  /// dibujarse por una tarea pendiente nuestra. Asi lo peor que
  /// pasa es que salga el texto de respaldo.
  const politica = usePolitica(formulario?.convenio.slug, "RESERVA");

  useEffect(() => {
    let vigente = true;
    formularioPublico(slug)
      .then(async (definicion) => {
        if (!vigente) return;
        setFormulario(definicion);
        const cat = await api.catalogo(definicion.convenio.slug);
        if (!vigente) return;
        setCatalogo(cat);
        setEstado(cat.acciones.length ? "listo" : "no-disponible");
      })
      .catch((e: ErrorApi) => {
        if (!vigente) return;
        // notFound() solo sirve durante el render: aqui
        // dentro se pierde y la pagina se queda cargando
        if (e.estado === 404) return setNoExiste(true);
        setError(e.message);
        setEstado("no-disponible");
      });
    return () => {
      vigente = false;
    };
  }, [slug]);

  // secciones, con las sueltas al final
  const bloques = useMemo(() => {
    if (!formulario) return [];
    const conSueltas = formulario.sueltas.length
      ? [
          ...formulario.secciones,
          { id: "__sueltas", titulo: "Otros datos", descripcion: null, preguntas: formulario.sueltas },
        ]
      : formulario.secciones;
    return conSueltas.filter((s) => s.preguntas.length > 0);
  }, [formulario]);

  const todas = useMemo(() => bloques.flatMap((b) => b.preguntas), [bloques]);

  const porCampo = useMemo(() => {
    const mapa = new Map<string, PreguntaPublica>();
    for (const p of todas) if (p.campoNucleo) mapa.set(p.campoNucleo, p);
    return mapa;
  }, [todas]);

  // el curso elegido
  const accion: Accion | undefined = useMemo(() => {
    const pregunta = porCampo.get("ACCION_FORMACION");
    const id = pregunta ? (valores[pregunta.id] as string | undefined) : undefined;
    return catalogo?.acciones.find((a) => a.id === id);
  }, [catalogo, porCampo, valores]);

  const oferta: Oferta | undefined = useMemo(() => {
    const pregunta = porCampo.get("OFERTA");
    const id = pregunta ? (valores[pregunta.id] as string | undefined) : undefined;
    return accion?.ofertas.find((o) => o.id === id);
  }, [accion, porCampo, valores]);

  function poner(preguntaId: string, valor: Valor) {
    setValores((previos) => ({ ...previos, [preguntaId]: valor }));
  }

  /** Si la pregunta debe mostrarse. */
  function visible(pregunta: PreguntaPublica): boolean {
    if (!pregunta.dependeDePreguntaId) return true;
    const valorMadre = valores[pregunta.dependeDePreguntaId];
    if (Array.isArray(valorMadre)) return valorMadre.includes(pregunta.dependeDeValor ?? "");
    return valorMadre === pregunta.dependeDeValor;
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setYaReservado(false);

    if (!oferta) {
      setError("Elija el curso y la ubicación.");
      return;
    }

    const nucleo = (campo: string): Valor => {
      const pregunta = porCampo.get(campo);
      if (!pregunta || !visible(pregunta)) return undefined;
      return valores[pregunta.id];
    };

    const texto = (campo: string) => {
      const v = nucleo(campo);
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };

    // las del sistema van como campos; el resto, sueltas
    const respuestas = todas
      .filter((p) => !p.campoNucleo && p.tipo !== "PARRAFO" && visible(p))
      .map((p) => {
        const valor = valores[p.id];
        if (p.tipo === "CASILLA") return { preguntaId: p.id, booleano: valor === true };
        if (p.tipo === "SELECCION_UNICA")
          return { preguntaId: p.id, seleccion: valor ? [valor as string] : [] };
        if (p.tipo === "SELECCION_MULTIPLE")
          return { preguntaId: p.id, seleccion: (valor as string[]) ?? [] };
        if (p.tipo === "NUMERO")
          return { preguntaId: p.id, numero: valor === "" || valor === undefined ? undefined : Number(valor) };
        return { preguntaId: p.id, texto: (valor as string) ?? "" };
      });

    const seleccionUnica = (campo: string) => {
      const v = nucleo(campo);
      return typeof v === "string" && v ? v : undefined;
    };

    setEstado("enviando");
    try {
      const reserva = await api.crearReserva({
        ofertaId: oferta.id,
        nit: texto("EMPRESA_NIT"),
        razonSocial: texto("EMPRESA_RAZON_SOCIAL"),
        numeroColaboradores: nucleo("EMPRESA_COLABORADORES")
          ? Number(nucleo("EMPRESA_COLABORADORES"))
          : undefined,
        redAsociada: seleccionUnica("EMPRESA_RED_ASOCIADA"),
        redAsociadaOtra: texto("EMPRESA_RED_ASOCIADA_OTRA"),
        contactoNombre: texto("CONTACTO_NOMBRE"),
        contactoCorreo: texto("CONTACTO_CORREO"),
        contactoCelular: texto("CONTACTO_CELULAR"),
        contactoCargo: texto("CONTACTO_CARGO"),
        cuposSolicitados: Number(nucleo("CUPOS_SOLICITADOS") ?? 1),
        aceptaTerminos: nucleo("ACEPTA_TERMINOS") === true,
        aceptaPoliticaDatos: nucleo("ACEPTA_POLITICA_DATOS") === true,
        formularioSlug: formulario!.slug,
        respuestas,
      });
      setResultado(reserva);
      setEstado("hecho");
    } catch (e) {
      const fallo = e as ErrorApi;
      setError(fallo.message);
      // 409: ya reservo con otra cantidad, mandar a editar
      setYaReservado(fallo.estado === 409);
      setEstado("listo");
    }
  }

  // el mismo 404 mudo que la raiz, y aqui: dentro del
  // catch se pierde y la pagina se queda cargando
  if (noExiste) notFound();

  if (estado === "cargando") return <p className="text-texto-suave">Cargando la oferta…</p>;

  if (estado === "no-disponible") {
    return (
      <div className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
        <h2 className="font-medium">No hay formación disponible en este momento</h2>
        <p className="mt-2 text-sm text-texto-suave">
          {error ?? "Vuelva a intentarlo más tarde."}
        </p>
      </div>
    );
  }

  if (estado === "hecho" && resultado) {
    return <Confirmacion reserva={resultado} mensaje={formulario?.mensajeExito} />;
  }

  return (
    <form onSubmit={enviar} className="space-y-8">
      {bloques.map((bloque) => {
        const visibles = bloque.preguntas.filter(visible);
        if (!visibles.length) return null;
        return (
          <section key={bloque.id} className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
            <h2 className="text-lg font-medium">{bloque.titulo}</h2>
            {bloque.descripcion && (
              <p className="mt-1 text-sm text-texto-suave">{bloque.descripcion}</p>
            )}
            <div className="mt-5 space-y-4">
              {visibles.map((pregunta) => (
                <ControlPregunta
                  key={pregunta.id}
                  pregunta={pregunta}
                  valor={valores[pregunta.id]}
                  poner={(v) => poner(pregunta.id, v)}
                  catalogo={catalogo}
                  accion={accion}
                  oferta={oferta}
                  politica={politica}
                  alCambiarAccion={() => {
                    // al cambiar de curso, la ubicacion ya no vale
                    const preguntaOferta = porCampo.get("OFERTA");
                    if (preguntaOferta) poner(preguntaOferta.id, undefined);
                  }}
                />
              ))}
            </div>
          </section>
        );
      })}

      {error && (
        <div className="rounded-xl border border-error/30 bg-error-suave p-4 text-sm text-error">
          <p>{error}</p>
          {yaReservado && (
            <p className="mt-2">
              <Link href="/consulta" className="font-medium underline">
                Consultar y modificar mi reserva
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={estado === "enviando"}
          className="rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
        >
          {estado === "enviando" ? "Enviando…" : "Reservar cupos"}
        </button>
        <Link href="/consulta" className="text-sm text-marca underline">
          Ya reservé antes: consultar o modificar
        </Link>
      </div>
    </form>
  );
}

// un control por pregunta

const CLASE_CONTROL =
  "w-full rounded-xl border border-campo-borde bg-campo-fondo px-3 py-2.5 text-texto " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

function ControlPregunta({
  pregunta,
  valor,
  poner,
  catalogo,
  accion,
  oferta,
  politica,
  alCambiarAccion,
}: {
  pregunta: PreguntaPublica;
  valor: Valor;
  poner: (valor: Valor) => void;
  catalogo: Catalogo | null;
  accion?: Accion;
  oferta?: Oferta;
  politica: PoliticaPublica | null;
  alCambiarAccion: () => void;
}) {
  // sus opciones salen del catalogo y se encadenan
  if (pregunta.controlEspecial === "ACCION") {
    return (
      <fieldset>
        <legend className="mb-3 text-sm font-medium">
          {pregunta.etiqueta}
          {pregunta.obligatoria && <span className="text-error"> *</span>}
        </legend>
        {pregunta.ayuda && (
          <p className="mb-3 text-xs text-texto-suave">{pregunta.ayuda}</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {catalogo?.acciones.map((a) => (
            <TarjetaCurso
              key={a.id}
              accion={a}
              elegida={a.id === valor}
              elegir={() => {
                poner(a.id);
                alCambiarAccion();
              }}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  if (pregunta.controlEspecial === "OFERTA") {
    if (!accion) return null;
    return (
      <Campo pregunta={pregunta} ayuda={pregunta.ayuda ?? ayudaUbicacion(accion)}>
        <select
          required={pregunta.obligatoria}
          value={(valor as string) ?? ""}
          onChange={(e) => poner(e.target.value)}
          className={CLASE_CONTROL}
        >
          <option value="">Seleccione…</option>
          {accion.ofertas.map((o) => (
            <option key={o.id} value={o.id}>
              {bonito(o.ubicacion)} — {MODALIDAD[o.modalidad]} —{" "}
              {o.estado === "COMPLETO"
                ? "sin cupos, entraría en lista de espera"
                : `${o.cuposDisponibles} cupos disponibles`}
            </option>
          ))}
        </select>
        {oferta && <ResumenOferta oferta={oferta} />}
      </Campo>
    );
  }

  if (pregunta.controlEspecial === "CUPOS") {
    return (
      <Campo
        pregunta={pregunta}
        ayuda={
          oferta
            ? `Quedan ${oferta.cuposDisponibles} disponibles. Si pide más, la diferencia queda en lista de espera.`
            : (pregunta.ayuda ?? "Elija primero el curso y la ubicación.")
        }
      >
        <input
          required={pregunta.obligatoria}
          type="number"
          min={1}
          max={oferta?.cuposMaximos ?? 500}
          value={(valor as string) ?? "1"}
          onChange={(e) => poner(e.target.value)}
          className={`${CLASE_CONTROL} sm:max-w-32`}
        />
      </Campo>
    );
  }

  if (pregunta.tipo === "PARRAFO") {
    return (
      <p className="rounded-xl bg-superficie-alterna p-4 text-sm text-texto-suave">
        {pregunta.etiqueta}
      </p>
    );
  }

  /// La casilla de la politica va DEBAJO de su texto.
  ///
  /// Antes era una casilla suelta que decia «autorizo el
  /// tratamiento de mis datos» y no habia forma de leer que se
  /// estaba autorizando: la politica existia y
  /// `GET /api/politicas/:slug/RESERVA` la servia, pero el
  /// formulario no la pedia. Una casilla junto a algo ilegible
  /// no es consentimiento informado, y es lo que hay que poder
  /// demostrar.
  ///
  /// Va el texto y no un enlace, por la misma razon que en la
  /// preinscripcion: casi nadie abre el enlace.
  if (pregunta.tipo === "CASILLA" && pregunta.campoNucleo === "ACEPTA_POLITICA_DATOS") {
    return (
      <div className="space-y-3 rounded-xl border border-borde bg-superficie-alterna p-4">
        <CajaDePolitica politica={politica} />
        <label className="flex cursor-pointer gap-3 rounded-xl border border-campo-borde bg-campo-fondo p-3 text-sm">
          <input
            type="checkbox"
            required={pregunta.obligatoria}
            checked={valor === true}
            onChange={(e) => poner(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--marca)]"
          />
          <span>
            He leído y acepto lo anterior.
            <span className="mt-0.5 block text-xs text-texto-suave">
              {pregunta.ayuda ?? pregunta.etiqueta}
            </span>
          </span>
        </label>
      </div>
    );
  }

  if (pregunta.tipo === "CASILLA") {
    return (
      <label className="flex gap-3 text-sm">
        <input
          type="checkbox"
          required={pregunta.obligatoria}
          checked={valor === true}
          onChange={(e) => poner(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--marca)]"
        />
        <span>
          {pregunta.etiqueta}
          {pregunta.ayuda && (
            <span className="mt-0.5 block text-xs text-texto-suave">{pregunta.ayuda}</span>
          )}
        </span>
      </label>
    );
  }

  if (pregunta.tipo === "SELECCION_UNICA") {
    return (
      <Campo pregunta={pregunta}>
        <select
          required={pregunta.obligatoria}
          value={(valor as string) ?? ""}
          onChange={(e) => poner(e.target.value)}
          className={CLASE_CONTROL}
        >
          <option value="">Seleccione…</option>
          {pregunta.opciones.map((o) => (
            <option key={o.id} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </Campo>
    );
  }

  if (pregunta.tipo === "SELECCION_MULTIPLE") {
    const marcadas = (valor as string[]) ?? [];
    return (
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          {pregunta.etiqueta}
          {pregunta.obligatoria && <span className="text-error"> *</span>}
        </legend>
        {pregunta.ayuda && <p className="mb-2 text-xs text-texto-suave">{pregunta.ayuda}</p>}
        <div className="space-y-2">
          {pregunta.opciones.map((o) => (
            <label key={o.id} className="flex gap-3 text-sm">
              <input
                type="checkbox"
                checked={marcadas.includes(o.valor)}
                onChange={(e) =>
                  poner(
                    e.target.checked
                      ? [...marcadas, o.valor]
                      : marcadas.filter((v) => v !== o.valor),
                  )
                }
                className="mt-0.5 size-4 shrink-0 accent-[var(--marca)]"
              />
              <span>{o.etiqueta}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (pregunta.tipo === "TEXTO_LARGO") {
    return (
      <Campo pregunta={pregunta}>
        <textarea
          required={pregunta.obligatoria}
          rows={4}
          minLength={pregunta.largoMinimo ?? undefined}
          maxLength={pregunta.largoMaximo ?? undefined}
          placeholder={pregunta.marcador ?? undefined}
          value={(valor as string) ?? ""}
          onChange={(e) => poner(e.target.value)}
          className={CLASE_CONTROL}
        />
      </Campo>
    );
  }

  const tipoHtml =
    pregunta.tipo === "CORREO"
      ? "email"
      : pregunta.tipo === "NUMERO"
        ? "number"
        : pregunta.tipo === "FECHA"
          ? "date"
          : "text";

  return (
    <Campo pregunta={pregunta}>
      <input
        required={pregunta.obligatoria}
        type={tipoHtml}
        inputMode={pregunta.tipo === "TELEFONO" ? "tel" : undefined}
        min={pregunta.minimo ?? undefined}
        max={pregunta.maximo ?? undefined}
        minLength={pregunta.largoMinimo ?? undefined}
        maxLength={pregunta.largoMaximo ?? undefined}
        placeholder={pregunta.marcador ?? undefined}
        value={(valor as string) ?? ""}
        onChange={(e) => poner(e.target.value)}
        className={CLASE_CONTROL}
      />
    </Campo>
  );
}

function Campo({
  pregunta,
  ayuda,
  children,
}: {
  pregunta: PreguntaPublica;
  ayuda?: string | null;
  children: React.ReactNode;
}) {
  const texto = ayuda ?? pregunta.ayuda;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {pregunta.etiqueta}
        {pregunta.obligatoria && <span className="text-error"> *</span>}
      </span>
      {children}
      {texto && <span className="mt-1.5 block text-xs text-texto-suave">{texto}</span>}
    </label>
  );
}

function ayudaUbicacion(accion: Accion): string {
  const presencial = accion.ofertas.some((o) => o.modalidad === "PRESENCIAL");
  const virtual = accion.ofertas.some((o) => o.modalidad === "VIRTUAL");
  if (presencial && virtual) {
    return "Este curso tiene sedes presenciales y cobertura virtual: cada opción indica cuál le corresponde.";
  }
  if (presencial) return "Asistirá presencialmente en la ciudad que elija.";
  return "Las sesiones son en vivo; el departamento define su grupo.";
}

/** "2 ciudades y 12 departamentos". */
function desgloseUbicaciones(accion: Accion): string {
  const ciudades = accion.ofertas.filter((o) => o.tipoUbicacion === "CIUDAD").length;
  const departamentos = accion.ofertas.filter((o) => o.tipoUbicacion === "DEPARTAMENTO").length;

  const partes: string[] = [];
  if (ciudades) {
    partes.push(`${ciudades} ${ciudades === 1 ? "ciudad presencial" : "ciudades presenciales"}`);
  }
  if (departamentos) {
    partes.push(
      `${departamentos} ${departamentos === 1 ? "departamento virtual" : "departamentos virtuales"}`,
    );
  }
  return partes.join(" y ");
}

function TarjetaCurso({
  accion,
  elegida,
  elegir,
}: {
  accion: Accion;
  elegida: boolean;
  elegir: () => void;
}) {
  const disponibles = accion.ofertas.reduce((s, o) => s + o.cuposDisponibles, 0);
  const llenas = accion.ofertas.filter((o) => o.estado === "COMPLETO").length;

  return (
    <label
      className={`relative flex h-full cursor-pointer flex-col rounded-xl border p-5 transition ${
        elegida
          ? "border-marca bg-marca-suave ring-2 ring-marca/20"
          : "border-borde bg-superficie hover:border-marca/50 hover:shadow-sm"
      }`}
    >
      {/* radio oculto pero accesible */}
      <input
        type="radio"
        name="curso"
        checked={elegida}
        onChange={elegir}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`absolute right-4 top-4 grid size-5 place-items-center rounded-full border transition peer-focus-visible:ring-2 peer-focus-visible:ring-marca/40 ${
          elegida ? "border-marca bg-marca text-marca-texto" : "border-borde"
        }`}
      >
        {elegida && <IconoCheck />}
      </span>

      <p className="pr-8 font-medium leading-snug">{bonito(accion.nombre)}</p>

      <span className="mt-3 self-start rounded-md bg-marca/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-marca">
        {accion.evento ?? "Formación"}
      </span>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-texto-suave">
        <span className="inline-flex items-center gap-1.5">
          <IconoModalidad modalidad={accion.modalidad} />
          {MODALIDAD[accion.modalidad]}
        </span>
        {accion.horas && (
          <span className="inline-flex items-center gap-1.5">
            <IconoReloj />
            {accion.horas} horas
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <IconoMapa />
          {desgloseUbicaciones(accion)}
        </span>
      </p>

      <p className="mt-4 grow content-end text-sm">
        {disponibles > 0 ? (
          <span className="font-medium text-exito">
            {disponibles} cupos disponibles
            {llenas > 0 && (
              <span className="font-normal text-texto-suave"> · {llenas} sin cupo</span>
            )}
          </span>
        ) : (
          <span className="font-medium text-aviso">Sin cupos — entraría en lista de espera</span>
        )}
      </p>
    </label>
  );
}

function ResumenOferta({ oferta }: { oferta: Oferta }) {
  const etiqueta = ETIQUETA_SEMAFORO[oferta.estado];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-marca-suave px-4 py-3 text-sm">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${etiqueta.clase}`}>
        {etiqueta.texto}
      </span>
      <span>
        {MODALIDAD[oferta.modalidad]} · <strong>{bonito(oferta.ubicacion)}</strong>
      </span>
      <span className="text-texto-suave">{oferta.cuposDisponibles} cupos disponibles</span>
    </div>
  );
}

function Confirmacion({ reserva, mensaje }: { reserva: Reserva; mensaje?: string | null }) {
  const enEspera = reserva.cuposEnEspera > 0;
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
      <span
        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
          reserva.cuposConfirmados > 0
            ? "bg-exito-suave text-exito"
            : "bg-aviso-suave text-aviso"
        }`}
      >
        {reserva.cuposConfirmados > 0 ? "Reserva registrada" : "En lista de espera"}
      </span>

      <h2 className="mt-4 text-xl font-medium">{bonito(reserva.oferta.accion.nombre)}</h2>
      <p className="text-texto-suave">
        {bonito(reserva.oferta.ubicacion)} · {MODALIDAD[reserva.oferta.modalidad]}
        {reserva.oferta.accion.horas ? ` · ${reserva.oferta.accion.horas} horas` : ""}
      </p>

      {mensaje && <p className="mt-4 text-texto-suave">{mensaje}</p>}

      <dl className="mt-6 grid gap-3 border-t border-borde pt-6 sm:grid-cols-3">
        <Dato titulo="Cupos solicitados" valor={reserva.cuposSolicitados} />
        <Dato titulo="Confirmados" valor={reserva.cuposConfirmados} destacado />
        <Dato titulo="En lista de espera" valor={reserva.cuposEnEspera} />
      </dl>

      {enEspera && (
        <p className="mt-4 rounded-lg bg-aviso-suave p-4 text-sm text-aviso">
          No había cupo para los {reserva.cuposEnEspera} restantes. Quedan en lista
          de espera y pasarán a confirmados automáticamente, por orden de llegada,
          si alguien cancela.
        </p>
      )}

      <p className="mt-6 text-sm text-texto-suave">
        Guarde el NIT <strong className="text-texto">{reserva.empresa.nit}</strong>: es
        lo único que necesita para consultar o modificar esta reserva.
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Link
          href="/consulta"
          className="rounded-xl bg-marca px-5 py-2.5 text-sm font-medium text-marca-texto hover:bg-marca-fuerte"
        >
          Ver mis reservas
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-borde px-5 py-2.5 text-sm font-medium hover:bg-fondo"
        >
          Reservar otro curso
        </button>
      </div>
    </div>
  );
}

function Dato({
  titulo,
  valor,
  destacado,
}: {
  titulo: string;
  valor: number;
  destacado?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-texto-suave">{titulo}</dt>
      <dd className={`text-2xl ${destacado ? "font-semibold text-exito" : ""}`}>{valor}</dd>
    </div>
  );
}

// iconos en línea
const TRAZO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function IconoCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" {...TRAZO}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconoReloj() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" {...TRAZO}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconoMapa() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" {...TRAZO}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconoModalidad({ modalidad }: { modalidad: Modalidad }) {
  if (modalidad === "VIRTUAL") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 shrink-0" {...TRAZO}>
        <rect x="2" y="4" width="20" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );
  }
  if (modalidad === "HIBRIDA") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 shrink-0" {...TRAZO}>
        <rect x="2" y="5" width="11" height="8" rx="1.5" />
        <path d="M17 21v-9a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v9M17 21h5M6 17h4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" {...TRAZO}>
      <path d="M4 21V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15M4 21h16M16 21V10h2a2 2 0 0 1 2 2v9" />
      <path d="M8 8h2M8 12h2M8 16h2" />
    </svg>
  );
}
