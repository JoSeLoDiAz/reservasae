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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // el script fija data-tema antes
      suppressHydrationWarning
    >
      <head>
        {/* fija tema y colores antes de pintar */}
        <script
          dangerouslySetInnerHTML={{ __html: SCRIPT_SIN_PARPADEO + SCRIPT_PALETA }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/* colores tambien en el panel */}
        <ProveedorMarca>{children}</ProveedorMarca>
      </body>
    </html>
  );
}
