/**
 * El NIT es la identidad de la empresa en todo el sistema: es la clave única y
 * es lo que permite volver a editar una reserva. Si entra escrito de tres
 * formas distintas ("860.505.081-5", "860505081", "860505081-5") acabaríamos
 * con tres empresas y tres cuentas de cupos separadas.
 *
 * Por eso siempre se guarda solo el número, sin puntos, espacios ni dígito de
 * verificación, y el DV se separa aparte.
 */

export type NitNormalizado = {
  nit: string;
  digitoVerificacion: string | null;
};

export function normalizarNit(valor: string): NitNormalizado | null {
  const limpio = valor.replace(/[\s.]/g, '').trim();
  if (!limpio) return null;

  // Acepta "860505081-5" y también "860505081" sin DV.
  const conGuion = /^(\d{5,15})-(\d)$/.exec(limpio);
  if (conGuion) {
    return { nit: conGuion[1], digitoVerificacion: conGuion[2] };
  }

  if (/^\d{5,15}$/.test(limpio)) {
    return { nit: limpio, digitoVerificacion: calcularDigitoVerificacion(limpio) };
  }

  return null;
}

/**
 * Algoritmo del DV que usa la DIAN. Se calcula en vez de exigirlo para que
 * quien escriba solo el número no quede con el campo vacío, y para poder
 * avisar si el DV que escribieron no corresponde.
 */
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
