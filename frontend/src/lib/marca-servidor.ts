import { PATRON_SLUG } from "./marca";

// en el servidor no aplica el rewrite de next.config
const API_INTERNA = process.env.API_INTERNA ?? "http://127.0.0.1:4100";

const HEXADECIMAL = /^#[0-9a-fA-F]{6}$/;

type MarcaMinima = {
  temas: Record<string, Record<string, string>>;
  catalogoColores: { tokens: Array<{ clave: string; variableCss: string }> };
};

/** CSS con las dos paletas del formulario, o "" si falla. */
export async function estilosDeMarca(slug: string): Promise<string> {
  if (!PATRON_SLUG.test(slug)) return "";

  let marca: MarcaMinima;
  try {
    const respuesta = await fetch(`${API_INTERNA}/marca/formulario/${slug}`, {
      // la paleta cambia poco y el navegador la corrige
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(1500),
    });
    if (!respuesta.ok) return "";
    marca = (await respuesta.json()) as MarcaMinima;
  } catch {
    // el formulario funciona igual sin esto
    return "";
  }

  const tokens = marca?.catalogoColores?.tokens;
  if (!marca?.temas || !Array.isArray(tokens)) return "";

  return ["CLARO", "OSCURO"]
    .map((esquema) => {
      const colores = marca.temas[esquema];
      if (!colores) return "";
      const lineas = tokens
        .filter((token) => HEXADECIMAL.test(colores[token.clave] ?? ""))
        .map((token) => `${token.variableCss}:${colores[token.clave]};`)
        .join("");
      return lineas ? `:root[data-tema="${esquema.toLowerCase()}"]{${lineas}}` : "";
    })
    .join("");
}
