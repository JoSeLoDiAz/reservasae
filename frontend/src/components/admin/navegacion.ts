/** Los módulos del panel, en el orden del proceso. */

import { alcanza, type Area, type Nivel } from '@/lib/admin-api';
import {
  IconoApariencia, IconoAvance, IconoBrecha, IconoCargar, IconoConfiguracion,
  IconoFormacion, IconoFormularios, IconoInscribir, IconoMatriculados,
  IconoOrganizaciones, IconoPerfil, IconoPoliticas, IconoReportes,
  IconoReservas, IconoResumen, IconoTablero, IconoUsuarios, type Icono,
} from './iconos';

export type Enlace = {
  href: string;
  etiqueta: string;
  exacto?: boolean;
  soloSuperadmin?: boolean;
  /// El área que hay que poder ver para que salga.
  area?: Area;
  /// Y con qué nivel: escribir para lo que no es consulta.
  nivel?: Nivel;
  icono?: Icono;
};

export type Modulo = {
  clave: string;
  /// El del módulo, para la barra plegada.
  icono?: Icono;
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
    icono: IconoResumen,
    paso: 1,
    etiqueta: 'Pre-reserva de cupos',
    descripcion: 'Lo que aparta la empresa afiliada, antes de que haya nombres.',
    enlaces: [
      { href: '/admin', etiqueta: 'Resumen', exacto: true, area: 'reserva' , icono: IconoResumen },
      { href: '/admin/reservas', etiqueta: 'Reservas', area: 'reserva' , icono: IconoReservas },
      { href: '/admin/empresas', etiqueta: 'Organizaciones', area: 'reserva' , icono: IconoOrganizaciones },
    ],
  },
  {
    clave: 'inscripciones',
    icono: IconoTablero,
    paso: 2,
    etiqueta: 'Inscripciones',
    descripcion: 'Convertir cupos en personas con nombre.',
    enlaces: [
      { href: '/admin/participantes', etiqueta: 'Tablero', exacto: true, area: 'inscripciones' , icono: IconoTablero },
      { href: '/admin/participantes/brecha', etiqueta: 'Brecha de nombres', area: 'inscripciones' , icono: IconoBrecha },
      { href: '/admin/participantes/carga', etiqueta: 'Cargar una lista', area: 'inscripciones', nivel: 'ESCRIBIR' , icono: IconoCargar },
      { href: '/admin/participantes/nuevo', etiqueta: 'Inscribir a alguien', area: 'inscripciones', nivel: 'ESCRIBIR' , icono: IconoInscribir },
    ],
  },
  {
    clave: 'inscritos',
    icono: IconoMatriculados,
    paso: 3,
    etiqueta: 'Inscritos',
    descripcion: 'Quien ya está matriculado y todavía no termina.',
    enlaces: [
      { href: '/admin/inscritos', etiqueta: 'Inscritos', exacto: true, area: 'inscritos' , icono: IconoMatriculados },
      { href: '/admin/sep', etiqueta: 'Reportes al SENA', area: 'reportes' , icono: IconoReportes },
    ],
  },
  {
    clave: 'academico',
    icono: IconoAvance,
    paso: 4,
    etiqueta: 'Seguimiento académico',
    descripcion: 'Quién va al día y quién no.',
    enlaces: [
      { href: '/admin/participantes/academico', etiqueta: 'Avance', exacto: true, area: 'academico' , icono: IconoAvance },
    ],
  },
  {
    clave: 'configuracion',
    icono: IconoConfiguracion,
    etiqueta: 'Configuración',
    descripcion: 'Lo que no es del día a día.',
    enlaces: [
      { href: '/admin/acciones', etiqueta: 'Formación', area: 'configuracion', nivel: 'ESCRIBIR' , icono: IconoFormacion },
      { href: '/admin/formularios', etiqueta: 'Formularios', area: 'configuracion', nivel: 'ESCRIBIR' , icono: IconoFormularios },
      { href: '/admin/politicas', etiqueta: 'Políticas', area: 'configuracion', nivel: 'ESCRIBIR' , icono: IconoPoliticas },
      { href: '/admin/marca', etiqueta: 'Apariencia', soloSuperadmin: true, area: 'configuracion', nivel: 'ESCRIBIR' , icono: IconoApariencia },
      { href: '/admin/usuarios', etiqueta: 'Usuarios', soloSuperadmin: true , icono: IconoUsuarios },
      { href: '/admin/perfil', etiqueta: 'Mi perfil' , icono: IconoPerfil },
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
