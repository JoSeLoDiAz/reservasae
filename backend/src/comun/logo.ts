// SVG escala; JPG no tiene transparencia
export const TIPOS_LOGO = ['image/svg+xml', 'image/png', 'image/webp'];
export const MAXIMO_LOGO = 1024 * 1024;

export const ERROR_TIPO_LOGO =
  'El logo debe ser SVG, PNG o WebP. JPG no sirve: no tiene transparencia ' +
  'y deja un recuadro blanco sobre el color de marca.';

export const ERROR_TAMANO_LOGO = 'El logo no puede pesar más de 1 MB.';
