"use client";

/** La puerta de entrada: alguien deja sus datos para que lo llamen. */

/**
 * Esto NO es un catálogo, y ese era el problema.
 *
 * Delante iba «Servicios disponibles» —tarjetas con el código
 * AF1, las horas, la modalidad y «Disponibilidad limitada»— y
 * encima un selector de departamento y ciudad «para consultar
 * los servicios disponibles». Eso es el trámite del SEP metido
 * en la primera pantalla que ve un desconocido: le pedía elegir
 * de una lista antes de dejarlo hablar, y le prometía cupos.
 *
 * Quien llega aquí es un gerente de recursos humanos o un
 * profesional comparando proveedores. No viene a apuntarse a
 * nada: viene a dejar sus datos para que alguien lo contacte.
 * Así que lo único que se le pide es lo que hace falta para
 * poder responderle —cómo se llama, con qué documento, por
 * dónde se le escribe— y la constancia de que autorizó el
 * tratamiento de sus datos. Al enviarlo nace la oportunidad.
 *
 * El título y el subtítulo NO están aquí: los pinta
 * `EncabezadoPublico` desde la marca, que se edita en el panel.
 *
 * LA DIRECCIÓN VISUAL, aquí dentro. Es la única pantalla que ve
 * alguien de fuera, así que lleva más aire que el panel —no es
 * una cabina de trabajo—, pero la misma tipografía, el mismo
 * acento y las mismas piezas de datos:
 *
 * - **Sin cajas.** Las dos secciones iban en tarjetas con borde
 *   y relleno de 24. El borde completo se reserva para tres
 *   objetos —el campo, el modal y la ficha del tablero— y una
 *   sección no es ninguno. Ahora se separan por 40 px de aire y
 *   por una regla de 1 px, que además deja ver el fondo de
 *   trazos: la única personalidad que tenía el producto estaba
 *   tapada por dos rectángulos blancos.
 * - **Un campo mide lo que mide su dato.** Documento 160,
 *   celular 180, nombre 320, correo 360. Iban todos a la mitad
 *   del ancho de la columna, así que la caja del documento y la
 *   del correo medían lo mismo.
 * - **El rótulo va en versalita**, igual que en el panel.
 */

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import { conEnlaces, TEXTO_DE_RESPALDO } from "@/components/caja-de-politica";
import { ErrorApi } from "@/lib/api";
import { primero, resto } from "@/lib/nombres";
import {
  preinscripcionApi,
  type CatalogoPreinscripcion,
} from "@/lib/preinscripcion-api";

import { FondoPublico } from "./fondo-publico";
import { BannerLogos, EncabezadoPublico, PiePublico } from "./marca-publica";

/// El único id del catálogo del SEP que la pantalla necesita
/// saberse: la cédula no lleva letras, y el resto sí.
const DOCUMENTO_CEDULA = 1;

/// La misma medida de campo que el panel: radio 6, alto 34,
/// letra 13. «Las mismas piezas de datos» no es una frase: un
/// campo que aquí midiera otra cosa haría que las dos mitades
/// del producto no se parezcan.
const CAMPO =
  "w-full rounded-plano border border-campo-borde bg-campo-fondo px-3 py-[7px] dato " +
  "outline-none transition focus:border-campo-foco focus:ring-2 focus:ring-campo-foco";

/// El botón principal, en el azul de marca. Sin `opacity-50`
/// al deshabilitarse: el gris no se improvisa con opacidad,
/// que es de donde salía el aspecto lavado.
const BOTON =
  "estado rounded-plano sin-aro inline-flex h-[40px] items-center justify-center bg-marca px-6 " +
  "text-marca-texto transition hover:bg-marca-fuerte " +
  "disabled:cursor-not-allowed disabled:bg-campo-borde disabled:text-texto-suave";

/**
 * A qué oferta se cuelga la solicitud, sin preguntárselo.
 *
 * `POST /preinscripcion/:slug` todavía exige `ofertaId`: nació
 * para apartar un cupo en una acción de formación. Quitar la
 * pregunta sin resolver el dato rompía el envío, así que se
 * resuelve aquí —la primera oferta abierta del convenio— y no
 * se enseña: quien escribe no eligió nada y no se le va a
 * decir que sí.
 *
 * **Es un puente, no un diseño.** El día que
 * `backend/src/captacion/` reciba este formulario, la
 * oportunidad nace sin oferta y esta función se borra entera.
 */
function ofertaDelConvenio(catalogo: CatalogoPreinscripcion | null): string | null {
  const ofertas = catalogo?.acciones.flatMap((a) => a.ofertas) ?? [];
  return (ofertas.find((o) => o.libres > 0) ?? ofertas[0])?.id ?? null;
}

export function PreinscripcionPublica({ slug }: { slug: string }) {
  const [catalogo, setCatalogo] = useState<CatalogoPreinscripcion | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<{ nombre: string; mensaje?: string } | null>(null);

  const [datos, setDatos] = useState({
    nombres: "",
    primerApellido: "",
    segundoApellido: "",
    tipoDocumentoSepId: "",
    numeroDocumento: "",
    celular: "",
    correo: "",
    aceptaPolitica: false,
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
  if (hecho) return <Gracias nombre={hecho.nombre} mensaje={hecho.mensaje} />;

  /// Sin catálogo no hay tipos de documento ni política que
  /// enseñar. Y si la carga falló se dice, en vez de dejar el
  /// «Cargando…» puesto para siempre.
  if (!catalogo) {
    return (
      <p className={`p-10 ${error ? "aviso-en-linea text-titulo" : "secundario"}`}>
        {error ?? "Cargando…"}
      </p>
    );
  }

  function cambiar(campo: keyof typeof datos, valor: string | boolean) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  const esCedula = Number(datos.tipoDocumentoSepId) === DOCUMENTO_CEDULA;
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo.trim());

  /// Lo que falta, con nombre. Un botón apagado sin decir por
  /// qué es lo que hace que la gente cierre la pestaña.
  const falta = [
    !datos.nombres.trim() && "nombres",
    !datos.primerApellido.trim() && "primer apellido",
    !datos.tipoDocumentoSepId && "tipo de documento",
    !datos.numeroDocumento.trim() && "número de documento",
    datos.celular.length !== 10 &&
      (datos.celular ? "el celular completo, 10 dígitos" : "celular"),
    !correoValido && (datos.correo.trim() ? "un correo válido" : "correo electrónico"),
    !datos.aceptaPolitica && "autorizar el tratamiento de datos",
  ].filter(Boolean) as string[];

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    const ofertaId = ofertaDelConvenio(catalogo);
    if (!ofertaId) {
      setError(
        "No fue posible registrar su solicitud en este momento. " +
          "Vuelva a intentarlo en unos minutos.",
      );
      return;
    }

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
        celular: datos.celular,
        correo: datos.correo,
        // sin esto la autorización se quedaba en la pantalla: se
        // marcaba la casilla y no quedaba constancia de nada,
        // que es justo lo que hay que poder demostrar
        aceptaPolitica: datos.aceptaPolitica,
      });
      setHecho({ nombre: primero(datos.nombres), mensaje: r.mensaje });
    } catch (err) {
      setError((err as ErrorApi).message);
      setEnviando(false);
    }
  }

  return (
    <>
      {/* 720 px y no 768: es el mismo tope que el formulario del
          panel. El aire de la pública se da en vertical, no
          ensanchando la columna. */}
      <main className="mx-auto w-full max-w-[720px] px-6 py-12">
        <EncabezadoPublico />

        <form onSubmit={enviar} className="mt-8">
          <section className="banda-publica">
            <h2 className="rotulo-bloque">Sus datos</h2>

            <div className="formulario-doble mt-4">
              <Texto
                etiqueta="Nombres"
                valor={datos.nombres}
                alCambiar={(v) => cambiar("nombres", v)}
                requerido
                ancho="ancho-nombre"
              />

              <Texto
                etiqueta="Primer apellido"
                valor={datos.primerApellido}
                alCambiar={(v) => cambiar("primerApellido", v)}
                requerido
                ancho="ancho-nombre"
              />
              <Texto
                etiqueta="Segundo apellido"
                valor={datos.segundoApellido}
                alCambiar={(v) => cambiar("segundoApellido", v)}
                ancho="ancho-nombre"
              />

              <label className="block">
                <span className="rotulo-bloque mb-1.5 block">Tipo de documento</span>
                <select
                  required
                  value={datos.tipoDocumentoSepId}
                  onChange={(e) => {
                    cambiar("tipoDocumentoSepId", e.target.value);
                    // cambiar de tipo cambia lo que se admite:
                    // dejar lo tecleado deja un número inválido
                    cambiar("numeroDocumento", "");
                  }}
                  className={CAMPO + " ancho-nombre"}
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
                ancho="ancho-documento"
              />

              <Texto
                etiqueta="Celular"
                valor={datos.celular}
                alCambiar={(v) => cambiar("celular", v)}
                tipo="tel"
                requerido
                soloDigitos
                maximo={10}
                ancho="ancho-celular"
              />
              <Texto
                etiqueta="Correo electrónico"
                valor={datos.correo}
                alCambiar={(v) => cambiar("correo", v)}
                tipo="email"
                requerido
                ancho="ancho-correo"
              />
            </div>
          </section>

          {/* El texto entero y no un enlace: casi nadie abre el
              enlace, y una casilla junto a algo ilegible no
              sostiene que la persona leyó lo que autorizó. */}
          <section className="banda-publica">
            <h2 className="rotulo-bloque">
              {catalogo.politica?.titulo ?? "Tratamiento de datos personales"}
            </h2>

            {/* El único sub-bloque del producto que retrocede
                sobre `--superficie-alterna`, y está nombrado
                así en la dirección: el texto legal dentro del
                formulario público. Sin borde: el fondo ya dice
                que es otra cosa. */}
            <div className="texto-legal dato prosa mt-4">
              {conEnlaces(catalogo.politica?.contenido ?? TEXTO_DE_RESPALDO)}
            </div>

            <label className="dato mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={datos.aceptaPolitica}
                onChange={(e) => cambiar("aceptaPolitica", e.target.checked)}
                className="accent-[var(--marca)] mt-0.5 size-4 shrink-0"
              />
              <span>
                He leído y <strong className="font-bold">autorizo</strong> el
                tratamiento de mis datos personales en los términos anteriores.
              </span>
            </label>
          </section>

          {/* El color va en la LETRA: sin caja, sin borde, sin
              fondo. Un rectángulo rojo aquí compite con el
              formulario en vez de señalar el fallo. */}
          {error && (
            <p role="alert" className="aviso-en-linea text-error mt-8">
              {error}
            </p>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={enviando || falta.length > 0}
              className={BOTON}
            >
              {enviando ? "Enviando…" : "Enviar mis datos"}
            </button>

            {falta.length > 0 && (
              <p className="secundario prosa">
                Falta <span className="text-texto">{falta.join(", ")}</span>.
              </p>
            )}
          </div>
        </form>
      </main>
      <FondoPublico />
      <PiePublico />
    </>
  );
}

/**
 * Quedó registrada, y se dice CUÁNDO la llaman.
 *
 * «Gracias, su solicitud fue enviada» y punto deja a la persona
 * sin saber si tiene que hacer algo más. Lo que sigue no está en
 * sus manos, así que se dice quién mueve y en cuánto.
 *
 * Y se dice «se comunicará», no «lo llamaremos»: el asesor
 * también escribe por WhatsApp o por correo, y los tres canales
 * están en el CRM. Prometer una llamada es prometer de más.
 */
function Gracias({ nombre, mensaje }: { nombre: string; mensaje?: string }) {
  return (
    <>
      <main className="mx-auto w-full max-w-[720px] px-6 py-16">
        <BannerLogos />

        <h1 className="titulo-publico mt-10 text-balance">
          Gracias{nombre ? `, ${nombre}` : ""}. Recibimos su solicitud.
        </h1>
        <p className="dato prosa text-texto-suave mt-4">
          {mensaje ??
            "Un asesor comercial se comunicará con usted dentro del siguiente día " +
              "hábil, por el correo o el celular que registró."}
        </p>
      </main>
      <FondoPublico />
      <PiePublico />
    </>
  );
}

function Texto({
  etiqueta,
  valor,
  alCambiar,
  requerido,
  tipo = "text",
  maximo,
  soloDigitos,
  deshabilitado,
  ancho,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  requerido?: boolean;
  tipo?: string;
  maximo?: number;
  soloDigitos?: boolean;
  deshabilitado?: boolean;
  /// Uno de los cinco anchos declarados. No hay un sexto.
  ancho?: string;
}) {
  return (
    <label className="block">
      <span className="rotulo-bloque mb-1.5 block">
        {etiqueta}
        {!requerido && <span className="text-texto-suave"> (opcional)</span>}
      </span>
      <input
        type={tipo}
        required={requerido}
        disabled={deshabilitado}
        value={valor}
        maxLength={maximo}
        // el teclado numérico en el móvil, sin usar type=number:
        // ese come los ceros de la izquierda
        inputMode={soloDigitos ? "numeric" : undefined}
        onChange={(e) => {
          const v = soloDigitos ? e.target.value.replace(/\D/g, "") : e.target.value;
          alCambiar(maximo ? v.slice(0, maximo) : v);
        }}
        className={
          CAMPO +
          (ancho ? ` ${ancho}` : "") +
          // deshabilitado se dice con el fondo, no con opacidad
          (deshabilitado ? " bg-superficie-alterna text-texto-suave" : "")
        }
      />
    </label>
  );
}
