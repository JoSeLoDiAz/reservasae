/**
 * El dígito de verificación de la DIAN, en la pantalla.
 *
 * Es COPIA de `calcularDigitoVerificacion` en
 * `backend/src/comun/nit.ts`, y tiene que seguir siéndolo: el
 * servidor recalcula el suyo al guardar y es el que vale. Este
 * existe para que la persona VEA el dígito mientras escribe el
 * NIT y lo compare con el de su RUT: si no coinciden, lo que está
 * mal es el NIT que tecleó, y ese es el momento de notarlo.
 *
 * Antes el DV se tecleaba en su propia casilla y se guardaba tal
 * cual. Desde el 11 sep 2026 no se pide: para cada NIT hay uno
 * solo, y se calcula.
 */

const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Vacío si todavía no hay NIT con que calcularlo. */
export function digitoVerificacion(nit: string): string {
  const digitos = nit.replace(/\D/g, "");
  // el backend no admite NIT de menos de 5 ni de más de 15
  if (digitos.length < 5 || digitos.length > PESOS.length) return "";

  let suma = 0;
  digitos
    .split("")
    .reverse()
    .forEach((d, i) => {
      suma += Number(d) * PESOS[i];
    });

  const resto = suma % 11;
  return String(resto === 0 || resto === 1 ? resto : 11 - resto);
}
