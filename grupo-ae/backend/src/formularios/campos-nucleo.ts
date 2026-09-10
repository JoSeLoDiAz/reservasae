import { CampoNucleo, TipoPregunta } from '../../generated/prisma';

/** Campos sin los que no hay reserva. */

export type DefinicionCampoNucleo = {
  campo: CampoNucleo;
  etiquetaSugerida: string;
  tipo: TipoPregunta;
  /** Obligatorio para poder publicar. */
  obligatorioParaPublicar: boolean;
  /** El frontend lo pinta con control propio. */
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
      'consultar o modificar su solicitud.',
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
    etiquetaSugerida: '¿Cómo se enteró de nosotros?',
    tipo: TipoPregunta.SELECCION_UNICA,
    obligatorioParaPublicar: false,
    descripcion: 'Canal por el que llegó. Añada una opción por canal.',
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
    etiquetaSugerida: 'Nombre completo de quien solicita',
    tipo: TipoPregunta.TEXTO_CORTO,
    obligatorioParaPublicar: true,
    descripcion: 'No tiene que ser quien asista.',
  },
  {
    campo: CampoNucleo.CONTACTO_CORREO,
    etiquetaSugerida: 'Correo electrónico',
    tipo: TipoPregunta.CORREO,
    obligatorioParaPublicar: true,
    descripcion: 'Por donde se le contactará sobre su solicitud.',
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
    etiquetaSugerida: 'Producto o servicio de interés',
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
      'Depende del producto elegido y muestra dónde se atiende. Es lo que ' +
      'determina a qué ciudad se asigna la oportunidad.',
  },
  {
    campo: CampoNucleo.CUPOS_SOLICITADOS,
    etiquetaSugerida: '¿Cuántas personas participarían?',
    tipo: TipoPregunta.NUMERO,
    obligatorioParaPublicar: true,
    controlEspecial: 'CUPOS',
    descripcion: 'Es un dato estimado: no compromete nada.',
  },
  {
    campo: CampoNucleo.ACEPTA_TERMINOS,
    etiquetaSugerida: 'Acepto los términos y condiciones',
    tipo: TipoPregunta.CASILLA,
    obligatorioParaPublicar: true,
    descripcion: 'Sin marcarla no se puede enviar la solicitud.',
  },
  {
    campo: CampoNucleo.ACEPTA_POLITICA_DATOS,
    etiquetaSugerida: 'Autorizo el tratamiento de mis datos personales',
    tipo: TipoPregunta.CASILLA,
    obligatorioParaPublicar: true,
    descripcion:
      'Sin marcarla no se puede enviar la solicitud: guardar los datos sin ' +
      'autorización es justo lo que la Ley 1581 no permite.',
  },
];

export const POR_CAMPO = new Map(CAMPOS_NUCLEO.map((c) => [c.campo, c]));

export const CAMPOS_OBLIGATORIOS = CAMPOS_NUCLEO.filter(
  (c) => c.obligatorioParaPublicar,
).map((c) => c.campo);
