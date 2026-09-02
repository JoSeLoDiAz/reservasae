"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import { TEXTO_DE_RESPALDO } from "@/components/caja-de-politica";
import { ErrorApi } from "@/lib/api";
import { primero, resto } from "@/lib/nombres";
import {
  preinscripcionApi,
  type AccionPublica,
  type CatalogoPreinscripcion,
  type OfertaPublica,
} from "@/lib/preinscripcion-api";

import { FondoPublico } from "./fondo-publico";
import { BannerLogos, EncabezadoPublico, PiePublico } from "./marca-publica";

/// Los dos ids del catalogo del SEP que cambian el
/// comportamiento del formulario. Aqui y no en el backend
/// porque es la pantalla la que reacciona.
const DOCUMENTO_CEDULA = 1;
const DOCUMENTO_OTRO = 5;
/// El unico "otro" que el SEP admite en genero.
const GENERO_NO_BINARIO = 3;

/// El formulario va de a una pantalla. El orden es el del
/// tramite: primero si hay algo para usted, despues quien
/// es, despues que autoriza, y al final lo revisa.
type Pantalla = "eleccion" | "datos" | "habeas" | "revision";

const CAMPO =
  "w-full rounded-xl border border-campo-borde bg-campo-fondo px-3 py-2.5 text-texto " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

export function PreinscripcionPublica({ slug }: { slug: string }) {
  const [catalogo, setCatalogo] = useState<CatalogoPreinscripcion | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<{ token: string; nombre: string } | null>(null);

  const [accionId, setAccionId] = useState("");
  const [ofertaId, setOfertaId] = useState("");
  /// El domicilio manda: decide que acciones tienen cobertura.
  const [departamento, setDepartamento] = useState("");
  const [ciudad, setCiudad] = useState("");
  /// Una pantalla a la vez. Todo junto se ve cargado y
  /// ademas pide 8 datos personales antes de saber si hay
  /// algo con cobertura donde vive.
  const [pantalla, setPantalla] = useState<Pantalla>("habeas");
  const [datos, setDatos] = useState({
    tipoDocumentoSepId: "",
    documentoOtroCual: "",
    generoOtroCual: "",
    aceptaPolitica: "",
    numeroDocumento: "",
    nombres: "",
    primerApellido: "",
    segundoApellido: "",
    generoSepId: "",
    celular: "",
    correo: "",
  });

  /// Cambiar de pantalla sin subir deja a la persona
  /// mirando el pie de pagina.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pantalla]);

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
        // "Otro" viaja como NO BINARIO: el catalogo del SEP
        // solo admite tres valores y no tiene donde poner
        // texto. Lo que la persona escriba se guarda aparte
        generoSepId: datos.generoSepId
          ? datos.generoSepId === "OTRO"
            ? GENERO_NO_BINARIO
            : Number(datos.generoSepId)
          : undefined,
        generoOtroTexto: esOtroGenero ? datos.generoOtroCual || undefined : undefined,
        celular: datos.celular,
        correo: datos.correo,
        departamentoNombre: departamento || undefined,
        ciudadNombre: ciudad || undefined,
        // sin esto la autorizacion se quedaba en la pantalla:
        // se marcaba la casilla y no quedaba constancia de
        // nada, que es justo lo que hay que poder demostrar
        aceptaPolitica: datos.aceptaPolitica === "si",
      });
      setHecho({ token: r.token, nombre: nombreCompleto });
    } catch (err) {
      setError((err as ErrorApi).message);
      setEnviando(false);
    }
  }

  if (hecho) return <Registrada token={hecho.token} nombre={hecho.nombre} />;

  const ciudadesDelDepto =
    catalogo.ubicaciones.find((u) => u.departamento === departamento)?.ciudades ?? [];

  /// Una oferta de DEPARTAMENTO cubre a todo el que viva ahi.
  /// Una de CIUDAD cubre solo esa ciudad: por eso quien vive
  /// en Bello no ve la presencial que se dicta en Medellin.
  const cubre = (o: (typeof catalogo.acciones)[number]["ofertas"][number]) =>
    o.tipo === "DEPARTAMENTO"
      ? o.ubicacion === departamento
      : o.ubicacion === ciudad;

  const conCobertura = departamento
    ? catalogo.acciones
        .map((a) => ({ accion: a, oferta: a.ofertas.find(cubre) ?? null }))
        .filter((x) => x.oferta !== null)
    : [];

  const accionElegida = catalogo.acciones.find((a) => a.id === accionId) ?? null;
  const nombreAccion = accionElegida?.nombre ?? "";
  const ubicacionLegible = ciudad ? `${departamento} · ${ciudad}` : departamento;

  const nombreCompleto = [datos.nombres, datos.primerApellido, datos.segundoApellido]
    .filter(Boolean)
    .join(" ");

  const sigla =
    catalogo.documentos.find((d) => String(d.id) === datos.tipoDocumentoSepId)?.etiqueta ??
    "";
  const documentoLegible = `${sigla} ${datos.numeroDocumento}`.trim();

  /// El tipo manda sobre lo que se admite en el numero.
  const esCedula = Number(datos.tipoDocumentoSepId) === DOCUMENTO_CEDULA;
  const esOtroDocumento = Number(datos.tipoDocumentoSepId) === DOCUMENTO_OTRO;
  const esOtroGenero = datos.generoSepId === "OTRO";

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo.trim());

  /// Lo que falta, con nombre. Un boton apagado sin decir
  /// por que es lo que hace que la gente abandone.
  const faltaEnDatos = [
    !datos.nombres.trim() && "nombres",
    !datos.primerApellido.trim() && "primer apellido",
    !datos.generoSepId && "género",
    esOtroGenero && !datos.generoOtroCual.trim() && "cuál es su género",
    datos.celular.length !== 10 &&
      (datos.celular ? "el celular completo (10 dígitos)" : "celular"),
    !correoValido && (datos.correo.trim() ? "un correo válido" : "correo electrónico"),
    !datos.tipoDocumentoSepId && "tipo de documento",
    !datos.numeroDocumento.trim() && "número de documento",
    esOtroDocumento && !datos.documentoOtroCual.trim() && "cuál es el documento",
  ].filter(Boolean) as string[];

  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-6 py-10 lg:max-w-4xl">
      <EncabezadoPublico
        titulo="Preinscripción a la formación"
        subtitulo="Formación gratuita y certificada con cupos limitados."
      />

      <form
        onSubmit={enviar}
        /* Enter dentro de un campo no envia: el formulario se
           manda solo desde el resumen, y a medio llenar seria
           una ficha incompleta que nadie pidio */
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
        className="mt-8 space-y-8"
      >
        {/* el estado del proceso: reservar no es estar inscrito */}
        <BandaDeEstado paso={1} />

        {/* Pantalla 2. Donde vive y que le interesa, nada
            mas. Pedirle ocho datos personales antes de
            saber si hay algo con cobertura donde vive es
            pedirle trabajo a cambio de nada */}
        {pantalla === "eleccion" && (
          <>
        <section className="rounded-2xl border border-borde bg-superficie p-6">
          {/* NO es donde vive: es donde quiere estudiar.

              Decia «Ubicacion de domicilio» y no lo es -- se usa
              para filtrar que acciones tienen cobertura ahi. Lo
              vio el cliente probando: alguien de Bogota puede
              querer tomarla en Santander, y con el rotulo viejo
              acababa reportado al SENA como residente en
              Santander. El domicilio de verdad se pregunta en el
              enlace de completado, aparte. */}
          <h2 className="text-lg font-semibold">
            Ubicación de interés de la formación
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Seleccione el departamento y la ciudad de su interés para consultar
            las acciones de formación disponibles.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Departamento</span>
              <select
                required
                value={departamento}
                onChange={(e) => {
                  setDepartamento(e.target.value);
                  setCiudad("");
                  setAccionId("");
                  setOfertaId("");
                }}
                className={CAMPO}
              >
                <option value="">Elija…</option>
                {catalogo.ubicaciones.map((u) => (
                  <option key={u.departamento} value={u.departamento}>
                    {u.departamento}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Ciudad
                {ciudadesDelDepto.length === 0 && departamento && (
                  <span className="font-normal text-texto-suave"> (no aplica)</span>
                )}
              </span>
              <select
                value={ciudad}
                disabled={!departamento || ciudadesDelDepto.length === 0}
                onChange={(e) => {
                  setCiudad(e.target.value);
                  setAccionId("");
                  setOfertaId("");
                }}
                className={CAMPO + (departamento ? "" : " opacity-50")}
              >
                <option value="">
                  {ciudadesDelDepto.length === 0 ? "Sin sedes presenciales" : "Elija…"}
                </option>
                {ciudadesDelDepto.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* las acciones salen aqui mismo, no en otra pantalla */}
        {departamento && (
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-xl font-bold tracking-tight">
                Acciones de formación disponibles
              </h2>
              <span className="text-sm text-texto-suave">
                {conCobertura.length} con cobertura en {departamento}
                {ciudad ? ` · ${ciudad}` : ""}
              </span>
            </div>

            <p className="mt-1 text-sm text-texto-suave">
              A continuación, las acciones de formación disponibles para su preinscripción:
            </p>

            {conCobertura.length > 0 && (
              <p className="mt-3 rounded-xl bg-marca-suave px-4 py-3 text-sm text-marca">
                Seleccione la que sea de su mayor interés, considerando que solo puede
                preinscribirse en una.
              </p>
            )}

            {conCobertura.length === 0 && (
              <p className="mt-3 rounded-xl border border-borde bg-superficie px-4 py-3 text-sm text-texto-suave">
                No hay acciones con cobertura en esa ubicación. Pruebe con otra ciudad del
                mismo departamento.
              </p>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {conCobertura.map(({ accion, oferta }) => (
                <TarjetaAccion
                  key={accion.id}
                  accion={accion}
                  oferta={oferta!}
                  elegida={accionId === accion.id}
                  /* elegir es avanzar: la lista se guarda y
                     salen los datos personales */
                  alElegir={() => {
                    setAccionId(accion.id);
                    setOfertaId(oferta!.id);
                    setPantalla("datos");
                  }}
                />
              ))}
            </div>
          </section>
        )}
          </>
        )}

        {/* Pantalla 3. Con la eleccion arriba, en una linea,
            y un boton para deshacerla */}
        {pantalla === "datos" && (
          <>
        <LoElegido
          codigo={accionElegida?.codigo ?? ""}
          nombre={nombreAccion}
          ubicacion={ubicacionLegible}
          alCambiar={() => setPantalla("eleccion")}
        />

        <section className="rounded-2xl border border-borde bg-superficie p-6">
          <h2 className="text-lg font-semibold">Datos Personales</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Para formalizar su preinscripción, complete la siguiente información:
          </p>
          {/* Se dice ARRIBA que todos hacen falta, no solo abajo
              cuales faltan. Enterarse campo a campo de que otro
              era obligatorio es como se abandona un formulario. */}
          <p className="mt-2 text-sm font-medium text-texto">
            Recuerde que todos los campos son obligatorios para completar su
            preinscripción.
          </p>

          {/* dos columnas desde tablet, tres en escritorio: en
              pantalla grande la rejilla de dos dejaba el
              formulario apretado en una columna estrecha */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* el nombre completo ocupa la fila entera: es lo
                mas largo del formulario y partido en dos se
                corta a la mitad */}
            <div className="sm:col-span-2 lg:col-span-3">
              <Texto
                etiqueta="Nombres"
                valor={datos.nombres}
                alCambiar={(v) => cambiar("nombres", v)}
                requerido
              />
            </div>

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
              sinOpcional
            />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Género</span>
              <select
                required
                value={datos.generoSepId}
                onChange={(e) => {
                  cambiar("generoSepId", e.target.value);
                  if (e.target.value !== "OTRO") cambiar("generoOtroCual", "");
                }}
                className={CAMPO}
              >
                <option value="">Elija…</option>
                <option value="1">Masculino</option>
                <option value="2">Femenino</option>
                <option value="OTRO">Otro</option>
              </select>
            </label>

            {esOtroGenero && (
              <div className="sm:col-span-2 lg:col-span-3">
                <Texto
                  etiqueta="¿Cuál? Se guarda tal como lo escriba"
                  valor={datos.generoOtroCual}
                  alCambiar={(v) => cambiar("generoOtroCual", v)}
                  maximo={40}
                  sinOpcional
                />
              </div>
            )}

            <Texto
              etiqueta="Celular"
              valor={datos.celular}
              alCambiar={(v) => cambiar("celular", v)}
              tipo="tel"
              requerido
              soloDigitos
              maximo={10}
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

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Tipo de documento</span>
              <select
                required
                value={datos.tipoDocumentoSepId}
                onChange={(e) => {
                  cambiar("tipoDocumentoSepId", e.target.value);
                  // cambiar de tipo cambia lo que se admite:
                  // dejar lo tecleado deja un numero invalido
                  cambiar("numeroDocumento", "");
                  if (Number(e.target.value) !== DOCUMENTO_OTRO) {
                    cambiar("documentoOtroCual", "");
                  }
                }}
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
              deshabilitado={!datos.tipoDocumentoSepId}
              soloDigitos={esCedula}
              maximo={esCedula ? 10 : 20}
              ayuda={
                !datos.tipoDocumentoSepId
                  ? "Elija primero el tipo de documento."
                  : esCedula
                    ? "Solo números, máximo 10 dígitos."
                    : "Puede llevar letras y números."
              }
            />

            {esOtroDocumento && (
              <Texto
                etiqueta="¿Cuál?"
                valor={datos.documentoOtroCual}
                alCambiar={(v) => cambiar("documentoOtroCual", v)}
                requerido
                maximo={60}
              />
            )}
          </div>

        </section>

        {faltaEnDatos.length > 0 && (
          <p className="rounded-xl border border-borde bg-superficie-alterna px-4 py-3 text-sm text-texto-suave">
            Para continuar falta: <strong>{faltaEnDatos.join(", ")}</strong>.
          </p>
        )}

        <BotonesDePaso
          atras="Volver a las acciones"
          alVolver={() => setPantalla("eleccion")}
          adelante="Continuar"
          bloqueado={faltaEnDatos.length > 0}
          alSeguir={() => setPantalla("revision")}
        />
          </>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-error/30 bg-error-suave p-4 text-sm text-error">
            {error}
          </p>
        )}

        {/* Pantalla 1. El habeas data, solo y ANTES DE TODO.
            Iba de casilla al pie de una pantalla larga, con
            un enlace que casi nadie abria: eso no alcanza
            para sostener que la persona leyo lo que
            autorizo.
            Y va primero porque es lo que autoriza a pedir el
            resto: preguntarle el domicilio, la cedula y el
            estrato y AL FINAL pedirle permiso para tratar
            sus datos es pedir el permiso cuando ya se
            tomaron. */}
        {pantalla === "habeas" && (
          <>
        <section className="rounded-2xl border border-borde bg-superficie p-6">
          <h2 className="text-lg font-semibold">
            {catalogo.politica?.titulo ?? "Política y Tratamiento de Datos Personales"}
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Por favor, confirme haber leído y aceptado lo siguiente antes de continuar.
          </p>

          <div className="mt-5 max-h-80 overflow-y-auto whitespace-pre-line rounded-xl border border-campo-borde bg-campo-fondo p-5 text-sm leading-relaxed text-texto">
            {catalogo.politica?.contenido ?? TEXTO_DE_RESPALDO}
          </div>

          <p className="mt-5 rounded-xl border border-borde bg-superficie-alterna px-4 py-3 text-sm leading-relaxed text-texto-suave">
            Necesitamos su autorización para continuar con su preinscripción: sin
            ella no podemos usar sus datos para comunicarnos con usted.
          </p>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-campo-borde bg-campo-fondo p-4 text-sm">
            <input
              type="checkbox"
              checked={datos.aceptaPolitica === "si"}
              onChange={(e) => cambiar("aceptaPolitica", e.target.checked ? "si" : "")}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>
              He leído y <strong>autorizo</strong> el tratamiento de mis datos personales
              en los términos anteriores.
            </span>
          </label>

        </section>

        <BotonesDePaso
          adelante="Aceptar y continuar"
          bloqueado={datos.aceptaPolitica !== "si"}
          alSeguir={() => setPantalla("eleccion")}
        />
          </>
        )}

        {/* Pantalla 4. Nada se manda sin pasar por aqui */}
        {pantalla === "revision" && (
          <section className="rounded-2xl border-2 border-marca bg-marca-suave p-6">
            <h2 className="text-lg font-semibold text-marca">
              Verifique la información antes de enviar
            </h2>

            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Resumen etiqueta="Acción de formación" valor={nombreAccion} />
              <Resumen
                etiqueta="Ubicación"
                valor={ciudad ? `${departamento} · ${ciudad}` : departamento}
              />
              <Resumen etiqueta="Nombre completo" valor={nombreCompleto} />
              <Resumen etiqueta="Documento" valor={documentoLegible} mono />
              <Resumen etiqueta="Celular" valor={datos.celular} />
              <Resumen etiqueta="Correo" valor={datos.correo} />
              <Resumen etiqueta="Tratamiento de datos" valor="Autorizado" />
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={enviando}
                className="rounded-xl bg-marca px-7 py-3.5 font-medium text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
              >
                {enviando ? "Registrando…" : "Está correcto, confirmar mi preinscripción"}
              </button>
              <button
                type="button"
                onClick={() => setPantalla("datos")}
                className="rounded-xl border border-campo-borde bg-superficie px-5 py-3 text-texto transition hover:bg-superficie-alterna"
              >
                Modificar datos
              </button>
            </div>

            <p className="mt-4 text-xs text-marca">
              Complete el registro presionando el botón de confirmación.
            </p>
          </section>
        )}
      </form>
      </main>
      <FondoPublico />
      <PiePublico />
    </>
  );
}

/// Lo que eligio, en una linea, mientras llena el resto.
/// Sin esto la pantalla siguiente aparece sola y no queda
/// rastro de que estaba haciendo.
function LoElegido({
  codigo,
  nombre,
  ubicacion,
  alCambiar,
}: {
  codigo: string;
  nombre: string;
  ubicacion: string;
  alCambiar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-marca/30 bg-marca-suave px-5 py-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-marca">
          Formación seleccionada
        </p>
        <p className="mt-1 font-semibold leading-snug text-balance">
          {codigo && (
            <span className="mr-1.5 font-mono text-sm text-marca">{codigo}</span>
          )}
          {nombre}
        </p>
        <p className="mt-0.5 text-sm text-texto-suave">{ubicacion}</p>
      </div>
      <button
        type="button"
        onClick={alCambiar}
        className="shrink-0 rounded-xl border border-marca/40 bg-superficie px-4 py-2 text-sm font-medium text-marca transition hover:bg-superficie-alterna"
      >
        Cambiar
      </button>
    </div>
  );
}

/// Volver y seguir, iguales en todas las pantallas: cambiar
/// de sitio los botones entre paso y paso hace dudar.
function BotonesDePaso({
  atras,
  alVolver,
  adelante,
  bloqueado,
  alSeguir,
}: {
  /// Sin ellos no se pinta el boton de volver. El primer
  /// paso no tiene a donde volver, y un boton «atras» que no
  /// lleva a ninguna parte es peor que no tenerlo.
  atras?: string;
  alVolver?: () => void;
  adelante: string;
  bloqueado: boolean;
  alSeguir: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {atras && alVolver && (
      <button
        type="button"
        onClick={alVolver}
        className="rounded-xl border border-campo-borde bg-superficie px-5 py-3 text-texto transition hover:bg-superficie-alterna"
      >
        {atras}
      </button>
      )}
      <button
        type="button"
        disabled={bloqueado}
        onClick={alSeguir}
        className="flex-1 rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
      >
        {adelante}
      </button>
    </div>
  );
}

/** Dónde se dicta, con lo que queda libre. */
/// El estado del proceso, en las tres pantallas del flujo.
/// Reservar no es estar inscrito, y ese es el malentendido
/// que hay que evitar desde el primer clic.
function BandaDeEstado({ paso }: { paso: 1 | 2 | 3 }) {
  const pasos = [
    { n: 1, texto: "Reserva de cupo" },
    { n: 2, texto: "Datos de preinscripción" },
    { n: 3, texto: "Preinscripción confirmada" },
  ];

  return (
    <div className="rounded-2xl border border-borde bg-superficie px-5 py-4">
      <div className="flex flex-wrap items-center gap-y-2">
        {pasos.map((x, i) => (
          <div key={x.n} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                x.n < paso
                  ? "bg-exito text-white"
                  : x.n === paso
                    ? "bg-marca text-marca-texto"
                    : "bg-superficie-alterna text-texto-suave"
              }`}
            >
              {x.n < paso ? "✓" : x.n}
            </span>
            <span
              className={`whitespace-nowrap text-sm ${
                x.n === paso ? "font-semibold text-marca" : "text-texto-suave"
              }`}
            >
              {x.texto}
            </span>
            {i < pasos.length - 1 && (
              <span className="mx-2 hidden h-px flex-1 bg-borde sm:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const ESTILO_MODALIDAD: Record<string, string> = {
  VIRTUAL: "bg-exito-suave text-exito",
  PRESENCIAL: "bg-marca-suave text-marca",
  HIBRIDA: "bg-aviso-suave text-aviso",
};

const ETIQUETA_MODALIDAD: Record<string, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  HIBRIDA: "Híbrida",
};

/// Una accion con cobertura. Boton y no tarjeta con radio:
/// el area de toque es toda la tarjeta, que en movil importa.
function TarjetaAccion({
  accion,
  oferta,
  elegida,
  alElegir,
}: {
  accion: AccionPublica;
  oferta: OfertaPublica;
  elegida: boolean;
  alElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={alElegir}
      aria-pressed={elegida}
      className={`flex flex-col gap-3 rounded-2xl border p-5 text-left transition ${
        elegida
          ? "border-2 border-marca bg-superficie"
          : "border-borde bg-superficie hover:border-campo-borde"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-marca-suave px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-marca">
          {accion.codigo}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
            ESTILO_MODALIDAD[accion.modalidad] ?? "bg-superficie-alterna text-texto-suave"
          }`}
        >
          {ETIQUETA_MODALIDAD[accion.modalidad] ?? accion.modalidad}
        </span>
        {accion.horas != null && (
          <span className="rounded-md bg-superficie-alterna px-2 py-0.5 text-xs text-texto-suave">
            {accion.horas} horas
          </span>
        )}
      </div>

      <h3 className="text-base font-semibold leading-snug text-balance">{accion.nombre}</h3>

      {accion.resumen && (
        <p className="text-sm leading-relaxed text-texto-suave">{accion.resumen}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">
        {oferta.tipo === "CIUDAD" && (
          <span className="text-texto-suave">Sede {oferta.ubicacion}</span>
        )}
        {oferta.libres <= 10 && (
          <span className="font-medium text-error">
            Disponibilidad: {oferta.libres} cupos
          </span>
        )}
        {elegida && <span className="ml-auto font-semibold text-marca">Seleccionada</span>}
      </div>
    </button>
  );
}


/// Una fila del resumen. Sin valor no se pinta: una etiqueta
/// con un guion al lado no le dice nada a nadie.
function Resumen({
  etiqueta,
  valor,
  mono,
}: {
  etiqueta: string;
  valor: string;
  mono?: boolean;
}) {
  if (!valor.trim()) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-texto-suave">{etiqueta}</dt>
      <dd className={`mt-0.5 font-medium ${mono ? "font-mono text-sm" : ""}`}>{valor}</dd>
    </div>
  );
}

function Texto({
  etiqueta,
  valor,
  alCambiar,
  requerido,
  tipo = "text",
  ayuda,
  sinOpcional,
  maximo,
  soloDigitos,
  deshabilitado,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  requerido?: boolean;
  tipo?: string;
  ayuda?: string;
  /// Para los campos que no lo llevan aunque sean opcionales.
  sinOpcional?: boolean;
  maximo?: number;
  soloDigitos?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {etiqueta}
        {!requerido && !sinOpcional && (
          <span className="text-texto-suave"> (opcional)</span>
        )}
      </span>
      <input
        type={tipo}
        required={requerido}
        disabled={deshabilitado}
        value={valor}
        maxLength={maximo}
        // el teclado numerico en el movil, sin usar
        // type=number: ese come los ceros de la izquierda
        inputMode={soloDigitos ? "numeric" : undefined}
        onChange={(e) => {
          const v = soloDigitos ? e.target.value.replace(/\D/g, "") : e.target.value;
          alCambiar(maximo ? v.slice(0, maximo) : v);
        }}
        className={CAMPO + (deshabilitado ? " opacity-50" : "")}
      />
      {ayuda && <span className="mt-1 block text-xs text-texto-suave">{ayuda}</span>}
    </label>
  );
}

/** Quedó preinscrita. La inscripción la cierra un asesor. */
/// Preinscribirse no es estar inscrito, y es aqui donde se
/// decide si la persona sigue o se va: por eso la pantalla
/// la llama por su nombre y deja un solo camino abierto.
///
/// Y dice QUIEN cierra la inscripcion. «Termine su
/// inscripcion» ponia el cierre en manos de la persona, y no
/// esta en sus manos: por muchos datos que llene, la
/// inscripcion no es efectiva hasta que un asesor la
/// contacte. Prometer lo contrario es prometer un cupo.
function Registrada({ token, nombre }: { token: string; nombre: string }) {
  return (
    <>
      <main className="mx-auto w-full max-w-xl px-6 py-16 text-center">
      <BannerLogos />

      <h1 className="mt-8 text-2xl font-bold text-balance">
        ¡Gracias{nombre ? ` ${nombre}` : ""}, su preinscripción fue realizada
        exitosamente!
      </h1>
      {/* Las dos cosas, y en este orden.

          Primero lo que NO depende de ella --que la inscripcion
          la cierra un asesor-- y despues lo que si: completar sus
          datos ahora, si quiere. Al reves, el ofrecimiento se lee
          como «termine usted y quedara inscrito», que es
          justamente lo que no pasa.

          Y se dice que es OPCIONAL. Quien no lo haga no pierde
          nada: el asesor se lo preguntara por telefono. */}
      <p className="mt-3 text-texto-suave">
        Su inscripción no será efectiva hasta tanto no sea contactado por un
        asesor.
      </p>
      <p className="mt-2 text-texto-suave">
        Si lo desea, puede continuar ahora con su registro de preinscripción y
        completar sus datos. También puede dejarlo y esperar a que un asesor se
        comunique con usted.
      </p>

      <a
        href={`/completar/${token}`}
        className="mt-8 inline-block rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto transition hover:bg-marca-fuerte"
      >
        Continuar con mi registro de preinscripción
      </a>
      </main>
      <FondoPublico />
      <PiePublico />
    </>
  );
}
