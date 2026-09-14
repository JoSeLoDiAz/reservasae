"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import { conEnlaces, TEXTO_DE_RESPALDO } from "@/components/caja-de-politica";
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
import { ModalInformacionAccion } from "./modal-informacion-accion";
import { PantallaDeCarga, useEsperaCompleta } from "./pantalla-de-carga";

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
  const [hecho, setHecho] = useState<{
    token: string | null;
    nombre: string;
    mensaje: string | null;
  } | null>(null);

  const [accionId, setAccionId] = useState("");
  const [ofertaId, setOfertaId] = useState("");
  /// El domicilio manda: decide que acciones tienen cobertura.
  const [departamento, setDepartamento] = useState("");
  const [ciudad, setCiudad] = useState("");
  /// Una pantalla a la vez. Todo junto se ve cargado y
  /// ademas pide 8 datos personales antes de saber si hay
  /// algo con cobertura donde vive.
  const [pantalla, setPantalla] = useState<Pantalla>("habeas");
  /// La caja del texto legal empieza corta y se abre a peticion.
  const [textoEntero, setTextoEntero] = useState(false);
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

  /// La pantalla de carga, hasta que complete su vuelta.
  const esperando = useEsperaCompleta(catalogo === null);

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
  if (esperando || !catalogo)
    return <PantallaDeCarga que="Cargando la convocatoria" />;

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
      setHecho({
        // sin token cuando el documento ya estaba: ver `Registrada`
        token: r.yaEstaba ? null : r.token,
        nombre: nombreCompleto,
        mensaje: r.mensaje ?? null,
      });
    } catch (err) {
      setError((err as ErrorApi).message);
      setEnviando(false);
    }
  }

  if (hecho)
    return (
      <Registrada token={hecho.token} nombre={hecho.nombre} mensaje={hecho.mensaje} />
    );

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
      {/* `pb-6` y no `py-10`: el relleno de ABAJO es lo que
          separa el contenido de la línea del pie, y con 40px la
          línea quedaba flotando lejos. El de arriba se queda en
          40: ese es el aire del encabezado (cliente, 11 sep 2026). */}
      <main className="mx-auto w-full max-w-2xl px-6 pt-10 pb-6 lg:max-w-4xl">
      {/* Los textos de esta pantalla los redacta el cliente. Lo
          de «en el marco de la Convocatoria … 2026» y lo de
          «incluyentes» no es adorno: es como el SENA nombra la
          convocatoria y hay que decirlo entero (11 sep 2026). */}
      <EncabezadoPublico
        /// «GRATUITA» EN EL TITULO, no solo en la bajada.
        ///
        /// «Que la persona le dio me gusta en Meta y de una vez
        /// le estamos diciendo te estamos preinscribiendo: puede
        /// generar reserva si no está segura de si tiene que
        /// pagar» (cliente, 14 sep 2026). Estaba dicho en la
        /// bajada, entre otras seis cosas, que es donde no se lee.
        titulo="Preinscripción a la oferta de formación gratuita"
        /// SIN NOMBRAR LA CONVOCATORIA, y no es solo estilo:
        /// la regla del proyecto es que en el sitio publico no se
        /// menciona al SENA ni el tipo de formacion. Nombrar la
        /// convocatoria es nombrarlo con otras palabras.
        ///
        /// Lo que si tiene que quedar dicho es lo unico que a
        /// quien llega le hace dudar: que no le van a cobrar.
        subtitulo="Todas las acciones de formación son gratuitas para las personas participantes, son incluyentes y cuentan con certificación. Los cupos son limitados."
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

        {/* PRIMERO EL PERMISO, Y TODO LO DEMAS SE DESPLIEGA
            DEBAJO.
            
            Eran dos pantallas con un boton en medio, y el cliente
            lo zanjo el 14 sep 2026: «tan pronto le check en el
            autorizo que me despliegue automaticamente mas abajo».
            La queja era de fricción -- «la gente ya ve muchos
            pasos previos a meter la informacion»-- y con pauta
            pagada cada paso de mas cuesta dinero.
            
            Lo que NO cambia es el orden: el permiso sigue siendo
            lo primero y no se captura un solo dato antes. Moverlo
            al final, como se propuso en esa misma reunion, seria
            pedir el permiso cuando los datos ya estan tomados. */}
        {pantalla === "habeas" && (
          <>
        <section className="rounded-2xl border border-borde bg-superficie p-6">
          <h2 className="text-lg font-semibold">
            {/* El título sale de la base: lo pone el administrador
                en Habeas Data y se versiona con el texto legal. El
                respaldo es el mismo que se publicó el 11 sep 2026,
                para que una base sin política no enseñe otro
                nombre. */}
            {catalogo.politica?.titulo ??
              "Términos y Condiciones y Autorización para el Tratamiento de Datos Personales"}
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Antes de continuar, por favor confirme que ha leído y aceptado la
            siguiente información.
          </p>

          {/* LA CASILLA VA ARRIBA, ANTES DEL TEXTO.

              «¿La podemos subir? Y reduce un poquito el espacio
              de la ventana para que la gente no sienta que los
              tiene que leer todos» (cliente, 14 sep 2026).

              El texto NO se quita ni se esconde detrás de un
              enlace --eso ya se decidió aquí: «casi nadie abría
              el enlace, y eso no alcanza para sostener que la
              persona leyó lo que autorizó»--. Lo que cambia es
              cuánto ocupa de entrada: se ve el principio, y quien
              quiera lo abre entero. Está a un clic, que es
              distinto de estar en otra página. */}
          <p className="mt-4 rounded-xl border border-borde bg-superficie-alterna px-4 py-3 text-sm leading-relaxed text-texto">
            Para continuar con su proceso de preinscripción, requerimos su
            autorización para el tratamiento de sus datos personales y así poder
            comunicarnos con usted durante las diferentes etapas del proceso.
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

          <div
            className={`mt-4 overflow-y-auto whitespace-pre-line rounded-xl border border-campo-borde bg-campo-fondo p-4 text-sm leading-relaxed text-texto ${
              textoEntero ? "max-h-96" : "max-h-32"
            }`}
          >
            {conEnlaces(catalogo.politica?.contenido ?? TEXTO_DE_RESPALDO)}
          </div>

          <button
            type="button"
            onClick={() => setTextoEntero((v) => !v)}
            className="mt-2 text-sm font-medium text-marca underline underline-offset-2"
          >
            {textoEntero ? "Ver menos" : "Ver el texto completo"}
          </button>

          {/* ESTE PÁRRAFO NO VA EN COLOR SUAVE, y es el único de
              la pantalla del que se puede decir eso sin discutir:
              es el que PIDE la autorización de datos personales.

              Iba en `--texto-suave` sobre `--superficie-alterna`
              y daba 4,26:1 medido, por debajo del 4,5 que pide un
              texto de 14 px. El fallo era el par, no el token:
              el mismo `--texto-suave` sobre `--superficie` da
              4,79:1 y cumple. Pero aquí la salida no es buscar un
              fondo que lo salve: un consentimiento no es texto
              secundario. Va en `--texto`, que es el color de lo
              que hay que leer. */}


        </section>
          </>
        )}

        {/* Pantalla 2. Donde vive y que le interesa, nada
            mas. Pedirle ocho datos personales antes de
            saber si hay algo con cobertura donde vive es
            pedirle trabajo a cambio de nada.

            Sale en la misma pantalla del permiso en cuanto se
            marca la casilla, y tambien sola cuando se vuelve
            aqui desde los datos. */}
        {(pantalla === "eleccion" ||
          (pantalla === "habeas" && datos.aceptaPolitica === "si")) && (
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
            Consulte la oferta de formación según su ubicación de interés
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Seleccione el departamento y la ciudad de su preferencia para
            consultar las acciones de formación disponibles en la zona
            seleccionada.
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
            {/* SIN el contador de «N con cobertura en X».

                Lo quitó el cliente el 11 sep 2026 —«suena muy
                pobre»— y tenía razón: decirle a alguien que en su
                ciudad hay tres cosas es enseñarle lo que NO hay.
                Las tarjetas ya dicen cuántas son, y cuando no hay
                ninguna el aviso de abajo lo explica con palabras. */}
            <h2 className="text-xl font-bold tracking-tight">
              Acciones de formación disponibles
            </h2>

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
          <h2 className="text-lg font-semibold">Datos personales</h2>
          {/* UN SOLO PÁRRAFO, y lo dice el cliente el 11 sep 2026.

              Eran dos renglones seguidos —uno pidiendo los datos y
              otro avisando de que todos hacen falta— y decían lo
              mismo dos veces con distinto peso. Lo que importa se
              conserva: que se enteren ARRIBA de que no hay campos
              opcionales, y no campo a campo, que es como se
              abandona un formulario. */}
          {/* Con COMA y «recuerde» en minúscula: el cliente lo
              corrigió así el 11 sep 2026 —«el punto seguido queda
              más profesional y no tan IA»—. Es su redacción. */}
          <p className="mt-1 text-sm text-texto-suave">
            Para formalizar su preinscripción, complete la siguiente
            información, recuerde que todos los campos son obligatorios para
            avanzar en el proceso.
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

        {/* Pantalla 4. Nada se manda sin pasar por aqui */}
        {pantalla === "revision" && (
          <section className="rounded-2xl border-2 border-marca bg-marca-suave p-6">
            <h2 className="text-lg font-semibold text-marca">
              Antes de enviar, revise que la información sea correcta y esté
              completa.
            </h2>

            {/* EL RECORDATORIO, JUSTO ANTES DE ENVIAR. Lo pidio el
                cliente: quien llega de una pauta no sabe todavia
                si esto le va a costar, y la duda se resuelve
                donde esta a punto de decidir, no en la bajada de
                la primera pantalla. */}
            <p className="mt-3 text-sm font-medium text-marca">
              Recuerde: esta formación es gratuita. No se le va a cobrar nada.
            </p>

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

/// Una accion con cobertura. El area de toque es toda la tarjeta,
/// que en movil importa.
///
/// ENVOLTORIO CON EL BOTON DENTRO, y no la tarjeta entera como
/// boton, desde el 13 sep 2026: el cliente pidio un «Mas
/// informacion» en la fila del codigo, y un boton dentro de otro
/// boton es HTML invalido --y el clic seleccionaria la tarjeta
/// ademas de abrir la ventana--. Asi son dos botones hermanos: el
/// grande elige, el pequenio abre.
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
  const [verInfo, setVerInfo] = useState(false);

  /// Sin ninguno de los tres no hay ventana que abrir, asi que no se
  /// ofrece: son quince acciones y estos textos se escriben a mano.
  const hayInfo = Boolean(
    accion.objetivo?.trim() || accion.contenido?.trim() || accion.competencia?.trim(),
  );

  return (
    <div
      className={`relative flex flex-col rounded-2xl border transition ${
        elegida
          ? "border-2 border-marca bg-superficie"
          : "border-borde bg-superficie hover:border-campo-borde"
      }`}
    >
      {hayInfo && (
        <button
          type="button"
          onClick={() => setVerInfo(true)}
          className="absolute top-4 right-4 z-10 rounded-md px-2 py-0.5 text-xs font-semibold text-marca underline decoration-marca/40 underline-offset-2 transition hover:bg-marca-suave"
        >
          Más información
        </button>
      )}

      {verInfo && (
        <ModalInformacionAccion
          codigo={accion.codigo}
          nombre={accion.nombre}
          modalidad={accion.modalidad}
          horas={accion.horas ?? null}
          ubicacion={oferta.ubicacion}
          objetivo={accion.objetivo}
          contenido={accion.contenido}
          competencia={accion.competencia}
          alCerrar={() => setVerInfo(false)}
        />
      )}

      <button
        type="button"
        onClick={alElegir}
        aria-pressed={elegida}
        className="flex flex-1 flex-col gap-3 p-5 text-left"
      >
        {/* `pr-28` cuando hay boton: sin eso los chips se le meten
            debajo al envolver. */}
        <div
          className={`flex flex-wrap items-center gap-2 ${hayInfo ? "pr-28" : ""}`}
        >
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

        <h3 className="text-base font-semibold leading-snug text-balance">
          {accion.nombre}
        </h3>

        {/* AQUI IBA `accion.resumen`, las dos lineas de la tarjeta.
            Se va con su editor: el cliente quito «Lo que lee quien se
            preinscribe» el 13 sep 2026 y su sitio lo ocupan los tres
            textos de «Mas informacion». El campo sigue en la base y en
            el tipo, con el texto que hubiera guardado. */}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">
          {oferta.tipo === "CIUDAD" && (
            <span className="text-texto-suave">Sede {oferta.ubicacion}</span>
          )}
          {oferta.libres <= 10 && (
            <span className="font-medium text-error">
              Disponibilidad: {oferta.libres} cupos
            </span>
          )}
          {elegida && (
            <span className="ml-auto font-semibold text-marca">Seleccionada</span>
          )}
        </div>
      </button>
    </div>
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
/// SIN TOKEN NO HAY BOTÓN, y ese era el defecto.
///
/// Cuando el documento ya estaba registrado el servidor no emite
/// enlace —lo explica `preinscripcion.service.ts`: ese enlace abre
/// la ficha entera y quien llena el formulario solo ha demostrado
/// saberse una cédula—, pero esta pantalla pintaba el botón igual
/// con el token en `null`. La persona llegaba a
/// `/completar/null`, o sea a «Este enlace ya no sirve», después
/// de haber hecho todo bien. Visto en producción el 11 sep 2026.
///
/// Lo que se le dice en ese caso lo redacta el servidor
/// (`mensaje`), que es el único que sabe si el aviso salió al
/// correo que ya teníamos guardado.
function Registrada({
  token,
  nombre,
  mensaje,
}: {
  token: string | null;
  nombre: string;
  mensaje: string | null;
}) {
  return (
    <>
      <main className="mx-auto w-full max-w-xl px-6 pt-16 pb-8 text-center">
      <BannerLogos centrado />

      <h1 className="mt-8 text-2xl font-bold text-balance">
        {/* El titular saluda y ya: el parrafo de abajo cuenta
            que paso. Antes decia «su preinscripcion fue realizada
            exitosamente» y el parrafo repetia «su preinscripcion
            ha sido registrada» -- dos veces la misma palabra en
            dos renglones seguidos. */}
        ¡Gracias{nombre ? `, ${nombre}` : ""}!
      </h1>
      {/* En USTED, como el resto del formulario.

          El texto vino redactado en tu --«tu preinscripcion»,
          «contigo»-- y todo lo demas trata de usted: «Seleccione»,
          «complete la siguiente informacion», «Su inscripcion».
          Cambiar de voz en la ultima pantalla se nota, y se lee
          como si la hubiera escrito otro.

          Y dice «se pondra en contacto», no «nuestra llamada»: el
          asesor tambien escribe por WhatsApp o por correo, y los
          tres canales estan en el CRM. Prometer una llamada es
          prometer de mas. */}
      {token ? (
        /* Dos párrafos, y el segundo es el que lleva al botón:
           así lo redactó el cliente el 11 sep 2026. */
        <>
          <p className="mt-3 text-texto-suave">
            Su preinscripción ha sido registrada correctamente y está pendiente
            de confirmación. Un asesor se pondrá en contacto con usted para
            continuar el proceso.
          </p>
          <p className="mt-3 text-texto-suave">
            Puede completar sus datos desde ahora para avanzar en su registro o
            esperar nuestra comunicación.
          </p>
        </>
      ) : (
        /* El servidor redacta este: es el único que sabe si el
           aviso salió al correo que ya teníamos guardado. El de
           aquí es el respaldo, por si un día deja de mandarlo. */
        <p className="mt-3 text-texto-suave">
          {mensaje ?? (
            <>
              Ya contamos con un registro asociado a este documento y uno de
              nuestros asesores se pondrá en contacto con usted para continuar el
              proceso.
            </>
          )}
        </p>
      )}

      {token && (
        <a
          href={`/completar/${token}`}
          className="mt-8 inline-block rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto transition hover:bg-marca-fuerte"
        >
          Continuar con mi registro de preinscripción
        </a>
      )}
      </main>
      <FondoPublico />
      <PiePublico />
    </>
  );
}
