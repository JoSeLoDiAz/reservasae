// SVG escala; JPG no tiene transparencia
export const TIPOS_LOGO = ['image/svg+xml', 'image/png', 'image/webp'];
export const MAXIMO_LOGO = 1024 * 1024;

/// tres caben en la cabecera; una cuarta no
export const MAXIMO_LOGOS = 3;

export const ERROR_TIPO_LOGO =
  'El logo debe ser SVG, PNG o WebP. JPG no sirve: no tiene transparencia ' +
  'y deja un recuadro blanco sobre el color de marca.';

export const ERROR_TAMANO_LOGO = 'El logo no puede pesar más de 1 MB.';

/** Lo que viaja; los bytes van aparte. */
export type LogoPublico = {
  id: string;
  etiqueta: string;
  tipoMime: string;
  nombre: string;
  version: number;
  orden: number;
};

export type OrigenLogos = 'GENERAL' | 'FORMULARIO';

/** "Logo Horizontal-03.png" -> "Logo Horizontal-03". */
export function sinExtension(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '') || nombre;
}
