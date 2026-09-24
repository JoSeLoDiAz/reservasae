/** Qué le falta a una empresa, y solo lo que se le pregunta. */

/// El maestro de empresas guarda mucho más —CIIU, tamaño,
/// número de trabajadores— pero al EMPLEADO no se le pregunta
/// eso: se le pregunta lo poco que solo él puede saber, y aun
/// eso solo si no lo tenemos ya.
///
/// Vive aparte porque decide si un paso entero del formulario
/// se le enseña o no. Metido dentro de la pantalla, esa
/// decisión no se puede probar.

/// LA REGLA SE MUDÓ a `crm/completitud.ts` (24 sep 2026).
///
/// Vivía aquí y otra vez, privada, dentro de `crm.service`, y las
/// dos diferían: aquella conocía la excepción de quien trabaja
/// por su cuenta y esta no, así que a un independiente el enlace
/// le pedía el correo de un jefe que su propia ficha ya daba por
/// no aplicable. Este archivo se queda como puerta para no tocar
/// a quien ya lo importa.
export type { EmpresaDeLaFicha as EmpresaParaRevisar } from '../crm/completitud';
export { faltaDeLaEmpresa } from '../crm/completitud';
