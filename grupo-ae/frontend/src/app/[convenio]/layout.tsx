/**
 * Sin paleta propia del convenio.
 *
 * La inyectaba aqui y hacia que el formulario corto se viera
 * rosa mientras el largo, que no pasa por esta ruta, se veia
 * azul. Dos pantallas del mismo tramite con dos aspectos
 * distintos confunden mas de lo que aporta el color de marca.
 *
 * Los colores por convenio siguen configurandose en el panel,
 * en Apariencia. Desde el 27 ago 2026 la paleta del gremio la
 * emite el layout RAIZ por HOST, no por ruta: en el
 * subdominio de un gremio el formulario corto, el largo y
 * /completar salen iguales porque comparten dominio. No la
 * vuelvas a inyectar aqui: por ruta es lo que las separaba.
 */
export default function LayoutConvenio({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
