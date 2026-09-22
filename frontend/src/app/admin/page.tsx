"use client";

/** La primera pantalla: los cinco módulos del Resumen. */

/**
 * CINCO MÓDULOS Y NADA MÁS.
 *
 * «En el resumen quiero que se proyecten cuatro módulos… y aquí por
 * último el cuarto es el tráfico de la página» (cliente, 22 sep
 * 2026), más el quinto que pidió Catalina, el de los asesores.
 * Después, preguntado por los once bloques que había antes: «bajan
 * todos, sin excepción».
 *
 * NO SE BORRÓ NINGUNO. El Resumen de antes —el veredicto, el
 * termómetro de la meta dentro del tope, el ritmo por acción, el
 * mapa, la cobertura territorial y la concentración— vive entero en
 * `/admin/ocupacion`, y el módulo 1 lleva allí. Borrar diez bloques
 * porque no caben en una pantalla nueva es perder trabajo que
 * alguien decidió; moverlos, no.
 *
 * «ESTO ES UN RESUMEN, EL DETALLE QUEDA COMO ESTÁ.» Ningún módulo
 * calcula nada ni repite una tabla: cada uno llama a la ruta que ya
 * sirve su informe en Control de Inscritos, pinta cuatro cifras y un
 * corte, y enlaza al detalle con el recorte puesto.
 *
 * CADA MÓDULO PIDE LO SUYO. Antes era un `Promise.all` de cinco
 * llamadas y bastaba un 403 para dejar en blanco la pantalla de
 * entrada. Ahora cada bloque mira su permiso antes de pedir, y el
 * que no puede dice por qué.
 */

import { BotonPdf, EncabezadoImpresion } from "@/components/admin/boton-pdf";
import { useAdmin } from "@/components/admin/marco-admin";
import { ModuloReservas } from "@/components/admin/modulo-reservas";
import {
  ModuloAcademico,
  ModuloAsesores,
  ModuloLeads,
  ModuloTrafico,
  ProveedorDeControl,
} from "@/components/admin/modulos-resumen";

export default function Resumen() {
  const { admin } = useAdmin();

  /// DE QUIÉN SON ESTAS CIFRAS.
  ///
  /// El gremio elegido recorta los cinco módulos y vive escondido en
  /// el menú del avatar: «no son 1600» (cliente, 22 sep 2026), que
  /// era la meta de un gremio donde el proyecto son 3.690. Va en el
  /// subtítulo y en el encabezado de IMPRESIÓN, que es donde más
  /// daño hace: esta pantalla se lleva en PDF a una reunión, y ahí
  /// el número viaja sin el menú del que salió.
  const suyo = admin.gremios?.find((g) => g.convenioId === admin.gremioElegido);
  const alcance = suyo
    ? suyo.sigla
    : (admin.gremios?.length ?? 0) > 1
      ? "todos los gremios"
      : (admin.gremios?.[0]?.sigla ?? null);

  return (
    <div className="resumen-impreso flex flex-col gap-3 px-4 pt-3 pb-6">
      <EncabezadoImpresion
        titulo="Resumen"
        subtitulo={`Convocatorias en curso${alcance ? ` · ${alcance}` : ""}`}
      />

      <header className="no-imprimir flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.125rem] font-bold tracking-[-0.02em] text-titulo">
            Hola, {admin.nombre.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-[0.78125rem] text-texto-suave">
            Todo lo que pasa en sus convocatorias, en una sola vista
            {alcance && (
              <>
                {" · "}
                <span className="font-semibold text-texto">{alcance}</span>
              </>
            )}
          </p>
        </div>

        <BotonPdf etiqueta="PDF para reunión" />
      </header>

      {/* El orden ES el que pidió el cliente. Los módulos 2 y 5
          comparten una sola llamada —`porAsesor` viaja dentro de la
          misma respuesta— y el dato se levanta al proveedor justo
          para que eso no decida dónde se pintan. */}
      <div className="flex flex-col gap-3">
        <ModuloReservas />
        <ProveedorDeControl>
          <ModuloLeads />
          <ModuloAcademico />
          <ModuloTrafico />
          <ModuloAsesores />
        </ProveedorDeControl>
      </div>
    </div>
  );
}
