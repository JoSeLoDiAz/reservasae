"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { urlLogo, type Marca } from "@/lib/admin-api";
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
  /** Vuelve a leer la marca; lo usa el panel tras guardar cambios. */
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

/**
 * Aplica la marca configurada en el panel: sobreescribe las variables CSS de
 * `globals.css` para los dos esquemas y decide cuál se muestra.
 *
 * Se hace en el cliente porque el endpoint se alcanza por la ruta relativa
 * `/api/...`, que en local existe gracias al rewrite de Next y en producción
 * la resuelve nginx. Desde el servidor de Next no aplica ninguno de los dos.
 * El parpadeo inicial lo evita `SCRIPT_SIN_PARPADEO`, que fija el esquema
 * antes de pintar.
 */
export function ProveedorMarca({ children }: { children: React.ReactNode }) {
  const [marca, setMarca] = useState<Marca | null>(null);
  const [modo, setModo] = useState<ModoElegido>("sistema");
  const [esquema, setEsquema] = useState<Esquema>("CLARO");

  // El modo guardado solo existe en el navegador. Leerlo en el primer render
  // provocaria una discrepancia con lo que pinto el servidor.
  useEffect(() => {
    const guardado = leerModoGuardado();
    setModo(guardado);
    setEsquema(resolverEsquema(guardado));
  }, []);

  const recargar = useCallback(async () => {
    try {
      const respuesta = await fetch("/api/marca");
      if (!respuesta.ok) return;
      setMarca((await respuesta.json()) as Marca);
    } catch {
      // Que falle la marca no puede tumbar el formulario: se queda con los
      // colores y textos por defecto y la gente sigue pudiendo reservar.
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  // Modo por defecto del administrador: solo manda si el visitante no ha
  // elegido nada. Quien ya escogió no debe ver cómo se le cambia solo.
  useEffect(() => {
    if (!marca || leerModoGuardado() !== "sistema") return;
    if (marca.modoPorDefecto === "SISTEMA") return;
    const forzado = marca.modoPorDefecto === "OSCURO" ? "OSCURO" : "CLARO";
    setEsquema(forzado);
  }, [marca]);

  // Seguir al sistema en vivo: si alguien tiene el modo automático por hora,
  // la página cambia con él sin recargar.
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

  // Los colores del administrador se inyectan como una hoja de estilo con los
  // dos esquemas, no escribiendo sobre `documentElement.style`: así el
  // conmutador sigue funcionando sin volver a pedir nada al servidor.
  const estilos = useMemo(() => {
    if (!marca?.temas || !marca.catalogoColores) return "";

    // Solo se escriben los tokens del catálogo, y solo si su valor es un
    // hexadecimal: esto acaba dentro de una etiqueta <style>, así que no puede
    // pasar por aquí una cadena arbitraria aunque la base viniera manipulada.
    // El backend ya valida al guardar; esta es la segunda barrera.
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

  const cambiarModo = useCallback((nuevo: ModoElegido) => {
    setModo(nuevo);
    setEsquema(resolverEsquema(nuevo));
    try {
      window.localStorage.setItem(LLAVE_MODO, nuevo);
    } catch {
      // Navegar en privado puede bloquear localStorage; el modo sigue
      // aplicándose, solo que no se recuerda.
    }
  }, []);

  return (
    <ContextoMarca.Provider value={{ marca, modo, esquema, cambiarModo, recargar }}>
      {estilos && <style dangerouslySetInnerHTML={{ __html: estilos }} />}
      {children}
    </ContextoMarca.Provider>
  );
}

// ---------------------------------------------------------------------------

const OPCIONES: Array<{ valor: ModoElegido; etiqueta: string; icono: React.ReactNode }> = [
  { valor: "claro", etiqueta: "Claro", icono: <IconoSol /> },
  { valor: "oscuro", etiqueta: "Oscuro", icono: <IconoLuna /> },
  { valor: "sistema", etiqueta: "Automático", icono: <IconoSistema /> },
];

export function ConmutadorTema({ compacto = false }: { compacto?: boolean }) {
  const { marca, modo, cambiarModo } = useMarca();

  // Si el administrador apagó la opción, el visitante no la ve. Se comprueba
  // `marca` porque mientras carga no se sabe, y es mejor no parpadear.
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

export function EncabezadoPublico({
  titulo,
  subtitulo,
}: {
  titulo?: string;
  subtitulo?: string;
}) {
  const { marca } = useMarca();
  const logo = marca ? urlLogo(marca) : null;

  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-3">
          {logo ? (
            // <img> y no <Image>: el logo lo sirve el backend con un tamaño que
            // no conocemos de antemano y ya viaja cacheado para siempre.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={marca?.nombreApp ?? "Inicio"} className="h-10 w-auto" />
          ) : (
            <span className="text-sm font-medium text-marca">
              {marca?.nombreApp ?? "Convoca"}
            </span>
          )}
        </Link>
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
    </header>
  );
}

export function PiePublico() {
  const { marca } = useMarca();
  if (!marca?.piePagina) return null;
  return (
    <footer className="mx-auto w-full max-w-3xl px-6 pb-10 text-sm text-texto-suave">
      {marca.piePagina}
    </footer>
  );
}

// Iconos en linea: sin dependencias ni peticiones externas.
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
