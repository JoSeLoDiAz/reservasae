/**
 * Sin paleta propia del convenio.
 *
 * La inyectaba aqui y hacia que el formulario corto se viera
 * rosa mientras el largo, que no pasa por esta ruta, se veia
 * azul. Dos pantallas del mismo tramite con dos aspectos
 * distintos confunden mas de lo que aporta el color de marca.
 *
 * Los colores por convenio siguen configurandose en el panel,
 * en Apariencia; simplemente ya no tinen esta pantalla. Para
 * devolverlos basta volver a inyectar `estilosDeMarca`.
 */
export default function LayoutConvenio({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
