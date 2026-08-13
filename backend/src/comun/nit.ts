/** El NIT sin puntos ni DV. */

export type NitNormalizado = {
  nit: string;
  digitoVerificacion: string | null;
};

export function normalizarNit(valor: string): NitNormalizado | null {
  const limpio = valor.replace(/[\s.]/g, '').trim();
  if (!limpio) return null;

  // con DV o sin él
  const conGuion = /^(\d{5,15})-(\d)$/.exec(limpio);
  if (conGuion) {
    return { nit: conGuion[1], digitoVerificacion: conGuion[2] };
  }

  if (/^\d{5,15}$/.test(limpio)) {
    return { nit: limpio, digitoVerificacion: calcularDigitoVerificacion(limpio) };
  }

  return null;
}

/** El dígito de verificación de la DIAN. */
export function calcularDigitoVerificacion(nit: string): string {
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digitos = nit.split('').reverse();

  let suma = 0;
  for (let i = 0; i < digitos.length; i += 1) {
    suma += Number(digitos[i]) * pesos[i];
  }

  const resto = suma % 11;
  if (resto === 0 || resto === 1) return String(resto);
  return String(11 - resto);
}
