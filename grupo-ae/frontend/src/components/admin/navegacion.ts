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
    descripcion: 'Del lead que entra al negocio que se cierra.',
    enlaces: [
      {
        /// Va PRIMERO porque es donde se trabaja.
        ///
        /// La mesa de entrada es de donde SALEN los leads y el
        /// embudo es donde VIVEN: quien abre el panel por la
        /// mañana viene a ver sus negocios, no a ver qué llegó de
        /// madrugada. Poner la mesa primero sugeriria que el
        /// trabajo es despachar la bandeja, y el trabajo es cerrar.
        href: '/admin/embudo',
        etiqueta: 'Embudo de ventas',
        exacto: true,
        area: 'inscripciones',
      },
      {
        href: '/admin/mesa',
        etiqueta: 'Mesa de entrada',
        exacto: true,
        area: 'inscripciones',
      },
      {
        /// «Lista» y no «Gestión de leads», que es como se
        /// llama en Convoca: al pasar el módulo entero a
        /// llamarse así, el enlace repetía el nombre de su
        /// propia pestaña y no se sabía cuál era cuál.
        href: '/admin/participantes',
        etiqueta: 'Lista de leads',
        exacto: true,
        area: 'inscripciones',
      },
      {
        /// Detras de la lista de leads a proposito: se llega
        /// aqui DESPUES de ver que hay gente sin grupo, no
        /// antes. Y es «inscripciones» y no «inscritos» porque
        /// escribe sobre la ficha: poner la cohorte es atender
        /// la inscripcion, no mirarla.
        href: '/admin/participantes/grupos',
        etiqueta: 'Asignar grupo por lote',
        exacto: true,
        area: 'inscripciones',
      },
      {
        /// Los mismos participantes, cortados por accion de
        /// formacion. Vive aqui y no en «Sistemas de
        /// informacion» porque es una vista de la gente que se
        /// esta inscribiendo, no un dato que sostenga el
        /// reporte: quien la busca viene de la lista de leads.
        href: '/admin/inscritos',
        etiqueta: 'Inscritos por acción',
        exacto: true,
        area: 'inscritos',
      },
      {
        /// Una sola entrada, con dos pestañas dentro.
        ///
        /// Eran dos: «Panel Control de Inscritos» y «Control de
        /// inscritos». Contaban lo mismo por caminos distintos
        /// y nadie sabía a cuál entrar. La primera es hoy la
        /// pestaña «Metas y avance», y su ruta vieja redirige.
        href: '/admin/control',
        etiqueta: 'Control de Inscritos',
        area: 'inscritos',
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
