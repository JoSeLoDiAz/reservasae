"use client";

/** La cerradura de ENTRADA de una pantalla del panel. */

/**
 * POR QUÉ EXISTE ESTO (30 sep 2026, del repaso de QA).
 *
 * `enlacesVisibles` ya esconde del menú lo que la cuenta no
 * alcanza, y el comentario de «Configuración notas» en
 * `navegacion.ts` dice el motivo con todas las letras: «el menú
 * tiene que prometer lo que el servidor concede». Pero el menú NO
 * ES LA PUERTA. Con `lucia.parra@ejemplo.test` ---gestora de
 * inscripciones, `configuracion: NADA`--- la entrada no salía, y
 * aun así escribir `/admin/configuracion-notas` cargaba la
 * pantalla ENTERA: el catálogo, el formulario de añadir y
 * veinticuatro botones de Ocultar encendidos. El 403 llegaba solo
 * al pulsar.
 *
 * No era un agujero de datos ---el guard del servidor niega todas
 * las escrituras--- sino un panel de mandos que no se puede usar,
 * y eso confunde y hace pulsar.
 *
 * La cerradura sigue estando en el servidor. Esto es la MISMA
 * promesa del menú aplicada a la pantalla: el mismo `alcanza` y el
 * mismo par `area`/`nivel` que declara su entrada en
 * `navegacion.ts`. Si los dos dejan de coincidir, el menú vuelve a
 * prometer lo que la pantalla niega.
 */

import { IconoEscudo } from "./iconos";
import { useAdmin } from "./marco-admin";
import { Vacio } from "./piezas";
import { alcanza, type Area, type Nivel } from "@/lib/admin-api";

/**
 * Quién maneja cada área, dicho como lo diría una persona.
 *
 * Con el cargo y no con la llave técnica: a quien se topa con el
 * aviso no le sirve «le falta `configuracion` ESCRIBIR», le sirve
 * saber a quién pedirlo.
 */
const QUIEN_LA_MANEJA: Record<Area, string> = {
  reserva: "quien administra las reservas y el cronograma",
  inscripciones: "quien gestiona las inscripciones",
  inscritos: "quien administra los datos de los inscritos",
  reportes: "quien prepara los reportes al SENA",
  academico: "quien hace el seguimiento académico",
  configuracion: "quien administra la configuración",
};

/**
 * El aviso que sustituye a la pantalla.
 *
 * Las dos frases son LAS DEL SERVIDOR, copiadas del
 * `ForbiddenException` de `admin.guard.ts`: la pantalla y el 403
 * tienen que decir lo mismo, o quien los lea creerá que son dos
 * problemas distintos. Y va en `Vacio` porque es exactamente lo
 * que esa pieza es ---un bloque que dice POR QUÉ está vacío---, no
 * un error en rojo: no se ha roto nada.
 *
 * ELIGE LA FRASE POR LO QUE TIENE, NO POR LO QUE SE LE PIDE. El
 * servidor la elige por el nivel exigido, y con eso una cuenta con
 * el área en NADA leía «su rol permite consultar esta sección, no
 * modificarla» ---comprobado con `lucia.parra@ejemplo.test`, que
 * tiene `configuracion: NADA`---, o sea una invitación a buscar un
 * modo de solo lectura que no existe. Decir «permite consultar» a
 * quien no puede ni mirar manda a la persona a buscar un botón
 * que no está.
 */
function AvisoSinPermiso({ area, tiene }: { area: Area; tiene: Nivel }) {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <Vacio titulo="Esta pantalla no la maneja su cuenta" icono={IconoEscudo}>
        {tiene === "NADA"
          ? `Su rol no tiene acceso a esta sección: esta pantalla la maneja ${QUIEN_LA_MANEJA[area]}.`
          : `Su rol permite consultar esta sección, no modificarla: esta pantalla la maneja ${QUIEN_LA_MANEJA[area]}.`}
      </Vacio>
    </div>
  );
}

/**
 * Envuelve una pantalla del panel con el permiso que exige.
 *
 * Se usa en la línea del `export default`, dejando la pantalla
 * como una función normal:
 *
 * ```tsx
 * export default conPermiso("configuracion", "ESCRIBIR", PaginaX);
 * function PaginaX() { ... }
 * ```
 *
 * ENVOLVIENDO Y NO CON UN CORTE DENTRO DE LA PANTALLA, por dos
 * razones. Un `if (noAlcanza) return <Aviso/>` tiene que ir
 * DESPUÉS de todos los hooks ---si no, React se queja de que su
 * número cambia entre renders---, así que la pantalla ya habría
 * pedido sus datos al servidor para tirarlos; y en cada pantalla
 * el sitio exacto del corte es distinto, que es justo donde se
 * cuela el olvido. Envuelta, la pantalla NO SE MONTA: ni un hook,
 * ni una petición.
 */
export function conPermiso<P extends object>(
  area: Area,
  nivel: Nivel,
  Pantalla: React.ComponentType<P>,
): React.ComponentType<P> {
  function PantallaConPermiso(props: P) {
    const { admin } = useAdmin();

    /// SIN PERMISOS TODAVÍA NO SE CIERRA NADA. Es el mismo criterio
    /// que `enlacesVisibles`: mientras `/admin/yo` no responde,
    /// `permisos` viene sin poner, y cerrar por un dato que no ha
    /// llegado sacaría un «no tiene permiso» falso en cada recarga.
    if (admin.permisos && !alcanza(admin.permisos[area], nivel)) {
      return <AvisoSinPermiso area={area} tiene={admin.permisos[area]} />;
    }
    return <Pantalla {...props} />;
  }

  /// Para que el árbol de React siga diciendo qué pantalla es esta
  /// y no «PantallaConPermiso» siete veces.
  PantallaConPermiso.displayName = `conPermiso(${Pantalla.displayName ?? Pantalla.name ?? "Pantalla"})`;
  return PantallaConPermiso;
}
