/** Dónde vive la gente, por departamento. */

/**
 * Coroplético de Colombia. Lo pidió coordinación, y con
 * veintisiete departamentos una lista de barras es larga y no
 * comunica territorio: se ve QUÉ departamento tiene más, no
 * DÓNDE se concentra la gente.
 *
 * SIN d3. El encargo proponía `d3-geo` + `topojson-client`, y
 * eso serían las dos primeras dependencias de visualización del
 * proyecto —hoy el frontend tiene cuatro en total— para lo que
 * aquí es una proyección de diez líneas. Lo que el encargo
 * quería evitar era dibujar las formas a mano, y no se dibujan:
 * salen de la geometría real, que va DENTRO del repo y no de un
 * gist de terceros que puede cambiar o caerse sin avisar.
 *
 * El relleno usa `color-mix` sobre `--marca`, así que respeta el
 * tema claro y el oscuro sin una sola condición.
 */

import { useEffect, useMemo, useState } from "react";

import { ListaBarras, n } from "./graficos";

/// San Andrés y Providencia queda a 700 km de la costa: metido
/// en el encuadre, el continente se encoge a la mitad para
/// dejarle sitio a una isla de dos píxeles.
const FUERA_DEL_ENCUADRE = ["SAN ANDRES Y PROVIDENCIA"];

const ALTO = 420;

/**
 * ¿Entiende este navegador `color-mix(in oklab, …)`?
 *
 * Importa, y mucho: un `fill` que el navegador no sabe leer no
 * se queda en gris, se queda en NEGRO —es el valor inicial de
 * `fill` en SVG—. En un Chrome anterior al 111, un Safari
 * anterior al 16.2 o un navegador de empresa con la versión
 * congelada, el mapa de coordinación saldría en negro sólido, y
 * nadie se enteraría hasta que alguien lo abriera.
 *
 * Se calcula una vez y se guarda. No hace falta estado ni efecto
 * —y por eso no lo lleva—: los `path` solo existen DESPUÉS de
 * que la geometría llegue por `fetch`, que es cosa del
 * navegador, así que el servidor nunca llega a pintar uno y no
 * hay hidratación que romper.
 */
let mezclaSoportada: boolean | null = null;
function soportaMezcla(): boolean {
  if (mezclaSoportada === null) {
    mezclaSoportada =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("color", "color-mix(in oklab, red 50%, blue)");
  }
  return mezclaSoportada;
}

type Rasgo = {
  properties: Record<string, string>;
  geometry: { type: string; coordinates: unknown };
};

/** El nombre, comparable: sin tildes, en mayúsculas y sin ruido. */
function llave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\b(D C|DC|DEPARTAMENTO|DE|DEL|ARCHIPIELAGO)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/// Los nombres que el catálogo del SEP escribe distinto que la
/// geometría. Sin esto, Bogotá y los dos San Andrés se quedan
/// grises con gente dentro.
const ALIAS: Record<string, string> = {
  "SANTAFE BOGOTA": "BOGOTA",
  "BOGOTA": "BOGOTA",
  "VALLE": "VALLE CAUCA",
  "NORTE SANTANDER": "NORTE SANTANDER",
};

function normal(s: string): string {
  const k = llave(s);
  return ALIAS[k] ?? k;
}

/** Todas las coordenadas de una geometría, sea del tipo que sea. */
function anillos(g: Rasgo["geometry"]): number[][][] {
  const c = g.coordinates as never;
  if (g.type === "Polygon") return c as unknown as number[][][];
  if (g.type === "MultiPolygon")
    return (c as unknown as number[][][][]).flat();
  return [];
}

export function MapaColombia({
  datos,
}: {
  datos: Array<{ nombre: string; total: number }>;
}) {
  const [rasgos, setRasgos] = useState<Rasgo[] | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;

    /// Con plazo, y por eso un `AbortController`.
    ///
    /// Sin él, una petición que se queda colgada —proxy raro,
    /// red mala, el fichero que no está en la imagen— dejaba la
    /// tarjeta girando para siempre: `fetch` no falla, así que
    /// el `catch` no entra y el respaldo no llega NUNCA. Doce
    /// segundos y a las barras, que es información de verdad.
    const corta = new AbortController();
    const plazo = setTimeout(() => corta.abort(), 12_000);

    fetch("/geo/colombia-departamentos.json", { signal: corta.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { features?: Rasgo[] }) => {
        if (!vivo) return;
        /// Un `200` no basta: si nginx o el servidor devuelven la
        /// página de error en HTML, `.json()` revienta y cae en
        /// el `catch`; pero si devuelven un JSON que no es esto
        /// —un `{}`, otra versión del fichero— hay que darse
        /// cuenta aquí.
        const fs = Array.isArray(j?.features) ? j.features : [];
        if (fs.length === 0) {
          setFallo(true);
          return;
        }
        setRasgos(fs);
      })
      .catch(() => {
        if (vivo) setFallo(true);
      })
      .finally(() => clearTimeout(plazo));

    return () => {
      vivo = false;
      clearTimeout(plazo);
      corta.abort();
    };
  }, []);

  const porNombre = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of datos) m.set(normal(d.nombre), d.total);
    return m;
  }, [datos]);

  const cima = Math.max(1, ...datos.map((d) => d.total));

  const dibujo = useMemo(() => {
    if (!rasgos) return null;
    const dentro = rasgos.filter(
      (f) => !FUERA_DEL_ENCUADRE.includes(llave(nombreDe(f))),
    );

    /// El encuadre sale de la propia geometría, no de números
    /// tecleados: si algún día cambia el fichero, el mapa sigue
    /// cuadrando solo.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of dentro) {
      for (const anillo of anillos(f.geometry)) {
        for (const [x, y] of anillo) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!Number.isFinite(minX)) return null;

    /// Mercator simple: la latitud se estira con el coseno de la
    /// media. Sin eso Colombia sale achatada, y un mapa achatado
    /// se reconoce peor que uno sin colores.
    const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
    const anchoGeo = (maxX - minX) * kx;
    const altoGeo = maxY - minY;
    const escala = ALTO / altoGeo;
    const ancho = anchoGeo * escala;

    const px = (x: number) => (x - minX) * kx * escala;
    const py = (y: number) => (maxY - y) * escala;

    const caminos = dentro.map((f) => {
      const d = anillos(f.geometry)
        .map(
          (anillo) =>
            "M" +
            anillo.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join("L") +
            "Z",
        )
        .join(" ");
      const nom = nombreDe(f);
      const total = porNombre.get(normal(nom)) ?? 0;
      return { d, nombre: nom, total };
    });

    return { caminos, ancho };
  }, [rasgos, porNombre]);

  if (fallo) {
    /// Las barras SOLO cuando el mapa no puede pintarse. Es el
    /// respaldo que declara el encargo, no una alternativa: con
    /// veintisiete departamentos la lista es larga y no dice
    /// DONDE se concentra la gente, solo cual tiene mas.
    return (
      <div>
        <p className="mb-3 text-[0.71875rem] text-texto-suave">
          No se pudo cargar el mapa. Va la lista, ordenada de más a menos.
        </p>
        <ListaBarras
          datos={[...datos]
            .sort((a, b) => b.total - a.total)
            .map((d) => ({ etiqueta: d.nombre, valor: d.total }))}
          sufijo=" personas"
          vacio="Sin personas con estos filtros."
        />
      </div>
    );
  }

  /// Geometria cargada pero sin encuadre posible: al respaldo.
  /// Antes se quedaba en el esqueleto, y un esqueleto que no
  /// termina nunca se lee como «la pagina esta rota».
  if (rasgos && !dibujo) {
    return (
      <ListaBarras
        datos={[...datos]
          .sort((a, b) => b.total - a.total)
          .map((d) => ({ etiqueta: d.nombre, valor: d.total }))}
        sufijo=" personas"
        vacio="Sin personas con estos filtros."
      />
    );
  }

  if (!dibujo) {
    return (
      <div
        className="animate-pulse rounded-lg bg-superficie-alterna"
        style={{ height: ALTO }}
        aria-label="Cargando el mapa"
      />
    );
  }

  return (
    <div className="flex justify-center">
      <svg
        viewBox={`0 0 ${dibujo.ancho} ${ALTO}`}
        className="h-auto w-full"
        style={{ maxHeight: ALTO }}
        role="img"
        aria-label="Personas por departamento"
      >
        {/* El fondo, para que la vía sin `color-mix` mezcle
            contra la superficie de la tarjeta y no contra lo que
            haya debajo del SVG. */}
        <rect width="100%" height="100%" fill="var(--superficie)" />
        {dibujo.caminos.map((c) => {
          /// La intensidad va por raíz y no lineal: con un
          /// departamento que se lleva la mitad, en lineal los
          /// demás quedan todos del mismo blanco y el mapa deja
          /// de distinguir entre «pocos» y «ninguno».
          const f = c.total > 0 ? Math.sqrt(c.total / cima) : 0;
          const mezcla = Math.round(8 + f * 82);
          /// Sin `color-mix`, el mismo azul con transparencia
          /// sobre el fondo de la tarjeta. No es idéntico —mezcla
          /// en sRGB y no en oklab—, pero es el mismo azul en la
          /// misma proporción y funciona en cualquier navegador.
          const mezclaOk = soportaMezcla();
          const relleno =
            c.total === 0
              ? "var(--superficie-alterna)"
              : mezclaOk
                ? `color-mix(in oklab, var(--marca) ${mezcla}%, var(--superficie))`
                : "var(--marca)";
          return (
            <path
              key={c.nombre}
              d={c.d}
              stroke="var(--superficie)"
              strokeWidth={0.6}
              fill={relleno}
              fillOpacity={c.total > 0 && !mezclaOk ? mezcla / 100 : 1}
              className="transition-[fill]"
            >
              <title>{`${c.nombre}: ${n(c.total)} ${c.total === 1 ? "persona" : "personas"}`}</title>
            </path>
          );
        })}
      </svg>
    </div>
  );
}

function nombreDe(f: Rasgo): string {
  const p = f.properties ?? {};
  return p.NOMBRE_DPT ?? p.NOMBRE_DEPARTAMENTO ?? p.name ?? p.NOMBRE ?? "";
}
