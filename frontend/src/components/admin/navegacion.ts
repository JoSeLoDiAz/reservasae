/** Los módulos del panel, en el orden del proceso. */

import { alcanza, type Area, type Nivel } from '@/lib/admin-api';


export type Enlace = {
  href: string;
  etiqueta: string;
  exacto?: boolean;
  soloSuperadmin?: boolean;
  /// El área que hay que poder ver para que salga.
  area?: Area;
  /// Y con qué nivel: escribir para lo que no es consulta.
  nivel?: Nivel;
};

export type Modulo = {
  clave: string;
  /// La unica marca del menu, en la pestaña macro y en la
  /// barra plegada. Un emoji y no un icono dibujado: seis
  /// grupos se distinguen de un vistazo, y los enlaces de
  /// dentro se quedan en texto para no competir con el.
  emoji: string;
  etiqueta: string;
  /// El nombre CORTO, para la fila horizontal de la cabecera.
  ///
  /// Vive aquí y no en la cabecera para que los dos nombres no se
  /// separen: si mañana un módulo se renombra, se renombra en un
  /// solo sitio. El largo sigue mandando en el cajón, en las migas
  /// y en el título de cada pantalla, que es donde hay sitio y
  /// donde se lee una vez.
  ///
  /// Lo pidió el cliente el 12 sep 2026 al ver la fila con una
  /// barra de desplazamiento debajo: «Gestión de Inscripciones
  /// pasa a ser Inscripciones». Y es lo que su montaje de diseño
  /// ya hacía; yo lo había rechazado por no separar los nombres de
  /// su fuente, y la respuesta correcta no era dejarlos largos,
  /// era poner el corto EN la fuente.
  corto?: string;
  descripcion: string;
  enlaces: Enlace[];
};

/**
 * EL MENÚ LO ORDENÓ EL CLIENTE, MÓDULO POR MÓDULO (22 y 23 sep 2026).
 *
 * La regla que salió de esa conversación:
 *
 *  · Cada módulo es un ÁREA --Inscripciones, Académica, Sistemas,
 *    Mailing-- y dentro va lo que esa área trabaja, sus reportes
 *    incluidos: Reportes SENA es de Sistemas porque Sistemas responde
 *    por ese entregable.
 *  · «Tableros» es la excepción a propósito: no es un área, es lo que
 *    se mira sin tocar nada. Por eso puede repetir una pantalla que
 *    también vive en su área, con otro nombre.
 *  · Ninguna pantalla se esconde dentro de otra como pestaña: o tiene
 *    entrada en el menú, o es un botón de una lista («Cargar una
 *    lista», «Asignar grupo por lote»), que es una acción y no un
 *    sitio.
 *  · Ningún módulo pasa de seis entradas: más no se lee de un vistazo.
 */
export const MODULOS: Modulo[] = [
  {
    /**
     * TABLEROS: lo que se mira. Cuatro, y cada uno con su ruta
     * (`/admin/informes/…`): con una sola ruta el menú los subrayaba
     * todos a la vez.
     *
     * El tablero de siempre (`/admin`) no está en el menú por decisión
     * del cliente; sigue a un clic en el logo.
     */
    clave: 'informes',
    emoji: '📊',
    etiqueta: 'Tableros',
    descripcion: 'Lo que hay que mirar: del anuncio al inscrito.',
    enlaces: [
      {
        href: '/admin/informes/trafico',
        etiqueta: 'Tráfico Formulario',
        exacto: true,
        area: 'inscritos',
      },
      {
        /// «Control de inscritos, que es: Inscripciones y Asesores»
        /// (cliente, 23 sep 2026). Hoy enseña el embudo y el proceso;
        /// el corte por asesor está en «Comité Marketing», que vive en
        /// Inscripciones.
        href: '/admin/informes/leads',
        etiqueta: 'Control de inscritos',
        exacto: true,
        area: 'inscritos',
      },
      {
        href: '/admin/informes/reservas',
        etiqueta: 'Control de Reservas',
        exacto: true,
        area: 'inscritos',
      },
      {
        /// EL TABLERO, no la pantalla de trabajo: «Tablero académico se
        /// manda para Tableros» (cliente, 23 sep 2026). Lo que se
        /// trabaja --el seguimiento del aula-- se queda en Académica.
        href: '/admin/participantes/academico/tablero',
        etiqueta: 'Seguimiento Académico',
        area: 'academico',
      },
    ],
  },
  {
    /// Qué se dicta y cuándo. Se llamaba «Calendario», que era la mitad
    /// de lo que hay dentro: «Oferta formativa» es el lenguaje del
    /// SENA, y las dos entradas se llaman como las llama el equipo.
    clave: 'cronograma',
    emoji: '📅',
    etiqueta: 'Oferta formativa',
    corto: 'Oferta',
    descripcion: 'Qué se dicta y cuándo. De aquí cuelga el resto.',
    enlaces: [
      {
        /// `exacto` porque debajo cuelgan `/admin/acciones/[id]` y
        /// `/admin/acciones/cronograma`: sin él, el catálogo se quedaba
        /// marcado estando en el calendario.
        href: '/admin/acciones',
        etiqueta: 'Acciones de formación',
        exacto: true,
        area: 'reserva',
      },
      {
        href: '/admin/acciones/cronograma',
        etiqueta: 'Calendario',
        area: 'reserva',
      },
    ],
  },
  {
    /**
     * INSCRIPCIONES: lo que se abre todos los días, en el orden que
     * pidió el cliente (23 sep 2026).
     *
     * Fuera quedaron, por su orden, dos pantallas que no son un sitio
     * sino una acción sobre la lista de leads, y que se abren desde
     * ella: «Cargar una lista» (importar) y «Asignar grupo por lote».
     * «Inscritos por acción» también sale: es la misma lista filtrada
     * por etapa y acción.
     */
    clave: 'inscripciones',
    emoji: '📝',
    etiqueta: 'Gestión de Inscripciones',
    corto: 'Inscripciones',
    descripcion: 'Convertir cupos en personas con nombre.',
    enlaces: [
      {
        href: '/admin/participantes',
        etiqueta: 'Gestión de leads',
        exacto: true,
        area: 'inscripciones',
      },
      {
        href: '/admin/reservas',
        etiqueta: 'Reservas',
        area: 'reserva',
      },
      {
        href: '/admin/mesa',
        etiqueta: 'Mesa de entrada',
        exacto: true,
        area: 'inscripciones',
      },
      {
        /// La planeación de pauta y el rendimiento por asesor. Aquí y
        /// no en Mailing: «Comité Marketing mándalo para inscripciones»
        /// (cliente, 23 sep 2026).
        href: '/admin/informes/asesores',
        etiqueta: 'Comité Marketing',
        exacto: true,
        area: 'inscritos',
      },
    ],
  },
  {
    clave: 'academico',
    emoji: '🎓',
    etiqueta: 'Gestión Académica',
    corto: 'Académica',
    descripcion: 'Lo que pasa cuando la persona ya está dentro.',
    enlaces: [
      {
        href: '/admin/participantes/academico',
        etiqueta: 'Seguimiento del aula',
        exacto: true,
        area: 'academico',
      },
    ],
  },
  {
    clave: 'campanas',
    emoji: '✉️',
    etiqueta: 'Campaña Mailing',
    corto: 'Mailing',
    descripcion: 'Escribirle a mucha gente sin perder el rastro.',
    enlaces: [
      {
        href: '/admin/campanas',
        etiqueta: 'Campañas',
        /// La misma llave que tenía antes de reordenar el menú: un
        /// envío es trabajo de inscripciones, no de configuración.
        area: 'inscripciones',
        nivel: 'ESCRIBIR',
      },
      {
        href: '/admin/plantillas-correo',
        etiqueta: 'Plantillas',
        area: 'configuracion',
        nivel: 'ESCRIBIR',
      },
      {
        href: '/admin/correo',
        etiqueta: 'Cuenta de correo',
        area: 'configuracion',
        nivel: 'ESCRIBIR',
      },
    ],
  },
  {
    /// Los datos que sostienen el reporte al SENA. Se llamaba «Sistemas
    /// de Información»: «demasiado extenso, es Sistemas» (cliente, 23
    /// sep 2026).
    clave: 'sistemas',
    emoji: '🗂️',
    etiqueta: 'Sistemas',
    descripcion: 'Los datos que sostienen el reporte al SENA.',
    enlaces: [
      {
        href: '/admin/instituciones',
        etiqueta: 'Empresas registradas',
        exacto: true,
        area: 'reserva',
      },
      /// SIN «PROPUESTAS POR REVISAR» EN EL MENÚ. «Propuestas por
      /// revisar se vuela» (cliente, 23 sep 2026). Eran cambios
      /// sugeridos a los datos de una organización --del RUES, de la
      /// web o de un formulario-- esperando que alguien los acepte o
      /// los rechace.
      ///
      /// La pantalla NO se borra: sigue en
      /// `/admin/instituciones/pendientes` y se llega escribiendo la
      /// dirección, que es como estaba antes de que se le pusiera
      /// entrada. Aquí solo deja de ocupar un renglón del menú.
      {
        href: '/admin/empresas',
        etiqueta: 'Empresas aliadas - afiliadas',
        area: 'reserva',
      },
      { href: '/admin/sep', etiqueta: 'Reportes SENA', area: 'reportes' },
    ],
  },
  {
    clave: 'formularios',
    emoji: '🧾',
    etiqueta: 'Formularios',
    descripcion: 'Lo que se le pregunta a quien se inscribe.',
    enlaces: [
      {
        href: '/admin/formularios',
        etiqueta: 'Formularios Empresas',
        exacto: true,
        area: 'configuracion',
        nivel: 'ESCRIBIR',
      },
      {
        /// Hermano del de arriba, y por eso se llaman igual de parecido:
        /// «Formularios Empresas» y «Formularios Personas» se leen como
        /// los dos que son.
        href: '/admin/formularios-publicos',
        etiqueta: 'Formularios Personas',
        exacto: true,
        area: 'inscripciones',
      },
      {
        href: '/admin/politicas',
        etiqueta: 'Habeas Data',
        area: 'configuracion',
        nivel: 'ESCRIBIR',
      },
    ],
  },
  {
    clave: 'configuracion',
    emoji: '⚙️',
    etiqueta: 'Configuración',
    descripcion: 'Lo que no es del día a día.',
    enlaces: [
      {
        /// Para todos: cada persona elige aquí SUS colores, que le
        /// quedan solo a ella (cliente, 21 sep 2026). Lo que cambia para
        /// todo el equipo --logos, textos, colores del sistema-- sale
        /// dentro solo a los correos autorizados, y el servidor lo
        /// cierra igual.
        href: '/admin/marca',
        etiqueta: 'Apariencia',
      },
      {
        /// Aquí y no en Gestión de leads: esto no es mirar leads, es
        /// conectar una tubería. Quien inscribe no tiene por qué verla.
        href: '/admin/integraciones/meta',
        etiqueta: 'Webhook de Meta',
        area: 'configuracion',
        nivel: 'ESCRIBIR',
      },
      { href: '/admin/usuarios', etiqueta: 'Usuarios', soloSuperadmin: true },
      { href: '/admin/perfil', etiqueta: 'Mi perfil' },
    ],
  },
];

/** La sección activa según la ruta, sin falsos positivos. */
export function estaActivo(enlace: Enlace, ruta: string): boolean {
  /// SIN LA PREGUNTA: los informes son vistas de la misma pantalla
  /// (`/admin/control?pantalla=…`) y la ruta que llega aquí es solo el
  /// camino, sin `?`. Comparando con la pregunta dentro, ninguna vista
  /// se encendía nunca.
  const camino = enlace.href.split('?')[0];
  if (enlace.exacto) return ruta === camino;
  return ruta === camino || ruta.startsWith(`${camino}/`);
}

/** Los enlaces que esta persona puede ver. */
export function enlacesVisibles(
  modulo: Modulo,
  permisos: Record<Area, Nivel> | undefined,
  esSuperadmin: boolean,
): Enlace[] {
  return modulo.enlaces.filter((e) => {
    if (e.soloSuperadmin && !esSuperadmin) return false;
    if (!e.area) return true;
    // sin permisos aun (cargando) no se esconde nada
    if (!permisos) return true;
    return alcanza(permisos[e.area], e.nivel ?? 'VER');
  });
}
