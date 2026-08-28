"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorApi } from "@/lib/api";
import { juntar, primero, resto } from "@/lib/nombres";
import { preinscripcionApi, type FichaAbierta } from "@/lib/preinscripcion-api";

import { BannerLogos, ConmutadorTema, PiePublico } from "./marca-publica";

/// Las etiquetas del SEP vienen en mayuscula sostenida --
/// «MUJER CABEZA DE FAMILIA» -- y a una persona no se le
/// pregunta a gritos si es victima del conflicto.
function bonito(t: string): string {
  const minus = t.toLocaleLowerCase("es-CO");
  return minus.charAt(0).toLocaleUpperCase("es-CO") + minus.slice(1);
}

const CAMPO =
  "w-full rounded-xl border border-campo-borde bg-campo-fondo px-3 py-2.5 text-texto " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

type Paso = "PERSONA" | "EMPRESA" | "HECHO";

export function CompletarFicha({ token }: { token: string }) {
  const [ficha, setFicha] = useState<FichaAbierta | null>(null);
  /**
   * Lo que ya traía cuando abrió el enlace.
   *
   * Se congela al abrir y no se recalcula: si mirara el
   * estado actual, cada campo desaparecería en cuanto la
   * persona terminara de escribirlo, y estaría llenando un
   * formulario que se le deshace debajo de las manos.
   *
   * Estado y no `ref`: esto decide QUÉ SE PINTA, y lo que
   * se pinta se lee durante el render. Un ref leído en el
   * render no avisa a React de que hay que volver a pintar.
   */
  const [yaEstaba, setYaEstaba] = useState<Record<string, boolean> | null>(null);
  /**
   * Por qué no se pudo abrir. Con el ESTADO, no solo el texto.
   *
   * Antes cualquier fallo salía como «Este enlace ya no
   * sirve». Si el servidor estaba caído —o la persona iba en
   * el bus y se le fue la señal— se le decía que su enlace
   * estaba muerto, y esa persona no vuelve a intentar: cierra
   * y llama a preguntar por qué le mandaron un enlace roto.
   * El enlace estaba bien.
   */
  const [fallo, setFallo] = useState<{ estado: number; mensaje: string } | null>(
    null,
  );
  const [paso, setPaso] = useState<Paso>("PERSONA");
  /// El paso 1 no se abrió porque no le faltaba nada suyo.
  /// Entonces no hay «paso anterior» al que volver.
  const [saltoElPaso1, setSaltoElPaso1] = useState(false);
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

  /// Poblacion vulnerable. Se guarda aparte del resto porque
  /// es lo unico sensible que se pregunta, y porque no es un
  /// texto: es una lista de casillas.
  const [caracterizaciones, setCaracterizaciones] = useState<number[]>([]);
  const [rechazaCaracterizacion, setRechazaCaracterizacion] = useState(false);

  useEffect(() => {
    preinscripcionApi
      .abrir(token)
      .then((f) => {
        setFicha(f);
        const p = f.persona as Record<string, unknown>;

        // se anota AQUI lo que ya venia lleno, al abrir, y no
        // se vuelve a mirar: si se recalculara con lo que hay
        // escrito, cada campo desapareceria en cuanto la
        // persona terminara de teclearlo
        const tiene = (k: string) => {
          const x = p[k];
          return x !== null && x !== undefined && String(x).trim() !== "";
        };
        // lo que ya marco, para no preguntarselo en blanco
        setCaracterizaciones(f.caracterizacionesElegidas);
        setRechazaCaracterizacion(f.caracterizacionRechazada);

        setYaEstaba({
          fechaNacimiento: tiene("fechaNacimiento"),
          estrato: tiene("estrato"),
          barrio: tiene("barrio"),
          direccion: tiene("direccion"),
          cargoEnEmpresa: f.cargoEnEmpresa !== null,
          nivelOcupacionalSepId: f.nivelOcupacionalSepId !== null,
          beneficiarioPrevio: f.beneficiarioPrevio !== null,
        });

        /// Si no le falta NADA suyo, este paso ni se abre.
        ///
        /// Enseñarle una pantalla que dice «no falta nada» y
        /// pedirle que pulse «Guardar y seguir» es hacerle dar
        /// un clic para no hacer nada. Se salta al paso que sí
        /// le falta.
        const nadaSuyo =
          tiene("fechaNacimiento") &&
          tiene("estrato") &&
          tiene("barrio") &&
          tiene("direccion") &&
          f.cargoEnEmpresa !== null &&
          f.nivelOcupacionalSepId !== null &&
          f.beneficiarioPrevio !== null;
        if (nadaSuyo) {
          setPaso("EMPRESA");
          setSaltoElPaso1(true);
        }

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
      .catch((e: unknown) => {
        /// `fetch` que no llega ni a conectarse no lanza un
        /// ErrorApi, lanza un TypeError pelado. Ese caso es
        /// justamente el del servidor caído, así que se marca
        /// con estado 0 para poder distinguirlo.
        const estado = e instanceof ErrorApi ? e.estado : 0;
        const mensaje = e instanceof Error ? e.message : String(e);
        setFallo({ estado, mensaje });
      });
  }, [token]);

  // los del departamento elegido, y solo esos
  const municipios = useMemo(() => {
    const dep = Number(persona.departamentoSepId);
    if (!ficha || !dep) return [];
    return ficha.municipios.filter((m) => m[1] === dep);
  }, [ficha, persona.departamentoSepId]);

  if (fallo) {
    /// El enlace SOLO se da por muerto cuando el servidor lo
    /// dice: 404 si no existe, 410 si ya se usó o venció, 400
    /// si viene mal formado. Cualquier otra cosa —no hay red,
    /// el servidor está caído, un 500— es un problema nuestro,
    /// y el enlace sigue bueno.
    const enlaceMuerto = [400, 404, 410].includes(fallo.estado);

    return (
      <>
        <main className="mx-auto w-full max-w-lg px-6 py-20 text-center">
          <BannerLogos />
          {enlaceMuerto ? (
            <>
              <h1 className="mt-8 text-2xl font-bold">Este enlace ya no sirve</h1>
              <p className="mt-3 text-texto-suave">{fallo.mensaje}</p>
              <p className="mt-4 text-sm text-texto-suave">
                Pídale uno nuevo a la persona que lo está acompañando.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-8 text-2xl font-bold">
                No pudimos abrir su formulario
              </h1>
              <p className="mt-3 text-texto-suave">
                Su enlace está bien; el problema es nuestro. Vuelva a intentarlo
                en un momento.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 rounded-xl border border-marca px-5 py-2 text-sm font-medium text-marca transition hover:bg-marca-suave"
              >
                Reintentar
              </button>
            </>
          )}
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
        // poblacion vulnerable: la lista, o el rechazo
        caracterizaciones: rechazaCaracterizacion ? [] : caracterizaciones,
        caracterizacionRechazada: rechazaCaracterizacion,
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

  /// Solo se pregunta lo que falta. Si ya lo tiene, no sale.
  const pide = (campo: string) => !yaEstaba?.[campo];

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

      {/* Reservar no es estar inscrito, y hay que decirlo.
          
          El paso 2 llevaba palomita de «hecho» siendo justo el
          que la persona está haciendo en esa pantalla: la
          dejaba creyendo que ya había terminado. Solo lleva
          palomita lo que de verdad quedó atrás. */}
      <div className="mt-6 rounded-2xl border border-borde bg-superficie px-5 py-4">
        <div className="flex flex-wrap items-center gap-y-2">
          {[
            { n: 1, texto: "Reserva de cupo", estado: "hecho" },
            { n: 2, texto: "Datos de inscripción", estado: "ahora" },
            { n: 3, texto: "Inscripción confirmada", estado: "falta" },
          ].map((x, i, todos) => (
            <div key={x.n} className="flex flex-1 items-center gap-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  x.estado === "hecho"
                    ? "bg-exito text-white"
                    : x.estado === "ahora"
                      ? "bg-marca text-marca-texto"
                      : "border border-borde text-texto-suave"
                }`}
              >
                {x.estado === "hecho" ? "✓" : x.n}
              </span>
              <span
                className={`whitespace-nowrap text-sm ${
                  x.estado === "ahora" ? "font-semibold text-marca" : "text-texto-suave"
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
          {/* La política va PRIMERO, antes de pedir un solo dato.

              Es el orden que manda la ley 1581: primero se dice
              qué se va a hacer con los datos y quién los va a
              tratar, y después se piden. Enseñarla al final —o
              como un enlace que casi nadie abre— es pedir
              primero y avisar después. */}
          {ficha.politica && (
            <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
              <h2 className="text-lg font-semibold">{ficha.politica.titulo}</h2>
              {ficha.yaAutorizo && (
                <p className="mt-1 text-sm text-exito">
                  Usted ya la aceptó al reservar su cupo. Queda aquí para que la
                  pueda volver a leer.
                </p>
              )}
              <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-borde bg-superficie-alterna p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {ficha.politica.contenido}
              </div>
              <p className="mt-3 text-xs text-texto-suave">
                Versión {ficha.politica.version}
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              {faltaEnPersona.length === 0
                ? "Sus datos están completos"
                : "Datos pendientes"}
            </h2>
            <p className="mt-1 text-sm text-texto-suave">
              {faltaEnPersona.length === 0
                ? "No falta nada suyo. Continúe con los datos laborales."
                : `Falta: ${faltaEnPersona.join(", ")}.`}
            </p>

            {/* nombres, apellidos, celular, correo, genero,
                departamento y municipio ya se dieron al reservar
                el cupo: volver a pedirlos invita a contradecirlos */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pide("fechaNacimiento") && (
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
              )}

              {pide("estrato") && (
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
              )}

              {pide("barrio") && (
                <Campo etiqueta="Barrio o vereda" campo="barrio" valores={persona} set={setPersona} />
              )}
              {pide("direccion") && (
                <div className="sm:col-span-2">
                  <Campo etiqueta="Dirección" campo="direccion" valores={persona} set={setPersona} />
                </div>
              )}

              {pide("cargoEnEmpresa") && (
                <Campo
                  etiqueta="¿Cuál es su cargo actual?"
                  campo="cargoEnEmpresa"
                  valores={persona}
                  set={setPersona}
                />
              )}

              {pide("nivelOcupacionalSepId") && (
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
              )}

              {pide("beneficiarioPrevio") && (
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
              )}
            </div>
          </section>


          {/* Lo último antes de los datos de la empresa.

              Va al final a propósito: es lo más íntimo que se
              pregunta —ser víctima del conflicto, tener una
              discapacidad— y se pide después de que la persona
              ya vio para qué es todo esto. Preguntarlo de
              entrada, antes que el nombre, es otra conversación.

              Y es OPCIONAL de verdad: hay un botón para no
              decirlo, porque un dato sensible que no se puede
              rehusar no está consentido. */}
          <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Población vulnerable</h2>
            <p className="mt-1 text-sm text-texto-suave">
              El SENA lleva este dato para saber a quién está llegando la
              formación. Marque lo que le aplique, o siga sin contestar: no
              cambia en nada su inscripción.
            </p>

            {rechazaCaracterizacion ? (
              <div className="mt-4 rounded-xl border border-borde bg-superficie-alterna p-4 text-sm">
                <p>Prefiere no responder. Queda así.</p>
                <button
                  type="button"
                  onClick={() => setRechazaCaracterizacion(false)}
                  className="mt-2 text-marca underline"
                >
                  Cambiar de opinión
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4 grid max-h-64 gap-1 overflow-y-auto rounded-xl border border-borde p-3 sm:grid-cols-2">
                  {ficha.caracterizaciones.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-superficie-alterna"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={caracterizaciones.includes(c.id)}
                        onChange={(e) =>
                          setCaracterizaciones((v) =>
                            e.target.checked
                              ? [...v, c.id]
                              : v.filter((x) => x !== c.id),
                          )
                        }
                      />
                      <span>{bonito(c.etiqueta)}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRechazaCaracterizacion(true);
                    setCaracterizaciones([]);
                  }}
                  className="mt-3 text-sm text-texto-suave underline hover:text-texto"
                >
                  Prefiero no responder
                </button>
              </>
            )}
          </section>

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

                {/* Solo si hay a dónde volver.
                    
                    Si el paso 1 no se abrió -- porque no le
                    faltaba nada suyo -- «Volver al paso
                    anterior» lo mandaba a una pantalla vacía
                    que decía «no falta nada». Un botón que
                    lleva a ninguna parte. */}
                {!saltoElPaso1 && (
                <button
                  type="button"
                  onClick={() => setPaso("PERSONA")}
                  className="rounded-xl border border-campo-borde bg-superficie px-5 py-3 text-texto transition hover:bg-superficie-alterna"
                >
                  Volver al paso anterior
                </button>
                )}
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
