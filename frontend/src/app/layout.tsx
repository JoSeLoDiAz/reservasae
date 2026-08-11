import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ProveedorMarca } from "@/components/marca-publica";
import { SCRIPT_PALETA } from "@/lib/marca";
import { SCRIPT_SIN_PARPADEO } from "@/lib/tema";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Convoca",
  /*
   * Sin descripción a propósito. La que había ("acciones de formación continua
   * especializada") aparecía en el HTML de TODAS las páginas, incluido el 404,
   * y es justo lo que la decisión de producto dice que no se menciona en
   * público. El nombre sí puede quedarse: no dice de qué va.
   */

  /*
   * `noindex` y no solo robots.txt.
   *
   * Cloudflare inyecta su propio robots.txt gestionado ANTES del nuestro, y el
   * suyo trae `User-agent: * / Allow: /`. Con dos grupos para el mismo agente
   * las reglas se fusionan y, a igualdad de longitud, el Allow gana: nuestro
   * Disallow quedaba anulado.
   *
   * `noindex` va en la cabecera de cada página, así que Cloudflare no lo toca.
   * Además es más fuerte: robots.txt solo evita que rastreen, mientras que
   * noindex evita que indexen aunque lleguen por un enlace de otro sitio.
   */
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // El script de abajo fija data-tema antes de pintar; sin esto React
      // avisaria de que el HTML del servidor y el del cliente no coinciden.
      suppressHydrationWarning
    >
      <head>
        {/* fija tema y colores antes de pintar */}
        <script
          dangerouslySetInnerHTML={{ __html: SCRIPT_SIN_PARPADEO + SCRIPT_PALETA }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/* Envuelve tambien el panel: asi el administrador ve el resultado de
            sus propios cambios de color mientras los hace. */}
        <ProveedorMarca>{children}</ProveedorMarca>
      </body>
    </html>
  );
}
