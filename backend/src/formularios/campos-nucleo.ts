import { CampoNucleo, TipoPregunta } from '../../generated/prisma';

/**
 * Los campos sin los que no se puede crear una reserva.
 *
 * Tres candados: no se archivan, no cambian de tipo y no se repiten.
 */

export type DefinicionCampoNucleo = {
  campo: CampoNucleo;
  etiquetaSugerida: string;
  tipo: TipoPregunta;
  /** Sin esto no hay reserva posible; el formulario no se puede publicar. */
  obligatorioParaPublicar: boolean;
  /** Lo pinta el frontend con un control propio, no con el genérico. */
  controlEspecial?: 'ACCION' | 'OFERTA' | 'CUPOS';
  descripcion: string;
};

export const CAMPOS_NUCLEO: DefinicionCampoNucleo[] = [
  {
    campo: CampoNucleo.EMPRESA_NIT,
    etiquetaSugerida: 'NIT',
    tipo: TipoPregunta.TEXTO_CORTO,
    obligatorioParaPublicar: true,
    descripcion:
      'Identifica a la organización y es lo único que le permitirá volver a ' +
      'consultar o modificar su reserva.',
  },
  {
    campo: CampoNucleo.EMPRESA_RAZON_SOCIAL,
    etiquetaSugerida: 'Nombre de la organización',
    tipo: TipoPregunta.TEXTO_CORTO,
    obligatorioParaPublicar: true,
    descripcion: 'Razón social.',
  },
  {
    campo: CampoNucleo.EMPRESA_COLABORADORES,
    etiquetaSugerida: 'Número de colaboradores',
    tipo: TipoPregunta.NUMERO,
    obligatorioParaPublicar: false,
    descripcion: 'Tamaño de la organización.',
  },
  {
    campo: CampoNucleo.EMPRESA_RED_ASOCIADA,
    etiquetaSugerida: '¿Es afiliado o aliado a alguno de estos gremios?',
    tipo: TipoPregunta.SELECCION_UNICA,
    obligatorioParaPublicar: false,
    descripcion: 'Gremio al que pertenece. Añada una opción por gremio.',
  },
  {
    campo: CampoNucleo.EMPRESA_RED_ASOCIADA_OTRA,
    etiquetaSugerida: '¿A cuál?',
    tipo: TipoPregunta.TEXTO_CORTO,
    obligatorioParaPublicar: false,
    descripcion:
      'Para cuando elige "Otro". Conviene condicionarla a esa respuesta.',
  },
  {
    campo: CampoNucleo.CONTACTO_NOMBRE,
    etiquetaSugerida: 'Nombre completo de quien reserva',
    tipo: TipoPregunta.TEXTO_CORTO,
    obligatorioParaPublicar: true,
    descripcion: 'No tiene que ser quien asista.',
  },
  {
    campo: CampoNucleo.CONTACTO_CORREO,
    etiquetaSugerida: 'Correo electrónico',
    tipo: TipoPregunta.CORREO,
    obligatorioParaPublicar: true,
    descripcion: 'Por donde se le contactará sobre los cupos.',
  },
  {
    campo: CampoNucleo.CONTACTO_CELULAR,
    etiquetaSugerida: 'Celular',
    tipo: TipoPregunta.TELEFONO,
    obligatorioParaPublicar: false,
    descripcion: 'Contacto alterno.',
  },
  {
    campo: CampoNucleo.CONTACTO_CARGO,
    etiquetaSugerida: 'Cargo',
    tipo: TipoPregunta.TEXTO_CORTO,
    obligatorioParaPublicar: false,
    descripcion: 'Cargo de quien diligencia.',
  },
  {
    campo: CampoNucleo.ACCION_FORMACION,
    etiquetaSugerida: 'Curso',
    tipo: TipoPregunta.SELECCION_UNICA,
    obligatorioParaPublicar: true,
    controlEspecial: 'ACCION',
    descripcion:
      'Las opciones salen del catálogo publicado, no se escriben aquí. ' +
      'Solo se puede cambiar la etiqueta y la ayuda.',
  },
  {
    campo: CampoNucleo.OFERTA,
    etiquetaSugerida: 'Ciudad o departamento',
    tipo: TipoPregunta.SELECCION_UNICA,
    obligatorioParaPublicar: true,
    controlEspecial: 'OFERTA',
    descripcion:
      'Depende del curso elegido y muestra los cupos disponibles. Es lo que ' +
      'determina contra qué oferta se descuenta el cupo.',
  },
  {
    campo: CampoNucleo.CUPOS_SOLICITADOS,
    etiquetaSugerida: '¿Cuántos cupos desea reservar?',
    tipo: TipoPregunta.NUMERO,
    obligatorioParaPublicar: true,
    controlEspecial: 'CUPOS',
    descripcion: 'El tope real lo pone la oferta elegida.',
  },
  {
    campo: CampoNucleo.ACEPTA_TERMINOS,
    etiquetaSugerida: 'Acepto los términos de participación',
    tipo: TipoPregunta.CASILLA,
    obligatorioParaPublicar: true,
    descripcion: 'Sin marcarla no se puede reservar.',
  },
  {
    campo: CampoNucleo.ACEPTA_POLITICA_DATOS,
    etiquetaSugerida: 'Autorizo el tratamiento de mis datos personales',
    tipo: TipoPregunta.CASILLA,
    obligatorioParaPublicar: true,
    descripcion:
      'Sin marcarla no se puede reservar: guardar los datos sin autorización ' +
      'es justo lo que la Ley 1581 no permite.',
  },
];

export const POR_CAMPO = new Map(CAMPOS_NUCLEO.map((c) => [c.campo, c]));

export const CAMPOS_OBLIGATORIOS = CAMPOS_NUCLEO.filter(
  (c) => c.obligatorioParaPublicar,
).map((c) => c.campo);
