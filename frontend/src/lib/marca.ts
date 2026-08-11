/** Rutas de primer nivel que NO son un formulario. */
export const RUTAS_RESERVADAS = new Set(["admin", "consulta"]);

// el mismo patron que exige CrearFormularioDto
export const PATRON_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type Ambito = { tipo: "GENERAL" } | { tipo: "FORMULARIO"; slug: string };

/** En que ambito estamos segun la URL. */
export function ambitoDeRuta(pathname: string): Ambito {
  const primero = pathname.split("/").filter(Boolean)[0];
  if (!primero || RUTAS_RESERVADAS.has(primero)) return { tipo: "GENERAL" };
  if (!PATRON_SLUG.test(primero)) return { tipo: "GENERAL" };
  return { tipo: "FORMULARIO", slug: primero };
}

export function rutaDeMarca(ambito: Ambito): string {
  return ambito.tipo === "FORMULARIO"
    ? `/api/marca/formulario/${ambito.slug}`
    : "/api/marca";
}

// paleta cacheada

export const PREFIJO_PALETA = "convoca:paleta:";
export const ID_ESTILO_CACHE = "paleta-cache";

/** Clave de la paleta cacheada de este ambito. */
export function llavePaleta(ambito: Ambito): string {
  return PREFIJO_PALETA + (ambito.tipo === "FORMULARIO" ? ambito.slug : "general");
}

type MarcaMinima = {
  temas: Record<string, Record<string, string>>;
  catalogoColores: { tokens: Array<{ clave: string; variableCss: string }> };
};

/** Guarda la paleta resuelta, como pares variable→hex. */
export function recordarPaleta(ambito: Ambito, marca: MarcaMinima) {
  if (!marca?.temas || !marca.catalogoColores?.tokens) return;
  try {
    const paleta: Record<string, Record<string, string>> = {};
    for (const esquema of ["CLARO", "OSCURO"]) {
      const colores = marca.temas[esquema];
      if (!colores) continue;
      const pares: Record<string, string> = {};
      for (const token of marca.catalogoColores.tokens) {
        const valor = colores[token.clave];
        if (typeof valor === "string" && /^#[0-9a-fA-F]{6}$/.test(valor)) {
          pares[token.variableCss] = valor;
        }
      }
      paleta[esquema] = pares;
    }
    window.localStorage.setItem(llavePaleta(ambito), JSON.stringify(paleta));
  } catch {
    // en privado localStorage puede fallar
  }
}

/** Pinta la paleta cacheada antes del primer render. */
export const SCRIPT_PALETA = `
(function () {
  try {
    var seg = location.pathname.split('/').filter(Boolean)[0];
    var reservadas = ${JSON.stringify([...RUTAS_RESERVADAS])};
    var esForm = seg && reservadas.indexOf(seg) < 0 && new RegExp(${JSON.stringify(PATRON_SLUG.source)}).test(seg);
    var crudo = localStorage.getItem(${JSON.stringify(PREFIJO_PALETA)} + (esForm ? seg : 'general'));
    if (!crudo) return;
    var paleta = JSON.parse(crudo);
    var hex = /^#[0-9a-fA-F]{6}$/;
    var css = '';
    ['CLARO', 'OSCURO'].forEach(function (esquema) {
      var pares = paleta[esquema];
      if (!pares) return;
      var lineas = '';
      Object.keys(pares).forEach(function (variable) {
        if (variable.indexOf('--') === 0 && hex.test(pares[variable])) {
          lineas += variable + ':' + pares[variable] + ';';
        }
      });
      if (lineas) css += ':root[data-tema="' + esquema.toLowerCase() + '"]{' + lineas + '}';
    });
    if (!css) return;
    var estilo = document.createElement('style');
    estilo.id = ${JSON.stringify(ID_ESTILO_CACHE)};
    estilo.textContent = css;
    document.head.appendChild(estilo);
  } catch (e) {}
})();
`;
