"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorApi } from "@/lib/api";
import { juntar, primero, resto } from "@/lib/nombres";
import { preinscripcionApi, type FichaAbierta } from "@/lib/preinscripcion-api";

import { BannerLogos, PiePublico } from "./marca-publica";

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
  const [acepta, setAcepta] = useState(false);

  const [persona, setPersona] = useState<Record<string, string>>({});
  const [empresa, setEmpresa] = useState<Record<string, string>>({});

  useEffect(() => {
    preinscripcionApi
      .abrir(token)
      .then((f) => {
        setFicha(f);
        const p = f.persona as Record<string, unknown>;
        setPersona({
          nombres: juntar(p.primerNombre as string, p.segundoNombre as string),
          primerApellido: String(p.primerApellido ?? ""),
          segundoApellido: String(p.segundoApellido ?? ""),
          celular: String(p.celular ?? ""),
          correo: String(p.correo ?? ""),
          generoSepId: p.generoSepId ? String(p.generoSepId) : "",
          fechaNacimiento: p.fechaNacimiento
            ? String(p.fechaNacimiento).slice(0, 10)
            : "",
          estrato: p.estrato ? String(p.estrato) : "",
          departamentoSepId: p.departamentoSepId ? String(p.departamentoSepId) : "",
          municipioSepId: p.municipioSepId ? String(p.municipioSepId) : "",
          barrio: String(p.barrio ?? ""),
          direccion: String(p.direccion ?? ""),
          cargoEnEmpresa: String(f.cargoEnEmpresa ?? ""),
        });
        setEmpresa({ nit: f.nitEmpresa ?? "", razonSocial: f.empresa ?? "" });
        setAcepta(f.yaAutorizo);
      })
      .catch((e: ErrorApi) => setCaducado(e.message));
  }, [token]);

  // los del departamento elegido, y solo esos
  const municipios = useMemo(() => {
    const dep = Number(persona.departamentoSepId);
    if (!ficha || !dep) return [];
    return ficha.municipios.filter((m) => m[1] === dep);
  }, [ficha, persona.departamentoSepId]);

  if (caducado) {
    return (
      <>
        <main className="mx-auto w-full max-w-lg px-6 py-20 text-center">
        <BannerLogos />
        <h1 className="mt-8 text-2xl font-bold">Este enlace ya no sirve</h1>
        <p className="mt-3 text-texto-suave">{caducado}</p>
        </main>
        <PiePublico />
      </>
    );
  }

  if (!ficha) return <p className="p-10 text-texto-suave">Abriendo su ficha…</p>;

  const nombre = `${primero(persona.nombres ?? "")} ${persona.primerApellido ?? ""}`.trim();
  const hayPolitica = ficha.politica !== null;

  async function guardarPersona(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await preinscripcionApi.guardarPersona(token, {
        ...persona,
        primerNombre: primero(persona.nombres ?? ""),
        segundoNombre: resto(persona.nombres ?? "") ?? "",
        nombres: undefined,
        aceptaPolitica: acepta,
      });
      setPaso("EMPRESA");
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
      <>
        <main className="mx-auto w-full max-w-lg px-6 py-20 text-center">
        <BannerLogos />
        <h1 className="mt-8 text-2xl font-bold">¡Gracias, {nombre}!</h1>
        <p className="mt-3 text-texto-suave">
          Sus datos quedaron guardados. Este enlace ya se cerró; si hace falta
          corregir algo, pídale uno nuevo a quien le atendió.
        </p>
        </main>
        <PiePublico />
      </>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <BannerLogos />

      <header className="mt-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {paso === "PERSONA" ? "Complete sus datos" : "Dónde trabaja"}
        </h1>
        {ficha.formacion && (
          <p className="mt-2 text-sm text-texto-suave">
            {ficha.formacion.codigo} · {ficha.formacion.nombre}
            {ficha.formacion.ubicacion && ` · ${ficha.formacion.ubicacion}`}
          </p>
        )}
        <p className="mt-3 text-xs text-texto-suave">
          Paso {paso === "PERSONA" ? "1" : "2"} de 2
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-error/30 bg-error-suave p-4 text-sm text-error"
        >
          {error}
        </p>
      )}

      {paso === "PERSONA" ? (
        <form onSubmit={guardarPersona} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombres" campo="nombres" valores={persona} set={setPersona} />
              <Campo
                etiqueta="Primer apellido"
                campo="primerApellido"
                valores={persona}
                set={setPersona}
              />
              <Campo
                etiqueta="Segundo apellido"
                campo="segundoApellido"
                valores={persona}
                set={setPersona}
              />
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

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Departamento</span>
                <select
                  value={persona.departamentoSepId ?? ""}
                  onChange={(e) =>
                    // al cambiar de departamento su municipio
                    // deja de valer: se limpia con el
                    setPersona((p) => ({
                      ...p,
                      departamentoSepId: e.target.value,
                      municipioSepId: "",
                    }))
                  }
                  className={CAMPO}
                >
                  <option value="">Elija…</option>
                  {ficha.departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.etiqueta}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  Municipio
                  {!persona.departamentoSepId && (
                    <span className="text-texto-suave"> (elija antes el departamento)</span>
                  )}
                </span>
                <select
                  value={persona.municipioSepId ?? ""}
                  disabled={!persona.departamentoSepId}
                  onChange={(e) => setPersona((p) => ({ ...p, municipioSepId: e.target.value }))}
                  className={`${CAMPO} disabled:opacity-50`}
                >
                  <option value="">Elija…</option>
                  {municipios.map((m) => (
                    <option key={m[0]} value={m[0]}>
                      {m[2]}
                    </option>
                  ))}
                </select>
              </label>

              <Campo etiqueta="Barrio o vereda" campo="barrio" valores={persona} set={setPersona} />
              <div className="sm:col-span-2">
                <Campo etiqueta="Dirección" campo="direccion" valores={persona} set={setPersona} />
              </div>
              <div className="sm:col-span-2">
                <Campo
                  etiqueta="Su cargo donde trabaja"
                  campo="cargoEnEmpresa"
                  valores={persona}
                  set={setPersona}
                />
              </div>
            </div>
          </section>

          {hayPolitica && (
            <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  required
                  checked={acepta}
                  onChange={(e) => setAcepta(e.target.checked)}
                  className="mt-1 shrink-0"
                />
                <span className="text-sm">
                  Autorizo el tratamiento de mis datos personales conforme a la{" "}
                  <a
                    href={`/politica/${ficha.convenio.sigla ?? ""}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {ficha.politica?.titulo ?? "política de tratamiento de datos"}
                  </a>
                  .
                  {ficha.yaAutorizo && (
                    <span className="block text-xs text-texto-suave">
                      Ya la había autorizado antes.
                    </span>
                  )}
                </span>
              </label>
            </section>
          )}

          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar y seguir"}
          </button>
        </form>
      ) : (
        <form onSubmit={guardarEmpresa} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
            <p className="mb-5 text-sm text-texto-suave">
              {ficha.empresaFijada ? (
                <>
                  Son los datos de <strong>{ficha.empresa}</strong>, la organización que
                  lo inscribió. Hacen falta para formalizar su registro.
                </>
              ) : (
                <>
                  Los datos de la organización donde trabaja. Hacen falta para
                  formalizar su registro. Si no los tiene a mano, puede dejarlo
                  para después.
                </>
              )}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {!ficha.empresaFijada && (
                <>
                  <div className="grid grid-cols-[1fr_5rem] gap-3">
                    <Campo etiqueta="NIT" campo="nit" valores={empresa} set={setEmpresa} />
                    <Campo
                      etiqueta="DV"
                      campo="digitoVerificacion"
                      valores={empresa}
                      set={setEmpresa}
                    />
                  </div>
                  <Campo
                    etiqueta="Nombre de la organización"
                    campo="razonSocial"
                    valores={empresa}
                    set={setEmpresa}
                  />
                </>
              )}
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
              <Campo
                etiqueta="Cargo de la persona de contacto"
                campo="contactoCargo"
                valores={empresa}
                set={setEmpresa}
              />
              <div className="sm:col-span-2">
                <Campo
                  etiqueta="Correo de la persona de contacto"
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
              No los tengo ahora
            </button>
          </div>

          <p className="text-xs text-texto-suave">
            Si los deja para después, sus datos personales ya quedaron guardados y
            quien le atienda le pedirá los de la organización cuando le llame.
          </p>
        </form>
      )}
      </main>
      <PiePublico />
    </>
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
