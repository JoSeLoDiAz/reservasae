/**
 * Cliente del panel. La sesión viaja en una cookie httpOnly que pone el
 * backend, así que aquí no se guarda ni se maneja ningún token: el navegador
 * la adjunta solo por ser el mismo origen.
 */

import { ErrorApi } from "./api";
import type { CatalogoColores, ColoresTema, Esquema } from "./tema";

export type RolAdmin = "SUPERADMIN" | "GESTOR" | "CONSULTA";

export type AdminActual = {
  id: string;
  correo: string;
  nombre: string;
  rol: RolAdmin;
  activo: boolean;
  debeCambiarClave: boolean;
  cargo: string | null;
  celular: string | null;
  organizacion: string | null;
  ultimoAcceso: string | null;
  creadoEn: string;
};

export type ModoPorDefecto = "SISTEMA" | "CLARO" | "OSCURO";

export type OrigenLogo = "GENERAL" | "FORMULARIO" | null;

export type Marca = {
  nombreApp: string;
  tituloPublico: string;
  subtituloPublico: string;
  piePagina: string | null;
  modoPorDefecto: ModoPorDefecto;
  permitirCambioDeModo: boolean;
  /** De quien es la apariencia que se esta aplicando. */
  ambito: "GENERAL" | "FORMULARIO";
  formularioSlug: string | null;
  logo: { origen: OrigenLogo; tipoMime: string | null; version: number };
  /** Tokens que el formulario sobreescribe. Solo con ambito FORMULARIO. */
  sobreescritos?: Record<Esquema, string[]>;
  /** Las dos paletas viajan juntas: el conmutador cambia de una a otra sin
   *  volver a pedir nada al servidor. */
  temas: Record<Esquema, ColoresTema>;
  /** Qué colores existen, cómo agruparlos y qué pares hay que revisar. Lo
   *  define el backend para que no haya dos listas que mantener. */
  catalogoColores: CatalogoColores;
  logoTipoMime: string | null;
  logoNombre: string | null;
  logoVersion: number;
  actualizadoEn: string;
};

export type PlantillaTema = {
  clave: string;
  nombre: string;
  descripcion: string;
  principal: string;
  encabezadoDeColor: boolean;
  temas: Record<Esquema, ColoresTema>;
};

export type AccionAdmin = {
  id: string;
  codigo: string;
  nombre: string;
  evento: string | null;
  modalidad: "PRESENCIAL" | "VIRTUAL" | "HIBRIDA";
  horas: number | null;
  visible: boolean;
  convenio: string;
  convenioSigla: string | null;
  ofertas: number;
  cuposMaximos: number;
  cuposOcupados: number;
};

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`, {
    ...opciones,
    headers:
      opciones?.body instanceof FormData
        ? opciones.headers
        : { "content-type": "application/json", ...opciones?.headers },
  });

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const bruto = (cuerpo as { message?: string | string[] } | null)?.message;
    const mensaje = Array.isArray(bruto) ? bruto.join(". ") : bruto;
    throw new ErrorApi(respuesta.status, mensaje ?? "No se pudo completar la operación.", cuerpo);
  }

  return cuerpo as T;
}

export const adminApi = {
  iniciarSesion: (correo: string, clave: string) =>
    pedir<AdminActual>("/admin/sesion", {
      method: "POST",
      body: JSON.stringify({ correo, clave }),
    }),

  cerrarSesion: () => pedir<{ cerrada: boolean }>("/admin/sesion", { method: "DELETE" }),

  yo: () => pedir<AdminActual>("/admin/yo"),

  cambiarClave: (claveActual: string, claveNueva: string) =>
    pedir<{ cambiada: boolean }>("/admin/clave", {
      method: "POST",
      body: JSON.stringify({ claveActual, claveNueva }),
    }),

  actualizarPerfil: (datos: Partial<Pick<AdminActual, "nombre" | "cargo" | "celular" | "organizacion">>) =>
    pedir<AdminActual>("/admin/perfil", { method: "PATCH", body: JSON.stringify(datos) }),

  usuarios: () => pedir<AdminActual[]>("/admin/usuarios"),

  crearUsuario: (correo: string, nombre: string, rol: RolAdmin) =>
    pedir<{ admin: AdminActual; claveTemporal: string }>("/admin/usuarios", {
      method: "POST",
      body: JSON.stringify({ correo, nombre, rol }),
    }),

  actualizarUsuario: (id: string, datos: { rol?: RolAdmin; activo?: boolean }) =>
    pedir<AdminActual>(`/admin/usuarios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  reiniciarClave: (id: string) =>
    pedir<{ claveTemporal: string }>(`/admin/usuarios/${id}/clave`, { method: "POST" }),

  marca: () => pedir<Marca>("/admin/marca"),

  actualizarMarca: (datos: Partial<Marca>) =>
    pedir<Marca>("/admin/marca", { method: "PATCH", body: JSON.stringify(datos) }),

  // el DTO espera { colores }, no el mapa plano
  actualizarTema: (esquema: Esquema, colores: Partial<ColoresTema>) =>
    pedir<Marca>(`/admin/marca/tema/${esquema}`, {
      method: "PATCH",
      body: JSON.stringify({ colores }),
    }),

  restablecerTema: (esquema: Esquema) =>
    pedir<Marca>(`/admin/marca/tema/${esquema}/restablecer`, { method: "POST" }),

  subirLogo: (archivo: File) => {
    const formulario = new FormData();
    formulario.append("logo", archivo);
    // Sin content-type a mano: el navegador tiene que ponerlo con el `boundary`
    // del multipart, y escribirlo aquí lo rompe.
    return pedir<Marca>("/admin/marca/logo", { method: "POST", body: formulario });
  },

  borrarLogo: () => pedir<Marca>("/admin/marca/logo", { method: "DELETE" }),

  plantillas: () => pedir<PlantillaTema[]>("/admin/apariencia/plantillas"),

  derivar: (principal: string, encabezadoDeColor: boolean) =>
    pedir<Record<Esquema, ColoresTema>>("/admin/apariencia/derivar", {
      method: "POST",
      body: JSON.stringify({ principal, encabezadoDeColor }),
    }),

  corregirContraste: (colores: ColoresTema) =>
    pedir<ColoresTema>("/admin/apariencia/corregir", {
      method: "POST",
      body: JSON.stringify({ colores }),
    }),

  marcaDeFormulario: (slug: string) => pedir<Marca>(`/admin/marca/formulario/${slug}`),

  aparienciaDeFormulario: (
    id: string,
    datos: { coloresClaro?: ColoresTema | null; coloresOscuro?: ColoresTema | null },
  ) =>
    pedir<{ id: string }>(`/admin/formularios/${id}/apariencia`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),

  subirLogoDeFormulario: (id: string, archivo: File) => {
    const cuerpo = new FormData();
    cuerpo.append("logo", archivo);
    return pedir<{ id: string }>(`/admin/formularios/${id}/logo`, {
      method: "POST",
      body: cuerpo,
    });
  },

  borrarLogoDeFormulario: (id: string) =>
    pedir<{ id: string }>(`/admin/formularios/${id}/logo`, { method: "DELETE" }),

  convenios: () =>
    pedir<
      Array<{ id: string; slug: string; nombre: string; sigla: string | null; activo: boolean }>
    >("/admin/convenios"),

  acciones: () => pedir<AccionAdmin[]>("/admin/acciones"),

  publicarAccion: (id: string, visible: boolean) =>
    pedir<{ id: string; visible: boolean }>(`/admin/acciones/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ visible }),
    }),
};

/**
 * URL del logo segun de quien sea.
 *
 * La ruta CAMBIA con el origen a proposito: al borrar el logo propio de un
 * formulario, la URL deja de existir en vez de servir el viejo desde una cache
 * de un ano.
 */
export function urlLogo(marca: Pick<Marca, "logo" | "formularioSlug">): string | null {
  const { origen, version } = marca.logo;
  if (origen === "FORMULARIO" && marca.formularioSlug) {
    return `/api/marca/formulario/${marca.formularioSlug}/logo?v=${version}`;
  }
  if (origen === "GENERAL") return `/api/marca/logo?v=${version}`;
  return null;
}
