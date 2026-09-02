"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorApi } from "@/lib/api";
import { juntar, primero, resto } from "@/lib/nombres";
import { preinscripcionApi, type FichaAbierta } from "@/lib/preinscripcion-api";

import { ModalPolitica } from "./modal-politica";
import { FondoPublico } from "./fondo-publico";
import { BannerLogos, ConmutadorTema, PiePublico } from "./marca-publica";

/// Las etiquetas del SEP vienen en mayuscula sostenida --
/// «MUJER CABEZA DE FAMILIA» -- y a una persona no se le
/// pregunta a gritos si es victima del conflicto.
function bonito(t: string): string {
  const minus = t.toLocaleLowerCase("es-CO");
  return minus.charAt(0).toLocaleUpperCase("es-CO") + minus.slice(1);
}

/// Los topes del calendario de la fecha de nacimiento.
///
/// Se calculan al cargar el modulo y no en cada render: por un
/// dia de diferencia no cambia nada, y asi no hay dos valores
/// distintos entre el servidor y el navegador.
const HACE_18 = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
})();
const HACE_100 = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 100);
  return d.toISOString().slice(0, 10);
})();

const CAMPO =
  "w-full rounded-xl border border-campo-borde bg-campo-fondo px-3 py-2.5 text-texto " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco/25";

type Paso = "PERSONA" | "EMPRESA" | "HECHO";

/// Una sola tabla para las tres. Estaba escrito como un
/// ternario en el resumen y como tres botones en el
/// formulario, y las dos listas se desincronizaron en cuanto
/// aparecio la tercera opcion.
const SITUACION_EN_PALABRAS: Record<string, string> = {
  INDEPENDIENTE: "Trabajador independiente",
  EMPRESA: "Trabajador con vínculo laboral",
  DESEMPLEADO: "No está trabajando en este momento",
};

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
  /// El modal de la politica, para quien quiera releerla.
  const [verPolitica, setVerPolitica] = useState(false);
  /// Decide si se pide el NIT de la empresa o la cedula que
  /// hace de RUT. Sin elegir no se muestra ninguno de los dos.
  const [vinculo, setVinculo] = useState<
    "" | "INDEPENDIENTE" | "EMPRESA" | "DESEMPLEADO"
  >("");
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
          /// Sin estas dos, `pide()` devolvía `true` SIEMPRE y
          /// el domicilio se preguntaba aunque ya lo hubiera
          /// dado al reservar el cupo. Es la diferencia entre
          /// «se le pide lo que falta» y «se le vuelve a pedir
          /// todo». Añadir un campo al formulario y no a esta
          /// lista es media función.
          departamentoSepId: tiene("departamentoSepId"),
          municipioSepId: tiene("municipioSepId"),
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
        <FondoPublico />
      <PiePublico />
      </>
    );
  }

  if (!ficha) return <p className="p-10 text-texto-suave">Abriendo su registro…</p>;

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
        /// Va SIEMPRE, aunque el resto del paso no cambie:
        /// es lo que deja el rastro de lo que dijo, y con el
        /// rastro se ve a quien dijo una cosa y luego otra.
        situacionLaboral: vinculo || undefined,
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
  /// El domicilio entra aquí, y hacía falta: se añadió al
  /// formulario y no a esta comprobación, así que se podía
  /// guardar con el municipio vacío — y volver al callejón sin
  /// salida que el campo existe para cerrar. Quien ya lo tenga
  /// lo trae en el estado, así que no le estorba.
  const listoPersona = Boolean(
    persona.fechaNacimiento &&
      persona.estrato &&
      persona.departamentoSepId &&
      persona.municipioSepId &&
      persona.barrio?.trim() &&
      persona.direccion?.trim() &&
      persona.cargoEnEmpresa?.trim() &&
      persona.nivelOcupacionalSepId &&
      persona.beneficiarioPrevio,
  );

  /// Solo se pregunta lo que falta. Si ya lo tiene, no sale.
  const pide = (campo: string) => !yaEstaba?.[campo];

  /// Esta lista es VIVA: cambia según se escribe, y por eso no
  /// puede ser la del servidor, que es una foto al abrir.
  ///
  /// Lo que sí tiene que hacer es cubrir lo mismo. Le faltaban
  /// el departamento y el municipio, así que decía «sus datos
  /// están completos» mientras el panel decía «le falta un
  /// dato» — y el que faltaba era justo uno de esos dos.
  const faltaEnPersona = [
    !persona.fechaNacimiento && "fecha de nacimiento",
    !persona.estrato && "estrato",
    !persona.departamentoSepId && "departamento",
    !persona.municipioSepId && "municipio",
    !persona.barrio?.trim() && "barrio o vereda",
    !persona.direccion?.trim() && "dirección",
    !persona.cargoEnEmpresa?.trim() && "cargo actual",
    !persona.nivelOcupacionalSepId && "nivel ocupacional",
    !persona.beneficiarioPrevio && "si se benefició antes",
  ].filter(Boolean) as string[];

  /// Lo que el SERVIDOR dice que falta y esta pantalla no sabe
  /// preguntar. Vacío casi siempre; cuando no, es un agujero
  /// como el del municipio y hay que verlo, no descubrirlo
  /// meses después porque una ficha no entra al reporte.
  const NO_LO_PREGUNTA_ESTE_ENLACE = ["correo", "celular", "género"];
  const faltaQueNadiePide = (ficha?.faltaDeLaPersona ?? []).filter((f) =>
    NO_LO_PREGUNTA_ESTE_ENLACE.some((n) => f.includes(n)),
  );

  const esPresencial = ficha?.formacion?.modalidad === "PRESENCIAL";

  /// A quien lo nominó una empresa NO se le pregunta su
  /// situación laboral.
  ///
  /// La respuesta ya se sabe: trabaja en la empresa que lo
  /// inscribió, con su NIT y su razón social ya guardados.
  /// Preguntárselo es hacerle escoger entre tres opciones de
  /// las que dos son falsas, y darle la ocasión de escoger la
  /// equivocada y contradecir a su propia empresa.
  ///
  /// De su organización solo se le pide lo que de verdad falta
  /// —y si no falta nada, este paso no existe para él—. Los
  /// datos de una empresa se le piden a la empresa, o los trae
  /// la consulta al RUES por el NIT.
  const loNominoUnaEmpresa = ficha?.empresaFijada === true;
  const faltaDeSuEmpresa = ficha?.faltaDeLaEmpresa ?? [];

  const soloSector = vinculo === "INDEPENDIENTE" && rutPropio === "IGUAL";
  const pideOrganizacion =
    loNominoUnaEmpresa ||
    vinculo === "EMPRESA" ||
    (vinculo === "INDEPENDIENTE" && rutPropio === "DIFERENTE");

  /// El sector se lo preguntamos solo al independiente.
  ///
  /// Al que tiene vinculo laboral se lo trae la consulta al
  /// RUES por el NIT de la empresa, y esa consulta solo corre
  /// para ese caso: el independiente no tiene NIT de empresa
  /// que consultar, asi que si no lo dice el, no lo dice nadie.
  const pideSector = vinculo === "INDEPENDIENTE";

  /// Al que tiene jefe SI se le exigen los tres datos del
  /// jefe.
  ///
  /// Antes eran opcionales -- «el resto lo completa quien
  /// atienda» -- y eso vaciaba el enlace de sentido: se podia
  /// seguir de largo dejandolos en blanco, el enlace se
  /// cerraba como «completado» y la empresa se quedaba con
  /// los tres campos en null. Justo los tres que el enlace
  /// existe para recoger, y nadie se enteraba porque el panel
  /// decia «lo completaron».
  ///
  /// Al independiente no se le exigen aunque se le pregunten:
  /// su unidad economica es el mismo, y obligarlo a nombrar a
  /// su jefe es obligarlo a inventarse a alguien.
  /// Al nominado se le exige lo del jefe solo si de verdad
  /// falta: si la empresa ya lo dio, no se le vuelve a pedir.
  const exigeJefe =
    vinculo === "EMPRESA" ||
    (loNominoUnaEmpresa && faltaDeSuEmpresa.some((f) => f.includes("jefe")));

  /// Lo minimo para poder revisar. El NIT (o el RUT) siempre;
  /// los del jefe, a quien los tiene.
  const listoParaRevisar =
    /// Al que no esta trabajando no se le pide nada mas: ni
    /// NIT, ni sector, ni jefe.
    vinculo === "DESEMPLEADO" ||
    /// Y al nominado cuya empresa ya está completa, tampoco:
    /// no hay nada que llenar en este paso.
    (loNominoUnaEmpresa && faltaDeSuEmpresa.length === 0) ||
    ((!pideSector || Boolean(empresa.sectorEconomico)) &&
    (soloSector || (pideOrganizacion && Boolean(empresa.nit?.trim()))) &&
    (!exigeJefe ||
      (Boolean(empresa.contactoNombre?.trim()) &&
        Boolean(empresa.contactoCargo?.trim()) &&
        Boolean(empresa.contactoCorreo?.trim()))));

  if (paso === "HECHO") {
    return (
      <>
        <main className="mx-auto w-full max-w-lg px-6 py-20 text-center">
        <BannerLogos />
        <h1 className="mt-8 text-2xl font-bold">¡Gracias, {nombre}!</h1>
        {/* NO se prometen horarios ni plataforma, y ya no se
            distingue presencial de virtual.

            Lo que acaba de pasar es que completó su REGISTRO DE
            PREINSCRIPCION, no que quedara inscrito: eso lo cierra
            un asesor. Prometerle la sede o el acceso al aula es
            prometer un cupo que todavia nadie le dio.

            Y no se habla de «quien le atendio»: puede que nadie
            lo haya llamado y lo haya hecho todo por su cuenta. */}
        <p className="mt-3 text-texto-suave">
          Su registro de preinscripción ha sido completado
          satisfactoriamente. Pronto uno de nuestros asesores se
          comunicará con usted para confirmar su inscripción y los pasos a
          seguir.
        </p>
        </main>
        <FondoPublico />
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
          {paso === "PERSONA"
            ? "Formalización de la preinscripción"
            : "Información Laboral"}
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
            { n: 2, texto: "Datos de preinscripción", estado: "ahora" },
            { n: 3, texto: "Preinscripción confirmada", estado: "falta" },
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
          {/* AL QUE YA AUTORIZO se le pliega.
              La regla de arriba —la politica ANTES de pedir
              datos— vale para quien todavia no ha
              autorizado. Este ya lo hizo al reservar, y
              quedo registrado con su version y su fecha.
              Volver a plantarle la muralla de texto no le
              suma ninguna garantia y le empuja fuera de
              pantalla lo unico que vino a hacer, que es
              llenar lo que falta.
              Plegada, no quitada: poder consultarla cuando
              quiera SI es parte de la ley. */}
          {ficha.politica && (
            ficha.yaAutorizo ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-borde bg-superficie px-6 py-4">
                {/* Icono de trazo, no un «✓» de texto: el
                    rediseño pide iconos que tomen el color del
                    tema, y nada de emoji ni caracteres sueltos. */}
                <span className="text-exito">
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8.5 12 2.5 2.5 4.5-5" />
                  </svg>
                </span>
                <span className="text-sm font-medium">
                  {ficha.politica.titulo}
                </span>
                <span className="text-sm text-texto-suave">
                  — la aceptó al reservar su cupo
                </span>
                <button
                  type="button"
                  onClick={() => setVerPolitica(true)}
                  className="ml-auto rounded-lg border border-marca bg-marca-suave px-3 py-1.5 text-xs font-medium text-marca transition hover:bg-marca-suave/70"
                >
                  Volver a leerla
                </button>
              </div>
            ) : (
              <section className="rounded-2xl border border-borde bg-superficie p-6">
                <h2 className="text-lg font-semibold">{ficha.politica.titulo}</h2>
                <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-borde bg-superficie-alterna p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {ficha.politica.contenido}
                </div>
                <p className="mt-3 text-xs text-texto-suave">
                  Versión {ficha.politica.version}
                </p>
              </section>
            )
          )}

          <section className="rounded-2xl border border-borde bg-superficie p-6">
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

            {faltaQueNadiePide.length > 0 && (
              <p className="mt-2 rounded-lg border border-borde px-3 py-2 text-sm text-aviso">
                Falta también <strong>{faltaQueNadiePide.join(", ")}</strong>, y
                eso no se pregunta en este enlace. Escríbanos para completarlo:
                sin ese dato su inscripción queda incompleta.
              </p>
            )}

            {/* nombres, apellidos, celular, correo, genero,
                departamento y municipio ya se dieron al reservar
                el cupo: volver a pedirlos invita a contradecirlos */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pide("fechaNacimiento") && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  Fecha de nacimiento
                </span>
                {/* Acotado por los dos lados.

                    `type="date"` ya deja teclear -- el navegador
                    parte la casilla en dia/mes/ano -- pero el
                    calendario abria en el mes de hoy y para una
                    fecha de nacimiento hay que retroceder cuarenta
                    anos a mano. Con `max` en «hace 18 anos» abre
                    donde toca.

                    Y de paso el limite es el mismo que ya rechaza
                    el servidor: los menores no ingresan. Aqui se
                    dice ANTES en vez de dejar que lo descubra al
                    guardar. */}
                <input
                  type="date"
                  value={persona.fechaNacimiento ?? ""}
                  min={HACE_100}
                  max={HACE_18}
                  onChange={(e) =>
                    setPersona((p) => ({ ...p, fechaNacimiento: e.target.value }))
                  }
                  className={CAMPO}
                />
                <span className="mt-1 block text-xs text-texto-suave">
                  Puede escribirla o elegirla del calendario. La formación
                  admite personas mayores de 18 años.
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

              {/* DONDE VIVE, solo si no lo tenemos.

                  Casi siempre se dio al reservar el cupo y por
                  eso no se pregunta. Pero cuando falta, no
                  preguntarlo era un callejón sin salida: el
                  panel decía «le falta un dato», ofrecía este
                  enlace para arreglarlo, y el enlace no pedía
                  ese dato. Generar otro no cambiaba nada.

                  Y SALE SIEMPRE QUE SE PIDA EL MUNICIPIO, aunque
                  ya lo sepamos.

                  Antes solo se pintaba si faltaba, así que el
                  municipio salía SOLO, filtrado por un
                  departamento que la persona no veía: elegir la
                  ciudad de una lista sin saber de qué
                  departamento sale es adivinar. Va relleno y
                  editable — es SU domicilio y puede corregirlo,
                  que es justo para lo que existe este enlace. */}
              {/* SIEMPRE, aunque ya haya valor.

                  Lo que trae guardado NO es una afirmacion suya
                  sobre donde vive: es lo que eligio en el
                  formulario para ver que cursos hay con cobertura
                  ahi. Alguien de Bogota que quiera estudiar en
                  Santander llegaba aqui con «Santander» puesto y,
                  si no se le preguntaba, se reportaba al SENA como
                  residente en Santander.

                  Asi que se pregunta y se ofrece relleno: si
                  coincide, un clic; si no, lo corrige. Es la
                  diferencia entre suponer y preguntar. */}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">
                    Departamento de residencia
                  </span>
                  <select
                    value={persona.departamentoSepId ?? ""}
                    onChange={(e) =>
                      // cambiar de departamento invalida el municipio
                      setPersona((p) => ({
                        ...p,
                        departamentoSepId: e.target.value,
                        municipioSepId: "",
                      }))
                    }
                    className={CAMPO}
                  >
                    <option value="">Seleccione…</option>
                    {(ficha?.departamentos ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.etiqueta}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-texto-suave">
                    Su domicilio, no la sede donde se dicta.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">
                    Municipio de residencia
                  </span>
                  <select
                    value={persona.municipioSepId ?? ""}
                    onChange={(e) =>
                      setPersona((p) => ({ ...p, municipioSepId: e.target.value }))
                    }
                    disabled={!persona.departamentoSepId}
                    className={CAMPO}
                  >
                    <option value="">
                      {persona.departamentoSepId
                        ? "Seleccione…"
                        : "Elija primero el departamento"}
                    </option>
                    {municipios.map((m) => (
                      <option key={m[0]} value={m[0]}>
                        {m[2]}
                      </option>
                    ))}
                  </select>
                </label>

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
          <section className="rounded-2xl border border-borde bg-superficie p-6">
            <h2 className="text-lg font-semibold">Población vulnerable</h2>
            <p className="mt-1 text-sm leading-relaxed text-texto-suave">
              Si alguna de estas condiciones es la suya, escríbala y
              elíjala; es <strong>una sola</strong>, la que mejor lo describa.
              Y si prefiere no decirlo, marque «prefiero no responder» o
              escriba «ninguna»: no cambia en nada su preinscripción ni su
              cupo.
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
                <BuscadorDeCaracterizacion
                  opciones={ficha.caracterizaciones}
                  elegida={caracterizaciones[0] ?? null}
                  alElegir={(id) => setCaracterizaciones(id === null ? [] : [id])}
                />
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

          {/* Por qué está gris, AL LADO del botón.

              «Falta: cargo actual» sale arriba del todo, y con
              el formulario largo queda fuera de pantalla: se ve
              un botón apagado y nada más. Un botón deshabilitado
              que no dice qué le falta se lee como un sistema
              roto, no como un formulario incompleto. */}
          {!listoPersona && faltaEnPersona.length > 0 && (
            <p className="mb-3 text-center text-sm text-aviso">
              Para seguir falta: <strong>{faltaEnPersona.join(", ")}</strong>.
            </p>
          )}

          <button
            type="submit"
            disabled={guardando || !listoPersona}
            className="w-full rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
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
          <section className="rounded-2xl border border-borde bg-superficie p-6">
            {/* AL NOMINADO no se le pregunta: ya se sabe.
                Lo inscribió su empresa, con NIT y razón social
                guardados. Ofrecerle tres opciones de las que
                dos son falsas solo le da la ocasión de escoger
                la equivocada y contradecir a su empresa. */}
            {loNominoUnaEmpresa ? (
              <div className="rounded-xl border border-borde bg-superficie-alterna p-4">
                <p className="text-sm">
                  Lo inscribió <strong>{ficha.empresa}</strong>.
                </p>
                <p className="mt-1 text-sm text-texto-suave">
                  {faltaDeSuEmpresa.length === 0
                    ? "Ya tenemos los datos de su organización. No hay nada que preguntarle aquí."
                    : `Solo nos falta ${faltaDeSuEmpresa.join(", ")}. Lo demás ya lo tenemos.`}
                </p>
              </div>
            ) : (
              <>
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

              {/* La tercera. Va con las otras dos y no
                  escondida en un «ninguna de las
                  anteriores»: quien no tiene trabajo no es
                  un caso raro del formulario, y el SENA
                  forma sobre todo a quien no lo tiene. */}
              <button
                type="button"
                onClick={() => {
                  setVinculo("DESEMPLEADO");
                  setRutPropio("");
                }}
                className={`rounded-xl border p-4 text-left font-semibold transition sm:col-span-2 ${
                  vinculo === "DESEMPLEADO"
                    ? "border-2 border-marca bg-marca-suave text-marca"
                    : "border-campo-borde bg-superficie hover:bg-superficie-alterna"
                }`}
              >
                No estoy trabajando en este momento
              </button>
            </div>

            {/* Se le agradece y se acaba: no hay empresa que
                preguntarle. Sin esto caia en la rama del NIT
                y se le pedian los datos de un trabajo que no
                tiene. */}
            {vinculo === "DESEMPLEADO" && (
              <div className="mb-5 rounded-xl border border-marca bg-marca-suave p-5">
                <p className="font-semibold text-marca">
                  Gracias, con eso es suficiente.
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  No tenemos que preguntarle nada más de trabajo. Puede
                  confirmar su inscripción con el botón de abajo.
                </p>
              </div>
            )}

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
              </>
            )}

            {pideOrganizacion && !loNominoUnaEmpresa && (
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
                    digito={empresa.digitoVerificacion ?? ""}
                    razonSocial={empresa.razonSocial}
                    esRut={vinculo === "INDEPENDIENTE"}
                    alCambiarDigito={(digitoVerificacion) =>
                      setEmpresa((e) => ({ ...e, digitoVerificacion }))
                    }
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
                    requerido={exigeJefe}
                  />
                </div>
                <Campo
                  etiqueta="Cargo del jefe directo o persona de contacto"
                  campo="contactoCargo"
                  valores={empresa}
                  set={setEmpresa}
                  requerido={exigeJefe}
                />
                <Campo
                  etiqueta="Correo electrónico del jefe directo o contacto"
                  campo="contactoCorreo"
                  valores={empresa}
                  set={setEmpresa}
                  tipo="email"
                  requerido={exigeJefe}
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
                  className="rounded-xl bg-marca px-6 py-3 font-medium text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
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
                {/* Un ternario de dos ramas para TRES
                    opciones enseñaba «Trabajador
                    independiente» a quien acababa de marcar
                    «no estoy trabajando». El resumen existe
                    para que la persona confirme lo que dijo:
                    si le enseña otra cosa, la hace confirmar
                    algo que no eligió. */}
                <FilaResumen
                  etiqueta="Situación laboral"
                  valor={SITUACION_EN_PALABRAS[vinculo] ?? null}
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
                  className="rounded-xl bg-marca px-7 py-3.5 font-medium text-marca-texto transition hover:bg-marca-fuerte disabled:opacity-50"
                >
                  {guardando ? "Enviando…" : "Está correcto, confirmar preinscripción"}
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
            Finalice su registro de preinscripción presionando el botón de confirmación.
          </p>
        </form>
      )}
      </main>
      <FondoPublico />
      <PiePublico />

      {/* Fuera del <main> a proposito: flota sobre la pantalla,
          no es contenido de la pagina. */}
      {verPolitica && ficha.politica && (
        <ModalPolitica
          titulo={ficha.politica.titulo}
          contenido={ficha.politica.contenido}
          version={ficha.politica.version}
          alCerrar={() => setVerPolitica(false)}
        />
      )}
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
  digito,
  razonSocial,
  alCambiar,
  alCambiarDigito,
  esRut,
}: {
  nit: string;
  /// El dígito de verificación, APARTE.
  ///
  /// Iba dentro del mismo campo y no se guardaba: el modelo tiene
  /// `digitoVerificacion` en su propia columna y el DTO ya lo
  /// admitía, así que se perdía en la pantalla y en ningún otro
  /// sitio. Y no es cosmético: en el F7 el NIT va sin dígito, y
  /// un `899999034-1` metido en la columna del NIT no cuadra con
  /// ningún registro del SENA.
  digito: string;
  razonSocial: string;
  alCambiar: (nit: string, razonSocial: string) => void;
  alCambiarDigito: (digito: string) => void;
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
      /// El RUES lo calcula, así que se rellena solo y la persona
      /// no tiene que saberse el suyo. Queda editable: si el
      /// nuestro discrepa del que tiene en su papel, manda el
      /// suyo.
      if (r.digitoVerificacion) alCambiarDigito(r.digitoVerificacion);
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
      <div className="flex gap-3">
        <label className="block flex-1">
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
            {buscando ? "Buscando…" : "Sin puntos ni guion, y sin el dígito."}
          </span>
        </label>

        {/* Su propio campo, estrecho porque es UN dígito.

            Antes no existía: el NIT y el dígito iban juntos en una
            sola casilla y el dígito se perdía. */}
        <label className="block w-24 shrink-0">
          {/* «DV» y no «Dígito»: es como lo llama todo el mundo en
              Colombia y es lo que dice el RUT. */}
          <span className="mb-1.5 block text-sm font-medium">DV</span>
          <input
            value={digito}
            inputMode="numeric"
            maxLength={1}
            onChange={(e) => alCambiarDigito(e.target.value.replace(/\D/g, ""))}
            className={CAMPO}
          />
          <span className="mt-1 block text-xs text-texto-suave">
            Dígito de verificación, el de después del guion.
          </span>
        </label>
      </div>

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
        ) : encontradas?.length === 1 && !aMano ? (
          /* LO TRAJO EL REGISTRO, y se dice.

             Antes se pintaba en un campo normal, indistinguible
             de lo que uno escribe. Es editable --siempre lo fue--
             pero no lo parecia, asi que quien veia un nombre que
             no es el suyo daba por hecho que no se podia tocar.

             Ahora se ve de donde viene y hay un boton para
             corregirlo. El registro orienta; la persona decide. */
          <>
            <div className="flex items-center gap-3 rounded-lg border border-borde bg-superficie-alterna px-3 py-2.5">
              <span className="min-w-0 flex-1 text-sm font-medium">
                {razonSocial}
              </span>
              <button
                type="button"
                onClick={() => setAMano(true)}
                className="shrink-0 rounded-lg border border-marca bg-marca-suave px-3 py-1.5 text-xs font-medium text-marca"
              >
                Cambiar
              </button>
            </div>
            <span className="mt-1 block text-xs text-texto-suave">
              Así aparece en el registro de comercio. Si no es correcto,
              cámbielo.
            </span>
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
            Ese NIT ampara a {encontradas.length} organizaciones. Elija la suya o
            escríbala.
          </span>
        )}
      </label>
    </>
  );
}

/**
 * La caracterización del SEP: se escribe y van saliendo.
 *
 * Son treinta y siete y en una rejilla de casillas no se
 * encuentra ninguna: hay que leerlas todas para dar con la
 * suya, y están escritas en el idioma del SEP —«SOBREVIVIENTES
 * MINAS ANTIPERSONALES»—, no en el de la persona.
 *
 * Escribiendo se llega en dos letras. Y es UNA SOLA: el
 * formulario anterior dejaba marcar varias, que al SENA le
 * llega como un solo código de todas formas.
 */
function BuscadorDeCaracterizacion({
  opciones,
  elegida,
  alElegir,
}: {
  opciones: Array<{ id: number; etiqueta: string }>;
  elegida: number | null;
  alElegir: (id: number | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [abierto, setAbierto] = useState(false);

  const laElegida = opciones.find((o) => o.id === elegida) ?? null;

  /// Sin tildes y en minúscula por los dos lados: quien
  /// escribe «indigena» tiene que encontrar «INDÍGENA», y en
  /// un teclado de celular la tilde no se pone.
  const pelado = (t: string) =>
    t
      .toLocaleLowerCase("es-CO")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  const filtradas = busca.trim()
    ? opciones.filter((o) => pelado(o.etiqueta).includes(pelado(busca)))
    : opciones;

  if (laElegida) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-marca bg-marca-suave p-4">
        <span className="text-sm font-medium text-marca">
          {bonito(laElegida.etiqueta)}
        </span>
        <button
          type="button"
          onClick={() => {
            alElegir(null);
            setBusca("");
            setAbierto(true);
          }}
          className="ml-auto text-xs text-marca underline"
        >
          Cambiarla
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <input
        type="text"
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        placeholder="Escriba para buscar: madre, desplazado, discapacidad…"
        className={CAMPO}
      />

      {abierto && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-borde">
          {filtradas.length === 0 ? (
            <p className="p-3 text-sm text-texto-suave">
              Nada con «{busca}». Pruebe con otra palabra, o siga sin
              contestar.
            </p>
          ) : (
            filtradas.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  alElegir(o.id);
                  setAbierto(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm transition hover:bg-superficie-alterna"
              >
                {bonito(o.etiqueta)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
