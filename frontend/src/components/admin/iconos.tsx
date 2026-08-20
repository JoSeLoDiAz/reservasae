/** Los iconos del panel, dibujados aquí. */

type Props = { className?: string; tamano?: number };

/**
 * Trazo de 1.75 sobre lienzo de 24, con extremos
 * redondeados. Van dibujados en vez de importados para
 * no traer un paquete de mil iconos por usar quince.
 * `currentColor` los hace obedecer al tema.
 */
function Svg({
  children,
  tamano = 18,
  className,
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export type Icono = (p: Props) => React.ReactElement;

export const IconoResumen: Icono = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="8" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="11" width="7" height="10" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </Svg>
);

export const IconoReservas: Icono = (p) => (
  <Svg {...p}>
    <path d="M3 7.5 5 4h14l2 3.5" />
    <path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.5Z" />
    <path d="M3 12h5l1.5 2.5h5L16 12h5" />
  </Svg>
);

export const IconoOrganizaciones: Icono = (p) => (
  <Svg {...p}>
    <path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
    <path d="M14 10h4a2 2 0 0 1 2 2v9" />
    <path d="M2 21h20" />
    <path d="M7.5 8h3M7.5 12h3M7.5 16h3M17 14h.01M17 17.5h.01" />
  </Svg>
);

export const IconoTablero: Icono = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="9.5" y="4" width="5" height="10" rx="1.5" />
    <rect x="16" y="4" width="5" height="13" rx="1.5" />
  </Svg>
);

export const IconoBrecha: Icono = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3 20a6 6 0 0 1 10.5-3.95" />
    <path d="M18 13v4" />
    <path d="M18 20.5h.01" />
  </Svg>
);

export const IconoCargar: Icono = (p) => (
  <Svg {...p}>
    <path d="M12 15V3.5" />
    <path d="m8 7.5 4-4 4 4" />
    <path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16" />
  </Svg>
);

export const IconoInscribir: Icono = (p) => (
  <Svg {...p}>
    <circle cx="10" cy="8" r="3.25" />
    <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M18.5 5.5v5M16 8h5" />
  </Svg>
);

export const IconoMatriculados: Icono = (p) => (
  <Svg {...p}>
    <path d="m12 4 9 4.5-9 4.5-9-4.5L12 4Z" />
    <path d="M6.5 11v5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-5" />
    <path d="M21 8.5V14" />
  </Svg>
);

export const IconoReportes: Icono = (p) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 16.5h4" />
  </Svg>
);

export const IconoAvance: Icono = (p) => (
  <Svg {...p}>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="m7.5 15 3.5-4 3 2.5L20 7" />
    <path d="M16.5 7H20v3.5" />
  </Svg>
);

export const IconoFormacion: Icono = (p) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.75 1.75 0 0 0-1.75-1.75H5.5A1.5 1.5 0 0 1 4 15.75Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.75 1.75 0 0 1 1.75-1.75h4.75A1.5 1.5 0 0 0 20 15.75Z" />
  </Svg>
);

export const IconoFormularios: Icono = (p) => (
  <Svg {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="m7.5 8.5 1.25 1.25L11 7.5" />
    <path d="m7.5 15 1.25 1.25L11 14" />
    <path d="M13.5 9h3M13.5 15.5h3" />
  </Svg>
);

export const IconoPoliticas: Icono = (p) => (
  <Svg {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 8.9 4.1-1.3 7-4.7 7-8.9V6Z" />
    <path d="m9.25 12 2 2 3.5-3.75" />
  </Svg>
);

export const IconoApariencia: Icono = (p) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c.9 0 1.5-.7 1.5-1.5 0-.4-.15-.75-.4-1-.25-.28-.4-.62-.4-1 0-.83.67-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8Z" />
    <circle cx="7.5" cy="11" r="1" />
    <circle cx="10.5" cy="7" r="1" />
    <circle cx="15" cy="7.5" r="1" />
  </Svg>
);

export const IconoUsuarios: Icono = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.25 3.25 0 0 1 0 5.6" />
    <path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
  </Svg>
);

export const IconoPerfil: Icono = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3" />
    <path d="M5.8 18.5a7 7 0 0 1 12.4 0" />
  </Svg>
);

export const IconoConfiguracion: Icono = (p) => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="14" cy="18" r="2" />
  </Svg>
);

export const IconoIzquierda: Icono = (p) => (
  <Svg {...p}>
    <path d="m14.5 5-6 7 6 7" />
  </Svg>
);

export const IconoDerecha: Icono = (p) => (
  <Svg {...p}>
    <path d="m9.5 5 6 7-6 7" />
  </Svg>
);

export const IconoSalir: Icono = (p) => (
  <Svg {...p}>
    <path d="M9.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3.5" />
    <path d="M15 8.5 18.5 12 15 15.5" />
    <path d="M18.5 12H9" />
  </Svg>
);

export const IconoMenu: Icono = (p) => (
  <Svg {...p}>
    <path d="M4 6.5h16M4 12h16M4 17.5h16" />
  </Svg>
);

export const IconoCerrar: Icono = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconoAccesibilidad: Icono = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="4.5" r="1.75" />
    <path d="M4.5 8.5c2.5 1 5 1.5 7.5 1.5s5-.5 7.5-1.5" />
    <path d="M12 9.5V14" />
    <path d="m12 14-2.5 6M12 14l2.5 6" />
  </Svg>
);

export const IconoCronograma: Icono = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 3v4M16 3v4" />
    <path d="M7 14h4M7 17.5h7" />
  </Svg>
);

export const IconoBuscar = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconoFiltro = (p: Props) => (
  <Svg {...p}>
    <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />
  </Svg>
);

export const IconoColumnas = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15 4v16" />
  </Svg>
);

export const IconoVista = (p: Props) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconoOrden = (p: Props) => (
  <Svg {...p}>
    <path d="M8 5v14M8 19l-3-3M8 19l3-3M16 19V5M16 5l-3 3M16 5l3 3" />
  </Svg>
);

export const IconoArriba = (p: Props) => (
  <Svg {...p}>
    <path d="m6 15 6-6 6 6" />
  </Svg>
);

export const IconoAbajo = (p: Props) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconoCheck = (p: Props) => (
  <Svg {...p}>
    <path d="m5 13 4 4L19 7" />
  </Svg>
);

export const IconoGuardar = (p: Props) => (
  <Svg {...p}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M9 4v5h6V4M8 20v-6h8v6" />
  </Svg>
);

export const IconoPapelera = (p: Props) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Svg>
);
