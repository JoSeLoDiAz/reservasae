"use client";

/** El formulario público de un convenio: quien quiere que lo contacten. */

/**
 * Las preguntas NO están en este archivo, y esa es la pieza que
 * no se puede perder.
 *
 * Salen de `GET /formularios/:slug` —secciones, preguntas,
 * opciones, obligatoriedad y dependencias— y se editan en el
 * panel, en Formularios. Este componente solo sabe pintar cada
 * tipo de pregunta. Escribir aquí un campo «Nombre» sería
 * arrancarle al panel la única razón por la que existe.
 *
 * Lo que se quitó, que es lo que el dueño seguía viendo: las
 * tarjetas de «Servicios disponibles» con su código, sus horas,
 * su modalidad y su «Disponibilidad limitada»; el desplegable de
 * ciudad con los cupos que quedan; y la pregunta de cuántas
 * personas participarían. Eso es un catálogo de formación, y
 * esto no vende cupos: recoge a quien quiere que lo llamen.
 *
 * Esas tres preguntas siguen EXISTIENDO en la base —son campos
 * núcleo obligatorios para publicar, el panel no deja
 * archivarlas— y por eso no se borran: se dejan de pintar. Ver
 * `ofertaDeRespaldo` más abajo, que es lo que sostiene el envío
 * mientras tanto.
 */

import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api, ErrorApi, type Catalogo, type Reserva } from "@/lib/api";
import { CajaDePolitica, usePolitica } from "@/components/caja-de-politica";
import {
  formularioPublico,
  type FormularioPublico,
  type PreguntaPublica,
} from "@/lib/formularios-api";
import type { PoliticaPublica } from "@/lib/politicas-api";

/** Valor de un campo del formulario. */
type Valor = string | string[] | boolean | number | undefined;

type Estado = "cargando" | "listo" | "enviando" | "hecho" | "no-disponible";

/// Las secciones YA NO son cajas.
///
/// Iban en tarjetas con borde y relleno de 24, y el borde
/// completo se reserva para tres objetos --el campo, el modal
/// y la ficha del tablero-- de los que una seccion no es
/// ninguno. Ahora se separan por 40 px de aire y por una regla
/// de 1 px, y de paso se ve el fondo de trazos: era la unica
/// personalidad que tenia el producto y estaba tapada por dos
/// rectangulos blancos.
const SECCION = "banda-publica";

/// La misma medida de campo que el panel: radio 6, alto 34,
/// letra 13. «Las mismas piezas de datos» no es una frase: un
/// campo que aqui midiera otra cosa haria que las dos mitades
/// del producto no se parezcan.
const CLASE_CONTROL =
  "w-full rounded-plano border border-campo-borde bg-campo-fondo px-3 py-[7px] dato " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco";

/**
 * A qué oferta se cuelga la solicitud, sin preguntárselo.
 *
 * `POST /reservas` todavía exige `ofertaId` y `cuposSolicitados`:
 * nació para apartar cupos. Quitar las preguntas sin resolver
 * los datos rompía el envío, así que la oferta se resuelve aquí
 * —la primera que no esté completa— y no se enseña.
 *
 * **Es un puente, no un diseño.** El día que
 * `backend/src/captacion/` reciba este formulario, la
 * oportunidad nace sin oferta y esta función se borra entera.
 */
function ofertaDeRespaldo(catalogo: Catalogo | null): string | null {
  const ofertas = catalogo?.acciones.flatMap((a) => a.ofertas) ?? [];
  return (ofertas.find((o) => o.estado !== "COMPLETO") ?? ofertas[0])?.id ?? null;
}

export function FormularioReserva({ slug }: { slug: string }) {
  const [formulario, setFormulario] = useState<FormularioPublico | null>(null);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState<string | null>(null);
  const [noExiste, setNoExiste] = useState(false);
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
        setEstado("listo");

        /// El catálogo YA NO decide si el formulario se pinta.
        ///
        /// Antes sí: sin acciones publicadas la pantalla decía
        /// «no hay servicios disponibles» y no dejaba escribir
        /// una línea. Eso tenía sentido cuando esto vendía
        /// cupos; hoy recoge a quien quiere que lo contacten, y
        /// un catálogo vacío no es motivo para cerrarle la
        /// puerta a un interesado.
        const cat = await api.catalogo(definicion.convenio.slug).catch(() => null);
        if (vigente) setCatalogo(cat);
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

  /// TODAS las preguntas, incluidas las que no se pintan.
  ///
  /// Las de catálogo se esconden, pero siguen siendo el destino
  /// de un `dependeDePreguntaId` y siguen mandando su campo
  /// núcleo: si desaparecieran de aquí, una pregunta que
  /// dependa de ellas dejaría de resolverse.
  const todas = useMemo(() => {
    if (!formulario) return [];
    return [...formulario.secciones.flatMap((s) => s.preguntas), ...formulario.sueltas];
  }, [formulario]);

  const porCampo = useMemo(() => {
    const mapa = new Map<string, PreguntaPublica>();
    for (const p of todas) if (p.campoNucleo) mapa.set(p.campoNucleo, p);
    return mapa;
  }, [todas]);

  // secciones, con las sueltas al final
  const bloques = useMemo(() => {
    if (!formulario) return [];
    const conSueltas = formulario.sueltas.length
      ? [
          ...formulario.secciones,
          { id: "__sueltas", titulo: "Otros datos", descripcion: null, preguntas: formulario.sueltas },
        ]
      : formulario.secciones;
    return conSueltas
      // las tres del catálogo —producto, ciudad y cuántas
      // personas— son justo las que llevan `controlEspecial`
      .map((s) => ({ ...s, preguntas: s.preguntas.filter((p) => !p.controlEspecial) }))
      .filter((s) => s.preguntas.length > 0);
  }, [formulario]);

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

    const ofertaId = ofertaDeRespaldo(catalogo);
    if (!ofertaId) {
      setError(
        "No fue posible registrar su solicitud en este momento. " +
          "Escríbanos al correo del pie de página y lo atendemos.",
      );
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
        ofertaId,
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
        /// UNO, siempre, y ya no se pregunta.
        ///
        /// El DTO exige `cuposSolicitados >= 1`. Cuántas
        /// personas participarían es una conversación del
        /// asesor, no un campo de la puerta de entrada.
        cuposSolicitados: 1,
        aceptaTerminos: nucleo("ACEPTA_TERMINOS") === true,
        aceptaPoliticaDatos: nucleo("ACEPTA_POLITICA_DATOS") === true,
        formularioSlug: formulario!.slug,
        respuestas,
      });
      setResultado(reserva);
      setEstado("hecho");
    } catch (e) {
      const fallo = e as ErrorApi;
      /// El 409 del backend habla de cupos —«ya tiene una
      /// reserva de N cupos en esta oferta»— y esa frase no
      /// puede salir en una pantalla que ya no vende cupos. Se
      /// traduce a lo que de verdad significa para quien
      /// escribe: sus datos ya están, no hace falta insistir.
      setError(
        fallo.estado === 409
          ? "Ya tenemos una solicitud registrada con esos datos. Un asesor comercial se comunicará con usted."
          : fallo.message,
      );
      setEstado("listo");
    }
  }

  // el mismo 404 mudo que la raiz, y aqui: dentro del
  // catch se pierde y la pagina se queda cargando
  if (noExiste) notFound();

  if (estado === "cargando") return <p className="secundario">Cargando el formulario…</p>;

  if (estado === "no-disponible") {
    return (
      <div>
        <h2 className="titulo-bloque">El formulario no está disponible</h2>
        <p className="secundario prosa mt-2">
          {error ?? "Vuelva a intentarlo más tarde."}
        </p>
      </div>
    );
  }

  if (estado === "hecho" && resultado) {
    return <Gracias reserva={resultado} mensaje={formulario?.mensajeExito} />;
  }

  return (
    <form onSubmit={enviar}>
      {bloques.map((bloque) => {
        const visibles = bloque.preguntas.filter(visible);
        if (!visibles.length) return null;
        return (
          <section key={bloque.id} className={SECCION}>
            {/* El rótulo en versalita, igual que en el panel.
                Iba a 18 px en peso 600, y el 600 está reservado
                para el estado. */}
            <h2 className="rotulo-bloque">{bloque.titulo}</h2>
            {bloque.descripcion && (
              <p className="secundario prosa mt-1">{bloque.descripcion}</p>
            )}
            <div className="formulario-doble mt-4">
              {visibles.map((pregunta) => (
                <ControlPregunta
                  key={pregunta.id}
                  pregunta={pregunta}
                  valor={valores[pregunta.id]}
                  poner={(v) => poner(pregunta.id, v)}
                  politica={politica}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* El color va en la LETRA: sin caja, sin borde, sin
          fondo. Un rectángulo rojo compite con el formulario en
          vez de señalar el fallo. */}
      {error && (
        <p role="alert" className="aviso-en-linea text-error mt-8">
          {error}
        </p>
      )}

      {/* Sin `opacity-50` al deshabilitarse: el gris no se
          improvisa con opacidad. */}
      <button
        type="submit"
        disabled={estado === "enviando"}
        className="estado rounded-plano sin-aro mt-10 inline-flex h-[40px] items-center justify-center bg-marca px-6 text-marca-texto transition hover:bg-marca-fuerte disabled:cursor-not-allowed disabled:bg-campo-borde disabled:text-texto-suave"
      >
        {estado === "enviando" ? "Enviando…" : "Enviar mis datos"}
      </button>
    </form>
  );
}

// un control por pregunta

function ControlPregunta({
  pregunta,
  valor,
  poner,
  politica,
}: {
  pregunta: PreguntaPublica;
  valor: Valor;
  poner: (valor: Valor) => void;
  politica: PoliticaPublica | null;
}) {
  /// Un párrafo del panel, sin caja.
  ///
  /// Iba dentro de un recuadro gris y se leía como un aviso del
  /// sistema. Es texto que escribió alguien en Formularios: va
  /// como texto.
  if (pregunta.tipo === "PARRAFO") {
    return <p className="secundario prosa a-lo-ancho">{pregunta.etiqueta}</p>;
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
    /// Sin la caja dentro de la caja dentro de la caja.
    ///
    /// Eran tres marcos anidados: el bloque gris con borde, el
    /// texto legal con el suyo y la casilla con el suyo. El
    /// texto legal ya retrocede con su fondo, y la casilla es
    /// una casilla: no necesita un rectangulo alrededor para
    /// que se vea que se pulsa.
    return (
      <div className="a-lo-ancho">
        <CajaDePolitica politica={politica} />
        <label className="dato mt-4 flex cursor-pointer gap-3">
          <input
            type="checkbox"
            required={pregunta.obligatoria}
            checked={valor === true}
            onChange={(e) => poner(e.target.checked)}
            className="accent-[var(--marca)] mt-0.5 size-4 shrink-0"
          />
          <span>
            He leído y acepto lo anterior.
            <span className="secundario mt-0.5 block">
              {pregunta.ayuda ?? pregunta.etiqueta}
            </span>
          </span>
        </label>
      </div>
    );
  }

  if (pregunta.tipo === "CASILLA") {
    return (
      <label className="dato a-lo-ancho flex gap-3">
        <input
          type="checkbox"
          required={pregunta.obligatoria}
          checked={valor === true}
          onChange={(e) => poner(e.target.checked)}
          className="accent-[var(--marca)] mt-0.5 size-4 shrink-0"
        />
        <span>
          {pregunta.etiqueta}
          {pregunta.ayuda && (
            <span className="secundario mt-0.5 block">{pregunta.ayuda}</span>
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
      <fieldset className="a-lo-ancho">
        <legend className="rotulo-bloque mb-2">
          {pregunta.etiqueta}
          {pregunta.obligatoria && <span className="text-texto-suave"> *</span>}
        </legend>
        {pregunta.ayuda && <p className="secundario prosa mb-2">{pregunta.ayuda}</p>}
        <div className="space-y-2">
          {pregunta.opciones.map((o) => (
            <label key={o.id} className="dato flex gap-3">
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
                className="accent-[var(--marca)] mt-0.5 size-4 shrink-0"
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
      <Campo pregunta={pregunta} aLoAncho>
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
        className={`${CLASE_CONTROL} ${ANCHO_NUCLEO[pregunta.campoNucleo ?? ""] ?? ANCHO[pregunta.tipo] ?? ""}`}
      />
    </Campo>
  );
}

/**
 * Un campo mide lo que mide su dato.
 *
 * Se declaran CINCO anchos y no hay un sexto. Iban todos al
 * ancho de la columna, asi que la caja de un NIT y la de un
 * correo median lo mismo y ninguna de las dos decia cuanto se
 * espera que uno escriba.
 */
const ANCHO: Partial<Record<PreguntaPublica["tipo"], string>> = {
  CORREO: "ancho-correo",
  TELEFONO: "ancho-celular",
  FECHA: "ancho-fecha",
  NUMERO: "ancho-documento",
};

/// El NIT es un documento aunque el panel lo declare como
/// texto: quien lo escribe teclea nueve digitos, no una frase.
/// Manda sobre el ancho del tipo.
const ANCHO_NUCLEO: Record<string, string> = {
  EMPRESA_NIT: "ancho-documento",
};

function Campo({
  pregunta,
  children,
  aLoAncho,
}: {
  pregunta: PreguntaPublica;
  children: React.ReactNode;
  /// Ocupa las dos columnas de la rejilla. Para el texto
  /// largo, que partido en media columna no deja escribir.
  aLoAncho?: boolean;
}) {
  return (
    /// El rotulo en versalita y el asterisco en gris.
    ///
    /// Iba en rojo, y `--error` esta reservado para el tiempo
    /// vencido de quien espera respuesta: un campo obligatorio
    /// que todavia no se ha tocado no es un error de nadie.
    <label className={`block ${aLoAncho ? "a-lo-ancho" : ""}`}>
      <span className="rotulo-bloque mb-1.5 block">
        {pregunta.etiqueta}
        {pregunta.obligatoria && <span className="text-texto-suave"> *</span>}
      </span>
      {children}
      {pregunta.ayuda && <span className="secundario mt-1.5 block">{pregunta.ayuda}</span>}
    </label>
  );
}

/**
 * Quedó registrada, y se dice CUÁNDO la contactan.
 *
 * Aquí salían los cupos solicitados, los confirmados, los que
 * quedaban en revisión y el NIT «que es lo único que necesita
 * para consultar o modificar esta solicitud». Eso es la
 * confirmación de una reserva de cupos. Quien acaba de dejar
 * sus datos no reservó nada: espera una llamada.
 *
 * El texto lo puede escribir el panel (`mensajeExito`); lo de
 * abajo es lo que se dice mientras nadie lo escriba.
 */
function Gracias({ reserva, mensaje }: { reserva: Reserva; mensaje?: string | null }) {
  const nombre = reserva.contacto.nombre.trim().split(" ")[0] ?? "";

  return (
    <div className="py-8">
      <h2 className="titulo-publico text-balance">
        Gracias{nombre ? `, ${nombre}` : ""}. Recibimos su solicitud.
      </h2>
      <p className="dato prosa text-texto-suave mt-4">
        {mensaje ??
          "Un asesor comercial se comunicará con usted dentro del siguiente día " +
            "hábil, por el correo o el celular que registró."}
      </p>
    </div>
  );
}
