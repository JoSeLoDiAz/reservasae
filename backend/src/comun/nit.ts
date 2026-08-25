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

/// Lo que se saca de lo que tecleó una persona. El DV
/// nunca se le pide: se calcula. Solo se contrasta si
/// vino escrito, para avisar de que no cuadra.
export type LecturaNit = {
  /** Solo dígitos, sin puntos ni guion. */
  nit: string;
  /** El de la DIAN. Este es el que vale. */
  digitoVerificacion: string;
  /** El que vino escrito, si vino alguno. */
  digitoTecleado: string | null;
  /** Falso solo si tecleó uno y no cuadra. */
  digitoCuadra: boolean;
  /** Nueve dígitos empezando en 8 o 9. */
  pareceEmpresa: boolean;
};

/** Lee un NIT tecleado y dice qué tiene de raro. */
export function leerNit(valor: string): LecturaNit | null {
  const base = normalizarNit(valor);
  if (!base) return null;

  const limpio = valor.replace(/[\s.]/g, '').trim();
  const tecleado = /^\d{5,15}-(\d)$/.exec(limpio)?.[1] ?? null;
  const calculado = calcularDigitoVerificacion(base.nit);

  return {
    nit: base.nit,
    digitoVerificacion: calculado,
    digitoTecleado: tecleado,
    digitoCuadra: tecleado === null || tecleado === calculado,
    pareceEmpresa: pareceNitDeEmpresa(base.nit),
  };
}

/// Los NIT de empresa de hoy son nueve dígitos y
/// empiezan en 8 o 9. Los viejos no siguen la regla:
/// 20759265 es un colegio y 65114559 una fundación.
/// Por eso esto solo sirve para avisar, nunca para
/// rechazar: un falso negativo deja fuera a alguien real.
export function pareceNitDeEmpresa(numero: string): boolean {
  return /^[89]\d{8}$/.test(numero);
}

/// Un independiente se identifica con su cédula, que
/// hace de RUT. Si teclea algo con pinta de NIT de
/// empresa, se le avisa y se le deja seguir.
export type LecturaCedulaDeIndependiente = {
  cedula: string;
  /** Para el aviso, no para bloquear. */
  pareceDeEmpresa: boolean;
};

/** La cédula que hace de RUT del independiente. */
export function leerCedulaDeIndependiente(
  valor: string,
): LecturaCedulaDeIndependiente | null {
  const limpio = valor.replace(/[\s.\-]/g, '').trim();
  if (!/^\d{4,10}$/.test(limpio)) return null;

  return {
    cedula: limpio,
    pareceDeEmpresa: pareceNitDeEmpresa(limpio),
  };
}

/** Para mostrar: 900.421.154-7 */
export function formatearNit(nit: string, dv?: string | null): string {
  const conPuntos = nit.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const digito = dv ?? calcularDigitoVerificacion(nit);
  return `${conPuntos}-${digito}`;
}
