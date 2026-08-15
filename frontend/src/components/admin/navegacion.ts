/** Los módulos del panel, en el orden del proceso. */

export type Enlace = {
  href: string;
  etiqueta: string;
  exacto?: boolean;
  soloSuperadmin?: boolean;
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
      { href: '/admin', etiqueta: 'Resumen', exacto: true },
      { href: '/admin/reservas', etiqueta: 'Reservas' },
      { href: '/admin/empresas', etiqueta: 'Organizaciones' },
    ],
  },
  {
    clave: 'inscripciones',
    paso: 2,
    etiqueta: 'Inscripciones',
    descripcion: 'Convertir cupos en personas con nombre.',
    enlaces: [
      { href: '/admin/participantes', etiqueta: 'Tablero', exacto: true },
      { href: '/admin/participantes/brecha', etiqueta: 'Brecha de nombres' },
      { href: '/admin/participantes/carga', etiqueta: 'Cargar una lista' },
      { href: '/admin/participantes/nuevo', etiqueta: 'Inscribir a alguien' },
    ],
  },
  {
    clave: 'inscritos',
    paso: 3,
    etiqueta: 'Inscritos',
    descripcion: 'Quien ya está matriculado y todavía no termina.',
    enlaces: [
      { href: '/admin/inscritos', etiqueta: 'Matriculados', exacto: true },
      { href: '/admin/sep', etiqueta: 'Reportes al SENA' },
    ],
  },
  {
    clave: 'academico',
    paso: 4,
    etiqueta: 'Seguimiento académico',
    descripcion: 'Quién va al día y quién no.',
    enlaces: [
      { href: '/admin/participantes/academico', etiqueta: 'Avance', exacto: true },
    ],
  },
  {
    clave: 'configuracion',
    etiqueta: 'Configuración',
    descripcion: 'Lo que no es del día a día.',
    enlaces: [
      { href: '/admin/acciones', etiqueta: 'Formación' },
      { href: '/admin/formularios', etiqueta: 'Formularios' },
      { href: '/admin/politicas', etiqueta: 'Políticas' },
      { href: '/admin/marca', etiqueta: 'Apariencia' },
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
