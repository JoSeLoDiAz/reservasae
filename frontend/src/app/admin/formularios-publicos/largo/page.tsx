"use client";

/** Formulario 2 Largo: lo que falta para el reporte. */

/// El segundo momento, y NO es público.
///
/// Cada enlace se emite desde la ficha de un lead, sirve una
/// sola vez y caduca. Por eso esta pantalla no ofrece QR: un
/// código pegado en una pared solo puede llevar a un sitio, y
/// este cambia por persona. Ofrecerlo sería prometer algo que
/// no puede cumplir.

import { LoQuePregunta, type Bloque } from "@/components/admin/formulario-publico";
import { Tarjeta } from "@/components/admin/marco-admin";

const BLOQUES: Bloque[] = [
  {
    titulo: "Primero, su organización",
    campos: [
      { etiqueta: "NIT y dígito de verificación" },
      { etiqueta: "Razón social" },
      { etiqueta: "Dirección" },
      { etiqueta: "Teléfono" },
      { etiqueta: "Departamento y municipio" },
      { etiqueta: "Sector económico" },
      { etiqueta: "Número de trabajadores" },
      { etiqueta: "Persona de contacto, su cargo y correo" },
      { etiqueta: "O bien: «trabajo por mi cuenta», y su cédula es su RUT" },
    ],
  },
  {
    titulo: "Después, lo suyo",
    campos: [
      { etiqueta: "Fecha de nacimiento" },
      { etiqueta: "Estrato" },
      { etiqueta: "Dirección y barrio" },
      { etiqueta: "Departamento y municipio donde vive" },
      { etiqueta: "Nivel educativo" },
      { etiqueta: "Cargo en la empresa" },
      { etiqueta: "Nivel ocupacional" },
      { etiqueta: "Si ya fue beneficiario antes" },
    ],
  },
];

export default function Largo() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Formulario 2 Largo</h1>
        <p className="mt-1 text-texto-suave">
          Lo que falta para poder reportar a la persona al SENA. Se le manda
          después de que llene el corto.
        </p>
      </header>

      <Tarjeta titulo="Este no tiene QR, y no es un olvido">
        <div className="space-y-2 text-sm">
          <p>
            Cada enlace de este formulario es <strong>personal y de un solo uso</strong>:
            se emite desde la ficha del lead, caduca, y el siguiente anula al anterior.
          </p>
          <p className="text-texto-suave">
            Un QR pegado en una pared solo puede llevar a un sitio, y esta dirección
            cambia por persona. Para mandárselo a alguien, abra su lead en{" "}
            <strong>Gestión de leads</strong> y use «Enlace para que complete sus datos».
          </p>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Lo que le pregunta">
        <LoQuePregunta bloques={BLOQUES} />
        <p className="mt-4 text-xs text-texto-suave">
          Solo se le pregunta lo que falta. Lo que ya dio en el corto no se le
          vuelve a pedir.
        </p>
      </Tarjeta>
    </div>
  );
}
