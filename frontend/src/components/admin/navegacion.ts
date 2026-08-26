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
  /// Se conserva mientras se fusiona con otra vista. Sale
  /// con una marca para que nadie lo dé por definitivo.
  temporal?: boolean;
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

/// El panel, agrupado por quién trabaja en cada cosa.
///
/// Antes estaba agrupado por etapa del proceso -- Pre-reserva,
/// Inscripciones, Inscritos --, y eso repartía una misma
/// pantalla entre dos grupos según en qué punto la mirara
/// uno. Ahora manda el área: inscripciones, sistemas de
/// información, académica. Cada quien encuentra lo suyo en un
/// solo sitio.
export const MODULOS: Modulo[] = [
  {
    /// Va primero porque manda sobre todo lo demás: sin
    /// fechas no se matricula, no se cierra inscripción y no
    /// sale ningún aviso.
    clave: 'cronograma',
    emoji: '📅',
    etiqueta: 'Cronograma',
    descripcion: 'Las fechas de la formación. De aquí cuelga el resto.',
    enlaces: [
      {
        href: '/admin/cronograma',
        etiqueta: 'Ver cronograma',
        exacto: true,
        area: 'reserva',
      },
    ],
  },
  {
    clave: 'inscripciones',
    emoji: '📝',
    etiqueta: 'Gestión de Inscripciones',
    descripcion: 'Convertir cupos en personas con nombre.',
    enlaces: [
      {
        href: '/admin/participantes',
        etiqueta: 'Gestión de leads',
        exacto: true,
        area: 'inscripciones',
      },
      {
        href: '/admin/participantes/seguimiento',
        etiqueta: 'Panel Control de Inscritos',
        area: 'inscripciones',
      },
      {
        /// Se queda mientras se fusiona con el panel de
        /// arriba. Los dos cuentan lo mismo por caminos
        /// distintos, y hay que poder compararlos antes de
        /// quedarse con uno.
        href: '/admin/control',
        etiqueta: 'Control de inscritos',
        area: 'inscritos',
        temporal: true,
      },
    ],
  },
  {
    clave: 'sistemas',
    emoji: '🗂️',
    etiqueta: 'Sistemas de Información',
    descripcion: 'Los datos que sostienen el reporte al SENA.',
    enlaces: [
      {
        href: '/admin/reservas',
        etiqueta: 'Reservas',
        area: 'reserva',
      },
      {
        href: '/admin/instituciones',
        etiqueta: 'Empresas registradas',
        exacto: true,
        area: 'reserva',
      },
      {
        href: '/admin/empresas',
        etiqueta: 'Empresas aliadas - afiliadas',
        area: 'reserva',
      },
      {
        href: '/admin/inscritos',
        etiqueta: 'Inscritos Acción Formación',
        exacto: true,
        area: 'inscritos',
      },
      { href: '/admin/sep', etiqueta: 'Reportes SENA', area: 'reportes' },
    ],
  },
  {
    clave: 'academico',
    emoji: '📈',
    etiqueta: 'Gestión Académica',
    descripcion: 'Quién va al día y quién no.',
    enlaces: [
      {
        /// Los dos se quedan mientras se define cómo se parte
        /// en seguimiento virtual y presencial.
        href: '/admin/participantes/academico/tablero',
        etiqueta: 'Tablero académico',
        area: 'academico',
        temporal: true,
      },
      {
        href: '/admin/participantes/academico',
        etiqueta: 'Avance',
        exacto: true,
        area: 'academico',
        temporal: true,
      },
    ],
  },
  {
    /// Los dos momentos del formulario público, no los
    /// formularios de reserva de las empresas: esos siguen en
    /// Configuración, que es donde se arman.
    clave: 'formularios',
    emoji: '📋',
    etiqueta: 'Formularios',
    descripcion: 'Lo que llena la persona, y su QR.',
    enlaces: [
      {
        href: '/admin/formularios-publicos/corto',
        etiqueta: 'Formulario 1 Corto',
        area: 'inscripciones',
      },
      {
        href: '/admin/formularios-publicos/largo',
        etiqueta: 'Formulario 2 Largo',
        area: 'inscripciones',
      },
    ],
  },
  {
    clave: 'configuracion',
    emoji: '⚙️',
    etiqueta: 'Configuración',
    descripcion: 'Lo que no es del día a día.',
    enlaces: [
      { href: '/admin/acciones', etiqueta: 'Formación', area: 'configuracion', nivel: 'ESCRIBIR' },
      { href: '/admin/formularios', etiqueta: 'Formularios', area: 'configuracion', nivel: 'ESCRIBIR' },
      { href: '/admin/politicas', etiqueta: 'Políticas', area: 'configuracion', nivel: 'ESCRIBIR' },
      { href: '/admin/marca', etiqueta: 'Apariencia', soloSuperadmin: true, area: 'configuracion', nivel: 'ESCRIBIR' },
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
