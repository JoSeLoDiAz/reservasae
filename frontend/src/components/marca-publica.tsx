"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { FirmaConvoca, PieDeConvoca } from "@/components/firma-convoca";
import { urlLogo, type Marca } from "@/lib/admin-api";
import {
  ambitoDeRuta,
  ID_ESTILO_CACHE,
  recordarPaleta,
  rutaDeMarca,
} from "@/lib/marca";
import {
  aplicarEsquema,
  esquemaDelSistema,
  LLAVE_MODO,
  resolverEsquema,
  type Esquema,
  type ModoElegido,
} from "@/lib/tema";

type ValorContexto = {
  marca: Marca | null;
  modo: ModoElegido;
  esquema: Esquema;
  cambiarModo: (modo: ModoElegido) => void;
  /** Vuelve a leer la marca. */
  recargar: () => Promise<void>;
};

const ContextoMarca = createContext<ValorContexto | null>(null);

export function useMarca(): ValorContexto {
  const valor = useContext(ContextoMarca);
  if (!valor) throw new Error("useMarca fuera del proveedor.");
  return valor;
}

function leerModoGuardado(): ModoElegido {
  if (typeof window === "undefined") return "sistema";
  const guardado = window.localStorage.getItem(LLAVE_MODO);
  return guardado === "claro" || guardado === "oscuro" ? guardado : "sistema";
}

/** Aplica colores y textos de la marca del ambito. */
export function ProveedorMarca({ children }: { children: React.ReactNode }) {
  const [marca, setMarca] = useState<Marca | null>(null);
  const [modo, setModo] = useState<ModoElegido>("sistema");
  const [esquema, setEsquema] = useState<Esquema>("CLARO");

  // el modo guardado solo existe en el navegador
  useEffect(() => {
    const guardado = leerModoGuardado();
    setModo(guardado);
    setEsquema(resolverEsquema(guardado));
  }, []);

  // el primer segmento es el slug
  const ruta = usePathname();
  const ambito = useMemo(() => ambitoDeRuta(ruta ?? "/"), [ruta]);

  const recargar = useCallback(async () => {
    try {
      const respuesta = await fetch(rutaDeMarca(ambito));
      if (!respuesta.ok) return;
      const datos = (await respuesta.json()) as Marca;
      setMarca(datos);
      recordarPaleta(ambito, datos);
    } catch {
      // que falle la marca no puede tumbar el formulario
    }
  }, [ambito]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  // el defecto del admin solo manda si nadie eligio
  useEffect(() => {
    if (!marca || leerModoGuardado() !== "sistema") return;
    if (marca.modoPorDefecto === "SISTEMA") return;
    const forzado = marca.modoPorDefecto === "OSCURO" ? "OSCURO" : "CLARO";
    setEsquema(forzado);
  }, [marca]);

  // seguir al sistema en vivo
  useEffect(() => {
    if (modo !== "sistema") return;
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => setEsquema(esquemaDelSistema());
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, [modo]);

  useEffect(() => {
    aplicarEsquema(esquema);
  }, [esquema]);

  // hoja con los dos esquemas: conmutar no pide nada
  const estilos = useMemo(() => {
    if (!marca?.temas || !marca.catalogoColores) return "";

    // segunda barrera: esto acaba en un <style>
    const hexadecimal = /^#[0-9a-fA-F]{3,8}$/;

    return (["CLARO", "OSCURO"] as const)
      .map((nombre) => {
        const colores = marca.temas[nombre];
        if (!colores) return "";
        const lineas = marca.catalogoColores.tokens
          .filter((token) => hexadecimal.test(colores[token.clave] ?? ""))
          .map((token) => `${token.variableCss}:${colores[token.clave]};`)
          .join("");
        return lineas ? `:root[data-tema="${nombre.toLowerCase()}"]{${lineas}}` : "";
      })
      .join("");
  }, [marca]);

  useEffect(() => {
    if (marca?.nombreApp) document.title = marca.nombreApp;
  }, [marca]);

  // ya hay hoja real: sobra la cacheada del <head>
  useEffect(() => {
    if (estilos) document.getElementById(ID_ESTILO_CACHE)?.remove();
  }, [estilos]);

  const cambiarModo = useCallback((nuevo: ModoElegido) => {
    setModo(nuevo);
    setEsquema(resolverEsquema(nuevo));
    try {
      window.localStorage.setItem(LLAVE_MODO, nuevo);
    } catch {
      // en privado localStorage puede fallar
    }
  }, []);

  return (
    <ContextoMarca.Provider value={{ marca, modo, esquema, cambiarModo, recargar }}>
      {estilos && <style dangerouslySetInnerHTML={{ __html: estilos }} />}
      {children}
    </ContextoMarca.Provider>
  );
}

// conmutador de tema

const OPCIONES: Array<{ valor: ModoElegido; etiqueta: string; icono: React.ReactNode }> = [
  { valor: "claro", etiqueta: "Claro", icono: <IconoSol /> },
  { valor: "oscuro", etiqueta: "Oscuro", icono: <IconoLuna /> },
  { valor: "sistema", etiqueta: "Automático", icono: <IconoSistema /> },
];

export function ConmutadorTema({ compacto = false }: { compacto?: boolean }) {
  const { marca, modo, cambiarModo } = useMarca();

  // el admin puede apagar el conmutador
  if (marca && !marca.permitirCambioDeModo) return null;

  return (
    <div
      role="group"
      aria-label="Tema de la interfaz"
      className="inline-flex rounded-lg border border-borde bg-superficie p-0.5"
    >
      {OPCIONES.map((opcion) => {
        const activa = modo === opcion.valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => cambiarModo(opcion.valor)}
            /// Pulsar con el ratón NO da el foco. Y esa es la
            /// única línea que de verdad importa aquí.
            ///
            /// Cuando un botón recibe el foco, el navegador lo
            /// desplaza a la vista — y recorre TODOS sus
            /// contenedores desplazables, no solo el primero.
            /// En el panel este botón es el último control de
            /// la barra lateral, o sea el que más abajo cae, y
            /// desde ahí ese desplazamiento descuadraba la
            /// pantalla entera: cabecera recortada, barra a
            /// media altura, franja en blanco al final. Sin
            /// forma de devolverla salvo recargando.
            ///
            /// Se intentó atajar dos veces por el lado del
            /// contenedor —`overflow-clip` en el marco, y meter
            /// Ajustes dentro de la columna que sí scrollea— y
            /// las dos son correctas, pero las dos suponen
            /// saber CUÁL contenedor se mueve. Esto no lo
            /// supone: sin foco no hay desplazamiento, venga de
            /// donde venga.
            ///
            /// Con el teclado sigue funcionando igual, y allí
            /// el desplazamiento sí se quiere: quien llega con
            /// Tab necesita ver a dónde llegó. `preventDefault`
            /// en `mousedown` no toca esa ruta.
            onMouseDown={(e) => e.preventDefault()}
            aria-pressed={activa}
            title={opcion.etiqueta}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
              activa
                ? "bg-marca-suave font-medium text-marca"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            {opcion.icono}
            {!compacto && <span>{opcion.etiqueta}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Los logos de las entidades, en fila. */
export function BannerLogos() {
  const { marca } = useMarca();
  const logos = marca?.logos ?? [];

  if (!logos.length) {
    return (
      <span className="text-sm font-medium text-marca">
        {marca?.nombreApp ?? "Convoca"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {logos.map((logo) => (
        // <img>: tamano desconocido y ya viene cacheado
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={logo.id}
          src={urlLogo(logo)}
          alt={logo.etiqueta}
          // max-w: que no desborden en movil
          className="h-20 w-auto max-w-[45vw] object-contain sm:max-w-[14rem]"
        />
      ))}
    </div>
  );
}

export function EncabezadoPublico({
  titulo,
  subtitulo,
}: {
  titulo?: string;
  subtitulo?: string;
}) {
  const { marca } = useMarca();

  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BannerLogos />
        <ConmutadorTema compacto />
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        {titulo ?? marca?.tituloPublico ?? "Reserve sus cupos de formación"}
      </h1>
      <p className="mt-3 text-texto-suave">
        {subtitulo ??
          marca?.subtituloPublico ??
          "La formación es gratuita y los cupos son limitados."}
      </p>

      {marca?.mensajeEncabezado && (
        <p className="mt-4 rounded-xl border border-marca/25 bg-marca-suave px-4 py-3 text-sm">
          {marca.mensajeEncabezado}
        </p>
      )}
    </header>
  );
}

export function PiePublico() {
  const { marca } = useMarca();

  /// El pie sale SIEMPRE, aunque el admin no haya escrito
  /// texto: la firma y la version son de la casa, no del
  /// cliente, y antes toda la pieza desaparecia con el texto.
  return (
    /// Separado de lo que hay encima, pero no desterrado.
    ///
    /// Las tres piezas —el texto del cliente, la firma y la
    /// línea legal— van una debajo de otra y centradas. Antes
    /// iban en dos extremos, y en el teléfono se amontonaban
    /// en el mismo renglón.
    ///
    /// `mt-8` y no `mt-16`: con 64px de margen encima, MÁS los
    /// 40 que ya deja el `py-10` del contenido, el pie quedaba
    /// a más de cien píxeles de lo último que se lee. Era una
    /// franja en blanco que parecía que faltaba algo por
    /// cargar. Nada lo empujaba —ningún `grow`—, era margen
    /// puesto a mano.
    <footer className="mx-auto mt-8 w-full max-w-3xl px-6 pb-10 text-sm text-texto-suave">
      {marca?.piePagina && <p className="mb-6">{marca.piePagina}</p>}
      {/* La FIRMA arriba y la línea legal debajo.

          Estaba al revés. La firma es el logo con «Convoca» y
          su lema, y la línea legal es la letra pequeña: quien
          gestiona, el año y la versión. Poner la letra pequeña
          encima del logo dejaba el pie leyéndose de mayor a
          menor peso al revés de como se lee cualquier pie.
          Ahora cierra donde tiene que cerrar. */}
      <div className="flex flex-col items-center gap-4 border-t border-borde pt-6 text-center">
        <FirmaConvoca tamano={26} apilado />
        <PieDeConvoca />
      </div>
    </footer>
  );
}

// iconos en línea
const TRAZO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden {...TRAZO}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden {...TRAZO}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function IconoSistema() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden {...TRAZO}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
