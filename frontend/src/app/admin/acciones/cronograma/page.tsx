/**
 * El cronograma: los grupos de cada acción con sus fechas.
 *
 * Comparte la lista con el catálogo --son las dos caras de la
 * misma, lo dice el comentario de `acciones/page.tsx`-- y lo que
 * cambia es el zoom: allí cada acción es una fila con su
 * interruptor de publicar; aquí se abre y da sus grupos.
 *
 * Es una RUTA y no una pestaña: las dos se eligen desde el menú
 * de Calendario en la cabecera, que es donde el cliente las
 * quiere (12 sep 2026). Así la vista se puede enlazar, marcar y
 * llevar en la miga.
 *
 * Está en `cronograma/` y no en `[id]/`: un segmento fijo gana al
 * dinámico, así que la ficha de cada acción sigue funcionando.
 *
 * La consulta que hay debajo trae todas las acciones por sus
 * grupos por sus coberturas, con un conteo de participantes por
 * cobertura. Por eso vive en su propia ruta y no montada siempre
 * al lado del catálogo: así solo se dispara cuando alguien entra
 * a mirar fechas.
 */

import { CronogramaVista } from "@/components/admin/cronograma-vista";

export default function PaginaCronograma() {
  return <CronogramaVista />;
}
