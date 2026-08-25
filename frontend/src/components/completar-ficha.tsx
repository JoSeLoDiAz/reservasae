"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorApi } from "@/lib/api";
import { juntar, primero, resto } from "@/lib/nombres";
import { preinscripcionApi, type FichaAbierta } from "@/lib/preinscripcion-api";

import { BannerLogos, ConmutadorTema, PiePublico } from "./marca-publica";

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
  /// Decide si se pide el NIT de la empresa o la cedula que
  /// hace de RUT. Sin elegir no se muestra ninguno de los dos.
  const [vinculo, setVinculo] = useState<"" | "INDEPENDIENTE" | "EMPRESA">("");
  /// Solo para el independiente: si su RUT es su propia cedula,
  /// sus datos ya estan y no hay nada que volver a pedir.
  const [rutPropio, setRutPropio] = useState<"" | "IGUAL" | "DIFERENTE">("");
  /// Nada se manda sin pasar por el resumen.
  const [revisando, setRevisando] = useState(false);

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
          nivelOcupacionalSepId: f.nivelOcupacionalSepId
            ? String(f.nivelOcupacionalSepId)
            : "",
          beneficiarioPrevio:
            f.beneficiarioPrevio === null ? "" : f.beneficiarioPrevio ? "SI" : "NO",
        });
        setEmpresa({ nit: f.nitEmpresa ?? "", razonSocial: f.empresa ?? "" });
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
        nivelOcupacionalSepId: persona.nivelOcupacionalSepId
          ? Number(persona.nivelOcupacionalSepId)
          : undefined,
        // el radio manda cadena; la base quiere booleano
        beneficiarioPrevio:
          persona.beneficiarioPrevio === ""
            ? undefined
            : persona.beneficiarioPrevio === "SI",
        // ya la acepto al reservar el cupo
        aceptaPolitica: true,
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
      // sin esto el backend no sabe donde poner el sector de
      // un independiente: no hay NIT que buscar
      await preinscripcionApi.guardarEmpresa(token, {
        ...empresa,
        rutPropio: soloSector,
      });
      setPaso("HECHO");
    } catch (err) {
      setError((err as ErrorApi).message);
      setGuardando(false);
    }
  }

  /// Con RUT propio basta el sector; en los demas casos hay
  /// que pedir los datos de la organizacion.
  /// El paso 2 no deja avanzar a medias: si pasara, la ficha
  /// llega incompleta al SENA y ya nadie sabe que falto.
  const listoPersona = Boolean(
    persona.fechaNacimiento &&
      persona.estrato &&
      persona.barrio?.trim() &&
      persona.direccion?.trim() &&
      persona.cargoEnEmpresa?.trim() &&
      persona.nivelOcupacionalSepId &&
      persona.beneficiarioPrevio,
  );

  const faltaEnPersona = [
    !persona.fechaNacimiento && "fecha de nacimiento",
    !persona.estrato && "estrato",
    !persona.barrio?.trim() && "barrio o vereda",
    !persona.direccion?.trim() && "dirección",
    !persona.cargoEnEmpresa?.trim() && "cargo actual",
    !persona.nivelOcupacionalSepId && "nivel ocupacional",
    !persona.beneficiarioPrevio && "si se benefició antes",
  ].filter(Boolean) as string[];

  const esPresencial = ficha?.formacion?.modalidad === "PRESENCIAL";

  const soloSector = vinculo === "INDEPENDIENTE" && rutPropio === "IGUAL";
  const pideOrganizacion =
    vinculo === "EMPRESA" || (vinculo === "INDEPENDIENTE" && rutPropio === "DIFERENTE");

  /// El sector se lo preguntamos solo al independiente.
  ///
  /// Al que tiene vinculo laboral se lo trae la consulta al
  /// RUES por el NIT de la empresa, y esa consulta solo corre
  /// para ese caso: el independiente no tiene NIT de empresa
  /// que consultar, asi que si no lo dice el, no lo dice nadie.
  const pideSector = vinculo === "INDEPENDIENTE";

  /// Lo minimo para poder revisar. El NIT (o el RUT) es lo
  /// unico obligatorio; el resto lo completa quien atienda.
  const listoParaRevisar =
    (!pideSector || Boolean(empresa.sectorEconomico)) &&
    (soloSector || (pideOrganizacion && Boolean(empresa.nit?.trim())));

  if (paso === "HECHO") {
    return (
      <>
        <main className="mx-auto w-full max-w-lg px-6 py-20 text-center">
        <BannerLogos />
        <h1 className="mt-8 text-2xl font-bold">¡Gracias, {nombre}!</h1>
        {/* lo que sigue depende de la modalidad: en virtual se
            manda el acceso, en presencial hay que citar la sede.
            Y no se habla de «quien le atendio»: puede que nadie
            lo haya llamado y lo haya hecho todo por su cuenta */}
        <p className="mt-3 text-texto-suave">
          {esPresencial
            ? "Su inscripción se completó satisfactoriamente. Nos comunicaremos pronto para indicarle la sede y los detalles de asistencia a la acción de formación."
            : "Su inscripción se completó satisfactoriamente. Pronto le enviaremos información sobre horarios, plataforma y cómo acceder a la formación."}
        </p>
        </main>
        <PiePublico />
      </>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-6 py-10 lg:max-w-4xl">
      {/* el mismo encabezado del formulario corto: mismo ancho,
          mismo banner y el conmutador de tema */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BannerLogos />
        <ConmutadorTema compacto />
      </div>

      <header className="mt-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {paso === "PERSONA" ? "Formalización de la inscripción" : "Información Laboral"}
        </h1>
        <p className="mt-2 text-sm text-texto-suave">
          {paso === "PERSONA"
            ? "Información requerida para avanzar."
            : "Completar según su vínculo laboral."}
        </p>
        {ficha.formacion && (
          <p className="mt-2 text-sm text-texto-suave">
            {ficha.formacion.codigo} · {ficha.formacion.nombre}
            {ficha.formacion.ubicacion && ` · ${ficha.formacion.ubicacion}`}
          </p>
        )}
      </header>

      {/* reservar no es estar inscrito, y hay que decirlo */}
      <div className="mt-6 rounded-2xl border border-borde bg-superficie px-5 py-4">
        <div className="flex flex-wrap items-center gap-y-2">
          {[
            { n: 1, texto: "Reserva de cupo" },
            { n: 2, texto: "Datos de inscripción" },
            { n: 3, texto: "Inscripción confirmada" },
          ].map((x, i, todos) => (
            <div key={x.n} className="flex flex-1 items-center gap-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  x.n < 3 ? "bg-exito text-white" : "bg-marca text-marca-texto"
                }`}
              >
                {x.n < 3 ? "✓" : x.n}
              </span>
              <span
                className={`whitespace-nowrap text-sm ${
                  x.n === 3 ? "font-semibold text-marca" : "text-texto-suave"
                }`}
              >
                {x.texto}
              </span>
              {i < todos.length - 1 && (
                <span className="mx-2 hidden h-px flex-1 bg-borde sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-error/30 bg-error-suave p-4 text-sm text-error"
        >
          {error}
        </p>
      )}

      {paso === "PERSONA" ? (
        <form
        onSubmit={guardarPersona}
        /* Enter dentro de un campo no avanza de paso: asi
           es como se salta media ficha sin darse cuenta */
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
        className="mt-8 space-y-6"
      >
          <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Información complementaria</h2>
            <p className="mt-1 text-sm text-texto-suave">
              Complete la siguiente información:
            </p>

            {/* nombres, apellidos, celular, correo, genero,
                departamento y municipio ya se dieron al reservar
                el cupo: volver a pedirlos invita a contradecirlos */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  Fecha de nacimiento
                </span>
                <input
                  type="date"
                  value={persona.fechaNacimiento ?? ""}
                  onChange={(e) =>
                    setPersona((p) => ({ ...p, fechaNacimiento: e.target.value }))
                  }
                  className={CAMPO}
                />
                <span className="mt-1 block text-xs text-texto-suave">
                  La formación admite personas mayores de 18 años.
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Estrato</span>
                <select
                  value={persona.estrato ?? ""}
                  onChange={(e) => setPersona((p) => ({ ...p, estrato: e.target.value }))}
                  className={CAMPO}
                >
                  <option value="">Seleccione…</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-texto-suave">
                  Del 1 al 6, según su recibo de servicios.
                </span>
              </label>

              <div className="hidden lg:block" aria-hidden />

              <Campo etiqueta="Barrio o vereda" campo="barrio" valores={persona} set={setPersona} />
              <div className="sm:col-span-2">
                <Campo etiqueta="Dirección" campo="direccion" valores={persona} set={setPersona} />
              </div>

              <Campo
                etiqueta="¿Cuál es su cargo actual?"
                campo="cargoEnEmpresa"
                valores={persona}
                set={setPersona}
              />

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Nivel ocupacional</span>
                <select
                  value={persona.nivelOcupacionalSepId ?? ""}
                  onChange={(e) =>
                    setPersona((p) => ({ ...p, nivelOcupacionalSepId: e.target.value }))
                  }
                  className={CAMPO}
                >
                  <option value="">Elija…</option>
                  {ficha.nivelesOcupacionales.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.etiqueta}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium">
                  ¿Se ha beneficiado antes del programa de formación continua
                  especializada?
                </span>
                <div className="flex gap-2">
                  {[
                    ["SI", "Sí"],
                    ["NO", "No"],
                  ].map(([valor, texto]) => (
                    <label
                      key={valor}
                      className={`flex-1 cursor-pointer rounded-xl border px-4 py-2.5 text-center text-sm transition ${
                        persona.beneficiarioPrevio === valor
                          ? "border-marca bg-marca-suave"
                          : "border-borde hover:bg-superficie-alterna"
                      }`}
                    >
                      <input
                        type="radio"
                        name="beneficiarioPrevio"
                        value={valor}
                        checked={persona.beneficiarioPrevio === valor}
                        onChange={() =>
                          setPersona((p) => ({ ...p, beneficiarioPrevio: valor }))
                        }
                        className="sr-only"
                      />
                      {texto}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {faltaEnPersona.length > 0 && (
            <p className="rounded-xl border border-borde bg-superficie-alterna px-4 py-3 text-sm text-texto-suave">
              Para continuar falta: <strong>{faltaEnPersona.join(", ")}</strong>.
            </p>
          )}

          <button
            type="submit"
            disabled={guardando || !listoPersona}
            className="w-full rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar y seguir"}
          </button>
        </form>
      ) : (
        <form
        onSubmit={guardarEmpresa}
        /* Enter dentro de un campo no avanza de paso: asi
           es como se salta media ficha sin darse cuenta */
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
        className="mt-8 space-y-6"
      >
          <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
            {/* la pregunta va primero: decide todo lo que sigue */}
            <p className="text-base font-semibold">
              ¿Cuál es su situación laboral actual?
            </p>

            <div className="mb-5 mt-3 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setVinculo("INDEPENDIENTE");
                  setRutPropio("");
                }}
                className={`rounded-xl border p-4 text-left font-semibold transition ${
                  vinculo === "INDEPENDIENTE"
                    ? "border-2 border-marca bg-marca-suave text-marca"
                    : "border-campo-borde bg-superficie hover:bg-superficie-alterna"
                }`}
              >
                Trabajador independiente
              </button>

              <button
                type="button"
                onClick={() => {
                  setVinculo("EMPRESA");
                  setRutPropio("");
                }}
                className={`rounded-xl border p-4 text-left font-semibold transition ${
                  vinculo === "EMPRESA"
                    ? "border-2 border-marca bg-marca-suave text-marca"
                    : "border-campo-borde bg-superficie hover:bg-superficie-alterna"
                }`}
              >
                Trabajador con vínculo laboral
              </button>
            </div>

            {/* el independiente puede usar su propia cedula como
                RUT: si es la misma, sus datos ya los tenemos y
                volver a pedirlos solo invita a contradecirlos */}
            {vinculo === "INDEPENDIENTE" && (
              <div className="mb-5">
                <p className="text-base font-semibold">
                  ¿El RUT es igual a su número de documento o es diferente?
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRutPropio("IGUAL")}
                    className={`rounded-xl border p-4 text-left font-semibold transition ${
                      rutPropio === "IGUAL"
                        ? "border-2 border-marca bg-marca-suave text-marca"
                        : "border-campo-borde bg-superficie hover:bg-superficie-alterna"
                    }`}
                  >
                    Es el mismo
                  </button>
                  <button
                    type="button"
                    onClick={() => setRutPropio("DIFERENTE")}
                    className={`rounded-xl border p-4 text-left font-semibold transition ${
                      rutPropio === "DIFERENTE"
                        ? "border-2 border-marca bg-marca-suave text-marca"
                        : "border-campo-borde bg-superficie hover:bg-superficie-alterna"
                    }`}
                  >
                    Es diferente
                  </button>
                </div>
              </div>
            )}

            {pideOrganizacion && (
              <p className="mb-5 text-sm text-texto-suave">
                {ficha.empresaFijada ? (
                  <>
                    Son los datos de <strong>{ficha.empresa}</strong>, la organización
                    que lo inscribió. Hacen falta para formalizar su registro.
                  </>
                ) : (
                  <>Diligencie los datos de su empresa para proceder con el registro</>
                )}
              </p>
            )}

            {/* con RUT propio no queda nada por pedir: su
                identidad y su domicilio se dieron al reservar */}
            {soloSector && (
              <div className="max-w-md">
                <SelectorDeSector empresa={empresa} set={setEmpresa} />
              </div>
            )}

            {pideOrganizacion && (
              <div className="grid gap-4 sm:grid-cols-2">
                {!ficha.empresaFijada && (
                  <BuscadorDeNit
                    nit={empresa.nit}
                    razonSocial={empresa.razonSocial}
                    esRut={vinculo === "INDEPENDIENTE"}
                    alCambiar={(nit, razonSocial) =>
                      setEmpresa((e) => ({ ...e, nit, razonSocial }))
                    }
                  />
                )}
                <div className="sm:col-span-2">
                  <Campo
                    etiqueta="Nombre del jefe directo o persona de contacto en su empresa"
                    campo="contactoNombre"
                    valores={empresa}
                    set={setEmpresa}
                  />
                </div>
                <Campo
                  etiqueta="Cargo del jefe directo o persona de contacto"
                  campo="contactoCargo"
                  valores={empresa}
                  set={setEmpresa}
                />
                <Campo
                  etiqueta="Correo electrónico del jefe directo o contacto"
                  campo="contactoCorreo"
                  valores={empresa}
                  set={setEmpresa}
                  tipo="email"
                />
                {/* al de empresa se lo trae el RUES por el NIT */}
                {pideSector && (
                  <div className="sm:col-span-2">
                    <SelectorDeSector empresa={empresa} set={setEmpresa} />
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-4">
            {!revisando && (
              <>
                <button
                  type="button"
                  disabled={!listoParaRevisar}
                  onClick={() => setRevisando(true)}
                  className="rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50"
                >
                  Revisar y confirmar
                </button>

                {/* se puede devolver: nada de lo ya escrito se pierde */}
                <button
                  type="button"
                  onClick={() => setPaso("PERSONA")}
                  className="rounded-xl border border-campo-borde bg-superficie px-5 py-3 text-texto transition hover:bg-superficie-alterna"
                >
                  Volver al paso anterior
                </button>
              </>
            )}
          </div>
          {revisando && (
            <section className="rounded-2xl border-2 border-marca bg-marca-suave p-6">
              <h2 className="text-lg font-semibold text-marca">
                Verifique la información antes de enviar
              </h2>

              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <FilaResumen
                  etiqueta="Situación laboral"
                  valor={
                    vinculo === "EMPRESA"
                      ? "Trabajador con vínculo laboral"
                      : "Trabajador independiente"
                  }
                />
                {soloSector && (
                  <FilaResumen etiqueta="RUT" valor="El mismo de su documento" />
                )}
                {pideSector && (
                  <FilaResumen
                    etiqueta="Sector económico"
                    valor={empresa.sectorEconomico}
                  />
                )}
                {pideOrganizacion && (
                  <>
                    <FilaResumen
                      etiqueta={vinculo === "EMPRESA" ? "NIT" : "RUT"}
                      valor={empresa.nit}
                      mono
                    />
                    <FilaResumen
                      etiqueta={
                        vinculo === "EMPRESA" ? "Organización" : "Nombre en el RUT"
                      }
                      valor={empresa.razonSocial}
                    />
                  </>
                )}
              </dl>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-xl bg-marca px-7 py-3.5 font-medium text-marca-texto shadow-sm transition hover:bg-marca-fuerte disabled:opacity-50"
                >
                  {guardando ? "Enviando…" : "Está correcto, confirmar inscripción"}
                </button>
                <button
                  type="button"
                  onClick={() => setRevisando(false)}
                  className="rounded-xl border border-campo-borde bg-superficie px-5 py-3 text-texto transition hover:bg-superficie-alterna"
                >
                  Modificar datos
                </button>
              </div>
            </section>
          )}

          <p className="text-xs text-texto-suave">
            Finalice su inscripción presionando el botón de confirmación.
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
  requerido,
}: {
  etiqueta: string;
  campo: string;
  valores: Record<string, string>;
  set: (f: (v: Record<string, string>) => Record<string, string>) => void;
  tipo?: string;
  requerido?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{etiqueta}</span>
      <input
        type={tipo}
        required={requerido}
        value={valores[campo] ?? ""}
        onChange={(e) => set((v) => ({ ...v, [campo]: e.target.value }))}
        className={CAMPO}
      />
    </label>
  );
}

/// Busca el NIT en el banco de instituciones y trae la razon
/// social. Si el NIT ampara a varias -- el de un municipio
/// cubre a sus colegios -- se eligen de una lista, y siempre
/// queda la salida de escribirla a mano.
/// Los tres del Decreto 957, que son con los que el SEP
/// clasifica el tamano. En texto libre nunca cuadraba con lo
/// que se reporta al lado.
/// Una fila del resumen. Sin valor no se pinta.
function FilaResumen({
  etiqueta,
  valor,
  mono,
}: {
  etiqueta: string;
  valor?: string | null;
  mono?: boolean;
}) {
  if (!valor?.trim()) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-texto-suave">{etiqueta}</dt>
      <dd className={`mt-0.5 font-medium ${mono ? "font-mono text-sm" : ""}`}>{valor}</dd>
    </div>
  );
}

/// Los tres sectores que admite el SEP.
function SelectorDeSector({
  empresa,
  set,
}: {
  empresa: Record<string, string>;
  set: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">Sector económico</span>
      <select
        value={empresa.sectorEconomico ?? ""}
        onChange={(e) => set((x) => ({ ...x, sectorEconomico: e.target.value }))}
        className={CAMPO}
      >
        <option value="">Elija…</option>
        <option value="COMERCIO">Comercio</option>
        <option value="SERVICIOS">Servicios</option>
        <option value="MANUFACTURA">Manufactura</option>
      </select>
    </label>
  );
}

function BuscadorDeNit({
  nit,
  razonSocial,
  alCambiar,
  esRut,
}: {
  nit: string;
  razonSocial: string;
  alCambiar: (nit: string, razonSocial: string) => void;
  /// El independiente no tiene NIT de empresa: tiene RUT.
  esRut?: boolean;
}) {
  const [buscando, setBuscando] = useState(false);
  const [encontradas, setEncontradas] = useState<string[] | null>(null);

  const [aMano, setAMano] = useState(false);

  async function buscar(valor: string) {
    const limpio = valor.replace(/\D/g, "");
    if (limpio.length < 5) {
      setEncontradas(null);
      return;
    }
    setBuscando(true);
    try {
      const r = await preinscripcionApi.buscarNit(limpio);
      const nombres = r.instituciones.map((i) => i.razonSocial);
      setEncontradas(nombres);
      // una sola: se pone y ya, sin hacer elegir
      if (nombres.length === 1) alCambiar(limpio, nombres[0]);
      else alCambiar(limpio, "");
      setAMano(nombres.length === 0);
    } catch {
      setEncontradas([]);
      setAMano(true);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          {esRut ? "RUT" : "NIT de la empresa"}{" "}
          <span className="text-error">·</span>
        </span>
        <input
          value={nit}
          inputMode="numeric"
          onChange={(e) => alCambiar(e.target.value.replace(/\D/g, ""), razonSocial)}
          onBlur={(e) => void buscar(e.target.value)}
          className={CAMPO}
        />
        <span className="mt-1 block text-xs text-texto-suave">
          {buscando ? "Buscando…" : "Escriba solo el número."}
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          {esRut ? "Nombre completo" : "Nombre de la organización"}
        </span>

        {encontradas && encontradas.length > 1 && !aMano ? (
          <>
            <select
              value={razonSocial}
              onChange={(e) => alCambiar(nit, e.target.value)}
              className={CAMPO}
            >
              <option value="">Elija cuál…</option>
              {encontradas.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setAMano(true);
                alCambiar(nit, "");
              }}
              className="mt-1 text-xs underline"
            >
              Ninguna es la mía, la escribo
            </button>
          </>
        ) : (
          <input
            value={razonSocial}
            onChange={(e) => alCambiar(nit, e.target.value)}
            className={CAMPO}
          />
        )}

        {encontradas && encontradas.length > 1 && !aMano && (
          <span className="mt-1 block text-xs text-texto-suave">
            Ese NIT ampara a {encontradas.length} organizaciones.
          </span>
        )}
      </label>
    </>
  );
}
