import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ProveedorMarca } from "@/components/marca-publica";
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
  description: "Reserva de cupos para acciones de formación continua especializada.",
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
        {/* Corre antes que cualquier bundle: si esperara a la hidratacion, la
            pagina se dibujaria en claro y saltaria a oscuro de golpe. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_SIN_PARPADEO }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/* Envuelve tambien el panel: asi el administrador ve el resultado de
            sus propios cambios de color mientras los hace. */}
        <ProveedorMarca>{children}</ProveedorMarca>
      </body>
    </html>
  );
}
