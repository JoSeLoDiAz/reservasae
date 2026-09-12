// SVG escala; JPG no tiene transparencia
export const TIPOS_LOGO = ['image/svg+xml', 'image/png', 'image/webp'];
export const MAXIMO_LOGO = 1024 * 1024;

/// tres caben en la cabecera; una cuarta no. Se cuentan POR
/// ESQUEMA: un logo con su variante clara y su variante oscura
/// son dos filas que nunca salen juntas.
export const MAXIMO_LOGOS = 6;

/// En qué tema sale este archivo.
///
/// Existe porque un logo institucional no se puede recolorear:
/// es un archivo cerrado, hecho para papel. El de ADECOPRIA
/// lleva el nombre en negro, y sobre el fondo oscuro no se lee.
/// La entidad manda sus dos versiones —la de texto oscuro y la
/// de texto blanco— y cada una dice en qué tema le toca salir.
///
/// `AMBOS` es lo normal y el valor por defecto: un logo sin
/// texto, o con texto de un color que aguanta los dos fondos,
/// sale siempre y no hay que subir nada dos veces.
export const ESQUEMAS_DE_LOGO = ['AMBOS', 'CLARO', 'OSCURO'] as const;
export type EsquemaDeLogo = (typeof ESQUEMAS_DE_LOGO)[number];

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
  esquema: EsquemaDeLogo;
};

export type OrigenLogos = 'GENERAL' | 'FORMULARIO';

/** "Logo Horizontal-03.png" -> "Logo Horizontal-03". */
export function sinExtension(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '') || nombre;
}
