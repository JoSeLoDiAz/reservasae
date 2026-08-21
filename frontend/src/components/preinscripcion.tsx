"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorApi } from "@/lib/api";
import { primero, resto } from "@/lib/nombres";
import {
  preinscripcionApi,
  type AccionPublica,
  type CatalogoPreinscripcion,
} from "@/lib/preinscripcion-api";

import { BannerLogos, EncabezadoPublico } from "./marca-publica";

const CAMPO =
  "w-full rounded-xl border border-campo-borde bg-campo-fondo px-3 py-2.5 text-texto " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

export function PreinscripcionPublica({ slug }: { slug: string }) {
  const [catalogo, setCatalogo] = useState<CatalogoPreinscripcion | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<{ token: string; yaEstaba: boolean } | null>(null);

  const [accionId, setAccionId] = useState("");
  const [ofertaId, setOfertaId] = useState("");
  const [datos, setDatos] = useState({
    tipoDocumentoSepId: "",
    numeroDocumento: "",
    nombres: "",
    primerApellido: "",
    segundoApellido: "",
    generoSepId: "",
    celular: "",
    correo: "",
  });

  useEffect(() => {
    preinscripcionApi
      .catalogo(slug)
      .then(setCatalogo)
      .catch((e: ErrorApi) => {
        if (e.estado === 404) return setNoExiste(true);
        setError(e.message);
      });
  }, [slug]);

  // notFound() solo sirve durante el render
  if (noExiste) notFound();
  if (!catalogo) {
    return <p className="p-10 text-texto-suave">Cargando la convocatoria…</p>;
  }

  const accion = catalogo.acciones.find((a) => a.id === accionId);

  function cambiar(campo: keyof typeof datos, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await preinscripcionApi.registrar(slug, {
        ofertaId,
        tipoDocumentoSepId: Number(datos.tipoDocumentoSepId),
        numeroDocumento: datos.numeroDocumento,
        primerNombre: primero(datos.nombres),
        segundoNombre: resto(datos.nombres),
        primerApellido: datos.primerApellido,
        segundoApellido: datos.segundoApellido || undefined,
        generoSepId:
          datos.generoSepId && datos.generoSepId !== "NO_DECIR"
            ? Number(datos.generoSepId)
            : undefined,
        celular: datos.celular,
        correo: datos.correo,
      });
      setHecho({ token: r.token, yaEstaba: r.yaEstaba });
    } catch (err) {
      setError((err as ErrorApi).message);
      setEnviando(false);
    }
  }

  if (hecho) return <Registrada token={hecho.token} yaEstaba={hecho.yaEstaba} />;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <EncabezadoPublico
        titulo="Regístrese en la formación"
        subtitulo="Es gratuita. Con estos datos queda registrado; después podrá completar el resto."
      />

      <form onSubmit={enviar} className="mt-8 space-y-8">
        <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Qué quiere estudiar</h2>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Acción de formación
              </span>
              <select
                required
                value={accionId}
                onChange={(e) => {
                  setAccionId(e.target.value);
                  setOfertaId("");
                }}
                className={CAMPO}
              >
                <option value="">Elija una…</option>
                {catalogo.acciones.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} · {a.nombre} ({a.horas} horas)
                  </option>
                ))}
              </select>
            </label>

            {accion && <Ubicaciones accion={accion} valor={ofertaId} alElegir={setOfertaId} />}
          </div>
        </section>

        <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Sus datos</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Solo lo indispensable. El resto puede completarlo después.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Tipo de documento</span>
              <select
                required
                value={datos.tipoDocumentoSepId}
                onChange={(e) => cambiar("tipoDocumentoSepId", e.target.value)}
                className={CAMPO}
              >
                <option value="">Elija…</option>
                {catalogo.documentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <Texto
              etiqueta="Número de documento"
              valor={datos.numeroDocumento}
              alCambiar={(v) => cambiar("numeroDocumento", v)}
              requerido
            />
            <Texto
              etiqueta="Nombres"
              valor={datos.nombres}
              alCambiar={(v) => cambiar("nombres", v)}
              requerido
            />
            <Texto
              etiqueta="Primer apellido"
              valor={datos.primerApellido}
              alCambiar={(v) => cambiar("primerApellido", v)}
              requerido
            />
            <Texto
              etiqueta="Segundo apellido"
              valor={datos.segundoApellido}
              alCambiar={(v) => cambiar("segundoApellido", v)}
            />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Género</span>
              <select
                required
                value={datos.generoSepId}
                onChange={(e) => cambiar("generoSepId", e.target.value)}
                className={CAMPO}
              >
                <option value="">Elija…</option>
                {catalogo.generos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.etiqueta}
                  </option>
                ))}
                {/* una respuesta, no la ausencia de una */}
                <option value="NO_DECIR">Prefiero no decirlo</option>
              </select>
            </label>

            <Texto
              etiqueta="Celular"
              valor={datos.celular}
              alCambiar={(v) => cambiar("celular", v)}
              tipo="tel"
              requerido
            />
            <div className="sm:col-span-2">
              <Texto
                etiqueta="Correo electrónico"
                valor={datos.correo}
                alCambiar={(v) => cambiar("correo", v)}
                tipo="email"
                requerido
              />
            </div>
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-xl border border-error/30 bg-error-suave p-4 text-sm text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || !ofertaId}
          className="w-full rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50"
        >
          {enviando ? "Registrando…" : "Registrarme"}
        </button>
      </form>
    </main>
  );
}

/** Dónde se dicta, con lo que queda libre. */
function Ubicaciones({
  accion,
  valor,
  alElegir,
}: {
  accion: AccionPublica;
  valor: string;
  alElegir: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Ciudad o departamento</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {accion.ofertas.map((o) => {
          const lleno = o.libres === 0;
          return (
            <label
              key={o.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                valor === o.id
                  ? "border-marca bg-marca-suave"
                  : "border-borde hover:bg-superficie-alterna"
              } ${lleno ? "opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="oferta"
                value={o.id}
                checked={valor === o.id}
                disabled={lleno}
                onChange={() => alElegir(o.id)}
                className="shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.ubicacion}</span>
                <span className="block text-xs text-texto-suave">
                  {lleno ? "Sin cupos" : `${o.libres} cupos`} · {o.modalidad.toLowerCase()}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Texto({
  etiqueta,
  valor,
  alCambiar,
  requerido,
  tipo = "text",
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  requerido?: boolean;
  tipo?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {etiqueta}
        {!requerido && <span className="text-texto-suave"> (opcional)</span>}
      </span>
      <input
        type={tipo}
        required={requerido}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className={CAMPO}
      />
    </label>
  );
}

/** Ya está dentro: se le ofrece completar el resto. */
function Registrada({ token, yaEstaba }: { token: string; yaEstaba: boolean }) {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16 text-center">
      <BannerLogos />

      <h1 className="mt-8 text-2xl font-bold">
        {yaEstaba ? "Ya estaba inscrito" : "¡Listo, quedó registrado!"}
      </h1>
      <p className="mt-3 text-texto-suave">
        {yaEstaba
          ? "Ya teníamos su inscripción en esta formación. Puede completar sus datos desde aquí."
          : "Nos pondremos en contacto. Si quiere, puede dejar todo diligenciado ahora y ahorrarse la llamada."}
      </p>

      <a
        href={`/completar/${token}`}
        className="mt-8 inline-block rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte"
      >
        Quiero terminar de completar toda mi información
      </a>

      <p className="mt-6 text-xs text-texto-suave">
        Guarde este enlace: sirve una sola vez y caduca en 15 días.
      </p>
    </main>
  );
}
