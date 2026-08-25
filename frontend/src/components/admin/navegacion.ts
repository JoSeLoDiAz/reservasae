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

/// El proceso, de la silla a la certificación.
export const MODULOS: Modulo[] = [
  {
    /// Va antes del paso 1 y sin número a propósito: no es
    /// una etapa del proceso, es lo que el proceso consulta.
    /// Aquí aterriza lo que averiguan el RUES y el buscador,
    /// y aquí se decide qué de eso puede llegar al SENA.
    clave: 'maestros',
    emoji: '🏢',
    etiqueta: 'Datos de empresas',
    descripcion: 'El banco de NIT y lo que se sabe de cada organización.',
    enlaces: [
      {
        href: '/admin/instituciones',
        etiqueta: 'Empresas Registradas',
        exacto: true,
        area: 'reserva',
      },
      {
        href: '/admin/instituciones/pendientes',
        etiqueta: 'Por revisar',
        area: 'reserva',
      },
    ],
  },
  {
    clave: 'reserva',
    emoji: '🎫',
    etiqueta: 'Pre-reserva',
    descripcion: 'Lo que aparta la empresa afiliada, antes de que haya nombres.',
    enlaces: [
      { href: '/admin', etiqueta: 'Resumen', exacto: true, area: 'reserva'  },
      { href: '/admin/reservas', etiqueta: 'Reservas', area: 'reserva'  },
      { href: '/admin/empresas', etiqueta: 'Organizaciones', area: 'reserva'  },
      { href: '/admin/cronograma', etiqueta: 'Cronograma', area: 'reserva' },
    ],
  },
  {
    clave: 'inscripciones',
    emoji: '📝',
    etiqueta: 'Inscripciones',
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
        etiqueta: 'Panel de seguimiento',
        area: 'inscripciones',
      },
    ],
  },
  {
    clave: 'inscritos',
    emoji: '🎓',
    etiqueta: 'Inscritos',
    descripcion: 'Quien ya está matriculado y todavía no termina.',
    enlaces: [
      { href: '/admin/inscritos', etiqueta: 'Inscritos', exacto: true, area: 'inscritos'  },
      { href: '/admin/control', etiqueta: 'Control de inscritos', area: 'inscritos' },
      { href: '/admin/sep', etiqueta: 'Reportes al SENA', area: 'reportes'  },
    ],
  },
  {
    clave: 'academico',
    emoji: '📈',
    etiqueta: 'Seguimiento académico',
    descripcion: 'Quién va al día y quién no.',
    enlaces: [
      { href: '/admin/participantes/academico/tablero', etiqueta: 'Tablero académico', area: 'academico' },
      { href: '/admin/participantes/academico', etiqueta: 'Avance', exacto: true, area: 'academico'  },
    ],
  },
  {
    clave: 'configuracion',
    emoji: '⚙️',
    etiqueta: 'Configuración',
    descripcion: 'Lo que no es del día a día.',
    enlaces: [
      { href: '/admin/acciones', etiqueta: 'Formación', area: 'configuracion', nivel: 'ESCRIBIR'  },
      { href: '/admin/formularios', etiqueta: 'Formularios', area: 'configuracion', nivel: 'ESCRIBIR'  },
      { href: '/admin/politicas', etiqueta: 'Políticas', area: 'configuracion', nivel: 'ESCRIBIR'  },
      { href: '/admin/marca', etiqueta: 'Apariencia', soloSuperadmin: true, area: 'configuracion', nivel: 'ESCRIBIR'  },
      { href: '/admin/usuarios', etiqueta: 'Usuarios', soloSuperadmin: true  },
      { href: '/admin/perfil', etiqueta: 'Mi perfil'  },
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
