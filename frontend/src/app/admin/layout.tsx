"use client";

import { usePathname } from "next/navigation";

import { MarcoAdmin } from "@/components/admin/marco-admin";

/** El acceso no pasa por el marco: seria un bucle. */
export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  if (ruta === "/admin/login") return <>{children}</>;
  return <MarcoAdmin>{children}</MarcoAdmin>;
}
