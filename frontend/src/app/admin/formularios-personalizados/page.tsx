"use client";

/** Los formularios que no son el general. */

/// Un formulario personalizado es el MISMO trámite público con
/// una puerta propia: se llega por una palabra suelta en el
/// enlace --`?TallerBootcamp`-- y esa palabra decide qué se
/// ofrece detrás. Sirve para convocar a un grupo concreto sin
/// publicarle la acción a todo el mundo.
///
/// Esta pantalla no los crea ni los edita, y es deliberado: lo
/// que un formulario abre puede ser una acción SIN publicar, y
/// eso no debería poder cambiarse desde aquí. Se escriben al
/// desplegar, en `formularios-personalizados.ts` del servidor.
/// Aquí se reparten: la dirección, el QR, y de un vistazo si la
/// acción que abren sigue teniendo cupo.

import { useEffect, useState } from "react";

import { EnlacePublico } from "@/components/admin/formulario-publico";
import { Bloque, Encabezado } from "@/components/admin/piezas";
import { useAdmin } from "@/components/admin/marco-admin";
import { adminApi, type FormularioPersonalizadoAdmin } from "@/lib/admin-api";

const ETIQUETA_MODALIDAD: Record<string, string> = {
  PRESENCIAL: "Presencial",
  VIRTUAL: "Virtual",
  HIBRIDA: "Híbrida",
};

export default function FormulariosPersonalizados() {
  const { gremio } = useAdmin();
  const [formularios, setFormularios] = useState<
    FormularioPersonalizadoAdmin[] | null
  >(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    void adminApi
      .formulariosPersonalizados()
      .then(setFormularios)
      .catch(() => setFallo(true));
  }, []);

  const origen = typeof window === "undefined" ? "" : window.location.origin;
  /// El gremio de arriba manda, igual que en el resto del panel.
  const suyos = (formularios ?? []).filter(
    (f) => !gremio || f.convenioId === gremio,
  );

  return (
    /// Sin `min-h-0 grow`: aquí no scrollea nada de dentro. La
    /// explicación larga está en `usuarios/page.tsx`.
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      {/* LA MISMA CABECERA QUE LOS TABLEROS, en tarjeta y de 56 px.
          «¿No se puede dejar como los títulos de los tableros, o sea
          que le dé estética?» (cliente, 23 sep 2026). Era un h1 suelto
          sobre el fondo, así que esta pantalla no se parecía a ninguna
          otra. */}
      <Encabezado compacto titulo="Formularios personalizados" />

      {/* Y LA EXPLICACIÓN, A TODO LO LARGO. Iba con `max-w-3xl` --768
          px-- y partía en tres renglones con el último a medias: «no sé
          por qué queda cortado, déjalo a lo largo». Sin el tope cabe en
          uno o dos según el ancho, y no se corta nunca. */}
      <p className="-mt-1 text-[0.8125rem] leading-snug text-texto-suave">
        El mismo formulario público, con una puerta propia. La palabra del final
        del enlace decide qué se ofrece detrás, y por eso cada uno se reparte
        solo a quien se quiere convocar.
      </p>

      {fallo && (
        <Bloque titulo="No se pudo cargar">
          <p className="text-sm text-texto-suave">
            Vuelva a entrar a la pantalla. Si sigue igual, es del servidor.
          </p>
        </Bloque>
      )}

      {!fallo && formularios === null && (
        <Bloque>
          <p className="text-sm text-texto-suave">Cargando…</p>
        </Bloque>
      )}

      {!fallo && formularios !== null && suyos.length === 0 && (
        <Bloque titulo="Todavía no hay ninguno">
          <p className="text-sm text-texto-suave">
            Los formularios personalizados se escriben al desplegar, no desde
            esta pantalla: lo que abren puede ser una acción de formación sin
            publicar. Pídalo y aparece aquí.
          </p>
        </Bloque>
      )}

      {suyos.map((f) => (
        <FormularioPersonalizado
          key={`${f.slug}-${f.palabra}`}
          formulario={f}
          url={`${origen}/${f.slug}/preinscripcion?${f.palabra}`}
        />
      ))}
    </div>
  );
}

function FormularioPersonalizado({
  formulario: f,
  url,
}: {
  formulario: FormularioPersonalizadoAdmin;
  url: string;
}) {
  const accion = f.accion;

  return (
    <>
      <Bloque titulo={`${f.titulo} · ${f.sigla}`} descripcion={f.descripcion}>
        {accion ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-marca-suave px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-marca">
                {accion.codigo}
              </span>
              <span className="rounded-md bg-superficie-alterna px-2 py-0.5 text-xs font-semibold tracking-wide text-texto-suave uppercase">
                {ETIQUETA_MODALIDAD[accion.modalidad] ?? accion.modalidad}
              </span>
              {accion.horas != null && (
                <span className="rounded-md bg-superficie-alterna px-2 py-0.5 text-xs text-texto-suave">
                  {accion.horas} horas
                </span>
              )}
            </div>

            <p className="text-sm font-medium">{accion.nombre}</p>

            {/* El aviso que de verdad importa: si alguien la
                publicó, este formulario dejó de ser el único sitio
                donde se ve, y eso no se nota por ninguna otra
                parte. */}
            {accion.publicada ? (
              <p className="rounded-xl border border-aviso/40 bg-aviso/10 px-4 py-3 text-sm text-aviso">
                Esta acción está <strong>publicada</strong>: además de por este
                enlace, sale en el formulario general para todo el mundo. Si no
                era la idea, ocúltela en Formación.
              </p>
            ) : (
              <p className="text-sm text-texto-suave">
                No está publicada: <strong>solo</strong> se llega a ella por
                este enlace, y ahí viene ya elegida porque es la única que
                ofrece.
              </p>
            )}

            {accion.ofertas.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs tracking-wide text-texto-suave uppercase">
                  Dónde se puede tomar
                </h3>
                <ul className="space-y-1 text-sm">
                  {accion.ofertas.map((o) => (
                    <li key={o.ubicacion} className="flex flex-wrap gap-x-2">
                      <span className="font-medium">{o.ubicacion}</span>
                      {o.departamento && (
                        <span className="text-texto-suave">
                          {o.departamento}
                        </span>
                      )}
                      <span
                        className={
                          o.libres <= 10
                            ? "font-medium text-error"
                            : "text-texto-suave"
                        }
                      >
                        {o.libres} de {o.cupos} libres
                      </span>
                    </li>
                  ))}
                </ul>
                {/* Quien reparte el enlace tiene que saber esto, y
                    no se ve por ningún otro lado: una oferta de
                    ciudad la ve SOLO quien dice vivir en esa
                    ciudad, no quien vive al lado. */}
                <p className="mt-2 text-xs text-texto-suave">
                  Cada sede la ve solo quien diga vivir en ese municipio. Para
                  que la vea todo el departamento, la oferta tiene que ser de
                  departamento y no de ciudad.
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-borde bg-superficie px-4 py-3 text-sm text-texto-suave">
                No tiene ninguna oferta abierta, así que hoy este enlace no
                enseña nada. Ábrale una oferta en Formación.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-texto-suave">
            No fija ninguna acción de formación: ofrece lo mismo que el
            formulario general.
          </p>
        )}

        {/* El aliado se ENSEÑA, no se describe: quien reparte el
            enlace tiene que reconocer de un vistazo el logo que
            va a ver la persona, y «lleva el logo de Santillana»
            no sirve para comprobar que es el archivo correcto. */}
        {f.aliado && (
          <div className="mt-4 border-t border-borde pt-4">
            <h3 className="mb-2 text-xs tracking-wide text-texto-suave uppercase">
              En alianza con
            </h3>
            <span className="inline-block rounded-xl bg-white px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.aliado.logo}
                alt={f.aliado.nombre}
                className="h-10 w-auto object-contain"
              />
            </span>
            <p className="mt-2 text-sm text-texto-suave">
              Sale en la banda de arriba del formulario y en la pantalla de
              confirmación. Solo por este enlace: en el general no aparece.
            </p>
          </div>
        )}
      </Bloque>

      <EnlacePublico sigla={`${f.titulo} · ${f.sigla}`} url={url} />
    </>
  );
}
