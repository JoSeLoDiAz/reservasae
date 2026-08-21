"use client";

import { usePathname } from "next/navigation";

import { MarcoAdmin } from "@/components/admin/marco-admin";
import { ProveedorToast } from "@/components/admin/toast";

/** El acceso no pasa por el marco: seria un bucle. */
export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  return (
    <ProveedorToast>
      {ruta === "/admin/login" ? children : <MarcoAdmin>{children}</MarcoAdmin>}
    </ProveedorToast>
  );
}
