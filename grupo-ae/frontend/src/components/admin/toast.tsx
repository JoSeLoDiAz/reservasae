"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { IconoCerrar, IconoCheck } from "./iconos";

type Tipo = "exito" | "error" | "aviso";

type Aviso = { id: number; tipo: Tipo; texto: string };

type Api = {
  exito: (texto: string) => void;
  error: (texto: string) => void;
  aviso: (texto: string) => void;
};

const ContextoToast = createContext<Api | null>(null);

export function useToast(): Api {
  const valor = useContext(ContextoToast);
  if (!valor) throw new Error("useToast fuera del proveedor.");
  return valor;
}

// mas de tres y tapan la pantalla
const MAXIMO = 3;

// el error dura mas: hay que poder leerlo
const DURACION: Record<Tipo, number> = { exito: 4000, aviso: 4000, error: 8000 };

const TINTE: Record<Tipo, string> = {
  exito: "bg-exito-suave text-exito",
  aviso: "bg-aviso-suave text-aviso",
  error: "bg-error-suave text-error",
};

/** Los avisos flotantes del panel. */
export function ProveedorToast({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const ultimoId = useRef(0);

  const cerrar = useCallback((id: number) => {
    setAvisos((lista) => lista.filter((a) => a.id !== id));
  }, []);

  const anadir = useCallback((tipo: Tipo, texto: string) => {
    ultimoId.current += 1;
    const nuevo = { id: ultimoId.current, tipo, texto };
    // solo los ultimos, el viejo se va
    setAvisos((lista) => [...lista, nuevo].slice(-MAXIMO));
  }, []);

  const api = useMemo<Api>(
    () => ({
      exito: (texto) => anadir("exito", texto),
      error: (texto) => anadir("error", texto),
      aviso: (texto) => anadir("aviso", texto),
    }),
    [anadir],
  );

  return (
    <ContextoToast.Provider value={api}>
      {children}
      <div className="no-imprimir pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {avisos.map((aviso) => (
          <Tarjeta key={aviso.id} aviso={aviso} alCerrar={cerrar} />
        ))}
      </div>
    </ContextoToast.Provider>
  );
}

function Tarjeta({ aviso, alCerrar }: { aviso: Aviso; alCerrar: (id: number) => void }) {
  const [pausado, setPausado] = useState(false);

  // quien pide menos movimiento no lo recibe
  const [animar] = useState(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      document.documentElement.dataset.sinMovimiento !== "si",
  );
  const [visible, setVisible] = useState(!animar);

  const restante = useRef(DURACION[aviso.tipo]);
  const arranque = useRef(0);

  useEffect(() => {
    if (!animar) return;
    const cuadro = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(cuadro);
  }, [animar]);

  // el raton encima detiene la cuenta
  useEffect(() => {
    if (pausado) return;
    arranque.current = Date.now();
    const reloj = window.setTimeout(() => alCerrar(aviso.id), restante.current);
    return () => {
      window.clearTimeout(reloj);
      restante.current -= Date.now() - arranque.current;
    };
  }, [pausado, aviso.id, alCerrar]);

  const esError = aviso.tipo === "error";

  return (
    <div
      role={esError ? "alert" : "status"}
      aria-live={esError ? "assertive" : "polite"}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border border-borde bg-superficie p-3.5 shadow-lg ${
        animar ? "transition duration-200" : ""
      } ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
    >
      <span
        aria-hidden
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TINTE[aviso.tipo]}`}
      >
        {aviso.tipo === "exito" ? (
          <IconoCheck tamano={15} />
        ) : (
          <span className="text-sm font-bold">!</span>
        )}
      </span>

      <p className="min-w-0 grow text-sm break-words text-texto">{aviso.texto}</p>

      <button
        onClick={() => alCerrar(aviso.id)}
        aria-label="Cerrar el aviso"
        className="shrink-0 rounded-lg p-1 text-texto-suave transition hover:bg-current/10 hover:text-texto"
      >
        <IconoCerrar tamano={14} />
      </button>
    </div>
  );
}
