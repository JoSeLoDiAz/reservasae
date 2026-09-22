"use client";

/** La primera pantalla: los cinco módulos del Resumen, en pestañas. */

/**
 * CINCO MÓDULOS INDEPENDIENTES, Y SOLO UNO MONTADO.
 *
 * «Son módulos INDEPENDIENTES para no recargar el sitio. Al dar clic
 * que cargue las cosas, para no sobrecargar la página» (Josse, 22
 * sep 2026). Y tiene razón: apilados, entrar al panel disparaba
 * cuatro llamadas —una por módulo— y pintaba una pantalla de cinco
 * mil píxeles de alto que casi nadie recorría entera.
 *
 * Ahora la pestaña ES el montaje. Cada módulo se monta al abrirlo y
 * pide lo suyo entonces; el que no se abre no cuesta ni una
 * petición. No hay carga de página de por medio: se cambia el
 * parámetro de la dirección y React monta otro árbol.
 *
 * LA PESTAÑA VIVE EN LA DIRECCIÓN (`?modulo=`) y no en un estado
 * suelto, por tres cosas: «Atrás» funciona, el enlace se puede
 * compartir —«mira el módulo 4»— y recargar no devuelve al primero.
 * Es el mismo patrón que Control de Inscritos usa para `?pantalla`,
 * y por eso la página va dentro de un `Suspense`: `useSearchParams`
 * en un componente de cliente lo exige, o `next build` no puede
 * prerenderizar y falla.
 *
 * LO DE ANTES NO SE BORRÓ. El Resumen que había hasta el 22 sep
 * —veredicto, termómetro de la meta dentro del tope, ritmo por
 * acción, mapa y concentración— vive entero en `/admin/ocupacion`,
 * con su entrada de menú, y el módulo 1 lleva allí.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { BotonPdf, EncabezadoImpresion } from "@/components/admin/boton-pdf";
import { useAdmin } from "@/components/admin/marco-admin";
import { Cargando } from "@/components/admin/piezas";
import { ModuloReservas } from "@/components/admin/modulo-reservas";
import {
  ModuloAcademico,
  ModuloAsesores,
  ModuloLeads,
  ModuloTrafico,
  ProveedorDeControl,
} from "@/components/admin/modulos-resumen";
import { MODULOS_DEL_RESUMEN, TirasDeModulos } from "@/components/admin/piezas-modulo";

export default function Pagina() {
  return (
    <Suspense fallback={<Cargando que="Cargando el resumen…" />}>
      <Resumen />
    </Suspense>
  );
}

function Resumen() {
  const { admin } = useAdmin();
  const router = useRouter();
  const parametros = useSearchParams();

  /// Se LEE de la dirección en cada render, no se copia a un estado.
  /// Copiándolo, un enlace pulsado desde esta misma pantalla cambia
  /// el parámetro y la pestaña se queda donde estaba: es el defecto
  /// exacto que Control de Inscritos ya tuvo con `?pantalla`.
  const pedido = Number(parametros.get("modulo"));
  const activo = MODULOS_DEL_RESUMEN.some((m) => m.n === pedido) ? pedido : 1;
  const cual = MODULOS_DEL_RESUMEN.find((m) => m.n === activo)!;

  const irA = (n: number) => {
    /// `replace` y no `push`: cambiar de pestaña no es navegar, y
    /// con `push` el botón de atrás tendría que deshacer cada clic
    /// antes de salir de la pantalla.
    router.replace(n === 1 ? "/admin" : `/admin?modulo=${n}`, { scroll: false });
  };

  /// DE QUIÉN SON ESTAS CIFRAS.
  ///
  /// El gremio elegido recorta los cinco módulos y vive escondido en
  /// el menú del avatar: «no son 1600» (cliente, 22 sep 2026), que
  /// era la meta de un gremio donde el proyecto son 3.690.
  const suyo = admin.gremios?.find((g) => g.convenioId === admin.gremioElegido);
  const alcance = suyo
    ? suyo.sigla
    : (admin.gremios?.length ?? 0) > 1
      ? "todos los gremios"
      : (admin.gremios?.[0]?.sigla ?? null);

  return (
    <div className="resumen-impreso flex flex-col gap-3 px-4 pt-3 pb-6">
      {/* EL PAPEL DICE QUÉ MÓDULO TRAE. Con las pestañas, el PDF ya
          no es «el resumen»: es uno de los cinco. Sin decirlo, una
          hoja con el tráfico se leería como si fuera todo. */}
      <EncabezadoImpresion
        titulo={`Resumen · ${cual.corto}`}
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

        <BotonPdf etiqueta="PDF de este módulo" />
      </header>

      <TirasDeModulos activo={activo} alElegir={irA} />

      {/* SOLO EL ACTIVO SE MONTA. Eso es lo que hace que el módulo
          que no se abre no cueste ni una petición: cada uno pide lo
          suyo en su propio efecto, al montarse. */}
      {activo === 1 && <ModuloReservas />}
      {activo === 2 && (
        <ProveedorDeControl>
          <ModuloLeads />
        </ProveedorDeControl>
      )}
      {activo === 3 && <ModuloAcademico />}
      {activo === 4 && <ModuloTrafico />}
      {activo === 5 && (
        <ProveedorDeControl>
          <ModuloAsesores />
        </ProveedorDeControl>
      )}
    </div>
  );
}
