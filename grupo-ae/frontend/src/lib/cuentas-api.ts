/** Las cuentas: cada empresa con su gente y sus negocios. */

import { pedir } from "./pedir";
import type { EtapaOportunidad, TipoEmbudo } from "./oportunidades-api";

export type CuentaEnLista = {
  id: string;
  nit: string;
  digitoVerificacion: string | null;
  razonSocial: string;
  numeroColaboradores: number | null;
  contactoNombre: string | null;
  negocios: number;
  abiertos: number;
  valorAbierto: number;
  ganado: number;
  facturado: number;
  ultimoMovimiento: string | null;
};

export type FichaDeCuenta = {
  empresa: {
    id: string;
    nit: string;
    digitoVerificacion: string | null;
    razonSocial: string;
    numeroColaboradores: number | null;
    direccion: string | null;
    telefono: string | null;
    sectorEconomico: string | null;
    contactoNombre: string | null;
    contactoCargo: string | null;
    contactoCorreo: string | null;
    creadoEn: string;
  };
  cifras: { negocios: number; abiertos: number; valorAbierto: number; ganado: number; facturado: number };
  contactos: Array<{
    id: string | null;
    nombre: string;
    cargo: string | null;
    correo: string | null;
    celular: string | null;
    negocios: number;
  }>;
  negocios: Array<{
    id: string;
    codigo: string;
    titulo: string;
    embudo: TipoEmbudo;
    etapa: EtapaOportunidad;
    valor: number;
    valorFacturado: number | null;
    cantidad: number | null;
    cierreEsperado: string | null;
    creadoEn: string;
    ultimoToqueEn: string;
    servicio: { nombre: string; familia: "EDUCACION" | "EMPRESAS"; unidad: string } | null;
    asesor: { id: string; nombre: string } | null;
    persona: { id: string; primerNombre: string; primerApellido: string } | null;
  }>;
};

export type CambioDeCuenta = Partial<{
  direccion: string | null;
  telefono: string | null;
  sectorEconomico: string | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoCorreo: string | null;
  numeroColaboradores: number | null;
}>;

export const cuentasApi = {
  listar: (buscar?: string) =>
    pedir<CuentaEnLista[]>(
      `/admin/cuentas${buscar?.trim() ? `?buscar=${encodeURIComponent(buscar.trim())}` : ""}`,
    ),
  ficha: (id: string) => pedir<FichaDeCuenta>(`/admin/cuentas/${id}`),
  actualizar: (id: string, cambios: CambioDeCuenta) =>
    pedir<FichaDeCuenta>(`/admin/cuentas/${id}`, { method: "PATCH", body: JSON.stringify(cambios) }),
};
