/** Qué le falta a una empresa, y solo lo que se le pregunta. */

/// El maestro de empresas guarda mucho más —CIIU, tamaño,
/// número de trabajadores— pero al EMPLEADO no se le pregunta
/// eso: se le pregunta lo poco que solo él puede saber, y aun
/// eso solo si no lo tenemos ya.
///
/// Vive aparte porque decide si un paso entero del formulario
/// se le enseña o no. Metido dentro de la pantalla, esa
/// decisión no se puede probar.

export type EmpresaParaRevisar = {
  sectorEconomico: string | null;
  contactoNombre: string | null;
  contactoCargo: string | null;
  contactoCorreo: string | null;
};

export function faltaDeLaEmpresa(e: EmpresaParaRevisar): string[] {
  const falta: string[] = [];
  if (!e.sectorEconomico?.trim()) falta.push('sector económico');
  if (!e.contactoNombre?.trim()) falta.push('nombre del jefe directo');
  if (!e.contactoCargo?.trim()) falta.push('cargo del jefe directo');
  if (!e.contactoCorreo?.trim()) falta.push('correo del jefe directo');
  return falta;
}
