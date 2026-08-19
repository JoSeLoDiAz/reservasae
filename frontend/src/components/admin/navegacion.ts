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
  /** El número que se ve en el menú. */
  paso?: number;
  etiqueta: string;
  descripcion: string;
  enlaces: Enlace[];
};

/// El proceso, de la silla a la certificación.
export const MODULOS: Modulo[] = [
  {
    clave: 'reserva',
    paso: 1,
    etiqueta: 'Pre-reserva de cupos',
    descripcion: 'Lo que aparta la empresa afiliada, antes de que haya nombres.',
    enlaces: [
      { href: '/admin', etiqueta: 'Resumen', exacto: true, area: 'reserva' },
      { href: '/admin/reservas', etiqueta: 'Reservas', area: 'reserva' },
      { href: '/admin/empresas', etiqueta: 'Organizaciones', area: 'reserva' },
    ],
  },
  {
    clave: 'inscripciones',
    paso: 2,
    etiqueta: 'Inscripciones',
    descripcion: 'Convertir cupos en personas con nombre.',
    enlaces: [
      { href: '/admin/participantes', etiqueta: 'Tablero', exacto: true, area: 'inscripciones' },
      { href: '/admin/participantes/brecha', etiqueta: 'Brecha de nombres', area: 'inscripciones' },
      { href: '/admin/participantes/carga', etiqueta: 'Cargar una lista', area: 'inscripciones', nivel: 'ESCRIBIR' },
      { href: '/admin/participantes/nuevo', etiqueta: 'Inscribir a alguien', area: 'inscripciones', nivel: 'ESCRIBIR' },
    ],
  },
  {
    clave: 'inscritos',
    paso: 3,
    etiqueta: 'Inscritos',
    descripcion: 'Quien ya está matriculado y todavía no termina.',
    enlaces: [
      { href: '/admin/inscritos', etiqueta: 'Matriculados', exacto: true, area: 'inscritos' },
      { href: '/admin/sep', etiqueta: 'Reportes al SENA', area: 'reportes' },
    ],
  },
  {
    clave: 'academico',
    paso: 4,
    etiqueta: 'Seguimiento académico',
    descripcion: 'Quién va al día y quién no.',
    enlaces: [
      { href: '/admin/participantes/academico', etiqueta: 'Avance', exacto: true, area: 'academico' },
    ],
  },
  {
    clave: 'configuracion',
    etiqueta: 'Configuración',
    descripcion: 'Lo que no es del día a día.',
    enlaces: [
      { href: '/admin/acciones', etiqueta: 'Formación', area: 'configuracion', nivel: 'ESCRIBIR' },
      { href: '/admin/formularios', etiqueta: 'Formularios', area: 'configuracion', nivel: 'ESCRIBIR' },
      { href: '/admin/politicas', etiqueta: 'Políticas', area: 'configuracion', nivel: 'ESCRIBIR' },
      { href: '/admin/marca', etiqueta: 'Apariencia', area: 'configuracion', nivel: 'ESCRIBIR' },
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
