import type { Metadata } from "next";
import { Raleway } from "next/font/google";

import { EstilosGremio } from "@/components/estilos-gremio";
import { FranjaEntorno } from "@/components/franja-entorno";
import { ProveedorMarca } from "@/components/marca-publica";
import { SCRIPT_ACCESIBILIDAD } from "@/lib/accesibilidad";
import { SCRIPT_PALETA } from "@/lib/marca";
import { SCRIPT_SIN_PARPADEO } from "@/lib/tema";
import "./globals.css";

/// LA UNICA AUTORIZADA POR LA MARCA.
///
/// El handoff del redisenio pedia Sora y Public Sans, y se
/// llegaron a cargar. Pero la tipografia no es una decision de
/// diseno de pantalla: es de marca, y la marca solo autoriza
/// Raleway. Se conservan del diseno los TAMANOS, los pesos y
/// los espaciados; la letra es esta.
const raleway = Raleway({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "Convoca CRM",
  // sin descripcion: saldria hasta en el 404

  // noindex: Cloudflare pisa el robots.txt
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
      className={`${raleway.variable} h-full antialiased`}
      // el script fija data-tema antes
      suppressHydrationWarning
    >
      <head>
        {/* fija tema y colores antes de pintar */}
        <script
          dangerouslySetInnerHTML={{
            __html: SCRIPT_SIN_PARPADEO + SCRIPT_PALETA + SCRIPT_ACCESIBILIDAD,
          }}
        />
        {/* despues del script, para ganarle */}
        <EstilosGremio />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <FranjaEntorno />
        {/* colores tambien en el panel */}
        <ProveedorMarca>{children}</ProveedorMarca>
      </body>
    </html>
  );
}
