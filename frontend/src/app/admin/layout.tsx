"use client";

import { usePathname } from "next/navigation";

import { MarcoAdmin } from "@/components/admin/marco-admin";

/**
 * El acceso cuelga de /admin como todo lo demás, pero no puede pasar por el
 * marco: ese marco es justamente el que exige sesión y redirige aquí. Sin esta
 * excepción, entrar sería un bucle.
 */
export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  if (ruta === "/admin/login") return <>{children}</>;
  return <MarcoAdmin>{children}</MarcoAdmin>;
}
