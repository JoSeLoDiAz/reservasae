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
  corto?: string;
  descripcion: string;
  enlaces: Enlace[];
};

/// El panel de Grupo AE: leads, formularios y correo.
///
/// En Convoca esto está agrupado por área —inscripciones,
/// sistemas de información, académica— porque ahí trabajan
/// tres equipos distintos sobre el mismo convenio. Aquí no:
/// este CRM lleva UNA operación, la de captar y gestionar
/// leads, así que se quedaron los cuatro módulos que la
/// sostienen y se fueron los otros tres.
///
/// Lo que se quitó —Calendario, Sistemas de Información y
/// Gestión Académica— no se borró del backend: las rutas y sus
/// permisos siguen existiendo, y volver a ofrecerlas es añadir
/// aquí su módulo. Se fue la puerta, no la habitación.
export const MODULOS: Modulo[] = [
  {
    clave: 'inscripciones',
    emoji: '📝',
    etiqueta: 'Gestión de leads',
    corto: 'Leads',
    descripcion: 'Del lead que entra al negocio que se cierra.',
    /**
     * Tres entradas y ni una más.
     *
     * Aquí había seis: mesa de entrada, lista de leads, asignar
     * grupo por lote, inscritos por acción y control de inscritos.
     * Las tres últimas son del mundo del aula —cohortes, cupos,
     * reporte— y no tienen nada que hacer en un CRM de ventas.
     *
     * Y las dos primeras eran la misma pregunta contada dos veces:
     * si TODO entra por formulario, «lo que llegó» y «lo que hay»
     * son la misma lista mirada con distinto filtro. Dos pantallas
     * para eso obligan a decidir a cuál entrar, que es el impuesto
     * que cobran los CRMs con cuarenta menús.
     *
     * Queda el tablero —dónde va cada negocio— y las dos listas,
     * partidas como los formularios: empresas y personas, que son
     * los dos embudos y se trabajan distinto.
     *
     * Con una excepción que no es para consultar sino para crear:
     * «Nuevo contacto». La premisa de arriba —TODO entra por
     * formulario— no se cumple con el contacto de una feria o de una
     * llamada, y sin una puerta para él ese lead no entraba nunca.
     */
    enlaces: [
      {
        href: '/admin/embudo',
        etiqueta: 'Embudo de ventas',
        exacto: true,
        area: 'inscripciones',
      },
      {
        href: '/admin/leads/empresas',
        etiqueta: 'Leads de empresas',
        exacto: true,
        area: 'inscripciones',
      },
      {
        /// Cada empresa una vez, con su gente y sus negocios. «Leads de
        /// empresas» lista negocios: una empresa con tres cotizaciones
        /// sale tres veces.
        href: '/admin/cuentas',
        etiqueta: 'Empresas',
        area: 'inscripciones',
      },
      {
        href: '/admin/leads/personas',
        etiqueta: 'Leads de personas',
        exacto: true,
        area: 'inscripciones',
      },
      {
        /// La puerta para lo que NO entra por formulario: el contacto
        /// de una feria, la llamada, el referido. Sin ella, un lead
        /// así no tenía cómo entrar al CRM y se quedaba en la libreta
        /// del asesor.
        ///
        /// La misma área que las listas, pero con ESCRIBIR: esto no es
        /// consulta, y una cuenta de solo lectura vería un formulario
        /// que el servidor le rechaza al guardar.
        href: '/admin/leads/personas/nueva',
        etiqueta: 'Nuevo contacto',
        exacto: true,
        area: 'inscripciones',
        nivel: 'ESCRIBIR',
      },
      {
        /// Lo que se oferta al público y cuántos negocios lleva cada
        /// servicio. Va con los leads y no en Configuración porque el
        /// asesor lo consulta a diario; editarlo sí pide configuración.
        href: '/admin/portafolio',
        etiqueta: 'Portafolio de servicios',
        exacto: true,
        area: 'inscripciones',
      },
    ],
  },
  {
    /// Los DOS sistemas de preguntas, juntos y con su dueño en
    /// el nombre: el que llena una empresa para apartar cupos y
    /// el que llena una persona para preinscribirse. No son dos
    /// estados de lo mismo, aunque se llamaran así.
    clave: 'formularios',
    emoji: '📋',
    etiqueta: 'Formularios',
    descripcion: 'Lo que se le pregunta a quien entra, y a quién se le pregunta.',
    enlaces: [
      {
        /// El nombre dice A QUIÉN se le pregunta, no en qué
        /// estado está.
        ///
        /// Se llamaban «Creación Formularios» y «Formularios
        /// Activos», que se leen como dos momentos del MISMO
        /// objeto -- el que se crea y el que ya está publicado --
        /// y son dos sistemas distintos: aquí se arman los
        /// formularios con los que una EMPRESA aparta cupos;
        /// abajo están los que llena una PERSONA para
        /// preinscribirse. Nadie pasa de uno al otro.
        /// Corto EN EL MENU y largo DENTRO.
        ///
        /// «Formularios de reserva (empresas)» no cabe en la
        /// barra: salia cortado como «Formularios de reserva
        /// (...», que es peor que no decirlo. El nombre entero
        /// vive en el titulo de la pantalla, que es donde hay
        /// sitio y donde se lee una vez que ya se entro.
        href: '/admin/formularios',
        etiqueta: 'Formularios Empresas',
        exacto: true,
        area: 'configuracion',
        nivel: 'ESCRIBIR',
      },
      {
        /// Los dos que están en la calle, en UNA vista con
        /// pestañas. Eran dos enlaces sueltos y obligaban a ir
        /// y volver para responder la pregunta que se hace
        /// siempre: «¿esto en cuál de los dos se pide?».
        /// Hermano del de arriba, y por eso se llaman igual de
        /// parecido: «Formularios Empresas» y «Formularios
        /// Personas» se leen como los dos que son. El nombre
        /// entero --«Formularios activos»-- esta dentro.
        href: '/admin/formularios-publicos',
        etiqueta: 'Formularios Personas',
        exacto: true,
        area: 'inscripciones',
      },
      {
        /// El habeas data vive con los formularios porque es
        /// lo PRIMERO que sale en ellos: se lee antes de pedir
        /// un solo dato. Se llamaba «Políticas», que no dice
        /// de qué.
        href: '/admin/politicas',
        etiqueta: 'Habeas Data',
        area: 'configuracion',
        nivel: 'ESCRIBIR',
      },
    ],
  },
  {
    /// Todo lo que sale por correo, en un solo sitio: la
    /// cuenta desde la que sale, lo que dice, y a quiénes.
    /// Estaban repartidos en Configuración, que es donde uno
    /// no los busca cuando quiere mandar algo.
    clave: 'campanas',
    emoji: '✉️',
    etiqueta: 'Campaña Mailing',
    corto: 'Mailing',
    descripcion: 'Lo que se le escribe a la gente, y a quiénes.',
    enlaces: [
      {
        href: '/admin/campanas',
        etiqueta: 'Campañas',
        exacto: true,
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
    clave: 'configuracion',
    emoji: '⚙️',
    etiqueta: 'Configuración',
    descripcion: 'Lo que no es del día a día.',
    enlaces: [
      { href: '/admin/marca', etiqueta: 'Apariencia', soloSuperadmin: true, area: 'configuracion', nivel: 'ESCRIBIR' },
      {
        /// Las reglas con las que se arma el Resumen. Se VE con
        /// permiso de leads —el asesor tiene derecho a saber de
        /// dónde sale la alerta que le salta— y se cambia con
        /// configuración con escritura, que es lo que valida el
        /// backend.
        href: '/admin/parametros',
        etiqueta: 'Parámetros del tablero',
        area: 'inscripciones',
      },
      {
        /// Aquí y no en Gestión de leads: esto no es mirar
        /// leads, es conectar una tubería. Quien inscribe no
        /// tiene por qué verla, y quien la conecta la busca
        /// donde está lo que se configura una vez.
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
  if (enlace.exacto) return ruta === enlace.href;
  return ruta === enlace.href || ruta.startsWith(`${enlace.href}/`);
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
