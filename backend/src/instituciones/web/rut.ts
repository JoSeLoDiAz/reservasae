/** Migración de un RUT (persona natural): reglas fijas, sin búsqueda web. */

/// Un RUT es una persona, no una empresa: no se busca en Google. Se migra
/// con reglas fijas acordadas:
///   - Tamaño = MICROEMPRESA (fijo).
///   - Clasificación = EMPRESA_PRIVADA (fijo): un independiente es actor
///     económico privado; de los tipos SENA, es el que aplica.
///   - Empleados = # de registros con ese mismo RUT (mín. 1).
///   - Contacto/ubicación = datos básicos del participante.
///   - Departamento = derivado de la ciudad.
///   - Sector = el del participante; CIIU = calculado del sector (revisar).

import { ciiuPorSector, derivarDepartamento, type CamposPropuestos } from './ficha-a-propuesta';

export type DatosRut = {
  /** Nombre de la persona (razón social del independiente). */
  nombre?: string | null;
  ciudadNombre?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  /** Uno de: Comercio, Servicios, Manufactura. */
  sectorEconomico?: string | null;
  /** # de registros/participantes con ese mismo RUT. */
  registros?: number | null;
};

export function propuestaDeRut(datos: DatosRut): CamposPropuestos {
  const p: CamposPropuestos = {};
  const pon = (k: string, v: string | number | null | undefined) => {
    if (v !== null && v !== undefined && v !== '') p[k] = v;
  };

  const empleados = Math.max(1, Math.trunc(datos.registros ?? 1) || 1);

  pon('razonSocial', limpiarMayus(datos.nombre));
  pon('tamano', 'MICROEMPRESA');
  pon('clasificacion', 'EMPRESA_PRIVADA');
  pon('numeroEmpleados', empleados);
  pon('direccion', datos.direccion?.trim());
  pon('telefono', datos.telefono?.trim());
  pon('correo', datos.correo?.trim().toLowerCase());
  pon('ciudadNombre', datos.ciudadNombre?.trim());
  pon('departamentoNombre', derivarDepartamento(datos.ciudadNombre));

  if (datos.sectorEconomico) {
    pon('sectorEconomico', datos.sectorEconomico.trim().toUpperCase());
    const par = ciiuPorSector(datos.sectorEconomico);
    if (par) pon('codigoCiiu', par.ciiu);
  }

  return p;
}

function limpiarMayus(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t ? t.toUpperCase() : null;
}
