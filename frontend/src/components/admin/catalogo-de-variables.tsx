"use client";

/** Lo que se puede poner entre llaves, para pegarlo con un clic. */

/// Vive aparte porque lo usan los DOS sitios donde se escribe
/// un correo: la plantilla que se manda desde una ficha y la
/// campaña que sale a una lista. Tenían cada uno su copia y no
/// se parecían -- una con secciones y buscador, la otra una
/// tira de dieciséis --, y es exactamente el mismo catálogo.
///
/// Se pega con un clic y no se escribe a mano: así es como se
/// cuela un `{{nombrecompleto}}` con la ce minúscula, que el
/// servidor rechaza y quien lo escribió no entiende por qué.

import { useState } from "react";

import { IconoBuscar } from "./iconos";
import type { VariableCorreo } from "@/lib/plantillas-correo-api";

/// Cómo se reparten las variables. Es reparto de PRESENTACIÓN:
/// el catálogo del servidor manda, y lo que llegue y no esté
/// aquí cae en «Otros» en vez de desaparecer.
///
/// El saludo va aparte y de primeras aunque sean solo dos.
/// Estaba metido con el nombre, el apellido y la cédula, y ahí
/// no se encuentra: quien abre esto casi siempre viene a poner
/// con qué se ABRE el correo, que es la primera línea que
/// escribe. Y son las dos que más se confunden entre sí
/// --`tratamiento` da «Sra.» y `saludo` da «Estimada Sra.
/// Caro»--, así que verlas juntas y solas es lo que hace
/// evidente cuál se quiere.
export const GRUPOS_DE_VARIABLE: Array<{ titulo: string; claves: string[] }> = [
  { titulo: "El saludo", claves: ["tratamiento", "saludo"] },
  {
    titulo: "Su nombre y documento",
    claves: ["primerNombre", "nombreCompleto", "primerApellido", "documento"],
  },
  { titulo: "Cómo contactarlo", claves: ["correo", "celular", "empresa"] },
  {
    titulo: "Su formación",
    claves: [
      "accionFormacion",
      "grupo",
      "fechaInicio",
      "ubicacion",
      "modalidad",
      "asesor",
      "gremio",
    ],
  },
];

export function CatalogoDeVariables({
  variables,
  alPegar,
}: {
  variables: VariableCorreo[];
  /// Qué hacer con la clave elegida. Quien llama decide dónde
  /// cae: en la posición del cursor, que es lo que se quiere.
  alPegar: (clave: string) => void;
}) {
  /// La búsqueda vive aquí y no fuera: el panel se desmonta al
  /// cerrarlo, así que se limpia sola y no reaparece filtrada
  /// desde la vez pasada.
  const [consulta, setConsulta] = useState("");

  const q = consulta.trim().toLocaleLowerCase("es-CO");
  const casa = (v: VariableCorreo) =>
    !q ||
    v.clave.toLocaleLowerCase("es-CO").includes(q) ||
    v.titulo.toLocaleLowerCase("es-CO").includes(q) ||
    v.ejemplo.toLocaleLowerCase("es-CO").includes(q);

  const repartidas = new Set(GRUPOS_DE_VARIABLE.flatMap((g) => g.claves));
  const grupos = [
    ...GRUPOS_DE_VARIABLE.map((g) => ({
      titulo: g.titulo,
      items: g.claves.flatMap((c) => {
        const v = variables.find((x) => x.clave === c);
        return v && casa(v) ? [v] : [];
      }),
    })),
    /// Lo que traiga el servidor y no esté repartido arriba.
    /// Sin esto, añadir una variable en el backend la haría
    /// invisible en el panel y nadie sabría por qué.
    {
      titulo: "Otros",
      items: variables.filter((v) => !repartidas.has(v.clave) && casa(v)),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="mt-2.5 rounded-sm border border-borde bg-superficie-alterna p-3.5">
      {/* De lado a lado. Recortado quedaba como un trozo suelto
          sobre cuatro columnas que sí llegan al borde, y el
          bloque entero se leía partido. */}
      <div className="mb-3.5 flex items-center gap-2 rounded-sm border border-borde bg-superficie px-3 py-[7px]">
        <IconoBuscar tamano={14} className="shrink-0 text-texto-suave" />
        <input
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar dato"
        />
      </div>

      {/* En columnas, como el bloque de las etapas.
          Antes era una lista de dieciséis que scrolleaba dentro
          de una caja de 300 px: los rótulos de sección pasaban
          de largo y no se sabía qué había debajo de cuál. Así
          caben las cuatro secciones enteras a la vista, que es
          justo lo que hay que responder al abrir esto —«¿en
          cuál está lo que busco?»— y no hace falta scrollear. */}
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {grupos.map((g) => (
          <div key={g.titulo}>
            <p className="mb-2 text-[10.5px] font-bold tracking-[0.05em] uppercase text-texto-suave opacity-75">
              {g.titulo}
            </p>
            <div className="flex flex-col">
              {g.items.map((v) => (
                <button
                  key={v.clave}
                  type="button"
                  onClick={() => alPegar(v.clave)}
                  className="w-full rounded-xs px-2 py-1.5 text-left transition hover:bg-superficie"
                >
                  {/* La clave arriba y el ejemplo debajo: en una
                      columna angosta, en la misma línea se corta
                      justo el ejemplo, que es lo que dice qué da
                      cada una. */}
                  <span className="block truncate font-mono text-[12px] font-bold text-marca">
                    {`{{${v.clave}}}`}
                  </span>
                  <span className="block truncate text-[11.5px] text-texto-suave">
                    {v.titulo} · <em className="opacity-80">{v.ejemplo}</em>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {grupos.length === 0 && (
        <p className="text-[12.5px] text-texto-suave">
          Ningún dato coincide con «{consulta}».
        </p>
      )}
    </div>
  );
}

/**
 * Pega la clave donde esté el cursor del textarea.
 *
 * Se comparte por lo mismo que el catálogo: campañas pegaba al
 * FINAL del mensaje --`cuerpo + "{{clave}}"`--, así que quien
 * quería el saludo en la primera línea tenía que bajar al
 * final, cortar y subir a pegar.
 *
 * Devuelve el texto nuevo; el cursor lo recoloca ella.
 */
export function pegarEnElCursor(
  caja: HTMLTextAreaElement | null,
  texto: string,
  clave: string,
): string {
  const trozo = `{{${clave}}}`;
  if (!caja) return texto + trozo;

  const { selectionStart: a, selectionEnd: z } = caja;
  const nuevo = texto.slice(0, a) + trozo + texto.slice(z);

  // devolver el cursor detrás de lo pegado
  requestAnimationFrame(() => {
    caja.focus();
    caja.setSelectionRange(a + trozo.length, a + trozo.length);
  });

  return nuevo;
}
