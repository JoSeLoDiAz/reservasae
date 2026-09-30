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

/**
 * El NIT con el DV pegado detrás, sin guion: `8001837677`.
 *
 * Es COPIA de `traeElDvPegado` en `backend/src/comun/nit.ts`, y
 * tiene que seguir siéndolo: el servidor vuelve a partirlo al
 * guardar y es el que vale. Este existe para que quien pega el
 * NIT VEA cómo se reparte en los dos campos, en vez de que se lo
 * corrijan por detrás.
 *
 * Así nacieron siete organizaciones duplicadas en producción, y
 * las tres condiciones son lo que lo hace seguro: diez dígitos,
 * empieza en 8 o 9 --una cédula empieza en 1 y no se parte-- y el
 * último es EXACTAMENTE el dígito que le corresponde a los nueve
 * primeros.
 */
export function partirNitPegado(
  valor: string,
): { nit: string; dv: string } | null {
  const digitos = valor.replace(/\D/g, "");
  if (!/^[89]\d{9}$/.test(digitos)) return null;

  const nit = digitos.slice(0, 9);
  const ultimo = digitos.slice(9);
  if (digitoVerificacion(nit) !== ultimo) return null;

  return { nit, dv: ultimo };
}
