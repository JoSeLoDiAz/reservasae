import PaginaBbddLeads from "../page";

/**
 * LA SUBVISTA DE CARGUE, con su propia dirección.
 *
 * «¿Esto, al ir a la subvista para cargar? O sea, ¿sí es claro lo que
 * pido?» (cliente, 6 oct 2026), señalando el bloque de cargue encima
 * de la lista.
 *
 * Cargar una base y trabajar los leads son dos tareas distintas: el
 * formulario ocupaba media pantalla de quien solo venía a mirar, y la
 * lista de 1.252 personas estorbaba a quien venía a cargar.
 *
 * DIRECCIÓN PROPIA Y NO UNA PESTAÑA, para que se pueda llegar de un
 * enlace, volver con el botón del navegador y mandársela a alguien.
 *
 * Y EL MISMO COMPONENTE, no una copia: las dos vistas comparten el
 * gremio que se está mirando, las cuatro cifras de arriba y la recarga
 * después de aplicar. Dos ficheros duplicarían eso, y el día que una
 * cambie la otra se queda atrás.
 */
export default function PaginaCargarBbddLeads() {
  return <PaginaBbddLeads vista="cargue" />;
}
