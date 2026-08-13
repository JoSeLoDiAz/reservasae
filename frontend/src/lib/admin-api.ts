/** Cliente del panel. Sesión en cookie. */

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

export type OrigenLogos = "GENERAL" | "FORMULARIO";

/** Tres caben en la cabecera; una cuarta no. */
export const MAXIMO_LOGOS = 3;

export type Logo = {
  id: string;
  etiqueta: string;
  tipoMime: string;
  nombre: string;
  version: number;
  orden: number;
};

export type Marca = {
  nombreApp: string;
  tituloPublico: string;
  subtituloPublico: string;
  piePagina: string | null;
  modoPorDefecto: ModoPorDefecto;
  permitirCambioDeModo: boolean;
  /** De quién es la apariencia. */
  ambito: "GENERAL" | "FORMULARIO";
  formularioSlug: string | null;
  /** El banner de la cabecera, en orden. */
  logos: Logo[];
  origenLogos: OrigenLogos;
  /** Tokens que sobreescribe el formulario. */
  sobreescritos?: Record<Esquema, string[]>;
  /** Las dos paletas juntas. */
  temas: Record<Esquema, ColoresTema>;
  /** Qué colores existen. Lo define el backend. */
  catalogoColores: CatalogoColores;
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

  // logos: las mismas rutas para los dos ambitos
  logos: (formularioId?: string) =>
    pedir<Logo[]>(`/admin/logos${formularioId ? `?formularioId=${formularioId}` : ""}`),

  subirLogo: (archivo: File, etiqueta: string, formularioId?: string) => {
    const cuerpo = new FormData();
    cuerpo.append("logo", archivo);
    cuerpo.append("etiqueta", etiqueta);
    if (formularioId) cuerpo.append("formularioId", formularioId);
    // sin content-type: el navegador pone el boundary
    return pedir<Logo[]>("/admin/logos", { method: "POST", body: cuerpo });
  },

  actualizarLogo: (
    id: string,
    datos: { etiqueta?: string; direccion?: "IZQUIERDA" | "DERECHA" },
  ) => pedir<Logo[]>(`/admin/logos/${id}`, { method: "PATCH", body: JSON.stringify(datos) }),

  borrarLogo: (id: string) => pedir<Logo[]>(`/admin/logos/${id}`, { method: "DELETE" }),

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

/** URL de un logo. El id la hace única. */
export function urlLogo(logo: Pick<Logo, "id" | "version">): string {
  return `/api/marca/logos/${logo.id}?v=${logo.version}`;
}
