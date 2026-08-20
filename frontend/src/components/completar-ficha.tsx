"use client";

import { useEffect, useState } from "react";

import { ErrorApi } from "@/lib/api";
import { preinscripcionApi, type FichaAbierta } from "@/lib/preinscripcion-api";

import { BannerLogos } from "./marca-publica";

const CAMPO =
  "w-full rounded-xl border border-campo-borde bg-campo-fondo px-3 py-2.5 text-texto " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

type Paso = "PERSONA" | "EMPRESA" | "HECHO";

export function CompletarFicha({ token }: { token: string }) {
  const [ficha, setFicha] = useState<FichaAbierta | null>(null);
  const [caducado, setCaducado] = useState<string | null>(null);
  const [paso, setPaso] = useState<Paso>("PERSONA");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [persona, setPersona] = useState<Record<string, string>>({});
  const [empresa, setEmpresa] = useState<Record<string, string>>({});

  useEffect(() => {
    preinscripcionApi
      .abrir(token)
      .then((f) => {
        setFicha(f);
        const p = f.persona as Record<string, unknown>;
        setPersona({
          primerNombre: String(p.primerNombre ?? ""),
          segundoNombre: String(p.segundoNombre ?? ""),
          primerApellido: String(p.primerApellido ?? ""),
          segundoApellido: String(p.segundoApellido ?? ""),
          celular: String(p.celular ?? ""),
          correo: String(p.correo ?? ""),
          generoSepId: p.generoSepId ? String(p.generoSepId) : "",
          fechaNacimiento: p.fechaNacimiento
            ? String(p.fechaNacimiento).slice(0, 10)
            : "",
          estrato: p.estrato ? String(p.estrato) : "",
          barrio: String(p.barrio ?? ""),
          direccion: String(p.direccion ?? ""),
        });
      })
      .catch((e: ErrorApi) => setCaducado(e.message));
  }, [token]);

  if (caducado) {
    return (
      <main className="mx-auto w-full max-w-lg px-6 py-20 text-center">
        <BannerLogos />
        <h1 className="mt-8 text-2xl font-bold">Este enlace ya no sirve</h1>
        <p className="mt-3 text-texto-suave">{caducado}</p>
      </main>
    );
  }

  if (!ficha) return <p className="p-10 text-texto-suave">Abriendo su ficha…</p>;

  const nombre = `${persona.primerNombre ?? ""} ${persona.primerApellido ?? ""}`.trim();

  async function guardarPersona(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await preinscripcionApi.guardarPersona(token, persona);
      // con empresa detrás hay un paso más; si no, acabó
      setPaso(ficha!.empresa ? "EMPRESA" : "HECHO");
      if (!ficha!.empresa) await preinscripcionApi.cerrar(token);
    } catch (err) {
      setError((err as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await preinscripcionApi.guardarEmpresa(token, empresa);
      setPaso("HECHO");
    } catch (err) {
      setError((err as ErrorApi).message);
      setGuardando(false);
    }
  }

  async function dejarParaDespues() {
    await preinscripcionApi.cerrar(token).catch(() => null);
    setPaso("HECHO");
  }

  if (paso === "HECHO") {
    return (
      <main className="mx-auto w-full max-w-lg px-6 py-20 text-center">
        <BannerLogos />
        <h1 className="mt-8 text-2xl font-bold">¡Gracias, {nombre}!</h1>
        <p className="mt-3 text-texto-suave">
          Sus datos quedaron guardados. Este enlace ya se cerró; si hace falta
          corregir algo, pídale uno nuevo a quien le atendió.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <BannerLogos />

      <header className="mt-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {paso === "PERSONA" ? "Complete sus datos" : "Los datos de su organización"}
        </h1>
        {ficha.formacion && (
          <p className="mt-2 text-sm text-texto-suave">
            {ficha.formacion.codigo} · {ficha.formacion.nombre}
            {ficha.formacion.ubicacion && ` · ${ficha.formacion.ubicacion}`}
          </p>
        )}
      </header>

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-error/30 bg-error-suave p-4 text-sm text-error">
          {error}
        </p>
      )}

      {paso === "PERSONA" ? (
        <form onSubmit={guardarPersona} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Primer nombre" campo="primerNombre" valores={persona} set={setPersona} />
              <Campo etiqueta="Segundo nombre" campo="segundoNombre" valores={persona} set={setPersona} />
              <Campo etiqueta="Primer apellido" campo="primerApellido" valores={persona} set={setPersona} />
              <Campo etiqueta="Segundo apellido" campo="segundoApellido" valores={persona} set={setPersona} />
              <Campo etiqueta="Celular" campo="celular" valores={persona} set={setPersona} tipo="tel" />
              <Campo etiqueta="Correo" campo="correo" valores={persona} set={setPersona} tipo="email" />

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Género</span>
                <select
                  value={persona.generoSepId ?? ""}
                  onChange={(e) => setPersona((p) => ({ ...p, generoSepId: e.target.value }))}
                  className={CAMPO}
                >
                  <option value="">Prefiero no decirlo</option>
                  {ficha.generos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.etiqueta}
                    </option>
                  ))}
                </select>
              </label>

              <Campo
                etiqueta="Fecha de nacimiento"
                campo="fechaNacimiento"
                valores={persona}
                set={setPersona}
                tipo="date"
              />

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Estrato</span>
                <select
                  value={persona.estrato ?? ""}
                  onChange={(e) => setPersona((p) => ({ ...p, estrato: e.target.value }))}
                  className={CAMPO}
                >
                  <option value="">Sin indicar</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <Campo etiqueta="Barrio" campo="barrio" valores={persona} set={setPersona} />
              <div className="sm:col-span-2">
                <Campo etiqueta="Dirección" campo="direccion" valores={persona} set={setPersona} />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50"
          >
            {guardando
              ? "Guardando…"
              : ficha.empresa
                ? "Guardar y seguir con mi organización"
                : "Guardar mis datos"}
          </button>
        </form>
      ) : (
        <form onSubmit={guardarEmpresa} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
            <p className="mb-5 text-sm text-texto-suave">
              Son los datos de <strong>{ficha.empresa}</strong>, que el SENA pide
              para el reporte. Si no los tiene a mano, puede dejarlo para después.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Campo etiqueta="Dirección" campo="direccion" valores={empresa} set={setEmpresa} />
              </div>
              <Campo etiqueta="Teléfono" campo="telefono" valores={empresa} set={setEmpresa} tipo="tel" />
              <Campo
                etiqueta="Número de trabajadores"
                campo="numeroTrabajadores"
                valores={empresa}
                set={setEmpresa}
                tipo="number"
              />
              <div className="sm:col-span-2">
                <Campo
                  etiqueta="Sector económico"
                  campo="sectorEconomico"
                  valores={empresa}
                  set={setEmpresa}
                />
              </div>
              <Campo
                etiqueta="Persona de contacto"
                campo="contactoNombre"
                valores={empresa}
                set={setEmpresa}
              />
              <Campo etiqueta="Su cargo" campo="contactoCargo" valores={empresa} set={setEmpresa} />
              <div className="sm:col-span-2">
                <Campo
                  etiqueta="Correo de contacto"
                  campo="contactoCorreo"
                  valores={empresa}
                  set={setEmpresa}
                  tipo="email"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar y terminar"}
            </button>
            <button
              type="button"
              onClick={dejarParaDespues}
              className="text-sm text-texto-suave underline"
            >
              Dejar esto para después
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

function Campo({
  etiqueta,
  campo,
  valores,
  set,
  tipo = "text",
}: {
  etiqueta: string;
  campo: string;
  valores: Record<string, string>;
  set: (f: (v: Record<string, string>) => Record<string, string>) => void;
  tipo?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{etiqueta}</span>
      <input
        type={tipo}
        value={valores[campo] ?? ""}
        onChange={(e) => set((v) => ({ ...v, [campo]: e.target.value }))}
        className={CAMPO}
      />
    </label>
  );
}
